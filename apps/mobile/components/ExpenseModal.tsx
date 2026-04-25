/**
 * 手动录入支出 Modal（MEA-13）。
 *
 * 字段：日期（YYYY-MM-DD 文本输入）/ 金额（数字输入，>0）/ 备注（多行，必填）。
 * 主按钮「保存」→ 调用 createExpense。成功后调用 onSaved 并关闭。
 */

import { useEffect, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import {
  Button,
  Modal,
  Portal,
  Text,
  TextInput,
  useTheme,
  HelperText,
} from 'react-native-paper';
import { expenseCreateSchema, formatDate } from '@meal/shared';
import { createExpense } from '../api/finance';
import { DatePicker } from './ui';
import { COLORS, SPACING, TYPE } from '../theme/paperTheme';

interface Props {
  visible: boolean;
  onDismiss: () => void;
  onSaved: () => void;
}

export function ExpenseModal({ visible, onDismiss, onSaved }: Props) {
  const theme = useTheme();
  const [entryDate, setEntryDate] = useState(() => formatDate(new Date()));
  const [amountText, setAmountText] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setEntryDate(formatDate(new Date()));
      setAmountText('');
      setDescription('');
      setError(null);
    }
  }, [visible]);

  const amount = Number(amountText);
  const amountValid = Number.isFinite(amount) && amount > 0;
  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(entryDate);
  const descValid = description.trim().length > 0;
  const canSubmit = amountValid && dateValid && descValid && !submitting;
  const quickAmounts = [35, 50, 100, 200] as const;

  const handleSave = async () => {
    setError(null);
    const parsed = expenseCreateSchema.safeParse({
      entry_date: entryDate,
      amount,
      description: description.trim(),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? '表单不合法');
      return;
    }
    setSubmitting(true);
    try {
      await createExpense(parsed.data);
      onSaved();
      onDismiss();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={submitting ? undefined : onDismiss}
        contentContainerStyle={[
          styles.modal,
          { backgroundColor: theme.colors.surface },
        ]}
      >
        <Text variant="titleLarge" style={styles.title}>
          新增支出
        </Text>

        <DatePicker
          label="日期"
          value={entryDate}
          onChange={setEntryDate}
          max={formatDate(new Date())}
          style={{ marginBottom: 8 }}
        />
        {!dateValid && entryDate.length > 0 && (
          <HelperText type="error" visible>
            日期格式应为 YYYY-MM-DD
          </HelperText>
        )}

        <View style={styles.quickAmountRow}>
          {quickAmounts.map((amt) => (
            <Button
              key={amt}
              mode="text"
              compact
              style={styles.quickAmountBtn}
              onPress={() => setAmountText(String(amt))}
            >
              ¥{amt}
            </Button>
          ))}
        </View>

        <TextInput
          label="金额（¥）"
          mode="outlined"
          value={amountText}
          onChangeText={(t) => setAmountText(t.replace(/[^0-9.]/g, ''))}
          keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
          placeholder="例如 45.50"
          style={styles.field}
        />
        {!amountValid && amountText.length > 0 && (
          <HelperText type="error" visible>
            金额必须大于 0
          </HelperText>
        )}

        <TextInput
          label="备注"
          mode="outlined"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          placeholder="请写清用途，例如：餐盒、调料、清洁用品"
          style={styles.field}
        />

        {error && (
          <HelperText type="error" visible>
            {error}
          </HelperText>
        )}

        <View style={styles.actions}>
          <Button
            mode="text"
            onPress={onDismiss}
            disabled={submitting}
            style={styles.actionBtn}
          >
            取消
          </Button>
          <Button
            mode="contained"
            onPress={handleSave}
            disabled={!canSubmit}
            loading={submitting}
            style={styles.actionBtn}
          >
            保存
          </Button>
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    marginHorizontal: 20,
    padding: 18,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  title: {
    ...TYPE.title2,
    fontWeight: '700',
    marginBottom: 14,
    color: COLORS.text.primary,
  },
  field: {
    marginBottom: 2,
  },
  quickAmountRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
    marginBottom: 8,
  },
  quickAmountBtn: {
    borderRadius: 10,
    backgroundColor: 'rgba(0,122,255,0.08)',
  },
  actions: {
    marginTop: SPACING.base,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionBtn: {
    minWidth: 80,
  },
});
