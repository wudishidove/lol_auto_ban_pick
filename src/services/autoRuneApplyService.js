import {useEffect, useRef, useState} from 'react';
import {connect} from "react-redux";
import ApiUtils from "../api/api-utils";
import RuneDatabase from "../components/common/RuneDatabase";
import withErrorBoundary from "../components/error/withErrorBoundary";
import {getLocalPlayer, getMyLane, log} from "./champSelectUtils";
import {findProfile, inferLaneOpponent, isSameRunes, isSameSpells} from "./runeUtils";
import {applyProfileToClient, isManagedPage, restoreManagedPage} from "./runeApplyUtils";

const {ipcRenderer} = window.require('electron');

// 英雄的推薦位置幾乎不會變，整個程式執行期間快取一份
let recommendedPositionsCache = null;
const defaultPositionCache = {};

async function getRecommendedPositions() {
  if (!recommendedPositionsCache) {
    recommendedPositionsCache = (await ApiUtils.getRecommendedChampionPositions()).data;
  }
  return recommendedPositionsCache;
}

// 選角時盡量少打用戶端: 只走一個位置的英雄不用查，能走多個位置的才查主要位置，而且一次只送一個請求
async function getDefaultPositions(championIds, recommendedPositions) {
  for (const championId of championIds) {
    if (championId in defaultPositionCache) continue;
    const positions = recommendedPositions?.[championId]?.recommendedPositions ?? [];
    // 查不到也沒關係，只是少了分出 上/中 通用英雄的依據
    defaultPositionCache[championId] = positions.length > 1
      ? await ApiUtils.getChampionDefaultPosition(championId).catch(() => null)
      : positions[0] ?? null;
  }
  return defaultPositionCache;
}

/**
 * 選角時推測對位英雄並套用符文設定檔
 * 推測結果一律寫進 redux 供「符文」分頁顯示，只有開啟自動套用時才會真的改用戶端符文
 * 敵方英雄是陸續亮出來的，推測的對位改變導致符合的設定檔不同時會重新套用
 * 鎖角後使用者自己改過的部分(符文頁、召喚師技能分開算)，之後重新套用時就不再覆蓋
 */
const AutoRuneApplyService = (props) => {
  const isWorking = useRef(false);
  const isEventSkipped = useRef(false); // 處理期間有選角事件被跳過
  // 本場鎖角後符文頁與召喚師技能應有的內容(鎖角當下的，或本程式套用上去的)，跟它不同就是使用者自己改的
  // 例: {gameId, profileId, runes, spellIds, isRunesKept, isSpellsKept}，isXxxKept 代表使用者改過、不再覆蓋
  const applied = useRef(null);
  const lastSignature = useRef(''); // 上次處理過的選角狀態，積分場的選角事件很密集，沒變就不重算
  const [retryTick, setRetryTick] = useState(0);
  const latestProps = useRef(props);
  latestProps.current = props;
  const managedPage = useRef(null); // 本場本程式符文頁最後的內容(含使用者在用戶端的微調)，例: {gameId, page}
  const restoredGameId = useRef(null);

  // 用戶端在選角最後幾秒會把推薦符文原地寫進本程式的暫時頁(頁 id 不變、頁名變成「英雄 - 基石」)
  // 手動或自動套用的都會被蓋掉，偵測到就改回被蓋掉前的內容；每場只改回一次，避免跟用戶端來回搶
  // 使用者自己換到其他頁時頁 id 會不同，不處理
  useEffect(() => {
    const handleCurrentPage = (event, page) => {
      const {gamePhase, champSelectSession} = latestProps.current;
      const gameId = champSelectSession?.gameId;
      if (gamePhase !== 'ChampSelect' || !gameId || !page?.id) return;
      if (isManagedPage(page)) {
        managedPage.current = {gameId, page};
        return;
      }
      const last = managedPage.current;
      if (last?.gameId !== gameId || last.page.id !== page.id || restoredGameId.current === gameId) return;
      restoredGameId.current = gameId;
      log(`AutoRuneApplyService page ${page.id} overwritten by "${page.name}" ${JSON.stringify(page.selectedPerkIds)}, restore it`);
      restoreManagedPage(last.page)
        .catch(error => log(`restoreManagedPage failed: ${error?.response?.status} ${JSON.stringify(error?.response?.data ?? error?.message)}`));
    };
    ipcRenderer.on('rune-current-page', handleCurrentPage);
    return () => ipcRenderer.removeListener('rune-current-page', handleCurrentPage);
  }, []);

  useEffect(() => {
    if (props.gamePhase !== 'ChampSelect') {
      applied.current = null;
      lastSignature.current = '';
      if (props.runeApplyState.gameId) props.changeRuneApplyState({});
    }
  }, [props.gamePhase]);

  useEffect(() => {
    if (props.gamePhase !== 'ChampSelect') return;
    const session = props.champSelectSession;
    const lane = getMyLane(session);
    const me = getLocalPlayer(session);
    const championId = me?.championId;
    if (!lane || !championId) return; // 沒有分路的模式沒有對位可言
    if (isWorking.current) {
      isEventSkipped.current = true;
      return;
    }

    const isLocked = (session.actions ?? []).flat().some(action =>
      action.type === 'pick' && action.actorCellId === session.localPlayerCellId && action.completed);
    const enemyChampionIds = (session.theirTeam ?? []).map(player => player.championId).filter(id => id > 0);

    const signature = JSON.stringify([session.gameId, lane, championId, isLocked, enemyChampionIds,
      props.isAutoApplyRunes, props.runeApplyState.isManual, props.runeApplyState.error]);
    if (signature === lastSignature.current) return;
    lastSignature.current = signature;

    const evaluate = async () => {
      isWorking.current = true;
      let isStateChanged = false;
      let state = null;
      try {
        const recommendedPositions = await getRecommendedPositions();
        const defaultPositions = await getDefaultPositions(enemyChampionIds, recommendedPositions);
        const enemyChampionId = inferLaneOpponent(enemyChampionIds, lane, recommendedPositions, defaultPositions);
        const previous = props.runeApplyState.gameId === session.gameId ? props.runeApplyState : {};
        state = {...previous, gameId: session.gameId, lane, championId, enemyChampionId};
        if (previous.lane !== lane || previous.championId !== championId || previous.enemyChampionId !== enemyChampionId) {
          isStateChanged = true;
          props.changeRuneApplyState(state);
        }

        // 使用者在「符文」分頁手動挑過設定檔，這場就不再自動套用
        // 套用失敗過(例如符文已改版失效)也不再重試，避免每個選角事件都去寫符文頁
        if (!props.isAutoApplyRunes || !isLocked || previous.isManual || previous.error) return;
        const profile = findProfile(await RuneDatabase.getProfiles(), lane, championId, enemyChampionId);
        let tracked = applied.current?.gameId === session.gameId ? applied.current : null;
        if (tracked && (!profile || tracked.profileId === profile._id)) return;
        const spellIds = [me.spell1Id, me.spell2Id];
        const currentPage = (await ApiUtils.getCurrentRunePage()).data;
        if (!tracked) {
          // 鎖角後第一次處理，記下當下的內容當基準
          tracked = {gameId: session.gameId, profileId: null, runes: currentPage, spellIds};
          applied.current = tracked;
        }
        if (!profile) return;
        // 鎖角後使用者自己在用戶端改過的部分就不再覆蓋
        const isRunesKept = !!tracked.isRunesKept || !isSameRunes(currentPage, tracked.runes);
        const isSpellsKept = !!tracked.isSpellsKept || !isSameSpells(spellIds, tracked.spellIds);
        if (isRunesKept && isSpellsKept) {
          log('AutoRuneApplyService runes and spells changed by user, stop auto apply for this game');
          isStateChanged = true;
          props.changeRuneApplyState({...state, isManual: true});
          return;
        }
        log(`AutoRuneApplyService lane ${lane}, champion ${championId}, enemies ${JSON.stringify(enemyChampionIds)}, opponent ${enemyChampionId}, apply ${profile._id}${isRunesKept ? ' (keep user runes)' : ''}${isSpellsKept ? ' (keep user spells)' : ''}`);
        const {isSpellsApplied} = await applyProfileToClient(profile, {runes: !isRunesKept, spells: !isSpellsKept});
        isStateChanged = true;
        applied.current = {
          ...tracked,
          profileId: profile._id,
          runes: isRunesKept ? tracked.runes : profile,
          spellIds: isSpellsApplied ? profile.spellIds : tracked.spellIds,
          isRunesKept,
          isSpellsKept,
        };
        props.changeRuneApplyState({...state, profileId: profile._id, error: null});
      } catch (error) {
        log(`AutoRuneApplyService failed: ${error?.response?.status} ${JSON.stringify(error?.response?.data ?? error?.message)}`);
        if (state) {
          isStateChanged = true;
          props.changeRuneApplyState({...state, error: true});
        } else {
          // 還沒推測出對位就失敗(例如推薦位置表抓不到)，下一個選角事件再試，不然這場就一直沒有結果
          lastSignature.current = '';
        }
      } finally {
        isWorking.current = false;
        // 處理期間進來的選角事件會被跳過，要再檢查一次，避免漏掉最後亮出的敵方英雄
        if (isStateChanged || isEventSkipped.current) {
          isEventSkipped.current = false;
          setRetryTick(tick => tick + 1);
        }
      }
    };
    evaluate();
  }, [props.champSelectSession, props.gamePhase, props.isAutoApplyRunes, props.runeApplyState, retryTick]);

  return null;
};

const mapStateToProps = (state) => {
  return {
    gamePhase: state.GameReducer.gamePhase,
    champSelectSession: state.GameReducer.champSelectSession,
    runeApplyState: state.GameReducer.runeApplyState,
    isAutoApplyRunes: state.ConfigReducer.isAutoApplyRunes,
  }
}

const mapDispatchToProp = {
  changeRuneApplyState(data) {
    return {
      type: "change-runeApplyState",
      data
    }
  }
}

export default connect(mapStateToProps, mapDispatchToProp)(withErrorBoundary(AutoRuneApplyService));
