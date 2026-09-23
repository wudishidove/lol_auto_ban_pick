import React, {useState, useEffect} from 'react';
import {connect} from "react-redux";
import {Empty, Table, Tag, Typography} from 'antd';
import withErrorBoundary from "./error/withErrorBoundary";
import ApiUtils from "../api/api-utils";
import {showTeammateRankedType} from "../redux/reducers/ConfigReducer";
import {useTranslation} from 'react-i18next';
import useSummonerName from '../hooks/useSummonerName';
import ChampionImage from "./common/ChampionImage";

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

  return (
    <>
      {teamOne.length !== 0 && <TeamTable title={t('common.teamOne')} team={teamOne} rankedStats={rankedStats}/>}
      {teamTwo.length !== 0 && <TeamTable title={t('common.teamTwo')} team={teamTwo} rankedStats={rankedStats}/>}
    </>
  );
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

const TeamTable = ({title, team, rankedStats}) => {
  const {t} = useTranslation();
  const groups = groupPremades(team);
  const maxGroupSize = groups[0]?.length ?? 0;

  let colorIndex = 0;
  const dataSource = groups.flatMap(group => {
    const color = group.length > 1 ? PREMADE_COLORS[colorIndex++ % PREMADE_COLORS.length] : null;
    return group.map(player => ({...player, premadeSize: group.length, premadeColor: color}));
  });
  const hasSelectedRole = team.some(p => p.selectedRole);

  const columns = [
    {
      title: t('matchAnalysis.player'),
      key: 'player',
      render: (_, player) => <PlayerCell player={player}/>,
    },
    {
      title: t('matchAnalysis.premade'),
      key: 'premade',
      width: 70,
      render: (_, player) => player.premadeColor
        ? <Tag color={player.premadeColor}>{t(`common.premade.${PREMADE_KEYS[player.premadeSize - 1]}`)}</Tag>
        : <Text type="secondary">{t('common.premade.solo')}</Text>,
    },
    {
      title: t('matchAnalysis.position'),
      key: 'position',
      width: 70,
      render: (_, player) => formatPosition(player.selectedPosition, t),
    },
    hasSelectedRole && {
      title: t('matchAnalysis.selectedRole'),
      key: 'selectedRole',
      width: 90,
      render: (_, player) => formatPosition(player.selectedRole, t),
    },
    {
      title: t('main.rankedType.soloDuo'),
      key: 'solo',
      render: (_, player) => <RankCell stats={rankedStats[player.puuid]} queueType={showTeammateRankedType.SOLO}/>,
    },
    {
      title: t('main.rankedType.flex'),
      key: 'flex',
      render: (_, player) => <RankCell stats={rankedStats[player.puuid]} queueType={showTeammateRankedType.FLEX}/>,
    },
  ].filter(Boolean);

  return (
    <>
      <h2>{title}{maxGroupSize > 0 && `(${t(`common.premade.${PREMADE_KEYS[maxGroupSize - 1]}`)})`}</h2>
      <Table
        rowKey={player => player.puuid || `${player.championId}-${player.teamParticipantId}`}
        size="small"
        columns={columns}
        dataSource={dataSource}
        pagination={false}
        style={{marginBottom: 16}}
      />
    </>
  );
};

const PlayerCell = ({player}) => {
  const summonerName = useSummonerName(player.puuid);
  const championName = ApiUtils.getChampionNameById(player.championId);

  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
      <ChampionImage width={30} height={30} championId={player.championId}/>
      <div style={{lineHeight: 1.3}}>
        <div>{summonerName || ''}</div>
        <Text type="secondary" style={{fontSize: 12}}>{championName}</Text>
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
    <div style={{lineHeight: 1.3}}>
      <div style={{whiteSpace: 'nowrap'}}>{`${tierLabel}${division} ${queue.leaguePoints}LP`}</div>
      <Text type="secondary" style={{fontSize: 12}}>
        {t('matchAnalysis.winLoss', {wins: queue.wins, losses: queue.losses})}
      </Text>
    </div>
  );
};

function formatPosition(position, t) {
  if (!position || position === 'NONE') return '';
  if (position === 'FILL') return t('matchAnalysis.fill');
  return t(`banPick.lanes.${position.toLowerCase()}`, {defaultValue: position});
}

const mapStateToProps = (state) => {
  return {
    gameflowSession: state.GameReducer.gameflowSession
  }
}

export default connect(mapStateToProps)(withErrorBoundary(MatchAnalysis))
