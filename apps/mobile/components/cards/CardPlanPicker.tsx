/**
 * 卡种选择：横向胶囊 + 选中详情卡 + 其他（员工 / 自定义）
 */

import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  STAFF_CARD_CODE,
  type CardSpec,
  type SubscriptionCardCode,
} from '@meal/shared';
import { COLORS, IOS_COLORS } from '../../theme/paperTheme';
import { cardFlowStyles as styles } from './cardFlowStyles';
type PickerMode = 'purchase' | 'upgrade' | 'renew' | 'advance';

function mealsLabel(spec: CardSpec): string {
  if (spec.code === STAFF_CARD_CODE) return '扣次不计余额';
  return `${spec.meals} 份 · ¥${spec.unitPrice}/份`;
}

function priceLabel(spec: CardSpec): string {
  if (spec.code === STAFF_CARD_CODE) return '¥0';
  return `¥${spec.totalPrice}`;
}

export function CardPlanPicker({
  mode,
  cards,
  allowedCodes,
  selectedCode,
  submitting,
  showCustom,
  onSelect,
}: {
  mode: PickerMode;
  cards: CardSpec[];
  allowedCodes: Set<SubscriptionCardCode>;
  selectedCode: SubscriptionCardCode | null;
  submitting: boolean;
  showCustom: boolean;
  onSelect: (code: SubscriptionCardCode) => void;
}) {
  const staffCard = cards.find((c) => c.code === STAFF_CARD_CODE);
  const mainCards = cards.filter((c) => c.code !== STAFF_CARD_CODE);

  const selectedMain =
    selectedCode && selectedCode !== 'custom' && selectedCode !== STAFF_CARD_CODE
      ? cards.find((c) => c.code === selectedCode) ?? null
      : null;

  const pick = (code: SubscriptionCardCode) => {
    if (!allowedCodes.has(code) || submitting || mode === 'renew') return;
    onSelect(code);
  };

  return (
    <View style={styles.pickerWrap}>
      {mainCards.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillScroll}
          keyboardShouldPersistTaps="handled"
        >
          {mainCards.map((opt) => {
            const enabled = allowedCodes.has(opt.code);
            const active = enabled && opt.code === selectedCode;
            return (
              <Pressable
                key={opt.code}
                disabled={!enabled || submitting || mode === 'renew'}
                onPress={() => pick(opt.code)}
                style={({ pressed }) => [
                  styles.planPill,
                  active && styles.planPillActive,
                  !enabled && styles.planPillDisabled,
                  pressed && enabled && { opacity: 0.88 },
                ]}
              >
                <Text
                  style={[styles.planPillText, active && styles.planPillTextActive]}
                  numberOfLines={1}
                >
                  {opt.name}
                </Text>
                <Text
                  style={[styles.planPillSub, active && styles.planPillSubActive]}
                  numberOfLines={1}
                >
                  {`¥${opt.totalPrice}`}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {selectedMain ? (
        <View style={[styles.planDetail, selectedCode === selectedMain.code && styles.planDetailActive]}>
          <View style={styles.planDetailTop}>
            <Text style={styles.planDetailName}>{selectedMain.name}</Text>
            <Text style={styles.planDetailPrice}>{priceLabel(selectedMain)}</Text>
          </View>
          <Text style={styles.planDetailMeta}>{mealsLabel(selectedMain)}</Text>
          {mode === 'upgrade' && !allowedCodes.has(selectedMain.code) ? (
            <Text style={styles.disabledReason}>不支持降级或同价</Text>
          ) : null}
        </View>
      ) : selectedCode === 'custom' ? (
        <View style={[styles.planDetail, styles.planDetailActive]}>
          <View style={styles.planDetailTop}>
            <Text style={styles.planDetailName}>自定义套餐</Text>
            <Text style={styles.planDetailPrice}>自定</Text>
          </View>
          <Text style={styles.planDetailMeta}>在下方填写名称、餐次与总价</Text>
        </View>
      ) : selectedCode === STAFF_CARD_CODE && staffCard ? (
        <View style={[styles.planDetail, styles.planDetailActive]}>
          <View style={styles.planDetailTop}>
            <Text style={styles.planDetailName}>{staffCard.name}</Text>
            <Text style={styles.planDetailPrice}>¥0</Text>
          </View>
          <Text style={styles.planDetailMeta}>{mealsLabel(staffCard)}</Text>
        </View>
      ) : (
        <View style={styles.planDetailHint}>
          <Ionicons name="hand-left-outline" size={18} color={IOS_COLORS.labelTertiary} />
          <Text style={styles.planDetailHintText}>点选上方卡种查看价格与份数</Text>
        </View>
      )}

      {(staffCard || showCustom) && mode !== 'renew' ? (
        <View style={styles.planOtherRow}>
          {staffCard ? (
            <Pressable
              disabled={!allowedCodes.has(STAFF_CARD_CODE) || submitting}
              onPress={() => pick(STAFF_CARD_CODE)}
              style={[
                styles.planOtherBtn,
                selectedCode === STAFF_CARD_CODE && styles.planOtherBtnActive,
              ]}
            >
              <Ionicons
                name="id-card-outline"
                size={16}
                color={selectedCode === STAFF_CARD_CODE ? COLORS.brand : IOS_COLORS.labelSecondary}
              />
              <Text
                style={[
                  styles.planOtherBtnText,
                  selectedCode === STAFF_CARD_CODE && styles.planOtherBtnTextActive,
                ]}
              >
                员工卡
              </Text>
            </Pressable>
          ) : null}
          {showCustom ? (
            <Pressable
              disabled={!allowedCodes.has('custom') || submitting}
              onPress={() => pick('custom')}
              style={[
                styles.planOtherBtn,
                selectedCode === 'custom' && styles.planOtherBtnActive,
              ]}
            >
              <Ionicons
                name="pricetag-outline"
                size={16}
                color={selectedCode === 'custom' ? COLORS.brand : IOS_COLORS.labelSecondary}
              />
              <Text
                style={[
                  styles.planOtherBtnText,
                  selectedCode === 'custom' && styles.planOtherBtnTextActive,
                ]}
              >
                自定义
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
