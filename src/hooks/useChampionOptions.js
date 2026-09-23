import {useState, useEffect} from 'react';
import ApiUtils from '../api/api-utils';

// 英雄下拉選單的選項，language 變更時重抓
function useChampionOptions(language) {
  const [championOptions, setChampionOptions] = useState([]);

  useEffect(() => {
    const fetchChampions = async () => {
      // 顯示用目前語言的名稱，另外抓英文名稱供搜尋用
      const [champions, englishChampions] = await Promise.all([
        ApiUtils.getAllChampionsByCache(),
        ApiUtils.getAllChampionsByCache('en_US'),
      ]);
      const englishNames = {};
      englishChampions.forEach(champion => {
        englishNames[champion.key] = champion.name;
      });
      const options = champions
        .map(champion => ({
          value: Number(champion.key),
          label: champion.name,
          // champion.id 是英文代號(例: MonkeyKing)，英文名稱抓不到時至少還能用代號搜尋
          searchText: `${champion.name} ${englishNames[champion.key] ?? ''} ${champion.id}`,
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
      setChampionOptions(options);
    };
    fetchChampions();
  }, [language]);

  return championOptions;
}

export default useChampionOptions;
