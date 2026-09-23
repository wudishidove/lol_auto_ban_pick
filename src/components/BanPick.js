import React from 'react';
import {connect} from "react-redux";
import withErrorBoundary from "./error/withErrorBoundary";
import {Checkbox, Space, Switch, Tabs, Tag, Typography} from 'antd';
import {useTranslation} from 'react-i18next';
import useChampionOptions from "../hooks/useChampionOptions";
import LaneChampionLists from "./banPick/LaneChampionLists";
import {getMyLane, resolveListKey} from "../services/champSelectUtils";

const {Text} = Typography;

function BanPick(props) {
  const {t} = useTranslation();
  const {config} = props;
  const championOptions = useChampionOptions(config.language);

  const isChampSelect = props.gamePhase === 'ChampSelect';
  const myLane = isChampSelect ? getMyLane(props.champSelectSession) : null;

  const renderHeader = (id, label, checked, configKey) => (
    <Space wrap>
      <label htmlFor={id} style={{userSelect: "none", fontSize: 16}}>{label}</label>
      <Switch id={id} checked={checked}
              onChange={(value) => props.changeConfigValues({[configKey]: value})}/>
      {isChampSelect &&
        <Tag color="blue">
          {t('banPick.currentLane')}: {myLane ? t(`banPick.lanes.${myLane}`) : t('banPick.noLane')}
        </Tag>}
    </Space>
  );

  const renderCheckbox = (label, hint, checked, configKey, disabled) => (
    <div>
      <Checkbox checked={checked} disabled={disabled}
                style={{userSelect: "none", fontSize: 15}}
                onChange={(event) => props.changeConfigValues({[configKey]: event.target.checked})}>
        {label}
      </Checkbox>
      <div style={{marginLeft: 24}}><Text type="secondary">{hint}</Text></div>
    </div>
  );

  const banTab = (
    <Space direction="vertical" size="middle" style={{display: 'flex'}}>
      {renderHeader('ban-pick-auto-ban-btn', t('main.autoBan'), config.isAutoBan, 'isAutoBan')}
      {renderCheckbox(t('banPick.ban.ignoreTeammateIntent'), t('banPick.ban.ignoreTeammateIntentHint'),
        config.isAutoBanIgnoreTeammateIntent, 'isAutoBanIgnoreTeammateIntent', !config.isAutoBan)}
      {renderCheckbox(t('banPick.ban.hoverOnly'), t('banPick.ban.hoverOnlyHint'),
        config.isAutoBanHoverOnly, 'isAutoBanHoverOnly', !config.isAutoBan)}
      <LaneChampionLists mode={config.autoBanMode}
                         globalChampionIds={config.autoBanChampionIds}
                         laneChampionIds={config.autoBanLaneChampionIds}
                         championOptions={championOptions}
                         placeholder={t('main.autoBanPlaceholder')}
                         disabled={!config.isAutoBan}
                         showOrder={true}
                         activeListKey={isChampSelect && config.isAutoBan
                           ? resolveListKey(config.autoBanMode, config.autoBanLaneChampionIds, myLane) : null}
                         onModeChange={(value) => props.changeConfigValues({autoBanMode: value})}
                         onGlobalChange={(value) => props.changeConfigValues({autoBanChampionIds: value})}
                         onLaneChange={(value) => props.changeConfigValues({autoBanLaneChampionIds: value})}/>
    </Space>
  );

  const pickTab = (
    <Space direction="vertical" size="middle" style={{display: 'flex'}}>
      {renderHeader('ban-pick-auto-pick-btn', t('main.autoPickIntent'), config.isAutoPickIntent, 'isAutoPickIntent')}
      <Text type="secondary">{t('banPick.pick.description')}</Text>
      {renderCheckbox(t('banPick.pick.random'), t('banPick.pick.randomHint'),
        config.isAutoPickRandom, 'isAutoPickRandom', !config.isAutoPickIntent)}
      {renderCheckbox(t('banPick.pick.rehover'), t('banPick.pick.rehoverHint'),
        config.isAutoPickRehover, 'isAutoPickRehover', !config.isAutoPickIntent)}
      {renderCheckbox(t('main.autoPickLock'), t('banPick.pick.lockHint'),
        config.isAutoPickLock, 'isAutoPickLock', !config.isAutoPickIntent)}
      <LaneChampionLists mode={config.autoPickMode}
                         globalChampionIds={config.autoPickChampionIds}
                         laneChampionIds={config.autoPickLaneChampionIds}
                         championOptions={championOptions}
                         placeholder={config.isAutoPickRandom
                           ? t('banPick.pick.poolPlaceholder') : t('banPick.pick.placeholder')}
                         disabled={!config.isAutoPickIntent}
                         showOrder={!config.isAutoPickRandom}
                         activeListKey={isChampSelect && config.isAutoPickIntent
                           ? resolveListKey(config.autoPickMode, config.autoPickLaneChampionIds, myLane) : null}
                         onModeChange={(value) => props.changeConfigValues({autoPickMode: value})}
                         onGlobalChange={(value) => props.changeConfigValues({autoPickChampionIds: value})}
                         onLaneChange={(value) => props.changeConfigValues({autoPickLaneChampionIds: value})}/>
    </Space>
  );

  const items = [
    {key: 'ban', label: t('banPick.banTab'), children: banTab},
    {key: 'pick', label: t('banPick.pickTab'), children: pickTab},
  ];

  return (
    <div>
      <Tabs defaultActiveKey="ban" items={items}/>
    </div>
  );
}

const mapStateToProps = (state) => {
  return {
    config: state.ConfigReducer,
    gamePhase: state.GameReducer.gamePhase,
    champSelectSession: state.GameReducer.champSelectSession,
  }
}
const mapDispatchToProp = {
  changeConfigValues(data) {
    return {
      type: "change-configValues",
      data
    }
  }
}

export default connect(mapStateToProps, mapDispatchToProp)(withErrorBoundary(BanPick))
