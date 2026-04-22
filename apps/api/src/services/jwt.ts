/**
 * JWT 签发与验证（HS256）。
 *
 * 载荷形如：{ sub: user_id, role, ver, iat, exp }
 * ver 是 users.token_version；重置密码会 +1，旧 token 立即失效。
 */

import { SignJWT, jwtVerify } from 'jose';
import type { JWTPayload } from 'jose';
import { env } from '../env.js';
import type { AuthTokenPayload, UserRole } from '@meal/shared';

const ALG = 'HS256';

let _secretKey: Uint8Array | null = null;
function getKey(): Uint8Array {
  if (!_secretKey) {
    _secretKey = new TextEncoder().encode(env.JWT_SECRET);
  }
  return _secretKey;
}

export async function signToken(payload: {
  user_id: number;
  role: UserRole;
  token_version: number;
}): Promise<string> {
  return new SignJWT({
    role: payload.role,
    ver: payload.token_version,
  })
    .setProtectedHeader({ alg: ALG })
    .setSubject(String(payload.user_id))
    .setIssuedAt()
    .setExpirationTime(env.JWT_EXPIRES_IN)
    .sign(getKey());
}

export async function verifyToken(token: string): Promise<AuthTokenPayload> {
  const { payload } = await jwtVerify(token, getKey(), { algorithms: [ALG] });
  return toAuthPayload(payload);
}

function toAuthPayload(p: JWTPayload): AuthTokenPayload {
  const sub = Number(p.sub);
  if (!Number.isInteger(sub) || sub <= 0) {
    throw new Error('JWT sub 非法');
  }
  const role = p.role as UserRole;
  if (role !== 'admin' && role !== 'staff') {
    throw new Error('JWT role 非法');
  }
  const ver = typeof p.ver === 'number' ? p.ver : Number(p.ver);
  if (!Number.isInteger(ver)) {
    throw new Error('JWT ver 非法');
  }
  return {
    sub,
    role,
    ver,
    iat: p.iat ?? 0,
    exp: p.exp ?? 0,
  };
}
