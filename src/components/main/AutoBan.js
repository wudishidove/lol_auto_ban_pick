import React from 'react';
import {connect} from "react-redux";
import withErrorBoundary from "../error/withErrorBoundary";
import {Checkbox, Space, Switch, Typography} from "antd";
import {useTranslation} from 'react-i18next';

const {Text} = Typography;

// 主頁的快速開關，英雄清單在「選ban角」分頁設定
function AutoBan(props) {
  const {t} = useTranslation();

  return (
    <div>
      <Space direction="vertical" style={{display: 'flex'}}>
        <Space wrap>
          <label htmlFor="auto-ban-btn"
                 style={{userSelect: "none", fontSize: 16}}>{t('main.autoBan')}</label>
          <Switch id="auto-ban-btn" checked={props.isAutoBan}
                  onChange={(checked, event) => {
                    props.changeConfigValues({isAutoBan: checked})
                  }}/>
          <label htmlFor="auto-pick-intent-btn"
                 style={{userSelect: "none", fontSize: 16, marginLeft: 16}}>{t('main.autoPickIntent')}</label>
          <Switch id="auto-pick-intent-btn" checked={props.isAutoPickIntent}
                  onChange={(checked, event) => {
                    props.changeConfigValues({isAutoPickIntent: checked})
                  }}/>
          <Checkbox checked={props.isAutoPickLock} disabled={!props.isAutoPickIntent}
                    style={{userSelect: "none", fontSize: 16}}
                    onChange={(event) => {
                      props.changeConfigValues({isAutoPickLock: event.target.checked})
                    }}>
            {t('main.autoPickLock')}
          </Checkbox>
        </Space>
        <Text type="secondary" style={{marginLeft: 24}}>{t('main.banPickHint')}</Text>
      </Space>
    </div>
  )
}

const mapStateToProps = (state) => {
  return {
    isAutoBan: state.ConfigReducer.isAutoBan,
    isAutoPickIntent: state.ConfigReducer.isAutoPickIntent,
    isAutoPickLock: state.ConfigReducer.isAutoPickLock,
  }
}
const mapDispatchToProp = {
  changeConfigValues(data) {
    return {
      type: "change-configValues",
      data
    }
  },
}
export default connect(mapStateToProps, mapDispatchToProp)(withErrorBoundary(AutoBan))
