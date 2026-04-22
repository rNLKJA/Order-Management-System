/**
 * 认证路由。
 *
 * - POST /api/auth/login       body: { username, password }
 * - GET  /api/auth/me          需要登录，返回当前用户
 *
 * 安全：
 * - 登录 60 秒 10 次限流（IP + username 组合 key）
 * - 返回 token 不带 PII（不含 full_name），前端要自己再 GET /me
 * - 密码验证走 argon2id
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { loginSchema, type LoginResponse } from '@meal/shared';
import { getDb, schema } from '../db/client.js';
import { verifyPassword } from '../services/password.js';
import { signToken } from '../services/jwt.js';
import { requireAuth, type AuthVariables } from '../middleware/jwt.js';
import { rateLimit } from '../middleware/rate-limit.js';

export const authRouter = new Hono<{ Variables: AuthVariables }>();

// 限流：60 秒 10 次（全局 IP 维度；登录本身也再按 username 扩一道可放到 phase 4）
authRouter.use(
  '/login',
  rateLimit({
    windowMs: 60_000,
    max: 10,
    message: '登录尝试过多，请 1 分钟后重试',
  }),
);

authRouter.post('/login', zValidator('json', loginSchema), async (c) => {
  const { username, password } = c.req.valid('json');

  const db = getDb();
  const rows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.username, username))
    .limit(1);

  const user = rows[0];
  if (!user) {
    throw new HTTPException(401, { message: '用户名或密码错误' });
  }
  if (!user.is_active) {
    throw new HTTPException(401, { message: '账号已停用，请联系管理员' });
  }

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    throw new HTTPException(401, { message: '用户名或密码错误' });
  }

  const token = await signToken({
    user_id: user.id,
    role: user.role,
    token_version: user.token_version,
  });

  const res: LoginResponse = {
    token,
    user: {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
    },
  };
  return c.json(res);
});

authRouter.get('/me', requireAuth(), (c) => {
  const user = c.get('authUser');
  return c.json({ user });
});
