import React from 'react';
import {connect} from "react-redux";
import {Alert, Button, Empty, Space, Spin, Typography} from "antd";
import {ReloadOutlined} from '@ant-design/icons';
import withErrorBoundary from "./error/withErrorBoundary";
import {useTranslation} from 'react-i18next';
import GameCard from "./common/GameCard";
import {BUSY_PHASES, syncRecentGames} from "../services/recentGamesSyncService";

const {Text} = Typography;

// 最近幾場對戰，場次由 RecentGamesSyncService 同步
function MatchHistory(props) {
  const {t} = useTranslation();
  const {games, ownerPuuid, isLoading, hasError} = props.recentGames;
  const isBusyPhase = BUSY_PHASES.includes(props.gamePhase);
  const gameCount = props.recentTeammateCheckGameCount;

  return (
    <Space direction="vertical" size="middle" style={{display: 'flex'}}>
      <Space wrap>
        <Button icon={<ReloadOutlined/>} loading={isLoading} disabled={isBusyPhase}
                onClick={() => syncRecentGames(gameCount)}>
          {t('matchHistory.refresh')}
        </Button>
        <Text type="secondary">
          {isBusyPhase ? t('matchHistory.busyHint') : t('matchHistory.idleHint', {count: gameCount})}
        </Text>
      </Space>
      {hasError && <Alert type="warning" showIcon message={t('matchHistory.loadFailed')}/>}
      <Spin spinning={isLoading && games.length === 0}>
        {games.length === 0 && !isLoading ? <Empty description={t('matchHistory.empty')}/> : (
          <Space direction="vertical" size="small" style={{display: 'flex'}}>
            {games.map(game => <GameCard key={game._id} game={game} ownerPuuid={ownerPuuid}/>)}
          </Space>
        )}
      </Spin>
    </Space>
  );
}

const mapStateToProps = (state) => {
  return {
    gamePhase: state.GameReducer.gamePhase,
    recentGames: state.GameReducer.recentGames,
    recentTeammateCheckGameCount: state.ConfigReducer.recentTeammateCheckGameCount,
  }
}

export default connect(mapStateToProps)(withErrorBoundary(MatchHistory))
