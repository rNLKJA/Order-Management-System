/**
 * 当 API 返回 401 或令牌过期时，通知所有 useAuth 订阅方立即回到未登录态。
 */

type Listener = () => void;

const listeners = new Set<Listener>();

export function subscribeAuthSessionReset(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitAuthSessionReset(): void {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
}
