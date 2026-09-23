import React, {useEffect, useRef, useState} from 'react';
import {Alert, Button, Popconfirm, Space, Table, Tag, Tooltip, Typography} from "antd";
import {ReloadOutlined, StarFilled, StarOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';
import ApiUtils from "../../api/api-utils";
import ChampionImage from "../common/ChampionImage";
import {getProfileId, isSameRunes} from "../../services/runeUtils";
import {loadRecentLaneMatches} from "../../services/runeMatchUtils";
import RuneSummary from "./RuneIcons";

const {Text} = Typography;

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const pad = (value) => String(value).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// 對戰紀錄只有主系 4 個 + 副系 2 個，比對時不看屬性碎片
function isSameMainRunes(profile, match) {
  return isSameRunes(
    {...profile, selectedPerkIds: profile.selectedPerkIds.slice(0, 6)},
    {primaryStyleId: match.primaryStyleId, subStyleId: match.subStyleId, selectedPerkIds: match.perkIds});
}

// 近期對戰列表，按星號把該場符文存成設定檔
function RecentMatches({runeData, profiles, gamePhase, authPort, onStar, onUnstar}) {
  const {t} = useTranslation();
  const [matches, setMatches] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const newestGameId = useRef(null);
  const pendingReloads = useRef(0); // 打完一場後，還要在接下來幾次階段變更時重新載入

  // 回傳這次有沒有載到新的場次
  const load = async () => {
    setIsLoading(true);
    try {
      const summaries = await loadRecentLaneMatches();
      const hasNewMatch = (summaries[0]?.gameId ?? null) !== newestGameId.current;
      newestGameId.current = summaries[0]?.gameId ?? null;
      setMatches(summaries);
      setHasError(false);
      return hasNewMatch;
    } catch (error) {
      console.error('RecentMatches load failed', error);
      setHasError(true);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // 選角與遊戲中不對用戶端送請求，避免影響連線
  const isBusyPhase = ['ChampSelect', 'GameStart', 'InProgress', 'ReadyCheck'].includes(gamePhase);

  // 開啟分頁、連上用戶端時載入一次
  useEffect(() => {
    if (!isBusyPhase) load();
  }, [authPort]);

  // 之後只有打完一場才重新載入，平常在大廳/列隊之間切換不會再打 API
  // 剛結算時對戰紀錄可能還沒產生，所以沒載到新場次的話，下次回到大廳再試，最多 3 次(每次只有 1 個列表請求)
  useEffect(() => {
    if (gamePhase === 'InProgress') {
      pendingReloads.current = 3;
    } else if (pendingReloads.current > 0 && ['None', 'Lobby', 'EndOfGame'].includes(gamePhase)) {
      pendingReloads.current -= 1;
      load().then(hasNewMatch => {
        if (hasNewMatch) pendingReloads.current = 0;
      });
    }
  }, [gamePhase]);

  const profileById = new Map(profiles.map(profile => [profile._id, profile]));

  const renderChampion = (championId) => (
    <Space size={4} style={{whiteSpace: 'nowrap'}}>
      <ChampionImage width={26} height={26} championId={championId}/>
      <span>{ApiUtils.getChampionNameById(championId)}</span>
    </Space>
  );

  const renderStar = (match) => {
    const profile = profileById.get(getProfileId(match.lane, match.championId, match.enemyChampionId));
    if (profile && isSameMainRunes(profile, match)) {
      return (
        <Popconfirm title={t('runes.matches.unstarConfirm')} okText={t('runes.delete')} cancelText={t('runes.cancel')}
                    onConfirm={() => onUnstar(profile)}>
          <Tooltip title={t('runes.matches.saved')}>
            <Button type="text" icon={<StarFilled style={{color: '#faad14', fontSize: 20}}/>}/>
          </Tooltip>
        </Popconfirm>
      );
    }
    return (
      <Tooltip title={profile ? t('runes.matches.starOverwrite') : t('runes.matches.star')}>
        <Button type="text" icon={<StarOutlined style={{fontSize: 20}}/>} onClick={() => onStar(match, profile)}/>
      </Tooltip>
    );
  };

  const columns = [
    {
      title: t('runes.matches.time'), key: 'time',
      render: (_, match) => (
        <Space direction="vertical" size={0} style={{whiteSpace: 'nowrap'}}>
          <Text>{formatTime(match.gameCreation)}</Text>
          <Space size={4}>
            <Text type="secondary" style={{fontSize: 12}}>{t(`runes.queues.${match.queueId}`)}</Text>
            <Text type={match.win ? 'success' : 'danger'} style={{fontSize: 12}}>
              {match.win ? t('runes.matches.win') : t('runes.matches.lose')}
            </Text>
          </Space>
        </Space>
      )
    },
    {
      title: t('runes.matches.matchup'), key: 'matchup',
      render: (_, match) => (
        <Space size={6} style={{whiteSpace: 'nowrap'}}>
          <Tag style={{marginInlineEnd: 0}}>{t(`banPick.lanes.${match.lane}`)}</Tag>
          {renderChampion(match.championId)}
          <Text type="secondary">vs</Text>
          {renderChampion(match.enemyChampionId)}
        </Space>
      )
    },
    {
      title: t('runes.matches.runes'), key: 'runes',
      render: (_, match) => (
        <RuneSummary runeData={runeData} subStyleId={match.subStyleId} perkIds={match.perkIds} isCompact/>
      )
    },
    {
      title: t('runes.matches.saveColumn'), key: 'star', align: 'center', fixed: 'right', width: 64,
      render: (_, match) => renderStar(match)
    },
  ];

  return (
    <Space direction="vertical" size="middle" style={{display: 'flex'}}>
      <Space wrap>
        <Button icon={<ReloadOutlined/>} loading={isLoading} disabled={isBusyPhase} onClick={load}>
          {t('runes.matches.refresh')}
        </Button>
        <Text type="secondary">{isBusyPhase ? t('runes.matches.busyHint') : t('runes.matches.hint')}</Text>
      </Space>
      {hasError && <Alert type="warning" showIcon message={t('runes.matches.loadFailed')}/>}
      <Table rowKey="gameId" size="small" pagination={false} loading={isLoading} scroll={{x: 'max-content'}}
             columns={columns} dataSource={matches}
             locale={{emptyText: t('runes.matches.empty')}}/>
    </Space>
  );
}

export default RecentMatches;
