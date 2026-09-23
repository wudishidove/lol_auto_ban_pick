import PouchDB from 'pouchdb';
import {getProfileId} from "../../services/runeUtils";

const PENDING_PREFIX = 'pending:';
const MATCH_PREFIX = 'match:';
const MATCH_CACHE_LIMIT = 60;

/**
 * 符文設定檔資料庫
 * 設定檔: {_id: 'top:777:80', lane, championId, enemyChampionId, primaryStyleId, subStyleId,
 *          selectedPerkIds: [9 個], source, pinned, gameId, updatedAt}
 * 待補對位的紀錄: {_id: 'pending:<gameId>', ...}，進遊戲時先記下符文，賽後從對戰紀錄補上路線與對位
 * 對戰摘要快取: {_id: 'match:<puuid>:<gameId>', summary}，每場的詳細資料只需要跟用戶端要一次
 */
class RuneDatabase {
  static dbInstance = null;

  static getDB() {
    if (!this.dbInstance) {
      this.dbInstance = new PouchDB('runeProfiles');
    }
    return this.dbInstance;
  }

  static async getDoc(id) {
    try {
      return await this.getDB().get(id);
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
  }

  static async getAllDocs() {
    const result = await this.getDB().allDocs({include_docs: true});
    return result.rows.map(row => row.doc);
  }

  static async getProfiles() {
    const docs = await this.getAllDocs();
    return docs.filter(doc => !doc._id.startsWith(PENDING_PREFIX) && !doc._id.startsWith(MATCH_PREFIX));
  }

  static getProfile(lane, championId, enemyChampionId) {
    return this.getDoc(getProfileId(lane, championId, enemyChampionId));
  }

  // 同一組 路線+英雄+對位 只留一份，已存在就覆蓋
  static async saveProfile(profile) {
    const _id = getProfileId(profile.lane, profile.championId, profile.enemyChampionId);
    const existing = await this.getDoc(_id);
    const doc = {
      ...profile,
      _id,
      championId: Number(profile.championId),
      enemyChampionId: Number(profile.enemyChampionId) || 0,
      updatedAt: Date.now(),
    };
    delete doc._rev;
    if (existing) doc._rev = existing._rev;
    await this.getDB().put(doc);
    return doc;
  }

  static async deleteProfile(id) {
    const existing = await this.getDoc(id);
    if (existing) await this.getDB().remove(existing);
  }

  static async getPendingRecords() {
    const docs = await this.getAllDocs();
    return docs.filter(doc => doc._id.startsWith(PENDING_PREFIX));
  }

  static async savePendingRecord(record) {
    const _id = `${PENDING_PREFIX}${record.gameId}`;
    const existing = await this.getDoc(_id);
    await this.getDB().put({...record, _id, ...(existing ? {_rev: existing._rev} : {})});
  }

  static async deletePendingRecord(gameId) {
    const existing = await this.getDoc(`${PENDING_PREFIX}${gameId}`);
    if (existing) await this.getDB().remove(existing);
  }

  // summary 為 null 代表這場不是分路模式，一樣要記住，下次才不會又去抓詳細資料
  static async getMatchSummaries(puuid) {
    const result = await this.getDB().allDocs({
      include_docs: true, startkey: `${MATCH_PREFIX}${puuid}:`, endkey: `${MATCH_PREFIX}${puuid}:\ufff0`,
    });
    return new Map(result.rows.map(row => [row.doc.gameId, row.doc]));
  }

  static async saveMatchSummary(puuid, gameId, gameCreation, summary) {
    const _id = `${MATCH_PREFIX}${puuid}:${gameId}`;
    const existing = await this.getDoc(_id);
    await this.getDB().put({_id, gameId, gameCreation, summary, ...(existing ? {_rev: existing._rev} : {})});
  }

  // 只留最近的幾場
  static async trimMatchSummaries(puuid) {
    const docs = [...(await this.getMatchSummaries(puuid)).values()]
      .sort((a, b) => b.gameCreation - a.gameCreation)
      .slice(MATCH_CACHE_LIMIT);
    if (docs.length > 0) await this.getDB().bulkDocs(docs.map(doc => ({...doc, _deleted: true})));
  }

  // 設定檔有變動時通知，回傳取消監聽的函式
  static onProfileChange(callback) {
    const changes = this.getDB().changes({since: 'now', live: true}).on('change', change => {
      if (!change.id.startsWith(PENDING_PREFIX) && !change.id.startsWith(MATCH_PREFIX)) callback();
    });
    return () => changes.cancel();
  }
}

export default RuneDatabase;
