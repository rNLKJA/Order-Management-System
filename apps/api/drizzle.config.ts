import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { defineConfig } from 'drizzle-kit';

// 优先加载 monorepo 根 .env
const here = dirname(fileURLToPath(import.meta.url));
for (const path of [resolve(here, '../../.env'), resolve(here, './.env')]) {
  if (existsSync(path)) loadDotenv({ path });
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'turso',
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL ?? 'file:./local.db',
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
  strict: true,
  verbose: true,
});
