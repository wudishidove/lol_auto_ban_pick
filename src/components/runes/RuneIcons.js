import React from 'react';
import {Space, Tooltip, Typography} from "antd";

const {Text} = Typography;

// 單一符文/系別圖示，onClick 有值時可點選；isDimmed 用在編輯器裡未選取的符文
export function RuneIcon({item, size = 24, isDimmed = false, isSelected = false, onClick}) {
  if (!item) {
    return <span style={{
      display: 'inline-block', width: size, height: size, borderRadius: '50%',
      border: '1px dashed #888', boxSizing: 'border-box', verticalAlign: 'middle'
    }}/>;
  }
  return (
    <Tooltip title={item.name} mouseEnterDelay={0.3}>
      <img src={item.iconUrl} alt={item.name} width={size} height={size} draggable={false}
           onClick={onClick}
           style={{
             borderRadius: '50%',
             verticalAlign: 'middle',
             userSelect: 'none',
             cursor: onClick ? 'pointer' : 'default',
             filter: isDimmed ? 'grayscale(1)' : 'none',
             opacity: isDimmed ? 0.5 : 1,
             boxShadow: isSelected ? '0 0 0 2px #d4a017' : 'none',
             background: 'rgba(0, 0, 0, 0.55)',
           }}/>
    </Tooltip>
  );
}

/**
 * 一列顯示整組符文: 基石 + 主系 3 個 | 副系 2 個 | 屬性碎片 3 個
 * perkIds 只有 6 個(對戰紀錄)時不顯示碎片
 */
function RuneSummary({runeData, subStyleId, perkIds, isCompact = false}) {
  const size = isCompact
    ? {keystone: 28, perk: 20, style: 13, shard: 15}
    : {keystone: 34, perk: 24, style: 16, shard: 18};
  const ids = perkIds ?? [];
  if (!runeData) {
    return <Text type="secondary">{ids.join(', ')}</Text>;
  }
  const perkOf = (id) => runeData.perks[id] ?? {id, name: String(id), iconUrl: ''};
  const styleOf = (id) => runeData.styles.find(style => style.id === id);
  const shards = ids.slice(6, 9);
  return (
    <Space size={isCompact ? 6 : 10} align="center" style={{whiteSpace: 'nowrap'}}>
      <Space size={3} align="center">
        <RuneIcon item={perkOf(ids[0])} size={size.keystone}/>
        {ids.slice(1, 4).map((id, index) => <RuneIcon key={index} item={perkOf(id)} size={size.perk}/>)}
      </Space>
      <Space size={3} align="center">
        <RuneIcon item={styleOf(subStyleId)} size={size.style}/>
        {ids.slice(4, 6).map((id, index) => <RuneIcon key={index} item={perkOf(id)} size={size.perk}/>)}
      </Space>
      {shards.length > 0 &&
        <Space size={2} align="center">
          {shards.map((id, index) => <RuneIcon key={index} item={perkOf(id)} size={size.shard}/>)}
        </Space>}
    </Space>
  );
}

export default RuneSummary;
