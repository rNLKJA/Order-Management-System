/**
 * JWT 认证中间件。
 *
 * 校验 Bearer token，并核对 users.is_active 和 users.token_version，
 * 两者任一不匹配 = 401（账号停用或密码被重置）。
 *
 * 校验通过后往 c.var 放 authUser 和 authPayload，下游可以 c.get('authUser') 拿到。
 */

import type { Context, MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { eq } from 'drizzle-orm';
import { verifyToken } from '../services/jwt.js';
import { schema } from '../db/client.js';
import { requestDb } from '../db/request-db.js';
import type { AuthTokenPayload, UserRole } from '@meal/shared';

export interface AuthUserCtx {
  id: number;
  username: string;
  full_name: string;
  role: UserRole;
}

export type AuthVariables = {
  authPayload: AuthTokenPayload;
  authUser: AuthUserCtx;
};

function extractToken(c: Context): string | null {
  const h = c.req.header('Authorization') ?? '';
  if (h.startsWith('Bearer ')) return h.slice(7).trim();
  // 兼容 HttpOnly Cookie（Web 端）
  const cookie = c.req.header('Cookie') ?? '';
  const match = /(?:^|;\s*)token=([^;]+)/.exec(cookie);
  if (match) return decodeURIComponent(match[1] ?? '');
  return null;
}

export function requireAuth(): MiddlewareHandler<{
  Variables: AuthVariables;
}> {
  return async (c, next) => {
    const token = extractToken(c);
    if (!token) {
      throw new HTTPException(401, { message: '未登录' });
    }

    let payload: AuthTokenPayload;
    try {
      payload = await verifyToken(token);
    } catch {
      throw new HTTPException(401, { message: '登录已过期，请重新登录' });
    }

    const db = requestDb(c);
    const rows = await db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        full_name: schema.users.full_name,
        role: schema.users.role,
        is_active: schema.users.is_active,
        token_version: schema.users.token_version,
      })
      .from(schema.users)
      .where(eq(schema.users.id, payload.sub))
      .limit(1);

    const u = rows[0];
    if (!u) {
      throw new HTTPException(401, { message: '账号不存在' });
    }
    if (!u.is_active) {
      throw new HTTPException(401, { message: '账号已停用' });
    }
    if (u.token_version !== payload.ver) {
      throw new HTTPException(401, { message: '登录已失效，请重新登录' });
    }

    c.set('authPayload', payload);
    c.set('authUser', {
      id: u.id,
      username: u.username,
      full_name: u.full_name,
      role: u.role,
    });

    await next();
  };
}

export function requireRole(
  role: UserRole,
): MiddlewareHandler<{ Variables: AuthVariables }> {
  return async (c, next) => {
    const user = c.get('authUser');
    if (!user || user.role !== role) {
      throw new HTTPException(403, {
        message: `需要 ${role === 'admin' ? '管理员' : '员工'} 权限`,
      });
    }
    await next();
  };
}

/**
 * 数据写操作守卫（新增 / 删除 / 改状态 等）。
 *
 * 真实业务线上只有 `高平 (gaoping)` 能做数据录入和删除；其他人只读。
 * 目前还在测试阶段，默认 `DATA_OPERATOR_ENFORCEMENT=0`，所有 admin/staff 都能写；
 * 等切正式生产时把 Vercel 上那条环境变量改成 `1` 就生效。
 *
 * 白名单可以通过 `DATA_OPERATOR_USERNAMES` 覆盖（逗号分隔），便于加备份录入员。
 * admin 始终放行，避免运维自己把自己锁出来。
 */
export function DEFAULT_DATA_OPERATORS(): string[] {
  const raw = (globalThis.process?.env?.DATA_OPERATOR_USERNAMES ?? '').trim();
  if (raw) return raw.split(',').map((s) => s.trim()).filter(Boolean);
  return ['gaoping'];
}

export function isDataOperatorEnforced(): boolean {
  return (globalThis.process?.env?.DATA_OPERATOR_ENFORCEMENT ?? '0') === '1';
}

export function requireDataOperator(): MiddlewareHandler<{ Variables: AuthVariables }> {
  return async (c, next) => {
    // 只拦截写请求；GET/OPTIONS/HEAD 放行
    const method = c.req.method;
    if (method === 'GET' || method === 'OPTIONS' || method === 'HEAD') {
      return next();
    }
    if (!isDataOperatorEnforced()) {
      return next();
    }
    const user = c.get('authUser');
    if (!user) {
      throw new HTTPException(401, { message: '未登录' });
    }
    if (user.role === 'admin') {
      return next();
    }
    const db = requestDb(c);
    const setting = await db
      .select({ value: schema.settings.value })
      .from(schema.settings)
      .where(eq(schema.settings.key, 'data_operator_usernames'))
      .limit(1);
    const dynamicAllowed = (setting[0]?.value ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const allowed = dynamicAllowed.length > 0 ? dynamicAllowed : DEFAULT_DATA_OPERATORS();
    if (!allowed.includes(user.username.toLowerCase())) {
      throw new HTTPException(403, {
        message: `目前仅 ${allowed.join(' / ')} 可以做数据录入 / 删除，请联系管理员`,
      });
    }
    await next();
  };
}
