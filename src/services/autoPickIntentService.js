import {useEffect, useRef, useState} from 'react';
import {connect} from "react-redux";
import ApiUtils from "../api/api-utils";
import store from "../redux/store";
import withErrorBoundary from "../components/error/withErrorBoundary";
import {
  log,
  getMyLane,
  getLocalPlayer,
  resolveChampionIds,
  findMyAction,
  getBannedChampionIds,
  getPickedChampionIds,
  getTeammates
} from "./champSelectUtils";

const MAX_ATTEMPTS = 3; // 最多嘗試次數，避免 session 事件反覆觸發
const LOCK_BEFORE_END_MS = 1000; // 自動鎖角: 選角時間剩多久時送出鎖定
const HOVER_DELAY_MS = 5000; // 進選角後等多久才預選，客戶端進場動畫還沒播完就亮角很奇怪
const HOVER_BEFORE_END_MS = 3000; // 開場階段比延遲還短時，至少在階段結束前這麼久預選

// 開場自動預選(亮出想玩的英雄)，預選被 ban/選走時可遞補下一順位，並可在輪到自己選角、時間快到時自動鎖定
const AutoPickIntentService = (props) => {
  const attempts = useRef({});
  const isPicking = useRef(false);
  const hoveredGameId = useRef(null); // 自動預選成功的那一場
  const hoveredChampionId = useRef(0); // 程式最後一次自動預選的英雄
  const lockTimer = useRef(null);
  const [readyGameId, setReadyGameId] = useState(null); // 已等過進場延遲、可以預選的那一場
  const sessionReceivedAt = useRef(Date.now());

  const clearLockTimer = () => {
    if (lockTimer.current) {
      clearTimeout(lockTimer.current);
      lockTimer.current = null;
    }
  };

  useEffect(() => {
    if (props.gamePhase !== 'ChampSelect') {
      attempts.current = {};
      hoveredGameId.current = null;
      hoveredChampionId.current = 0;
      clearLockTimer();
    }
  }, [props.gamePhase]);

  useEffect(() => clearLockTimer, []);

  // 每場剛進選角時先等一下再預選
  const gameId = props.gamePhase === 'ChampSelect' ? props.champSelectSession?.gameId : undefined;
  useEffect(() => {
    if (gameId === undefined) return;
    const timeLeft = store.getState().GameReducer.champSelectSession?.timer?.adjustedTimeLeftInPhase;
    const delay = typeof timeLeft === 'number'
      ? Math.min(HOVER_DELAY_MS, Math.max(timeLeft - HOVER_BEFORE_END_MS, 0))
      : HOVER_DELAY_MS;
    const timer = setTimeout(() => setReadyGameId(gameId), delay);
    return () => clearTimeout(timer);
  }, [gameId]);

  // 開場預選，每場只做一次，ban 階段開始後就不再預選
  useEffect(() => {
    if (!props.isAutoPickIntent || props.gamePhase !== 'ChampSelect') return;
    if (isPicking.current) return;
    const session = props.champSelectSession;
    if (hoveredGameId.current === session?.gameId) return;
    if (readyGameId !== session?.gameId) return;
    if (!isOpening(session)) return;
    const action = findMyAction(session, 'pick');
    if (!action) return;
    // 玩家已經自己預選了就不覆蓋
    if (action.championId !== 0 || (getLocalPlayer(session)?.championPickIntent ?? 0) !== 0) return;

    const attemptKey = `${session.gameId}`;
    if ((attempts.current[attemptKey] ?? 0) >= MAX_ATTEMPTS) return;
    attempts.current[attemptKey] = (attempts.current[attemptKey] ?? 0) + 1;

    const pickIntent = async () => {
      isPicking.current = true;
      try {
        const lane = getMyLane(session);
        const candidates = await getPickCandidates(session, props, lane);
        log(`AutoPickIntentService action ${action.id}, phase ${session.timer?.phase}, attempt ${attempts.current[attemptKey]}, lane ${lane}, mode ${props.autoPickMode}, candidates ${JSON.stringify(candidates)}`);

        for (const championId of candidates) {
          try {
            await ApiUtils.patchChampSelectAction(action.id, {championId});
            log(`AutoPickIntentService hovered ${championId} ${ApiUtils.getChampionNameById(championId)}`);
            hoveredGameId.current = session.gameId;
            hoveredChampionId.current = championId;
            return;
          } catch (error) {
            log(`AutoPickIntentService hover ${championId} failed: ${error?.response?.status} ${JSON.stringify(error?.response?.data ?? error?.message)}`);
          }
        }
      } finally {
        isPicking.current = false;
      }
    };
    pickIntent();
  }, [props.champSelectSession, props.isAutoPickIntent, props.gamePhase, readyGameId]);

  // 遞補預選: 自動預選的英雄被 ban 或被選走時，改預選清單中下一隻可用的
  useEffect(() => {
    if (!props.isAutoPickIntent || !props.isAutoPickRehover || props.gamePhase !== 'ChampSelect') return;
    if (isPicking.current) return;
    const session = props.champSelectSession;
    if (hoveredGameId.current !== session?.gameId) return;
    const lostChampionId = hoveredChampionId.current;
    if (!lostChampionId) return;
    if (!getBannedChampionIds(session).has(lostChampionId) && !getPickedChampionIds(session).has(lostChampionId)) return;
    const action = findMyAction(session, 'pick');
    if (!action) return;
    // 玩家已經自己改選別隻就不覆蓋
    const currentChampionId = action.championId || (getLocalPlayer(session)?.championPickIntent ?? 0);
    if (currentChampionId !== 0 && currentChampionId !== lostChampionId) return;

    const attemptKey = `${session.gameId}:rehover:${lostChampionId}`;
    if ((attempts.current[attemptKey] ?? 0) >= MAX_ATTEMPTS) return;
    attempts.current[attemptKey] = (attempts.current[attemptKey] ?? 0) + 1;

    const rehover = async () => {
      isPicking.current = true;
      try {
        const lane = getMyLane(session);
        const candidates = await getPickCandidates(session, props, lane);
        log(`AutoPickIntentService rehover, ${lostChampionId} ${ApiUtils.getChampionNameById(lostChampionId)} is gone, action ${action.id}, phase ${session.timer?.phase}, attempt ${attempts.current[attemptKey]}, lane ${lane}, candidates ${JSON.stringify(candidates)}`);
        if (candidates.length === 0) {
          // 清單裡沒有其他可用的英雄了，交給玩家自己選
          attempts.current[attemptKey] = MAX_ATTEMPTS;
          return;
        }
        for (const championId of candidates) {
          try {
            await ApiUtils.patchChampSelectAction(action.id, {championId});
            log(`AutoPickIntentService rehovered ${championId} ${ApiUtils.getChampionNameById(championId)}`);
            hoveredChampionId.current = championId;
            return;
          } catch (error) {
            log(`AutoPickIntentService rehover ${championId} failed: ${error?.response?.status} ${JSON.stringify(error?.response?.data ?? error?.message)}`);
          }
        }
      } finally {
        isPicking.current = false;
      }
    };
    rehover();
  }, [props.champSelectSession, props.isAutoPickIntent, props.isAutoPickRehover, props.gamePhase]);

  // session.timer 的剩餘時間是以收到 session 的當下為準
  useEffect(() => {
    sessionReceivedAt.current = Date.now();
  }, [props.champSelectSession]);

  // 自動鎖角: 自動預選成功的那一場，輪到自己選角且時間剩 1 秒時鎖定目前亮著的英雄
  useEffect(() => {
    clearLockTimer();
    if (!props.isAutoPickIntent || !props.isAutoPickLock || props.gamePhase !== 'ChampSelect') return;
    const session = props.champSelectSession;
    if (hoveredGameId.current !== session?.gameId) return;
    const action = findMyAction(session, 'pick');
    if (!action || !action.isInProgress) return;
    const timeLeft = session.timer?.adjustedTimeLeftInPhase;
    if (typeof timeLeft !== 'number') return;

    lockTimer.current = setTimeout(() => {
      lockTimer.current = null;
      lockChampion(session.gameId);
    }, Math.max(timeLeft - (Date.now() - sessionReceivedAt.current) - LOCK_BEFORE_END_MS, 0));
  }, [props.champSelectSession, props.isAutoPickIntent, props.isAutoPickLock, props.gamePhase]);

  return null;
};

// 計時器觸發時 props 已經過期，重新從 store 取最新狀態
async function lockChampion(gameId) {
  const state = store.getState();
  const config = state.ConfigReducer;
  const session = state.GameReducer.champSelectSession;
  if (!config.isAutoPickIntent || !config.isAutoPickLock) return;
  if (state.GameReducer.gamePhase !== 'ChampSelect' || session?.gameId !== gameId) return;
  const action = findMyAction(session, 'pick');
  if (!action || !action.isInProgress) return;

  // 優先鎖定目前亮著的英雄(玩家可能已改選)，預選的英雄被 ban 掉時改鎖清單中下一隻可用的
  let candidates = [action.championId];
  if (action.championId === 0) {
    candidates = await getPickCandidates(session, config, getMyLane(session));
  }
  log(`AutoPickIntentService auto lock, action ${action.id}, hovered ${action.championId}, candidates ${JSON.stringify(candidates)}`);
  for (const championId of candidates) {
    try {
      await ApiUtils.patchChampSelectAction(action.id, {championId, completed: true});
      log(`AutoPickIntentService locked ${championId} ${ApiUtils.getChampionNameById(championId)}`);
      return;
    } catch (error) {
      log(`AutoPickIntentService lock ${championId} failed: ${error?.response?.status} ${JSON.stringify(error?.response?.data ?? error?.message)}`);
    }
  }
}

// 開場: 預選階段，或沒有 ban 階段的模式剛進選角時
function isOpening(session) {
  if (session?.timer?.phase === 'PLANNING') return true;
  const hasBanStage = (session?.actions ?? []).flat().some(action => action.type === 'ban');
  return !hasBanStage && session?.timer?.phase !== 'FINALIZATION';
}

// 依設定的清單，排除已被 ban、雙方已選、隊友預選的英雄，config 需含 autoPick* 設定
async function getPickCandidates(session, config, lane) {
  const championIds = resolveChampionIds(
    config.autoPickMode, config.autoPickChampionIds, config.autoPickLaneChampionIds, lane);
  const excluded = getBannedChampionIds(session);
  getTeammates(session).forEach(player => {
    excluded.add(player.championId);
    excluded.add(player.championPickIntent);
  });
  (session.theirTeam ?? []).forEach(player => excluded.add(player.championId));

  let candidates = championIds.filter(championId => !excluded.has(championId));
  try {
    const response = await ApiUtils.getPickableChampionIds();
    const pickableIds = Array.isArray(response.data) ? response.data.map(Number) : [];
    const pickableCandidates = candidates.filter(championId => pickableIds.includes(championId));
    // 篩完全空時改為直接嘗試，不可選的英雄 PATCH 會失敗並換下一個
    if (pickableCandidates.length > 0) {
      candidates = pickableCandidates;
    }
  } catch (error) {
    log(`AutoPickIntentService getPickableChampionIds failed: ${error?.message}`);
  }
  return config.isAutoPickRandom ? shuffle(candidates) : candidates;
}

function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const mapStateToProps = (state) => {
  return {
    gamePhase: state.GameReducer.gamePhase,
    champSelectSession: state.GameReducer.champSelectSession,
    isAutoPickIntent: state.ConfigReducer.isAutoPickIntent,
    isAutoPickLock: state.ConfigReducer.isAutoPickLock,
    autoPickChampionIds: state.ConfigReducer.autoPickChampionIds,
    autoPickMode: state.ConfigReducer.autoPickMode,
    autoPickLaneChampionIds: state.ConfigReducer.autoPickLaneChampionIds,
    isAutoPickRandom: state.ConfigReducer.isAutoPickRandom,
    isAutoPickRehover: state.ConfigReducer.isAutoPickRehover,
  }
}

export default connect(mapStateToProps)(withErrorBoundary(AutoPickIntentService));
