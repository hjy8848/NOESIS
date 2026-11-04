const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function repository(initialSql = '', existingDb) {
  const db = existingDb || new DatabaseSync(':memory:');
  if (initialSql) db.exec(initialSql);
  const args = values => Array.isArray(values[0]) && values.length === 1 ? values[0] : values;
  const adapter = {
    execAsync: async sql => db.exec(sql),
    runAsync: async (sql, ...values) => db.prepare(sql).run(...args(values)),
    getAllAsync: async (sql, ...values) => db.prepare(sql).all(...args(values)),
    getFirstAsync: async (sql, ...values) => db.prepare(sql).get(...args(values)) ?? null,
    withTransactionAsync: async fn => { db.exec('BEGIN'); try { await fn(); db.exec('COMMIT'); } catch (error) { db.exec('ROLLBACK'); throw error; } }
  };
  const source = readFileSync('src/repository.ts', 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, require: name => name === 'expo-sqlite' ? { openDatabaseAsync: async () => adapter } : name === 'expo-crypto' ? { randomUUID } : require(name), Date, Set, JSON, Error });
  return { repo: exports, db };
}
const card = { title:'测试', summary:'摘要', content:'初稿', type:'concept', status:'exploring' };

test('create, edit, tags, favorites and revision survive backup and restore', async () => {
  const { repo } = repository();
  const id = await repo.saveThought({...card,tags:['思想','思想']});
  await repo.saveThought({...card,id,content:'修订',tags:['变化']},'补充');
  await repo.setFavorite(id,true);
  await repo.createDeck('主题','描述');
  await repo.saveSource({title:'一本书',type:'书籍',content:'正文',url:''});
  const source=(await repo.listSources())[0];
  await repo.addCitation(id,source.id,'摘录','第 12 页');
  const deck = (await repo.listDecks())[0];
  await repo.setDeckMember(deck.id,id,true);
  const backup = await repo.exportBackup();
  await repo.deleteThought(id);
  await repo.restoreBackup(backup);
  assert.equal((await repo.listThoughts())[0].content,'修订');
  assert.equal((await repo.listTags(id))[0].tag,'变化');
  assert.equal((await repo.listFavorites())[0].thoughtId,id);
  assert.equal((await repo.listRevisions(id))[0].previousContent,'初稿');
  assert.equal((await repo.deckMembers(deck.id))[0].thoughtId,id);
  assert.equal((await repo.listCitations(id))[0].location,'第 12 页');
  assert.equal((await repo.listSources())[0].title,'一本书');
});

test('existing version 1 database migrates without losing cards or deck memberships', async () => {
  const first = repository();
  const id = await first.repo.saveThought(card);
  await first.repo.createDeck('旧牌组','描述');
  const deck = (await first.repo.listDecks())[0];
  await first.repo.setDeckMember(deck.id,id,true);
  first.db.exec('DROP TABLE thought_tags; DROP TABLE favorites; DROP TABLE settings; ALTER TABLE thoughts DROP COLUMN syncStatus; ALTER TABLE decks DROP COLUMN syncStatus; ALTER TABLE decks DROP COLUMN updatedAt; ALTER TABLE decks DROP COLUMN deletedAt; ALTER TABLE relations DROP COLUMN updatedAt; ALTER TABLE relations DROP COLUMN deletedAt; ALTER TABLE relations DROP COLUMN syncStatus; PRAGMA user_version = 1;');
  const upgraded = repository('',first.db);
  assert.equal((await upgraded.repo.listThoughts())[0].id,id);
  assert.equal((await upgraded.repo.deckMembers(deck.id))[0].thoughtId,id);
  assert.equal((await upgraded.repo.listDecks())[0].updatedAt,deck.createdAt);
  assert.equal(first.db.prepare('PRAGMA user_version').get().user_version,4);
});

test('failed backup restore and failed batch are atomic', async () => {
  const { repo } = repository();
  const id = await repo.saveThought(card);
  const backup = JSON.parse(await repo.exportBackup());
  backup.data.relations.push({id:'bad',sourceThoughtId:id,targetThoughtId:'missing',relationType:'related',description:'',updatedAt:new Date().toISOString(),deletedAt:null,syncStatus:'pending'});
  await assert.rejects(repo.restoreBackup(JSON.stringify(backup)));
  assert.equal((await repo.listThoughts())[0].id,id);
  await repo.deleteThought(id);
  await assert.rejects(repo.importCards([{...card,title:'新卡'}, {...card,id}]));
  assert.equal((await repo.listThoughts()).length,0);
});

test('concurrent saves and a failed batch cannot share a transaction', async () => {
  const { repo } = repository();
  const deleted=await repo.saveThought({...card,title:'已删除'});
  await repo.deleteThought(deleted);
  const [batch,independent] = await Promise.allSettled([
    repo.importCards([{...card,title:'回滚卡片'}, {...card,id:deleted}]),
    repo.saveThought({...card,title:'独立保存'}),
  ]);
  assert.equal(batch.status,'rejected');
  assert.equal(independent.status,'fulfilled');
  assert.deepEqual((await repo.listThoughts()).map(t=>t.title),['独立保存']);
  const saves=await Promise.all(Array.from({length:8},(_,i)=>repo.saveThought({...card,title:`并发${i}`})));
  assert.equal(new Set(saves).size,8);
  assert.equal((await repo.listThoughts()).length,9);
});

test('editing deck membership commits with the card and rolls back invalid decks', async () => {
  const { repo }=repository();
  await repo.createDeck('主题','');
  const deck=(await repo.listDecks())[0];
  const id=await repo.saveThought({...card,deckIds:[deck.id],tags:['观点']});
  assert.equal((await repo.thoughtDecks(id))[0].id,deck.id);
  await assert.rejects(repo.saveThought({...card,id,title:'不能写入',deckIds:['missing']}));
  assert.equal((await repo.listThoughts())[0].title,'测试');
  assert.equal((await repo.thoughtDecks(id))[0].id,deck.id);
  await repo.saveThought({...card,id,deckIds:[]});
  assert.equal((await repo.thoughtDecks(id)).length,0);
});

test('deleted relations are hidden but preserved in backups', async () => {
  const {repo}=repository();
  const a=await repo.saveThought(card), b=await repo.saveThought({...card,title:'另一张'});
  await repo.addRelation(a,b,'supports');
  const relation=(await repo.listRelations())[0];
  await repo.removeRelation(relation.id);
  assert.equal((await repo.listRelations()).length,0);
  const backup=JSON.parse(await repo.exportBackup());
  assert.ok(backup.data.relations[0].deletedAt);
  await repo.restoreBackup(JSON.stringify(backup));
  assert.equal((await repo.listRelations()).length,0);
});

test('version 1 backups restore with new data tables and deck fields', async () => {
  const { repo, db } = repository();
  await repo.createDeck('旧牌组','');
  const backup = JSON.parse(await repo.exportBackup());
  backup.version = 1;
  delete backup.data.thought_tags; delete backup.data.favorites; delete backup.data.settings;
  for (const row of backup.data.decks) { delete row.updatedAt; delete row.deletedAt; delete row.syncStatus; }
  await repo.restoreBackup(JSON.stringify(backup));
  assert.equal((await repo.listDecks())[0].name,'旧牌组');
  assert.equal(db.prepare('PRAGMA user_version').get().user_version,4);
});

test('version 2 backup restores with pending sync state', async () => {
  const { repo } = repository();
  const id=await repo.saveThought(card);
  const backup=JSON.parse(await repo.exportBackup());
  backup.version=2;
  for (const table of ['thoughts','decks']) for (const row of backup.data[table]) delete row.syncStatus;
  await repo.restoreBackup(JSON.stringify(backup));
  const restored=(await repo.listThoughts()).find(t=>t.id===id);
  assert.equal(restored.syncStatus,'pending');
});

test('version 3 relation backups migrate to version 4', async () => {
  const {repo}=repository();
  const a=await repo.saveThought(card),b=await repo.saveThought({...card,title:'另一个'});
  await repo.addRelation(a,b,'explains');
  const backup=JSON.parse(await repo.exportBackup());
  backup.version=3;
  for (const row of backup.data.relations) {delete row.updatedAt;delete row.deletedAt;delete row.syncStatus;}
  await repo.restoreBackup(JSON.stringify(backup));
  const relation=(await repo.listRelations())[0];
  assert.equal(relation.relationType,'explains');
  assert.equal(relation.syncStatus,'pending');
  assert.equal(relation.deletedAt,null);
});

test('batch import creates tags and decks, preserves omitted fields and rolls back ambiguous decks', async () => {
  const { repo } = repository();
  await repo.importCards([{...card,id:'example-id',tags:['认知'],decks:['哲学']}]);
  assert.equal((await repo.listTags('example-id'))[0].tag,'认知');
  assert.equal((await repo.thoughtDecks('example-id'))[0].name,'哲学');
  await repo.importCards([{...card,id:'example-id',content:'第二稿'}]);
  assert.equal((await repo.listTags('example-id'))[0].tag,'认知');
  assert.equal((await repo.thoughtDecks('example-id')).length,1);
  await repo.importCards([{id:'example-id',title:'重命名'}]);
  const partial=(await repo.listThoughts())[0];
  assert.equal(partial.content,'第二稿');
  assert.equal(partial.summary,'摘要');
  assert.equal(partial.type,'concept');
  assert.equal(partial.title,'重命名');
  await repo.createDeck('哲学','重复名称');
  await assert.rejects(repo.importCards([{...card,id:'example-id',content:'不应写入',decks:['哲学']}]));
  assert.equal((await repo.listThoughts())[0].content,'第二稿');
});
