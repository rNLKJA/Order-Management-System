/**
 * 玻璃风格的二次确认弹层 —— 替代 window.confirm / Alert.alert。
 *
 * 用法：
 *   confirm({ title, message, confirmLabel?, tone?: 'default' | 'destructive' })
 *     => Promise<boolean>
 *
 * 渲染：全局挂 <ConfirmHost /> 一次（见 app/_layout.tsx）。
 * 组件内部用 useSyncExternalStore 监听一个模块级 store，调用 confirm() 会把
 * 配置推入 store，当前队列头会渲染一个 Modal；用户点击"取消/确定"后 Promise resolve。
 */

import { useSyncExternalStore } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassSurface } from './GlassSurface';
import { COLORS, MOTION, RADIUS, SPACING, TYPE } from '../../theme/paperTheme';

export type ConfirmTone = 'default' | 'destructive';

export interface ConfirmOptions {
  title: string;
  message?: string;
  /** 列表形式；提供时代替 message 展示 */
  lines?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  /** 只显示一个按钮（提示型消息），resolve(true) */
  singleAction?: boolean;
}

interface DialogState extends ConfirmOptions {
  id: number;
  resolve: (ok: boolean) => void;
}

let counter = 0;
let queue: DialogState[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}
function getSnapshot(): DialogState | null {
  return queue[0] ?? null;
}
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function confirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    queue.push({ id: ++counter, ...options, resolve });
    emit();
  });
}

function resolveTop(ok: boolean) {
  const top = queue[0];
  if (!top) return;
  queue = queue.slice(1);
  emit();
  top.resolve(ok);
}

export function ConfirmHost() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  if (!current) return null;

  const tone: ConfirmTone = current.tone ?? 'default';
  const primaryColor = tone === 'destructive' ? COLORS.danger : COLORS.brand;
  const icon: keyof typeof Ionicons.glyphMap =
    tone === 'destructive' ? 'alert-circle-outline' : 'information-circle-outline';

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => resolveTop(false)}
    >
      {/*
        Web：全屏底层 Pressable 与卡片区重叠时，即使用 zIndex，命中仍可能落到蒙层导致按钮「点了没反应」。
        做法：底层只负责点空白关闭；中间一层全屏 box-none 把非卡片区穿透给底层；卡片外包一层 auto 独占命中。
      */}
      <View
        style={[
          styles.backdrop,
          Platform.OS === 'web' && ({ isolation: 'isolate' } as ViewStyle),
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="关闭"
          style={styles.backdropDismiss}
          onPress={() => resolveTop(false)}
        />
        <View style={styles.cardAligner} pointerEvents="box-none">
          <View style={styles.cardHitBox} pointerEvents="auto">
            <GlassSurface level={1} padding={0} radius="xl" style={styles.card} elevated>
            <View style={styles.header}>
              <View
                style={[
                  styles.iconBubble,
                  {
                    backgroundColor:
                      tone === 'destructive'
                        ? 'rgba(255,59,48,0.12)'
                        : 'rgba(0,122,255,0.12)',
                  },
                ]}
              >
                <Ionicons name={icon} size={22} color={primaryColor} />
              </View>
              <Text style={styles.title}>{current.title}</Text>
              {current.message ? (
                <Text style={styles.message}>{current.message}</Text>
              ) : null}
              {current.lines && current.lines.length > 0 ? (
                <View style={styles.lines}>
                  {current.lines.map((line, idx) => (
                    <Text key={idx} style={styles.lineText}>
                      {line}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>

            <View style={styles.actions}>
              {!current.singleAction && (
                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.btn,
                    styles.btnCancel,
                    pressed && { opacity: MOTION.pressOpacity },
                    Platform.OS === 'web' && styles.btnWeb,
                  ]}
                  onPress={() => resolveTop(false)}
                >
                  <View pointerEvents="none">
                    <Text style={styles.btnCancelText}>{current.cancelLabel ?? '取消'}</Text>
                  </View>
                </Pressable>
              )}
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.btn,
                  styles.btnConfirm,
                  { backgroundColor: primaryColor },
                  pressed && { opacity: MOTION.pressOpacity, transform: [{ scale: 0.99 }] },
                  Platform.OS === 'web' && styles.btnWeb,
                ]}
                onPress={() => resolveTop(true)}
              >
                <View pointerEvents="none">
                  <Text style={styles.btnConfirmText}>
                    {current.confirmLabel ?? (current.singleAction ? '好的' : '确定')}
                  </Text>
                </View>
              </Pressable>
            </View>
            </GlassSurface>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
    position: 'relative',
  },
  /** 全屏点击关闭（仅命中未被 cardAligner 内 auto 区域拦截的像素） */
  backdropDismiss: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    backgroundColor: 'transparent',
  },
  /** 全屏居中容器：box-none 使空白处事件落到 backdropDismiss */
  cardAligner: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  /** 卡片命中盒：auto 保证按钮区域不会被底层蒙层抢走（RN Web） */
  cardHitBox: {
    width: '100%',
    maxWidth: 420,
    elevation: 6,
  },
  btnWeb: {
    // RN Web：显式 cursor，避免被全局样式压成不可点外观；同时利于命中框
    cursor: 'pointer' as const,
  },
  card: { overflow: 'hidden' },
  header: {
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    ...TYPE.title3,
    color: COLORS.text.primary,
    textAlign: 'center',
    marginBottom: 6,
  },
  message: {
    ...TYPE.body,
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
  lines: {
    width: '100%',
    marginTop: 10,
    backgroundColor: 'rgba(118,118,128,0.08)',
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
  },
  lineText: {
    ...TYPE.footnote,
    color: COLORS.text.secondary,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    paddingTop: 4,
  },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancel: { backgroundColor: 'rgba(118,118,128,0.12)' },
  btnCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.primary,
    lineHeight: 16,
  },
  btnConfirm: {},
  btnConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    lineHeight: 16,
  },
});
