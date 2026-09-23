import React from 'react';
import {Select, Space} from "antd";
import ChampionImage from "../common/ChampionImage";
import {filterChampion} from "../banPick/ChampionPrioritySelect";

// 單選英雄，可用中文/英文名稱搜尋；extraOptions 會排在英雄前面，例: 通用
function ChampionSelect({value, onChange, options, extraOptions = [], placeholder, allowClear, style, disabled}) {
  return (
    <Select showSearch
            allowClear={allowClear}
            style={{width: 180, ...style}}
            placeholder={placeholder}
            disabled={disabled}
            value={value}
            options={[...extraOptions, ...options]}
            filterOption={filterChampion}
            optionRender={(option) => (
              <Space>
                {option.value > 0 && <ChampionImage width={24} height={24} championId={option.value}/>}
                {option.label}
              </Space>
            )}
            onChange={onChange}/>
  );
}

export default ChampionSelect;
