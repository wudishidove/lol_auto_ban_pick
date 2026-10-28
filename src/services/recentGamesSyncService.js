import {useEffect, useRef} from 'react';
import {connect} from "react-redux";
import ApiUtils from "../api/api-utils";
import RecentUtils from "../components/common/RecentUtils";
import DatabaseUtils from "../components/common/DatabaseUtils";
import withErrorBoundary from "../components/error/withErrorBoundary";
import store from "../redux/store";

// 選角與遊戲中不對用戶端拉對戰紀錄，避免影響連線；這時只讀已經存好的場次
export const BUSY_PHASES = ['ChampSelect', 'GameStart', 'InProgress', 'Reconnect', 'ReadyCheck'];

let runningSync = null;

function setRecentGames(data) {
  store.dispatch({type: "change-recentGames", data});
}

async function doSync(gameCount, fetchFromClient) {
  const previousNewestId = store.getState().GameReducer.recentGames.games[0]?._id ?? null;
  setRecentGames({isLoading: true});
  try {
    if (fetchFromClient) await RecentUtils.syncRecentGames(0, gameCount - 1);
    const ownerPuuid = await ApiUtils.getCurrentSummonerPuuid();
    const storedGames = ownerPuuid ? await DatabaseUtils.getAllGamesByOwnerPuuid(ownerPuuid) : [];
    const games = storedGames
      .filter(game => game.data)
      .sort((a, b) => (b.data.gameCreation ?? 0) - (a.data.gameCreation ?? 0))
      .slice(0, gameCount);
    setRecentGames({games, ownerPuuid, isLoading: false, hasError: false});
    return (games[0]?._id ?? null) !== previousNewestId;
  } catch (error) {
    console.error('syncRecentGames failed', error);
    setRecentGames({isLoading: false, hasError: true});
    return false;
  }
}

/**
 * 同步最近 gameCount 場對戰到資料庫，整理好放進 redux 給「對戰紀錄」與「對戰分析」共用
 * fetchFromClient 為 false 時只讀資料庫；同步中再呼叫會共用同一次同步
 * @returns {Promise<boolean>} 這次有沒有載到新的場次
 */
export function syncRecentGames(gameCount, fetchFromClient = true) {
  if (!runningSync) {
    runningSync = doSync(gameCount, fetchFromClient).finally(() => {
      runningSync = null;
    });
  }
  return runningSync;
}

const RecentGamesSyncService = (props) => {
  const gamePhase = useRef(props.gamePhase);
  gamePhase.current = props.gamePhase;
  const pendingReloads = useRef(0); // 打完一場後，還要在接下來幾次階段變更時重新載入
  const gameCount = props.recentTeammateCheckGameCount;

  // 連上用戶端、改場數時同步，場數用滑桿調整會連續觸發，等停下來再同步
  useEffect(() => {
    if (!props.authPort) return;
    const timer = setTimeout(() => syncRecentGames(gameCount, !BUSY_PHASES.includes(gamePhase.current)), 500);
    return () => clearTimeout(timer);
  }, [props.authPort, gameCount]);

  useEffect(() => {
    // 列隊等待中先同步一次，進選角後「對戰分析」就有最新的場次可以比對
    if (props.gamePhase === 'Matchmaking') {
      syncRecentGames(gameCount);
    } else if (props.gamePhase === 'InProgress') {
      pendingReloads.current = 3;
    } else if (pendingReloads.current > 0 && ['None', 'Lobby', 'EndOfGame'].includes(props.gamePhase)) {
      // 剛結算時對戰紀錄可能還沒產生，沒載到新場次的話下次階段變更再試，最多 3 次
      pendingReloads.current -= 1;
      syncRecentGames(gameCount).then(hasNewGame => {
        if (hasNewGame) pendingReloads.current = 0;
      });
    }
  }, [props.gamePhase]);

  return null;
};

const mapStateToProps = (state) => {
  return {
    authPort: state.AuthReducer.auth?.port,
    gamePhase: state.GameReducer.gamePhase,
    recentTeammateCheckGameCount: state.ConfigReducer.recentTeammateCheckGameCount,
  }
}

export default connect(mapStateToProps)(withErrorBoundary(RecentGamesSyncService));
