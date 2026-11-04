import React, { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import * as repo from './repository';
import type { Chapter, ThoughtSystem } from './types';
import { ActionButton, cardSurface, palette, SectionLabel, TextField } from './ui';

type Mutation = <T>(action: () => Promise<T>) => Promise<{ ok: true; value: T } | { ok: false }>;

export function SystemsScreen({
  systems,
  chapters,
  onOpenChapter,
  onReadSystem,
  onExportSystem,
  mutate,
}: {
  systems: ThoughtSystem[];
  chapters: Chapter[];
  onOpenChapter: (chapterId: string) => void;
  onReadSystem: (systemId: string) => void;
  onExportSystem: (systemId: string) => void;
  mutate: Mutation;
}) {
  const [systemId, setSystemId] = useState<string | null>(null);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingSystemId, setEditingSystemId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [chapterModalVisible, setChapterModalVisible] = useState(false);
  const [chapterTitle, setChapterTitle] = useState('');
  const activeSystem = systems.find(system => system.id === systemId);
  const systemChapters = useMemo(() => chapters.filter(chapter => chapter.systemId === systemId).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id)), [chapters, systemId]);

  function openCreate() { setEditingSystemId(null); setTitle(''); setDescription(''); setEditorVisible(true); }
  function openRename() {
    if (!activeSystem) return;
    setEditingSystemId(activeSystem.id); setTitle(activeSystem.title); setDescription(activeSystem.description); setEditorVisible(true);
  }
  async function saveSystem() {
    if (!title.trim()) return;
    const result = editingSystemId
      ? await mutate(() => repo.updateSystem(editingSystemId, title, description))
      : await mutate(() => repo.createSystem(title, description));
    if (result.ok) {
      if (!editingSystemId) setSystemId(result.value as string);
      setEditorVisible(false);
    }
  }
  async function saveChapter() {
    if (!activeSystem || !chapterTitle.trim()) return;
    const result = await mutate(() => repo.createChapter(activeSystem.id, chapterTitle));
    if (result.ok) { setChapterModalVisible(false); setChapterTitle(''); }
  }
  function removeSystem() {
    if (!activeSystem) return;
    Alert.alert('删除思想体系', `“${activeSystem.title}”及其章节和章节顺序将被删除，思想卡片会保留。`, [
      { text: '取消', style: 'cancel' },
      { text: '删除体系', style: 'destructive', onPress: async () => { const result = await mutate(() => repo.deleteSystem(activeSystem.id)); if (result.ok) setSystemId(null); } },
    ]);
  }
  async function saveChapterOrder(data: Chapter[]) {
    if (!activeSystem) return;
    const result = await mutate(() => repo.reorderChapters(activeSystem.id, data.map(chapter => chapter.id)));
    if (!result.ok) return;
  }

  if (activeSystem) return <View style={styles.flex}>
    <View style={styles.detailHeader}>
      <ActionButton label="‹ 体系" onPress={() => setSystemId(null)} tone="quiet" compact />
      <View style={styles.headerText}><Text style={styles.eyebrow}>THOUGHT SYSTEM</Text><Text numberOfLines={1} style={styles.title}>{activeSystem.title}</Text></View>
      <ActionButton label="编辑" onPress={openRename} compact />
    </View>
    {!!activeSystem.description && <Text style={styles.description}>{activeSystem.description}</Text>}
    <View style={styles.actions}>
      <ActionButton label="连续阅读" onPress={() => onReadSystem(activeSystem.id)} tone="primary" />
      <ActionButton label="导出 Markdown" onPress={() => onExportSystem(activeSystem.id)} />
    </View>
    <View style={styles.chapterHead}>
      <View><SectionLabel>体系章节</SectionLabel><Text style={styles.hint}>长按右侧 ≡ 拖动调整顺序</Text></View>
      <ActionButton label="＋ 章节" onPress={() => { setChapterTitle(''); setChapterModalVisible(true); }} compact tone="primary" />
    </View>
    <DraggableFlatList
      data={systemChapters}
      keyExtractor={chapter => chapter.id}
      onDragEnd={({ data }) => { void saveChapterOrder(data); }}
      activationDistance={8}
      ListEmptyComponent={<View style={styles.emptyCompact}><Text style={styles.muted}>还没有章节。在这里创建，或前往“章节”整理卡片。</Text></View>}
      contentContainerStyle={styles.chapterList}
      renderItem={({ item, drag, isActive, getIndex }: RenderItemParams<Chapter>) => <ScaleDecorator>
        <View style={[styles.chapterRow, isActive && styles.chapterActive]}>
          <Pressable accessibilityRole="button" accessibilityLabel={`拖动 ${item.title}`} onLongPress={drag} delayLongPress={180} style={styles.dragHandle}><Text style={styles.dragGlyph}>≡</Text></Pressable>
          <Pressable onPress={() => onOpenChapter(item.id)} style={styles.chapterText}>
            <Text style={styles.chapterIndex}>{String((getIndex() ?? 0) + 1).padStart(2, '0')}</Text><View style={styles.chapterCopy}><Text numberOfLines={1} style={styles.chapterTitle}>{item.title}</Text><Text style={styles.chapterSubtitle}>{item.cardCount ?? 0} 张卡片</Text></View>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`打开 ${item.title}`} onPress={() => onOpenChapter(item.id)} style={styles.chevron}><Text style={styles.chevronText}>›</Text></Pressable>
        </View>
      </ScaleDecorator>}
    />
    <View style={styles.bottomAction}><ActionButton label="删除体系" onPress={removeSystem} tone="danger" /></View>
    <SystemEditor visible={editorVisible} title={editingSystemId ? '编辑思想体系' : '新建思想体系'} name={title} description={description} onName={setTitle} onDescription={setDescription} onClose={() => setEditorVisible(false)} onSave={() => void saveSystem()} />
    <ChapterEditor visible={chapterModalVisible} value={chapterTitle} onChange={setChapterTitle} onClose={() => setChapterModalVisible(false)} onSave={() => void saveChapter()} />
  </View>;

  return <ScrollView contentContainerStyle={styles.container}>
    <View style={styles.topline}><View><Text style={styles.eyebrow}>SYSTEMS</Text><Text style={styles.title}>思想体系</Text></View><ActionButton label="＋ 新建" onPress={openCreate} tone="primary" compact /></View>
    <Text style={styles.descriptionIntro}>让章节依次展开，构成一套完整的思想。</Text>
    {systems.length ? systems.map((system, index) => {
      const count = chapters.filter(chapter => chapter.systemId === system.id).length;
      return <Pressable key={system.id} onPress={() => setSystemId(system.id)} style={styles.systemCard}>
        <View style={styles.systemTop}><Text style={styles.systemIndex}>{String(index + 1).padStart(2, '0')}</Text><Text style={styles.systemMark}>✦</Text></View>
        <Text style={styles.systemTitle}>{system.title}</Text>
        <Text numberOfLines={2} style={styles.systemDescription}>{system.description || '还没有简介'}</Text>
        <View style={styles.systemBottom}><Text style={styles.systemMeta}>{count} 个章节</Text><Text style={styles.openText}>打开体系　›</Text></View>
      </Pressable>;
    }) : <View style={styles.empty}>
      <Text style={styles.emptyMark}>✦</Text><Text style={styles.emptyTitle}>让思想拥有自己的结构</Text><Text style={styles.muted}>创建体系，再将章节按顺序组合起来。</Text><View style={styles.emptyButton}><ActionButton label="创建第一个体系" onPress={openCreate} tone="primary" /></View>
    </View>}
    <SystemEditor visible={editorVisible} title={editingSystemId ? '编辑思想体系' : '新建思想体系'} name={title} description={description} onName={setTitle} onDescription={setDescription} onClose={() => setEditorVisible(false)} onSave={() => void saveSystem()} />
  </ScrollView>;
}

function SystemEditor({ visible, title, name, description, onName, onDescription, onClose, onSave }: { visible: boolean; title: string; name: string; description: string; onName: (value: string) => void; onDescription: (value: string) => void; onClose: () => void; onSave: () => void }) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.modalBackdrop}><View style={styles.modalCard}><Text style={styles.modalTitle}>{title}</Text><TextField value={name} onChangeText={onName} placeholder="体系名称" autoFocus /><TextField value={description} onChangeText={onDescription} placeholder="一句话简介（可选）" multiline /><View style={styles.modalActions}><ActionButton label="取消" onPress={onClose} /><ActionButton label="保存" onPress={onSave} tone="primary" disabled={!name.trim()} /></View></View></View>
  </Modal>;
}

function ChapterEditor({ visible, value, onChange, onClose, onSave }: { visible: boolean; value: string; onChange: (value: string) => void; onClose: () => void; onSave: () => void }) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.modalBackdrop}><View style={styles.modalCard}><Text style={styles.modalTitle}>新建章节</Text><TextField value={value} onChangeText={onChange} placeholder="章节名称" autoFocus /><View style={styles.modalActions}><ActionButton label="取消" onPress={onClose} /><ActionButton label="创建" onPress={onSave} tone="primary" disabled={!value.trim()} /></View></View></View>
  </Modal>;
}

const styles = StyleSheet.create({
  flex: { flex: 1, paddingHorizontal: 20, paddingTop: 14 },
  container: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 30 },
  topline: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  eyebrow: { color: palette.gold, fontSize: 10, letterSpacing: 3, marginBottom: 7 },
  title: { color: palette.ink, fontSize: 27, fontWeight: '700', flex: 1 },
  descriptionIntro: { color: palette.muted, fontSize: 14, marginTop: 8, marginBottom: 16, lineHeight: 21 },
  systemCard: { ...cardSurface, padding: 17, marginVertical: 7, minHeight: 170, shadowColor: palette.shadow, shadowOpacity: .06, shadowRadius: 9, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  systemTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  systemIndex: { color: palette.gold, fontSize: 12, letterSpacing: 2 },
  systemMark: { color: palette.gold, fontSize: 20 },
  systemTitle: { color: palette.ink, fontSize: 22, fontWeight: '700' },
  systemDescription: { color: palette.muted, fontSize: 13, lineHeight: 20, marginTop: 6, minHeight: 20 },
  systemBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  systemMeta: { color: palette.gold, fontSize: 12 },
  openText: { color: palette.green, fontSize: 12, fontWeight: '700' },
  empty: { alignItems: 'center', backgroundColor: '#ebe5d8', borderRadius: 18, padding: 25, marginTop: 8 },
  emptyMark: { color: palette.gold, fontSize: 44, marginBottom: 10 },
  emptyTitle: { color: palette.ink, fontSize: 18, fontWeight: '600', marginBottom: 5, textAlign: 'center' },
  muted: { color: palette.muted, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  emptyButton: { width: '100%', marginTop: 18 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', minHeight: 58, gap: 4 },
  headerText: { flex: 1, paddingHorizontal: 4 },
  actions: { flexDirection: 'row', gap: 9, marginTop: 13, marginBottom: 7 },
  description: { color: palette.muted, fontSize: 14, lineHeight: 21, marginVertical: 8 },
  chapterHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 2, marginBottom: 4 },
  hint: { color: palette.muted, fontSize: 11, marginTop: -3 },
  chapterList: { paddingBottom: 12, flexGrow: 1 },
  chapterRow: { flexDirection: 'row', alignItems: 'center', minHeight: 72, borderRadius: 14, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.paper, marginVertical: 5, paddingHorizontal: 5 },
  chapterActive: { borderColor: palette.gold, backgroundColor: '#efe5d1', shadowColor: palette.shadow, shadowOpacity: .15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  dragHandle: { width: 39, height: 55, alignItems: 'center', justifyContent: 'center' },
  dragGlyph: { color: palette.gold, fontSize: 24 },
  chapterText: { flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: 64 },
  chapterIndex: { width: 37, color: palette.gold, fontSize: 14, fontWeight: '700' },
  chapterCopy: { flex: 1 },
  chapterTitle: { color: palette.ink, fontSize: 15, fontWeight: '600' },
  chapterSubtitle: { color: palette.muted, fontSize: 12, marginTop: 4 },
  chevron: { width: 37, height: 54, alignItems: 'center', justifyContent: 'center' },
  chevronText: { color: palette.gold, fontSize: 25 },
  emptyCompact: { backgroundColor: '#ebe5d8', borderRadius: 14, padding: 18, marginTop: 8 },
  bottomAction: { paddingTop: 6, paddingBottom: 6 },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 23, backgroundColor: 'rgba(31,36,31,.42)' },
  modalCard: { borderRadius: 18, backgroundColor: palette.page, padding: 20, borderWidth: 1, borderColor: palette.line },
  modalTitle: { color: palette.ink, fontSize: 21, fontWeight: '700', marginBottom: 8 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 9, marginTop: 12 },
});
