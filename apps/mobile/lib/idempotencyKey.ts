/**
 * 生成 POST /api/orders 的 Idempotency-Key（弱网 / 双击提交时由后端去重）。
 * 优先使用运行时 UUID；无则降级为时间与随机片段（仍足以区分两次点击）。
 */
export function createIdempotencyKey(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  return `idem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}
