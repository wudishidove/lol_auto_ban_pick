import {lanes} from "../redux/reducers/ConfigReducer";

// 對戰紀錄的 participants 在會分路的模式下，每隊依 上/野/中/下/輔 排序，其他模式(盲選、ARAM 等)順序沒有意義
export const LANE_QUEUE_IDS = Object.freeze([400, 420, 440, 700]);
export const SUMMONERS_RIFT_MAP_ID = 11;
// 設定檔的 enemyChampionId 為 0 代表通用，不分對位
export const ANY_ENEMY = 0;
export const PERK_COUNT = 9;

export const profileSource = Object.freeze({
  AUTO: "auto", // 進遊戲時自動記錄
  HISTORY: "history", // 從近期對戰按星號存檔
  MANUAL: "manual", // 手動新增或編輯
});

export function getProfileId(lane, championId, enemyChampionId) {
  return `${lane}:${Number(championId)}:${Number(enemyChampionId) || ANY_ENEMY}`;
}

// 9 個符文: 主系 4 + 副系 2 + 屬性碎片 3
export function isCompletePerks(perkIds) {
  return Array.isArray(perkIds) && perkIds.length === PERK_COUNT && perkIds.every(id => Number(id) > 0);
}

// 副系的兩個符文用戶端會依所在列重新排序，所以不比順序
export function isSameRunes(a, b) {
  if (!a || !b) return false;
  if (a.primaryStyleId !== b.primaryStyleId || a.subStyleId !== b.subStyleId) return false;
  const perksA = a.selectedPerkIds ?? [];
  const perksB = b.selectedPerkIds ?? [];
  if (perksA.length !== perksB.length) return false;
  const isSameOrdered = (from, to) => perksA.slice(from, to).every((id, index) => id === perksB[from + index]);
  const subA = [...perksA.slice(4, 6)].sort();
  const subB = [...perksB.slice(4, 6)].sort();
  return isSameOrdered(0, 4) && isSameOrdered(6, PERK_COUNT) && subA.every((id, index) => id === subB[index]);
}

// 先找同路線+同英雄+同對位，沒有再找通用
export function findProfile(profiles, lane, championId, enemyChampionId) {
  const byId = new Map(profiles.map(profile => [profile._id, profile]));
  if (enemyChampionId) {
    const exact = byId.get(getProfileId(lane, championId, enemyChampionId));
    if (exact) return exact;
  }
  return byId.get(getProfileId(lane, championId, ANY_ENEMY)) ?? null;
}

/**
 * 把一場對戰紀錄整理成 我的路線/英雄/對位/符文，不是分路模式或資料不完整時回傳 null
 * 註: 對戰紀錄只有 6 個符文，沒有屬性碎片；timeline.lane/role 不可信，路線一律用 participants 順序判斷
 */
export function summarizeGame(game, puuid) {
  if (!game?.participants || !game?.participantIdentities) return null;
  if (game.mapId !== SUMMONERS_RIFT_MAP_ID || !LANE_QUEUE_IDS.includes(game.queueId)) return null;
  if (game.participants.length !== 10) return null;
  const identity = game.participantIdentities.find(item => item.player?.puuid === puuid);
  if (!identity) return null;
  const me = game.participants.find(participant => participant.participantId === identity.participantId);
  if (!me) return null;
  const myTeam = game.participants.filter(participant => participant.teamId === me.teamId);
  const enemyTeam = game.participants.filter(participant => participant.teamId !== me.teamId);
  if (myTeam.length !== 5 || enemyTeam.length !== 5) return null;
  const index = myTeam.indexOf(me);
  const stats = me.stats ?? {};
  return {
    gameId: game.gameId,
    gameCreation: game.gameCreation,
    queueId: game.queueId,
    win: !!stats.win,
    lane: lanes[index],
    championId: me.championId,
    enemyChampionId: enemyTeam[index].championId,
    primaryStyleId: stats.perkPrimaryStyle,
    subStyleId: stats.perkSubStyle,
    perkIds: [stats.perk0, stats.perk1, stats.perk2, stats.perk3, stats.perk4, stats.perk5],
  };
}

/**
 * 選角階段拿不到敵方路線，用官方的英雄推薦位置把已亮出的敵方英雄分配到各路，回傳跟我同路的英雄
 * @param {number[]} enemyChampionIds 敵方已亮出的英雄
 * @param {string} myLane 'top' | 'jungle' | ...
 * @param {Object} recommendedPositions /lol-perks/v1/recommended-champion-positions 的回傳，清單是照字母排不是照優先度
 * @param {Object} defaultPositions {championId: 'TOP'}，英雄最主要的位置，用來分出 上/中 都能走的英雄
 * @returns {number|null} 推測的對位英雄，沒有人被分到我這路時回傳 null
 */
export function inferLaneOpponent(enemyChampionIds, myLane, recommendedPositions, defaultPositions = {}) {
  const champions = (enemyChampionIds ?? []).filter(id => id > 0).slice(0, lanes.length);
  if (champions.length === 0 || !lanes.includes(myLane)) return null;
  const score = (championId, lane) => {
    const position = lane.toUpperCase();
    if (defaultPositions?.[championId] === position) return 10;
    const positions = recommendedPositions?.[championId]?.recommendedPositions ?? [];
    return positions.includes(position) ? 4 : 0;
  };
  let best = null;
  let bestScore = -1;
  const assign = (championIndex, usedLanes, assigned, total) => {
    if (championIndex === champions.length) {
      if (total > bestScore) {
        bestScore = total;
        best = [...assigned];
      }
      return;
    }
    lanes.forEach(lane => {
      if (usedLanes.has(lane)) return;
      usedLanes.add(lane);
      assigned.push(lane);
      assign(championIndex + 1, usedLanes, assigned, total + score(champions[championIndex], lane));
      assigned.pop();
      usedLanes.delete(lane);
    });
  };
  assign(0, new Set(), [], 0);
  const index = best.indexOf(myLane);
  if (index < 0) return null;
  // 敵方還沒全亮時，分到我這路但平常不走這路的英雄(分數 0)只是被擠過來的，不算對位；5 隻全亮時用排除法就是他
  if (champions.length < lanes.length && score(champions[index], myLane) === 0) return null;
  return champions[index];
}
