/**
 * Modal / Form Sheet 顶栏 — 取消 | 标题 | 确认（或自定义右侧）
 */

import { ActivityIndicator, Pressable, View, type ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { COLORS } from '../../theme/paperTheme';
import { headerStyles as styles } from './headerStyles';

export interface SheetHeaderProps {
  title: string;
  onClose: () => void;
  closeLabel?: string;
  onConfirm?: () => void;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  confirming?: boolean;
  /** 危险操作（如退卡）用红色确认文字 */
  confirmDestructive?: boolean;
  right?: React.ReactNode;
  style?: ViewStyle;
}

export function SheetHeader({
  title,
  onClose,
  closeLabel = '取消',
  onConfirm,
  confirmLabel = '确认',
  confirmDisabled,
  confirming,
  confirmDestructive,
  right,
  style,
}: SheetHeaderProps) {
  const confirmColor = confirmDestructive ? COLORS.danger : COLORS.brand;
  const rightNode =
    right ??
    (onConfirm ? (
      <Pressable
        onPress={onConfirm}
        disabled={confirmDisabled || confirming}
        hitSlop={8}
        style={styles.sheetSideBtn}
      >
        {confirming ? (
          <ActivityIndicator size="small" color={confirmColor} />
        ) : (
          <Text
            style={[
              styles.sheetConfirm,
              { color: confirmColor },
              confirmDisabled && styles.textActionDisabled,
            ]}
          >
            {confirmLabel}
          </Text>
        )}
      </Pressable>
    ) : (
      <View style={styles.sheetSideBtn} />
    ));

  return (
    <View style={[styles.bar, style]}>
      <View style={styles.row}>
        <View style={styles.side}>
          <Pressable
            onPress={onClose}
            disabled={confirming}
            hitSlop={10}
            style={({ pressed }) => [styles.sheetSideBtn, pressed && styles.pressed]}
          >
            <Text style={[styles.sheetCancel, confirming && styles.textActionDisabled]}>
              {closeLabel}
            </Text>
          </Pressable>
        </View>
        <View style={[styles.side, styles.sideRight]}>{rightNode}</View>
      </View>
      <View style={styles.titleWrap} pointerEvents="none">
        <Text style={[styles.title, styles.titleSheet]} numberOfLines={1}>
          {title}
        </Text>
      </View>
    </View>
  );
}
