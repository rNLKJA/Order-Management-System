/**
 * 本地开发服务器入口。
 *
 * Vercel 部署时不走这个文件，走 api/index.ts 的 fetch handler。
 */

import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { env } from './env.js';

const app = createApp();

// eslint-disable-next-line no-console
console.log(`[api] listening on http://localhost:${env.PORT}`);

serve({
  fetch: app.fetch,
  port: env.PORT,
});
