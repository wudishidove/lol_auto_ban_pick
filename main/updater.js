const {app} = require('electron');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {spawn, execFile} = require('child_process');
const logger = require('./logger');

const RELEASE_API = 'https://api.github.com/repos/wudishidove/lol_auto_ban_pick/releases/latest';
const ALLOWED_HOSTS = ['github.com', 'githubusercontent.com'];
const REQUEST_TIMEOUT_MS = 30 * 1000;
const PROGRESS_INTERVAL_MS = 200;
// GitHub 的 release CDN 單一連線常常只有幾十 KB/s，而且每條快慢差很多，分段用多條連線同時下載
const SEGMENT_SIZE = 2 * 1024 * 1024;
const MAX_CONNECTIONS = 32;
// 閒下來的連線會把別人剩下的切一半來抓，每份至少這麼大
const MIN_SPLIT_SIZE = 128 * 1024;
// 這麼久沒收到資料就斷線重連，從斷點繼續
const STALL_TIMEOUT_MS = 10 * 1000;
// 同一段連續失敗且完全沒進度才放棄
const RANGE_RETRIES = 8;

// keep-alive 讓同一條連線接著抓下一段，不用每段都重新握手
const downloadAgent = new https.Agent({keepAlive: true, maxSockets: MAX_CONNECTIONS});

let isInstalling = false;

const parseVersion = (versionString) => {
  const version = String(versionString || '');
  return version.startsWith('v') ? version.substring(1) : version;
};

// 只吃純數字 semver，release tag 要用 vX.Y.Z
const isNewerVersion = (current, latest) => {
  const currentParts = current.split('.').map(Number);
  const latestParts = latest.split('.').map(Number);
  for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
    const currentPart = currentParts[i] || 0;
    const latestPart = latestParts[i] || 0;
    if (currentPart < latestPart) return true;
    if (currentPart > latestPart) return false;
  }
  return false;
};

function request(url, headers = {}, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const {protocol, hostname} = new URL(url);
    const isAllowedHost = ALLOWED_HOSTS.some(host => hostname === host || hostname.endsWith(`.${host}`));
    if (protocol !== 'https:' || !isAllowedHost) {
      reject(new Error(`unexpected update url: ${url}`));
      return;
    }
    const req = https.get(url, {
      headers: {'User-Agent': `lol-auto-accept/${app.getVersion()}`, ...headers},
      // main.js 為了 LCU 的自簽憑證全域關閉了憑證驗證，更新檔是可執行檔，這裡必須驗證
      rejectUnauthorized: true,
      agent: downloadAgent,
    }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        if (redirectsLeft <= 0) {
          reject(new Error('too many redirects'));
          return;
        }
        resolve(request(new URL(res.headers.location, url).href, headers, redirectsLeft - 1));
        return;
      }
      if (res.statusCode !== 200 && res.statusCode !== 206) {
        res.resume();
        reject(Object.assign(new Error(`HTTP ${res.statusCode}`), {statusCode: res.statusCode}));
        return;
      }
      res.finalUrl = url;
      resolve(res);
    });
    req.setTimeout(REQUEST_TIMEOUT_MS, () => req.destroy(new Error('request timeout')));
    req.on('error', reject);
  });
}

async function fetchLatestRelease() {
  const res = await request(RELEASE_API);
  const chunks = [];
  for await (const chunk of res) chunks.push(chunk);
  const release = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const zips = (release.assets || []).filter(asset => asset.name.endsWith('.zip'));
  const asset = zips.find(a => a.name.includes('win32')) || zips[0];
  return {
    tagName: release.tag_name,
    latestVersion: parseVersion(release.tag_name),
    releaseUrl: release.html_url,
    notes: release.body || '',
    asset: asset ? {
      name: asset.name,
      url: asset.browser_download_url,
      size: asset.size,
      digest: asset.digest || '', // 例: sha256:7abe...
    } : null,
  };
}

async function checkForUpdate() {
  const currentVersion = app.getVersion();
  const release = await fetchLatestRelease();
  const {asset, ...info} = release;
  return {
    ...info,
    currentVersion,
    hasUpdate: isNewerVersion(currentVersion, release.latestVersion),
    // 開發模式的 execPath 是 node_modules 裡的 electron，不能覆蓋
    canInstall: app.isPackaged && process.platform === 'win32' && !!asset,
    downloadSize: asset ? asset.size : 0,
  };
}

function createProgressReporter(total, onProgress) {
  let received = 0;
  let lastProgressAt = 0;
  return {
    add(bytes) {
      received += bytes;
      const now = Date.now();
      if (bytes > 0 && now - lastProgressAt < PROGRESS_INTERVAL_MS) return;
      lastProgressAt = now;
      onProgress({received, total});
    },
    done: () => onProgress({received, total}),
  };
}

async function downloadSingle(url, dest, expectedSize, onProgress) {
  const res = await request(url);
  const progress = createProgressReporter(Number(res.headers['content-length']) || expectedSize || 0, onProgress);
  const file = fs.createWriteStream(dest);
  try {
    for await (const chunk of res) {
      if (!file.write(chunk)) await new Promise(resolve => file.once('drain', resolve));
      progress.add(chunk.length);
    }
  } finally {
    await new Promise(resolve => file.end(resolve));
  }
  progress.done();
}

// 跟著 github.com 的重導拿到 CDN 的簽章網址(約一小時有效)，之後每段直接連 CDN
async function resolveDownloadUrl(url) {
  const res = await request(url, {Range: 'bytes=0-0'});
  res.resume();
  return {url: res.finalUrl, acceptsRanges: res.statusCode === 206};
}

// 抓 range.pos ~ range.end，pos 隨寫入前進；end 可能被別的連線切走一半而變小
async function fetchRange(url, handle, range, progress) {
  const res = await request(url, {Range: `bytes=${range.pos}-${range.end}`});
  if (res.statusCode !== 206) {
    res.destroy();
    throw new Error('range request not supported');
  }
  let stallTimer;
  const resetStallTimer = () => {
    clearTimeout(stallTimer);
    stallTimer = setTimeout(() => res.destroy(new Error('stalled')), STALL_TIMEOUT_MS);
  };
  resetStallTimer();
  try {
    for await (const chunk of res) {
      resetStallTimer();
      const length = Math.min(chunk.length, range.end - range.pos + 1);
      if (length > 0) {
        // 先推進 pos 再寫檔，切段時才不會切到正在寫的這塊
        const position = range.pos;
        range.pos += length;
        await handle.write(chunk, 0, length, position);
        progress.add(length);
      }
      if (range.pos > range.end) break;
    }
  } finally {
    clearTimeout(stallTimer);
    res.destroy();
  }
  if (range.pos <= range.end) throw new Error('connection closed early');
}

async function downloadParallel(sourceUrl, url, dest, size, onProgress) {
  const ranges = [];
  for (let start = 0; start < size; start += SEGMENT_SIZE) {
    ranges.push({pos: start, end: Math.min(start + SEGMENT_SIZE, size) - 1, active: false, failures: 0});
  }
  const takeRange = () => {
    const idle = ranges.find(r => !r.active && r.pos <= r.end);
    if (idle) return idle;
    // 沒有待抓的段了，把還在抓、剩最多的那段切一半過來，避免最後只剩幾條慢連線在跑
    const busiest = ranges
      .filter(r => r.active)
      .reduce((a, b) => (!a || b.end - b.pos > a.end - a.pos ? b : a), null);
    if (!busiest || busiest.end - busiest.pos + 1 < MIN_SPLIT_SIZE * 2) return null;
    const mid = busiest.pos + Math.floor((busiest.end - busiest.pos + 1) / 2);
    const stolen = {pos: mid, end: busiest.end, active: false, failures: 0};
    busiest.end = mid - 1;
    ranges.push(stolen);
    return stolen;
  };

  let currentUrl = url;
  let refreshing = null;
  // 簽章網址過期(403)就重新跟 github.com 要一次
  const refreshUrl = () => refreshing || (refreshing = resolveDownloadUrl(sourceUrl)
    .then(resolved => { currentUrl = resolved.url; })
    .finally(() => { refreshing = null; }));

  const progress = createProgressReporter(size, onProgress);
  const handle = await fs.promises.open(dest, 'w');
  let failure = null;
  const worker = async () => {
    for (let range = takeRange(); range && !failure; range = takeRange()) {
      range.active = true;
      const startPos = range.pos;
      try {
        await fetchRange(currentUrl, handle, range, progress);
      } catch (error) {
        // 有抓到東西就不算失敗，下次從斷點繼續
        range.failures = range.pos > startPos ? 0 : range.failures + 1;
        if (range.failures >= RANGE_RETRIES) {
          failure = error;
        } else if (error.statusCode === 403) {
          await refreshUrl().catch(() => {});
        } else if (range.failures > 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * range.failures));
        }
      } finally {
        range.active = false;
      }
    }
  };
  try {
    await Promise.all(Array.from({length: Math.min(MAX_CONNECTIONS, ranges.length)}, worker));
  } finally {
    await handle.close();
  }
  if (failure) throw failure;
  if (ranges.some(r => r.pos <= r.end)) throw new Error('download incomplete');
  progress.done();
}

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    fs.createReadStream(filePath)
      .on('data', chunk => hash.update(chunk))
      .on('error', reject)
      .on('end', () => resolve(hash.digest('hex')));
  });
}

async function downloadFile(url, dest, expectedSize, onProgress) {
  try {
    const resolved = await resolveDownloadUrl(url);
    if (resolved.acceptsRanges && expectedSize > SEGMENT_SIZE) {
      await downloadParallel(url, resolved.url, dest, expectedSize, onProgress);
    } else {
      await downloadSingle(resolved.url, dest, expectedSize, onProgress);
    }
  } finally {
    downloadAgent.destroy(); // 關掉閒置的 keep-alive 連線
  }
  return {size: fs.statSync(dest).size, sha256: await hashFile(dest)};
}

function extractZip(zipPath, destDir) {
  // Windows 10 1803 之後內建 bsdtar，可以解 zip
  const tarPath = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
  return new Promise((resolve, reject) => {
    execFile(tarPath, ['-xf', zipPath, '-C', destDir], {windowsHide: true}, (error, stdout, stderr) => {
      if (error) reject(new Error(`extract failed: ${stderr || error.message}`));
      else resolve();
    });
  });
}

// zip 內可能多包一層資料夾，找出 exe 所在的那一層
function findAppRoot(dir, exeName, depth = 2) {
  if (fs.existsSync(path.join(dir, exeName))) return dir;
  if (depth <= 0) return null;
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (!entry.isDirectory()) continue;
    const found = findAppRoot(path.join(dir, entry.name), exeName, depth - 1);
    if (found) return found;
  }
  return null;
}

function assertWritable(dir) {
  const probe = path.join(dir, `.update-probe-${process.pid}`);
  fs.writeFileSync(probe, '');
  fs.unlinkSync(probe);
}

// 路徑一律用環境變數傳入，bat 本身保持純 ASCII，避免中文路徑的編碼問題
const SWAP_SCRIPT = [
  '@echo off',
  'setlocal',
  // 工作目錄不能留在暫存資料夾，不然重新啟動的程式會鎖住它，刪不掉
  'cd /d "%LOLAPP_DST%"',
  // PATH 裡可能有同名的程式(例: Git 的 find.exe)，一律用完整路徑
  'set "SYS=%SystemRoot%\\System32"',
  'set /a tries=0',
  ':wait',
  // 執行中的 exe 無法開啟寫入，用這點判斷本程式是否已結束
  // (腳本以 detached 無主控台方式啟動，tasklist | find 這種管線會卡住，不能用)
  '2>nul ( >>"%LOLAPP_EXE%" (call ) ) && goto copy',
  'set /a tries+=1',
  'if %tries% GEQ 60 goto failed',
  '"%SYS%\\ping.exe" -n 2 127.0.0.1 >nul',
  'goto wait',
  ':copy',
  // 不用 /MIR 覆蓋整個資料夾，保留 app-config.json、data 與使用者自己放的檔案
  '"%SYS%\\robocopy.exe" "%LOLAPP_SRC%" "%LOLAPP_DST%" /E /R:20 /W:1 /NP /NFL /NDL /LOG+:"%LOLAPP_LOG%" >nul 2>&1',
  'if errorlevel 8 goto failed',
  // build 裡的檔名帶 hash，每版都不同，舊的要清掉
  '"%SYS%\\robocopy.exe" "%LOLAPP_SRC%\\resources\\app\\build" "%LOLAPP_DST%\\resources\\app\\build" /MIR /R:20 /W:1 /NP /NFL /NDL /LOG+:"%LOLAPP_LOG%" >nul 2>&1',
  'if errorlevel 8 goto failed',
  'start "" "%LOLAPP_EXE%"',
  // 成功就把整個暫存資料夾(含這支腳本)刪掉，(goto) 讓腳本先結束再刪
  // 腳本結束時隱含的 endlocal 會把工作目錄還原，所以要再切一次
  '(goto) 2>nul & cd /d "%LOLAPP_DST%" & rmdir /s /q "%LOLAPP_WORK%"',
  ':failed',
  // 失敗時留下 swap.log 方便查原因
  'start "" "%LOLAPP_EXE%"',
  'rmdir /s /q "%LOLAPP_SRC_ROOT%" >nul 2>&1',
  'del /q "%LOLAPP_ZIP%" >nul 2>&1',
  'endlocal',
  '',
].join('\r\n');

/**
 * 下載最新 release 並解壓縮，回傳啟動覆蓋腳本的函式
 * 覆蓋腳本會等本程式結束後，把新版檔案複製到安裝資料夾再重新啟動
 */
async function prepareUpdate(onProgress, {appDir = path.dirname(process.execPath), exeName = path.basename(process.execPath)} = {}) {
  const release = await fetchLatestRelease();
  if (!release.asset) throw new Error('no zip asset in latest release');
  assertWritable(appDir);

  const workDir = path.join(app.getPath('temp'), 'lol-app-update');
  fs.rmSync(workDir, {recursive: true, force: true});
  const extractDir = path.join(workDir, 'extracted');
  fs.mkdirSync(extractDir, {recursive: true});

  const zipPath = path.join(workDir, release.asset.name);
  logger.info(`[updater] downloading ${release.asset.url}`);
  const downloaded = await downloadFile(release.asset.url, zipPath, release.asset.size, onProgress);
  if (release.asset.size && downloaded.size !== release.asset.size) {
    throw new Error(`size mismatch: ${downloaded.size} != ${release.asset.size}`);
  }
  if (release.asset.digest.startsWith('sha256:') && release.asset.digest !== `sha256:${downloaded.sha256}`) {
    throw new Error('sha256 mismatch');
  }

  logger.info(`[updater] extracting ${zipPath}`);
  await extractZip(zipPath, extractDir);
  const newAppDir = findAppRoot(extractDir, exeName);
  if (!newAppDir) throw new Error(`${exeName} not found in ${release.asset.name}`);

  const scriptPath = path.join(workDir, 'swap.bat');
  fs.writeFileSync(scriptPath, SWAP_SCRIPT, 'ascii');

  return () => {
    logger.info(`[updater] launching swap script, ${newAppDir} -> ${appDir}`);
    const child = spawn('cmd.exe', ['/c', scriptPath], {
      cwd: workDir,
      detached: true,
      windowsHide: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        LOLAPP_SRC: newAppDir,
        LOLAPP_SRC_ROOT: extractDir,
        LOLAPP_DST: appDir,
        LOLAPP_EXE: path.join(appDir, exeName),
        LOLAPP_ZIP: zipPath,
        LOLAPP_WORK: workDir,
        LOLAPP_LOG: path.join(workDir, 'swap.log'),
      },
    });
    child.unref();
  };
}

/**
 * @param ipcMain
 * @param {function(): Electron.BrowserWindow} getWindow
 * @param {function(): void} quitApp - 儲存設定並結束程式
 */
function initUpdater(ipcMain, getWindow, quitApp) {
  ipcMain.handle('update-check', async () => {
    try {
      const result = await checkForUpdate();
      logger.info(`[updater] current:${result.currentVersion} latest:${result.latestVersion} hasUpdate:${result.hasUpdate}`);
      return result;
    } catch (error) {
      logger.error(`[updater] check failed: ${error.message}`);
      return {error: error.message};
    }
  });

  ipcMain.handle('update-install', async () => {
    if (isInstalling) return {error: 'already installing'};
    if (!app.isPackaged || process.platform !== 'win32') return {error: 'not supported'};
    isInstalling = true;
    try {
      const launchSwap = await prepareUpdate(progress => {
        const win = getWindow();
        if (win && !win.isDestroyed()) win.webContents.send('update-progress', progress);
      });
      launchSwap();
      quitApp();
      return {};
    } catch (error) {
      isInstalling = false;
      logger.error(`[updater] install failed: ${error.message}`);
      return {error: error.message};
    }
  });
}

module.exports = {initUpdater, checkForUpdate, prepareUpdate, isNewerVersion};
