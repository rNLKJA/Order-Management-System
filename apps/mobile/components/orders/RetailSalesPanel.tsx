/**
 * 每日订餐 —「零售」Tab：维护其他产品目录、记销售、查看当日 misc_retail 流水。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCNY, formatDate } from '@meal/shared';
import { createRetailProductSale, listFinance, type FinanceEntryDTO } from '../../api/finance';
import {
  createRetailProduct,
  listRetailProducts,
  patchRetailProduct,
  type RetailProductDTO,
} from '../../api/retail-products';
import { usersApi, type ApiUser } from '../../api/users';
import { notify } from '../../lib/confirm';
import { useAuth } from '../../hooks/useAuth';
import { DatePicker } from '../ui';
import { IOS_COLORS } from '../../theme/paperTheme';
import { todayStr } from './date-utils';

export function RetailSalesPanel() {
  const { user } = useAuth();
  const [saleDate, setSaleDate] = useState(() => todayStr());
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [products, setProducts] = useState<RetailProductDTO[]>([]);
  const [dayEntries, setDayEntries] = useState<FinanceEntryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [productId, setProductId] = useState<number | null>(null);
  const [qtyText, setQtyText] = useState('1');
  const [amountText, setAmountText] = useState('');
  const [collectorId, setCollectorId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [catalogModal, setCatalogModal] = useState(false);
  const [editProduct, setEditProduct] = useState<RetailProductDTO | null>(null);
  const [catName, setCatName] = useState('');
  const [catDetail, setCatDetail] = useState('');
  const [savingCatalog, setSavingCatalog] = useState(false);

  const loadAll = useCallback(async () => {
    const [uRes, pRes, fRes] = await Promise.all([
      usersApi.list(),
      listRetailProducts(true),
      listFinance({
        from: saleDate,
        to: saleDate,
        category: 'misc_retail_income',
        limit: 100,
      }),
    ]);
    const list = (uRes.users ?? []).filter((x) => x.is_active);
    setUsers(list);
    setProducts(pRes.products ?? []);
    setDayEntries(fRes.items ?? []);
    setCollectorId((prev) => {
      if (prev != null && list.some((x) => x.id === prev)) return prev;
      if (user?.id) {
        const self = list.find((x) => x.id === user.id);
        if (self) return self.id;
      }
      return list[0]?.id ?? null;
    });
  }, [saleDate, user?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await loadAll();
      } catch (e) {
        if (!cancelled) {
          await notify('加载失败', e instanceof Error ? e.message : '未知错误', 'destructive');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [saleDate, loadAll]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadAll();
    } catch (e) {
      await notify('刷新失败', e instanceof Error ? e.message : '未知错误', 'destructive');
    } finally {
      setRefreshing(false);
    }
  }, [loadAll]);

  const activeProducts = useMemo(
    () =>
      products
        .filter((p) => p.is_active)
        .sort((a, b) => a.sort_order - b.sort_order || b.id - a.id),
    [products],
  );

  useEffect(() => {
    if (productId != null && !activeProducts.some((p) => p.id === productId)) {
      setProductId(activeProducts[0]?.id ?? null);
    }
  }, [activeProducts, productId]);

  const openNewCatalog = () => {
    setEditProduct(null);
    setCatName('');
    setCatDetail('');
    setCatalogModal(true);
  };

  const openEditCatalog = (p: RetailProductDTO) => {
    setEditProduct(p);
    setCatName(p.name);
    setCatDetail(p.detail ?? '');
    setCatalogModal(true);
  };

  const saveCatalog = async () => {
    const name = catName.trim();
    if (!name) {
      await notify('提示', '请填写商品名称');
      return;
    }
    setSavingCatalog(true);
    try {
      if (editProduct) {
        await patchRetailProduct(editProduct.id, {
          name,
          detail: catDetail.trim(),
        });
      } else {
        await createRetailProduct({ name, detail: catDetail.trim() });
      }
      setCatalogModal(false);
      await refresh();
    } catch (e) {
      await notify('保存失败', e instanceof Error ? e.message : '未知错误', 'destructive');
    } finally {
      setSavingCatalog(false);
    }
  };

  const toggleProductActive = async (p: RetailProductDTO) => {
    try {
      await patchRetailProduct(p.id, { is_active: !p.is_active });
      await refresh();
    } catch (e) {
      await notify('操作失败', e instanceof Error ? e.message : '未知错误', 'destructive');
    }
  };

  const submitSale = async () => {
    if (productId == null) {
      await notify('提示', '请选择商品');
      return;
    }
    if (collectorId == null) {
      await notify('提示', '请选择收款人');
      return;
    }
    const qty = Number(qtyText);
    if (!Number.isFinite(qty) || qty < 1 || !Number.isInteger(qty)) {
      await notify('提示', '数量须为正整数');
      return;
    }
    const amount = Number(amountText);
    if (!Number.isFinite(amount) || amount <= 0) {
      await notify('提示', '请输入有效总价');
      return;
    }
    setSubmitting(true);
    try {
      await createRetailProductSale({
        entry_date: saleDate,
        product_id: productId,
        quantity: qty,
        amount,
        collector_user_id: collectorId,
        note: note.trim(),
      });
      setAmountText('');
      setNote('');
      setQtyText('1');
      await refresh();
      await notify('已保存', '已记入财务流水（其他产品销售）');
    } catch (e) {
      await notify('保存失败', e instanceof Error ? e.message : '未知错误', 'destructive');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && products.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.card}>
        <Text style={styles.cardTitle}>记一笔零售</Text>
        <Text style={styles.hint}>不绑定会员卡；入账分类为「其他产品销售」</Text>
        <DatePicker label="业务日期" value={saleDate} onChange={setSaleDate} max={formatDate(new Date())} />
        <Text style={styles.label}>商品</Text>
        {activeProducts.length === 0 ? (
          <Text style={styles.warn}>请先在下方「商品目录」新增可售商品</Text>
        ) : (
          <View style={styles.chipWrap}>
            {activeProducts.map((p) => {
              const sel = productId === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setProductId(p.id)}
                  style={[styles.chip, sel && styles.chipActive]}
                >
                  <Text style={[styles.chipText, sel && styles.chipTextActive]} numberOfLines={1}>
                    {p.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
        <TextInput
          style={styles.input}
          placeholder="数量（件）"
          keyboardType="number-pad"
          value={qtyText}
          onChangeText={setQtyText}
        />
        <TextInput
          style={styles.input}
          placeholder="总价（元）"
          keyboardType="decimal-pad"
          value={amountText}
          onChangeText={setAmountText}
        />
        <Text style={styles.label}>收款人</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.collectorRow}>
          {users.map((u) => {
            const sel = collectorId === u.id;
            return (
              <Pressable
                key={u.id}
                onPress={() => setCollectorId(u.id)}
                style={[styles.chip, sel && styles.chipActive]}
              >
                <Text style={[styles.chipText, sel && styles.chipTextActive]} numberOfLines={1}>
                  {u.full_name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <TextInput style={styles.input} placeholder="备注（可选）" value={note} onChangeText={setNote} />
        <Pressable
          style={[styles.primaryBtn, submitting && styles.primaryBtnDisabled]}
          onPress={() => void submitSale()}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>确认入账</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>本日已录</Text>
          <Pressable onPress={() => void refresh()} hitSlop={12}>
            <Text style={styles.link}>{refreshing ? '…' : '刷新'}</Text>
          </Pressable>
        </View>
        {dayEntries.length === 0 ? (
          <Text style={styles.muted}>{saleDate} 暂无零售入账</Text>
        ) : (
          dayEntries.map((e) => (
            <View key={e.id} style={styles.entryRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.entryAmt}>+{formatCNY(e.amount)}</Text>
                <Text style={styles.entryDesc} numberOfLines={3}>
                  {e.description}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>商品目录</Text>
          <Pressable onPress={openNewCatalog} style={styles.smallBtn}>
            <Ionicons name="add" size={18} color={IOS_COLORS.blue} />
            <Text style={styles.link}>新增</Text>
          </Pressable>
        </View>
        {products.length === 0 ? (
          <Text style={styles.muted}>暂无商品，请点击「新增」</Text>
        ) : (
          products.map((p) => (
            <View key={p.id} style={styles.productRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.productName}>
                  {p.name}
                  {!p.is_active ? <Text style={styles.badge}> 已停用</Text> : null}
                </Text>
                {p.detail ? <Text style={styles.productDetail}>{p.detail}</Text> : null}
              </View>
              <Pressable onPress={() => openEditCatalog(p)} hitSlop={8} style={styles.iconBtn}>
                <Ionicons name="pencil-outline" size={20} color={IOS_COLORS.blue} />
              </Pressable>
              <Pressable onPress={() => void toggleProductActive(p)} hitSlop={8} style={styles.iconBtn}>
                <Ionicons
                  name={p.is_active ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={p.is_active ? IOS_COLORS.labelSecondary : IOS_COLORS.blue}
                />
              </Pressable>
            </View>
          ))
        )}
      </View>

      <Modal visible={catalogModal} transparent animationType="fade" onRequestClose={() => setCatalogModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => !savingCatalog && setCatalogModal(false)}>
          <Pressable style={styles.modalCard} onPress={(ev) => ev.stopPropagation()}>
            <Text style={styles.modalTitle}>{editProduct ? '编辑商品' : '新增商品'}</Text>
            <TextInput
              style={styles.input}
              placeholder="名称（如：馒头）"
              value={catName}
              onChangeText={setCatName}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="描述（如：白面馒头，非包子）"
              value={catDetail}
              onChangeText={setCatDetail}
              multiline
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => !savingCatalog && setCatalogModal(false)} style={styles.modalCancel}>
                <Text>取消</Text>
              </Pressable>
              <Pressable
                onPress={() => void saveCatalog()}
                disabled={savingCatalog}
                style={[styles.modalOk, savingCatalog && styles.primaryBtnDisabled]}
              >
                {savingCatalog ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>保存</Text>}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 12, paddingBottom: 40, gap: 12 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 14,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(17,17,17,0.08)',
    gap: 10,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: IOS_COLORS.label },
  hint: { fontSize: 12, color: IOS_COLORS.labelSecondary, marginTop: -4 },
  label: { fontSize: 13, fontWeight: '600', color: IOS_COLORS.labelSecondary },
  warn: { fontSize: 13, color: IOS_COLORS.orange },
  muted: { fontSize: 14, color: IOS_COLORS.labelSecondary },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(17,17,17,0.12)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: { minHeight: 72, textAlignVertical: 'top' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: IOS_COLORS.fillLight,
    maxWidth: '48%',
  },
  chipActive: { backgroundColor: IOS_COLORS.blueLight },
  chipText: { fontSize: 14, color: IOS_COLORS.label, fontWeight: '600' },
  chipTextActive: { color: IOS_COLORS.blue },
  collectorRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  primaryBtn: {
    backgroundColor: IOS_COLORS.blue,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { fontSize: 15, color: IOS_COLORS.blue, fontWeight: '600' },
  entryRow: {
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(17,17,17,0.08)',
  },
  entryAmt: { fontSize: 16, fontWeight: '700', color: '#34C759' },
  entryDesc: { fontSize: 13, color: IOS_COLORS.labelSecondary, marginTop: 4 },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(17,17,17,0.06)',
    gap: 6,
  },
  productName: { fontSize: 16, fontWeight: '600', color: IOS_COLORS.label },
  productDetail: { fontSize: 13, color: IOS_COLORS.labelSecondary, marginTop: 2 },
  badge: { fontSize: 12, color: IOS_COLORS.orange, fontWeight: '600' },
  iconBtn: { padding: 6 },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    gap: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  modalCancel: { paddingVertical: 10, paddingHorizontal: 14 },
  modalOk: {
    backgroundColor: IOS_COLORS.blue,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 22,
    minWidth: 88,
    alignItems: 'center',
  },
});
