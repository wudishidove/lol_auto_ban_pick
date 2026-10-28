import React from 'react';
import {Card, Space, Tag, Typography} from "antd";
import {useTranslation} from 'react-i18next';
import ApiUtils from "../../api/api-utils";
import ChampionImage from "./ChampionImage";

const {Text} = Typography;

export function formatTime(timestamp) {
  const date = new Date(timestamp);
  const pad = (value) => String(value).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function getPlayerName(player) {
  if (player?.gameName) return player.tagLine ? `${player.gameName}#${player.tagLine}` : player.gameName;
  return player?.summonerName ?? '';
}

// 把一場的 participants 跟 participantIdentities 合併
export function getGamePlayers(data) {
  const identities = new Map((data?.participantIdentities ?? []).map(identity => [identity.participantId, identity.player]));
  return (data?.participants ?? []).map(participant => ({
    ...participant,
    player: identities.get(participant.participantId) ?? {},
  }));
}

// 一場對戰的雙方玩家與戰績，highlightPuuids 裡的玩家會標色
const GameCard = ({game, ownerPuuid, highlightPuuids}) => {
  const {t} = useTranslation();
  const players = getGamePlayers(game.data);
  const me = players.find(participant => participant.player.puuid === ownerPuuid);
  const teamIds = [...new Set(players.map(participant => participant.teamId))].sort();
  const title = (
    <Space size={8} wrap>
      <Text>{formatTime(game.data.gameCreation)}</Text>
      {game.data.gameMode && <Text type="secondary" style={{fontSize: 12}}>{game.data.gameMode}</Text>}
      {me && (
        <Text type={me.stats?.win ? 'success' : 'danger'} style={{fontSize: 12}}>
          {me.stats?.win ? t('matchHistory.win') : t('matchHistory.lose')}
        </Text>
      )}
    </Space>
  );
  return (
    <Card size="small" title={title}>
      <div style={{display: 'flex', flexWrap: 'wrap', gap: 16}}>
        {teamIds.map(teamId => (
          <div key={teamId} style={{flex: '1 1 320px', minWidth: 0}}>
            <Text strong>{teamId === 100 ? t('common.teamOne') : t('common.teamTwo')}</Text>
            {players.filter(participant => participant.teamId === teamId).map(participant => (
              <TeamMember key={participant.participantId} participant={participant}
                          isHighlighted={!!highlightPuuids?.has(participant.player.puuid)}
                          isMe={participant.player.puuid === ownerPuuid}/>
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
};

const TeamMember = ({participant, isHighlighted, isMe}) => {
  const {t} = useTranslation();
  const {player, championId, stats = {}} = participant;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '2px 4px', borderRadius: 4,
      background: isHighlighted ? 'rgba(250, 173, 20, 0.15)' : undefined
    }}>
      <ChampionImage width={26} height={26} championId={championId}/>
      <Text strong={isHighlighted || isMe} ellipsis style={{flex: 1, minWidth: 0}}>
        {getPlayerName(player)}
        {isMe && <Tag style={{marginLeft: 6}}>{t('matchHistory.me')}</Tag>}
      </Text>
      <Text type="secondary" style={{whiteSpace: 'nowrap', fontSize: 12}}>
        {ApiUtils.getChampionNameById(championId) ?? ''} {stats.kills ?? ''}/{stats.deaths ?? ''}/{stats.assists ?? ''}
      </Text>
    </div>
  );
};

export default GameCard;
