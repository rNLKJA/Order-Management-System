/**
 * 快速录入页 —— 手机端独立页面。
 *
 * 默认 order_date = 今天（对应手机场景），
 * 展示 OrderEntryModal 内联版（不弹 Modal，直接渲染表单）。
 */

import { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Divider,
  useTheme,
  Chip,
  ActivityIndicator,
  Banner,
  Snackbar,
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { api } from '../../../api/client';
import { ordersApi } from '../../../api/orders';

interface Member {
  id: number;
  name: string;
  nickname: string;
  phone: string;
  is_hospital: boolean;
}

function todayDate(): string {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function QuickOrderScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Member[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [orderDate] = useState(todayDate());
  const [lunchQty, setLunchQty] = useState(0);
  const [dinnerQty, setDinnerQty] = useState(0);
  const [notes, setNotes] = useState('');
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackMsg, setSnackMsg] = useState<string | null>(null);

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.trim().length < 1) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await api.get<{ members: Member[] }>(`/api/members?q=${encodeURIComponent(q)}&limit=8`);
      setSearchResults(res.members);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectMember = (m: Member) => {
    setSelectedMember(m);
    setSearchQuery(m.name);
    setSearchResults([]);
  };

  const handleSubmit = async () => {
    if (!selectedMember) {
      setError('请先选择会员');
      return;
    }
    if (lunchQty + dinnerQty === 0) {
      setError('午餐份数和晚餐份数至少有一项 > 0');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const result = await ordersApi.create({
        member_id: selectedMember.id,
        order_date: orderDate,
        lunch_qty: lunchQty > 0 ? lunchQty : undefined,
        dinner_qty: dinnerQty > 0 ? dinnerQty : undefined,
        notes: notes.trim() || undefined,
      });

      const msg = result.card_exhausted
        ? `录入成功！餐卡已耗尽，请及时续卡。`
        : `录入成功！${result.orders.length} 条订单已创建。`;
      setSnackMsg(msg);

      // 重置（保留日期以便连续录入）
      setSelectedMember(null);
      setSearchQuery('');
      setSearchResults([]);
      setLunchQty(0);
      setDinnerQty(0);
      setNotes('');
    } catch (err: unknown) {
      const e = err as { message?: string; code?: string };
      if (e.code === 'INSUFFICIENT_MEAL_BALANCE') {
        setError(`余额不足：${e.message ?? '请先续卡或升级'}`);
      } else {
        setError(e.message ?? '录入失败，请重试');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text variant="titleLarge" style={styles.title}>
        快速录入
      </Text>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 16 }}>
        用餐日期：{orderDate}（今天）
      </Text>

      {error && (
        <Banner
          visible
          actions={[{ label: '关闭', onPress: () => setError(null) }]}
          icon="alert"
        >
          {error}
        </Banner>
      )}

      {/* 会员搜索 */}
      <TextInput
        label="搜索会员"
        value={searchQuery}
        onChangeText={handleSearch}
        mode="outlined"
        style={styles.input}
        right={searching ? <TextInput.Icon icon="loading" /> : undefined}
        placeholder="输入姓名 / 昵称 / 手机"
      />

      {searchResults.length > 0 && (
        <View style={[styles.dropdown, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline }]}>
          {searchResults.map((m) => (
            <Button
              key={m.id}
              onPress={() => handleSelectMember(m)}
              style={styles.dropdownItem}
              contentStyle={{ justifyContent: 'flex-start' }}
            >
              {m.name}
              {m.nickname ? `（${m.nickname}）` : ''}
              {m.is_hospital ? ' 院内' : ''}
            </Button>
          ))}
        </View>
      )}

      {selectedMember && (
        <Chip
          icon="account-check"
          onClose={() => { setSelectedMember(null); setSearchQuery(''); }}
          style={styles.memberChip}
        >
          {selectedMember.name} · {selectedMember.is_hospital ? '院内' : '院外'}
        </Chip>
      )}

      <Divider style={styles.divider} />

      {/* 午餐份数 */}
      <View style={styles.qtyRow}>
        <Text variant="bodyLarge" style={styles.qtyLabel}>
          午餐份数
        </Text>
        <View style={styles.qtyControls}>
          <Button mode="outlined" onPress={() => setLunchQty(Math.max(0, lunchQty - 1))} style={styles.qtyBtn} compact>
            −
          </Button>
          <Text variant="titleLarge" style={styles.qtyValue}>
            {lunchQty}
          </Text>
          <Button mode="outlined" onPress={() => setLunchQty(lunchQty + 1)} style={styles.qtyBtn} compact>
            ＋
          </Button>
        </View>
      </View>

      {/* 晚餐份数 */}
      <View style={styles.qtyRow}>
        <Text variant="bodyLarge" style={styles.qtyLabel}>
          晚餐份数
        </Text>
        <View style={styles.qtyControls}>
          <Button mode="outlined" onPress={() => setDinnerQty(Math.max(0, dinnerQty - 1))} style={styles.qtyBtn} compact>
            −
          </Button>
          <Text variant="titleLarge" style={styles.qtyValue}>
            {dinnerQty}
          </Text>
          <Button mode="outlined" onPress={() => setDinnerQty(dinnerQty + 1)} style={styles.qtyBtn} compact>
            ＋
          </Button>
        </View>
      </View>

      <TextInput
        label="备注（可选）"
        value={notes}
        onChangeText={setNotes}
        mode="outlined"
        style={styles.input}
        multiline
        numberOfLines={2}
      />

      <Divider style={styles.divider} />

      <Button
        mode="contained"
        onPress={handleSubmit}
        disabled={submitting || !selectedMember || lunchQty + dinnerQty === 0}
        style={styles.submitBtn}
        contentStyle={{ paddingVertical: 6 }}
      >
        {submitting ? <ActivityIndicator size={20} color="white" /> : '确认录入'}
      </Button>

      <Button mode="outlined" onPress={() => router.back()} style={[styles.submitBtn, { marginTop: 8 }]}>
        返回列表
      </Button>

      <Snackbar
        visible={snackMsg != null}
        onDismiss={() => setSnackMsg(null)}
        duration={3000}
        action={{ label: '好的', onPress: () => setSnackMsg(null) }}
      >
        {snackMsg ?? ''}
      </Snackbar>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  title: {
    fontWeight: '700',
    marginBottom: 4,
  },
  input: {
    marginBottom: 12,
  },
  dropdown: {
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
  },
  dropdownItem: {
    justifyContent: 'flex-start',
  },
  memberChip: {
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  divider: {
    marginVertical: 12,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  qtyLabel: {
    flex: 1,
    fontWeight: '600',
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  qtyBtn: {
    borderRadius: 8,
    minWidth: 44,
  },
  qtyValue: {
    minWidth: 36,
    textAlign: 'center',
    fontWeight: '700',
  },
  submitBtn: {
    borderRadius: 10,
  },
});
