import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    include: ['src/**/*.{test,spec}.ts'],
    globals: false,
    reporters: 'default',
    env: {
      NODE_ENV: 'test',
      TURSO_DATABASE_URL: 'file::memory:?cache=shared',
      JWT_SECRET: 'test-jwt-secret-at-least-32-chars-long-zzzzz',
      JWT_EXPIRES_IN: '1h',
      DEFAULT_TZ: 'Asia/Shanghai',
    },
  },
  resolve: {
    alias: {
      '@meal/shared': resolve(here, '../../packages/shared/src/index.ts'),
    },
  },
});
