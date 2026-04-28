# 订餐会员管理系统

一个面向小型订餐工作室的会员 + 卡券 + 订餐 + 出餐 + 财务管理系统。手机（iOS / Android）+ 电脑（Web）三端共用一套数据。

> **当前阶段**：Phase 0–4 已上线（会员 / 卡 / 订餐 / 出餐 / 财务 / 记录编辑全量 / 生产部署到 Vercel），正进入 Phase 4+（次日接龙汇总、收工报表、Summary、导出、备份、自有域名等）。详见 [实施阶段](#实施阶段)。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 仓库编排 | pnpm workspace + Turborepo |
| 前端 | Expo SDK 51 + Expo Router + React Native Paper |
| 后端 | Hono + TypeScript on Vercel（`sin1`） |
| 数据库 | Turso（libSQL / SQLite 兼容，主 `nrt` + 副 `sin`） |
| ORM | Drizzle |
| 备份 | Cloudflare R2（Phase 4+） |
| 认证 | argon2id + HS256 JWT + Expo SecureStore / HttpOnly Cookie |
| 任务管理 | [Linear](./doc/LINEAR.md) |

## 目录结构

```
apps/
  api/        Hono 后端
  mobile/     Expo 三端应用
packages/
  shared/     共享卡目录 / 类型 / zod / 格式化工具 / 节假日清单
scripts/      运维脚本（账号 seed / 数据迁移 / 恢复）
doc/          设计与流程文档
  PROCESS.md  业务流程图
  DESIGN.md   视觉规范
  LINEAR.md   任务管理与 Git 工作流
```

## 快速开始（开发）

```bash
# 1) 克隆后装依赖
pnpm install

# 2) 准备环境变量
cp .env.example .env
# 填写 TURSO_DATABASE_URL / TURSO_AUTH_TOKEN / JWT_SECRET / BOOTSTRAP_ADMIN_PASSWORD

# 3) 初始化数据库（首次）
pnpm --filter @meal/api db:push
pnpm --filter scripts seed-accounts

# 4) 启动所有应用（Hono + Expo）
pnpm dev
```

默认端口：

- API：`http://localhost:3000`
- Expo Dev：`http://localhost:8081`（扫 QR 码或按 `w` 开 Web）

## 常用命令

```bash
pnpm dev              # 同时启动所有 app
pnpm typecheck        # 全仓 TypeScript 检查
pnpm lint             # 全仓 lint
pnpm build            # 全仓构建
pnpm format           # Prettier 格式化
```

## 线上地址（当前）

- Mobile Web（Vercel）：[https://meal-mobile.vercel.app](https://meal-mobile.vercel.app)
- API（Vercel）：[https://meal-api-nu.vercel.app](https://meal-api-nu.vercel.app)

## 近期更新（2026-04-28）

- 每日订餐新增「送餐失败并退餐」流程：仅对 `已出餐` 订单可用，支持快速失败原因并自动退回餐数。
- 送餐失败入口统一危险红色样式，减少误触风险。
- 订单状态卡按钮改为图标与文字同一行，提升可读性。
- 出餐卡片信息层级优化：餐别、份数、卡种分层显示，右侧操作区比例更紧凑。
- 每日订餐页「每次加载」与日期合并为同一行，界面更紧凑。
- 会员档案页筛选顺序调整为「筛选 Tab 在上，搜索框在下」。

## App 打包（EAS）说明

当前仓库已完成 EAS 配置（`apps/mobile/eas.json`），并补充了 iOS 出口合规字段：

- `ios.infoPlist.ITSAppUsesNonExemptEncryption = false`

首次打包前，请先完成签名凭证初始化（本地交互执行一次）：

```bash
cd apps/mobile
eas credentials:configure-build -p android -e production
eas credentials:configure-build -p ios -e production
```

然后即可发起云构建：

```bash
eas build --platform android --profile production --no-wait
eas build --platform ios --profile production --no-wait
```

说明：

- 若 Apple Developer Membership 过期，iOS 凭证注册会失败（403），但 **Web 端可继续正常发布和使用**。
- Android 生产包在无 keystore 的情况下，必须先完成上述 `credentials` 初始化。

## 权限、角色与数据写操作管控

### 账号分级（系统内）

- **超级管理员**（登录名 `rnlkja`，不区分大小写）：分配/撤销一般管理员、管理全员账号；查看操作审计。**业务写接口层面始终放行**（不受数据录入白名单限制），避免把自己锁死。
- **一般管理员**：管理员工与权限、操作审计；**是否允许改会员/卡/订单/财务** 由下文「写操作管控」决定——**可以只读**，减少日常核对时误改。
- **员工**：同受「写操作管控」约束。

### 写操作管控（`DATA_OPERATOR_ENFORCEMENT`）

| 环境变量 | 含义 |
| --- | --- |
| `DATA_OPERATOR_ENFORCEMENT` | `0`（默认）：不拦截业务写接口，便于测试。`1`：仅 **超级管理员** 与 **数据录入白名单** 内的账号可执行会员/卡/订餐/财务等写操作。 |
| `DATA_OPERATOR_USERNAMES` | 可选；逗号分隔用户名字段，作白名单**初始种子**。持久名单存 `settings.data_operator_usernames`，与 App「权限管理」里「允许写操作」同步。 |

启用管控后，**管理员若不加入白名单即为只读**；需要录入时由超级管理员在「权限管理」中为其勾选「允许写操作」。

**上线注意**：若生产环境从「管理员一律可写」的旧行为切换为 `DATA_OPERATOR_ENFORCEMENT=1`，请在切换后为实际需要录入的同事（含管理员）逐一打开「允许写操作」，或临时用 `DATA_OPERATOR_USERNAMES` 填入用户名。

## 贡献流程

所有开发任务通过 [Linear](./doc/LINEAR.md) 管理，每个 issue 对应一条 Git 分支和一个 GitHub PR，合并前需 1 个 approve。详见 [doc/LINEAR.md](./doc/LINEAR.md)。

## 实施阶段

| 阶段 | 范围 | 状态 |
| --- | --- | --- |
| Phase 0 | Turborepo + GitHub 分支保护 + Linear 接入 | 已完成 |
| Phase 1 | pnpm workspace 脚手架 + Turso/Drizzle schema + argon2 + JWT 认证 | 已完成 |
| Phase 2 | 会员 CRUD + 卡业务（新购/升级/换卡） + 财务查询/支出 | 已完成 |
| Phase 2.5 | 订餐录入 + 午/晚拆条 + 扣卡 + 余额防护 + 取消冲销 | 已完成 |
| Phase 3 | 会员详情（当前卡/历史/累计） + Vercel 生产部署 + EAS Build | 已完成 |
| Phase 4 | 手机出餐/送餐视图（Tab 合并进订餐页） + 记录编辑全量 + audit 列表 | 已完成 |
| Phase 4+ | 次日接龙汇总 + 收工报表 + Summary 分析 + 多类型 Excel 导出 + R2 备份 + 自有域名 + TestFlight + hardening + 旧 Excel 迁移 + 文档终版 | 进行中 |

进度与任务对齐细节见 [`scripts/src/linear-issues.ts`](./scripts/src/linear-issues.ts)（本地规格，每次发版后由脚本同步到 Linear）。

## 文档索引

- [业务流程图 PROCESS.md](./doc/PROCESS.md)
- [视觉规范 DESIGN.md](./doc/DESIGN.md)（v3：Glassmorphism + Bento + Apple/Material 融合；RN Paper 版已落地）
- [Linear 使用教学 LINEAR.md](./doc/LINEAR.md)

## 许可

私有项目，未授权禁止转载 / 使用。
