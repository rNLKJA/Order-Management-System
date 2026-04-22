/**
 * 把 plan §25 的 23 个 issue 批量同步到 Linear。
 *
 * 幂等：按 title 查重，已存在的 issue 只更新 state / priority / body / labels，不重建。
 * 运行：
 *   LINEAR_API_KEY=lin_api_xxx pnpm --filter @meal/scripts sync-linear
 *
 * 步骤：
 *   1. GraphQL query 取 workspace / team / project / states / labels
 *   2. 对每个 LinearIssueSpec 做 upsert：
 *      - 存在（标题匹配）→ issueUpdate
 *      - 不存在 → issueCreate
 *   3. 缺失的 label 先 labelCreate，再引用
 *
 * 依赖：无需 @linear/sdk，直接 fetch GraphQL。
 */

import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { ISSUES, type LinearIssueSpec } from './linear-issues.js';

const here = dirname(fileURLToPath(import.meta.url));
for (const path of [resolve(here, '../../.env'), resolve(here, '../.env')]) {
  if (existsSync(path)) loadDotenv({ path });
}

const API_URL = 'https://api.linear.app/graphql';
const API_KEY = process.env.LINEAR_API_KEY;
const TEAM_KEY = process.env.LINEAR_TEAM_KEY ?? 'MEA';
const PROJECT_NAME = process.env.LINEAR_PROJECT_NAME ?? 'MVP Sprint';

if (!API_KEY) {
  console.error('[linear] 未设置 LINEAR_API_KEY，请先到 Linear → Settings → API 生成并填入 .env 或环境变量');
  process.exit(1);
}

// ==================== GraphQL 辅助 ====================

async function gql<T = any>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: API_KEY!,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (json.errors?.length) {
    throw new Error('Linear GraphQL 错误：' + json.errors.map((e) => e.message).join('; '));
  }
  return json.data as T;
}

// ==================== 数据读取 ====================

interface Team {
  id: string;
  name: string;
  key: string;
  states: Array<{ id: string; name: string; type: string }>;
  labels: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; name: string }>;
  issues: Array<{ id: string; title: string; identifier: string }>;
}

async function getTeam(): Promise<Team> {
  // 查询 1: 仅拿 team id + 基本信息 + states（states 数量少，可以一起取）
  const base = await gql<{
    teams: {
      nodes: Array<{
        id: string;
        name: string;
        key: string;
        states: { nodes: Array<{ id: string; name: string; type: string }> };
      }>;
    };
  }>(
    `query Team($key: String!) {
      teams(filter: { key: { eq: $key } }) {
        nodes {
          id name key
          states { nodes { id name type } }
        }
      }
    }`,
    { key: TEAM_KEY },
  );
  const node = base.teams.nodes[0];
  if (!node) {
    throw new Error(`找不到 Team key=${TEAM_KEY}；请检查 Linear 里 Team identifier`);
  }

  // 查询 2: labels（单独一跳）
  const labels = await gql<{ issueLabels: { nodes: Array<{ id: string; name: string }> } }>(
    `query Labels($teamId: ID!) {
      issueLabels(filter: { team: { id: { eq: $teamId } } }, first: 250) {
        nodes { id name }
      }
    }`,
    { teamId: node.id },
  );

  // 查询 3: projects
  const projects = await gql<{ projects: { nodes: Array<{ id: string; name: string }> } }>(
    `query Projects($teamId: ID!) {
      projects(filter: { accessibleTeams: { id: { eq: $teamId } } }, first: 50) {
        nodes { id name }
      }
    }`,
    { teamId: node.id },
  );

  // 查询 4: issues（分页，按需取全）
  const issues: Array<{ id: string; title: string; identifier: string }> = [];
  let after: string | null = null;
  for (let i = 0; i < 10; i++) {
    const page: {
      issues: {
        nodes: Array<{ id: string; title: string; identifier: string }>;
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    } = await gql(
      `query Issues($teamId: ID!, $after: String) {
        issues(filter: { team: { id: { eq: $teamId } } }, first: 100, after: $after) {
          nodes { id title identifier }
          pageInfo { hasNextPage endCursor }
        }
      }`,
      { teamId: node.id, after },
    );
    issues.push(...page.issues.nodes);
    if (!page.issues.pageInfo.hasNextPage) break;
    after = page.issues.pageInfo.endCursor;
  }

  return {
    id: node.id,
    name: node.name,
    key: node.key,
    states: node.states.nodes,
    labels: labels.issueLabels.nodes,
    projects: projects.projects.nodes,
    issues,
  };
}

// ==================== Label 确保 ====================

async function ensureLabels(team: Team, names: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>(team.labels.map((l) => [l.name, l.id]));
  for (const name of names) {
    if (!map.has(name)) {
      const data = await gql<{ issueLabelCreate: { success: boolean; issueLabel: { id: string; name: string } } }>(
        `mutation LabelCreate($input: IssueLabelCreateInput!) {
          issueLabelCreate(input: $input) {
            success issueLabel { id name }
          }
        }`,
        { input: { name, teamId: team.id } },
      );
      if (data.issueLabelCreate.success) {
        map.set(name, data.issueLabelCreate.issueLabel.id);
        console.log(`[linear] 新建 label: ${name}`);
      }
    }
  }
  return map;
}

// ==================== State 定位 ====================

function getStateId(team: Team, target: LinearIssueSpec['state']): string {
  // Linear 默认工作流：Backlog, Todo, In Progress, In Review, Done, Canceled
  const mapping: Record<string, string[]> = {
    Backlog: ['Backlog'],
    Todo: ['Todo'],
    InProgress: ['In Progress', 'In progress'],
    InReview: ['In Review', 'In review'],
    Done: ['Done', 'Completed'],
    Canceled: ['Canceled', 'Cancelled'],
  };
  const candidates = mapping[target] ?? [target];
  const state = team.states.find((s) => candidates.includes(s.name));
  if (!state) {
    throw new Error(`Team 里找不到状态 "${target}"；已有：${team.states.map((s) => s.name).join(', ')}`);
  }
  return state.id;
}

// ==================== Project ====================

async function ensureProject(team: Team): Promise<string> {
  const existing = team.projects.find((p) => p.name === PROJECT_NAME);
  if (existing) return existing.id;

  const data = await gql<{ projectCreate: { success: boolean; project: { id: string; name: string } } }>(
    `mutation ProjectCreate($input: ProjectCreateInput!) {
      projectCreate(input: $input) {
        success project { id name }
      }
    }`,
    { input: { name: PROJECT_NAME, teamIds: [team.id] } },
  );
  if (!data.projectCreate.success) {
    throw new Error(`创建 Project ${PROJECT_NAME} 失败`);
  }
  console.log(`[linear] 新建 Project: ${PROJECT_NAME}`);
  return data.projectCreate.project.id;
}

// ==================== Issue Upsert ====================

async function upsertIssue(
  team: Team,
  projectId: string,
  labelMap: Map<string, string>,
  spec: LinearIssueSpec,
): Promise<{ action: 'created' | 'updated' | 'skipped'; identifier: string }> {
  const existing = team.issues.find((i) => i.title === spec.title);
  const labelIds = spec.labels
    .map((l) => labelMap.get(l))
    .filter((v): v is string => Boolean(v));
  const stateId = getStateId(team, spec.state);

  if (existing) {
    const data = await gql<{ issueUpdate: { success: boolean; issue: { identifier: string } } }>(
      `mutation IssueUpdate($id: String!, $input: IssueUpdateInput!) {
        issueUpdate(id: $id, input: $input) {
          success issue { identifier }
        }
      }`,
      {
        id: existing.id,
        input: {
          description: spec.body,
          stateId,
          priority: spec.priority,
          labelIds,
          projectId,
        },
      },
    );
    return {
      action: data.issueUpdate.success ? 'updated' : 'skipped',
      identifier: data.issueUpdate.issue.identifier,
    };
  }

  const data = await gql<{ issueCreate: { success: boolean; issue: { identifier: string } } }>(
    `mutation IssueCreate($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success issue { identifier }
      }
    }`,
    {
      input: {
        title: spec.title,
        description: spec.body,
        teamId: team.id,
        stateId,
        priority: spec.priority,
        labelIds,
        projectId,
      },
    },
  );
  return {
    action: data.issueCreate.success ? 'created' : 'skipped',
    identifier: data.issueCreate.issue.identifier,
  };
}

// ==================== main ====================

async function main() {
  console.log('[linear] 拉取 Team / Project / Labels / Issues ...');
  const team = await getTeam();
  console.log(`  Team: ${team.name} (${team.key}) id=${team.id}`);
  console.log(`  States: ${team.states.map((s) => s.name).join(', ')}`);
  console.log(`  已有 issue: ${team.issues.length} 条`);
  console.log(`  已有 label: ${team.labels.length} 个`);

  // 聚合全部需要的 label
  const allLabels = Array.from(new Set(ISSUES.flatMap((i) => i.labels)));
  console.log(`[linear] 确保 ${allLabels.length} 个 label 存在 ...`);
  const labelMap = await ensureLabels(team, allLabels);

  console.log(`[linear] 确保 Project "${PROJECT_NAME}" 存在 ...`);
  const projectId = await ensureProject(team);

  console.log(`[linear] 同步 ${ISSUES.length} 个 issue ...\n`);
  const stats = { created: 0, updated: 0, skipped: 0 };
  for (const spec of ISSUES) {
    try {
      const res = await upsertIssue(team, projectId, labelMap, spec);
      stats[res.action] += 1;
      console.log(`  [${res.action.padEnd(7)}] ${res.identifier} ${spec.title}`);
    } catch (err) {
      console.error(`  [FAILED ] ${spec.title}`, err);
      stats.skipped += 1;
    }
  }

  console.log(`\n[linear] 完成：created=${stats.created} updated=${stats.updated} skipped=${stats.skipped}`);
}

main().catch((err) => {
  console.error('[linear] 失败：', err);
  process.exit(1);
});
