import {lanes, listMode} from "../redux/reducers/ConfigReducer";

const {ipcRenderer} = window.require('electron');

// 同時輸出到 console 與主程式 log 檔，方便事後排查
export function log(message) {
  console.log(message);
  ipcRenderer.send('renderer-log', message);
}

// 自己被分配的路線，沒有分路(自訂、盲選等)時回傳 null
export function getMyLane(session) {
  const me = getLocalPlayer(session);
  const lane = (me?.assignedPosition ?? '').toLowerCase();
  return lanes.includes(lane) ? lane : null;
}

export function getLocalPlayer(session) {
  return (session?.myTeam ?? []).find(player => player.cellId === session.localPlayerCellId) ?? null;
}

// 回傳實際採用的清單來源，'global' 或路線名稱
export function resolveListKey(mode, laneChampionIds, lane) {
  if (mode === listMode.LANE && lane && (laneChampionIds?.[lane]?.length ?? 0) > 0) {
    return lane;
  }
  return 'global';
}

export function resolveChampionIds(mode, globalChampionIds, laneChampionIds, lane) {
  const key = resolveListKey(mode, laneChampionIds, lane);
  const championIds = key === 'global' ? globalChampionIds : laneChampionIds[key];
  return (championIds ?? []).map(Number);
}

// 找出自己尚未完成的動作，type 為 'ban' 或 'pick'
export function findMyAction(session, type) {
  if (!Array.isArray(session?.actions)) return null;
  return session.actions.flat().find(action =>
    action.type === type &&
    action.actorCellId === session.localPlayerCellId &&
    !action.completed
  ) ?? null;
}

export function getBannedChampionIds(session) {
  const banned = new Set();
  (session?.actions ?? []).flat()
    .filter(action => action.type === 'ban' && action.completed)
    .forEach(action => banned.add(action.championId));
  [...(session?.bans?.myTeamBans ?? []), ...(session?.bans?.theirTeamBans ?? [])]
    .forEach(championId => banned.add(championId));
  return banned;
}

// 已經被其他玩家(雙方)鎖定選走的英雄
export function getPickedChampionIds(session) {
  const picked = new Set();
  (session?.actions ?? []).flat()
    .filter(action => action.type === 'pick' && action.completed && action.actorCellId !== session.localPlayerCellId)
    .forEach(action => picked.add(action.championId));
  return picked;
}

export function getTeammates(session) {
  return (session?.myTeam ?? []).filter(player => player.cellId !== session.localPlayerCellId);
}
