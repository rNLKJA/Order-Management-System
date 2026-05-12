/**
 * 记录非餐品零售收入（洗护等），不绑定会员。
 * POST /api/finance/other-product-income
 */

import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Button,
  Modal,
  Portal,
  Text,
  TextInput,
  useTheme,
  HelperText,
} from 'react-native-paper';
import { otherProductIncomeCreateSchema, formatDate } from '@meal/shared';
import { createOtherProductIncome } from '../api/finance';
import { DatePicker } from './ui';
import { COLORS, SPACING, TYPE } from '../theme/paperTheme';

interface Props {
  visible: boolean;
  onDismiss: () => void;
  onSaved: () => void;
}

export function OtherProductIncomeModal({ visible, onDismiss, onSaved }: Props) {
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
  const quickAmounts = [20, 50, 100, 200] as const;

  const handleSave = async () => {
    setError(null);
    const parsed = otherProductIncomeCreateSchema.safeParse({
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
      await createOtherProductIncome(parsed.data);
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
          其他产品收入
        </Text>
        <Text variant="bodySmall" style={styles.subtitle}>
          洗护、日用品等零售；不关联会员档案
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

        <TextInput
          label="金额（元）"
          value={amountText}
          onChangeText={setAmountText}
          mode="outlined"
          keyboardType="decimal-pad"
          style={{ marginBottom: 8 }}
        />
        <View style={styles.quickRow}>
          {quickAmounts.map((n) => (
            <Button
              key={n}
              mode="outlined"
              compact
              onPress={() => setAmountText(String(n))}
              style={styles.quickBtn}
            >
              ¥{n}
            </Button>
          ))}
        </View>
        {!amountValid && amountText.length > 0 && (
          <HelperText type="error" visible>
            请输入大于 0 的金额
          </HelperText>
        )}

        <TextInput
          label="摘要（如「洗发水 2 瓶」）"
          value={description}
          onChangeText={setDescription}
          mode="outlined"
          multiline
          numberOfLines={3}
          style={{ marginTop: 8 }}
        />
        {!descValid && description.length > 0 && (
          <HelperText type="error" visible>
            请填写摘要
          </HelperText>
        )}

        {error && (
          <HelperText type="error" visible style={{ marginTop: 8 }}>
            {error}
          </HelperText>
        )}

        <View style={styles.actions}>
          <Button mode="outlined" onPress={onDismiss} disabled={submitting} style={styles.actionBtn}>
            取消
          </Button>
          <Button
            mode="contained"
            onPress={() => void handleSave()}
            disabled={!canSubmit}
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
    margin: 16,
    borderRadius: 12,
    padding: 20,
    maxHeight: '90%',
  },
  title: { fontWeight: '700', marginBottom: 4 },
  subtitle: { ...TYPE.caption, color: COLORS.text.secondary, marginBottom: SPACING.md },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  quickBtn: { marginRight: 0 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
  },
  actionBtn: { minWidth: 96 },
});
