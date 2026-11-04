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
      <View style={styles.header}><View style={styles.headerCopy}><Text style={styles.kicker}>CARD DETAIL　/　卡片正文</Text><Text numberOfLines={1} style={styles.headerTitle}>{card?.title || '卡片'}</Text></View><ActionButton label="‹ 返回" onPress={onClose} compact tone="quiet" /></View>
      {card ? <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.overline}>一张思想卡片　·　正文</Text>
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
  body: { color: '#494941', fontFamily: 'serif', fontSize: 17, lineHeight: 30 },
  paragraph: { marginTop: 0, marginBottom: 16 },
  heading1: { color: palette.ink, fontFamily: 'serif', fontSize: 27, lineHeight: 36, fontWeight: '400' },
  heading2: { color: palette.ink, fontFamily: 'serif', fontSize: 23, lineHeight: 31, fontWeight: '400' },
  heading3: { color: palette.ink, fontFamily: 'serif', fontSize: 20, lineHeight: 28, fontWeight: '400' },
  bullet_list: { marginVertical: 6 },
  ordered_list: { marginVertical: 6 },
  code_inline: { backgroundColor: '#ece6da', color: palette.ink },
  fence: { backgroundColor: '#ece6da', color: palette.ink, padding: 12, borderRadius: 8 },
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.page },
  header: { minHeight: 78, paddingHorizontal: 21, paddingTop: 26, paddingBottom: 11, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: palette.line },
  headerCopy: { flex: 1 },
  kicker: { color: palette.accent, fontSize: 9, letterSpacing: 1.8, marginBottom: 3 },
  headerTitle: { color: palette.ink, fontFamily: 'serif', fontSize: 18, fontWeight: '400' },
  content: { paddingHorizontal: 25, paddingTop: 31, paddingBottom: 48 },
  overline: { color: palette.accent, fontSize: 10, letterSpacing: 1.6, marginBottom: 12 },
  title: { color: palette.ink, fontFamily: 'serif', fontSize: 34, fontWeight: '400', lineHeight: 45, marginBottom: 21 },
  rule: { width: 38, height: 1, backgroundColor: palette.accent, marginBottom: 25 },
  empty: { color: palette.muted, fontSize: 13, paddingVertical: 8 },
  actions: { flexDirection: 'row', gap: 9, marginVertical: 18 },
});
