import React, {useEffect} from 'react';
import {connect} from "react-redux";
import {Trans, useTranslation} from 'react-i18next';
import {Button, Checkbox, Space} from "antd";
import {updateStatus} from "../redux/reducers/UpdateReducer";
import {checkForUpdate, setUpdateState} from "../services/updateUtils";

const {ipcRenderer} = window.require('electron');
const _package = require("../../package.json");

function About(props) {
  const {t} = useTranslation();
  const latestVersion = props.updateInfo ? props.updateInfo.tagName : 'NaN';
  const releaseUrl = props.updateInfo ? props.updateInfo.releaseUrl : '';
  const hasUpdate = !!props.updateInfo?.hasUpdate;

  useEffect(() => {
    // 關閉自動檢查時，只有按下「檢查更新」才會連線
    if (props.isAutoCheckUpdate) checkForUpdate();
  }, []);

  const handleClickLink = (event, url) => {
    event.preventDefault();
    ipcRenderer.send('open-link', url);
  }

  return (
    <div>
      <div style={{textAlign: "center"}}>
        <h1 style={{fontSize: "26px"}}>{t('about.author')}:wudishidove</h1>
        <div style={{marginBottom: 10}}>
          <h3 style={{fontSize: "16px"}}>{t('about.currentVersion')}: v{_package.version}</h3>
          <h3 style={{fontSize: "16px"}}>{t('about.latestVersion')}: {latestVersion === 'NaN' ? 'NaN' :
            <a href="" onClick={(event) => {
              handleClickLink(event, releaseUrl)
            }}>{latestVersion}</a>}
          </h3>
          <Space direction="vertical" size="small">
            <Space>
              <Button size="small" loading={props.updateStatus === updateStatus.CHECKING}
                      onClick={() => checkForUpdate()}>{t('about.checkUpdate')}</Button>
              {hasUpdate &&
                <Button size="small" type="primary" onClick={() => setUpdateState({isModalOpen: true})}>
                  {t('about.updateNow')}
                </Button>
              }
              {props.updateInfo && !hasUpdate && props.updateStatus === updateStatus.IDLE &&
                <span>{t('about.upToDate')}</span>
              }
              {props.updateStatus === updateStatus.ERROR && !props.isUpdateModalOpen &&
                <span>{t('about.checkFailed')}</span>
              }
            </Space>
            <Checkbox checked={props.isAutoCheckUpdate}
                      onChange={(e) => props.changeConfigValues({isAutoCheckUpdate: e.target.checked})}>
              {t('about.autoCheckUpdate')}
            </Checkbox>
          </Space>
        </div>
        <p style={{fontSize: "16px"}}>
          <Trans i18nKey="about.help"></Trans>
          <br/>
          <a href="" style={{fontSize: "16px"}}
             onClick={(event) => {
               handleClickLink(event, 'https://github.com/wudishidove/lol_auto_accept2')
             }}>{t('about.github')}
          </a>
        </p>
        <p style={{fontSize: "14px", opacity: 0.75}}>
          {t('about.credit')}
          <a href=""
             onClick={(event) => handleClickLink(event, 'https://github.com/jasonwu1994/lol-auto-accept')}>
            jasonwu1994/lol-auto-accept
          </a>
        </p>
        <p style={{fontSize: "14px", opacity: 0.75, maxWidth: 560, margin: "20px auto 0", lineHeight: 1.6}}>
          {t('about.disclaimer')}
        </p>
      </div>
    </div>
  )
}

const mapStateToProps = (state) => {
  return {
    gameflowSession: state.GameReducer.gameflowSession,
    isAutoCheckUpdate: state.ConfigReducer.isAutoCheckUpdate,
    updateInfo: state.UpdateReducer.info,
    updateStatus: state.UpdateReducer.status,
    isUpdateModalOpen: state.UpdateReducer.isModalOpen
  }
}

const mapDispatchToProp = {
  changeConfigValues(data) {
    return {
      type: "change-configValues",
      data
    }
  }
}

export default connect(mapStateToProps, mapDispatchToProp)(About)