/**
 * Vercel serverless entrypoint。
 *
 * 使用 `@hono/node-server/vercel` 的 handle，它把 Hono 的 fetch(Request) → Response
 * 模型桥接成 Vercel Node runtime 需要的 (req, res) 风格。
 *
 * 文件路径 `apps/api/api/index.ts` → Vercel `/api` 函数；
 * 所有 `/api/*` 通过 vercel.json 的 rewrite 统一转发到这里，
 * 再由 Hono 内部按 `/api/xxx` 前缀分发。
 */

import { handle } from '@hono/node-server/vercel';
import { createApp } from '../src/app.js';

const app = createApp();

export const config = {
  runtime: 'nodejs',
};

export default handle(app);
