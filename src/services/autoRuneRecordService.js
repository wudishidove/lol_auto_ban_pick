import {useEffect, useRef} from 'react';
import {connect} from "react-redux";
import ApiUtils from "../api/api-utils";
import RuneDatabase from "../components/common/RuneDatabase";
import withErrorBoundary from "../components/error/withErrorBoundary";
import {getLocalPlayer, getMyLane, log} from "./champSelectUtils";
import {isCompletePerks, profileSource, summarizeGame} from "./runeUtils";

const PENDING_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000; // 對戰紀錄一直查不到就放棄
const REMAKE_MAX_DURATION_SECONDS = 300; // 重開的場次不記錄

/**
 * 自動記錄每場的符文
 * 1. 進遊戲時記下目前符文頁(完整 9 個，對戰紀錄裡沒有屬性碎片)，存成待補紀錄
 * 2. 賽後從對戰紀錄補上實際路線與對位英雄，存成設定檔；使用者鎖定(pinned)的設定檔不覆蓋
 */
const AutoRuneRecordService = (props) => {
  const isResolving = useRef(false);

  useEffect(() => {
    if (!props.isAutoRecordRunes || typeof props.gamePhase !== 'string') return;
    if (props.gamePhase === 'InProgress') {
      capture().catch(error => log(`AutoRuneRecordService capture failed: ${error?.message}`));
    } else if (props.gamePhase !== 'GameStart') {
      resolvePendingRecords().catch(error => log(`AutoRuneRecordService resolve failed: ${error?.message}`));
    }
  }, [props.gamePhase, props.isAutoRecordRunes]);

  const capture = async () => {
    const session = props.champSelectSession;
    const lane = getMyLane(session);
    const championId = getLocalPlayer(session)?.championId;
    if (!lane || !championId) return; // 沒有分路的模式不記錄
    const gameflowSession = (await ApiUtils.getGameflowSession()).data;
    const gameId = gameflowSession?.gameData?.gameId;
    // redux 裡的選角資料可能是上一場留下來的
    if (!gameId || gameId !== session.gameId) return;
    const page = (await ApiUtils.getCurrentRunePage()).data;
    if (!isCompletePerks(page?.selectedPerkIds)) return;
    await RuneDatabase.savePendingRecord({
      gameId,
      lane,
      championId,
      primaryStyleId: page.primaryStyleId,
      subStyleId: page.subStyleId,
      selectedPerkIds: page.selectedPerkIds,
      createdAt: Date.now(),
    });
    log(`AutoRuneRecordService captured game ${gameId}, lane ${lane}, champion ${championId}, perks ${JSON.stringify(page.selectedPerkIds)}`);
  };

  const resolvePendingRecords = async () => {
    if (isResolving.current) return;
    isResolving.current = true;
    try {
      const records = await RuneDatabase.getPendingRecords();
      if (records.length === 0) return;
      const puuid = await ApiUtils.getCurrentSummonerPuuid();
      if (!puuid) return;
      for (const record of records) {
        if (Date.now() - record.createdAt > PENDING_MAX_AGE_MS) {
          await RuneDatabase.deletePendingRecord(record.gameId);
          continue;
        }
        const game = await ApiUtils.getHistoryGame(record.gameId);
        if (!game?.gameId) continue; // 對戰紀錄還沒產生，下次階段變更時再試
        const summary = summarizeGame(game, puuid);
        if (summary && game.gameDuration >= REMAKE_MAX_DURATION_SECONDS) {
          const existing = await RuneDatabase.getProfile(summary.lane, summary.championId, summary.enemyChampionId);
          if (existing?.pinned) {
            log(`AutoRuneRecordService ${existing._id} is pinned, skip`);
          } else {
            const profile = await RuneDatabase.saveProfile({
              lane: summary.lane,
              championId: summary.championId,
              enemyChampionId: summary.enemyChampionId,
              primaryStyleId: record.primaryStyleId,
              subStyleId: record.subStyleId,
              selectedPerkIds: record.selectedPerkIds,
              source: profileSource.AUTO,
              pinned: false,
              gameId: record.gameId,
            });
            log(`AutoRuneRecordService saved ${profile._id} from game ${record.gameId}`);
          }
        }
        await RuneDatabase.deletePendingRecord(record.gameId);
      }
    } finally {
      isResolving.current = false;
    }
  };

  return null;
};

const mapStateToProps = (state) => {
  return {
    gamePhase: state.GameReducer.gamePhase,
    champSelectSession: state.GameReducer.champSelectSession,
    isAutoRecordRunes: state.ConfigReducer.isAutoRecordRunes,
  }
}

export default connect(mapStateToProps)(withErrorBoundary(AutoRuneRecordService));
