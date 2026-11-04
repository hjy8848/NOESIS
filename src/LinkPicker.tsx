import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Card, CardLink } from './types';
import { ActionButton, palette } from './ui';

export function LinkPicker({ source, cards, links, onClose, onChoose }: { source: Card | null; cards: Card[]; links: CardLink[]; onClose: () => void; onChoose: (targetId: string) => void }) {
  const [search, setSearch] = useState('');
  const candidates = useMemo(() => {
    if (!source) return [];
    const linkedIds = new Set(links.filter(link => link.sourceCardId === source.id || link.targetCardId === source.id).map(link => link.sourceCardId === source.id ? link.targetCardId : link.sourceCardId));
    const query = search.trim().toLocaleLowerCase();
    return cards.filter(card => card.id !== source.id && !linkedIds.has(card.id) && (!query || `${card.title}\n${card.content}`.toLocaleLowerCase().includes(query)));
  }, [cards, links, search, source]);

  return <Modal visible={!!source} animationType="slide" onRequestClose={onClose}>
    <View style={styles.root}>
      <View style={styles.header}><View style={styles.copy}><Text style={styles.kicker}>CONNECT THOUGHTS</Text><Text numberOfLines={1} style={styles.title}>关联到另一张卡片</Text><Text numberOfLines={1} style={styles.source}>从「{source?.title || ''}」出发</Text></View><ActionButton label="关闭" onPress={onClose} compact /></View>
      <TextInput value={search} onChangeText={setSearch} placeholder="搜索卡片" placeholderTextColor="#938d80" style={styles.search} />
      <Text style={styles.hint}>关联按无向关系保存，两张卡片都会显示它。</Text>
      <ScrollView style={styles.list}>
        {candidates.length ? candidates.map(card => <Pressable key={card.id} onPress={() => onChoose(card.id)} style={styles.row}><View style={styles.mark}><Text style={styles.plus}>＋</Text></View><View style={styles.rowCopy}><Text style={styles.cardTitle}>{card.title}</Text><Text numberOfLines={1} style={styles.preview}>{card.content || '暂无正文'}</Text></View></Pressable>) : <Text style={styles.empty}>没有可关联的卡片。</Text>}
      </ScrollView>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20, paddingTop: 50, backgroundColor: palette.page },
  header: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  copy: { flex: 1 },
  kicker: { color: palette.gold, fontSize: 9, letterSpacing: 2, marginBottom: 3 },
  title: { color: palette.ink, fontSize: 19, fontWeight: '700' },
  source: { color: palette.muted, fontSize: 12, marginTop: 4 },
  search: { minHeight: 46, borderRadius: 13, backgroundColor: palette.paper, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 14, marginTop: 18, color: palette.ink, fontSize: 15 },
  hint: { color: palette.muted, fontSize: 12, marginTop: 8, marginBottom: 7 },
  list: { flex: 1 },
  row: { minHeight: 68, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, borderBottomWidth: 1, borderColor: palette.line },
  mark: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#e8e0d0', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  plus: { color: palette.green, fontSize: 18 },
  rowCopy: { flex: 1 },
  cardTitle: { color: palette.ink, fontSize: 15, fontWeight: '600' },
  preview: { color: palette.muted, fontSize: 12, marginTop: 4 },
  empty: { color: palette.muted, fontSize: 13, paddingVertical: 22, textAlign: 'center' },
});
