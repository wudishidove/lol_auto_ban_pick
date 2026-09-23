import ApiUtils from "../api/api-utils";
import DatabaseUtils from "../components/common/DatabaseUtils";
import RuneDatabase from "../components/common/RuneDatabase";
import {LANE_QUEUE_IDS, SUMMONERS_RIFT_MAP_ID, summarizeGame} from "./runeUtils";

const RECENT_MATCH_COUNT = 20;
const DETAIL_REQUEST_INTERVAL_MS = 300; // 逐場抓詳細資料時的間隔，避免短時間內對用戶端送出一連串請求

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchGameDetail(gameId) {
  // 「最近遇過」功能可能已經把這場存進資料庫，有的話就不用再打 API
  const stored = await DatabaseUtils.getGame(String(gameId)).catch(() => null);
  if (stored?.data) return stored.data;
  await sleep(DETAIL_REQUEST_INTERVAL_MS);
  return ApiUtils.getHistoryGame(gameId);
}

/**
 * 近期對戰中有分路的場次，整理成 我的路線/英雄/對位/符文
 * 對戰列表只有自己的資料，要逐場抓詳細資料才知道對位；整理好的摘要會存進資料庫，
 * 所以每次重新整理只會對用戶端送 1 個列表請求，加上「沒看過的新場次」各 1 個請求
 * @returns {Promise<Array>} summarizeGame 的結果，新的在前
 */
export async function loadRecentLaneMatches() {
  const puuid = await ApiUtils.getCurrentSummonerPuuid();
  if (!puuid) throw new Error('LCU not connected');
  const matches = await ApiUtils.getCurrentSummonerMatches(0, RECENT_MATCH_COUNT - 1);
  // 先濾掉沒有分路的模式，省下抓詳細資料的請求
  const games = (matches?.games?.games ?? [])
    .filter(game => game.mapId === SUMMONERS_RIFT_MAP_ID && LANE_QUEUE_IDS.includes(game.queueId));
  const cached = await RuneDatabase.getMatchSummaries(puuid);
  const summaries = [];
  let hasNewGame = false;
  for (const game of games) {
    if (cached.has(game.gameId)) {
      if (cached.get(game.gameId).summary) summaries.push(cached.get(game.gameId).summary);
      continue;
    }
    const detail = await fetchGameDetail(game.gameId);
    if (!detail?.gameId) continue; // 抓失敗不快取，下次再試
    const summary = summarizeGame(detail, puuid);
    await RuneDatabase.saveMatchSummary(puuid, game.gameId, game.gameCreation, summary);
    hasNewGame = true;
    if (summary) summaries.push(summary);
  }
  if (hasNewGame) await RuneDatabase.trimMatchSummaries(puuid);
  return summaries.sort((a, b) => b.gameCreation - a.gameCreation);
}
