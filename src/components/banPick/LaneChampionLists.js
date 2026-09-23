import React from 'react';
import {Col, Radio, Row, Space, Tag, Typography} from "antd";
import {useTranslation} from 'react-i18next';
import {lanes, listMode} from "../../redux/reducers/ConfigReducer";
import ChampionPrioritySelect from "./ChampionPrioritySelect";

const {Text} = Typography;

// 全局清單 + 各路線清單，activeListKey 為選角中實際採用的清單('global' 或路線)，非選角中為 null
function LaneChampionLists(props) {
  const {t} = useTranslation();
  const isLaneMode = props.mode === listMode.LANE;

  const renderRow = (key, label, championIds, onChange, placeholder) => (
    <Row key={key} align="middle" gutter={8}>
      <Col span={5}>
        <Space size={4}>
          <Text style={{fontSize: 15, userSelect: "none"}}>{label}</Text>
          {props.activeListKey === key && <Tag color="green">{t('banPick.inUse')}</Tag>}
        </Space>
      </Col>
      <Col span={19}>
        <ChampionPrioritySelect value={championIds}
                                options={props.championOptions}
                                placeholder={placeholder}
                                disabled={props.disabled}
                                showOrder={props.showOrder}
                                onChange={onChange}/>
      </Col>
    </Row>
  );

  return (
    <Space direction="vertical" style={{display: 'flex'}}>
      <Radio.Group value={props.mode} buttonStyle="solid"
                   style={{userSelect: "none"}}
                   disabled={props.disabled}
                   onChange={(event) => props.onModeChange(event.target.value)}>
        <Radio.Button value={listMode.GLOBAL}>{t('banPick.mode.global')}</Radio.Button>
        <Radio.Button value={listMode.LANE}>{t('banPick.mode.lane')}</Radio.Button>
      </Radio.Group>
      <Text type="secondary">{isLaneMode ? t('banPick.mode.laneHint') : t('banPick.mode.globalHint')}</Text>

      {renderRow('global',
        isLaneMode ? t('banPick.globalFallback') : t('banPick.global'),
        props.globalChampionIds,
        props.onGlobalChange,
        props.placeholder)}
      {isLaneMode && lanes.map(lane => renderRow(lane,
        t(`banPick.lanes.${lane}`),
        props.laneChampionIds?.[lane] ?? [],
        (championIds) => props.onLaneChange({...props.laneChampionIds, [lane]: championIds}),
        t('banPick.lanePlaceholder')))}
    </Space>
  );
}

export default LaneChampionLists;
