/**
 * 升级 Modal（MEA-11）。
 *
 * 与购卡 Modal 复用相似布局；差异：
 *  - 展示所有卡，但 listUpgradeOptions 返回的之外的卡被灰掉且 disable（不支持降级 / 同价）
 *  - 底部显示：补差价 ¥XXX / 升级后剩餐 XX
 *  - 接收一个 currentCard，用 paid_amount + used_meals 做约束
 */

import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Checkbox,
  Dialog,
  HelperText,
  Portal,
  Text,
  useTheme,
} from 'react-native-paper';
import {
  listCards,
  listUpgradeOptions,
  type CardSpec,
  type SubscriptionCardCode,
} from '@meal/shared';
import { ApiError } from '../api/client';
import { cardsApi, type Card } from '../api/cards';

export interface CardUpgradeModalProps {
  visible: boolean;
  currentCard: Card;
  onDismiss: () => void;
  onSuccess: () => void;
}

export function CardUpgradeModal({
  visible,
  currentCard,
  onDismiss,
  onSuccess,
}: CardUpgradeModalProps) {
  const theme = useTheme();
  const [isHospital, setIsHospital] = useState(currentCard.is_hospital);
  const [selectedCode, setSelectedCode] = useState<SubscriptionCardCode | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setIsHospital(currentCard.is_hospital);
      setSelectedCode(null);
      setErrorMsg(null);
      setSubmitting(false);
    }
  }, [visible, currentCard]);

  const all = useMemo(() => listCards(isHospital), [isHospital]);
  const allowedCodes = useMemo(
    () =>
      new Set(
        listUpgradeOptions(isHospital, currentCard.paid_amount).map((c) => c.code),
      ),
    [isHospital, currentCard.paid_amount],
  );
  const selectedSpec = useMemo<CardSpec | null>(
    () => all.find((c) => c.code === selectedCode) ?? null,
    [all, selectedCode],
  );

  const diff =
    selectedSpec && allowedCodes.has(selectedSpec.code)
      ? round2(selectedSpec.totalPrice - currentCard.paid_amount)
      : null;
  const newRemaining =
    selectedSpec && allowedCodes.has(selectedSpec.code)
      ? selectedSpec.meals - currentCard.used_meals
      : null;

  const onSubmit = async () => {
    if (!selectedSpec || !allowedCodes.has(selectedSpec.code)) {
      setErrorMsg('请选择一张更高等级的卡（禁降级 / 禁同价）');
      return;
    }
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await cardsApi.upgrade(currentCard.id, {
        card_code: selectedSpec.code,
        is_hospital: isHospital,
      });
      onSuccess();
    } catch (e) {
      if (e instanceof ApiError) {
        setErrorMsg(e.message);
      } else {
        setErrorMsg('升级失败，请重试');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} dismissable={!submitting}>
        <Dialog.Title>升级卡种</Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView contentContainerStyle={styles.content}>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              当前卡：¥{currentCard.paid_amount}（已用 {currentCard.used_meals} / {currentCard.total_meals} 餐）
            </Text>

            <View style={styles.row}>
              <Checkbox
                status={isHospital ? 'checked' : 'unchecked'}
                onPress={() => setIsHospital((v) => !v)}
              />
              <Text variant="bodyLarge" onPress={() => setIsHospital((v) => !v)}>
                医院订阅（切换院内 / 院外价目表）
              </Text>
            </View>

            <Text variant="labelLarge" style={styles.sectionLabel}>
              可选升级目标（{isHospital ? '院内' : '院外'}）
            </Text>

            <View style={styles.grid}>
              {all.map((opt) => {
                const enabled = allowedCodes.has(opt.code);
                const active = enabled && opt.code === selectedCode;
                const disabledStyle = !enabled
                  ? {
                      opacity: 0.45,
                      backgroundColor: theme.colors.surfaceVariant,
                    }
                  : {};
                return (
                  <View
                    key={opt.code}
                    style={[
                      styles.cardOption,
                      {
                        borderColor: active
                          ? theme.colors.primary
                          : theme.colors.outlineVariant,
                        backgroundColor: active
                          ? theme.colors.primaryContainer
                          : theme.colors.surface,
                      },
                      disabledStyle,
                    ]}
                    onTouchEnd={() => {
                      if (enabled) setSelectedCode(opt.code);
                    }}
                  >
                    <Text variant="titleMedium" style={styles.cardName}>
                      {opt.name}
                      {!enabled ? '（不支持降级 / 同价）' : ''}
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {opt.meals} 餐 · ¥{opt.unitPrice} / 餐
                    </Text>
                    <Text
                      variant="titleLarge"
                      style={[styles.price, { color: theme.colors.primary }]}
                    >
                      ¥{opt.totalPrice}
                    </Text>
                  </View>
                );
              })}
            </View>

            {errorMsg ? (
              <HelperText type="error" visible style={styles.errorText}>
                {errorMsg}
              </HelperText>
            ) : null}
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions style={styles.actions}>
          <View style={styles.summaryRow}>
            <Text variant="titleMedium">
              补差价 {diff != null ? `¥${diff}` : '—'}
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              升级后剩 {newRemaining != null ? `${newRemaining}` : '—'} 餐
            </Text>
          </View>
          <View style={styles.actionButtons}>
            <Button onPress={onDismiss} disabled={submitting}>
              取消
            </Button>
            <Button
              mode="contained"
              onPress={onSubmit}
              loading={submitting}
              disabled={submitting || !selectedSpec || !allowedCodes.has(selectedSpec.code)}
            >
              确认升级
            </Button>
          </View>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const styles = StyleSheet.create({
  scrollArea: {
    paddingHorizontal: 0,
  },
  content: {
    padding: 20,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sectionLabel: {
    marginTop: 8,
  },
  grid: {
    gap: 10,
  },
  cardOption: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  cardName: {
    fontWeight: '600',
  },
  price: {
    fontWeight: '700',
    marginTop: 4,
  },
  errorText: {
    marginTop: 4,
  },
  actions: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
});
