import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card as CardView } from './Card';
import type { Card, CardLink } from './types';
import { ActionButton, palette, SectionLabel } from './ui';

export function CardsScreen({
  cards,
  links,
  activeCardId,
  onSelectCard,
  onCreate,
  onEdit,
  onRead,
  onLink,
  onDelete,
  onOpenLinked,
}: {
  cards: Card[];
  links: CardLink[];
  activeCardId: string | null;
  onSelectCard: (cardId: string | null) => void;
  onCreate: () => void;
  onEdit: (card: Card) => void;
  onRead: (card: Card) => void;
  onLink: (card: Card) => void;
  onDelete: (card: Card) => void;
  onOpenLinked: (card: Card) => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return query ? cards.filter(card => `${card.title}\n${card.content}`.toLocaleLowerCase().includes(query)) : cards;
  }, [cards, search]);
  const foundIndex = filtered.findIndex(card => card.id === activeCardId);
  const index = foundIndex >= 0 ? foundIndex : 0;
  const current = filtered[Math.min(index, filtered.length - 1)];

  const linkedCards = current ? links
    .filter(link => link.sourceCardId === current.id || link.targetCardId === current.id)
    .map(link => cards.find(card => card.id === (link.sourceCardId === current.id ? link.targetCardId : link.sourceCardId)))
    .filter((card): card is Card => !!card) : [];

  return <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
    <View style={styles.topline}>
      <View><Text style={styles.eyebrow}>YOUR THOUGHTS</Text><Text style={styles.title}>思想卡片</Text></View>
      <Text style={styles.total}>{cards.length.toString().padStart(2, '0')} 张</Text>
    </View>
    <Text style={styles.intro}>把想法写成卡片，再慢慢整理成章节与体系。</Text>
    <TextInput
      value={search}
      onChangeText={value => {
        setSearch(value);
        const query = value.trim().toLocaleLowerCase();
        const first = query ? cards.find(card => `${card.title}\n${card.content}`.toLocaleLowerCase().includes(query)) : cards[0];
        onSelectCard(first?.id || null);
      }}
      placeholder="搜索标题或正文"
      placeholderTextColor="#938d80"
      returnKeyType="search"
      accessibilityLabel="搜索思想卡片"
      style={styles.search}
    />
    {current ? <>
      <CardView
        key={current.id}
        card={current}
        canNext={index < filtered.length - 1}
        canPrevious={index > 0}
        animations
        onOpen={() => onRead(current)}
        onNext={() => onSelectCard(filtered[index + 1]?.id || current.id)}
        onPrevious={() => onSelectCard(filtered[index - 1]?.id || current.id)}
      />
      <Text style={styles.counter}>{index + 1} / {filtered.length}　·　点击翻面，左右滑动</Text>
      <View style={styles.actions}>
        <ActionButton label="阅读" onPress={() => onRead(current)} tone="primary" />
        <ActionButton label="编辑" onPress={() => onEdit(current)} />
        <ActionButton label="关联" onPress={() => onLink(current)} />
      </View>
      <View style={styles.secondaryActions}>
        <ActionButton label="上一张" onPress={() => onSelectCard(filtered[index - 1]?.id || current.id)} compact disabled={index === 0} />
        <ActionButton label="删除卡片" onPress={() => onDelete(current)} compact tone="danger" />
        <ActionButton label="下一张" onPress={() => onSelectCard(filtered[index + 1]?.id || current.id)} compact disabled={index >= filtered.length - 1} />
      </View>
      <SectionLabel>卡片关联</SectionLabel>
      {linkedCards.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.linkRow}>
        {linkedCards.map(card => <ActionButton key={card.id} label={`↗  ${card.title}`} onPress={() => onOpenLinked(card)} compact />)}
      </ScrollView> : <Text style={styles.muted}>还没有关联。点“关联”连接另一张卡片。</Text>}
    </> : <View style={styles.empty}>
      <Text style={styles.emptyMark}>✦</Text>
      <Text style={styles.emptyTitle}>{cards.length ? '没有找到匹配卡片' : '第一张思想卡片，等你写下'}</Text>
      <Text style={styles.muted}>{cards.length ? '试试别的关键词。' : '只需要一个标题和正文。'}</Text>
    </View>}
    <ActionButton label="＋ 新建思想卡片" onPress={() => { setSearch(''); onCreate(); }} tone="primary" />
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 24 },
  topline: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  eyebrow: { color: palette.gold, fontSize: 10, letterSpacing: 3, marginBottom: 7 },
  title: { color: palette.ink, fontSize: 30, fontWeight: '700', letterSpacing: .5 },
  total: { color: palette.gold, fontSize: 13, paddingBottom: 5 },
  intro: { color: palette.muted, fontSize: 14, lineHeight: 21, marginTop: 7, marginBottom: 11 },
  search: { height: 47, borderRadius: 14, backgroundColor: '#fbf8f0', borderWidth: 1, borderColor: '#ded7c9', paddingHorizontal: 14, color: palette.ink, fontSize: 15 },
  counter: { color: palette.muted, textAlign: 'center', fontSize: 12, marginBottom: 5 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  secondaryActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  linkRow: { gap: 8, paddingVertical: 3 },
  muted: { color: palette.muted, fontSize: 13, lineHeight: 20 },
  empty: { alignItems: 'center', justifyContent: 'center', minHeight: 300, backgroundColor: '#ebe5d8', borderRadius: 20, marginVertical: 22, padding: 28 },
  emptyMark: { color: palette.gold, fontSize: 48, marginBottom: 12 },
  emptyTitle: { color: palette.ink, fontSize: 19, fontWeight: '600', textAlign: 'center', marginBottom: 7 },
});
