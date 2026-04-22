# 订餐会员管理系统

一个面向小型订餐工作室的会员 + 卡券 + 订餐 + 出餐 + 财务管理系统。手机（iOS / Android）+ 电脑（Web）三端共用一套数据。

> **当前阶段**：Phase 0–1 基础层构建中。功能模块将按 [计划](#实施阶段) 逐步上线。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 仓库编排 | pnpm workspace + Turborepo |
| 前端 | Expo SDK 52 + Expo Router + React Native Paper |
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

## 贡献流程

所有开发任务通过 [Linear](./doc/LINEAR.md) 管理，每个 issue 对应一条 Git 分支和一个 GitHub PR，合并前需 1 个 approve。详见 [doc/LINEAR.md](./doc/LINEAR.md)。

## 实施阶段

- **Phase 0**：Turborepo + GitHub + Linear 接入（进行中）
- **Phase 1**：脚手架 + DB schema + 认证（进行中）
- **Phase 2**：会员 + 卡业务 + 财务 skeleton（并行子 agent）
- **Phase 2.5**：订餐录入 + 扣卡 + 余额防护
- **Phase 3**：会员详情 + 部署 → **MVP 上线**
- **Phase 4+**：出餐视图 / 次日汇总 / 收工报表 / Summary / 导出 / 备份 / 域名 / EAS Build …

详见 [计划](#) 章节 25。

## 文档索引

- [业务流程图](./doc/PROCESS.md)
- [视觉规范](./doc/DESIGN.md)（RN Paper 版将在第 16 步重写）
- [Linear 使用教学](./doc/LINEAR.md)

## 许可

私有项目，未授权禁止转载 / 使用。
