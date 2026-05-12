/**
 * 会员表单（创建 / 编辑复用）。
 *
 * 字段：姓名 / 昵称 / 手机 / 微信号 / 地址 / 忌口 / 医院订阅。
 * 所有校验走 packages/shared 的 memberCreateSchema，保证前后端一致。
 */

import { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import {
  TextInput,
  Switch,
  Text,
  HelperText,
  useTheme,
} from 'react-native-paper';
import { memberCreateSchema, type MemberCreateInput } from '@meal/shared';
import { GlassSurface, SectionLabel, Button } from './ui';

export interface MemberFormValues extends MemberCreateInput {}

interface Props {
  initial?: Partial<MemberFormValues>;
  submitLabel: string;
  submitting?: boolean;
  onSubmit: (values: MemberFormValues) => void | Promise<void>;
  onCancel?: () => void;
}

export function MemberForm({
  initial,
  submitLabel,
  submitting,
  onSubmit,
  onCancel,
}: Props) {
  const theme = useTheme();
  const [name, setName] = useState(initial?.name ?? '');
  const [nickname, setNickname] = useState(initial?.nickname ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [wechatId, setWechatId] = useState(initial?.wechat_id ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [dietaryNotes, setDietaryNotes] = useState(initial?.dietary_notes ?? '');
  const [isHospital, setIsHospital] = useState(initial?.is_hospital ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const parsed = useMemo(() => {
    return memberCreateSchema.safeParse({
      name,
      nickname,
      phone,
      wechat_id: wechatId,
      address,
      dietary_notes: dietaryNotes,
      is_hospital: isHospital,
    });
  }, [name, nickname, phone, wechatId, address, dietaryNotes, isHospital]);

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

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.block}>
        <SectionLabel>基础信息</SectionLabel>
        <GlassSurface padding={12} style={styles.card}>
          <TextInput
            label="姓名 *"
            value={name}
            onChangeText={setName}
            mode="outlined"
            style={styles.field}
            error={!!errors.name}
          />
          <HelperText type="error" visible={!!errors.name}>
            {errors.name ?? ''}
          </HelperText>

          <TextInput
            label="昵称"
            value={nickname}
            onChangeText={setNickname}
            mode="outlined"
            style={styles.field}
          />

          <TextInput
            label="手机号 *"
            value={phone}
            onChangeText={setPhone}
            mode="outlined"
            keyboardType="phone-pad"
            autoCorrect={false}
            style={styles.field}
            error={!!errors.phone}
          />
          <HelperText type="error" visible={!!errors.phone}>
            {errors.phone ?? ''}
          </HelperText>

          <TextInput
            label="微信号"
            value={wechatId}
            onChangeText={setWechatId}
            mode="outlined"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.field}
            error={!!errors.wechat_id}
          />
          <HelperText type="error" visible={!!errors.wechat_id}>
            {errors.wechat_id ?? ''}
          </HelperText>
        </GlassSurface>
      </View>

      <View style={styles.block}>
        <SectionLabel>送餐与备注</SectionLabel>
        <GlassSurface padding={12} style={styles.card}>
          <TextInput
            label="送餐地址"
            value={address}
            onChangeText={setAddress}
            mode="outlined"
            multiline
            style={styles.field}
            placeholder="科室、病区、楼号或可送餐的详细位置"
          />
          <HelperText type="info" visible>
            员工股东等院内点餐也请写明送餐点，配送员与出餐页均按此显示。
          </HelperText>

          <TextInput
            label="忌口（会自动带到每次订单备注）"
            value={dietaryNotes}
            onChangeText={setDietaryNotes}
            mode="outlined"
            multiline
            style={styles.field}
          />
        </GlassSurface>
      </View>

      <View style={styles.block}>
        <SectionLabel>订阅设置</SectionLabel>
        <GlassSurface padding={12} style={styles.card}>
          <View style={styles.row}>
            <Text variant="bodyLarge">医院订阅</Text>
            <Switch value={isHospital} onValueChange={setIsHospital} />
          </View>
          <HelperText type="info" visible>
            勾选后，该会员会按院内价格订阅，默认送餐人会自动带出。
          </HelperText>
        </GlassSurface>
      </View>

      <View style={styles.actions}>
        {onCancel ? <Button label="取消" variant="secondary" onPress={onCancel} disabled={submitting} style={styles.button} /> : null}
        <Button label={submitLabel} onPress={handleSubmit} loading={submitting} disabled={submitting} style={styles.button} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 48,
  },
  block: {
    marginBottom: 16,
  },
  card: {
    gap: 2,
  },
  field: {
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    justifyContent: 'flex-end',
  },
  button: {
    borderRadius: 10,
    minWidth: 132,
  },
});
