const ConfigReducer = (prevState = {
  isAutoAccept: true,
  isShowRecentTeammate: true,
  recentTeammateCheckGameCount: 20,
  isShowTeammateRanked: true,
  showTeammateRankedType: showTeammateRankedType.BOTH,
  isHovercard: false,
  hovercardTierType: tierType.CHALLENGER,
  hovercardRankedType: rankedType.SOLO,
  isAutoBan: false,
  autoBanChampionIds: [], // 全局排序，依優先順序排列的英雄ID
  autoBanMode: listMode.GLOBAL,
  autoBanLaneChampionIds: {}, // 路線排序，例: {top: [86, 432]}
  isAutoBanIgnoreTeammateIntent: false, // 隊友預選的英雄也照 ban
  isAutoBanHoverOnly: false, // 只選取不鎖定
  isAutoPickIntent: false,
  autoPickChampionIds: [],
  autoPickMode: listMode.GLOBAL,
  autoPickLaneChampionIds: {},
  isAutoPickRandom: false, // 從預選池隨機挑一隻
  isAutoPickRehover: false, // 自動預選的英雄被 ban/選走時，改預選清單中下一隻可用的
  isAutoPickLock: false, // 自動預選成功時，選角時間剩 1 秒自動鎖定
  isAutoCheckUpdate: true, // 啟動時(之後每 3 小時)檢查 GitHub release 是否有新版本
  isAutoRecordRunes: true, // 進遊戲時自動記錄該場符文，賽後補上對位存成設定檔
  isAutoApplyRunes: false, // 選角鎖定英雄後，依 路線+英雄+對位 自動套用符文設定檔
  language: language.zh,
  isDarkMode: localStorage.getItem('theme') === 'dark' ? true : false
}, action) => {
  let newState = {...prevState}
  switch (action.type) {
    case "change-isAutoAccept":
      newState.isAutoAccept = action.data
      return newState
    case "change-isShowRecentTeammate":
      newState.isShowRecentTeammate = action.data
      return newState
    case "change-recentTeammateCheckGameCount":
      newState.recentTeammateCheckGameCount = action.data
      return newState
    case "change-isShowTeammateRanked":
      newState.isShowTeammateRanked = action.data
      return newState
    case "change-showTeammateRankedType":
      newState.showTeammateRankedType = action.data
      return newState
    case "change-isHovercard":
      newState.isHovercard = action.data
      return newState
    case "change-hovercardTierType":
      newState.hovercardTierType = action.data
      return newState
    case "change-hovercardRankedType":
      newState.hovercardRankedType = action.data
      return newState
    case "change-configValues":
      // action.data 為部分設定，例: {autoBanMode: 'lane'}
      return {...prevState, ...action.data}
    case "change-config":
      // 舊版設定檔可能缺少新欄位，保留預設值
      newState = {...prevState, ...action.data}
      return newState
    case "change-language":
      newState.language = action.data
      return newState
    case "change-isDarkMode":
      newState.isDarkMode = action.data
      return newState
    default:
      return prevState
  }
}

export const rankedType = Object.freeze({
  SOLO: "RANKED_SOLO_5x5",
  FLEX_SR: "RANKED_FLEX_SR",
  FLEX_TT: "RANKED_FLEX_TT",
  TFT: "RANKED_TFT",
  TFT_DOUBLE_UP: "RANKED_TFT_DOUBLE_UP",
  TFT_TURBO: "RANKED_TFT_TURBO",
});

export const showTeammateRankedType = Object.freeze({
  SOLO: rankedType.SOLO,
  FLEX: rankedType.FLEX_SR,
  BOTH: "RANKED_BOTH",
});

export const tierType = Object.freeze({
  IRON: "Iron",
  BRONZE: "Bronze",
  SILVER: "Silver",
  GOLD: "Gold",
  PLATINUM: "Platinum",
  DIAMOND: "Diamond",
  MASTER: "Master",
  GRANDMASTER: "Grandmaster",
  CHALLENGER: "Challenger"
})

export const language = Object.freeze({
  zh: "zh",
  en: "en"
})

// 英雄清單的選用方式，LANE 為路線排序優先，該路線未設定時使用全局排序
export const listMode = Object.freeze({
  GLOBAL: "global",
  LANE: "lane"
})

// 對應 champ select session 的 assignedPosition
export const lanes = Object.freeze(["top", "jungle", "middle", "bottom", "utility"])

export const themeType = Object.freeze({
  DARK: "dark",
  LIGHT: "light",
  SYSTEM: "system"
})

export default ConfigReducer