const {Content, Sider} = Layout;
import React, {useEffect} from 'react';
import {useSelector} from 'react-redux';
import {Layout, Menu, theme} from 'antd';
import {useTranslation} from 'react-i18next';
import {Routes, Route, useNavigate} from "react-router-dom";
import VisibleSwitch from "./VisibleSwitch";

const MyLayout = ({children}) => {
  const navigate = useNavigate();
  const {t} = useTranslation();
  const isNewVersionAvailable = useSelector(state => !!state.UpdateReducer.info?.hasUpdate);

  useEffect(() => {
    if (location.pathname === '/' || location.pathname.includes('index.html')) {
      navigate('/main', {replace: true});
    }
  }, [location, navigate]);

  const getItem = (label, key) => {
    return {
      key,
      label,
    };
  };

  const items = [
    getItem(t('menu.main'), '/main'),
    getItem(t('menu.matchAnalysis'), '/matchAnalysis'),
    getItem(t('menu.recentPlayers'), '/recentPlayers'),
    getItem(t('menu.banPick'), '/banPick'),
    getItem(t('menu.runes'), '/runes'),
    getItem(t('menu.aram'), '/aram'),
    getItem(isNewVersionAvailable ? "✨ " + t('menu.about') : t('menu.about'), '/about'),
  ];

  const {
    token: {colorBgContainer},
  } = theme.useToken();
  return (
    // 整個視窗固定高度，只讓右側內容區捲動，左側選單不會跟著滾輪一起動
    <Layout style={{height: '100vh', overflow: 'hidden'}}>
      <Sider width={120} style={{background: colorBgContainer, overflowY: 'auto'}}>
        <Menu
          mode="inline"
          defaultSelectedKeys={['/main']}
          defaultOpenKeys={['/main']}
          style={{
            height: '100%',
            borderRight: 0,
            userSelect: "none"
          }}
          items={items}
          onClick={(item) => {
            navigate(item.key)
          }}
        />
      </Sider>
      <Layout style={{padding: '0 24px 24px', overflowY: 'auto'}}>
        <Content
          style={{
            padding: 10,
            margin: 10,
            minHeight: "89vh",
            flexShrink: 0, // 在可捲動的容器中不要被壓縮，否則內容較長時背景只到一半
            background: colorBgContainer,
          }}
        >
          {children}
          <Routes>
            <Route path="/*" element={<VisibleSwitch/>}/>
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

export default MyLayout;