import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import type { Card } from './types';
import { ActionButton, palette } from './ui';

export type ReadingDocument = {
  title: string;
  description?: string;
  chapters: { title: string; cards: Card[] }[];
};

export function ReadingOverlay({ document, onClose }: { document: ReadingDocument | null; onClose: () => void }) {
  return <Modal visible={!!document} animationType="slide" onRequestClose={onClose}>
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerCopy}><Text style={styles.kicker}>READING</Text><Text numberOfLines={1} style={styles.headerTitle}>{document?.title || '阅读'}</Text></View>
        <ActionButton label="完成" onPress={onClose} compact />
      </View>
      {document ? <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>NOESIS · 连续阅读</Text>
        <Text style={styles.title}>{document.title}</Text>
        {!!document.description && <Text style={styles.description}>{document.description}</Text>}
        {document.chapters.map((chapter, index) => <View key={`${chapter.title}:${index}`}>
          <View style={styles.chapterHeading}><Text style={styles.chapterNumber}>{String(index + 1).padStart(2, '0')}</Text><Text style={styles.chapterTitle}>{chapter.title}</Text></View>
          {chapter.cards.length ? chapter.cards.map(card => <View key={card.id} style={styles.cardBlock}>
            <Text style={styles.cardTitle}>{card.title}</Text>
            <Markdown style={markdownStyle}>{card.content || '这张卡片还没有正文。'}</Markdown>
          </View>) : <Text style={styles.empty}>这一章暂时没有卡片。</Text>}
        </View>)}
        {!document.chapters.length && <Text style={styles.empty}>还没有章节可以阅读。</Text>}
        <Pressable onPress={onClose} style={styles.finish}><Text style={styles.finishText}>读完了　✦</Text></Pressable>
      </ScrollView> : null}
    </View>
  </Modal>;
}

const markdownStyle = {
  body: { color: '#49574d', fontSize: 15, lineHeight: 27 },
  paragraph: { marginTop: 0, marginBottom: 11 },
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
  content: { paddingHorizontal: 24, paddingTop: 29, paddingBottom: 52 },
  eyebrow: { color: palette.gold, fontSize: 10, letterSpacing: 3, marginBottom: 8 },
  title: { color: palette.ink, fontSize: 30, lineHeight: 38, fontWeight: '700', marginBottom: 10 },
  description: { color: palette.muted, fontSize: 15, lineHeight: 24, marginBottom: 22 },
  chapterHeading: { flexDirection: 'row', alignItems: 'center', marginTop: 27, marginBottom: 7, paddingBottom: 9, borderBottomWidth: 1, borderColor: palette.line },
  chapterNumber: { color: palette.gold, fontSize: 13, fontWeight: '700', width: 38 },
  chapterTitle: { color: palette.ink, fontSize: 20, fontWeight: '700', flex: 1 },
  cardBlock: { paddingVertical: 19, borderBottomWidth: 1, borderColor: '#e3ddd1' },
  cardTitle: { color: palette.ink, fontSize: 17, fontWeight: '700', marginBottom: 9 },
  empty: { color: palette.muted, fontSize: 14, paddingVertical: 16 },
  finish: { marginTop: 28, alignItems: 'center', paddingVertical: 17, borderRadius: 14, backgroundColor: '#e5dfd2' },
  finishText: { color: palette.green, fontSize: 14, fontWeight: '700' },
});
