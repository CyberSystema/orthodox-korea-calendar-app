import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { backendClient, configuredBaseUrl } from '../../services/api/backendClient';
import type {
  AdminAnnouncementLogItem,
  AdminAnnouncementLogCounts,
  AnnouncementLogFilter,
} from '../../services/backend-sdk';

// The console is intentionally English-only (see CLAUDE.md), so strings are inline.

const PAGE = 50;

const FILTERS: { key: AnnouncementLogFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'visible', label: 'Visible' },
  { key: 'hidden', label: 'Hidden' },
  { key: 'deleted', label: 'Deleted' },
  { key: 'orphaned', label: 'Orphaned' },
  { key: 'standalone', label: 'Standalone' },
];

// GitHub-dark console palette (matches SecretMenuScreen).
const C = {
  bg: '#0d1117',
  surface: '#161b22',
  surface2: '#010409',
  border: '#21262d',
  text: '#c9d1d9',
  muted: '#8b949e',
  faint: '#484f58',
  blue: '#58a6ff',
  cyan: '#79c0ff',
  green: '#3fb950',
  red: '#f85149',
  orange: '#d29922',
};

function fmtDateTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString();
}

function statusOf(item: AdminAnnouncementLogItem): { label: string; color: string } {
  if (item.deletedAt !== null) return { label: 'Deleted by staff', color: C.red };
  if (item.eventStatus === 'deleted') return { label: 'Event deleted', color: C.orange };
  if (item.eventStatus === 'missing') return { label: 'Event missing', color: C.orange };
  if (item.eventStatus === 'none') return { label: 'Notice', color: C.blue };
  return { label: 'Live', color: C.green };
}

function targetLabel(target: AdminAnnouncementLogItem['target']): string {
  if (target === 'en') return 'EN';
  if (target === 'ko') return 'KO';
  return 'ALL';
}

export function AnnouncementLogViewer({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<AnnouncementLogFilter>('all');
  const [items, setItems] = useState<AdminAnnouncementLogItem[]>([]);
  const [counts, setCounts] = useState<AdminAnnouncementLogCounts | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async (f: AnnouncementLogFilter) => {
    setLoading(true);
    setError(null);
    try {
      const res = await backendClient.listAnnouncementLog({ filter: f, limit: PAGE, offset: 0 });
      setItems(res.items);
      setCounts(res.counts);
      setHasMore(res.hasMore);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await backendClient.listAnnouncementLog({
        filter,
        limit: PAGE,
        offset: items.length,
      });
      setItems((prev) => [...prev, ...res.items]);
      setCounts(res.counts);
      setHasMore(res.hasMore);
    } catch {
      // Keep what we have; a transient page failure shouldn't wipe the list.
    } finally {
      setLoadingMore(false);
    }
  }, [filter, hasMore, items.length, loadingMore]);

  useEffect(() => {
    if (visible) void load(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, filter]);

  const runItemAction = useCallback(
    async (id: number, action: () => Promise<unknown>) => {
      setBusyId(id);
      try {
        await action();
        await load(filter);
      } catch (e: unknown) {
        Alert.alert('Action failed', e instanceof Error ? e.message : String(e));
      } finally {
        setBusyId(null);
      }
    },
    [filter, load],
  );

  const onHide = (item: AdminAnnouncementLogItem) =>
    runItemAction(item.id, () => backendClient.deleteAnnouncement(item.id));
  const onRestore = (item: AdminAnnouncementLogItem) =>
    runItemAction(item.id, () => backendClient.restoreAnnouncement(item.id));
  const onHardDelete = (item: AdminAnnouncementLogItem) =>
    Alert.alert('Permanently delete', `Hard-delete log entry #${item.id}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete forever',
        style: 'destructive',
        onPress: () =>
          void runItemAction(item.id, () => backendClient.hardDeleteAnnouncement(item.id)),
      },
    ]);
  const onCopy = (item: AdminAnnouncementLogItem) => {
    Clipboard.setString(JSON.stringify(item, null, 2));
    Alert.alert('Copied', `Entry #${item.id} copied as JSON.`);
  };

  const countFor = (key: AnnouncementLogFilter): number | null => {
    if (!counts) return null;
    switch (key) {
      case 'all':
        return counts.total;
      case 'visible':
        return counts.visible;
      case 'hidden':
        return counts.hidden;
      case 'deleted':
        return counts.deleted;
      case 'orphaned':
        return counts.orphaned;
      case 'standalone':
        return counts.standalone;
    }
  };

  const renderItem = ({ item }: { item: AdminAnnouncementLogItem }) => {
    const status = statusOf(item);
    const expanded = expandedId === item.id;
    const koDiffers = item.title.ko && item.title.ko !== item.title.en;

    return (
      <Pressable style={styles.card} onPress={() => setExpandedId(expanded ? null : item.id)}>
        <View style={styles.cardTop}>
          <View style={styles.statusWrap}>
            <View style={[styles.dot, { backgroundColor: status.color }]} />
            <Text style={[styles.statusLabel, { color: status.color }]}>{status.label}</Text>
            {!item.visible ? <Text style={styles.hiddenTag}>hidden</Text> : null}
          </View>
          <Text style={styles.idText}>
            #{item.id} · {targetLabel(item.target)}
          </Text>
        </View>

        <Text style={styles.title} numberOfLines={expanded ? undefined : 1}>
          {item.title.en || item.title.ko || '(untitled)'}
        </Text>
        {koDiffers ? (
          <Text style={styles.titleKo} numberOfLines={expanded ? undefined : 1}>
            {item.title.ko}
          </Text>
        ) : null}

        <Text style={styles.metaLine}>
          {fmtDateTime(item.sentAt)} · sent {item.sentCount}
          {item.eventTitle ? ` · ${item.eventTitle.en || item.eventTitle.ko}` : ''}
        </Text>

        {expanded ? (
          <View style={styles.detail}>
            <Field label="Body (EN)" value={item.body.en || '—'} />
            <Field label="Body (KO)" value={item.body.ko || '—'} />
            <Field label="Event id" value={item.eventId ?? '— (standalone notice)'} />
            <Field label="Event status" value={item.eventStatus} />
            {item.eventDate ? <Field label="Event date" value={item.eventDate} /> : null}
            <Field label="Sent at" value={`${fmtDateTime(item.sentAt)}  (${item.sentAt})`} />
            {item.deletedAt !== null ? (
              <Field
                label="Deleted at"
                value={`${fmtDateTime(item.deletedAt)}  (${item.deletedAt})`}
              />
            ) : null}
            <Field label="Feed visible" value={item.visible ? 'yes' : 'no'} />

            <View style={styles.actions}>
              {item.deletedAt !== null ? (
                <ActionChip
                  label="Restore"
                  color={C.green}
                  disabled={busyId === item.id}
                  onPress={() => onRestore(item)}
                />
              ) : (
                <ActionChip
                  label="Hide from feed"
                  color={C.orange}
                  disabled={busyId === item.id}
                  onPress={() => onHide(item)}
                />
              )}
              <ActionChip
                label="Hard delete"
                color={C.red}
                disabled={busyId === item.id}
                onPress={() => onHardDelete(item)}
              />
              <ActionChip
                label="Copy JSON"
                color={C.blue}
                disabled={false}
                onPress={() => onCopy(item)}
              />
            </View>
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>📜 Announcement Log</Text>
          <View style={styles.headerBtns}>
            <Pressable
              style={styles.headerBtn}
              onPress={() => void load(filter)}
              disabled={loading}
            >
              <Text style={styles.headerBtnText}>Refresh</Text>
            </Pressable>
            <Pressable style={styles.headerBtn} onPress={onClose}>
              <Text style={styles.headerBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
        <Text style={styles.subtle}>{configuredBaseUrl}</Text>

        {/* Filter chips with counts.
            
            A WRAPPING ROW, not a horizontal scroller. Nothing in this app scrolls
            sideways: a sideways scroller hides its own overflow — there is no
            edge to tell you a chip is off-screen — and it competes with the back
            gesture. Six short chips wrap onto two lines and are all visible at
            once, which is strictly better than five visible and one hidden. */}
        <View style={styles.chipsRow}>
          {FILTERS.map((f) => {
            const active = f.key === filter;
            const n = countFor(f.key);
            return (
              <Pressable
                key={f.key}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setFilter(f.key)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {f.label}
                  {n !== null ? ` ${n}` : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Body */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={C.blue} />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.errText}>⚠ {error}</Text>
            <Pressable style={styles.retryBtn} onPress={() => void load(filter)}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>No entries in this view.</Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(i) => String(i.id)}
            renderItem={renderItem}
            contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
            ListFooterComponent={
              hasMore ? (
                <Pressable
                  style={styles.moreBtn}
                  onPress={() => void loadMore()}
                  disabled={loadingMore}
                >
                  <Text style={styles.moreText}>{loadingMore ? 'Loading…' : 'Load more'}</Text>
                </Pressable>
              ) : (
                <Text style={styles.endText}>{items.length} shown</Text>
              )
            }
          />
        )}
      </View>
    </Modal>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

function ActionChip({
  label,
  color,
  disabled,
  onPress,
}: {
  label: string;
  color: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.actionChip, { borderColor: color }, disabled && styles.actionChipDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.actionChipText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTitle: { color: C.text, fontSize: 18, fontWeight: '700' },
  headerBtns: { flexDirection: 'row', gap: 8 },
  headerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  headerBtnText: { color: C.blue, fontSize: 13, fontWeight: '600' },
  subtle: { color: C.faint, fontSize: 11, paddingHorizontal: 14, paddingTop: 6 },

  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  chipActive: { borderColor: C.blue, backgroundColor: '#1f2937' },
  chipText: { color: C.muted, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: C.cyan },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errText: { color: C.red, fontSize: 14, textAlign: 'center' },
  emptyText: { color: C.muted, fontSize: 14 },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.blue,
  },
  retryText: { color: C.blue, fontWeight: '700' },

  listContent: { paddingHorizontal: 14, gap: 10, paddingTop: 4 },
  card: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    backgroundColor: C.surface,
    padding: 12,
    gap: 4,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  statusLabel: { fontSize: 12, fontWeight: '700' },
  hiddenTag: {
    color: C.faint,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    borderWidth: 1,
    borderColor: C.faint,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  idText: { color: C.faint, fontSize: 11 },
  title: { color: C.text, fontSize: 15, fontWeight: '600' },
  titleKo: { color: C.muted, fontSize: 13 },
  metaLine: { color: C.faint, fontSize: 12, marginTop: 2 },

  detail: { marginTop: 8, gap: 6, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8 },
  field: { gap: 1 },
  fieldLabel: { color: C.faint, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldValue: { color: C.text, fontSize: 13 },

  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  actionChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  actionChipDisabled: { opacity: 0.4 },
  actionChipText: { fontSize: 12, fontWeight: '700' },

  moreBtn: {
    marginTop: 12,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  moreText: { color: C.blue, fontWeight: '700' },
  endText: { color: C.faint, fontSize: 12, textAlign: 'center', marginTop: 12 },
});
