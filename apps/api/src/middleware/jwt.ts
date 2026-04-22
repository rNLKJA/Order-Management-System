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
import { getDb, schema } from '../db/client.js';
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

export function requireAuth(): MiddlewareHandler<{ Variables: AuthVariables }> {
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

    const db = getDb();
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
