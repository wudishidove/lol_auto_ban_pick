// 符文與召喚師技能的名稱、圖示與各系的欄位配置，來源是 CommunityDragon，不需要開著用戶端也能顯示
// 用 fetch 而不是 axios，避免把 axios 預設帶的 LCU Authorization 標頭送到外部網站
const BASE_URL = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global';

const slotType = Object.freeze({
  KEYSTONE: 'kKeyStone',
  REGULAR: 'kMixedRegularSplashable',
  SHARD: 'kStatMod',
});

// 召喚峽谷(一般/積分)可選的召喚師技能才列出
const CLASSIC_GAME_MODE = 'CLASSIC';

const cache = {};

// 例: /lol-game-data/assets/v1/perk-images/Styles/7201_Precision.png
function toIconUrl(iconPath) {
  return `${BASE_URL}/default${(iconPath ?? '').replace('/lol-game-data/assets', '').toLowerCase()}`;
}

async function fetchJson(locale, file) {
  const response = await fetch(`${BASE_URL}/${locale}/v1/${file}`);
  if (!response.ok) throw new Error(`fetch ${file} failed: ${response.status}`);
  return response.json();
}

/**
 * @param {string} language i18n 的語言，'zh' 或 'en'
 * @returns {Promise<{perks: Object, styles: Array, spells: Object, classicSpellIds: Array}>}
 *   perks: {id: {id, name, iconUrl}}
 *   styles: [{id, name, iconUrl, allowedSubStyles, keystones: [id], rows: [[id]x3], shardRows: [[id]x3]}]
 *   spells: {id: {id, name, iconUrl}}，召喚師技能
 *   classicSpellIds: 召喚峽谷可選的召喚師技能 id
 */
export async function getRuneData(language) {
  const locale = language === 'en' ? 'default' : 'zh_tw';
  if (!cache[locale]) {
    cache[locale] = Promise.all([fetchJson(locale, 'perks.json'), fetchJson(locale, 'perkstyles.json'),
      fetchJson(locale, 'summoner-spells.json')])
      .then(([perkList, styleData, spellList]) => {
        const perks = {};
        perkList.forEach(perk => {
          perks[perk.id] = {id: perk.id, name: perk.name, iconUrl: toIconUrl(perk.iconPath)};
        });
        const styles = styleData.styles.map(style => {
          const slotsOf = (type) => style.slots.filter(slot => slot.type === type).map(slot => slot.perks);
          return {
            id: style.id,
            name: style.name,
            iconUrl: toIconUrl(style.iconPath),
            allowedSubStyles: style.allowedSubStyles,
            keystones: slotsOf(slotType.KEYSTONE)[0] ?? [],
            rows: slotsOf(slotType.REGULAR),
            shardRows: slotsOf(slotType.SHARD),
          };
        }).sort((a, b) => a.id - b.id);
        const spells = {};
        spellList.filter(spell => spell.id > 0 && spell.name).forEach(spell => {
          spells[spell.id] = {id: spell.id, name: spell.name, iconUrl: toIconUrl(spell.iconPath)};
        });
        const classicSpellIds = spellList
          .filter(spell => spell.name && (spell.gameModes ?? []).includes(CLASSIC_GAME_MODE))
          .map(spell => spell.id);
        return {perks, styles, spells, classicSpellIds};
      })
      .catch(error => {
        delete cache[locale]; // 失敗不快取，下次重抓
        throw error;
      });
  }
  return cache[locale];
}
