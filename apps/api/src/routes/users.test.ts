/**
 * 用户路由测试 — 头像上传 / 清除。
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { createApp } from '../app.js';
import { setupTestDb, seedUser } from '../test-helpers.js';
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
});
