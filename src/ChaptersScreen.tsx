import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import * as repo from './repository';
import type { Card, Chapter, ChapterCardEntry, ThoughtSystem } from './types';
import { ActionButton, palette, TextField } from './ui';

type Mutation = <T>(action: () => Promise<T>) => Promise<{ ok: true; value: T } | { ok: false }>;

export function ChaptersScreen({
  cards,
  systems,
  chapters,
  focusChapterId,
  onFocusHandled,
  onGoSystems,
  onOpenCard,
  onReadChapter,
  mutate,
}: {
  cards: Card[];
  systems: ThoughtSystem[];
  chapters: Chapter[];
  focusChapterId: string | null;
  onFocusHandled: () => void;
  onGoSystems: () => void;
  onOpenCard: (cardId: string) => void;
  onReadChapter: (chapterId: string) => void;
  mutate: Mutation;
}) {
  const [systemSelectionId, setSystemSelectionId] = useState<string | null>(null);
  const [chapterSelectionId, setChapterSelectionId] = useState<string | null>(null);
  const [chapterCardState, setChapterCardState] = useState<{ chapterId: string; rows: ChapterCardEntry[] }>({ chapterId: '', rows: [] });
  const [chapterModal, setChapterModal] = useState<'create' | 'rename' | null>(null);
  const [chapterTitle, setChapterTitle] = useState('');
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const focusedChapter = chapters.find(chapter => chapter.id === focusChapterId);
  const systemId = focusedChapter?.systemId || (systems.some(system => system.id === systemSelectionId) ? systemSelectionId : systems[0]?.id || null);
  const chapterId = focusedChapter?.id || chapterSelectionId;
  const chapterCards = chapterCardState.chapterId === chapterId ? chapterCardState.rows : [];
  const activeSystem = systems.find(system => system.id === systemId);
  const activeChapter = chapters.find(chapter => chapter.id === chapterId);
  const systemChapters = useMemo(() => chapters.filter(chapter => chapter.systemId === systemId).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id)), [chapters, systemId]);

  useEffect(() => {
    if (!chapterId) return;
    let active = true;
    repo.listChapterCards(chapterId).then(rows => { if (active) setChapterCardState({ chapterId, rows }); }).catch(() => undefined);
    return () => { active = false; };
  }, [chapterId, cards, chapters]);

  const availableCards = useMemo(() => {
    const query = pickerSearch.trim().toLocaleLowerCase();
    return cards.filter(card => !chapterCards.some(entry => entry.id === card.id) && (!query || `${card.title}\n${card.content}`.toLocaleLowerCase().includes(query)));
  }, [cards, chapterCards, pickerSearch]);

  function openCreateChapter() { setChapterTitle(''); setChapterModal('create'); }
  function openRenameChapter() { setChapterTitle(activeChapter?.title || ''); setChapterModal('rename'); }
  async function saveChapter() {
    if (!chapterTitle.trim() || !systemId) return;
    const result = chapterModal === 'create'
      ? await mutate(() => repo.createChapter(systemId, chapterTitle))
      : activeChapter ? await mutate(() => repo.updateChapter(activeChapter.id, chapterTitle)) : { ok: false as const };
    if (result.ok) {
      if (chapterModal === 'create') setChapterSelectionId(result.value as string);
      setChapterModal(null);
    }
  }

  async function removeChapter() {
    if (!activeChapter) return;
    Alert.alert('删除章节', `“${activeChapter.title}”中的卡片会从该章节移除，卡片本身会保留。`, [
      { text: '取消', style: 'cancel' },
      { text: '删除章节', style: 'destructive', onPress: async () => { const result = await mutate(() => repo.deleteChapter(activeChapter.id)); if (result.ok) { setChapterSelectionId(null); onFocusHandled(); } } },
    ]);
  }

  async function addPickedCards() {
    if (!activeChapter || !pickedIds.length) { setPickerVisible(false); return; }
    const result = await mutate(() => repo.addCardsToChapter(activeChapter.id, pickedIds));
    if (result.ok) {
      setPickerVisible(false);
      setPickedIds([]);
      setPickerSearch('');
      setChapterCardState({ chapterId: activeChapter.id, rows: await repo.listChapterCards(activeChapter.id) });
    }
  }

  async function removeMember(entry: ChapterCardEntry) {
    if (!activeChapter) return;
    const result = await mutate(() => repo.removeCardFromChapter(activeChapter.id, entry.id));
    if (result.ok) setChapterCardState({ chapterId: activeChapter.id, rows: await repo.listChapterCards(activeChapter.id) });
  }

  async function persistCardOrder(data: ChapterCardEntry[]) {
    if (!activeChapter) return;
    const result = await mutate(() => repo.reorderChapterCards(activeChapter.id, data.map(item => item.id)));
    if (result.ok) setChapterCardState({ chapterId: activeChapter.id, rows: data.map((item, position) => ({ ...item, position })) });
    else setChapterCardState({ chapterId: activeChapter.id, rows: await repo.listChapterCards(activeChapter.id) });
  }

  if (activeChapter) return <View style={styles.flex}>
    <View style={styles.detailHeader}>
      <ActionButton label="‹ 章节" onPress={() => { setChapterSelectionId(null); onFocusHandled(); }} tone="quiet" compact />
      <View style={styles.detailHeading}><Text style={styles.kicker}>{activeSystem?.title || '思想体系'}</Text><Text numberOfLines={1} style={styles.detailTitle}>{activeChapter.title}</Text></View>
      <ActionButton label="•••" onPress={() => Alert.alert(activeChapter.title, undefined, [
        { text: '重命名', onPress: openRenameChapter },
        { text: '删除章节', style: 'destructive', onPress: removeChapter },
        { text: '取消', style: 'cancel' },
      ])} tone="quiet" compact />
    </View>
    <View style={styles.chapterActions}>
      <ActionButton label="连续阅读" onPress={() => onReadChapter(activeChapter.id)} tone="primary" />
      <ActionButton label="＋ 添加已有卡片" onPress={() => { setPickedIds([]); setPickerSearch(''); setPickerVisible(true); }} />
    </View>
    <Text style={styles.orderHint}>长按右侧 ≡ 拖动排序 · 卡片可以出现在多个章节</Text>
    <DraggableFlatList
      data={chapterCards}
      keyExtractor={item => item.id}
      onDragEnd={({ data }) => { void persistCardOrder(data); }}
      activationDistance={8}
      ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyMark}>✦</Text><Text style={styles.emptyText}>本章还没有卡片</Text><Text style={styles.muted}>从已有卡片中添加，不会复制内容。</Text></View>}
      contentContainerStyle={styles.memberList}
      renderItem={({ item, drag, isActive }: RenderItemParams<ChapterCardEntry>) => <ScaleDecorator>
        <View style={[styles.memberRow, isActive && styles.memberActive]}>
          <Pressable accessibilityRole="button" accessibilityLabel={`拖动 ${item.title}`} onLongPress={drag} delayLongPress={180} style={styles.dragHandle}><Text style={styles.dragGlyph}>≡</Text></Pressable>
          <Pressable onPress={() => onOpenCard(item.id)} style={styles.memberText}><Text numberOfLines={2} style={styles.memberTitle}>{item.title}</Text><Text numberOfLines={1} style={styles.memberPreview}>{item.content || '暂无正文'}</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`从本章移除 ${item.title}`} onPress={() => void removeMember(item)} style={styles.removeMember}><Text style={styles.removeGlyph}>×</Text></Pressable>
        </View>
      </ScaleDecorator>}
    />
    <ChapterNameModal visible={chapterModal !== null} title={chapterModal === 'create' ? '新建章节' : '重命名章节'} value={chapterTitle} onChange={setChapterTitle} onCancel={() => setChapterModal(null)} onSave={() => void saveChapter()} />
    <CardPicker visible={pickerVisible} cards={availableCards} search={pickerSearch} pickedIds={pickedIds} onSearch={setPickerSearch} onToggle={id => setPickedIds(values => values.includes(id) ? values.filter(value => value !== id) : [...values, id])} onCancel={() => setPickerVisible(false)} onAdd={() => void addPickedCards()} />
  </View>;

  return <ScrollView contentContainerStyle={styles.container}>
    <View style={styles.topline}><View><Text style={styles.eyebrow}>CHAPTERS</Text><Text style={styles.title}>章节</Text></View><Text style={styles.count}>{chapters.length} 章</Text></View>
    <Text style={styles.intro}>把相关卡片排成章节，按顺序读出一段思路。</Text>
    {!systems.length ? <View style={styles.empty}>
      <Text style={styles.emptyMark}>✦</Text><Text style={styles.emptyText}>章节属于一个思想体系</Text><Text style={styles.muted}>先创建体系，再开始组织章节。</Text><View style={styles.emptyButton}><ActionButton label="去创建思想体系" onPress={onGoSystems} tone="primary" /></View>
    </View> : <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.systemPicker}>
        {systems.map(system => <Pressable key={system.id} onPress={() => { setSystemSelectionId(system.id); setChapterSelectionId(null); }} style={[styles.systemChip, system.id === systemId && styles.systemChipSelected]}><Text numberOfLines={1} style={[styles.systemChipText, system.id === systemId && styles.systemChipTextSelected]}>{system.title}</Text></Pressable>)}
      </ScrollView>
      <View style={styles.chapterListHeader}><Text style={styles.sectionTitle}>{activeSystem?.title || '章节'}</Text><ActionButton label="＋ 新建" onPress={openCreateChapter} compact tone="primary" /></View>
      {systemChapters.length ? systemChapters.map((chapter, index) => <Pressable key={chapter.id} onPress={() => setChapterSelectionId(chapter.id)} style={styles.chapterRow}>
        <Text style={styles.chapterIndex}>{String(index + 1).padStart(2, '0')}</Text><View style={styles.chapterCopy}><Text style={styles.chapterTitle}>{chapter.title}</Text><Text style={styles.chapterSubtitle}>{chapter.cardCount ?? 0} 张卡片 · 点击打开</Text></View><Text style={styles.chevron}>›</Text>
      </Pressable>) : <View style={styles.emptyCompact}><Text style={styles.muted}>这个体系还没有章节。先创建第一章。</Text></View>}
    </>}
    <ChapterNameModal visible={chapterModal !== null} title={chapterModal === 'create' ? '新建章节' : '重命名章节'} value={chapterTitle} onChange={setChapterTitle} onCancel={() => setChapterModal(null)} onSave={() => void saveChapter()} />
  </ScrollView>;
}

function ChapterNameModal({ visible, title, value, onChange, onCancel, onSave }: { visible: boolean; title: string; value: string; onChange: (value: string) => void; onCancel: () => void; onSave: () => void }) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
    <View style={styles.modalBackdrop}><View style={styles.modalCard}><Text style={styles.modalTitle}>{title}</Text><TextField value={value} onChangeText={onChange} placeholder="章节名称" autoFocus /><View style={styles.modalActions}><ActionButton label="取消" onPress={onCancel} /><ActionButton label="保存" onPress={onSave} tone="primary" disabled={!value.trim()} /></View></View></View>
  </Modal>;
}

function CardPicker({ visible, cards, search, pickedIds, onSearch, onToggle, onCancel, onAdd }: { visible: boolean; cards: Card[]; search: string; pickedIds: string[]; onSearch: (value: string) => void; onToggle: (id: string) => void; onCancel: () => void; onAdd: () => void }) {
  return <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
    <View style={styles.pickerRoot}><View style={styles.pickerTop}><View><Text style={styles.eyebrow}>ADD TO CHAPTER</Text><Text style={styles.modalTitle}>添加已有卡片</Text></View><ActionButton label="关闭" onPress={onCancel} compact /></View>
      <TextInput value={search} onChangeText={onSearch} placeholder="搜索卡片" placeholderTextColor="#938d80" style={styles.pickerSearch} />
      <Text style={styles.pickerHint}>选中的卡片会添加到本章，原卡片不会移动或复制。</Text>
      <ScrollView style={styles.pickerList} keyboardShouldPersistTaps="handled">
        {cards.length ? cards.map(card => <Pressable key={card.id} onPress={() => onToggle(card.id)} style={styles.pickerRow}><View style={[styles.checkbox, pickedIds.includes(card.id) && styles.checkboxSelected]}>{pickedIds.includes(card.id) ? <Text style={styles.checkMark}>✓</Text> : null}</View><View style={styles.pickerCopy}><Text style={styles.memberTitle}>{card.title}</Text><Text numberOfLines={1} style={styles.memberPreview}>{card.content || '暂无正文'}</Text></View></Pressable>) : <Text style={styles.muted}>没有可添加的卡片。</Text>}
      </ScrollView>
      <View style={styles.pickerBottom}><ActionButton label={`添加 ${pickedIds.length} 张卡片`} onPress={onAdd} tone="primary" disabled={!pickedIds.length} /></View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  flex: { flex: 1, paddingHorizontal: 20, paddingTop: 14 },
  container: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 30 },
  topline: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  eyebrow: { color: palette.gold, fontSize: 10, letterSpacing: 3, marginBottom: 7 },
  title: { color: palette.ink, fontSize: 30, fontWeight: '700' },
  count: { color: palette.gold, fontSize: 13, paddingBottom: 5 },
  intro: { color: palette.muted, fontSize: 14, lineHeight: 21, marginTop: 7, marginBottom: 20 },
  systemPicker: { gap: 8, paddingVertical: 5 },
  systemChip: { maxWidth: 220, borderRadius: 99, borderWidth: 1, borderColor: palette.line, backgroundColor: '#f8f5ed', paddingHorizontal: 15, paddingVertical: 10 },
  systemChipSelected: { borderColor: palette.green, backgroundColor: palette.green },
  systemChipText: { color: palette.ink, fontSize: 13, fontWeight: '600' },
  systemChipTextSelected: { color: '#fffaf1' },
  chapterListHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 8 },
  sectionTitle: { color: palette.ink, fontSize: 18, fontWeight: '700' },
  chapterRow: { flexDirection: 'row', alignItems: 'center', minHeight: 78, paddingHorizontal: 14, paddingVertical: 11, marginVertical: 5, borderRadius: 15, backgroundColor: palette.paper, borderWidth: 1, borderColor: palette.line },
  chapterIndex: { color: palette.gold, width: 42, fontSize: 17, fontWeight: '600' },
  chapterCopy: { flex: 1 },
  chapterTitle: { color: palette.ink, fontSize: 16, fontWeight: '600' },
  chapterSubtitle: { color: palette.muted, fontSize: 12, marginTop: 5 },
  chevron: { color: palette.gold, fontSize: 27, paddingHorizontal: 8 },
  empty: { alignItems: 'center', backgroundColor: '#ebe5d8', borderRadius: 18, padding: 25, marginTop: 10 },
  emptyCompact: { padding: 19, backgroundColor: '#ebe5d8', borderRadius: 14, marginTop: 6 },
  emptyMark: { color: palette.gold, fontSize: 42, marginBottom: 9 },
  emptyText: { color: palette.ink, fontSize: 18, fontWeight: '600', marginBottom: 5 },
  muted: { color: palette.muted, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  emptyButton: { marginTop: 18, width: '100%' },
  detailHeader: { flexDirection: 'row', alignItems: 'center', minHeight: 58, gap: 4 },
  detailHeading: { flex: 1, paddingHorizontal: 4 },
  kicker: { color: palette.gold, fontSize: 10, letterSpacing: 1.8, marginBottom: 2 },
  detailTitle: { color: palette.ink, fontSize: 19, fontWeight: '700' },
  chapterActions: { flexDirection: 'row', gap: 9, marginTop: 13, marginBottom: 8 },
  orderHint: { color: palette.muted, fontSize: 12, marginVertical: 6 },
  memberList: { paddingBottom: 24, flexGrow: 1 },
  memberRow: { flexDirection: 'row', alignItems: 'center', minHeight: 72, marginVertical: 5, borderRadius: 14, paddingHorizontal: 8, backgroundColor: palette.paper, borderWidth: 1, borderColor: palette.line },
  memberActive: { backgroundColor: '#eee4cf', borderColor: palette.gold, shadowColor: palette.shadow, shadowOpacity: .16, shadowRadius: 9, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  dragHandle: { width: 42, height: 54, justifyContent: 'center', alignItems: 'center' },
  dragGlyph: { color: palette.gold, fontSize: 25 },
  memberText: { flex: 1, paddingVertical: 11, paddingRight: 8 },
  memberTitle: { color: palette.ink, fontSize: 15, fontWeight: '600' },
  memberPreview: { color: palette.muted, fontSize: 12, marginTop: 4 },
  removeMember: { width: 38, height: 46, justifyContent: 'center', alignItems: 'center' },
  removeGlyph: { color: palette.muted, fontSize: 24 },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(31,36,31,.42)' },
  modalCard: { borderRadius: 18, backgroundColor: palette.page, padding: 20, borderWidth: 1, borderColor: palette.line },
  modalTitle: { color: palette.ink, fontSize: 21, fontWeight: '700', marginBottom: 9 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 9, marginTop: 12 },
  pickerRoot: { flex: 1, paddingTop: 55, paddingHorizontal: 20, backgroundColor: palette.page },
  pickerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerSearch: { minHeight: 46, borderRadius: 13, backgroundColor: palette.paper, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 14, marginTop: 15, color: palette.ink, fontSize: 15 },
  pickerHint: { color: palette.muted, fontSize: 12, marginTop: 7, marginBottom: 9 },
  pickerList: { flex: 1 },
  pickerRow: { minHeight: 67, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, borderBottomWidth: 1, borderColor: palette.line },
  pickerCopy: { flex: 1 },
  checkbox: { width: 23, height: 23, borderRadius: 7, borderWidth: 1.5, borderColor: '#b9b2a5', marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  checkboxSelected: { backgroundColor: palette.green, borderColor: palette.green },
  checkMark: { color: '#fffaf1', fontSize: 14, fontWeight: '700' },
  pickerBottom: { paddingVertical: 12 },
});
