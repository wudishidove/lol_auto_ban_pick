import {useState, useEffect} from 'react';
import {getRuneData} from '../api/rune-data';

// 符文名稱與圖示，抓不到時 (沒網路) 回傳 null，畫面改顯示符文 id
function useRuneData(language) {
  const [runeData, setRuneData] = useState(null);

  useEffect(() => {
    let isCancelled = false;
    getRuneData(language)
      .then(data => {
        if (!isCancelled) setRuneData(data);
      })
      .catch(error => console.error('useRuneData failed', error));
    return () => {
      isCancelled = true;
    };
  }, [language]);

  return runeData;
}

export default useRuneData;
