import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { CardsScreen } from './CardsScreen';
import { ChaptersScreen } from './ChaptersScreen';
import { SystemsScreen } from './SystemsScreen';
import { CardEditorModal } from './CardEditorModal';
import { CardDetailModal } from './CardDetailModal';
import { LinkPicker } from './LinkPicker';
import { BackupModal } from './BackupModal';
import { ReadingDocument, ReadingOverlay } from './ReadingOverlay';
import { formatSystemMarkdown } from './cardFormats';
import { useLibraryStore } from './store';
import type { Card } from './types';
import * as repo from './repository';
import { palette } from './ui';

type MainTab = 'cards' | 'chapters' | 'systems';

export default function NoesisApp() {
  const { cards, cardLinks, systems, chapters, refresh } = useLibraryStore();
  const [tab, setTab] = useState<MainTab>('cards');
  const [booting, setBooting] = useState(true);
  const [cardEditorVisible, setCardEditorVisible] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [detailCardId, setDetailCardId] = useState<string | null>(null);
  const [linkSourceId, setLinkSourceId] = useState<string | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [focusChapterId, setFocusChapterId] = useState<string | null>(null);
  const [backupVisible, setBackupVisible] = useState(false);
  const [readingDocument, setReadingDocument] = useState<ReadingDocument | null>(null);

  useEffect(() => {
    let active = true;
    refresh().catch(error => {
      if (active) Alert.alert('打开牌库失败', error instanceof Error ? error.message : String(error));
    }).finally(() => { if (active) setBooting(false); });
    return () => { active = false; };
  }, [refresh]);

  const mutate = useCallback(async <T,>(action: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false }> => {
    try {
      const value = await action();
      await refresh();
      return { ok: true, value };
    } catch (error) {
      Alert.alert('操作失败', error instanceof Error ? error.message : String(error));
      return { ok: false };
    }
  }, [refresh]);

  const detailCard = cards.find(card => card.id === detailCardId) || null;
  const linkSource = cards.find(card => card.id === linkSourceId) || null;
  const detailLinks = useMemo(() => {
    if (!detailCard) return [];
    const ids = cardLinks.filter(link => link.sourceCardId === detailCard.id || link.targetCardId === detailCard.id)
      .map(link => link.sourceCardId === detailCard.id ? link.targetCardId : link.sourceCardId);
    return cards.filter(card => ids.includes(card.id));
  }, [cardLinks, cards, detailCard]);

  function editCard(card: Card | null) { setEditingCard(card); setCardEditorVisible(true); }
  async function saveCard(title: string, content: string, id?: string) {
    const result = await mutate(() => repo.saveCard({ id, title, content }));
    if (result.ok) {
      setCardEditorVisible(false);
      setEditingCard(null);
      setDetailCardId(null);
      setActiveCardId(result.value);
      setTab('cards');
    }
  }

  function deleteCard(card: Card) {
    Alert.alert('删除卡片', `“${card.title}”将从卡片列表、章节和新关联中移除。旧版本记录仍保存在完整 JSON 备份内。`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: async () => {
        const result = await mutate(() => repo.deleteThought(card.id));
        if (result.ok) { setDetailCardId(null); setActiveCardId(null); }
      } },
    ]);
  }

  async function openChapterReader(chapterId: string) {
    const chapter = chapters.find(item => item.id === chapterId);
    if (!chapter) return;
    const chapterCards = await repo.listChapterCards(chapterId);
    setReadingDocument({ title: chapter.title, chapters: [{ title: '卡片顺序', cards: chapterCards }] });
  }

  async function openSystemReader(systemId: string) {
    const document = await repo.getSystemDocument(systemId);
    setReadingDocument({ title: document.system.title, description: document.system.description, chapters: document.chapters.map(chapter => ({ title: chapter.title, cards: chapter.cards })) });
  }

  async function exportSystem(systemId: string) {
    try {
      const document = await repo.getSystemDocument(systemId);
      const fileName = `${document.system.title.replace(/[\\/:*?"<>|]/g, '-').trim() || 'noesis-system'}.md`;
      const file = new File(Paths.cache, fileName);
      file.create({ overwrite: true });
      file.write(formatSystemMarkdown(document));
      await Sharing.shareAsync(file.uri);
    } catch (error) {
      Alert.alert('导出失败', error instanceof Error ? error.message : String(error));
    }
  }

  function openChapter(chapterId: string) { setFocusChapterId(chapterId); setTab('chapters'); }

  return <GestureHandlerRootView style={styles.flex}>
    <StatusBar style="dark" />
    <SafeAreaView style={styles.root}>
      <View style={styles.brandBar}>
        <View style={styles.brandMark}><Text style={styles.brandStar}>✦</Text></View>
        <Text style={styles.brand}>NOESIS</Text>
        <Text style={styles.brandHint}>思想的结构</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="备份与恢复" onPress={() => setBackupVisible(true)} style={styles.backupButton}>
          <Text style={styles.backupIcon}>↥</Text><Text style={styles.backupText}>备份</Text>
        </Pressable>
      </View>
      <View style={styles.content}>
        {booting ? <View style={styles.loading}><Text style={styles.brandStar}>✦</Text><Text style={styles.loadingText}>正在打开你的思想牌库…</Text></View> : tab === 'cards' ? <CardsScreen
          cards={cards}
          links={cardLinks}
          activeCardId={activeCardId}
          onSelectCard={setActiveCardId}
          onCreate={() => editCard(null)}
          onEdit={editCard}
          onRead={card => setDetailCardId(card.id)}
          onLink={card => setLinkSourceId(card.id)}
          onDelete={deleteCard}
          onOpenLinked={card => { setActiveCardId(card.id); setDetailCardId(card.id); }}
        /> : tab === 'chapters' ? <ChaptersScreen
          cards={cards}
          systems={systems}
          chapters={chapters}
          focusChapterId={focusChapterId}
          onFocusHandled={() => setFocusChapterId(null)}
          onGoSystems={() => setTab('systems')}
          onOpenCard={cardId => { setActiveCardId(cardId); setDetailCardId(cardId); }}
          onReadChapter={chapterId => { void openChapterReader(chapterId).catch(error => Alert.alert('无法打开章节', String(error))); }}
          mutate={mutate}
        /> : <SystemsScreen
          systems={systems}
          chapters={chapters}
          onOpenChapter={openChapter}
          onReadSystem={systemId => { void openSystemReader(systemId).catch(error => Alert.alert('无法打开体系', String(error))); }}
          onExportSystem={systemId => { void exportSystem(systemId); }}
          mutate={mutate}
        />}
      </View>
      <View style={styles.tabBar}>
        {([
          ['cards', '卡片', '♧'],
          ['chapters', '章节', '☷'],
          ['systems', '体系', '✦'],
        ] as const).map(([id, label, mark]) => <Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected: tab === id }} onPress={() => setTab(id)} style={styles.tabItem}>
          <Text style={[styles.tabIcon, tab === id && styles.tabIconActive]}>{mark}</Text><Text style={[styles.tabLabel, tab === id && styles.tabLabelActive]}>{label}</Text>
        </Pressable>)}
      </View>
      <View pointerEvents="none" style={styles.routeSink}><Slot /></View>
    </SafeAreaView>
    <CardEditorModal visible={cardEditorVisible} card={editingCard} onClose={() => { setCardEditorVisible(false); setEditingCard(null); }} onSave={(title, content, id) => { void saveCard(title, content, id); }} />
    <CardDetailModal
      card={detailCard}
      linkedCards={detailLinks}
      onClose={() => setDetailCardId(null)}
      onEdit={() => { if (detailCard) { setDetailCardId(null); editCard(detailCard); } }}
      onLink={() => { if (detailCard) setLinkSourceId(detailCard.id); }}
      onDelete={() => { if (detailCard) deleteCard(detailCard); }}
      onOpenRelated={card => { setActiveCardId(card.id); setDetailCardId(card.id); }}
    />
    <LinkPicker source={linkSource} cards={cards} links={cardLinks} onClose={() => setLinkSourceId(null)} onChoose={targetId => {
      if (!linkSourceId) return;
      void mutate(() => repo.addCardLink(linkSourceId, targetId)).then(result => { if (result.ok) setLinkSourceId(null); });
    }} />
    <BackupModal visible={backupVisible} onClose={() => setBackupVisible(false)} mutate={mutate} />
    <ReadingOverlay document={readingDocument} onClose={() => setReadingDocument(null)} />
  </GestureHandlerRootView>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, backgroundColor: palette.page },
  brandBar: { minHeight: 49, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: '#e0dacf' },
  brandMark: { width: 26, height: 26, borderRadius: 8, backgroundColor: '#e6ddcd', alignItems: 'center', justifyContent: 'center', marginRight: 7 },
  brandStar: { color: palette.gold, fontSize: 16 },
  brand: { color: palette.ink, fontSize: 13, fontWeight: '800', letterSpacing: 2.2 },
  brandHint: { color: palette.muted, fontSize: 10, marginLeft: 8, paddingTop: 2 },
  backupButton: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 9, backgroundColor: '#e9e3d7' },
  backupIcon: { color: palette.green, fontSize: 15, fontWeight: '700' },
  backupText: { color: palette.ink, fontSize: 11, fontWeight: '600' },
  content: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: palette.muted, fontSize: 13, marginTop: 7 },
  tabBar: { minHeight: 63, flexDirection: 'row', borderTopWidth: 1, borderColor: '#ddd6c8', backgroundColor: '#f7f4ed', paddingBottom: 4 },
  tabItem: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 7 },
  tabIcon: { color: '#a49d8f', fontSize: 18, marginBottom: 2 },
  tabIconActive: { color: palette.gold },
  tabLabel: { color: '#918d82', fontSize: 11 },
  tabLabelActive: { color: palette.green, fontWeight: '700' },
  routeSink: { position: 'absolute', width: 0, height: 0, overflow: 'hidden' },
});
