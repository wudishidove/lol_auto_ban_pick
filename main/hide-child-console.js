// league-connect 用 child_process.exec 開 PowerShell 找 LOL 用戶端的處理程序，沒有帶 windowsHide。
// 打包後的 exe 沒有主控台，每次執行都會跳出一個 cmd/PowerShell 視窗；
// 遊戲中用戶端(LeagueClientUx)會被關掉，套件每隔幾秒就重找一次，視窗就在遊戲中一直跳出來。
// 必須在 require('league-connect') 之前載入：套件在載入當下就把 exec 包成 promise 版本存起來。
const childProcess = require('child_process');
const util = require('util');

const originalExec = childProcess.exec;
const originalExecPromise = util.promisify(originalExec);

function hiddenExec(command, options, callback) {
  if (typeof options === 'function') {
    return originalExec(command, {windowsHide: true}, options);
  }
  return originalExec(command, {windowsHide: true, ...options}, callback);
}

// exec 的 promise 版本回傳 {stdout, stderr}，要沿用原本的自訂實作，不能讓 util.promisify 套用預設行為
hiddenExec[util.promisify.custom] = (command, options) =>
  originalExecPromise(command, {windowsHide: true, ...options});

childProcess.exec = hiddenExec;
