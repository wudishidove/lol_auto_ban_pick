import React, {useEffect, useRef, useState} from 'react';
import {connect} from "react-redux";
import {Alert, Button, Card, Empty, Space, Spin, Tag, Typography} from "antd";
import {ReloadOutlined} from '@ant-design/icons';
import RecentUtils from '../components/common/RecentUtils';
import withErrorBoundary from "./error/withErrorBoundary";
import {useTranslation} from 'react-i18next';
import DatabaseUtils from "./common/DatabaseUtils";
import ApiUtils from "../api/api-utils";
import ChampionImage from "./common/ChampionImage";

const {Text} = Typography;

// 選角與遊戲中不對用戶端送請求，避免影響連線；這時只用已經存好的對戰紀錄重新排序
const BUSY_PHASES = ['ChampSelect', 'GameStart', 'InProgress', 'Reconnect', 'ReadyCheck'];
// 這些階段才有「這場」的玩家可以比對
const IN_GAME_PHASES = ['ChampSelect', 'GameStart', 'InProgress', 'Reconnect'];

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const pad = (value) => String(value).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getPlayerName(player) {
  if (player?.gameName) return player.tagLine ? `${player.gameName}#${player.tagLine}` : player.gameName;
  return player?.summonerName ?? '';
}

// 把一場的 participants 跟 participantIdentities 合併
function getGamePlayers(data) {
  const identities = new Map((data?.participantIdentities ?? []).map(identity => [identity.participantId, identity.player]));
  return (data?.participants ?? []).map(participant => ({
    ...participant,
    player: identities.get(participant.participantId) ?? {},
  }));
}

// 這場(選角或對戰中)的其他玩家，不含自己和一起排的朋友
function getCurrentGamePuuids(gameflowSession, champSelectSession, lobbyMembers, ownerPuuid) {
  const players = [
    ...(gameflowSession?.gameData?.teamOne ?? []),
    ...(gameflowSession?.gameData?.teamTwo ?? []),
    ...(champSelectSession?.myTeam ?? []),
    ...(champSelectSession?.theirTeam ?? []),
  ];
  const excluded = new Set([ownerPuuid, ...Object.keys(lobbyMembers ?? {})]);
  return new Set(players.map(player => player?.puuid).filter(puuid => puuid && !excluded.has(puuid)));
}

function RecentPlayers(props) {
  const {t} = useTranslation();
  const [games, setGames] = useState([]);
  const [ownerPuuid, setOwnerPuuid] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const newestGameId = useRef(null);
  const pendingReloads = useRef(0); // 打完一場後，還要在接下來幾次階段變更時重新載入

  const isBusyPhase = BUSY_PHASES.includes(props.gamePhase);
  const isInGame = IN_GAME_PHASES.includes(props.gamePhase);
  const gameCount = props.recentTeammateCheckGameCount;

  // 回傳這次有沒有載到新的場次
  const load = async () => {
    setIsLoading(true);
    try {
      await RecentUtils.syncRecentGames(0, gameCount - 1);
      const puuid = await ApiUtils.getCurrentSummonerPuuid();
      const storedGames = puuid ? await DatabaseUtils.getAllGamesByOwnerPuuid(puuid) : [];
      const sortedGames = storedGames
        .filter(game => game.data)
        .sort((a, b) => (b.data.gameCreation ?? 0) - (a.data.gameCreation ?? 0))
        .slice(0, gameCount);
      const hasNewGame = (sortedGames[0]?._id ?? null) !== newestGameId.current;
      newestGameId.current = sortedGames[0]?._id ?? null;
      setOwnerPuuid(puuid);
      setGames(sortedGames);
      setHasError(false);
      return hasNewGame;
    } catch (error) {
      console.error('RecentPlayers load failed', error);
      setHasError(true);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // 開啟、連上用戶端、改場數時載入，場數用滑桿調整會連續觸發，等停下來再載
  useEffect(() => {
    if (isBusyPhase) return;
    const timer = setTimeout(load, 500);
    return () => clearTimeout(timer);
  }, [props.authPort, gameCount]);

  // 打完一場後重新載入，剛結算時對戰紀錄可能還沒產生，沒載到新場次的話下次階段變更再試，最多 3 次
  useEffect(() => {
    if (props.gamePhase === 'InProgress') {
      pendingReloads.current = 3;
    } else if (pendingReloads.current > 0 && ['None', 'Lobby', 'EndOfGame'].includes(props.gamePhase)) {
      pendingReloads.current -= 1;
      load().then(hasNewGame => {
        if (hasNewGame) pendingReloads.current = 0;
      });
    }
  }, [props.gamePhase]);

  const currentPuuids = isInGame
    ? getCurrentGamePuuids(props.gameflowSession, props.champSelectSession, props.lobbyMembers, ownerPuuid)
    : new Set();

  // 遊戲中把有這場玩家的場次排前面，其餘照時間
  const gameRows = games.map(game => {
    const players = getGamePlayers(game.data);
    const metPlayers = players.filter(participant => currentPuuids.has(participant.player.puuid));
    return {game, players, metPlayers};
  });
  const sortedRows = [
    ...gameRows.filter(row => row.metPlayers.length > 0),
    ...gameRows.filter(row => row.metPlayers.length === 0),
  ];

  // 這場遇過的玩家，依遇到次數排序
  const metSummary = new Map();
  gameRows.forEach(({metPlayers}) => metPlayers.forEach(participant => {
    const puuid = participant.player.puuid;
    const entry = metSummary.get(puuid) ?? {player: participant.player, count: 0};
    entry.count += 1;
    metSummary.set(puuid, entry);
  }));
  const metList = [...metSummary.values()].sort((a, b) => b.count - a.count);

  const getHint = () => {
    if (isInGame) return t('recentPlayers.inGameHint');
    if (isBusyPhase) return t('recentPlayers.busyHint');
    return t('recentPlayers.idleHint', {count: gameCount});
  };

  return (
    <Space direction="vertical" size="middle" style={{display: 'flex'}}>
      <Space wrap>
        <Button icon={<ReloadOutlined/>} loading={isLoading} disabled={isBusyPhase} onClick={load}>
          {t('recentPlayers.refresh')}
        </Button>
        <Text type="secondary">{getHint()}</Text>
      </Space>
      {hasError && <Alert type="warning" showIcon message={t('recentPlayers.loadFailed')}/>}
      {isInGame && games.length > 0 && (
        metList.length > 0 ? (
          <Card size="small" title={t('recentPlayers.metPlayers')}>
            <Space wrap>
              {metList.map(({player, count}) => (
                <Tag key={player.puuid} color="gold">
                  {getPlayerName(player)} · {t('recentPlayers.metTimes', {count})}
                </Tag>
              ))}
            </Space>
          </Card>
        ) : <Text type="secondary">{t('recentPlayers.noneMet')}</Text>
      )}
      <Spin spinning={isLoading && games.length === 0}>
        {sortedRows.length === 0 && !isLoading ? <Empty description={t('recentPlayers.empty')}/> : (
          <Space direction="vertical" size="small" style={{display: 'flex'}}>
            {sortedRows.map(({game, players, metPlayers}) => (
              <GameCard key={game._id} game={game} players={players} metCount={metPlayers.length}
                        currentPuuids={currentPuuids} ownerPuuid={ownerPuuid}/>
            ))}
          </Space>
        )}
      </Spin>
    </Space>
  );
}

const GameCard = ({game, players, metCount, currentPuuids, ownerPuuid}) => {
  const {t} = useTranslation();
  const me = players.find(participant => participant.player.puuid === ownerPuuid);
  const teamIds = [...new Set(players.map(participant => participant.teamId))].sort();
  const title = (
    <Space size={8} wrap>
      <Text>{formatTime(game.data.gameCreation)}</Text>
      {game.data.gameMode && <Text type="secondary" style={{fontSize: 12}}>{game.data.gameMode}</Text>}
      {me && (
        <Text type={me.stats?.win ? 'success' : 'danger'} style={{fontSize: 12}}>
          {me.stats?.win ? t('recentPlayers.win') : t('recentPlayers.lose')}
        </Text>
      )}
      {metCount > 0 && <Tag color="gold">{t('recentPlayers.metInGame', {count: metCount})}</Tag>}
    </Space>
  );
  return (
    <Card size="small" title={title} style={metCount > 0 ? {borderColor: '#faad14'} : undefined}>
      <div style={{display: 'flex', flexWrap: 'wrap', gap: 16}}>
        {teamIds.map(teamId => (
          <div key={teamId} style={{flex: '1 1 320px', minWidth: 0}}>
            <Text strong>{teamId === 100 ? t('common.teamOne') : t('common.teamTwo')}</Text>
            {players.filter(participant => participant.teamId === teamId).map(participant => (
              <TeamMember key={participant.participantId} participant={participant}
                          isMet={currentPuuids.has(participant.player.puuid)}
                          isMe={participant.player.puuid === ownerPuuid}/>
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
};

const TeamMember = ({participant, isMet, isMe}) => {
  const {t} = useTranslation();
  const {player, championId, stats = {}} = participant;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '2px 4px', borderRadius: 4,
      background: isMet ? 'rgba(250, 173, 20, 0.15)' : undefined
    }}>
      <ChampionImage width={26} height={26} championId={championId}/>
      <Text strong={isMet || isMe} ellipsis style={{flex: 1, minWidth: 0}}>
        {getPlayerName(player)}
        {isMe && <Tag style={{marginLeft: 6}}>{t('recentPlayers.me')}</Tag>}
      </Text>
      <Text type="secondary" style={{whiteSpace: 'nowrap', fontSize: 12}}>
        {ApiUtils.getChampionNameById(championId) ?? ''} {stats.kills ?? ''}/{stats.deaths ?? ''}/{stats.assists ?? ''}
      </Text>
    </div>
  );
};

const mapStateToProps = (state) => {
  return {
    authPort: state.AuthReducer.auth?.port,
    gamePhase: state.GameReducer.gamePhase,
    gameflowSession: state.GameReducer.gameflowSession,
    champSelectSession: state.GameReducer.champSelectSession,
    lobbyMembers: state.GameReducer.lobbyMembers,
    recentTeammateCheckGameCount: state.ConfigReducer.recentTeammateCheckGameCount,
  }
}

export default connect(mapStateToProps)(withErrorBoundary(RecentPlayers))
