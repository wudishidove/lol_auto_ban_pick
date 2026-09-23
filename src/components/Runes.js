import React, {useEffect, useState} from 'react';
import {connect} from "react-redux";
import {message, Tabs} from 'antd';
import {useTranslation} from 'react-i18next';
import withErrorBoundary from "./error/withErrorBoundary";
import useChampionOptions from "../hooks/useChampionOptions";
import useRuneData from "../hooks/useRuneData";
import RuneDatabase from "./common/RuneDatabase";
import {profileSource} from "../services/runeUtils";
import {applyProfileToClient, describeApplyError} from "../services/runeApplyUtils";
import RuneProfiles from "./runes/RuneProfiles";
import RecentMatches from "./runes/RecentMatches";
import RuneProfileEditor from "./runes/RuneProfileEditor";

const tabKey = Object.freeze({PROFILES: 'profiles', MATCHES: 'matches'});

function Runes(props) {
  const {t} = useTranslation();
  const {config} = props;
  const championOptions = useChampionOptions(config.language);
  const runeData = useRuneData(config.language);
  const [messageApi, messageHolder] = message.useMessage();
  const [activeTab, setActiveTab] = useState(tabKey.PROFILES);
  const [profiles, setProfiles] = useState([]);
  // 編輯器狀態，例: {draft, notice, source}，null 代表關閉
  const [editor, setEditor] = useState(null);

  useEffect(() => {
    const loadProfiles = () => RuneDatabase.getProfiles()
      .then(setProfiles)
      .catch(error => console.error('Runes loadProfiles failed', error));
    loadProfiles();
    // 自動記錄服務存檔時也要更新畫面
    return RuneDatabase.onProfileChange(loadProfiles);
  }, []);

  const saveProfile = async (values) => {
    const {draft, source} = editor;
    const saved = await RuneDatabase.saveProfile({...values, source, gameId: draft?.gameId});
    // 編輯時改了 英雄/路線/對位 等於搬到新的位置，舊的那份要刪掉
    if (draft?._id && draft._id !== saved._id) await RuneDatabase.deleteProfile(draft._id);
    setEditor(null);
    messageApi.success(t('runes.saved'));
  };

  const applyProfile = async (profile) => {
    try {
      await applyProfileToClient(profile);
      messageApi.success(t('runes.applied'));
      // 選角中手動挑了設定檔，這場就不再自動套用
      if (props.runeApplyState?.gameId) {
        props.changeRuneApplyState({...props.runeApplyState, profileId: profile._id, isManual: true, error: null});
      }
    } catch (error) {
      messageApi.error(`${t('runes.applyFailed')} (${describeApplyError(error)})`, 6);
    }
  };

  const openStarEditor = (match, existingProfile) => {
    // 對戰紀錄沒有屬性碎片，先帶入同英雄同路線既有設定檔的碎片，讓使用者確認或改選
    const reference = existingProfile
      ?? profiles.find(profile => profile.lane === match.lane && profile.championId === match.championId);
    const shards = reference?.selectedPerkIds.slice(6, 9) ?? [];
    setEditor({
      source: profileSource.HISTORY,
      notice: shards.length > 0 ? t('runes.matches.shardNoticePrefilled') : t('runes.matches.shardNotice'),
      draft: {
        lane: match.lane,
        championId: match.championId,
        enemyChampionId: match.enemyChampionId,
        primaryStyleId: match.primaryStyleId,
        subStyleId: match.subStyleId,
        selectedPerkIds: [...match.perkIds, ...shards],
        gameId: match.gameId,
        pinned: true,
      },
    });
  };

  const items = [
    {
      key: tabKey.PROFILES,
      label: t('runes.profilesTab'),
      children: (
        <RuneProfiles config={config} profiles={profiles} runeData={runeData} championOptions={championOptions}
                      runeApplyState={props.runeApplyState}
                      changeConfigValues={props.changeConfigValues}
                      onAdd={() => setEditor({source: profileSource.MANUAL, draft: null})}
                      onAddFor={(profile) => setEditor({
                        source: profileSource.MANUAL,
                        draft: {lane: profile.lane, championId: profile.championId},
                      })}
                      onEdit={(profile) => setEditor({source: profileSource.MANUAL, draft: profile})}
                      onDelete={(profile) => RuneDatabase.deleteProfile(profile._id)}
                      onTogglePin={(profile) => RuneDatabase.saveProfile({...profile, pinned: !profile.pinned})}
                      onApply={(profile) => applyProfile(profile)}
                      onGotoMatches={() => setActiveTab(tabKey.MATCHES)}/>
      ),
    },
    {
      key: tabKey.MATCHES,
      label: t('runes.matchesTab'),
      children: (
        <RecentMatches runeData={runeData} profiles={profiles} gamePhase={props.gamePhase}
                       authPort={props.authPort}
                       onStar={openStarEditor}
                       onUnstar={(profile) => RuneDatabase.deleteProfile(profile._id)}/>
      ),
    },
  ];

  return (
    <div>
      {messageHolder}
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={items}/>
      <RuneProfileEditor open={!!editor} draft={editor?.draft} notice={editor?.notice}
                         existingIds={profiles.map(profile => profile._id)}
                         championOptions={championOptions} runeData={runeData}
                         onSave={saveProfile} onCancel={() => setEditor(null)}/>
    </div>
  );
}

const mapStateToProps = (state) => {
  return {
    config: state.ConfigReducer,
    gamePhase: state.GameReducer.gamePhase,
    authPort: state.AuthReducer.auth?.port,
    runeApplyState: state.GameReducer.runeApplyState,
  }
}
const mapDispatchToProp = {
  changeConfigValues(data) {
    return {
      type: "change-configValues",
      data
    }
  },
  changeRuneApplyState(data) {
    return {
      type: "change-runeApplyState",
      data
    }
  }
}

export default connect(mapStateToProps, mapDispatchToProp)(withErrorBoundary(Runes))
