import React, { useState } from 'react';
import { Alert, Modal, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as repo from './repository';
import { parseCardJson } from './cardFormats';
import type { ImportCard } from './repository';
import { ActionButton, palette } from './ui';

type Mutation = <T>(action: () => Promise<T>) => Promise<{ ok: true; value: T } | { ok: false }>;
type PendingImport = { cards: ImportCard[]; addCount: number; updateCount: number };

export function BackupModal({ visible, onClose, mutate }: { visible: boolean; onClose: () => void; mutate: Mutation }) {
  const [busy, setBusy] = useState(false);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);

  function close() {
    setPendingImport(null);
    onClose();
  }

  async function exportBackup() {
    setBusy(true);
    try {
      const file = new File(Paths.cache, 'noesis-backup.json');
      file.create({ overwrite: true });
      file.write(await repo.exportBackup());
      await Sharing.shareAsync(file.uri);
    } catch (error) {
      Alert.alert('导出失败', error instanceof Error ? error.message : String(error));
    } finally { setBusy(false); }
  }

  async function chooseBackup() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, type: 'application/json' });
      if (result.canceled) return;
      const asset = result.assets[0];
      const text = asset.file ? await asset.file.text() : await new File(asset.uri).text();
      Alert.alert('恢复完整备份', '恢复会替换本机现有内容。旧表数据也会按备份一并处理，建议先导出当前备份。', [
        { text: '取消', style: 'cancel' },
        { text: '恢复', style: 'destructive', onPress: () => { void restore(text); } },
      ]);
    } catch (error) {
      Alert.alert('读取失败', error instanceof Error ? error.message : String(error));
    }
  }

  async function chooseCardJson() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, type: 'application/json' });
      if (result.canceled) return;
      const asset = result.assets[0];
      const text = asset.file ? await asset.file.text() : await new File(asset.uri).text();
      const cards = parseCardJson(text);
      const existingIds = new Set((await repo.listCards()).map(card => card.id));
      const updateCount = cards.filter(card => !!card.id && existingIds.has(card.id)).length;
      setPendingImport({ cards, addCount: cards.length - updateCount, updateCount });
    } catch (error) {
      Alert.alert('导入失败', error instanceof Error ? error.message : String(error));
    }
  }

  async function importCards() {
    if (!pendingImport) return;
    setBusy(true);
    const result = await mutate(() => repo.importCards(pendingImport.cards));
    setBusy(false);
    if (result.ok) close();
  }

  async function restore(text: string) {
    setBusy(true);
    const result = await mutate(() => repo.restoreBackup(text));
    setBusy(false);
    if (result.ok) onClose();
  }

  return <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
    <View style={styles.backdrop}><View style={styles.sheet}>
      <View style={styles.top}><View><Text style={styles.kicker}>LOCAL DATA</Text><Text style={styles.title}>备份与恢复</Text></View><ActionButton label="完成" onPress={close} compact /></View>
      <Text style={styles.description}>完整备份会包含卡片、卡片关联、章节、体系，以及旧版本留下的牌组、标签、来源和修订记录。</Text>
      <ActionButton label={busy ? '处理中…' : '导出完整 JSON 备份'} onPress={() => void exportBackup()} tone="primary" disabled={busy} />
      <View style={styles.gap} />
      <ActionButton label={busy ? '处理中…' : '从 JSON 批量导入卡片'} onPress={() => void chooseCardJson()} disabled={busy} />
      {pendingImport ? <View style={styles.importPreview}>
        <Text style={styles.previewTitle}>已读取 {pendingImport.cards.length} 张卡片</Text>
        <Text style={styles.previewText}>将新增 {pendingImport.addCount} 张，更新 {pendingImport.updateCount} 张。无 ID 的卡片会自动生成 ID；已有 ID 会覆盖对应卡片的标题和正文。</Text>
        <View style={styles.previewActions}>
          <ActionButton label="取消" onPress={() => setPendingImport(null)} compact disabled={busy} />
          <ActionButton label={busy ? '导入中…' : '确认导入'} onPress={() => void importCards()} tone="primary" compact disabled={busy} />
        </View>
      </View> : null}
      <View style={styles.gap} />
      <ActionButton label={busy ? '处理中…' : '从 JSON 备份恢复'} onPress={() => void chooseBackup()} disabled={busy} />
      <Text style={styles.footnote}>批量导入只读取标题、正文和可选 ID；完整备份恢复会替换本机现有内容。文件不会上传到云端。</Text>
    </View></View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(31,36,31,.42)' },
  sheet: { backgroundColor: palette.page, paddingHorizontal: 22, paddingTop: 22, paddingBottom: 34, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: palette.line },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { color: palette.gold, fontSize: 9, letterSpacing: 2, marginBottom: 3 },
  title: { color: palette.ink, fontSize: 21, fontWeight: '700' },
  description: { color: palette.muted, fontSize: 13, lineHeight: 21, marginTop: 15, marginBottom: 15 },
  gap: { height: 9 },
  importPreview: { marginTop: 12, padding: 13, borderWidth: 1, borderColor: palette.line, borderRadius: 11, backgroundColor: palette.paper },
  previewTitle: { color: palette.ink, fontSize: 14, fontWeight: '600' },
  previewText: { color: palette.muted, fontSize: 12, lineHeight: 19, marginTop: 5 },
  previewActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 10 },
  footnote: { color: palette.muted, fontSize: 11, lineHeight: 18, textAlign: 'center', marginTop: 13 },
});
