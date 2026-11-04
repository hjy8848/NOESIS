import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import type { Card } from './types';
import { ActionButton, palette, SectionLabel } from './ui';

export function CardDetailModal({ card, linkedCards, onClose, onEdit, onLink, onDelete, onOpenRelated }: {
  card: Card | null;
  linkedCards: Card[];
  onClose: () => void;
  onEdit: () => void;
  onLink: () => void;
  onDelete: () => void;
  onOpenRelated: (card: Card) => void;
}) {
  return <Modal visible={!!card} animationType="slide" onRequestClose={onClose}>
    <View style={styles.root}>
      <View style={styles.header}><View style={styles.headerCopy}><Text style={styles.kicker}>THOUGHT CARD</Text><Text numberOfLines={1} style={styles.headerTitle}>{card?.title || '卡片'}</Text></View><ActionButton label="完成" onPress={onClose} compact /></View>
      {card ? <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.overline}>NOESIS　·　{card.id.slice(0, 8).toUpperCase()}</Text>
        <Text style={styles.title}>{card.title}</Text>
        <View style={styles.rule} />
        <Markdown style={markdownStyle}>{card.content || '这张卡片还没有正文。'}</Markdown>
        <SectionLabel>关联卡片</SectionLabel>
        {linkedCards.length ? linkedCards.map(linked => <ActionButton key={linked.id} label={`↗  ${linked.title}`} onPress={() => onOpenRelated(linked)} />) : <Text style={styles.empty}>暂时没有关联的卡片。</Text>}
        <View style={styles.actions}><ActionButton label="＋ 建立关联" onPress={onLink} /><ActionButton label="编辑" onPress={onEdit} tone="primary" /></View>
        <ActionButton label="删除卡片" onPress={onDelete} tone="danger" />
      </ScrollView> : null}
    </View>
  </Modal>;
}

const markdownStyle = {
  body: { color: '#435247', fontSize: 16, lineHeight: 28 },
  paragraph: { marginTop: 0, marginBottom: 13 },
  heading1: { color: palette.ink },
  heading2: { color: palette.ink },
  heading3: { color: palette.ink },
  bullet_list: { marginVertical: 5 },
  ordered_list: { marginVertical: 5 },
  code_inline: { backgroundColor: '#e9e2d4', color: palette.ink },
  fence: { backgroundColor: '#e9e2d4', color: palette.ink, padding: 10, borderRadius: 9 },
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.page },
  header: { minHeight: 73, paddingHorizontal: 19, paddingTop: 25, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: palette.line },
  headerCopy: { flex: 1 },
  kicker: { color: palette.gold, fontSize: 9, letterSpacing: 2, marginBottom: 2 },
  headerTitle: { color: palette.ink, fontSize: 18, fontWeight: '700' },
  content: { paddingHorizontal: 23, paddingTop: 25, paddingBottom: 40 },
  overline: { color: palette.gold, fontSize: 10, letterSpacing: 2, marginBottom: 8 },
  title: { color: palette.ink, fontSize: 29, fontWeight: '700', lineHeight: 37, marginBottom: 17 },
  rule: { width: 54, height: 3, borderRadius: 2, backgroundColor: palette.gold, marginBottom: 19 },
  empty: { color: palette.muted, fontSize: 13, paddingVertical: 8 },
  actions: { flexDirection: 'row', gap: 9, marginVertical: 15 },
});
