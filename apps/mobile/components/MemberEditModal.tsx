/**
 * 会员资料编辑 Modal —— iOS 分组样式，和 members/[id].tsx 风格保持一致。
 *
 * 字段：姓名、昵称、手机号、微信号、地址、忌口、院内/院外。
 * 校验：复用 packages/shared 的 memberCreateSchema，保证前后端契约一致。
 * 提交：直接调 PATCH /api/members/:id；上层 onSaved 回调负责刷新列表 / 详情。
 */

import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { memberCreateSchema } from '@meal/shared';
import { IOS_COLORS } from '../theme/paperTheme';
import { type MockMember, type MemberUpdateInput } from '../constants/mockData';
import { membersApi } from '../api/members';

export interface MemberEditModalProps {
  visible: boolean;
  member: MockMember;
  onClose: () => void;
  onSaved: () => void;
}

export function MemberEditModal({ visible, member, onClose, onSaved }: MemberEditModalProps) {
  const [name, setName] = useState(member.name);
  const [nickname, setNickname] = useState(member.nickname);
  const [phone, setPhone] = useState(member.phone);
  const [wechatId, setWechatId] = useState(member.wechat_id);
  const [address, setAddress] = useState(member.address);
  const [dietaryNotes, setDietaryNotes] = useState(member.dietary_notes);
  const [isHospital, setIsHospital] = useState(member.is_hospital);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(member.name);
      setNickname(member.nickname);
      setPhone(member.phone);
      setWechatId(member.wechat_id);
      setAddress(member.address);
      setDietaryNotes(member.dietary_notes);
      setIsHospital(member.is_hospital);
      setErrors({});
      setSubmitError(null);
      setSubmitting(false);
    }
  }, [visible, member]);

  const candidate: MemberUpdateInput = useMemo(
    () => ({
      name: name.trim(),
      nickname: nickname.trim(),
      phone: phone.trim(),
      wechat_id: wechatId.trim(),
      address: address.trim(),
      dietary_notes: dietaryNotes.trim(),
      is_hospital: isHospital,
    }),
    [name, nickname, phone, wechatId, address, dietaryNotes, isHospital],
  );

  const validation = useMemo(() => memberCreateSchema.safeParse(candidate), [candidate]);

  const dirty =
    candidate.name !== member.name ||
    candidate.nickname !== member.nickname ||
    candidate.phone !== member.phone ||
    candidate.wechat_id !== member.wechat_id ||
    candidate.address !== member.address ||
    candidate.dietary_notes !== member.dietary_notes ||
    candidate.is_hospital !== member.is_hospital;

  const canSave = validation.success && dirty && !submitting;

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
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={onClose} disabled={submitting}>
            <Text style={[styles.cancel, submitting && styles.disabled]}>取消</Text>
          </Pressable>
          <Text style={styles.title}>编辑会员</Text>
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
          contentContainerStyle={styles.scrollBody}
          keyboardShouldPersistTaps="handled"
        >
          <SectionLabel text="基本信息" />
          <View style={styles.card}>
            <Field
              label="姓名"
              value={name}
              onChangeText={setName}
              placeholder="真实姓名"
              error={errors.name}
            />
            <Field
              label="昵称"
              value={nickname}
              onChangeText={setNickname}
              placeholder="微信昵称 / 常用称呼"
              error={errors.nickname}
              isLast
            />
          </View>

          <SectionLabel text="联系方式" />
          <View style={styles.card}>
            <Field
              label="手机号"
              value={phone}
              onChangeText={setPhone}
              placeholder="11 位手机号"
              keyboardType="phone-pad"
              error={errors.phone}
            />
            <Field
              label="微信号"
              value={wechatId}
              onChangeText={setWechatId}
              placeholder="6-20 位字母/数字/下划线"
              autoCapitalize="none"
              error={errors.wechat_id}
            />
            <Field
              label="地址"
              value={address}
              onChangeText={setAddress}
              placeholder="送餐地址 / 科室"
              error={errors.address}
              isLast
              multiline
            />
          </View>

          <SectionLabel text="业务属性" />
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>院内订阅</Text>
                <Text style={styles.rowHint}>
                  勾选后计入院内价目表；切换后下一次开卡默认走院内价目。
                </Text>
              </View>
              <Switch
                value={isHospital}
                onValueChange={setIsHospital}
                trackColor={{ false: IOS_COLORS.fillMedium, true: IOS_COLORS.blue }}
              />
            </View>
          </View>

          <SectionLabel text="忌口（会带到每次订单备注）" />
          <View style={styles.card}>
            <TextInput
              style={styles.notesInput}
              value={dietaryNotes}
              onChangeText={setDietaryNotes}
              placeholder="如：不吃辣 / 过敏海鲜 / 一份素食"
              placeholderTextColor={IOS_COLORS.labelTertiary}
              multiline
              maxLength={512}
            />
          </View>

          {submitError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{submitError}</Text>
            </View>
          ) : null}

          {dirty ? (
            <Text style={styles.dirtyHint}>有未保存的修改</Text>
          ) : (
            <Text style={styles.dirtyHint}>未修改</Text>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function SectionLabel({ text }: { text: string }) {
  return (
    <View style={styles.sectionLabelWrap}>
      <Text style={styles.sectionLabel}>{text}</Text>
    </View>
  );
}

function Field({
  label, value, onChangeText, placeholder, error,
  isLast, keyboardType, autoCapitalize, multiline,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  error?: string;
  isLast?: boolean;
  keyboardType?: 'default' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences';
  multiline?: boolean;
}) {
  return (
    <View style={[styles.field, isLast && styles.fieldLast]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && styles.fieldInputMulti]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={IOS_COLORS.labelTertiary}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        multiline={multiline}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: IOS_COLORS.systemGrouped },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: IOS_COLORS.card,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: IOS_COLORS.separatorLight,
  },
  cancel: { fontSize: 17, color: IOS_COLORS.labelSecondary, width: 60 },
  title: { fontSize: 17, fontWeight: '600', color: IOS_COLORS.label },
  save: { fontSize: 17, color: IOS_COLORS.blue, fontWeight: '600', width: 60, textAlign: 'right' },
  disabled: { opacity: 0.3 },

  scrollBody: { paddingBottom: 24 },

  sectionLabelWrap: {
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 6,
  },
  sectionLabel: {
    fontSize: 13, fontWeight: '600', color: IOS_COLORS.labelSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  card: {
    marginHorizontal: 16, backgroundColor: IOS_COLORS.card, borderRadius: 14, overflow: 'hidden',
  },

  field: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: IOS_COLORS.separatorLight,
  },
  fieldLast: { borderBottomWidth: 0 },
  fieldLabel: { fontSize: 12, color: IOS_COLORS.labelSecondary, marginBottom: 2 },
  fieldInput: { fontSize: 16, color: IOS_COLORS.label, paddingVertical: 4 },
  fieldInputMulti: { minHeight: 56, textAlignVertical: 'top' },
  fieldError: { fontSize: 12, color: IOS_COLORS.red, marginTop: 4 },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  rowLabel: { fontSize: 16, color: IOS_COLORS.label },
  rowHint: { fontSize: 12, color: IOS_COLORS.labelSecondary, marginTop: 2 },

  notesInput: {
    fontSize: 15, color: IOS_COLORS.label,
    padding: 14, minHeight: 72, textAlignVertical: 'top',
  },

  errorBanner: {
    marginHorizontal: 16, marginTop: 12, padding: 12,
    backgroundColor: '#FFF0F0', borderRadius: 10,
  },
  errorText: { fontSize: 14, color: IOS_COLORS.red },

  dirtyHint: {
    marginTop: 18, textAlign: 'center',
    fontSize: 12, color: IOS_COLORS.labelTertiary,
  },
});
