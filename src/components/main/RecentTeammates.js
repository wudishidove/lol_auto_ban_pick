import React, {useEffect} from 'react';
import {connect} from "react-redux";
import withErrorBoundary from "../error/withErrorBoundary";
import {Space, Switch, Col, InputNumber, Row, Slider} from "antd";
import {useTranslation} from 'react-i18next';


function RecentTeammates(props) {
  const {t} = useTranslation();

  useEffect(() => {
    if (!props.isHovercard) {
      return;
    }
  }, [props.isShowRecentTeammate]);

  return (
    <div>
      <Space direction="vertical" style={{display: 'flex'}}>
        <Space>
          <label htmlFor="recent-teammate-stats-btn"
                 style={{userSelect: "none", fontSize: 16}}>{t('main.displayRecentTeammate')}</label>
          <Switch id="recent-teammate-stats-btn" checked={props.isShowRecentTeammate}
                  onChange={(checked, event) => {
                    // console.log(checked, event)
                    props.changeIsShowRecentTeammate(checked)
                  }}/>
        </Space>
        <Space
          style={{
            width: '100%',
          }}
          direction="vertical"
        >
          <IntegerStep props={props}/>
        </Space>
      </Space>
    </div>
  )
}

const IntegerStep = ({props}) => {
  // 場數也給「對戰分析」、「對戰紀錄」用，所以不管聊天室功能有沒有開都能調；清空輸入框時不更新
  const onChange = (newValue) => {
    if (typeof newValue !== 'number') return;
    props.changeRecentTeammateCheckGameCount(newValue);
  };
  return (
    <Row>
      <Col span={5} offset="2">
        <Slider
          min={1}
          max={20}
          onChange={onChange}
          value={typeof props.recentTeammateCheckGameCount === 'number' ? props.recentTeammateCheckGameCount : 5}
        />
      </Col>
      <Col span={2}>
        <InputNumber
          min={1}
          max={20}
          style={{
            margin: '0 10px',
          }}
          value={props.recentTeammateCheckGameCount}
          onChange={onChange}
        />
      </Col>
    </Row>
  );
};

const mapStateToProps = (state) => {
  return {
    isShowRecentTeammate: state.ConfigReducer.isShowRecentTeammate,
    recentTeammateCheckGameCount: state.ConfigReducer.recentTeammateCheckGameCount,
  }
}

const mapDispatchToProp = {
  changeIsShowRecentTeammate(data) {
    return {
      type: "change-isShowRecentTeammate",
      data
    }
  },
  changeRecentTeammateCheckGameCount(data) {
    return {
      type: "change-recentTeammateCheckGameCount",
      data
    }
  },
}

export default connect(mapStateToProps, mapDispatchToProp)(withErrorBoundary(RecentTeammates))