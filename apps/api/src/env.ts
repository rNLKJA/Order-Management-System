/**
 * 运行时环境变量读取与校验。
 *
 * 生产：从 Vercel 项目环境变量读
 * 本地开发：从 monorepo 根 `.env` 读（通过 dotenv，服务端本地 dev 专用）
 */

import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';

// 仅在非 Vercel 环境读 .env；Vercel 会自己注入 env。
if (!process.env.VERCEL) {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, '../../../.env'), // apps/api/src → monorepo root
    resolve(here, '../.env'), // apps/api/.env
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      loadDotenv({ path });
    }
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  TURSO_DATABASE_URL: z.string().min(1, 'TURSO_DATABASE_URL 未设置'),
  TURSO_AUTH_TOKEN: z.string().min(1).optional(),

  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET 必须至少 32 字符（建议 64 hex）'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  CRON_SECRET: z.string().min(16).optional(),

  BOOTSTRAP_ADMIN_USERNAME: z.string().default('rNLKJA'),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(8).optional(),

  DEFAULT_TZ: z.string().default('Asia/Shanghai'),

  PORT: z.coerce.number().default(3000),

  // R2（Phase 4+ 才用到，这里设为可选）
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_BASE_URL: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('[env] 校验失败：', parsed.error.flatten().fieldErrors);
  throw new Error('环境变量不合法，请检查 .env 或 Vercel 项目配置');
}

export const env = parsed.data;
export type Env = typeof env;
