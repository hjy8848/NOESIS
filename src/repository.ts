import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { Thought, ThoughtStatus, ThoughtType } from './types';

let database: Promise<SQLite.SQLiteDatabase> | undefined;

function openDatabase() {
  if (!database) {
    const opening=initialize();
    database=opening;
    opening.catch(()=>{if(database===opening) database=undefined;});
  }
  return database;
}

async function initialize() {
  const db = await SQLite.openDatabaseAsync('noesis.db');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  const version = (await db.getFirstAsync<{user_version: number}>('PRAGMA user_version'))?.user_version ?? 0;
  if (version > 4) throw new Error('数据库由更新版本的 NOESIS 创建，无法打开');
  if (version < 1) await db.withTransactionAsync(async () => { await db.execAsync(`
    CREATE TABLE IF NOT EXISTS thoughts (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '', type TEXT NOT NULL, status TEXT NOT NULL,
      createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, deletedAt TEXT
    );
    CREATE TABLE IF NOT EXISTS decks (id TEXT PRIMARY KEY, name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '', coverStyle TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL DEFAULT '#88755d', createdAt TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS deck_thoughts (deckId TEXT NOT NULL REFERENCES decks(id),
      thoughtId TEXT NOT NULL REFERENCES thoughts(id), PRIMARY KEY(deckId, thoughtId));
    CREATE TABLE IF NOT EXISTS relations (id TEXT PRIMARY KEY,
      sourceThoughtId TEXT NOT NULL REFERENCES thoughts(id),
      targetThoughtId TEXT NOT NULL REFERENCES thoughts(id), relationType TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '');
    CREATE TABLE IF NOT EXISTS sources (id TEXT PRIMARY KEY, title TEXT NOT NULL,
      type TEXT NOT NULL, content TEXT NOT NULL DEFAULT '', url TEXT NOT NULL DEFAULT '', createdAt TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS citations (id TEXT PRIMARY KEY, thoughtId TEXT NOT NULL REFERENCES thoughts(id),
      sourceId TEXT NOT NULL REFERENCES sources(id), excerpt TEXT NOT NULL DEFAULT '', location TEXT NOT NULL DEFAULT '');
    CREATE TABLE IF NOT EXISTS revisions (id TEXT PRIMARY KEY, thoughtId TEXT NOT NULL REFERENCES thoughts(id),
      previousContent TEXT NOT NULL, newContent TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '', createdAt TEXT NOT NULL);
    PRAGMA user_version = 1;`); });
  if (version < 2) await db.withTransactionAsync(async () => { await db.execAsync(`
    ALTER TABLE decks ADD COLUMN updatedAt TEXT;
    ALTER TABLE decks ADD COLUMN deletedAt TEXT;
    UPDATE decks SET updatedAt = createdAt WHERE updatedAt IS NULL;
    CREATE TABLE thought_tags (thoughtId TEXT NOT NULL REFERENCES thoughts(id), tag TEXT NOT NULL, PRIMARY KEY(thoughtId, tag));
    CREATE TABLE favorites (thoughtId TEXT PRIMARY KEY REFERENCES thoughts(id));
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    PRAGMA user_version = 2;`); });
  if (version < 3) await db.withTransactionAsync(async () => { await db.execAsync(`
    ALTER TABLE thoughts ADD COLUMN syncStatus TEXT NOT NULL DEFAULT 'pending';
    ALTER TABLE decks ADD COLUMN syncStatus TEXT NOT NULL DEFAULT 'pending';
    PRAGMA user_version = 3;`); });
  if (version < 4) await db.withTransactionAsync(async () => { await db.execAsync(`
    ALTER TABLE relations ADD COLUMN updatedAt TEXT;
    ALTER TABLE relations ADD COLUMN deletedAt TEXT;
    ALTER TABLE relations ADD COLUMN syncStatus TEXT NOT NULL DEFAULT 'pending';
    UPDATE relations SET updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now');
    PRAGMA user_version = 4;`); });
  return db;
}

export type ImportCard = {id?: string; title?: string; summary?: string; content?: string; type?: ThoughtType; status?: ThoughtStatus; tags?: string[]; decks?: string[]};
async function importCardsImpl(items: ImportCard[]) {
  // Validate the entire batch before applying it.
  for (const item of items) {
    if ((item.title !== undefined && (typeof item.title !== 'string' || !item.title.trim())) || (item.summary !== undefined && typeof item.summary !== 'string') || (item.content !== undefined && typeof item.content !== 'string') || (item.type !== undefined && !['proposition', 'concept', 'source'].includes(item.type)) || (item.status !== undefined && !['exploring', 'formed', 'supported', 'challenged', 'revised'].includes(item.status)) || (item.id !== undefined && typeof item.id !== 'string') || (item.tags !== undefined && (!Array.isArray(item.tags) || item.tags.some(t=>typeof t !== 'string'))) || (item.decks !== undefined && (!Array.isArray(item.decks) || item.decks.some(t=>typeof t !== 'string')))) throw new Error('卡片字段、类型或状态无效');
  }
  const ids = items.map(i => i.id).filter(Boolean);
  if (new Set(ids).size !== ids.length) throw new Error('文件中存在重复 ID');
  const db = await openDatabase();
  await db.withTransactionAsync(async () => {
    for (const item of items) {
      const id = item.id || Crypto.randomUUID();
      const now = new Date().toISOString();
      const previous = await db.getFirstAsync<Thought>('SELECT * FROM thoughts WHERE id=?', id);
      const title=item.title ?? previous?.title;
      if (!title) throw new Error(`新卡片 ${id} 缺少标题`);
      const summary=item.summary ?? previous?.summary ?? '';
      const content=item.content ?? previous?.content ?? '';
      const type=item.type ?? previous?.type ?? 'proposition';
      const status=item.status ?? previous?.status ?? 'exploring';
      if (previous) {
        if (previous.deletedAt) throw new Error(`ID ${id} 属于已删除的卡片，无法导入`);
        if (previous.content !== content) await db.runAsync('INSERT INTO revisions VALUES (?, ?, ?, ?, ?, ?)', Crypto.randomUUID(), id, previous.content, content, '批量导入', now);
        await db.runAsync("UPDATE thoughts SET title=?, summary=?, content=?, type=?, status=?, updatedAt=?, syncStatus='pending' WHERE id=?", title, summary, content, type, status, now, id);
      } else await db.runAsync('INSERT INTO thoughts (id,title,summary,content,type,status,createdAt,updatedAt,deletedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)', id, title, summary, content, type, status, now, now);
      if (item.tags) {
        await db.runAsync('DELETE FROM thought_tags WHERE thoughtId=?',id);
        for (const tag of new Set(item.tags.map(t=>t.trim()).filter(Boolean))) await db.runAsync('INSERT INTO thought_tags VALUES (?,?)',id,tag);
      }
      if (item.decks) {
        await db.runAsync('DELETE FROM deck_thoughts WHERE thoughtId=? AND deckId IN (SELECT id FROM decks WHERE deletedAt IS NULL)',id);
        for (const name of new Set(item.decks.map(t=>t.trim()).filter(Boolean))) {
          const matches=await db.getAllAsync<{id:string}>('SELECT id FROM decks WHERE name=? AND deletedAt IS NULL',name);
          if (matches.length>1) throw new Error(`牌组名称“${name}”不唯一，请先重命名`);
          const deckId=matches[0]?.id || Crypto.randomUUID();
          if (!matches.length) await db.runAsync('INSERT INTO decks (id,name,description,coverStyle,color,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)',deckId,name,'','','#88755d',now,now);
          await db.runAsync('INSERT INTO deck_thoughts VALUES (?,?)',deckId,id);
        }
      }
    }
  });
}

async function initializeDemoImpl() {
  const entries: Array<[string,ThoughtType,string]> = [
    ['深情叙事的自我中心性','proposition','深情叙事有时可能把自己的付出置于对方感受之前。'],
    ['道德优越感','concept','从道德判断中获得高于他人的自我评价。'],['审美与认知优越感','concept','以品味或知识区分自己与他人的心理倾向。'],
    ['自我凝视','concept','把自己的行为、感受和形象作为持续观察的对象。'],['自我客体化','concept','从外部观察者的视角看待自己。'],
    ['社会规训','concept','社会规范如何塑造个人行为与自我理解。'],['人的主体性','concept','个人作为行动者理解和决定自身生活的能力。'],
    ['欲望与社会规范','proposition','个人欲望的形成与表达受到社会规范影响。'],['亲密关系中的自由','proposition','亲密关系中的连接与自主需要持续协商。'],
    ['他人的目光与自我价值','proposition','他人的评价可能影响个人对自身价值的理解。'],['《人性的枷锁》','source','毛姆的小说，涉及欲望、成长与自我认识。'],
    ['《包法利夫人》','source','福楼拜的小说，涉及欲望、幻想与社会生活。'],['《禁闭》','source','萨特的戏剧，涉及他人的目光与自我认识。'],
    ['阿德勒','source','心理学家，其思想涉及自卑感与社会关系。'],['萨特','source','哲学家，关注自由、主体性与他人。']
  ];
  const db = await openDatabase();
  const existing = await db.getFirstAsync<{count:number}>('SELECT COUNT(*) AS count FROM thoughts');
  if (existing && existing.count > 0) throw new Error('演示数据只可在从未使用过的空牌库中初始化');
  await db.withTransactionAsync(async()=>{
    const ids: Record<string,string> = {};
    for (const [title,type,summary] of entries) { const id=Crypto.randomUUID(); ids[title]=id; const now=new Date().toISOString(); await db.runAsync('INSERT INTO thoughts (id,title,summary,content,type,status,createdAt,updatedAt,deletedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)',id,title,summary,'',type,'exploring',now,now); }
    for (const [a,b,t] of [['自我客体化','自我凝视','related'],['社会规训','欲望与社会规范','explains'],['《禁闭》','他人的目光与自我价值','related'],['萨特','人的主体性','related'],['亲密关系中的自由','人的主体性','related']]) await db.runAsync('INSERT INTO relations (id,sourceThoughtId,targetThoughtId,relationType,description,updatedAt) VALUES (?, ?, ?, ?, ?, ?)',Crypto.randomUUID(),ids[a],ids[b],t,'',new Date().toISOString());
  });
}

async function listThoughtsImpl(): Promise<Thought[]> {
  return (await openDatabase()).getAllAsync<Thought>('SELECT * FROM thoughts WHERE deletedAt IS NULL ORDER BY updatedAt DESC');
}

async function saveThoughtImpl(input: { id?: string; title: string; summary: string; content: string; type: ThoughtType; status: ThoughtStatus; tags?: string[]; deckIds?: string[] }, reason = '') {
  const db = await openDatabase();
  const id = input.id || Crypto.randomUUID();
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    const previous = await db.getFirstAsync<Thought>('SELECT * FROM thoughts WHERE id = ?', id);
    if (previous) {
      if (previous.content !== input.content) {
        await db.runAsync('INSERT INTO revisions VALUES (?, ?, ?, ?, ?, ?)', Crypto.randomUUID(), id, previous.content, input.content, reason, now);
      }
      await db.runAsync("UPDATE thoughts SET title=?, summary=?, content=?, type=?, status=?, updatedAt=?, syncStatus='pending' WHERE id=?", input.title, input.summary, input.content, input.type, input.status, now, id);
    } else {
      await db.runAsync('INSERT INTO thoughts (id,title,summary,content,type,status,createdAt,updatedAt,deletedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)', id, input.title, input.summary, input.content, input.type, input.status, now, now);
    }
    if (input.tags) {
      await db.runAsync('DELETE FROM thought_tags WHERE thoughtId=?', id);
      for (const tag of new Set(input.tags.map(t=>t.trim()).filter(Boolean))) await db.runAsync('INSERT INTO thought_tags VALUES (?,?)',id,tag);
    }
    if (input.deckIds) {
      const deckIds=[...new Set(input.deckIds)];
      for (const deckId of deckIds) if (!await db.getFirstAsync('SELECT id FROM decks WHERE id=? AND deletedAt IS NULL',deckId)) throw new Error('所选牌组不存在或已删除');
      await db.runAsync('DELETE FROM deck_thoughts WHERE thoughtId=? AND deckId IN (SELECT id FROM decks WHERE deletedAt IS NULL)',id);
      for (const deckId of deckIds) await db.runAsync('INSERT INTO deck_thoughts VALUES (?,?)',deckId,id);
    }
  });
  return id;
}

async function deleteThoughtImpl(id: string) {
  const now = new Date().toISOString();
  await (await openDatabase()).runAsync("UPDATE thoughts SET deletedAt=?, updatedAt=?, syncStatus='pending' WHERE id=?", now, now, id);
}

export type Deck = { id: string; name: string; description: string; coverStyle: string; color: string; createdAt: string; updatedAt: string; deletedAt: string | null; syncStatus: 'pending' | 'synced'; cardCount?: number };
export type Relation = { id: string; sourceThoughtId: string; targetThoughtId: string; relationType: string; description: string; updatedAt:string; deletedAt:string|null; syncStatus:'pending'|'synced' };
export type Revision = { id: string; thoughtId: string; previousContent: string; newContent: string; reason: string; createdAt: string };
export type Source = { id:string; title:string; type:string; content:string; url:string; createdAt:string };
export type Citation = { id:string; thoughtId:string; sourceId:string; excerpt:string; location:string };
async function listSourcesImpl() { return (await openDatabase()).getAllAsync<Source>('SELECT * FROM sources ORDER BY createdAt DESC'); }
async function saveSourceImpl(source: {id?:string; title:string; type:string; content:string; url:string}) {
  const db=await openDatabase();
  if (source.id) await db.runAsync('UPDATE sources SET title=?,type=?,content=?,url=? WHERE id=?',source.title,source.type,source.content,source.url,source.id);
  else await db.runAsync('INSERT INTO sources VALUES (?,?,?,?,?,?)',Crypto.randomUUID(),source.title,source.type,source.content,source.url,new Date().toISOString());
}
async function listCitationsImpl(thoughtId:string) { return (await openDatabase()).getAllAsync<Citation>('SELECT * FROM citations WHERE thoughtId=?',thoughtId); }
async function addCitationImpl(thoughtId:string,sourceId:string,excerpt:string,location:string) { await (await openDatabase()).runAsync('INSERT INTO citations VALUES (?,?,?,?,?)',Crypto.randomUUID(),thoughtId,sourceId,excerpt,location); }
async function removeCitationImpl(id:string) { await (await openDatabase()).runAsync('DELETE FROM citations WHERE id=?',id); }
async function listDecksImpl() { return (await openDatabase()).getAllAsync<Deck>('SELECT d.*, (SELECT COUNT(*) FROM deck_thoughts dt JOIN thoughts t ON t.id=dt.thoughtId WHERE dt.deckId=d.id AND t.deletedAt IS NULL) AS cardCount FROM decks d WHERE d.deletedAt IS NULL ORDER BY d.createdAt DESC'); }
async function createDeckImpl(name: string, description: string) {
  const now = new Date().toISOString();
  await (await openDatabase()).runAsync('INSERT INTO decks (id, name, description, coverStyle, color, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)', Crypto.randomUUID(), name, description, '', '#88755d', now, now);
}
async function updateDeckImpl(id: string, name: string, description: string, color: string) { await (await openDatabase()).runAsync("UPDATE decks SET name=?, description=?, color=?, updatedAt=?, syncStatus='pending' WHERE id=? AND deletedAt IS NULL", name, description, color, new Date().toISOString(), id); }
async function deleteDeckImpl(id: string) { const now=new Date().toISOString(); await (await openDatabase()).runAsync("UPDATE decks SET deletedAt=?, updatedAt=?, syncStatus='pending' WHERE id=?",now,now,id); }
async function listFavoritesImpl() { return (await openDatabase()).getAllAsync<{thoughtId:string}>('SELECT thoughtId FROM favorites'); }
async function setFavoriteImpl(id: string, favorite: boolean) { const db=await openDatabase(); if (favorite) await db.runAsync('INSERT OR IGNORE INTO favorites VALUES (?)',id); else await db.runAsync('DELETE FROM favorites WHERE thoughtId=?',id); }
async function listTagsImpl(id: string) { return (await openDatabase()).getAllAsync<{tag:string}>('SELECT tag FROM thought_tags WHERE thoughtId=? ORDER BY tag',id); }
async function setTagsImpl(id: string, tags: string[]) { const db=await openDatabase(); await db.withTransactionAsync(async()=>{await db.runAsync('DELETE FROM thought_tags WHERE thoughtId=?',id); for(const tag of new Set(tags.map(t=>t.trim()).filter(Boolean))) await db.runAsync('INSERT INTO thought_tags VALUES (?,?)',id,tag);}); }
async function getSettingImpl(key: string) { return (await openDatabase()).getFirstAsync<{value:string}>('SELECT value FROM settings WHERE key=?',key); }
async function setSettingImpl(key: string, value: string) { await (await openDatabase()).runAsync('INSERT OR REPLACE INTO settings VALUES (?,?)',key,value); }
async function deckMembersImpl(deckId: string) { return (await openDatabase()).getAllAsync<{thoughtId: string}>('SELECT thoughtId FROM deck_thoughts WHERE deckId=?', deckId); }
async function thoughtDecksImpl(id: string) { return (await openDatabase()).getAllAsync<Deck>('SELECT d.* FROM decks d JOIN deck_thoughts dt ON dt.deckId=d.id WHERE dt.thoughtId=? AND d.deletedAt IS NULL ORDER BY d.name',id); }
async function setDeckMemberImpl(deckId: string, thoughtId: string, member: boolean) {
  const db = await openDatabase();
  if (member) await db.runAsync('INSERT OR IGNORE INTO deck_thoughts VALUES (?, ?)', deckId, thoughtId);
  else await db.runAsync('DELETE FROM deck_thoughts WHERE deckId=? AND thoughtId=?', deckId, thoughtId);
}
async function listRelationsImpl() { return (await openDatabase()).getAllAsync<Relation>('SELECT * FROM relations WHERE deletedAt IS NULL'); }
async function addRelationImpl(source: string, target: string, type: string) {
  if (source === target) throw new Error('不能关联同一张卡片');
  await (await openDatabase()).runAsync('INSERT INTO relations (id,sourceThoughtId,targetThoughtId,relationType,description,updatedAt) VALUES (?, ?, ?, ?, ?, ?)', Crypto.randomUUID(), source, target, type, '',new Date().toISOString());
}
async function removeRelationImpl(id: string) { const now=new Date().toISOString(); await (await openDatabase()).runAsync("UPDATE relations SET deletedAt=?, updatedAt=?, syncStatus='pending' WHERE id=?",now,now,id); }
async function listRevisionsImpl(id: string) { return (await openDatabase()).getAllAsync<Revision>('SELECT * FROM revisions WHERE thoughtId=? ORDER BY createdAt DESC', id); }

async function loadLibraryImpl() {
  const db=await openDatabase();
  const thoughts=await db.getAllAsync<Thought>('SELECT * FROM thoughts WHERE deletedAt IS NULL ORDER BY updatedAt DESC');
  const decks=await db.getAllAsync<Deck>('SELECT d.*, (SELECT COUNT(*) FROM deck_thoughts dt JOIN thoughts t ON t.id=dt.thoughtId WHERE dt.deckId=d.id AND t.deletedAt IS NULL) AS cardCount FROM decks d WHERE d.deletedAt IS NULL ORDER BY d.createdAt DESC');
  const relations=await db.getAllAsync<Relation>('SELECT * FROM relations WHERE deletedAt IS NULL');
  const favorites=await db.getAllAsync<{thoughtId:string}>('SELECT thoughtId FROM favorites');
  const sources=await db.getAllAsync<Source>('SELECT * FROM sources ORDER BY createdAt DESC');
  return {thoughts,decks,relations,favorites:favorites.map(row=>row.thoughtId),sources};
}
async function databaseInfoImpl() {
  const db=await openDatabase();
  const version=await db.getFirstAsync<{user_version:number}>('PRAGMA user_version');
  const pages=await db.getFirstAsync<{page_count:number}>('PRAGMA page_count');
  const pageSize=await db.getFirstAsync<{page_size:number}>('PRAGMA page_size');
  return {version:version?.user_version ?? 0,bytes:(pages?.page_count ?? 0)*(pageSize?.page_size ?? 0)};
}
async function exportCardsDataImpl() {
  const db=await openDatabase();
  const thoughts=await db.getAllAsync<Thought>('SELECT * FROM thoughts WHERE deletedAt IS NULL ORDER BY createdAt');
  const tags=await db.getAllAsync<{thoughtId:string;tag:string}>('SELECT thoughtId,tag FROM thought_tags ORDER BY tag');
  const memberships=await db.getAllAsync<{thoughtId:string;name:string}>('SELECT dt.thoughtId,d.name FROM deck_thoughts dt JOIN decks d ON d.id=dt.deckId WHERE d.deletedAt IS NULL ORDER BY d.name');
  return thoughts.map(thought=>({thought,tags:tags.filter(t=>t.thoughtId===thought.id).map(t=>t.tag),decks:memberships.filter(d=>d.thoughtId===thought.id).map(d=>d.name)}));
}

const tables = ['thoughts', 'decks', 'deck_thoughts', 'relations', 'sources', 'citations', 'revisions', 'thought_tags', 'favorites', 'settings'] as const;
async function exportBackupImpl() {
  const db = await openDatabase();
  const data: Record<string, unknown> = {};
  for (const table of tables) data[table] = await db.getAllAsync(`SELECT * FROM ${table}`);
  return JSON.stringify({ format: 'noesis-backup', version: 4, exportedAt: new Date().toISOString(), data }, null, 2);
}
async function restoreBackupImpl(text: string) {
  const backup = JSON.parse(text);
  if (backup.format !== 'noesis-backup' || ![1,2,3,4].includes(backup.version) || !backup.data) throw new Error('不是有效的 NOESIS 备份');
  if (backup.version === 1) {
    for (const table of ['thought_tags','favorites','settings']) backup.data[table]=[];
    if (Array.isArray(backup.data.decks)) for (const row of backup.data.decks) { row.updatedAt=row.createdAt; row.deletedAt=null; }
  }
  if (backup.version < 3) for (const table of ['thoughts','decks']) if (Array.isArray(backup.data[table])) for (const row of backup.data[table]) row.syncStatus='pending';
  if (backup.version < 4 && Array.isArray(backup.data.relations)) for (const row of backup.data.relations) {row.updatedAt=backup.exportedAt || new Date().toISOString();row.deletedAt=null;row.syncStatus='pending';}
  if (tables.some(t => !Array.isArray(backup.data[t]))) throw new Error('备份缺少数据表');
  if (backup.data.thoughts.some((row:Thought)=>!row || typeof row.title !== 'string' || !row.title.trim() || !['proposition','concept','source'].includes(row.type) || !['exploring','formed','supported','challenged','revised'].includes(row.status))) throw new Error('备份中包含无效的卡片');
  if (backup.data.relations.some((row:Relation)=>!row || !['supports','contradicts','explains','causes','extends','related'].includes(row.relationType))) throw new Error('备份中包含无效的关系类型');
  const db = await openDatabase();
  // Validate column names against our schema, and bind every value as data.
  await db.withTransactionAsync(async () => {
    for (const table of [...tables].reverse()) await db.runAsync(`DELETE FROM ${table}`);
    for (const table of tables) {
      const columns = (await db.getAllAsync<{name: string}>(`PRAGMA table_info(${table})`)).map(c => c.name);
      for (const row of backup.data[table]) {
        if (!row || typeof row !== 'object' || columns.some(c => !(c in row)) || Object.keys(row).some(c => !columns.includes(c))) throw new Error(`${table} 数据格式不正确`);
        await db.runAsync(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`, columns.map(c => row[c]));
      }
    }
  });
}

// A single connection is shared by the app. Expo's ordinary transactions can
// otherwise absorb unrelated async operations, including a read during restore.
let operationQueue: Promise<void> = Promise.resolve();
function serialize<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  return (...args: A): Promise<R> => {
    const result = operationQueue.then(() => fn(...args));
    operationQueue = result.then(() => undefined, () => undefined);
    return result;
  };
}
export const importCards = serialize(importCardsImpl);
export const initializeDemo = serialize(initializeDemoImpl);
export const listThoughts = serialize(listThoughtsImpl);
export const saveThought = serialize(saveThoughtImpl);
export const deleteThought = serialize(deleteThoughtImpl);
export const listSources = serialize(listSourcesImpl);
export const saveSource = serialize(saveSourceImpl);
export const listCitations = serialize(listCitationsImpl);
export const addCitation = serialize(addCitationImpl);
export const removeCitation = serialize(removeCitationImpl);
export const listDecks = serialize(listDecksImpl);
export const createDeck = serialize(createDeckImpl);
export const updateDeck = serialize(updateDeckImpl);
export const deleteDeck = serialize(deleteDeckImpl);
export const listFavorites = serialize(listFavoritesImpl);
export const setFavorite = serialize(setFavoriteImpl);
export const listTags = serialize(listTagsImpl);
export const setTags = serialize(setTagsImpl);
export const getSetting = serialize(getSettingImpl);
export const setSetting = serialize(setSettingImpl);
export const deckMembers = serialize(deckMembersImpl);
export const thoughtDecks = serialize(thoughtDecksImpl);
export const setDeckMember = serialize(setDeckMemberImpl);
export const listRelations = serialize(listRelationsImpl);
export const addRelation = serialize(addRelationImpl);
export const removeRelation = serialize(removeRelationImpl);
export const listRevisions = serialize(listRevisionsImpl);
export const loadLibrary = serialize(loadLibraryImpl);
export const databaseInfo = serialize(databaseInfoImpl);
export const exportCardsData = serialize(exportCardsDataImpl);
export const exportBackup = serialize(exportBackupImpl);
export const restoreBackup = serialize(restoreBackupImpl);
