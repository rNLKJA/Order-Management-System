/**
 * 会员卡管理页（MEA-11）。
 *
 * 展示某会员的所有历史卡（倒序），按状态 Badge 区分 active / upgraded / exhausted。
 * 顶部按钮：
 *  - 无 active 卡：购买新卡（打开 CardFlowModal mode="purchase"）
 *  - 有 active 卡：升级卡种（打开 CardFlowModal mode="upgrade"）
 *
 * 与 members/[id].tsx 共用同一个 CardFlowModal（UX / 字段保持一致）；差异仅在 onSubmit：
 *  - 这里调 cardsApi.purchase/upgrade 真实 API
 *  - Mock 详情页调 mockPurchaseCard/mockUpgradeCard
 *
 * 注：collector_user_id / created_by_user_id 目前后端默认值兜底，前端选的姓名写入 notes
 * 字段里保留审计线索。后续加 /api/users 员工列表端点后，可以把姓名翻译成 user_id 再提交。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, RefreshControl, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  ActivityIndicator,
  Badge,
  Button,
  HelperText,
  Snackbar,
  Text,
  useTheme,
} from 'react-native-paper';
import { MeshBackground, AppHeader, GlassSurface } from '../../../../../components/ui';
import { COLORS, SPACING, RADIUS, TYPE } from '../../../../../theme/paperTheme';
import { getCardSpec, type SubscriptionCardCode } from '@meal/shared';
import { cardsApi, type Card as CardModel, type CardStatus } from '../../../../../api/cards';
import { ApiError } from '../../../../../api/client';
import {
  CardFlowModal,
  type CardFlowSubmitPayload,
} from '../../../../../components/CardFlowModal';

function triggerSuccessHaptic() {
  if (Platform.OS !== 'web') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }
}

function buildNotesPrefix(p: CardFlowSubmitPayload): string {
  // 把收款人/录入者先缀进 notes，便于后端没有 user_id 映射时仍保留审计线索。
  // /api/users 员工列表上线后，这个前缀可以改为真实 collector_user_id。
  const prefix = `收款：${p.collector} · 录入：${p.recorder}`;
  return p.notes ? `${prefix}\n${p.notes}` : prefix;
}

export default function MemberCardsScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ id: string; is_hospital?: string }>();
  const memberId = Number(params.id);
  const memberIsHospital = params.is_hospital === '1' || params.is_hospital === 'true';

  const [cards, setCards] = useState<CardModel[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const activeCard = useMemo(
    () => cards?.find((c) => c.status === 'active') ?? null,
    [cards],
  );

  const load = useCallback(async () => {
    if (!Number.isFinite(memberId) || memberId <= 0) {
      setErrorMsg('会员 id 非法');
      setLoading(false);
      return;
    }
    setErrorMsg(null);
    try {
      const { cards } = await cardsApi.list(memberId, 'all');
      setCards(cards);
    } catch (e) {
      if (e instanceof ApiError) setErrorMsg(e.message);
      else setErrorMsg('加载卡列表失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [memberId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const handlePurchase = useCallback(
    async (p: CardFlowSubmitPayload) => {
      const res = await cardsApi.purchase({
        member_id: memberId,
        card_code: p.spec.code,
        is_hospital: p.isHospital,
        notes: buildNotesPrefix(p),
      });
      setPurchaseOpen(false);
      await load();
      triggerSuccessHaptic();
      setToast(`已开通【${p.spec.name}】，应收 ¥${res.card.paid_amount}`);
    },
    [memberId, load],
  );

  const handleUpgrade = useCallback(
    async (p: CardFlowSubmitPayload) => {
      if (!activeCard) throw new Error('当前无进行中的卡');
      const res = await cardsApi.upgrade(activeCard.id, {
        card_code: p.spec.code,
        is_hospital: p.isHospital,
        notes: buildNotesPrefix(p),
      });
      setUpgradeOpen(false);
      await load();
      triggerSuccessHaptic();
      setToast(
        `已升级到【${p.spec.name}】，补差价 ¥${res.diff}，剩 ${res.new_card.remaining_meals} 份`,
      );
    },
    [activeCard, load],
  );

  const activeSpec = activeCard
    ? getCardSpec(activeCard.is_hospital, activeCard.card_code as SubscriptionCardCode)
    : null;

  return (
    <View style={{ flex: 1 }}>
      <MeshBackground />
      <SafeAreaView style={{ flex: 1 }}>
        <AppHeader
          title="卡管理"
          onBack={() => router.back()}
          right={
            activeCard ? (
              <Button
                mode="contained"
                icon="arrow-up-bold"
                compact
                onPress={() => setUpgradeOpen(true)}
                buttonColor={COLORS.brand}
              >
                升级
              </Button>
            ) : (
              <Button
                mode="contained"
                icon="plus"
                compact
                onPress={() => setPurchaseOpen(true)}
                buttonColor={COLORS.brand}
              >
                购卡
              </Button>
            )
          }
        />
        <ScrollView
          contentContainerStyle={styles.container}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {errorMsg ? (
            <HelperText type="error" visible>
              {errorMsg}
            </HelperText>
          ) : null}

          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator />
              <Text variant="bodySmall" style={{ color: COLORS.text.secondary }}>
                加载中...
              </Text>
            </View>
          ) : cards && cards.length > 0 ? (
            cards.map((card) => (
              <View key={card.id}>
                <CardRow card={card} />
              </View>
            ))
          ) : (
            <GlassSurface style={styles.emptyCard}>
              <Text style={{ ...TYPE.headline, color: COLORS.text.primary }}>
                暂无购卡记录
              </Text>
              <Text style={{ ...TYPE.body, color: COLORS.text.secondary, marginTop: 6 }}>
                点右上方「购卡」开始。
              </Text>
            </GlassSurface>
          )}
        </ScrollView>

      <CardFlowModal
        visible={purchaseOpen}
        mode="purchase"
        memberName={`会员 #${memberId}`}
        memberIsHospital={memberIsHospital}
        onClose={() => setPurchaseOpen(false)}
        onSubmit={handlePurchase}
      />
      {activeCard ? (
        <CardFlowModal
          visible={upgradeOpen}
          mode="upgrade"
          memberName={`会员 #${memberId}`}
          memberIsHospital={memberIsHospital}
          currentCard={{
            card_name: activeSpec?.name,
            is_hospital: activeCard.is_hospital,
            paid_amount: activeCard.paid_amount,
            used_meals: activeCard.used_meals,
            total_meals: activeCard.total_meals,
          }}
          onClose={() => setUpgradeOpen(false)}
          onSubmit={handleUpgrade}
        />
      ) : null}

        <Snackbar
          visible={!!toast}
          onDismiss={() => setToast(null)}
          duration={3200}
          action={{ label: '知道了', onPress: () => setToast(null) }}
        >
          {toast}
        </Snackbar>
      </SafeAreaView>
    </View>
  );
}

function CardRow({ card }: { card: CardModel }) {
  const spec = getCardSpec(card.is_hospital, card.card_code as SubscriptionCardCode);
  const title = spec ? spec.name : card.card_code;
  const progress =
    card.total_meals > 0 ? Math.min(1, card.used_meals / card.total_meals) : 0;

  return (
    <GlassSurface style={styles.cardRow}>
      <View style={styles.cardHeaderRow}>
        <Text style={{ ...TYPE.headline, color: COLORS.text.primary }}>
          {title}
        </Text>
        <StatusBadge status={card.status} />
      </View>

      <Text style={{ ...TYPE.caption, color: COLORS.text.secondary, marginTop: 4 }}>
        {card.is_hospital ? '院内订阅' : '院外订阅'} · ¥{card.paid_amount}
      </Text>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${Math.round(progress * 100)}%`,
              backgroundColor: COLORS.brand,
            },
          ]}
        />
      </View>
      <Text style={{ ...TYPE.caption, color: COLORS.text.secondary, marginTop: 4 }}>
        已用 {card.used_meals} / {card.total_meals} 餐 · 剩余 {card.remaining_meals} 餐
      </Text>

      {card.upgraded_from_id ? (
        <Text style={{ ...TYPE.caption, color: COLORS.text.secondary, marginTop: 4 }}>
          升级自 卡 #{card.upgraded_from_id}
        </Text>
      ) : null}

      {card.notes ? (
        <Text
          style={{ ...TYPE.caption, color: COLORS.text.secondary, marginTop: 4, fontStyle: 'italic' }}
        >
          备注：{card.notes}
        </Text>
      ) : null}
    </GlassSurface>
  );
}

function StatusBadge({ status }: { status: CardStatus }) {
  const theme = useTheme();
  let label: string;
  let bg: string;
  let fg: string;
  switch (status) {
    case 'active':
      label = '在用';
      bg = theme.colors.primaryContainer;
      fg = theme.colors.onPrimaryContainer;
      break;
    case 'upgraded':
      label = '已升级';
      bg = theme.colors.secondaryContainer;
      fg = theme.colors.onSecondaryContainer;
      break;
    case 'exhausted':
      label = '已用完';
      bg = theme.colors.surfaceVariant;
      fg = theme.colors.onSurfaceVariant;
      break;
    case 'refunded':
      label = '已退卡';
      bg = theme.colors.errorContainer;
      fg = theme.colors.onErrorContainer;
      break;
    default:
      label = status;
      bg = theme.colors.surfaceVariant;
      fg = theme.colors.onSurfaceVariant;
      break;
  }
  return (
    <Badge visible style={{ backgroundColor: bg, color: fg, alignSelf: 'center' }}>
      {label}
    </Badge>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  loading: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyCard: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
  },
  cardRow: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressTrack: {
    marginTop: 10,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
});
