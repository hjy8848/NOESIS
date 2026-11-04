import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Card } from './types';
import { ActionButton, palette, TextField } from './ui';

export function CardEditorModal({ visible, card, onClose, onSave }: { visible: boolean; card: Card | null; onClose: () => void; onSave: (title: string, content: string, id?: string) => void }) {
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    {visible ? <CardEditorForm card={card} onClose={onClose} onSave={onSave} /> : null}
  </Modal>;
}

function CardEditorForm({ card, onClose, onSave }: { card: Card | null; onClose: () => void; onSave: (title: string, content: string, id?: string) => void }) {
  const [title, setTitle] = useState(card?.title || '');
  const [content, setContent] = useState(card?.content || '');

  return <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}><View><Text style={styles.kicker}>WRITE A THOUGHT</Text><Text style={styles.headerTitle}>{card ? '编辑思想卡片' : '新建思想卡片'}</Text></View><ActionButton label="取消" onPress={onClose} compact /></View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>标题</Text>
        <TextField value={title} onChangeText={setTitle} placeholder="给这个想法一个名字" autoFocus />
        <Text style={styles.label}>正文</Text>
        <TextField value={content} onChangeText={setContent} placeholder="写下你的想法。支持 Markdown 格式。" multiline />
        <Text style={styles.hint}>每张卡片只有标题和正文。内容会保存在本机 SQLite。</Text>
      </ScrollView>
      <View style={styles.footer}><ActionButton label="保存卡片" onPress={() => onSave(title, content, card?.id)} tone="primary" disabled={!title.trim()} /></View>
    </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.page },
  header: { minHeight: 74, paddingHorizontal: 19, paddingTop: 25, paddingBottom: 9, borderBottomWidth: 1, borderColor: palette.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { color: palette.gold, fontSize: 9, letterSpacing: 2, marginBottom: 3 },
  headerTitle: { color: palette.ink, fontSize: 19, fontWeight: '700' },
  content: { padding: 21, paddingBottom: 35 },
  label: { color: palette.ink, fontSize: 14, fontWeight: '600', marginTop: 8, marginBottom: 3 },
  hint: { color: palette.muted, fontSize: 12, lineHeight: 19, marginTop: 10 },
  footer: { paddingHorizontal: 20, paddingTop: 9, paddingBottom: 20, borderTopWidth: 1, borderColor: palette.line },
});
