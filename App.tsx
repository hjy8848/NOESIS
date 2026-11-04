import React, { useEffect, useRef, useState } from 'react';
import { Alert, AppState, BackHandler, FlatList, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { parseCardFiles, formatMarkdown, formatCsv } from './src/cardFormats';
import Markdown from 'react-native-markdown-display';
import { diffLines } from 'diff';
import { Thought, ThoughtStatus, ThoughtType } from './src/types';
import { Card } from './src/Card';
import { DeckCover } from './src/DeckCover';
import { useLibraryStore } from './src/store';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Graph } from './src/Graph';
import { Slot, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as repo from './src/repository';

const types: ThoughtType[] = ['proposition', 'concept', 'source'];
const statuses: ThoughtStatus[] = ['exploring', 'formed', 'supported', 'challenged', 'revised'];
const labels: Record<string,string> = { proposition:'命题', concept:'概念', source:'来源', exploring:'探索中', formed:'已形成', supported:'有证据支持', challenged:'存在挑战', revised:'已修订', supports:'支持', contradicts:'反驳', explains:'解释', causes:'导致', extends:'扩展', related:'相关' };
const relationTypes = ['supports','contradicts','explains','causes','extends','related'];
type Draft = { id?: string; title: string; summary: string; content: string; type: ThoughtType; status: ThoughtStatus; tags?: string; deckIds?: string[] };
const empty = (): Draft => ({title:'', summary:'', content:'', type:'proposition', status:'exploring', tags:'',deckIds:[]});
function draftFingerprint(value: Draft) {
  return JSON.stringify([value.title.trim(),value.summary,value.content,value.type,value.status,
    [...new Set((value.tags || '').split(/[,，]/).map(t=>t.trim()).filter(Boolean))].sort(),
    [...new Set(value.deckIds || [])].sort()]);
}

export default function App() {
  const [light,setLight] = useState(false); const [animations,setAnimations] = useState(true);
  const [databaseInfo,setDatabaseInfo] = useState<{version:number;bytes:number}|null>(null);
  const s = light ? lightStyles : darkStyles;
  const router=useRouter(); const pathname=usePathname();
  const tab: 'library'|'decks'|'graph'|'settings' = pathname==='/decks'?'decks':pathname==='/graph'?'graph':pathname==='/settings'?'settings':'library';
  function setTab(next:'library'|'decks'|'graph'|'settings') { router.replace(next==='library' ? '/' : `/${next}`); }
  const {thoughts,decks,relations,favorites,sources,refresh}=useLibraryStore();
  const [cardDeckNames,setCardDeckNames] = useState<string[]>([]);
  const [recent,setRecent] = useState<string[]>([]);
  const [onlyFavorites,setOnlyFavorites] = useState(false); const [detailTags,setDetailTags] = useState<string[]>([]); const [detailDecks,setDetailDecks] = useState<repo.Deck[]>([]);
  const [index,setIndex] = useState(0); const [search,setSearch] = useState(''); const [draft,setDraft] = useState<Draft|null>(null);
  const [saveState,setSaveState] = useState(''); const [revisionReason,setRevisionReason] = useState('');
  const editorSession = useRef(0); const editorId = useRef<string|undefined>(undefined);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const lastSavedFingerprint = useRef<string|null>(null);
  const latestDraft=useRef<Draft|null>(null); const latestReason=useRef('');
  latestDraft.current=draft; latestReason.current=revisionReason;
  const [detail,setDetail] = useState<Thought|null>(null); const [revisions,setRevisions] = useState<repo.Revision[]>([]);
  const [citations,setCitations] = useState<repo.Citation[]>([]);
  const [sourceTitle,setSourceTitle] = useState(''); const [sourceUrl,setSourceUrl] = useState(''); const [sourceType,setSourceType] = useState('书籍'); const [sourceContent,setSourceContent] = useState(''); const [editingSource,setEditingSource] = useState<string|undefined>(); const [chosenSource,setChosenSource] = useState(''); const [excerpt,setExcerpt] = useState(''); const [location,setLocation] = useState('');
  const [deckName,setDeckName] = useState(''); const [deckDescription,setDeckDescription] = useState(''); const [deck,setDeck] = useState<repo.Deck|null>(null); const [members,setMembers] = useState<string[]>([]);
  const [deckFilter,setDeckFilter] = useState<{name:string; ids:string[]}|null>(null);
  const [graphFilter,setGraphFilter] = useState<{id:string; ids:string[]}|null>(null);
  const [source,setSource] = useState(''); const [target,setTarget] = useState(''); const [relType,setRelType] = useState('related');
  const [importFiles,setImportFiles] = useState<Array<{name:string; text:string}>>([]);
  async function loadPreferences() { const [theme,motion,history]=await Promise.all([repo.getSetting('theme'),repo.getSetting('animations'),repo.getSetting('recent')]);setLight(theme?.value==='light');setAnimations(motion?.value!=='off');try {const ids=JSON.parse(history?.value || '[]');setRecent(Array.isArray(ids)?ids.filter(id=>typeof id==='string'):[]);} catch {setRecent([]);} }
  useEffect(() => { refresh().catch(error); loadPreferences().catch(error); }, []);
  useEffect(()=>{if(tab==='settings')repo.databaseInfo().then(setDatabaseInfo).catch(error);},[tab,thoughts.length,decks.length,relations.length]);
  function startEditor(value: Draft) { editorSession.current += 1; editorId.current=value.id; lastSavedFingerprint.current=value.id ? draftFingerprint(value) : null; setRevisionReason(''); setSaveState(''); setDraft(value); }
  function enqueueSave(value: Draft, session: number, reason: string) {
    const operation = saveQueue.current.catch(()=>{}).then(async()=>{
      if (session !== editorSession.current) return;
      const fingerprint=draftFingerprint(value);
      if (fingerprint===lastSavedFingerprint.current) {setSaveState('已保存');return;}
      const id=await repo.saveThought({...value,id:editorId.current,title:value.title.trim(),tags:(value.tags || '').split(/[,，]/)},reason);
      if (session === editorSession.current) { editorId.current=id; lastSavedFingerprint.current=fingerprint; setDraft(current=>current && !current.id ? {...current,id} : current); setSaveState('已自动保存'); }
    });
    saveQueue.current=operation;
    return operation;
  }
  useEffect(()=>{
    if (!draft?.title.trim()) return;
    const session=editorSession.current;
    setSaveState('等待自动保存');
    const timer=setTimeout(()=>{setSaveState('保存中…');enqueueSave(draft,session,revisionReason).catch(e=>{setSaveState('保存失败');error(e);});},1500);
    return ()=>clearTimeout(timer);
  },[draft,revisionReason]);
  useEffect(()=>{
    const listener=AppState.addEventListener('change',state=>{
      const value=latestDraft.current;
      if (state !== 'active' && value?.title.trim()) enqueueSave(value,editorSession.current,latestReason.current).catch(error);
    });
    return ()=>listener.remove();
  },[]);
  function error(e: unknown) { Alert.alert('操作失败', e instanceof Error ? e.message : String(e)); }
  async function run(fn:()=>Promise<void>) { try { await fn(); await refresh(); } catch(e) { error(e); } }
  const filtered = thoughts.filter(t => (!deckFilter || deckFilter.ids.includes(t.id)) && (!onlyFavorites || favorites.includes(t.id)) && (t.title+' '+t.summary+' '+t.content).toLowerCase().includes(search.toLowerCase()));
  const current = filtered[Math.min(index, filtered.length-1)];
  useEffect(()=>{setIndex(i=>Math.min(i,Math.max(0,filtered.length-1)));},[filtered.length]);
  useEffect(()=>{let active=true; if (!current) {setCardDeckNames([]);return;} repo.thoughtDecks(current.id).then(found=>{if(active)setCardDeckNames(found.map(d=>d.name));}).catch(error);return ()=>{active=false;};},[current?.id,decks]);
  async function showDetail(t: Thought) { const [r,tags,refs,cardDecks]=await Promise.all([repo.listRevisions(t.id),repo.listTags(t.id),repo.listCitations(t.id),repo.thoughtDecks(t.id)]); setDetail(t); setRevisions(r); setDetailTags(tags.map(x=>x.tag)); setDetailDecks(cardDecks); setCitations(refs); const ids=[t.id,...recent.filter(id=>id!==t.id)].slice(0,8);setRecent(ids);await repo.setSetting('recent',JSON.stringify(ids)); }
  async function share(name: string, text: string) { const file = new File(Paths.cache, name); file.create({overwrite:true}); file.write(text); await Sharing.shareAsync(file.uri); }
  async function pick() { const result = await DocumentPicker.getDocumentAsync({copyToCacheDirectory:true, type:'*/*', multiple:true}); if (!result.canceled) setImportFiles(await Promise.all(result.assets.map(async a=>({name:a.name,text:await new File(a.uri).text()})))); }
  function confirm(title:string, message:string, action:()=>void) { Alert.alert(title,message,[{text:'取消',style:'cancel'},{text:'确认',onPress:action}]); }
  const button = (title:string, action:()=>void, selected=false) => <Pressable key={title} onPress={action} style={[s.button,selected && s.selected]}><Text style={s.buttonText}>{title}</Text></Pressable>;
  const field = (value:string, change:(v:string)=>void, placeholder:string, multiline=false) => <TextInput style={[s.input,multiline && s.multiline]} value={value} onChangeText={change} placeholder={placeholder} placeholderTextColor="#897e72" multiline={multiline} />;
  const close = () => { editorSession.current += 1; setDraft(null); setDetail(null); setDeck(null); };
  useEffect(()=>{
    const listener=BackHandler.addEventListener('hardwareBackPress',()=>{
      if (draft) {
        if (draft.title.trim()) run(async()=>{await enqueueSave(draft,editorSession.current,revisionReason);close();});
        else confirm('返回','标题为空，未保存的改动会丢失。',()=>run(async()=>{await saveQueue.current;close();}));
        return true;
      }
      if (detail || deck) {close();return true;}
      if (tab!=='library') {setTab('library');return true;}
      return false;
    });
    return ()=>listener.remove();
  },[draft,detail,deck,tab,revisionReason]);
  let content: React.ReactNode;
  if (draft) content = <><Text style={s.heading}>{draft.id ? '编辑思想' : '新建思想'}</Text>{field(draft.title,v=>setDraft({...draft,title:v}),'标题')}{field(draft.summary,v=>setDraft({...draft,summary:v}),'核心摘要',true)}{field(draft.content,v=>setDraft({...draft,content:v}),'详细论述（Markdown）',true)}{field(draft.tags || '',v=>setDraft({...draft,tags:v}),'标签，以逗号分隔')}<Text style={s.label}>所属牌组</Text><View style={s.row}>{decks.length ? decks.map(d=>button(d.name,()=>setDraft({...draft,deckIds:draft.deckIds?.includes(d.id)?draft.deckIds.filter(id=>id!==d.id):[...(draft.deckIds||[]),d.id]}),draft.deckIds?.includes(d.id))) : <Text style={s.muted}>先在牌组页创建牌组。</Text>}</View>{field(revisionReason,setRevisionReason,'修订原因（可选）')}<Text style={s.label}>类型</Text><View style={s.row}>{types.map(t=>button(labels[t],()=>setDraft({...draft,type:t}),draft.type===t))}</View><Text style={s.label}>思想状态</Text><View style={s.row}>{statuses.map(t=>button(labels[t],()=>setDraft({...draft,status:t}),draft.status===t))}</View><Text style={s.muted}>{saveState}</Text>{button('保存并返回',()=>run(async()=>{if(!draft.title.trim()) throw new Error('请填写标题'); await enqueueSave(draft,editorSession.current,revisionReason); close();}))}{!draft.title.trim() && button('返回',()=>confirm('返回','标题为空，未保存的改动会丢失。',()=>run(async()=>{await saveQueue.current;close();})))}</>;
  else if (detail) content = <><Text style={s.eyebrow}>{labels[detail.type]}  /  {labels[detail.status]}</Text><Text style={s.heading}>{detail.title}</Text><Text style={s.body}>{detail.summary}</Text><Markdown style={{body:{color:light?'#33453a':'#e8decf',fontSize:15,lineHeight:25}}}>{detail.content || '暂无详细论述'}</Markdown><Text style={s.muted}>{detailTags.map(t=>'#'+t).join('  ')}</Text><Text style={s.muted}>{detailDecks.map(d=>d.name).join(' · ')}</Text><View style={s.row}>{button(favorites.includes(detail.id)?'★ 已收藏':'☆ 收藏',()=>run(()=>repo.setFavorite(detail.id,!favorites.includes(detail.id))))}{button('编辑',()=>{startEditor({...detail,tags:detailTags.join(', '),deckIds:detailDecks.map(d=>d.id)});setDetail(null);})}{button('导出 Markdown',()=>run(async()=>{const cardDecks=await repo.thoughtDecks(detail.id);await share(`noesis-${detail.id}.md`, formatMarkdown(detail,detailTags,cardDecks.map(d=>d.name)));} ))}{button('删除',()=>confirm('删除卡片','卡片将被软删除。',()=>run(async()=>{await repo.deleteThought(detail.id);close();})))}</View><Text style={s.section}>关联思想</Text>{relations.filter(r=>r.sourceThoughtId===detail.id||r.targetThoughtId===detail.id).map(r=>{const other=thoughts.find(t=>t.id===(r.sourceThoughtId===detail.id?r.targetThoughtId:r.sourceThoughtId));return <View key={r.id} style={s.panel}><Text style={s.body}>{r.sourceThoughtId===detail.id?'→':'←'} {labels[r.relationType]} · {other?.title || '已删除'}</Text>{other && button('查看关联卡片',()=>showDetail(other).catch(error))}</View>;})}{button('管理关联',()=>{setSource(detail.id);setDetail(null);setTab('graph');})}<Text style={s.section}>来源与引用</Text>{citations.map(c=><View key={c.id} style={s.panel}><Text style={s.body}>{sources.find(x=>x.id===c.sourceId)?.title || '未知来源'} · {c.location}</Text><Text style={s.muted}>{c.excerpt}</Text>{button('移除引用',()=>confirm('移除引用','确定移除这条引用？',()=>run(async()=>{await repo.removeCitation(c.id);setCitations(await repo.listCitations(detail.id));})))}</View>)}<Text style={s.muted}>选择已有来源</Text><View style={s.row}>{sources.map(x=>button(x.title,()=>setChosenSource(x.id),chosenSource===x.id))}</View>{field(excerpt,setExcerpt,'引用摘录',true)}{field(location,setLocation,'位置，例如页码')}{button('添加引用',()=>run(async()=>{if(!chosenSource) throw new Error('请选择来源');await repo.addCitation(detail.id,chosenSource,excerpt,location);setCitations(await repo.listCitations(detail.id));setExcerpt('');setLocation('');}))}<Text style={s.muted}>{editingSource?'编辑来源':'创建来源后可在上方选择'}</Text>{chosenSource && button('编辑所选来源',()=>{const src=sources.find(x=>x.id===chosenSource);if(src){setEditingSource(src.id);setSourceTitle(src.title);setSourceType(src.type);setSourceContent(src.content);setSourceUrl(src.url);}})}{field(sourceTitle,setSourceTitle,'来源标题')}{field(sourceType,setSourceType,'来源类型')}{field(sourceContent,setSourceContent,'来源内容或笔记',true)}{field(sourceUrl,setSourceUrl,'网址（可选）')}{button(editingSource?'保存来源':'创建来源',()=>run(async()=>{if(!sourceTitle.trim()) throw new Error('请填写来源标题');await repo.saveSource({id:editingSource,title:sourceTitle.trim(),type:sourceType,content:sourceContent,url:sourceUrl});setEditingSource(undefined);setSourceTitle('');setSourceContent('');setSourceUrl('');}))}{editingSource && button('取消来源编辑',()=>{setEditingSource(undefined);setSourceTitle('');setSourceContent('');setSourceUrl('');})}<Text style={s.section}>修订历史</Text>{revisions.length===0 && <Text style={s.muted}>还没有内容修订。</Text>}{revisions.map(r=><View key={r.id} style={s.panel}><Text style={s.muted}>{new Date(r.createdAt).toLocaleString()} · {r.reason || '编辑'}</Text><Text style={s.muted}>文本差异：绿色为新增，红色为删除</Text><Text style={s.body}>{diffLines(r.previousContent,r.newContent).map((part,i)=><Text key={i} style={{color:part.added?'#68b881':part.removed?'#d97e76':(light?'#33453a':'#e8decf')}}>{part.added?'+ ':part.removed?'− ':''}{part.value}</Text>)}</Text>{button('恢复之前的内容',()=>confirm('恢复历史版本','当前内容会保留在修订历史中。',()=>run(async()=>{await repo.saveThought({...detail,content:r.previousContent},'恢复历史版本');const updated=(await repo.listThoughts()).find(t=>t.id===detail.id); if(updated) await showDetail(updated);})))}</View>)}{button('返回',close)}</>;
  else if (deck) content = <><Text style={s.heading}>{deck.name}</Text>{field(deckName,setDeckName,'牌组名称')}{field(deckDescription,setDeckDescription,'牌组描述')}<Text style={s.label}>封面颜色</Text><View style={s.row}>{[['松绿','#516354'],['陶土','#8d6a5c'],['石蓝','#6b728b'],['暖金','#88755d']].map(([name,color])=>button(name,()=>setDeck({...deck,color}),deck.color===color))}</View>{button('保存牌组',()=>run(async()=>{if(!deckName.trim()) throw new Error('请填写牌组名称');await repo.updateDeck(deck.id,deckName.trim(),deckDescription,deck.color);setDeck({...deck,name:deckName.trim(),description:deckDescription});}))}{button('删除牌组',()=>confirm('删除牌组','牌组将被软删除，卡片仍会保留。',()=>run(async()=>{await repo.deleteDeck(deck.id);close();})))}{button('浏览此牌组',()=>{setDeckFilter({name:deck.name,ids:members});setIndex(0);setOnlyFavorites(false);setSearch('');setDeck(null);setTab('library');})}<Text style={s.muted}>选择属于这个牌组的卡片</Text></>;
  else if (tab==='library') content = <><Text style={s.eyebrow}>YOUR COLLECTION</Text><Text style={s.heading}>思想牌库</Text><Text style={s.muted}>收集想法，让它们彼此相遇。</Text>{deckFilter && button('牌组：'+deckFilter.name+' ×',()=>{setDeckFilter(null);setIndex(0);})}{field(search,v=>{setSearch(v);setIndex(0);},'搜索思想')}{button(onlyFavorites?'★ 只看收藏':'☆ 查看收藏',()=>{setOnlyFavorites(!onlyFavorites);setIndex(0);},onlyFavorites)}{current ? <><Card key={current.id} animations={animations} canNext={index<filtered.length-1} canPrevious={index>0} thought={current} favorite={favorites.includes(current.id)} relationCount={relations.filter(r=>r.sourceThoughtId===current.id || r.targetThoughtId===current.id).length} deckNames={cardDeckNames} onOpen={()=>showDetail(current).catch(error)} onNext={()=>setIndex(i=>Math.min(i+1,filtered.length-1))} onPrevious={()=>setIndex(i=>Math.max(i-1,0))}/><Text style={s.center}>{Math.min(index+1,filtered.length)} / {filtered.length}　·　左右滑动</Text><View style={s.row}>{button('上一张',()=>setIndex(i=>Math.max(i-1,0)))}{button('查看详情',()=>showDetail(current).catch(error))}{button(favorites.includes(current.id)?'★ 已收藏':'☆ 收藏',()=>run(()=>repo.setFavorite(current.id,!favorites.includes(current.id))))}{button('下一张',()=>setIndex(i=>Math.min(i+1,filtered.length-1)))}</View></> : <View style={s.panel}><Text style={s.body}>这里还没有卡片。创建一张，或者从设置中导入。</Text></View>}{button('＋ 创建思想卡',()=>startEditor(empty()))}<Text style={s.section}>我的牌组</Text><View style={s.row}>{decks.length ? decks.map(d=>button(`${d.name} · ${d.cardCount ?? 0}`,()=>run(async()=>{setDeckFilter({name:d.name,ids:(await repo.deckMembers(d.id)).map(x=>x.thoughtId)});setIndex(0);}))) : <Text style={s.muted}>在牌组页创建主题收藏。</Text>}</View><Text style={s.section}>最近浏览</Text><View style={s.row}>{recent.map(id=>thoughts.find(t=>t.id===id)).filter((t):t is Thought=>!!t).map(t=>button(t.title,()=>showDetail(t).catch(error)))}</View><Text style={s.section}>最近新增</Text><View style={s.row}>{[...thoughts].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,5).map(t=>button(t.title,()=>showDetail(t).catch(error)))}</View></>;
  else if (tab==='decks') content = <><Text style={s.eyebrow}>CURATED COLLECTIONS</Text><Text style={s.heading}>主题牌组</Text>{field(deckName,setDeckName,'牌组名称')}{field(deckDescription,setDeckDescription,'描述')}{button('创建牌组',()=>run(async()=>{if(!deckName.trim()) throw new Error('请填写牌组名称');await repo.createDeck(deckName.trim(),deckDescription);setDeckName('');setDeckDescription('');}))}</>;
  else if (tab==='graph') content = <><Text style={s.eyebrow}>CONNECTIONS</Text><Text style={s.heading}>思想关联</Text><Text style={s.muted}>点击节点查看直接关联，拖动节点或横向滑动画布。</Text><View style={s.row}>{button('全部主题',()=>setGraphFilter(null),!graphFilter)}{decks.map(d=>button(d.name,()=>run(async()=>setGraphFilter({id:d.id,ids:(await repo.deckMembers(d.id)).map(x=>x.thoughtId)})),graphFilter?.id===d.id))}</View><Graph light={light} thoughts={graphFilter ? thoughts.filter(t=>graphFilter.ids.includes(t.id)) : thoughts} relations={relations} open={t=>showDetail(t).catch(error)}/><Text style={s.muted}>选择起点与终点，再选择关系。</Text><Text style={s.section}>起点</Text><FlatList horizontal data={thoughts} keyExtractor={t=>t.id} renderItem={({item:t})=>button(t.title,()=>setSource(t.id),source===t.id)} extraData={source} contentContainerStyle={{flexDirection:'row',gap:8,marginVertical:8}}/><Text style={s.section}>终点</Text><FlatList horizontal data={thoughts} keyExtractor={t=>t.id} renderItem={({item:t})=>button(t.title,()=>setTarget(t.id),target===t.id)} extraData={target} contentContainerStyle={{flexDirection:'row',gap:8,marginVertical:8}}/><View style={s.row}>{relationTypes.map(t=>button(labels[t],()=>setRelType(t),relType===t))}</View>{button('建立关联',()=>run(async()=>{if(!source||!target) throw new Error('请选择两张卡片');await repo.addRelation(source,target,relType);}))}<Text style={s.section}>已有关系</Text></>;
  else content = <><Text style={s.eyebrow}>YOUR DATA</Text><Text style={s.heading}>设置与数据</Text><Text style={s.body}>本地存储 · {thoughts.length} 张思想卡 · {decks.length} 个牌组</Text><Text style={s.muted}>SQLite · 数据库版本 {databaseInfo?.version ?? '…'} · 约 {databaseInfo ? Math.ceil(databaseInfo.bytes/1024) : '…'} KB · {relations.length} 条关联</Text><View style={s.row}>{button(light?'浅色主题':'深色主题',()=>run(async()=>{const next=!light;await repo.setSetting('theme',next?'light':'dark');setLight(next);}))}{button(animations?'动画：开':'动画：关',()=>run(async()=>{const next=!animations;await repo.setSetting('animations',next?'on':'off');setAnimations(next);}))}</View>{button('初始化演示卡片',()=>confirm('初始化演示数据','仅在没有任何卡片记录（包括已删除卡片）的牌库中创建 15 张演示卡和部分关联。',()=>run(()=>repo.initializeDemo())))}{button('导出完整 JSON 备份',()=>run(async()=>share('noesis-backup.json',await repo.exportBackup())))}{button('导出全部卡片 CSV',()=>run(async()=>share('noesis-cards.csv',formatCsv(await repo.exportCardsData()))))}{button('选择 JSON / Markdown / CSV 文件',()=>run(pick))}{importFiles.length ? <View style={s.panel}><Text style={s.body}>已选择：{importFiles.map(f=>f.name).join('、')}</Text><Text style={s.muted}>JSON 会恢复整个数据库；Markdown 和 CSV 按 ID 更新或新增卡片。</Text>{button('导入文件',()=>{if(importFiles.length===1 && importFiles[0].name.toLowerCase().endsWith('.json')) confirm('恢复备份','这会替换当前所有数据。请先导出备份。',()=>run(async()=>{await repo.restoreBackup(importFiles[0].text);await loadPreferences();setDeckFilter(null);setGraphFilter(null);setIndex(0);setSource('');setTarget('');setChosenSource('');setImportFiles([]);}));else {try {const cards=parseCardFiles(importFiles);if (!cards.length) throw new Error('文件没有卡片');confirm('确认导入',`共 ${cards.length} 张卡片，已有 ID 将更新原卡片：\n${cards.slice(0,10).map(c=>c.title || '（缺少标题）').join('、')}${cards.length>10?' 等':''}`,()=>run(async()=>{await repo.importCards(cards);setImportFiles([]);}));} catch(e){error(e);}}})}</View>:null}<Text style={s.section}>导入格式</Text><Text style={s.body}>CSV 列：id,title,summary,content,type,status,tags,decks；多个标签或牌组用分号分隔。Markdown 使用 YAML 头部和正文。类型：proposition / concept / source；状态：exploring / formed / supported / challenged / revised。</Text></>;
  type ListEntry = {kind:'deck'; value:repo.Deck} | {kind:'member'; value:Thought} | {kind:'relation'; value:repo.Relation};
  const entries:ListEntry[] = draft || detail ? [] : deck ? thoughts.map(value=>({kind:'member',value})) : tab==='decks' ? decks.map(value=>({kind:'deck',value})) : tab==='graph' ? relations.map(value=>({kind:'relation',value})) : [];
  const renderEntry = ({item}:{item:ListEntry}) => {
    if(item.kind==='deck') {const d=item.value;return <DeckCover deck={d} animations={animations} onOpen={()=>run(async()=>{setDeck(d);setDeckName(d.name);setDeckDescription(d.description);setMembers((await repo.deckMembers(d.id)).map(x=>x.thoughtId));})}/>;}
    if(item.kind==='member' && deck) {const t=item.value;return button(`${members.includes(t.id)?'✓':'＋'}  ${t.title}`,()=>run(async()=>{const next=!members.includes(t.id);await repo.setDeckMember(deck.id,t.id,next);setMembers((await repo.deckMembers(deck.id)).map(x=>x.thoughtId));}));}
    if(item.kind==='relation') {const r=item.value;return <View style={s.panel}><Text style={s.body}>{thoughts.find(t=>t.id===r.sourceThoughtId)?.title || '已删除'} → {labels[r.relationType]} → {thoughts.find(t=>t.id===r.targetThoughtId)?.title || '已删除'}</Text>{button('删除关联',()=>confirm('删除关联','确定删除这条关联？',()=>run(()=>repo.removeRelation(r.id))))}</View>;}
    return null;
  };
  return <GestureHandlerRootView style={{flex:1}}><StatusBar style={light?'dark':'light'}/><SafeAreaView style={s.root}><FlatList data={entries} keyExtractor={item=>`${item.kind}:${item.value.id}`} renderItem={renderEntry} ListHeaderComponent={<>{content}</>} ListFooterComponent={deck ? <>{button('返回',close)}</> : undefined} contentContainerStyle={s.container} keyboardShouldPersistTaps="handled" />{!draft&&!detail&&!deck && <View style={s.nav}>{([['library','牌库'],['decks','牌组'],['graph','关联'],['settings','设置']] as const).map(([id,title])=><Pressable key={id} onPress={()=>setTab(id)} style={s.navItem}><Text style={[s.navText,tab===id&&s.navActive]}>{title}</Text></Pressable>)}</View>}</SafeAreaView><View style={{position:'absolute',width:0,height:0}}><Slot /></View></GestureHandlerRootView>;
}
const darkStyles=StyleSheet.create({root:{flex:1,backgroundColor:'#171b1a'},container:{padding:24,paddingTop:48,paddingBottom:40},eyebrow:{color:'#bda982',letterSpacing:3,fontSize:11,marginBottom:12},heading:{color:'#f4eee1',fontSize:32,fontWeight:'700',marginBottom:14},section:{color:'#e8dec9',fontSize:19,fontWeight:'600',marginTop:22,marginBottom:12},label:{color:'#c8baa4',marginTop:14,marginBottom:6},muted:{color:'#aaa394',lineHeight:22},body:{color:'#e8decf',fontSize:15,lineHeight:25,marginVertical:8},input:{backgroundColor:'#292e2c',color:'#f5eee3',padding:13,borderRadius:10,marginVertical:7,fontSize:15},multiline:{minHeight:100,textAlignVertical:'top'},row:{flexDirection:'row',flexWrap:'wrap',gap:8,marginVertical:8},button:{backgroundColor:'#343c38',borderWidth:1,borderColor:'#556056',borderRadius:9,paddingVertical:10,paddingHorizontal:13,marginVertical:4},selected:{backgroundColor:'#8a7758'},buttonText:{color:'#f5eee3',fontSize:14},panel:{backgroundColor:'#252b28',padding:18,borderRadius:14,marginVertical:8},cardWrap:{height:420,marginVertical:20},cardTouch:{flex:1},card:{position:'absolute',width:'100%',height:'100%',borderRadius:22,padding:25,backgroundColor:'#eee6d5',borderWidth:5,borderColor:'#b9a984',justifyContent:'space-between',shadowColor:'#000',shadowOpacity:.35,shadowRadius:12,shadowOffset:{width:0,height:8},elevation:8},face:{backfaceVisibility:'hidden'},back:{backgroundColor:'#e4dac5'},cardCorner:{color:'#72644e',fontSize:12,letterSpacing:2},cardSymbol:{textAlign:'center',fontSize:80,color:'#8d7957'},cardTitle:{fontSize:26,fontWeight:'600',color:'#343e37',textAlign:'center'},cardSummary:{fontSize:17,color:'#4e584f',lineHeight:28,textAlign:'center'},cardFoot:{textAlign:'center',color:'#8b7c65',fontSize:11,letterSpacing:2},center:{textAlign:'center',color:'#aaa394'},nav:{flexDirection:'row',borderTopWidth:1,borderColor:'#343c38',backgroundColor:'#202623',paddingBottom:12},navItem:{flex:1,alignItems:'center',padding:14},navText:{color:'#8d958c'},navActive:{color:'#e9d1a0',fontWeight:'700'}});

const s = darkStyles;
const lightStyles = StyleSheet.create({
  ...darkStyles,
  root:{...darkStyles.root,backgroundColor:'#f5f1e8'},
  heading:{...darkStyles.heading,color:'#273a31'},
  section:{...darkStyles.section,color:'#34483b'},
  label:{...darkStyles.label,color:'#526457'},
  muted:{...darkStyles.muted,color:'#68756a'},
  body:{...darkStyles.body,color:'#33453a'},
  input:{...darkStyles.input,backgroundColor:'#e6e5da',color:'#263a30'},
  button:{...darkStyles.button,backgroundColor:'#d5ddd2',borderColor:'#adbaac'},
  selected:{...darkStyles.selected,backgroundColor:'#9aae9c'},
  buttonText:{...darkStyles.buttonText,color:'#263c30'},
  panel:{...darkStyles.panel,backgroundColor:'#e8e9de'},
  center:{...darkStyles.center,color:'#68756a'},
  nav:{...darkStyles.nav,backgroundColor:'#e6e9df',borderColor:'#c6d0c3'},
  navText:{...darkStyles.navText,color:'#667468'},
  navActive:{...darkStyles.navActive,color:'#345a40'},
});
