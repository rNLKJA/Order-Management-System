/**
 * Vercel serverless entrypoint。
 *
 * 文件路径 `apps/api/api/index.ts` 映射到 Vercel 的 `/api/*` 路由（所有路径）。
 * Hono 内部以 `/api/xxx` 为前缀自行分发。
 */

import { handle } from 'hono/vercel';
import { createApp } from '../src/app.js';

const app = createApp();

export const config = {
  runtime: 'nodejs',
};

export default handle(app);
