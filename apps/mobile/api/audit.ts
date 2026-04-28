/**
 * 审计日志（仅管理员可查）：业务操作与账号权限变更留痕。
 */

import type { AuditAction, AuditEntity } from '@meal/shared';
import { api } from './client';

export interface AuditLogRow {
  id: number;
  user_id: number;
  action: AuditAction;
  entity: AuditEntity;
  entity_id: number;
  diff_json: string;
  created_at: number;
  actor_username: string | null;
  actor_full_name: string | null;
}

export interface AuditListParams {
  entity?: AuditEntity;
  entity_id?: number;
  actor_id?: number;
  limit?: number;
}

export const auditApi = {
  list: (params?: AuditListParams) => {
    const qs = new URLSearchParams();
    if (params?.entity) qs.set('entity', params.entity);
    if (params?.entity_id != null) qs.set('entity_id', String(params.entity_id));
    if (params?.actor_id != null) qs.set('actor_id', String(params.actor_id));
    if (params?.limit != null) qs.set('limit', String(params.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return api.get<{ logs: AuditLogRow[] }>(`/api/audit-logs${suffix}`);
  },
};
