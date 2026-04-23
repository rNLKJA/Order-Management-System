/**
 * 玻璃风格二次确认的兼容层。
 *
 * 历史实现用 window.confirm / Alert.alert。为和整体设计一致，现在统一走
 * components/ui/ConfirmDialog.tsx 里的玻璃 Modal。保留原来的回调式 API 不破坏调用方。
 *
 * - confirmAction：建设性操作（购卡 / 升级 / 确认送达）
 * - confirmDestructive：危险操作（取消 / 删除 / 冲销），按钮用红色
 */

import { confirmDialog, type ConfirmOptions } from '../components/ui';

function pickLines(message: string): { message?: string; lines?: string[] } {
  // 调用方习惯用 \n 分行表示多条信息。转成 lines 数组以便 Dialog 展示成信息块。
  if (!message) return {};
  const parts = message.split('\n').map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 1) return { message };
  return { lines: parts };
}

export function confirmAction(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmLabel = '确定',
) {
  const opts: ConfirmOptions = {
    title,
    confirmLabel,
    tone: 'default',
    ...pickLines(message),
  };
  void confirmDialog(opts).then((ok) => {
    if (ok) onConfirm();
  });
}

export function confirmDestructive(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmLabel = '确定',
) {
  const opts: ConfirmOptions = {
    title,
    confirmLabel,
    tone: 'destructive',
    ...pickLines(message),
  };
  void confirmDialog(opts).then((ok) => {
    if (ok) onConfirm();
  });
}

/**
 * 只显示一个按钮的提示弹层（用于"操作失败"、"无法操作"这类 info 消息）。
 */
export function notify(
  title: string,
  message?: string,
  tone: 'default' | 'destructive' = 'default',
): Promise<void> {
  return confirmDialog({
    title,
    tone,
    singleAction: true,
    ...(message ? pickLines(message) : {}),
  }).then(() => void 0);
}
