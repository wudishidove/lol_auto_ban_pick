import {useEffect, useRef, useState} from 'react';
import {connect} from "react-redux";
import ApiUtils from "../api/api-utils";
import withErrorBoundary from "../components/error/withErrorBoundary";
import {
  log,
  getMyLane,
  resolveChampionIds,
  findMyAction,
  getBannedChampionIds,
  getTeammates
} from "./champSelectUtils";

const MAX_ATTEMPTS = 10; // 同一個 ban 動作最多嘗試次數
const RETRY_INTERVAL_MS = 1000; // 失敗後隔多久重試，積分場 session 事件很密集，不能靠事件觸發重試

const AutoBanService = (props) => {
  const attempts = useRef({});
  const nextAttemptAt = useRef(0);
  const isBanning = useRef(false);
  const retryTimer = useRef(null);
  const loggedKeys = useRef(new Set());
  const [retryTick, setRetryTick] = useState(0);

  const logOnce = (key, message) => {
    if (loggedKeys.current.has(key)) return;
    loggedKeys.current.add(key);
    log(message);
  };

  useEffect(() => {
    if (props.gamePhase !== 'ChampSelect') {
      attempts.current = {};
      nextAttemptAt.current = 0;
      loggedKeys.current = new Set();
      clearTimeout(retryTimer.current);
    }
  }, [props.gamePhase]);

  useEffect(() => () => clearTimeout(retryTimer.current), []);

  useEffect(() => {
    if (!props.isAutoBan || props.gamePhase !== 'ChampSelect') return;
    if (isBanning.current) return;
    const session = props.champSelectSession;
    const action = findMyAction(session, 'ban');
    if (!action || !action.isInProgress) return;
    // 積分場在預選階段(PLANNING) ban 動作就已經是 isInProgress，此時送出的選取用戶端不會顯示，要等 ban 階段
    if (session.timer?.phase !== 'BAN_PICK') return;

    const actionKey = `${session.gameId}:${action.id}`;
    const lane = getMyLane(session);
    // 路線清單優先，用完後接續全局清單；重複英雄只嘗試一次。
    const championIds = [...new Set([
      ...resolveChampionIds(props.autoBanMode, props.autoBanChampionIds, props.autoBanLaneChampionIds, lane),
      ...(props.autoBanChampionIds ?? []).map(Number),
    ])];
    let attemptKey = actionKey;
    // 只選取不鎖定時，已經有選取(程式或玩家自己選的)就不覆蓋
    // 例外: 亮的是清單內的英雄，之後隊友預選了它(或已被 ban)，改亮下一順位
    if (props.isAutoBanHoverOnly && action.championId !== 0) {
      const hovered = action.championId;
      if (!championIds.includes(hovered) ||
        !getExcludedChampionIds(session, props.isAutoBanIgnoreTeammateIntent).has(hovered)) {
        logOnce(`${actionKey}:hovered:${hovered}`, `AutoBanService action ${action.id} already hovering ${hovered}, skip`);
        return;
      }
      attemptKey = `${actionKey}:rehover:${hovered}`;
    }
    if ((attempts.current[attemptKey] ?? 0) >= MAX_ATTEMPTS) return;
    if (Date.now() < nextAttemptAt.current) return;
    attempts.current[attemptKey] = (attempts.current[attemptKey] ?? 0) + 1;

    const banChampion = async () => {
      isBanning.current = true;
      try {
        const candidates = getBanCandidates(session, championIds, props.isAutoBanIgnoreTeammateIntent);
        const teammateIntents = getTeammates(session).map(player => player.championPickIntent || player.championId);
        log(`AutoBanService action ${action.id}, attempt ${attempts.current[attemptKey]}, hovering ${action.championId}, phase ${session.timer?.phase}, lane ${lane}, mode ${props.autoBanMode}, hoverOnly ${props.isAutoBanHoverOnly}, ignoreTeammate ${props.isAutoBanIgnoreTeammateIntent}, list ${JSON.stringify(championIds)}, teammates ${JSON.stringify(teammateIntents)}, candidates ${JSON.stringify(candidates)}`);

        if (candidates.length === 0) {
          // 清單內沒有可 ban 的英雄，交給玩家手動處理
          attempts.current[attemptKey] = MAX_ATTEMPTS;
          return;
        }
        const payload = props.isAutoBanHoverOnly ? {} : {completed: true};
        for (const championId of candidates) {
          try {
            await ApiUtils.patchChampSelectAction(action.id, {championId, ...payload});
            log(`AutoBanService ${props.isAutoBanHoverOnly ? 'hovered' : 'banned'} ${championId} ${ApiUtils.getChampionNameById(championId)}`);
            attempts.current[actionKey] = MAX_ATTEMPTS;
            // 改亮成功後清掉計數，隊友之後又預選到新亮的英雄時還能再換
            if (attemptKey !== actionKey) delete attempts.current[attemptKey];
            return;
          } catch (error) {
            // 不可 ban 的英雄會失敗，換下一個
            log(`AutoBanService ban ${championId} failed: ${error?.response?.status} ${JSON.stringify(error?.response?.data ?? error?.message)}`);
          }
        }
        // 全部失敗(例如 ban 階段剛開始，用戶端還沒準備好)，稍後重試
        nextAttemptAt.current = Date.now() + RETRY_INTERVAL_MS;
        clearTimeout(retryTimer.current);
        retryTimer.current = setTimeout(() => setRetryTick(tick => tick + 1), RETRY_INTERVAL_MS + 50);
      } finally {
        isBanning.current = false;
      }
    };
    banChampion();
  }, [props.champSelectSession, props.isAutoBan, props.gamePhase, retryTick]);

  return null;
};

// 依優先順序，排除已被 ban、隊友已選的英雄，隊友預選的英雄依設定決定是否排除
// 註: /lol-champ-select/v1/bannable-champion-ids 可能只回傳 [-1]，不能拿來篩選
function getBanCandidates(session, championIds, isIgnoreTeammateIntent) {
  const excluded = getExcludedChampionIds(session, isIgnoreTeammateIntent);
  return championIds.filter(championId => !excluded.has(championId));
}

function getExcludedChampionIds(session, isIgnoreTeammateIntent) {
  const excluded = getBannedChampionIds(session);
  getTeammates(session).forEach(player => {
    // ban 階段時隊友的 championId 是他正在亮的英雄，跟 championPickIntent 一樣視為預選
    if (!isIgnoreTeammateIntent) {
      excluded.add(player.championId);
      excluded.add(player.championPickIntent);
    }
  });
  return excluded;
}

const mapStateToProps = (state) => {
  return {
    gamePhase: state.GameReducer.gamePhase,
    champSelectSession: state.GameReducer.champSelectSession,
    isAutoBan: state.ConfigReducer.isAutoBan,
    autoBanChampionIds: state.ConfigReducer.autoBanChampionIds,
    autoBanMode: state.ConfigReducer.autoBanMode,
    autoBanLaneChampionIds: state.ConfigReducer.autoBanLaneChampionIds,
    isAutoBanIgnoreTeammateIntent: state.ConfigReducer.isAutoBanIgnoreTeammateIntent,
    isAutoBanHoverOnly: state.ConfigReducer.isAutoBanHoverOnly,
  }
}

export default connect(mapStateToProps)(withErrorBoundary(AutoBanService));
