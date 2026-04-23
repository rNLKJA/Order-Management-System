/**
 * 购卡 Modal（MEA-11 前端核心组件）。
 *
 * UI（贴合 plan §6.3）：
 *  - 医院订阅 checkbox：切换院内 / 院外价目表；默认跟随传入的 memberIsHospital
 *  - 价格卡网格：listCards(isHospital) 返回的卡，全部可选；选中后高亮
 *  - 底部：应收 ¥XXX + 主按钮"确认购买"
 *  - 错误 / Snackbar 反馈
 *
 * 不在本 Modal 里做：
 *  - 收款人 / 录入者下拉（settings/users 的 API 归后续 slice，这里先用 backend 默认值兜底）
 *  - 购卡时间选择器（移动端原生 DatePicker 下沉到后续迭代，默认取"现在"）
 *
 * 这样保持组件小、依赖少，后续追加三个字段是纯增量改动。
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
  type CardSpec,
  type SubscriptionCardCode,
} from '@meal/shared';
import { ApiError } from '../api/client';
import { cardsApi } from '../api/cards';

export interface CardPurchaseModalProps {
  visible: boolean;
  memberId: number;
  memberIsHospital: boolean;
  onDismiss: () => void;
  onSuccess: () => void;
}

export function CardPurchaseModal({
  visible,
  memberId,
  memberIsHospital,
  onDismiss,
  onSuccess,
}: CardPurchaseModalProps) {
  const theme = useTheme();
  const [isHospital, setIsHospital] = useState(memberIsHospital);
  const [selectedCode, setSelectedCode] = useState<SubscriptionCardCode | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setIsHospital(memberIsHospital);
      setSelectedCode(null);
      setErrorMsg(null);
      setSubmitting(false);
    }
  }, [visible, memberIsHospital]);

  const options = useMemo(() => listCards(isHospital), [isHospital]);
  const selectedSpec = useMemo<CardSpec | null>(
    () => options.find((c) => c.code === selectedCode) ?? null,
    [options, selectedCode],
  );

  const onSubmit = async () => {
    if (!selectedSpec) {
      setErrorMsg('请先选择一张卡');
      return;
    }
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await cardsApi.purchase({
        member_id: memberId,
        card_code: selectedSpec.code,
        is_hospital: isHospital,
      });
      onSuccess();
    } catch (e) {
      if (e instanceof ApiError) {
        setErrorMsg(e.message);
      } else {
        setErrorMsg('购卡失败，请重试');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} dismissable={!submitting}>
        <Dialog.Title>购买新卡</Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView contentContainerStyle={styles.content}>
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
              可选卡种（{isHospital ? '院内' : '院外'}）
            </Text>

            <View style={styles.grid}>
              {options.map((opt) => {
                const active = opt.code === selectedCode;
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
                    ]}
                    onTouchEnd={() => setSelectedCode(opt.code)}
                  >
                    <Text variant="titleMedium" style={styles.cardName}>
                      {opt.name}
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
          <Text variant="titleMedium" style={styles.total}>
            应收 {selectedSpec ? `¥${selectedSpec.totalPrice}` : '—'}
          </Text>
          <View style={styles.actionButtons}>
            <Button onPress={onDismiss} disabled={submitting}>
              取消
            </Button>
            <Button
              mode="contained"
              onPress={onSubmit}
              loading={submitting}
              disabled={submitting || !selectedSpec}
            >
              确认购买
            </Button>
          </View>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
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
  total: {
    fontWeight: '700',
    textAlign: 'right',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
});
