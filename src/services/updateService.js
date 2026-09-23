import React, {useEffect, useRef} from 'react';
import {connect} from "react-redux";
import {Alert, Button, Modal, Progress} from "antd";
import {useTranslation} from 'react-i18next';
import withErrorBoundary from "../components/error/withErrorBoundary";
import {updateStatus} from "../redux/reducers/UpdateReducer";
import {checkForUpdate, installUpdate, setUpdateState} from "./updateUtils";

const {ipcRenderer} = window.require('electron');

const CHECK_INTERVAL_MS = 3 * 60 * 60 * 1000;
const toMB = (bytes) => (bytes / 1024 / 1024).toFixed(1);

/**
 * 自動更新
 * 1. 啟動時(之後每 3 小時)檢查是否有新版本，可在「關於」頁關閉
 * 2. 有新版本時跳出視窗，使用者同意後下載、覆蓋安裝並重新啟動
 */
const UpdateService = (props) => {
  const {t} = useTranslation();
  const notifiedVersion = useRef(null); // 同一個版本每次啟動只主動跳一次

  useEffect(() => {
    if (!props.isAutoCheckUpdate) return;
    const check = async () => {
      const result = await checkForUpdate();
      if (result?.hasUpdate && notifiedVersion.current !== result.latestVersion) {
        notifiedVersion.current = result.latestVersion;
        setUpdateState({isModalOpen: true});
      }
    };
    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [props.isAutoCheckUpdate]);

  useEffect(() => {
    const handleEvent = (event, data) => setUpdateState({progress: data});
    ipcRenderer.on('update-progress', handleEvent);
    return () => {
      ipcRenderer.removeListener('update-progress', handleEvent);
    }
  }, []);

  const {info, status, progress, error} = props;
  if (!info) return null;
  const isWorking = status === updateStatus.DOWNLOADING || status === updateStatus.RESTARTING;

  const handleClose = () => setUpdateState({
    isModalOpen: false,
    ...(status === updateStatus.ERROR && {status: updateStatus.IDLE, error: null})
  });

  const handleOpenRelease = () => {
    ipcRenderer.send('open-link', info.releaseUrl);
  }

  const handleInstall = () => {
    installUpdate();
  }

  return (
    <Modal
      title={t('update.title', {version: info.tagName})}
      open={props.isModalOpen}
      closable={!isWorking}
      maskClosable={false}
      keyboard={!isWorking}
      onCancel={handleClose}
      footer={[
        <Button key="later" disabled={isWorking} onClick={handleClose}>{t('update.later')}</Button>,
        <Button key="release" type={info.canInstall ? "default" : "primary"} disabled={isWorking}
                onClick={handleOpenRelease}>{t('update.viewRelease')}</Button>,
        info.canInstall &&
        <Button key="install" type="primary" loading={isWorking} onClick={handleInstall}>
          {t('update.install')}
        </Button>
      ]}
    >
      <p>{t('about.currentVersion')}: v{info.currentVersion} → {info.tagName}</p>
      {info.notes &&
        <pre style={{whiteSpace: "pre-wrap", maxHeight: 220, overflow: "auto", fontFamily: "inherit"}}>
          {info.notes}
        </pre>
      }
      {status === updateStatus.DOWNLOADING &&
        <div>
          <Progress percent={progress.total ? Math.floor(progress.received / progress.total * 100) : 0}/>
          {t('update.downloading')} {toMB(progress.received)} / {toMB(progress.total || info.downloadSize)} MB
        </div>
      }
      {status === updateStatus.RESTARTING && <Alert type="success" showIcon message={t('update.restarting')}/>}
      {status === updateStatus.ERROR &&
        <Alert type="error" showIcon message={t('update.failed')} description={error}/>
      }
    </Modal>
  );
};

const mapStateToProps = (state) => {
  return {
    isAutoCheckUpdate: state.ConfigReducer.isAutoCheckUpdate,
    info: state.UpdateReducer.info,
    status: state.UpdateReducer.status,
    isModalOpen: state.UpdateReducer.isModalOpen,
    progress: state.UpdateReducer.progress,
    error: state.UpdateReducer.error
  }
}

export default connect(mapStateToProps)(withErrorBoundary(UpdateService));
