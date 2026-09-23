const UpdateReducer = (prevState = {
  info: null, // main/updater.js checkForUpdate 的結果
  status: updateStatus.IDLE,
  isModalOpen: false,
  progress: {received: 0, total: 0},
  error: null
}, action) => {
  switch (action.type) {
    case "change-updateState":
      // action.data 為部分狀態，例: {status: 'checking'}
      return {...prevState, ...action.data}
    default:
      return prevState
  }
}

export const updateStatus = Object.freeze({
  IDLE: "idle",
  CHECKING: "checking",
  DOWNLOADING: "downloading",
  RESTARTING: "restarting",
  ERROR: "error"
})

export default UpdateReducer
