import React, {useState, useEffect} from 'react';
import {connect} from "react-redux";
import {Empty, Modal, Space, Table, Tag, Tooltip, Typography} from 'antd';
import withErrorBoundary from "./error/withErrorBoundary";
import ApiUtils from "../api/api-utils";
import {showTeammateRankedType} from "../redux/reducers/ConfigReducer";
import {useTranslation} from 'react-i18next';
import useSummonerName from '../hooks/useSummonerName';
import ChampionImage from "./common/ChampionImage";
import GameCard, {getGamePlayers, getPlayerName} from "./common/GameCard";

const {Text} = Typography;

const PREMADE_COLORS = ['magenta', 'blue', 'green', 'orange', 'purple'];
const PREMADE_KEYS = ['solo', 'duo', 'trio', 'quad', 'quint'];

// 合併原本的雙排、積分、列隊規則頁：同一張表看每位玩家的組隊、位置與積分
function MatchAnalysis(props) {
  const {t} = useTranslation();
  const [rankedStats, setRankedStats] = useState({}); // {puuid: rankedStats}

  const teamOne = props.gameflowSession?.gameData?.teamOne || [];
  const teamTwo = props.gameflowSession?.gameData?.teamTwo || [];

  useEffect(() => {
    let cancelled = false;
    const players = [...teamOne, ...teamTwo];
    // 電腦玩家沒有 summonerId，直接當成查不到
    setRankedStats(Object.fromEntries(players.filter(p => !p.summonerId).map(p => [p.puuid, null])));
    // 個別玩家查詢失敗不影響其他人
    players.filter(p => p.summonerId).forEach(player => {
      ApiUtils.getRankedStats(player.summonerId)
        .then(stats => {
          if (!cancelled) setRankedStats(prev => ({...prev, [player.puuid]: stats}));
        })
        .catch(() => {
          if (!cancelled) setRankedStats(prev => ({...prev, [player.puuid]: null}));
        });
    });
    return () => {
      cancelled = true;
    };
  }, [props.gameflowSession]);

  if (teamOne.length === 0 && teamTwo.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('matchAnalysis.noData')}/>;
  }

  const {games, ownerPuuid} = props.recentGames;
  const encounters = getEncounters(games, ownerPuuid, [...teamOne, ...teamTwo], props.lobbyMembers,
    props.gameflowSession?.gameData?.gameId);
  const tableProps = {rankedStats, encounters, ownerPuuid};

  return (
    <>
      {teamOne.length !== 0 && <TeamTable title={t('common.teamOne')} team={teamOne} {...tableProps}/>}
      {teamTwo.length !== 0 && <TeamTable title={t('common.teamTwo')} team={teamTwo} {...tableProps}/>}
    </>
  );
}

/**
 * 這場的玩家在最近幾場對戰中出現過的紀錄，不含自己和一起排的朋友
 * @returns {Map<string, Array<{game, participant, isTeammate, myWin}>>} puuid -> 遇到的場次，新的在前
 */
function getEncounters(games, ownerPuuid, players, lobbyMembers, currentGameId) {
  const excluded = new Set([ownerPuuid, ...Object.keys(lobbyMembers ?? {})]);
  const puuids = new Set(players.map(player => player.puuid).filter(puuid => puuid && !excluded.has(puuid)));
  const encounters = new Map();
  games.forEach(game => {
    if (String(game.data.gameId) === String(currentGameId)) return; // 剛打完還停在結算時，這場本身不算
    const gamePlayers = getGamePlayers(game.data);
    const me = gamePlayers.find(participant => participant.player.puuid === ownerPuuid);
    gamePlayers.filter(participant => puuids.has(participant.player.puuid)).forEach(participant => {
      const list = encounters.get(participant.player.puuid) ?? [];
      list.push({game, participant, isTeammate: me?.teamId === participant.teamId, myWin: me?.stats?.win});
      encounters.set(participant.player.puuid, list);
    });
  });
  return encounters;
}

// 依 teamParticipantId 分組，人數多的組排前面，同組玩家相鄰
function groupPremades(team) {
  const groups = team.reduce((acc, player) => {
    const id = player.teamParticipantId;
    acc[id] = acc[id] ? [...acc[id], player] : [player];
    return acc;
  }, {});
  return Object.values(groups).sort((a, b) => b.length - a.length);
}

const TeamTable = ({title, team, rankedStats, encounters, ownerPuuid}) => {
  const {t} = useTranslation();
  const groups = groupPremades(team);
  const maxGroupSize = groups[0]?.length ?? 0;

  let colorIndex = 0;
  const dataSource = groups.flatMap(group => {
    const color = group.length > 1 ? PREMADE_COLORS[colorIndex++ % PREMADE_COLORS.length] : null;
    return group.map(player => ({...player, premadeSize: group.length, premadeColor: color}));
  });
  const columns = [
    {
      title: t('matchAnalysis.player'),
      key: 'player',
      width: '38%',
      render: (_, player) => <PlayerCell player={player} encounters={encounters.get(player.puuid)} ownerPuuid={ownerPuuid}/>,
    },
    {
      title: t('matchAnalysis.position'),
      key: 'position',
      width: '22%',
      render: (_, player) => (
        <div style={{overflowWrap: 'anywhere'}}>
          <div>{formatPosition(player.selectedPosition, t)}</div>
          {player.selectedRole && <Text type="secondary" style={{display: 'block', fontSize: 12}}>
            {t('matchAnalysis.selectedRole')}: {formatQueuedRoles(player.selectedRole, t)}
          </Text>}
        </div>
      ),
    },
    {
      title: t('main.rankedType.soloDuo'),
      key: 'solo',
      width: '20%',
      render: (_, player) => <RankCell stats={rankedStats[player.puuid]} queueType={showTeammateRankedType.SOLO}/>,
    },
    {
      title: t('main.rankedType.flex'),
      key: 'flex',
      width: '20%',
      render: (_, player) => <RankCell stats={rankedStats[player.puuid]} queueType={showTeammateRankedType.FLEX}/>,
    },
  ];

  return (
    <>
      <h2>{title}{maxGroupSize > 0 && `(${t(`common.premade.${PREMADE_KEYS[maxGroupSize - 1]}`)})`}</h2>
      <Table
        rowKey={player => player.puuid || `${player.championId}-${player.teamParticipantId}`}
        size="small"
        columns={columns}
        // 次要資訊放到玩家與位置下方，四欄依容器寬度分配，不產生橫向捲動。
        tableLayout="fixed"
        dataSource={dataSource}
        pagination={false}
        style={{marginBottom: 16}}
      />
    </>
  );
};

const PlayerCell = ({player, encounters, ownerPuuid}) => {
  const {t} = useTranslation();
  const summonerName = useSummonerName(player.puuid);
  const championName = ApiUtils.getChampionNameById(player.championId);

  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
      <div style={{flexShrink: 0}}>
        <ChampionImage width={30} height={30} championId={player.championId}/>
      </div>
      <div style={{lineHeight: 1.4, minWidth: 0, flex: 1, overflowWrap: 'anywhere'}}>
        <div title={summonerName}>
          {summonerName || ''}
        </div>
        <Text type="secondary" style={{display: 'block', fontSize: 12}}>{championName}</Text>
        <Space size={[4, 4]} wrap style={{display: 'flex', marginTop: 4}}>
          <Tag color={player.premadeColor || undefined} style={{marginInlineEnd: 0, whiteSpace: 'normal'}}>
            {t(`common.premade.${PREMADE_KEYS[player.premadeSize - 1]}`)}
          </Tag>
          <EncounterCell encounters={encounters} ownerPuuid={ownerPuuid}/>
        </Space>
      </div>
    </div>
  );
};

const RankCell = ({stats, queueType}) => {
  const {t} = useTranslation();
  if (stats === undefined) return <Text type="secondary">...</Text>;
  if (stats === null) return <Text type="secondary">-</Text>; // 查詢失敗

  const queue = stats?.queues?.find(q => q.queueType === queueType);
  const tier = queue?.tier;
  if (!tier || tier === 'NONE' || tier === 'UNRANKED') {
    return <Text type="secondary">{t('matchAnalysis.unranked')}</Text>;
  }

  const tierLabel = t(`main.tierType.${tier.toLowerCase()}`, {defaultValue: tier});
  const division = queue.division && queue.division !== 'NA' ? ` ${queue.division}` : '';
  return (
    <div style={{lineHeight: 1.4, overflowWrap: 'anywhere'}}>
      <div style={{display: 'flex', flexWrap: 'wrap', columnGap: 4}}>
        <span>{`${tierLabel}${division}`}</span>
        <span>{`${queue.leaguePoints}LP`}</span>
      </div>
      <Text type="secondary" style={{display: 'block', fontSize: 12}}>
        {t('matchAnalysis.winLoss', {wins: queue.wins, losses: queue.losses})}
      </Text>
    </div>
  );
};

// 遇過次數放在玩家名稱下方；上次對戰摘要移到提示中，點開看每一場的詳情。
const EncounterCell = ({encounters, ownerPuuid}) => {
  const {t} = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  if (!encounters?.length) return null;

  const {game, participant, isTeammate, myWin} = encounters[0];
  const {kills = '', deaths = '', assists = ''} = participant.stats ?? {};
  const date = new Date(game.data.gameCreation);
  const summary = `${date.getMonth() + 1}/${date.getDate()} ${ApiUtils.getChampionNameById(participant.championId) ?? ''} ${kills}/${deaths}/${assists}`;
  return (
    <>
      <Tooltip title={<>
        <div>{summary} {myWin !== undefined && (myWin ? t('matchHistory.win') : t('matchHistory.lose'))}</div>
        <div>{t('matchAnalysis.metDetailHint')}</div>
      </>}>
        <button type="button" className="match-analysis-encounter" onClick={() => setIsOpen(true)}
                style={{padding: 0, border: 0, background: 'transparent', cursor: 'pointer', textAlign: 'start', maxWidth: '100%'}}>
          <Tag color="gold" style={{marginInlineEnd: 0, whiteSpace: 'normal', overflowWrap: 'anywhere'}}>
            {t('matchAnalysis.met')} {t('matchAnalysis.metTimes', {count: encounters.length})}
            {` · ${isTeammate ? t('matchAnalysis.teammate') : t('matchAnalysis.opponent')}`}
          </Tag>
        </button>
      </Tooltip>
      <Modal open={isOpen} footer={null} width={760} onCancel={() => setIsOpen(false)}
             title={`${getPlayerName(participant.player)} · ${t('matchAnalysis.met')} ${t('matchAnalysis.metTimes', {count: encounters.length})}`}>
        <Space direction="vertical" size="small" style={{display: 'flex'}}>
          {encounters.map(encounter => (
            <GameCard key={encounter.game._id} game={encounter.game} ownerPuuid={ownerPuuid}
                      highlightPuuids={new Set([participant.player.puuid])}/>
          ))}
        </Space>
      </Modal>
    </>
  );
};

function formatPosition(position, t) {
  if (!position || position === 'NONE') return '';
  if (position === 'FILL') return t('matchAnalysis.fill');
  return t(`banPick.lanes.${position.toLowerCase()}`, {defaultValue: position});
}

// selectedRole 例: TOP.PRIMARY.TOP.MIDDLE.FILL = 分配路線.第幾志願.第一志願.第二志願[.補位標記]，只顯示兩個志願
function formatQueuedRoles(selectedRole, t) {
  if (!selectedRole) return '';
  const parts = selectedRole.split('.');
  if (parts.length < 4) return formatPosition(selectedRole, t);
  return parts.slice(2, 4).map(role => formatPosition(role, t)).filter(Boolean).join(', ');
}

const mapStateToProps = (state) => {
  return {
    gameflowSession: state.GameReducer.gameflowSession,
    lobbyMembers: state.GameReducer.lobbyMembers,
    recentGames: state.GameReducer.recentGames,
  }
}

export default connect(mapStateToProps)(withErrorBoundary(MatchAnalysis))
