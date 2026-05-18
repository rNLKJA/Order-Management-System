/**
 * 会员档案表单字段（创建 / 编辑共用）— iOS 分组列表样式，与 MemberEditModal 一致。
 */

import { Switch, Text, TextInput, View } from 'react-native';
import { IOS_COLORS } from '../../theme/paperTheme';
import { memberFormStyles as styles } from './memberFormStyles';

export interface MemberFormFieldValues {
  name: string;
  nickname: string;
  phone: string;
  wechatId: string;
  address: string;
  dietaryNotes: string;
  isHospital: boolean;
}

export function MemberFormFields({
  values,
  errors,
  onChange,
}: {
  values: MemberFormFieldValues;
  errors: Record<string, string>;
  onChange: <K extends keyof MemberFormFieldValues>(key: K, value: MemberFormFieldValues[K]) => void;
}) {
  return (
    <>
      <SectionLabel text="基本信息" />
      <View style={styles.card}>
        <Field
          label="姓名"
          required
          value={values.name}
          onChangeText={(v) => onChange('name', v)}
          placeholder="真实姓名"
          error={errors.name}
        />
        <Field
          label="昵称"
          value={values.nickname}
          onChangeText={(v) => onChange('nickname', v)}
          placeholder="微信昵称 / 常用称呼"
          error={errors.nickname}
          isLast
        />
      </View>

      <SectionLabel text="联系方式与送餐" />
      <View style={styles.card}>
        <Field
          label="手机号"
          required
          value={values.phone}
          onChangeText={(v) => onChange('phone', v)}
          placeholder="11 位手机号"
          keyboardType="phone-pad"
          error={errors.phone}
        />
        <Field
          label="微信号"
          value={values.wechatId}
          onChangeText={(v) => onChange('wechatId', v)}
          placeholder="6–20 位字母、数字或下划线"
          autoCapitalize="none"
          error={errors.wechat_id}
        />
        <Field
          label="送餐地址"
          value={values.address}
          onChangeText={(v) => onChange('address', v)}
          placeholder="科室、病区、楼号或可送餐的详细位置"
          error={errors.address}
          multiline
          hint="配送员按此地址送餐；院内点餐也请写明送餐点。"
          isLast
        />
      </View>

      <SectionLabel text="业务属性" />
      <View style={styles.card}>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.rowLabel}>院内订阅</Text>
            <Text style={styles.rowHint}>计入院内价目；开卡默认走院内价格。</Text>
          </View>
          <Switch
            value={values.isHospital}
            onValueChange={(v) => onChange('isHospital', v)}
            trackColor={{ false: IOS_COLORS.fillMedium, true: IOS_COLORS.blue }}
          />
        </View>
      </View>

      <SectionLabel text="忌口" />
      <View style={styles.card}>
        <TextInput
          style={styles.notesInput}
          value={values.dietaryNotes}
          onChangeText={(v) => onChange('dietaryNotes', v)}
          placeholder="如：不吃辣 / 过敏海鲜（会带到每次订单备注）"
          placeholderTextColor={IOS_COLORS.labelTertiary}
          multiline
          maxLength={512}
        />
      </View>
    </>
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
  label,
  value,
  onChangeText,
  placeholder,
  error,
  isLast,
  keyboardType,
  autoCapitalize,
  multiline,
  required,
  hint,
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
  required?: boolean;
  hint?: string;
}) {
  return (
    <View style={[styles.field, isLast && styles.fieldLast]}>
      <Text style={styles.fieldLabel}>
        {label}
        {required ? <Text style={styles.fieldRequired}> *</Text> : null}
      </Text>
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
      {hint && !error ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}
