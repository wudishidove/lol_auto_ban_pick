import React, {useEffect, useState} from 'react';
import {Alert, Button, Checkbox, Col, Divider, Modal, Row, Segmented, Space, Tooltip, Typography} from "antd";
import {ImportOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';
import ApiUtils from "../../api/api-utils";
import {lanes} from "../../redux/reducers/ConfigReducer";
import {ANY_ENEMY, getProfileId, isCompletePerks} from "../../services/runeUtils";
import ChampionSelect from "./ChampionSelect";
import {RuneIcon} from "./RuneIcons";

const {Text} = Typography;

const emptyRunes = {primaryStyleId: null, subStyleId: null, primaryPerks: [0, 0, 0, 0], subPerks: [], shards: [0, 0, 0]};

// selectedPerkIds(6 或 9 個) 轉成編輯器狀態，副系要記住每個符文在第幾列
function toRunesState(runeData, primaryStyleId, subStyleId, perkIds) {
  const ids = perkIds ?? [];
  const pad = (list, length) => Array.from({length}, (_, index) => list[index] ?? 0);
  const subStyle = runeData.styles.find(style => style.id === subStyleId);
  const subPerks = ids.slice(4, 6)
    .map(id => ({rowIndex: subStyle?.rows.findIndex(row => row.includes(id)) ?? -1, id}))
    .filter(item => item.rowIndex >= 0);
  return {
    primaryStyleId: primaryStyleId ?? null,
    subStyleId: subStyleId ?? null,
    primaryPerks: pad(ids.slice(0, 4), 4),
    subPerks,
    shards: pad(ids.slice(6, 9), 3),
  };
}

function toSelectedPerkIds(runes) {
  const subIds = [...runes.subPerks].sort((a, b) => a.rowIndex - b.rowIndex).map(item => item.id);
  return [...runes.primaryPerks, ...subIds, ...runes.shards];
}

/**
 * 新增/編輯符文設定檔
 * draft: 預填內容，從對戰紀錄存檔時 selectedPerkIds 只有 6 個，屬性碎片由使用者補選
 * existingIds: 已存在的設定檔 id，用來提示存檔會覆蓋
 */
function RuneProfileEditor({open, draft, notice, existingIds, championOptions, runeData, onSave, onCancel}) {
  const {t} = useTranslation();
  const [lane, setLane] = useState(lanes[0]);
  const [championId, setChampionId] = useState(null);
  const [enemyChampionId, setEnemyChampionId] = useState(ANY_ENEMY);
  const [runes, setRunes] = useState(emptyRunes);
  const [pinned, setPinned] = useState(true);
  const [importError, setImportError] = useState('');

  useEffect(() => {
    if (!open) return;
    setLane(draft?.lane ?? lanes[0]);
    setChampionId(draft?.championId ?? null);
    setEnemyChampionId(draft?.enemyChampionId ?? ANY_ENEMY);
    setPinned(draft?.pinned ?? true);
    setImportError('');
    setRunes(runeData
      ? toRunesState(runeData, draft?.primaryStyleId, draft?.subStyleId, draft?.selectedPerkIds)
      : emptyRunes);
  }, [open, draft, runeData]);

  const importCurrentPage = async () => {
    try {
      const page = (await ApiUtils.getCurrentRunePage()).data;
      setRunes(toRunesState(runeData, page.primaryStyleId, page.subStyleId, page.selectedPerkIds));
      setImportError('');
    } catch (error) {
      setImportError(t('runes.editor.importFailed'));
    }
  };

  const primaryStyle = runeData?.styles.find(style => style.id === runes.primaryStyleId);
  const subStyle = runeData?.styles.find(style => style.id === runes.subStyleId);
  const perkOf = (id) => runeData.perks[id] ?? {id, name: String(id), iconUrl: ''};

  const changePrimaryStyle = (styleId) => {
    if (styleId === runes.primaryStyleId) return;
    setRunes({
      ...runes,
      primaryStyleId: styleId,
      primaryPerks: [0, 0, 0, 0],
      // 副系不能跟主系相同
      ...(runes.subStyleId === styleId ? {subStyleId: null, subPerks: []} : {}),
    });
  };

  const changeSubStyle = (styleId) => {
    if (styleId === runes.subStyleId) return;
    setRunes({...runes, subStyleId: styleId, subPerks: []});
  };

  const pickPrimaryPerk = (slotIndex, id) => {
    const primaryPerks = [...runes.primaryPerks];
    primaryPerks[slotIndex] = id;
    setRunes({...runes, primaryPerks});
  };

  // 副系只能選兩個且不同列，跟用戶端一樣: 同列直接換掉，選第三個時擠掉最早選的
  const pickSubPerk = (rowIndex, id) => {
    let subPerks = runes.subPerks.filter(item => item.rowIndex !== rowIndex);
    if (subPerks.length === 2) subPerks = subPerks.slice(1);
    setRunes({...runes, subPerks: [...subPerks, {rowIndex, id}]});
  };

  const pickShard = (rowIndex, id) => {
    const shards = [...runes.shards];
    shards[rowIndex] = id;
    setRunes({...runes, shards});
  };

  const selectedPerkIds = toSelectedPerkIds(runes);
  const isComplete = !!championId && !!runes.primaryStyleId && !!runes.subStyleId && isCompletePerks(selectedPerkIds);
  const profileId = championId ? getProfileId(lane, championId, enemyChampionId) : null;
  const willOverwrite = !!profileId && profileId !== draft?._id && (existingIds ?? []).includes(profileId);

  const save = () => {
    onSave({
      lane,
      championId,
      enemyChampionId: enemyChampionId ?? ANY_ENEMY,
      primaryStyleId: runes.primaryStyleId,
      subStyleId: runes.subStyleId,
      selectedPerkIds,
      pinned,
    });
  };

  const renderStyleRow = (styles, selectedId, onPick) => (
    <Space size={10} style={{marginBottom: 6}}>
      {styles.map(style => (
        <RuneIcon key={style.id} item={style} size={26}
                  isSelected={style.id === selectedId}
                  isDimmed={!!selectedId && style.id !== selectedId}
                  onClick={() => onPick(style.id)}/>
      ))}
    </Space>
  );

  // isRequired: 這一列一定要選一個(主系、碎片)；副系是三列選兩列，未選的列不標紅
  const renderPerkRow = (key, label, perkIds, isPicked, isDimmed, onPick, size, isRequired = true) => (
    <Row key={key} align="middle" style={{marginBottom: 5}}>
      <Col flex="52px">
        <Text type={!isRequired || perkIds.some(isPicked) ? "secondary" : "danger"} style={{fontSize: 12}}>{label}</Text>
      </Col>
      <Col flex="auto">
        <Space size={10}>
          {perkIds.map((id, index) => (
            <RuneIcon key={index} item={perkOf(id)} size={size}
                      isSelected={isPicked(id)} isDimmed={isDimmed(id)}
                      onClick={() => onPick(id)}/>
          ))}
        </Space>
      </Col>
    </Row>
  );

  const shardRows = runeData?.styles[0]?.shardRows ?? [];
  const shardLabels = [t('runes.editor.shardOffense'), t('runes.editor.shardFlex'), t('runes.editor.shardDefense')];

  return (
    <Modal open={open} width={700} centered title={draft?._id ? t('runes.editor.editTitle') : t('runes.editor.addTitle')}
           onCancel={onCancel} destroyOnClose maskClosable={false}
           footer={
             <Space style={{display: 'flex', justifyContent: 'space-between'}}>
               <Tooltip title={t('runes.pinHint')}>
                 <Checkbox checked={pinned} onChange={(event) => setPinned(event.target.checked)}>
                   {t('runes.pin')}
                 </Checkbox>
               </Tooltip>
               <Space>
                 <Button onClick={onCancel}>{t('runes.cancel')}</Button>
                 <Tooltip title={isComplete ? '' : t('runes.editor.incomplete')}>
                   <Button type="primary" disabled={!isComplete} onClick={save}>{t('runes.save')}</Button>
                 </Tooltip>
               </Space>
             </Space>
           }>
      <Space direction="vertical" size="small" style={{display: 'flex'}}>
        {notice && <Alert type="info" showIcon message={notice}/>}
        {!runeData && <Alert type="error" showIcon message={t('runes.runeDataFailed')}/>}

        <Space wrap size="small" align="center">
          <ChampionSelect value={championId} options={championOptions} style={{width: 140}}
                            placeholder={t('runes.editor.championPlaceholder')}
                            onChange={setChampionId}/>
          <Segmented value={lane} onChange={setLane} size="small"
                     options={lanes.map(item => ({value: item, label: t(`banPick.lanes.${item}`)}))}/>
          <Space size={6}>
            <Text>vs</Text>
            <ChampionSelect value={enemyChampionId} options={championOptions} style={{width: 150}}
                            extraOptions={[{value: ANY_ENEMY, label: t('runes.anyEnemyOption')}]}
                            onChange={(value) => setEnemyChampionId(value ?? ANY_ENEMY)}/>
          </Space>
        </Space>
        {willOverwrite && <Alert type="warning" showIcon message={t('runes.editor.willOverwrite')}/>}

        {runeData &&
          <>
            <Space>
              <Button size="small" icon={<ImportOutlined/>} onClick={importCurrentPage}>
                {t('runes.editor.importCurrent')}
              </Button>
              {importError && <Text type="danger">{importError}</Text>}
            </Space>
            <Row gutter={24}>
              <Col span={12}>
                <Divider orientation="left" plain style={{margin: '0 0 8px'}}>{t('runes.editor.primary')}</Divider>
                {renderStyleRow(runeData.styles, runes.primaryStyleId, changePrimaryStyle)}
                {primaryStyle && [primaryStyle.keystones, ...primaryStyle.rows].map((perkIds, slotIndex) =>
                  renderPerkRow(`primary-${slotIndex}`,
                    slotIndex === 0 ? t('runes.editor.keystone') : t('runes.editor.row', {index: slotIndex}),
                    perkIds,
                    (id) => runes.primaryPerks[slotIndex] === id,
                    (id) => !!runes.primaryPerks[slotIndex] && runes.primaryPerks[slotIndex] !== id,
                    (id) => pickPrimaryPerk(slotIndex, id),
                    slotIndex === 0 ? 36 : 28))}
                {!primaryStyle && <Text type="secondary">{t('runes.editor.pickPrimaryStyle')}</Text>}
              </Col>
              <Col span={12}>
                <Divider orientation="left" plain style={{margin: '0 0 8px'}}>
                  <Text type={runes.subPerks.length === 2 ? undefined : "danger"}>
                    {t('runes.editor.secondary')} ({runes.subPerks.length}/2)
                  </Text>
                </Divider>
                {renderStyleRow(runeData.styles.filter(style => style.id !== runes.primaryStyleId),
                  runes.subStyleId, changeSubStyle)}
                {subStyle && subStyle.rows.map((perkIds, rowIndex) =>
                  renderPerkRow(`sub-${rowIndex}`, t('runes.editor.row', {index: rowIndex + 1}),
                    perkIds,
                    (id) => runes.subPerks.some(item => item.id === id),
                    (id) => runes.subPerks.length === 2 && !runes.subPerks.some(item => item.id === id),
                    (id) => pickSubPerk(rowIndex, id),
                    28, false))}
                {!subStyle && <Text type="secondary">{t('runes.editor.pickSubStyle')}</Text>}

                <Divider orientation="left" plain style={{margin: '6px 0 8px'}}>{t('runes.editor.shards')}</Divider>
                {shardRows.map((perkIds, rowIndex) =>
                  renderPerkRow(`shard-${rowIndex}`, shardLabels[rowIndex] ?? '',
                    perkIds,
                    (id) => runes.shards[rowIndex] === id,
                    (id) => !!runes.shards[rowIndex] && runes.shards[rowIndex] !== id,
                    (id) => pickShard(rowIndex, id),
                    22))}
              </Col>
            </Row>
          </>}
      </Space>
    </Modal>
  );
}

export default RuneProfileEditor;
