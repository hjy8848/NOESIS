const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const exportsObject = {};
const js = ts.transpileModule(readFileSync('src/cardFormats.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
vm.runInNewContext(js,{exports:exportsObject,require,Error});
const {parseCardFiles,formatMarkdown,formatCsv,formatSystemMarkdown}=exportsObject;

test('Markdown export and import preserve content whitespace, metadata and Unicode',()=>{
  for (const content of ['', '\n  缩进\n\n末尾\n', '---\n# 标题\n正文']) {
    const original={id:'id-1',title:'“思想”：自由',summary:'摘要\n第二行',content,type:'concept',status:'formed'};
    const text=formatMarkdown(original,['标签','认知'],['牌组']);
    const parsed=parseCardFiles([{name:'card.md',text}])[0];
    assert.equal(parsed.content,content);
    assert.equal(parsed.title,original.title);
    assert.equal(parsed.summary,original.summary);
    assert.deepEqual(Array.from(parsed.tags),['标签','认知']);
    assert.deepEqual(Array.from(parsed.decks),['牌组']);
  }
});

test('CSV export can be edited and reimported without losing multiline text or separators in tags',()=>{
  const thought={id:'uuid',title:'思想',summary:'摘要',content:'第一行\n第二行',type:'concept',status:'formed'};
  const csv=formatCsv([{thought,tags:['甲;乙','引号"'],decks:['主题;一']}]);
  const [card]=parseCardFiles([{name:'cards.csv',text:csv}]);
  assert.equal(card.id,thought.id);
  assert.equal(card.content,thought.content);
  assert.deepEqual(Array.from(card.tags),['甲;乙','引号"']);
  assert.deepEqual(Array.from(card.decks),['主题;一']);
});

test('CSV accepts quoted multiline fields and multiple files',()=>{
  const cards=parseCardFiles([{name:'cards.csv',text:'title,content,tags\n第一张,"第一行\n第二行",甲;乙\n'}, {name:'another.csv',text:'title\n第二张\n'}]);
  assert.equal(cards.length,2);
  assert.equal(cards[0].content,'第一行\n第二行');
  assert.deepEqual(Array.from(cards[0].tags),['甲','乙']);
  assert.equal(cards[1].tags,undefined);
});

test('system Markdown export preserves the system, chapter, and card reading order',()=>{
  const text=formatSystemMarkdown({
    system:{id:'s',title:'主体与欲望',description:'关于主体和欲望。',createdAt:'',updatedAt:''},
    chapters:[
      {id:'c1',systemId:'s',title:'主体',position:0,cards:[{id:'a',title:'卡片甲',content:'正文甲',createdAt:'',updatedAt:'',deletedAt:null}]},
      {id:'c2',systemId:'s',title:'欲望',position:1,cards:[{id:'b',title:'卡片乙',content:'正文乙',createdAt:'',updatedAt:'',deletedAt:null}]},
    ],
  });
  assert.ok(text.indexOf('## 1. 主体') < text.indexOf('## 2. 欲望'));
  assert.ok(text.indexOf('### 卡片甲') < text.indexOf('### 卡片乙'));
  assert.match(text,/正文甲/);
  assert.match(text,/正文乙/);
});
