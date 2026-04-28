import { Modal, View, Text, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { IOS_COLORS } from '../../theme/paperTheme';
import { type MockOrder } from '../../constants/mockData';
import { deliveryFailStyles as fStyles } from './deliveryFailStyles';

export function DeliveryFailSheet({
  order,
  reason,
  reasonOptions,
  extra,
  submitting,
  onSelectReason,
  onChangeExtra,
  onClose,
  onSubmit,
}: {
  order: MockOrder | null;
  reason: string;
  reasonOptions: readonly string[];
  extra: string;
  submitting: boolean;
  onSelectReason: (v: string) => void;
  onChangeExtra: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (!order) return null;
  const memberName = order.member_nickname || order.member_name;
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={fStyles.overlay} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={fStyles.sheet}>
        <View style={fStyles.card}>
          <View style={fStyles.handle} />
          <Text style={fStyles.title}>送餐失败</Text>
          <Text style={fStyles.sub}>
            {memberName} · {order.meal_type === 'lunch' ? '午餐' : '晚餐'} {order.quantity} 份
          </Text>
          <Text style={fStyles.hint}>选择失败原因（会自动退回餐数）</Text>

          <View style={fStyles.reasonWrap}>
            {reasonOptions.map((item) => {
              const active = reason === item;
              return (
                <Pressable
                  key={item}
                  style={[fStyles.reasonChip, active && fStyles.reasonChipActive]}
                  onPress={() => onSelectReason(item)}
                >
                  <Text style={[fStyles.reasonChipText, active && fStyles.reasonChipTextActive]}>{item}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={fStyles.inputBox}>
            <TextInput
              value={extra}
              onChangeText={onChangeExtra}
              placeholder="补充说明（可选）"
              placeholderTextColor={IOS_COLORS.labelTertiary}
              style={fStyles.input}
              multiline
              maxLength={120}
            />
          </View>

          <View style={fStyles.actions}>
            <Pressable style={fStyles.cancelBtn} onPress={onClose} disabled={submitting}>
              <Text style={fStyles.cancelBtnText}>暂不处理</Text>
            </Pressable>
            <Pressable
              style={[fStyles.confirmBtn, submitting && { opacity: 0.7 }]}
              onPress={onSubmit}
              disabled={submitting}
            >
              <Text style={fStyles.confirmBtnText}>{submitting ? '提交中...' : '确认送餐失败'}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
