import store from '../redux/store';
import {updateStatus} from '../redux/reducers/UpdateReducer';

const {ipcRenderer} = window.require('electron');

export const setUpdateState = (data) => store.dispatch({type: "change-updateState", data});

const isBusy = () => [updateStatus.CHECKING, updateStatus.DOWNLOADING, updateStatus.RESTARTING]
  .includes(store.getState().UpdateReducer.status);

/**
 * 檢查 GitHub release 是否有新版本，實際的請求在 main/updater.js
 * @returns 檢查結果，失敗或正在忙時回傳 null
 */
export const checkForUpdate = async () => {
  if (isBusy()) return null;
  setUpdateState({status: updateStatus.CHECKING, error: null});
  const result = await ipcRenderer.invoke('update-check');
  if (result.error) {
    setUpdateState({status: updateStatus.ERROR, error: result.error});
    return null;
  }
  setUpdateState({status: updateStatus.IDLE, info: result});
  return result;
}

// 下載並安裝最新版本，成功後程式會自動重新啟動
export const installUpdate = async () => {
  if (isBusy()) return;
  setUpdateState({status: updateStatus.DOWNLOADING, progress: {received: 0, total: 0}, error: null});
  const result = await ipcRenderer.invoke('update-install');
  if (result.error) {
    setUpdateState({status: updateStatus.ERROR, error: result.error});
  } else {
    setUpdateState({status: updateStatus.RESTARTING});
  }
}
