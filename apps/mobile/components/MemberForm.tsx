/**
 * 会员表单（创建页）— 与编辑弹窗、订餐录入页同款分组卡片 + 底部提交条。
 */

import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { memberCreateSchema, type MemberCreateInput } from '@meal/shared';
import { Button } from './ui';
import { MemberFormFields, type MemberFormFieldValues } from './members/MemberFormFields';
import { MemberFormPageBanner } from './members/MemberFormPageBanner';
import { memberFormStyles as styles } from './members/memberFormStyles';

export interface MemberFormValues extends MemberCreateInput {}

interface Props {
  initial?: Partial<MemberFormValues>;
  submitLabel: string;
  submitting?: boolean;
  onSubmit: (values: MemberFormValues) => void | Promise<void>;
  onCancel?: () => void;
}

function toFieldValues(initial?: Partial<MemberFormValues>): MemberFormFieldValues {
  return {
    name: initial?.name ?? '',
    nickname: initial?.nickname ?? '',
    phone: initial?.phone ?? '',
    wechatId: initial?.wechat_id ?? '',
    address: initial?.address ?? '',
    dietaryNotes: initial?.dietary_notes ?? '',
    isHospital: initial?.is_hospital ?? false,
  };
}

function toApiPayload(v: MemberFormFieldValues): MemberCreateInput {
  return {
    name: v.name,
    nickname: v.nickname,
    phone: v.phone,
    wechat_id: v.wechatId,
    address: v.address,
    dietary_notes: v.dietaryNotes,
    is_hospital: v.isHospital,
  };
}

export function MemberForm({
  initial,
  submitLabel,
  submitting,
  onSubmit,
  onCancel,
}: Props) {
  const insets = useSafeAreaInsets();
  const [values, setValues] = useState<MemberFormFieldValues>(() => toFieldValues(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const parsed = useMemo(() => memberCreateSchema.safeParse(toApiPayload(values)), [values]);

  const onChange = <K extends keyof MemberFormFieldValues>(key: K, value: MemberFormFieldValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    await onSubmit(parsed.data);
  };

  const padBottom = Math.max(insets.bottom, 10);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scroll, { paddingBottom: 100 + padBottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <MemberFormPageBanner
          title="档案信息"
          description="姓名与手机为必填。创建后可开卡、在每日订餐中录入。"
        />
        <MemberFormFields values={values} errors={errors} onChange={onChange} />
      </ScrollView>

      <View style={[styles.submitBarShell, { paddingBottom: padBottom }]}>
        <View style={styles.submitBarCard}>
          {onCancel ? (
            <Button
              label="取消"
              variant="secondary"
              onPress={onCancel}
              disabled={submitting}
              style={styles.submitBtnFlex}
            />
          ) : null}
          <Button
            label={submitLabel}
            onPress={handleSubmit}
            loading={submitting}
            disabled={submitting}
            style={styles.submitBtnFlex}
            fullWidth={!onCancel}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
