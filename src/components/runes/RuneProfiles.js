import React, {useState} from 'react';
import {Alert, Button, Card, Empty, Popconfirm, Segmented, Space, Switch, Tag, Tooltip, Typography} from "antd";
import {
  CheckOutlined, DeleteOutlined, EditOutlined, LockFilled, PlusOutlined, QuestionCircleOutlined,
  ThunderboltOutlined, UnlockOutlined
} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';
import ApiUtils from "../../api/api-utils";
import {lanes} from "../../redux/reducers/ConfigReducer";
import {ANY_ENEMY, findProfile} from "../../services/runeUtils";
import ChampionImage from "../common/ChampionImage";
import ChampionSelect from "./ChampionSelect";
import RuneSummary from "./RuneIcons";

const {Text} = Typography;
const ALL_LANES = 'all';

// 符文設定檔列表: 依「我的英雄 + 路線」分組，每組底下列出各個對位的符文
function RuneProfiles(props) {
  const {t} = useTranslation();
  const {config, profiles, runeData, championOptions, runeApplyState} = props;
  const [laneFilter, setLaneFilter] = useState(ALL_LANES);
  const [championFilter, setChampionFilter] = useState(null);

  // 視窗不大，說明收進問號提示，兩個開關排同一列
  const renderSwitch = (id, label, hint, configKey) => (
    <Space size={6}>
      <Switch id={id} checked={config[configKey]}
              onChange={(value) => props.changeConfigValues({[configKey]: value})}/>
      <label htmlFor={id} style={{userSelect: "none", fontSize: 15}}>{label}</label>
      <Tooltip title={hint}>
        <QuestionCircleOutlined style={{color: '#999'}}/>
      </Tooltip>
    </Space>
  );

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
  };

  const renderEnemy = (enemyChampionId) => enemyChampionId === ANY_ENEMY
    ? <Tag color="blue" style={{marginInlineEnd: 0}}>{t('runes.anyEnemy')}</Tag>
    : (
      <Space size={6}>
        <Text type="secondary">vs</Text>
        <ChampionImage width={26} height={26} championId={enemyChampionId}/>
        <span>{ApiUtils.getChampionNameById(enemyChampionId)}</span>
      </Space>
    );

  // 選角中: 顯示推測的對位，並列出這隻英雄這條路線的設定檔讓使用者一鍵改套用
  const renderChampSelectPanel = () => {
    if (!runeApplyState?.gameId) return null;
    const {lane, championId, enemyChampionId, profileId, error} = runeApplyState;
    const candidates = profiles.filter(profile => profile.lane === lane && profile.championId === championId);
    const matched = findProfile(profiles, lane, championId, enemyChampionId);
    return (
      <Card size="small" style={{borderColor: '#1677ff'}}
            title={
              <Space wrap>
                <Tag color="processing">{t('runes.champSelect.title')}</Tag>
                <ChampionImage width={24} height={24} championId={championId}/>
                <span>{ApiUtils.getChampionNameById(championId)}</span>
                <Tag>{t(`banPick.lanes.${lane}`)}</Tag>
                <Text type="secondary">{t('runes.champSelect.opponent')}:</Text>
                {enemyChampionId
                  ? <Space size={4}>
                    <ChampionImage width={24} height={24} championId={enemyChampionId}/>
                    <span>{ApiUtils.getChampionNameById(enemyChampionId)}</span>
                  </Space>
                  : <Text type="secondary">{t('runes.champSelect.opponentUnknown')}</Text>}
              </Space>
            }>
        <Space direction="vertical" style={{display: 'flex'}}>
          {error && <Alert type="error" showIcon message={t('runes.applyFailed')}/>}
          {candidates.length === 0
            ? <Text type="secondary">{t('runes.champSelect.noProfile')}</Text>
            : <>
              <Text type="secondary">{t('runes.champSelect.pickHint')}</Text>
              <Space wrap>
                {candidates.map(profile => (
                  <Button key={profile._id}
                          type={profile._id === profileId ? 'primary' : 'default'}
                          icon={profile._id === profileId ? <CheckOutlined/> : null}
                          onClick={() => props.onApply(profile)}>
                    <Space size={4}>
                      {profile.enemyChampionId === ANY_ENEMY
                        ? t('runes.anyEnemy')
                        : `vs ${ApiUtils.getChampionNameById(profile.enemyChampionId)}`}
                      {profile._id === matched?._id && profile._id !== profileId &&
                        <Tag color="green" style={{marginInlineEnd: 0}}>{t('runes.champSelect.matched')}</Tag>}
                    </Space>
                  </Button>
                ))}
              </Space>
            </>}
        </Space>
      </Card>
    );
  };

  const renderProfileRow = (profile) => (
    <div key={profile._id}
         style={{display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', flexWrap: 'wrap'}}>
      <div style={{width: 130, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
        {renderEnemy(profile.enemyChampionId)}
        <div>
          <Text type="secondary" style={{fontSize: 12}}>
            {t(`runes.source.${profile.source ?? 'manual'}`)} · {formatDate(profile.updatedAt)}
          </Text>
        </div>
      </div>
      <div style={{flex: 1}}>
        <RuneSummary runeData={runeData} subStyleId={profile.subStyleId} perkIds={profile.selectedPerkIds}
                     isCompact/>
      </div>
      <Space size={0}>
        <Tooltip title={profile.pinned ? t('runes.pinnedHint') : t('runes.unpinnedHint')}>
          <Button type="text" onClick={() => props.onTogglePin(profile)}
                  icon={profile.pinned ? <LockFilled style={{color: '#faad14'}}/> : <UnlockOutlined/>}/>
        </Tooltip>
        <Tooltip title={t('runes.applyHint')}>
          <Button type="text" icon={<ThunderboltOutlined/>} onClick={() => props.onApply(profile)}/>
        </Tooltip>
        <Tooltip title={t('runes.edit')}>
          <Button type="text" icon={<EditOutlined/>} onClick={() => props.onEdit(profile)}/>
        </Tooltip>
        <Popconfirm title={t('runes.deleteConfirm')} okText={t('runes.delete')} cancelText={t('runes.cancel')}
                    onConfirm={() => props.onDelete(profile)}>
          <Button type="text" danger icon={<DeleteOutlined/>}/>
        </Popconfirm>
      </Space>
    </div>
  );

  // 依 英雄+路線 分組，最近更新的組排前面；組內通用排最前，其餘依更新時間
  const groups = new Map();
  profiles
    .filter(profile => laneFilter === ALL_LANES || profile.lane === laneFilter)
    .filter(profile => !championFilter || profile.championId === championFilter)
    .forEach(profile => {
      const key = `${profile.championId}:${profile.lane}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(profile);
    });
  const sortedGroups = [...groups.values()]
    .map(list => list.sort((a, b) =>
      (a.enemyChampionId === ANY_ENEMY ? -1 : 0) - (b.enemyChampionId === ANY_ENEMY ? -1 : 0)
      || (b.updatedAt ?? 0) - (a.updatedAt ?? 0)))
    .sort((a, b) => Math.max(...b.map(item => item.updatedAt ?? 0)) - Math.max(...a.map(item => item.updatedAt ?? 0)));

  return (
    <Space direction="vertical" size="middle" style={{display: 'flex'}}>
      <Space wrap size="large">
        {renderSwitch('runes-auto-record-btn', t('runes.autoRecord'), t('runes.autoRecordHint'), 'isAutoRecordRunes')}
        {renderSwitch('runes-auto-apply-btn', t('runes.autoApply'), t('runes.autoApplyHint'), 'isAutoApplyRunes')}
      </Space>

      {renderChampSelectPanel()}

      <Space wrap style={{display: 'flex', justifyContent: 'space-between'}}>
        <Space wrap>
          <Segmented value={laneFilter} onChange={setLaneFilter}
                     options={[{value: ALL_LANES, label: t('runes.allLanes')},
                       ...lanes.map(lane => ({value: lane, label: t(`banPick.lanes.${lane}`)}))]}/>
          <ChampionSelect value={championFilter} options={championOptions} allowClear style={{width: 140}}
                          placeholder={t('runes.filterChampion')}
                          onChange={(value) => setChampionFilter(value ?? null)}/>
        </Space>
        <Button type="primary" icon={<PlusOutlined/>} onClick={props.onAdd}>{t('runes.add')}</Button>
      </Space>

      {sortedGroups.length === 0 &&
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE}
               description={profiles.length === 0 ? t('runes.emptyHint') : t('runes.emptyFiltered')}>
          {profiles.length === 0 &&
            <Button onClick={props.onGotoMatches}>{t('runes.gotoMatches')}</Button>}
        </Empty>}

      {sortedGroups.map(list => (
        <Card key={`${list[0].championId}:${list[0].lane}`} size="small"
              title={
                <Space>
                  <ChampionImage width={30} height={30} championId={list[0].championId}/>
                  <span style={{fontSize: 16}}>{ApiUtils.getChampionNameById(list[0].championId)}</span>
                  <Tag color="geekblue">{t(`banPick.lanes.${list[0].lane}`)}</Tag>
                </Space>
              }
              extra={
                <Button type="link" size="small" icon={<PlusOutlined/>}
                        onClick={() => props.onAddFor(list[0])}>{t('runes.addMatchup')}</Button>
              }>
          {list.map(renderProfileRow)}
        </Card>
      ))}
    </Space>
  );
}

export default RuneProfiles;
