/**
 * 跨端日期选择组件。
 *
 * - Web：渲染原生 <input type="date">，既能键盘输入又能点开日历，浏览器自带格式校验。
 * - Native：退回到 TextInput（保持现有行为，iOS/Android 未来接原生 picker 时再改这里）。
 *
 * 对外始终只吐 'YYYY-MM-DD' 字符串，和后端 zDate 对齐。
 */

import { Platform, StyleSheet, TextInput, View, Text } from 'react-native';
import { COLORS, RADIUS, SPACING, TYPE } from '../../theme/paperTheme';

export interface DatePickerProps {
  value: string;
  onChange: (next: string) => void;
  label?: string;
  labelMinWidth?: number;
  placeholder?: string;
  disabled?: boolean;
  /** YYYY-MM-DD, HTML5 min */
  min?: string;
  /** YYYY-MM-DD, HTML5 max */
  max?: string;
  style?: object;
}

function isValidDate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export function DatePicker({
  value,
  onChange,
  label,
  labelMinWidth,
  placeholder = 'YYYY-MM-DD',
  disabled,
  min,
  max,
  style,
}: DatePickerProps) {
  const labelStyle = [styles.labelInline, labelMinWidth ? { minWidth: labelMinWidth } : null];
  if (Platform.OS === 'web') {
    // 在 Web 上 React 要求 createElement('input')；在 Native 的 TS 里 JSX.IntrinsicElements
    // 不认识 'input'，所以用 React.createElement 绕开类型系统的 JSX 限制。
    const InputEl = require('react').createElement;
    return (
      <View style={[styles.wrap, style]}>
        {label ? (
          <Text numberOfLines={1} ellipsizeMode="tail" style={labelStyle}>
            {label}
          </Text>
        ) : null}
        {InputEl('input', {
          type: 'date',
          value,
          disabled,
          min,
          max,
          onChange: (e: { target: { value: string } }) => {
            const next = e.target.value;
            if (next === '' || isValidDate(next)) onChange(next);
          },
          style: label ? { ...webInputStyle, ...webInputStyleInline } : webInputStyle,
        })}
      </View>
    );
  }

  // Native：先留着 TextInput，等接原生 picker 再换
  return (
    <View style={[styles.wrap, style]}>
      {label ? (
        <Text numberOfLines={1} ellipsizeMode="tail" style={labelStyle}>
          {label}
        </Text>
      ) : null}
      <TextInput
        value={value}
        onChangeText={onChange}
        style={[styles.nativeInput, label ? styles.nativeInputInline : null]}
        placeholder={placeholder}
        placeholderTextColor={COLORS.text.quaternary}
        editable={!disabled}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="numeric"
      />
    </View>
  );
}

const webInputStyle = {
  fontSize: 15,
  color: COLORS.text.primary,
  paddingTop: 6,
  paddingBottom: 6,
  paddingLeft: 0,
  paddingRight: 4,
  border: 'none',
  background: 'transparent',
  outline: 'none',
  fontVariant: 'tabular-nums',
  width: '100%',
  fontFamily: 'inherit',
} as const;

const webInputStyleInline = {
  textAlign: 'right',
} as const;

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(118,118,128,0.08)',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  labelInline: {
    ...TYPE.caption,
    color: COLORS.text.tertiary,
    letterSpacing: 0.4,
    marginRight: 8,
    minWidth: 14,
    flexShrink: 0,
  },
  nativeInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text.primary,
    paddingVertical: 4,
    fontVariant: ['tabular-nums'],
  },
  nativeInputInline: {
    textAlign: 'right',
  },
});
