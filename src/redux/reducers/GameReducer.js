import {translate} from '../../i18n/i18n';

const GameReducer = (prevState = {
  gameflowSession: {},
  champSelectSession: {},
  chatRoomId: '',
  appState: translate('main.appStates.lolNotOpen'),
  appStateKey: 'main.appStates.lolNotOpen',
  gamePhase: '',
  myTeam: [],
  lobbyMembers: [],
  // 選角中的符文狀態，例: {gameId, lane, championId, enemyChampionId, profileId, isManual, error}
  runeApplyState: {},
  // 最近幾場對戰(對戰紀錄與對戰分析共用)，games 新的在前
  recentGames: {games: [], ownerPuuid: '', isLoading: false, hasError: false}
}, action) => {
  let newState = {...prevState}
  switch (action.type) {
    case "change-gameflowSession":
      newState.gameflowSession = action.data
      return newState
    case "change-champSelectSession":
      newState.champSelectSession = action.data
      return newState
    case "change-chatRoomId":
      newState.chatRoomId = action.data
      return newState
    case "change-appState":
      newState.appState = translate(action.data)
      newState.appStateKey = action.data
      return newState
    case "change-myTeam":
      newState.myTeam = action.data
      return newState
    case "change-gamePhase":
      newState.gamePhase = action.data
      return newState
    case "change-lobby-members":
      newState.lobbyMembers = action.data
      return newState
    case "change-runeApplyState":
      newState.runeApplyState = action.data
      return newState
    case "change-recentGames":
      newState.recentGames = {...prevState.recentGames, ...action.data}
      return newState
    default:
      return prevState
  }
}

export function gamePhaseToAppState(phase) {
  switch (phase) {
    case 'None':
      return 'gamePhases.none'
    case 'Lobby':
      return 'gamePhases.lobby'
    case 'Matchmaking':
      return 'gamePhases.matchmaking'
    case 'ReadyCheck':
      return 'gamePhases.readyCheck'
    case 'ChampSelect':
      return 'gamePhases.champSelect'
    case 'GameStart':
      return 'gamePhases.gameStart'
    case 'InProgress':
      return 'gamePhases.inProgress'
    case 'PreEndOfGame':
      return 'gamePhases.preEndOfGame'
    case 'EndOfGame':
      return 'gamePhases.endOfGame'
  }
}


export default GameReducer