import ApiUtils from "../api/api-utils";
import {ANY_ENEMY, isCompleteSpells} from "./runeUtils";
import {log} from "./champSelectUtils";

// 本程式只會改寫「暫時頁 + 名稱以此開頭」的符文頁，使用者自己的符文頁一律不動
export const MANAGED_PAGE_PREFIX = 'AutoRune';
const PAGE_NAME_MAX_LENGTH = 25;

function getPageName(profile) {
  const championName = ApiUtils.getChampionNameById(profile.championId);
  const enemyName = profile.enemyChampionId !== ANY_ENEMY
    ? ` vs ${ApiUtils.getChampionNameById(profile.enemyChampionId)}` : '';
  return `${MANAGED_PAGE_PREFIX} ${championName}${enemyName}`.slice(0, PAGE_NAME_MAX_LENGTH);
}

/**
 * 把設定檔寫成用戶端的暫時符文頁(跟用戶端推薦符文用的是同一種頁)
 * 暫時頁不佔頁位，符文頁已滿(canAddCustomPage: false)也能建立；POST / PUT 之後會自動成為使用中的頁
 * 暫時頁不會互相頂掉，每 POST 一次就多一頁，所以已經有自己建的暫時頁時改用 PUT 原地改寫
 * (以上行為參考 wnzzer/rank-analysis 2026-09-15 的實機驗證；全程不 DELETE 任何頁)
 * @param {Object} profile 符文設定檔
 * @returns {Promise<Object>} 寫入後的符文頁
 */
export async function applyProfileToClient(profile) {
  const payload = {
    name: getPageName(profile),
    isTemporary: true,
    primaryStyleId: profile.primaryStyleId,
    subStyleId: profile.subStyleId,
    selectedPerkIds: profile.selectedPerkIds,
    current: true,
  };
  try {
    const pages = (await ApiUtils.getRunePages()).data ?? [];
    const ownPage = pages.find(isManagedPage);
    const response = ownPage
      ? await ApiUtils.putRunePage(ownPage.id, payload)
      : await ApiUtils.postRunePage(payload);
    log(`applyProfileToClient ${ownPage ? `updated page ${ownPage.id}` : `created page ${response.data?.id}`} with ${profile._id}`);
    await applySpells(profile);
    return response.data;
  } catch (error) {
    log(`applyProfileToClient failed: ${error?.response?.status} ${JSON.stringify(error?.response?.data ?? error?.message)}`);
    throw error;
  }
}

// 設定檔有記錄召喚師技能就一起換上；舊版設定檔沒有就不動
// 不在選角中(例如賽前在「符文」分頁手動套用)會失敗，符文已經寫好了，只記 log 不算套用失敗
async function applySpells(profile) {
  if (!isCompleteSpells(profile.spellIds)) return;
  const [spell1Id, spell2Id] = profile.spellIds.map(Number);
  try {
    await ApiUtils.patchChampSelectMySelection({spell1Id, spell2Id});
    log(`applySpells set spells ${spell1Id},${spell2Id} with ${profile._id}`);
  } catch (error) {
    log(`applySpells failed: ${error?.response?.status} ${JSON.stringify(error?.response?.data ?? error?.message)}`);
  }
}

export function isManagedPage(page) {
  return !!page?.isTemporary && !!page.name?.startsWith(MANAGED_PAGE_PREFIX);
}

/**
 * 把被用戶端推薦符文蓋掉的暫時頁改回原本的內容
 * 用戶端在選角最後幾秒會把推薦符文(頁名變成「英雄 - 基石」)原地寫進同一個暫時頁
 * @param {Object} page 被蓋掉前最後一次看到的頁，包含使用者在用戶端自己微調過的符文
 */
export async function restoreManagedPage(page) {
  const response = await ApiUtils.putRunePage(page.id, {
    name: page.name,
    isTemporary: true,
    primaryStyleId: page.primaryStyleId,
    subStyleId: page.subStyleId,
    selectedPerkIds: page.selectedPerkIds,
    current: true,
  });
  log(`restoreManagedPage restored page ${page.id} to ${JSON.stringify(page.selectedPerkIds)}`);
  return response.data;
}

// 顯示給使用者看的錯誤原因，例: "400 Invalid perk"
export function describeApplyError(error) {
  const status = error?.response?.status;
  const message = error?.response?.data?.message ?? error?.message ?? '';
  return [status, message].filter(Boolean).join(' ');
}
