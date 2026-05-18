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
  /** 与分段控件等同排时使用，缩小内边距并保证可收缩 */
  compact?: boolean;
  /** 日期紧跟在标签右侧（不撑满整行、不右对齐到行末） */
  inlineAdjacent?: boolean;
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
  compact = false,
  inlineAdjacent = false,
}: DatePickerProps) {
  const labelStyle = [
    styles.labelInline,
    compact && styles.labelInlineCompact,
    labelMinWidth ? { minWidth: labelMinWidth } : null,
  ];
  const wrapStyle = [
    styles.wrap,
    compact && styles.wrapCompact,
    inlineAdjacent && styles.wrapInlineAdjacent,
    style,
  ];
  const inputFlex = inlineAdjacent ? { flexGrow: 0, flexShrink: 0 } : ({ flex: 1, minWidth: 0 } as const);
  if (Platform.OS === 'web') {
    // 在 Web 上 React 要求 createElement('input')；在 Native 的 TS 里 JSX.IntrinsicElements
    // 不认识 'input'，所以用 React.createElement 绕开类型系统的 JSX 限制。
    const InputEl = require('react').createElement;
    return (
      <View style={wrapStyle}>
        {label ? (
          <Text numberOfLines={1} ellipsizeMode="tail" style={labelStyle}>
            {label}
          </Text>
        ) : null}
        <View style={inputFlex}>
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
            style: label
              ? {
                  ...webInputStyle,
                  ...(inlineAdjacent ? webInputStyleAdjacent : webInputStyleInline),
                  ...(inlineAdjacent ? webInputStyleAdjacentSize : webInputStyleFlex),
                  ...(compact ? webInputStyleCompact : {}),
                }
              : { ...webInputStyle, ...webInputStyleFlex },
          })}
        </View>
      </View>
    );
  }

  // Native：先留着 TextInput，等接原生 picker 再换
  return (
    <View style={wrapStyle}>
      {label ? (
        <Text numberOfLines={1} ellipsizeMode="tail" style={labelStyle}>
          {label}
        </Text>
      ) : null}
      <TextInput
        value={value}
        onChangeText={onChange}
        style={[
          styles.nativeInput,
          label && !inlineAdjacent ? styles.nativeInputInline : null,
          label && inlineAdjacent ? styles.nativeInputAdjacent : null,
          compact && styles.nativeInputCompact,
        ]}
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
  fontSize: 16,
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

const webInputStyleFlex = {
  width: '100%',
  minWidth: 0,
  maxWidth: '100%',
  boxSizing: 'border-box',
} as const;

const webInputStyleCompact = {
  fontSize: 15,
} as const;

const webInputStyleAdjacent = {
  textAlign: 'left',
} as const;

const webInputStyleAdjacentSize = {
  width: 'auto',
  minWidth: 128,
  maxWidth: 160,
  flex: 'none',
} as const;

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(118,118,128,0.08)',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 0,
  },
  wrapCompact: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  wrapInlineAdjacent: {
    alignSelf: 'stretch',
    justifyContent: 'flex-start',
    maxWidth: '100%',
  },
  labelInline: {
    ...TYPE.caption,
    color: COLORS.text.tertiary,
    letterSpacing: 0.4,
    marginRight: 6,
    minWidth: 14,
    flexShrink: 0,
  },
  labelInlineCompact: {
    marginRight: 4,
    letterSpacing: 0,
  },
  nativeInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    color: COLORS.text.primary,
    paddingVertical: 4,
    fontVariant: ['tabular-nums'],
  },
  nativeInputInline: {
    textAlign: 'right',
  },
  nativeInputCompact: {
    fontSize: 15,
    paddingVertical: 2,
  },
  nativeInputAdjacent: {
    flexGrow: 0,
    flexShrink: 0,
    width: 132,
    textAlign: 'left',
    paddingLeft: 2,
  },
});
