/**
 * Linear 同步数据：按 plan §25 的实施顺序预定义所有 issue。
 *
 * 字段说明：
 * - title    -> issue 标题（Linear 按序自动分配 MEA-1, MEA-2, ...）
 * - state    -> 初始状态 Backlog/Todo/InProgress/InReview/Done/Canceled
 * - priority -> 0=No priority 1=Urgent 2=High 3=Medium 4=Low
 * - labels   -> 标签数组（脚本会自动创建缺失的 label）
 * - body     -> 与 LINEAR.md §4 对齐的模板（目标/验收/方案/测试/关联）
 */

export interface LinearIssueSpec {
  title: string;
  state: 'Backlog' | 'Todo' | 'InProgress' | 'InReview' | 'Done' | 'Canceled';
  priority: 0 | 1 | 2 | 3 | 4;
  labels: string[];
  /** Markdown body */
  body: string;
}

const PHASES = {
  p0: 'phase-0',
  p1: 'phase-1',
  p2: 'phase-2',
  p25: 'phase-2.5',
  p3: 'phase-3',
  p4: 'phase-4+',
};

export const ISSUES: LinearIssueSpec[] = [
  // ==================== Phase 0 基础设施 ====================
  {
    title: 'chore: Turborepo monorepo + GitHub + 分支保护 + PR 模板',
    state: 'Done',
    priority: 2,
    labels: [PHASES.p0, 'infra'],
    body: `## 目标
搭建 pnpm workspace + Turborepo 作为整个应用的 monorepo 容器；建 GitHub 私有 repo 并开启分支保护；配置 PR 模板与 CODEOWNERS。

## 验收标准
- [x] pnpm-workspace.yaml + turbo.json 管线（build/dev/typecheck/lint/test）
- [x] .github/pull_request_template.md 四段（关联/改动/测试/截图）
- [x] .github/CODEOWNERS 关键目录
- [x] .github/workflows/ci.yml Turbo 驱动的 CI
- [x] .nvmrc 固定 Node 20
- [x] GitHub repo https://github.com/rNLKJA/Order-Management-System 推送成功
- [x] main 分支保护（require PR + 1 approval + status check）

## 技术方案
见 plan §24.5、§3。

## 关联
- plan §1、§24.5
- doc/LINEAR.md
`,
  },
  {
    title: 'chore: Linear Workspace 接入 GitHub + 批量同步 issue',
    state: 'Done',
    priority: 2,
    labels: [PHASES.p0, 'infra'],
    body: `## 目标
Linear Workspace = meal-membership，Team = MEA，Project = MVP Sprint；GitHub 集成（PR 标题/分支名含 MEA-X 自动关联）；用脚本批量同步所有 issue。

## 验收标准
- [x] Workspace / Team / Project 创建
- [x] GitHub 集成开启（PR 自动关联、合并自动 Done）
- [x] 所有 plan §25 的 issue 通过 scripts/sync-linear.ts 创建（23 条 MEA-5~MEA-27）
- [x] CI/CD 修复并跑绿（commit b9fa21e）

## 技术方案
scripts/src/sync-linear.ts 使用 Linear GraphQL API 幂等创建 issue。

## 关联
- doc/LINEAR.md
- scripts/src/sync-linear.ts
`,
  },

  // ==================== Phase 1 基础层 ====================
  {
    title: 'feat: pnpm workspace 脚手架（Expo + Hono + shared 包）',
    state: 'Done',
    priority: 2,
    labels: [PHASES.p1, 'scaffold'],
    body: `## 目标
apps/mobile（Expo + RN Paper）+ apps/api（Hono + Vercel）+ packages/shared（卡目录 + types + zod + format + holidays）+ scripts 骨架全部跑通。

## 验收标准
- [x] pnpm install 成功
- [x] pnpm turbo run typecheck 全部 4 包通过
- [x] API 本地可启动：pnpm --filter @meal/api dev
- [x] Expo 本地可启动：pnpm --filter @meal/mobile dev

## 关联
- plan §3、§25 step 1
`,
  },
  {
    title: 'feat: Turso + Drizzle schema（9 表）+ migration + seed 5 账号',
    state: 'Done',
    priority: 1,
    labels: [PHASES.p1, 'db', 'auth'],
    body: `## 目标
Drizzle 定义 9 张业务表（users/settings/members/cards/daily_orders/finance_entries/audit_logs/tomorrow_summaries/notifications）+ 3 张辅助表（idempotency_keys/export_logs）；seed 5 账号和 8 条 settings 默认值。

## 验收标准
- [x] 本地 data/meal.db 推送成功
- [x] Turso 云端 meal-management 推送成功（东京 aws-ap-northeast-1）
- [x] scripts/seed-accounts 幂等建 admin rNLKJA + 4 staff
- [x] settings 默认收款/录入/送达/单价/截止 写入
- [x] 密码落到 .secrets/accounts.md（双库两套）

## 关联
- plan §4、§15、§25 step 2
`,
  },
  {
    title: 'feat: 认证（argon2id + HS256 JWT + login 路由 + 限流）',
    state: 'Done',
    priority: 1,
    labels: [PHASES.p1, 'auth'],
    body: `## 目标
POST /api/auth/login + GET /api/auth/me；argon2id 密码哈希（memoryCost=64MB/timeCost=3）；HS256 JWT（载荷含 ver，重置密码即吊销）；Expo SecureStore / Web HttpOnly Cookie；登录限流 60s/10 次。

## 验收标准
- [x] 密码只存 argon2 哈希
- [x] JWT sub/role/ver 最小化载荷
- [x] token_version 不匹配 = 401
- [x] Expo 登录页 + useAuth hook
- [x] 本地 + 云端 login roundtrip 通过

## 关联
- plan §14、§25 step 3
`,
  },

  // ==================== Phase 2 并行 slice ====================
  {
    title: 'feat(members): 会员 CRUD + 详情页 + 搜索 + 软删除',
    state: 'Todo',
    priority: 2,
    labels: [PHASES.p2, 'members'],
    body: `## 目标
会员 CRUD；搜索（uid / 姓名 / 昵称 / 手机 / 微信号）；医院订阅 checkbox；重复手机号提示；is_active 软删除（admin）；详情页骨架（当前卡 / 订阅记录 / 订餐记录 占位）。

## 验收标准
- [ ] POST /api/members 创建 + uid 自动拼
- [ ] GET /api/members 搜索
- [ ] PATCH /api/members/:id 编辑
- [ ] DELETE /api/members/:id 仅 admin + 无引用才允许
- [ ] Expo 会员列表页 + 创建页 + 详情页骨架
- [ ] 重复手机号 Dialog 提示（不硬阻）

## 技术方案
apps/api/src/routes/members.ts + apps/mobile/app/(app)/members/\*\*

## 允许改动文件
- apps/api/src/routes/members.ts
- apps/mobile/app/(app)/members/**
- 相关 components

## 关联
- plan §3 Member、§16、§25 step 5
`,
  },
  {
    title: 'feat(cards): 购卡 + 升级 + 换卡 + 院内外价目表 Modal',
    state: 'Todo',
    priority: 1,
    labels: [PHASES.p2, 'cards'],
    body: `## 目标
卡三条路径：新购（无 active 卡）/ 升级（禁降级，补差价，继承已用）/ 换卡（耗尽后允许任意等级）；院内外价目表 checkbox；购卡/升级 Modal 含收款人 + 录入者 + 购卡时间字段；购卡/升级自动写 FinanceEntry(income)。

## 验收标准
- [ ] POST /api/cards 新购 + 自动 income
- [ ] POST /api/cards/:id/upgrade 补差价 + 继承已用
- [ ] 升级校验 newCat.totalPrice > old.paid_amount 否则 422
- [ ] 耗尽 remaining=0 自动置 exhausted
- [ ] 换卡不受旧卡等级限制
- [ ] Expo Modal 价格网格 + 收款人/录入者下拉 + 计算应收/补差价/新剩余

## 允许改动文件
- apps/api/src/routes/cards.ts
- apps/api/src/services/upgrade.ts
- apps/mobile/app/(app)/members/[id]/cards/** 
- 卡种 Modal 组件

## 关联
- plan §5、§6、§25 step 6
`,
  },
  {
    title: 'feat(orders): 每日订餐录入 + 午/晚拆条 + 扣卡 + 余额上限',
    state: 'Backlog',
    priority: 1,
    labels: [PHASES.p25, 'orders'],
    body: `## 目标
订餐录入（桌面批量 default date=明天 / 手机快速 default date=今天，双列午/晚拆条）；订阅自动扣卡（扣到 0 转 exhausted）；散餐自动 income；余额上限 422（散餐不受限）；Idempotency-Key 防重；订单编辑原子回滚重扣。

## 验收标准
- [ ] POST /api/orders 接 { member_id, order_date, lunch_qty, dinner_qty, notes }，拆 1-2 条
- [ ] 合并校验 total_qty <= card.remaining，超了 422 INSUFFICIENT_MEAL_BALANCE
- [ ] 扣到 0 → exhausted + 响应带"提醒续卡"标志
- [ ] 散餐 amount=35×qty + 自动 FinanceEntry(income, ad_hoc)
- [ ] PATCH /api/orders/:id 原子回滚重扣
- [ ] Idempotency-Key header 防重复提交
- [ ] Expo 录入 Modal + 会员详情的订餐记录表

## 依赖
- Blocked by MEA-7（cards）、MEA-9（finance）

## 关联
- plan §7、§9、§25 step 7
`,
  },
  {
    title: 'feat(finance): 收入自动入账 + 手动支出 + 记账页',
    state: 'Todo',
    priority: 2,
    labels: [PHASES.p2, 'finance'],
    body: `## 目标
收入：购卡/升级/散餐三分类自动入账（带 collector_user_id）；支出：手动录入日期/金额/备注；记账页日期区间+分类筛选+汇总；voided 冲销条目淡色展示。

## 验收标准
- [ ] FinanceEntry 建新时自动分类（hospital_sub / regular_sub / ad_hoc / manual_expense）
- [ ] POST /api/finance/expense 手动录支出
- [ ] GET /api/finance 列表支持日期/type/category 筛选
- [ ] PATCH /api/finance/:id 编辑金额/备注/分类
- [ ] DELETE 仅 admin
- [ ] Expo 财务页：分类汇总卡 + 明细表 + 新增支出 Modal

## 允许改动文件
- apps/api/src/routes/finance.ts
- apps/api/src/services/finance.ts
- apps/mobile/app/(app)/finance/**

## 关联
- plan §12、§25 step 10
`,
  },

  // ==================== Phase 3 收尾 ====================
  {
    title: 'feat(members): 会员详情完善（订阅记录 + 订餐记录 + 累计统计）',
    state: 'Backlog',
    priority: 2,
    labels: [PHASES.p3, 'members'],
    body: `## 目标
会员详情页完全打通：当前卡进度条 + 订阅记录表 + 订餐记录表（90 天）+ 累计购买/消费/消费金额三张指标卡。

## 验收标准
- [ ] 订阅记录表倒序显示所有历史卡，状态 Badge
- [ ] 订餐记录表显示餐别 Badge + 状态 Badge + 录入者 + 打餐人 + 送达人
- [ ] 累计数据聚合正确
- [ ] 操作按钮按状态切换（无 active 卡 → "购买新卡"；有 → "升级 / 录入用餐"）

## 依赖
- Blocked by MEA-6、MEA-7、MEA-8

## 关联
- plan §16、§25 step 9
`,
  },
  {
    title: 'chore: 部署 Vercel（sin1）+ Turso 生产切换 + Expo Go 真机测',
    state: 'Backlog',
    priority: 2,
    labels: [PHASES.p3, 'deploy'],
    body: `## 目标
API 部署到 Vercel（sin1 区域）；Web 用 expo export 部署 Vercel；环境变量填入 Vercel Env；Expo Go 扫码手机真机连云端；MVP 上线。

## 验收标准
- [ ] vercel --prod 成功；/api/health 能访问
- [ ] 自有域名 .com 挂 Cloudflare（可留到下周）
- [ ] 手机 Expo Go 登录能连云端
- [ ] 4 员工 + admin 密码分发

## 依赖
- Blocked by MEA-6 ~ MEA-10

## 关联
- plan §22、§25 step 18
`,
  },

  // ==================== Phase 4+ ====================
  {
    title: 'feat(packing): 手机专用出餐视图（4 Tab + 双 Chip + fulfill/deliver/cancel）',
    state: 'Backlog',
    priority: 2,
    labels: [PHASES.p4, 'packing'],
    body: `## 目标
手机专用打餐视图：4 Tab（待出餐/待送达/已送达/已取消）+ 双 Chip 筛选（餐别 + 配送区）+ 完成出餐 / 确认送达 / 取消；delivered 终态锁定；Haptics 振动；离线缓存。

## 依赖
- Blocked by MEA-8（orders）

## 关联
- plan §9、§25 step 8
`,
  },
  {
    title: 'feat: 记录编辑全量（cards/finance 支持 PATCH + audit log）',
    state: 'Backlog',
    priority: 3,
    labels: [PHASES.p4, 'edit'],
    body: `## 目标
Card/FinanceEntry/DailyOrder 的 PATCH 支持；订单 patch 原子回滚重扣；所有编辑写 audit_logs；delivered/cancelled 拒绝修改。

## 关联
- plan §17、§25 step 9
`,
  },
  {
    title: 'feat(tomorrow): 次日接龙汇总页 + 22:05 Cron',
    state: 'Backlog',
    priority: 3,
    labels: [PHASES.p4, 'cron'],
    body: `## 目标
Vercel Cron 22:05 CST 自动快照到 tomorrow_summaries；按会员 + 按配送区汇总；stale 标记；长图/PDF 导出；22:00 后补录实时 invalidate。

## 关联
- plan §10、§25 step 11
`,
  },
  {
    title: 'feat(report): 今日收工报表（实时聚合视图）',
    state: 'Backlog',
    priority: 3,
    labels: [PHASES.p4, 'report'],
    body: `## 目标
GET /api/daily-report/:date 实时聚合；任何员工可看可导出 PDF/xlsx；无 cron/无签字/无归档。

## 关联
- plan §11、§25 step 12
`,
  },
  {
    title: 'feat(summary): 面板 + 移动 Summary（日/周/月/年 + 基准线/均值/中位数）',
    state: 'Backlog',
    priority: 3,
    labels: [PHASES.p4, 'analytics'],
    body: `## 目标
桌面面板（指标卡 + 续卡提醒 + 图表）+ 移动 Summary（日/周/月/年 Tab + 8 指标 + 三条参考线 + 午晚堆叠柱）。工作周定义排除节假日。

## 关联
- plan §19、§25 step 13
`,
  },
  {
    title: 'feat(export): Excel 导出 5 种（带日期范围）',
    state: 'Backlog',
    priority: 3,
    labels: [PHASES.p4, 'export'],
    body: `## 目标
GET /api/export/xlsx kind=members|cards|orders|finance|snapshot，带 from/to + 附加过滤；snapshot 仅 admin；export_logs 记录。

## 关联
- plan §13、§25 step 14
`,
  },
  {
    title: 'feat(backup): Vercel Cron 每日 → R2 + 手动立即备份',
    state: 'Backlog',
    priority: 3,
    labels: [PHASES.p4, 'backup'],
    body: `## 目标
Cron 03:00 CST → libSQL .dump → gzip → Cloudflare R2 daily/YYYYMMDD.sql.gz；R2 lifecycle 90 天；admin 手动 + 列表 + 签名下载；scripts/restore.ts 灾难恢复。

## 关联
- plan §20、§25 step 15
`,
  },
  {
    title: 'chore: 主题 & DESIGN.md 重写（适配 RN Paper）',
    state: 'Backlog',
    priority: 4,
    labels: [PHASES.p4, 'design'],
    body: `## 目标
把 doc/DESIGN.md 从 Tailwind 阶段重写为 RN Paper 版；补 5 张缺失的页面样板（tomorrow/report/summary/packing/export）；所有 Tailwind class 例子替换为 Paper 组件 props + StyleSheet 数值。

## 关联
- plan §18、§25 step 16
`,
  },
  {
    title: 'chore: 一次性 Excel 数据迁移（旧 xlsm → API）',
    state: 'Backlog',
    priority: 3,
    labels: [PHASES.p4, 'migration'],
    body: `## 目标
scripts/import-excel.ts 读 doc/xxx.xlsm 的 5 张表，调 API 批量入库；meal_type 正则推断；未匹配写 unresolved.csv / needs_review.csv。

## 关联
- plan §21、§25 step 17
`,
  },
  {
    title: 'chore: 自有域名 + Cloudflare + EAS Build (iOS + Android)',
    state: 'Backlog',
    priority: 3,
    labels: [PHASES.p4, 'deploy'],
    body: `## 目标
买 .com 域名挂 Cloudflare DNS → Vercel；EAS Build 产 iOS .ipa（TestFlight）+ Android .apk（直发）。

## 关联
- plan §22、§25 step 18
`,
  },
  {
    title: 'chore: 漏洞补全（时区/重复手机/限流/幂等/观测/health）',
    state: 'Backlog',
    priority: 3,
    labels: [PHASES.p4, 'hardening'],
    body: `## 目标
时区统一 UTC 存/Asia/Shanghai 展示/04:00 业务日；重复手机提示；admin 忘密 CLI 脚本（已有占位）；登录限流完善；Idempotency-Key 表；pushplus/bark 告警；/api/health + UptimeRobot。

## 关联
- plan §23、§25 step 19
`,
  },
  {
    title: 'chore: README 最终版 + PROCESS/DESIGN/LINEAR 同步 + GitHub polish',
    state: 'Backlog',
    priority: 4,
    labels: [PHASES.p4, 'docs'],
    body: `## 目标
README 中文完整版（架构图 + 快速开始 + Turso/Vercel/EAS 部署 + 备份 + FAQ）；PROCESS/DESIGN 与最终代码对齐；GitHub repo description + topics + about section。

## 关联
- plan §24、§25 step 20
`,
  },
];
