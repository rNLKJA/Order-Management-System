/**
 * 会员资料编辑 Modal —— iOS 分组样式，与新增会员页字段布局一致。
 */

import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { memberCreateSchema, type MemberUpdateInput } from '@meal/shared';
import { IOS_COLORS } from '../theme/paperTheme';
import { type MockMember } from '../constants/mockData';
import { membersApi } from '../api/members';
import {
  MemberFormFields,
  type MemberFormFieldValues,
} from './members/MemberFormFields';
import { memberFormStyles } from './members/memberFormStyles';
import { MeshBackground } from './ui';

export interface MemberEditModalProps {
  visible: boolean;
  member: MockMember;
  onClose: () => void;
  onSaved: () => void;
}

function memberToFields(member: MockMember): MemberFormFieldValues {
  return {
    name: member.name,
    nickname: member.nickname,
    phone: member.phone,
    wechatId: member.wechat_id,
    address: member.address,
    dietaryNotes: member.dietary_notes,
    isHospital: member.is_hospital,
  };
}

function fieldsToUpdate(v: MemberFormFieldValues): MemberUpdateInput {
  return {
    name: v.name.trim(),
    nickname: v.nickname.trim(),
    phone: v.phone.trim(),
    wechat_id: v.wechatId.trim(),
    address: v.address.trim(),
    dietary_notes: v.dietaryNotes.trim(),
    is_hospital: v.isHospital,
  };
}

export function MemberEditModal({ visible, member, onClose, onSaved }: MemberEditModalProps) {
  const [values, setValues] = useState<MemberFormFieldValues>(() => memberToFields(member));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setValues(memberToFields(member));
      setErrors({});
      setSubmitError(null);
      setSubmitting(false);
    }
  }, [visible, member]);

  const candidate = useMemo(() => fieldsToUpdate(values), [values]);
  const validation = useMemo(() => memberCreateSchema.safeParse(candidate), [candidate]);
  const isWalkin = !!member.is_walkin;

  const dirty =
    candidate.name !== member.name ||
    candidate.nickname !== member.nickname ||
    candidate.phone !== member.phone ||
    candidate.wechat_id !== member.wechat_id ||
    candidate.address !== member.address ||
    candidate.dietary_notes !== member.dietary_notes ||
    candidate.is_hospital !== member.is_hospital;

  const canSave = validation.success && dirty && !submitting;

  const onChange = <K extends keyof MemberFormFieldValues>(key: K, value: MemberFormFieldValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!validation.success) {
      const next: Record<string, string> = {};
      for (const issue of validation.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    if (isWalkin) {
      const next: Record<string, string> = {};
      if (!(candidate.wechat_id ?? '').trim()) next.wechat_id = '散客微信号必填';
      if (!(candidate.address ?? '').trim()) next.address = '散客地址必填';
      if (Object.keys(next).length > 0) {
        setErrors(next);
        return;
      }
    }
    setErrors({});
    setSubmitError(null);
    setSubmitting(true);
    try {
      await membersApi.update(member.id, candidate);
      onSaved();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <MeshBackground />
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={onClose} disabled={submitting}>
            <Text style={[styles.cancel, submitting && styles.disabled]}>取消</Text>
          </Pressable>
          <Text style={styles.title}>编辑资料</Text>
          <Pressable onPress={handleSave} disabled={!canSave}>
            {submitting ? (
              <ActivityIndicator color={IOS_COLORS.blue} />
            ) : (
              <Text style={[styles.save, !canSave && styles.disabled]}>保存</Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={memberFormStyles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <MemberFormFields values={values} errors={errors} onChange={onChange} />

          {submitError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{submitError}</Text>
            </View>
          ) : null}

          <Text style={styles.dirtyHint}>{dirty ? '有未保存的修改' : '未修改'}</Text>
          <View style={{ height: 24 }} />
        </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: IOS_COLORS.systemGrouped },
  safe: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'transparent',
  },
  cancel: { fontSize: 17, color: IOS_COLORS.labelSecondary, width: 60 },
  title: { fontSize: 17, fontWeight: '600', color: IOS_COLORS.label },
  save: { fontSize: 17, color: IOS_COLORS.blue, fontWeight: '600', width: 60, textAlign: 'right' },
  disabled: { opacity: 0.3 },

  errorBanner: {
    marginHorizontal: 6,
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FFF0F0',
    borderRadius: 10,
  },
  errorText: { fontSize: 14, color: IOS_COLORS.red },

  dirtyHint: {
    marginTop: 14,
    textAlign: 'center',
    fontSize: 12,
    color: IOS_COLORS.labelTertiary,
  },
});
