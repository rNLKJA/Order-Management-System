/**
 * 用户路由测试 — 头像上传 / 清除。
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createApp } from '../app.js';
import { setupTestDb, seedUser, login, schema } from '../test-helpers.js';
import { signToken } from '../services/jwt.js';

describe('Users API', () => {
  let app: ReturnType<typeof createApp>;
  let staffToken: string;

  beforeEach(async () => {
    const { db } = await setupTestDb();
    app = createApp({ db });
    const staff = await seedUser(db, {
      username: 'staff_avatar',
      full_name: '头像测试员',
      role: 'staff',
      password: 'Pw123456',
    });
    staffToken = await signToken({
      user_id: staff.id,
      role: 'staff',
      token_version: 1,
    });
  });

  const png1x1Base64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  const validDataUrl = `data:image/png;base64,${png1x1Base64}`;

  it('PATCH /me/avatar 成功上传 → GET /auth/me 能拿到', async () => {
    const res = await app.fetch(
      new Request('http://test.local/api/users/me/avatar', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({ avatar: validDataUrl }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      user: { avatar_url: string | null };
    };
    expect(body.user.avatar_url).toBe(validDataUrl);

    // /auth/me 应该也返回这个 url
    const meRes = await app.fetch(
      new Request('http://test.local/api/auth/me', {
        headers: { Authorization: `Bearer ${staffToken}` },
      }),
    );
    expect(meRes.status).toBe(200);
    const meBody = (await meRes.json()) as {
      user: { avatar_url: string | null };
    };
    expect(meBody.user.avatar_url).toBe(validDataUrl);
  });

  it('DELETE /me/avatar 清空头像', async () => {
    // 先上传
    await app.fetch(
      new Request('http://test.local/api/users/me/avatar', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({ avatar: validDataUrl }),
      }),
    );
    // 再删
    const res = await app.fetch(
      new Request('http://test.local/api/users/me/avatar', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${staffToken}` },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      user: { avatar_url: string | null };
    };
    expect(body.user.avatar_url).toBeNull();
  });

  it('PATCH /me/avatar 非 data URL → 422', async () => {
    const res = await app.fetch(
      new Request('http://test.local/api/users/me/avatar', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({ avatar: 'https://example.com/avatar.jpg' }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('GET /api/users 返回 avatar_url 字段', async () => {
    await app.fetch(
      new Request('http://test.local/api/users/me/avatar', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({ avatar: validDataUrl }),
      }),
    );

    const res = await app.fetch(
      new Request('http://test.local/api/users', {
        headers: { Authorization: `Bearer ${staffToken}` },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      users: Array<{ username: string; avatar_url: string | null }>;
    };
    const staff = body.users.find((u) => u.username === 'staff_avatar');
    expect(staff?.avatar_url).toBe(validDataUrl);
  });

  it('POST /api/users/staff 写入 audit_logs（entity=user）', async () => {
    const { db } = await setupTestDb();
    const localApp = createApp({ db });
    await seedUser(db, {
      username: 'adm_audit',
      full_name: '审计管理员',
      role: 'admin',
      password: 'Pw123456',
    });
    const token = (await login(localApp, 'adm_audit', 'Pw123456')).token;
    const res = await localApp.fetch(
      new Request('http://test.local/api/users/staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: 'staff_audit_x',
          full_name: '审计员工',
          password: 'Pw12345678',
        }),
      }),
    );
    expect(res.status).toBe(200);
    const rows = await db
      .select()
      .from(schema.audit_logs)
      .where(eq(schema.audit_logs.entity, 'user'));
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.some((r) => r.action === 'create')).toBe(true);
  });
});

describe('用户权限分级（超级管理员 / 管理员 / 员工）', () => {
  let app: ReturnType<typeof createApp>;
  let superToken: string;
  let plainAdminToken: string;
  let staffId: number;
  let peerAdminId: number;

  beforeEach(async () => {
    const { db } = await setupTestDb();
    app = createApp({ db });
    await seedUser(db, {
      username: 'rnlkja',
      full_name: '超级管理员',
      role: 'admin',
      password: 'Pw123456',
    });
    await seedUser(db, {
      username: 'admin_plain',
      full_name: '一般管理员',
      role: 'admin',
      password: 'Pw123456',
    });
    const peer = await seedUser(db, {
      username: 'admin_peer',
      full_name: '另一名管理员',
      role: 'admin',
      password: 'Pw123456',
    });
    peerAdminId = peer.id;
    const staff = await seedUser(db, {
      username: 'staff_rbac',
      full_name: '测试员工',
      role: 'staff',
      password: 'Pw123456',
    });
    staffId = staff.id;
    superToken = (await login(app, 'rnlkja', 'Pw123456')).token;
    plainAdminToken = (await login(app, 'admin_plain', 'Pw123456')).token;
  });

  it('一般管理员不可将员工提升为管理员（PATCH access）', async () => {
    const res = await app.fetch(
      new Request(`http://test.local/api/users/${staffId}/access`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${plainAdminToken}`,
        },
        body: JSON.stringify({ role: 'admin' }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it('超级管理员可将员工设为管理员', async () => {
    const res = await app.fetch(
      new Request(`http://test.local/api/users/${staffId}/access`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superToken}`,
        },
        body: JSON.stringify({ role: 'admin' }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { role: string } };
    expect(body.user.role).toBe('admin');
  });

  it('一般管理员不可删除其他管理员（DELETE）', async () => {
    const res = await app.fetch(
      new Request(`http://test.local/api/users/${peerAdminId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${plainAdminToken}` },
      }),
    );
    expect(res.status).toBe(403);
  });

  it('一般管理员可停用在册员工（DELETE）', async () => {
    const res = await app.fetch(
      new Request(`http://test.local/api/users/${staffId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${plainAdminToken}` },
      }),
    );
    expect(res.status).toBe(200);
  });

  it('一般管理员不可创建管理员账号（POST staff）', async () => {
    const res = await app.fetch(
      new Request('http://test.local/api/users/staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${plainAdminToken}`,
        },
        body: JSON.stringify({
          username: 'newadmin1',
          full_name: '非法',
          password: 'Pw12345678',
          role: 'admin',
        }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it('超级管理员可创建管理员账号（POST staff）', async () => {
    const res = await app.fetch(
      new Request('http://test.local/api/users/staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superToken}`,
        },
        body: JSON.stringify({
          username: 'newadmin2',
          full_name: '新管',
          password: 'Pw12345678',
          role: 'admin',
        }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { role: string } };
    expect(body.user.role).toBe('admin');
  });
});
