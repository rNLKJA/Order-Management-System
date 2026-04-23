/**
 * 会员卡管理页（MEA-11）。
 *
 * 展示某会员的所有历史卡（倒序），按状态 Badge 区分 active / upgraded / exhausted。
 * 顶部按钮：
 *  - 无 active 卡：购买新卡（打开 CardPurchaseModal）
 *  - 有 active 卡：升级卡种（打开 CardUpgradeModal）
 *
 * 注：本页故意独立于 members/[id].tsx（那个文件归 MEA-10 agent 负责），
 * 所以用户从会员详情里点"卡管理"按钮跳到这里，而不是直接在详情页里嵌 Modal。
 *
 * 本页手动拉数据（无 useQuery 封装），后续切 TanStack Query 是纯增量改造。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, RefreshControl } from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import {
  ActivityIndicator,
  Badge,
  Button,
  Card,
  Divider,
  HelperText,
  Text,
  useTheme,
} from 'react-native-paper';
import { getCardSpec, type SubscriptionCardCode } from '@meal/shared';
import { cardsApi, type Card as CardModel, type CardStatus } from '../../../../../api/cards';
import { ApiError } from '../../../../../api/client';
import { CardPurchaseModal } from '../../../../../components/CardPurchaseModal';
import { CardUpgradeModal } from '../../../../../components/CardUpgradeModal';

export default function MemberCardsScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ id: string; is_hospital?: string }>();
  const memberId = Number(params.id);
  // is_hospital 作为 query 从会员详情传进来；取不到时默认 false（会员详情页应总是带上）。
  const memberIsHospital = params.is_hospital === '1' || params.is_hospital === 'true';

  const [cards, setCards] = useState<CardModel[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  return (
    <>
      <Stack.Screen options={{ title: '卡管理' }} />
      <ScrollView
        style={{ backgroundColor: theme.colors.background }}
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <Button mode="outlined" onPress={() => router.back()}>
            返回
          </Button>
          {activeCard ? (
            <Button
              mode="contained"
              icon="arrow-up-bold"
              onPress={() => setUpgradeOpen(true)}
            >
              升级卡种
            </Button>
          ) : (
            <Button
              mode="contained"
              icon="plus"
              onPress={() => setPurchaseOpen(true)}
            >
              购买新卡
            </Button>
          )}
        </View>

        {errorMsg ? (
          <HelperText type="error" visible>
            {errorMsg}
          </HelperText>
        ) : null}

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator />
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              加载中...
            </Text>
          </View>
        ) : cards && cards.length > 0 ? (
          cards.map((card, idx) => (
            <View key={card.id}>
              <CardRow card={card} />
              {idx < cards.length - 1 ? <Divider style={styles.divider} /> : null}
            </View>
          ))
        ) : (
          <Card mode="outlined" style={styles.emptyCard}>
            <Card.Content>
              <Text variant="titleMedium" style={{ fontWeight: '600' }}>
                暂无购卡记录
              </Text>
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant, marginTop: 6 }}
              >
                点右上方"购买新卡"开始。
              </Text>
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      <CardPurchaseModal
        visible={purchaseOpen}
        memberId={memberId}
        memberIsHospital={memberIsHospital}
        onDismiss={() => setPurchaseOpen(false)}
        onSuccess={() => {
          setPurchaseOpen(false);
          load();
        }}
      />
      {activeCard ? (
        <CardUpgradeModal
          visible={upgradeOpen}
          currentCard={activeCard}
          onDismiss={() => setUpgradeOpen(false)}
          onSuccess={() => {
            setUpgradeOpen(false);
            load();
          }}
        />
      ) : null}
    </>
  );
}

function CardRow({ card }: { card: CardModel }) {
  const theme = useTheme();
  const spec = getCardSpec(card.is_hospital, card.card_code as SubscriptionCardCode);
  const title = spec ? spec.name : card.card_code;
  const progress =
    card.total_meals > 0 ? Math.min(1, card.used_meals / card.total_meals) : 0;

  return (
    <Card mode="outlined" style={styles.cardRow}>
      <Card.Content>
        <View style={styles.cardHeaderRow}>
          <Text variant="titleMedium" style={{ fontWeight: '600' }}>
            {title}
          </Text>
          <StatusBadge status={card.status} />
        </View>

        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
          {card.is_hospital ? '院内订阅' : '院外订阅'} · ¥{card.paid_amount}
        </Text>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.round(progress * 100)}%`,
                backgroundColor: theme.colors.primary,
              },
            ]}
          />
        </View>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
          已用 {card.used_meals} / {card.total_meals} 餐 · 剩余 {card.remaining_meals} 餐
        </Text>

        {card.upgraded_from_id ? (
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}
          >
            升级自 卡 #{card.upgraded_from_id}
          </Text>
        ) : null}
      </Card.Content>
    </Card>
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
  }
  return (
    <Badge visible style={{ backgroundColor: bg, color: fg, alignSelf: 'center' }}>
      {label}
    </Badge>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  loading: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyCard: {
    borderRadius: 12,
  },
  divider: {
    marginVertical: 6,
  },
  cardRow: {
    borderRadius: 12,
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
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
});
