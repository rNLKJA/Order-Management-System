/**
 * 审计日志路由（MEA-17）。
 *
 * GET /api/audit-logs  仅 admin 可访问，查询某实体的操作历史。
 *
 * Query params:
 *   entity    — 按实体类型过滤（可选）
 *   entity_id — 按实体 ID 过滤（可选，需与 entity 同用才有意义）
 *   limit     — 最多返回条数（默认 50，上限 200）
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '../db/client.js';
import { requestDb } from '../db/request-db.js';
import { requireAuth, requireRole, type AuthVariables } from '../middleware/jwt.js';

export const auditRouter = new Hono<{ Variables: AuthVariables }>();

auditRouter.use('*', requireAuth());
auditRouter.use('*', requireRole('admin'));

const listQuerySchema = z.object({
  entity: z
    .enum(['member', 'card', 'daily_order', 'finance_entry', 'user'])
    .optional(),
  entity_id: z
    .string()
    .regex(/^\d+$/, 'entity_id 必须是整数')
    .transform((v) => parseInt(v, 10))
    .optional(),
  limit: z
    .string()
    .regex(/^\d+$/)
    .optional()
    .default('50')
    .transform((v) => Math.min(200, Math.max(1, Number(v)))),
});

auditRouter.get('/', zValidator('query', listQuerySchema), async (c) => {
  const q = c.req.valid('query');
  const db = requestDb(c);

  const conds = [] as ReturnType<typeof eq>[];
  if (q.entity) {
    conds.push(eq(schema.audit_logs.entity, q.entity));
  }
  if (q.entity_id !== undefined) {
    conds.push(eq(schema.audit_logs.entity_id, q.entity_id));
  }

  const whereExpr = conds.length > 0 ? and(...conds) : undefined;

  const logs = await db
    .select()
    .from(schema.audit_logs)
    .where(whereExpr)
    .orderBy(desc(schema.audit_logs.id))
    .limit(q.limit);

  return c.json({ logs });
});
