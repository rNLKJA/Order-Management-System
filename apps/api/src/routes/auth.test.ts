import { describe, expect, it, beforeEach } from 'vitest';
import type { drizzle } from 'drizzle-orm/libsql';
import { createApp } from '../app.js';
import { setupTestDb, seedUser, login } from '../test-helpers.js';
import * as schema from '../db/schema.js';

type TestDb = ReturnType<typeof drizzle<typeof schema>>;

describe('POST /api/auth/login + GET /api/auth/me', () => {
  let db: TestDb;
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    const res = await setupTestDb();
    db = res.db;
    app = createApp({ db });
  });

  it('健康检查能访问，无需登录', async () => {
    const res = await app.fetch(new Request('http://test.local/api/health'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('ok');
  });

  it('正确密码登录成功，返回 token + user', async () => {
    await seedUser(db, {
      username: 'admin1',
      full_name: '测试管理员',
      role: 'admin',
      password: 'CorrectPassword1!',
    });
    const res = await login(app, 'admin1', 'CorrectPassword1!');
    expect(res.token).toBeTruthy();
    expect(res.user.username).toBe('admin1');
    expect(res.user.role).toBe('admin');
    expect(res.user.full_name).toBe('测试管理员');
  });

  it('错误密码 401 UNAUTHORIZED', async () => {
    await seedUser(db, { username: 'staff1', password: 'Real!Pw123' });
    const res = await app.fetch(
      new Request('http://test.local/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'staff1', password: 'wrong' }),
      }),
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string; message: string };
    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('不存在的用户名也返回 401', async () => {
    const res = await app.fetch(
      new Request('http://test.local/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'ghost', password: 'whatever' }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it('停用账号登录 401 且消息明确', async () => {
    await seedUser(db, {
      username: 'disabled',
      password: 'Abc12345!',
      is_active: false,
    });
    const res = await app.fetch(
      new Request('http://test.local/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'disabled', password: 'Abc12345!' }),
      }),
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { message: string };
    expect(body.message).toContain('停用');
  });

  it('GET /api/auth/me 需要 Bearer token', async () => {
    const res = await app.fetch(new Request('http://test.local/api/auth/me'));
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me 用有效 token 返回当前用户', async () => {
    await seedUser(db, {
      username: 'me_test',
      full_name: '我是谁',
      password: 'SomePw@9',
    });
    const { token, user } = await login(app, 'me_test', 'SomePw@9');

    const res = await app.fetch(
      new Request('http://test.local/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: typeof user };
    expect(body.user.username).toBe('me_test');
    expect(body.user.full_name).toBe('我是谁');
  });

  it('非法 token 返回 401', async () => {
    const res = await app.fetch(
      new Request('http://test.local/api/auth/me', {
        headers: { Authorization: 'Bearer not.a.jwt' },
      }),
    );
    expect(res.status).toBe(401);
  });
});
