/**
 * GET /api/health
 *
 * 心跳接口，用于：
 * - UptimeRobot / 监控探测
 * - 部署后手工验证
 */

import { Hono } from 'hono';

export const healthRouter = new Hono();

healthRouter.get('/', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});
