import React from 'react';
import {Select, Space, Tag} from "antd";
import ChampionImage from "../common/ChampionImage";

// 搜尋時忽略大小寫、空白與標點，讓 "kaisa"、"lee sin" 都找得到
const normalize = (text) => (text ?? '').toLowerCase().replace(/[\s'.&]/g, '');

// option.searchText 含顯示名稱與英文名稱，顯示語言是中文時也能用英文搜尋
export const filterChampion = (input, option) =>
  normalize(option.searchText ?? option.label).includes(normalize(input));

// 多選英雄，選取順序即優先順序，showOrder 時在標籤上顯示順位
function ChampionPrioritySelect({value, onChange, options, placeholder, disabled, showOrder}) {
  const championIds = value ?? [];

  const tagRender = ({label, value: championId, closable, onClose}) => {
    const order = championIds.indexOf(championId) + 1;
    return (
      <Tag closable={closable} onClose={onClose}
           onMouseDown={(event) => {
             event.preventDefault();
             event.stopPropagation();
           }}
           style={{
             display: 'inline-flex', alignItems: 'center', gap: 4,
             marginInlineEnd: 4, fontSize: 14, padding: '2px 6px', userSelect: 'none'
           }}>
        {showOrder ? `${order}.` : ''}
        <ChampionImage width={20} height={20} championId={championId}/>
        {label}
      </Tag>
    );
  };

  return (
    <Select mode="multiple"
            allowClear
            style={{width: '100%'}}
            placeholder={placeholder}
            disabled={disabled}
            value={championIds}
            options={options}
            filterOption={filterChampion}
            tagRender={tagRender}
            optionRender={(option) => (
              <Space>
                <ChampionImage width={24} height={24} championId={option.value}/>
                {option.label}
              </Space>
            )}
            onChange={onChange}/>
  );
}

export default ChampionPrioritySelect;
