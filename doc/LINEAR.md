# Linear 任务管理指南

本项目使用 [Linear](https://linear.app) 管理所有开发任务。每一个 Linear issue 对应**一个 Git 分支 + 一个 GitHub PR**，合并前必须审核。

## 1. 为什么选 Linear

- 界面清爽、快捷键驱动（键盘党友好）
- 原生支持 GitHub 集成：**PR 标题带 issue ID（如 `MEA-12`）会自动关联，合并时自动 close**
- 免费层（Free）：**无限用户 / 无限 issue / 最近 250 条活动历史**，对这个项目够用
- 有 CLI（`linear` npm 包）和 SDK，后期可自动化

## 2. 账号与工作区初始化

### 2.1 注册

1. 打开 <https://linear.app> → `Sign up with Google` 或邮箱
2. 创建 Workspace（建议名：`meal-membership`）
3. 选择 `Free` 计划
4. 跳过"邀请队友"（后期 admin 再把 4 位员工加进来）

### 2.2 Team 与 Project

Linear 的层级：`Workspace → Team → Project → Issue`。

- **Team**：建一个 team，名字 `Meal`，标识符自动是 `MEA`（后续 issue ID 会是 `MEA-1 / MEA-2 ...`）
- **Project**：建一个 Project `MVP Sprint`（用于首周冲刺），之后可以新建 `v1.1 — 出餐视图` / `v1.2 — 接龙汇总` 等

### 2.3 GitHub 集成（必做）

1. 进入 `Settings → Integrations → GitHub → Connect`
2. 授权访问 GitHub 仓库（`meal-membership` 或你的 repo 名）
3. 勾选：
   - 自动识别 PR 标题 / 分支名里的 issue ID（如 `MEA-12`）
   - PR 合并时自动把对应 issue 状态置为 `Done`
   - 在 Linear 里显示 PR 的 CI 状态

完成后，Linear 里每个 issue 页面会显示关联的 PR 和 CI。

## 3. 工作流状态

我们用 Linear 默认的 5 态工作流即可：

| 状态 | 含义 | 触发 |
| --- | --- | --- |
| `Backlog` | 待规划 | 新建 issue 默认状态 |
| `Todo` | 已规划、排期内，未动工 | 人工移动 |
| `In Progress` | 正在写代码 | 分支创建 / 开始工作时移动 |
| `In Review` | PR 已开，等审核 | PR 开启时 Linear 自动转（GitHub 集成触发） |
| `Done` | 已合入 main | PR 合并时 Linear 自动转 |

额外：`Canceled` 用于作废任务，`Duplicate` 标重复。

## 4. Issue 模板

每一个 issue 都按以下模板写，便于后续审查追溯：

```markdown
## 目标
用 1 句话描述这个 issue 要解决什么问题。

## 验收标准
- [ ] 条件 1（可勾选，达到即打勾）
- [ ] 条件 2
- [ ] 类型检查通过 `pnpm typecheck`
- [ ] 本地手动走一遍关键路径

## 技术方案
具体实现思路、涉及的文件、要改的表、要加的 API。

## 测试用例
1. 场景 A：……
2. 场景 B：……

## 关联
- plan 章节：§6.2 卡业务
- PROCESS.md：§4 卡状态机
- Blocked by: MEA-3（上一张 issue）
```

Linear 支持 issue 模板：`Settings → Templates` 里保存成模板，新建 issue 时选 `Feature` 模板即可。

## 5. 分支命名约定

从 main 拉分支，名字严格按：

```
<type>/<linear-id>-<kebab-case-短描述>
```

例子：

- `feat/MEA-12-member-crud`
- `feat/MEA-15-card-upgrade`
- `fix/MEA-23-remaining-meals-negative`
- `chore/MEA-30-upgrade-drizzle`
- `docs/MEA-40-readme-zh`

`type` 取值：`feat / fix / chore / docs / refactor / test / perf`（对齐 Conventional Commits）。

**Linear 自带"复制分支名"按钮**：打开 issue → 右侧 `Copy git branch name` → 已经是 `yourname/mea-12-member-crud` 格式，直接 `git checkout -b` 粘贴即可。

## 6. Commit 与 PR 规范

### Commit

走 Conventional Commits（一行 ≤ 72 字符）：

```
feat(members): 加微信号字段与手机号去重提示

- 为 Member schema 添加 wechat_id 字段
- 新建会员时 API 先按 phone 查重，前端弹 Dialog 让用户选跳转/继续
- 搜索框同时匹配 wechat_id

Closes MEA-12
```

末行 `Closes MEA-12` 让 Linear 在合并时把 issue 转为 `Done`。

### PR

PR 标题一定包含 issue ID：

```
feat(members): MEA-12 加微信号 + 手机号去重
```

PR body 模板（`.github/pull_request_template.md` 里放一份，新建 PR 自动填）：

```markdown
## 关联
Closes MEA-12

## 改动
- 新加 …
- 重构 …
- 修复 …

## 测试
- [ ] `pnpm typecheck`
- [ ] 本地手动跑通：登录 → 新建会员（含微信号）→ 搜索 → 详情页能看到
- [ ] 边界：重复手机号弹 Dialog 行为正确

## 截图 / 录屏
（贴图，Expo 录一个 20 秒 GIF）
```

### 审核 / 合并

- 所有 PR 必须**至少 1 个 approve** 才能合并（GitHub 分支保护开启）
- 除 hotfix 外，**禁止直接 push 到 main**
- 合并策略：**Squash and merge**（保证 main 历史干净，一个 PR 一条 commit）

## 7. 多人 / 多 agent 并行策略

- 一个 issue = 一条分支 = 一个 worktree = 一个 agent（如需要）
- 新建 worktree 的命令：
  ```
  git worktree add ../meal-MEA-12 feat/MEA-12-member-crud
  cd ../meal-MEA-12
  pnpm install
  ```
- 不同 worktree 独立编辑，彼此不打架；写完 push + 开 PR 回主仓审核
- 多 agent 并行前须确认**依赖前置 issue 已合入 main**（避免 rebase 冲突）

## 8. 每日同步（可选但推荐）

- 每晚在 Linear 里把当天完成的 issue 拖到 `Done`、新规划的拖到 `Todo`
- 周一在 Project 页看一眼 `MVP Sprint` 的进度条
- 任何 blocker 直接评论在 issue 里 @ admin

## 9. 常见操作速查

| 操作 | 快捷键 / 路径 |
| --- | --- |
| 新建 issue | `C` |
| 筛选 | `F` |
| 打开命令面板 | `Cmd/Ctrl + K` |
| 复制分支名 | `Cmd/Ctrl + Shift + .`（在 issue 页） |
| 切换状态 | 选中后按数字（1=Backlog、2=Todo、3=In Progress …） |
| 指派给自己 | `I` |
| 加 label | `L` |

## 10. 常见问题

- **Q: GitHub 集成没生效？** A: `Settings → Integrations → GitHub → Reinstall`；确保 PR 标题或分支名里有完整的 `MEA-XX` 字样
- **Q: Issue 太多怎么找？** A: 用 `Views` 建自定义视图（比如"我负责 + In Progress"）
- **Q: 能导出吗？** A: Free 层只能导 CSV；Pro 层才有完整 API 历史导出

## 11. 本地规格 ↔ Linear 云端对齐

仓库内 [`scripts/src/linear-issues.ts`](../scripts/src/linear-issues.ts) 是 issue 的**本地事实**：`title / state / priority / labels / body` 五字段。[`scripts/src/sync-linear.ts`](../scripts/src/sync-linear.ts) 以 `title` 为键做幂等 upsert（已存在 → `issueUpdate`，不存在 → `issueCreate`）。

### 何时更新本地规格

- 一条 PR 合入 `main` 后，若对应 issue 的 `state` 在 [`linear-issues.ts`](../scripts/src/linear-issues.ts) 里仍是 `'Backlog'` / `'Todo'` / `'InProgress'`，改成 `'Done'`，并把 body 里的 `- [ ]` 按实际情况改成 `- [x]`。
- 只要改了 body / priority / labels，也建议同步改本地规格，避免下次 `sync-linear` 把云端覆盖成旧版本。

### 当 Linear 云端与 `main` 不一致时

1. 以 **`main`** 为真相（代码事实）。
2. 用 `git log --oneline --all | grep -iE 'MEA-[0-9]+'` 核对 commit 关联的 issue。
3. 改 [`scripts/src/linear-issues.ts`](../scripts/src/linear-issues.ts) 的 `state` → 跑 `LINEAR_API_KEY=lin_api_xxx pnpm --filter @meal/scripts sync-linear` 把变更推到云端，或直接在 Linear UI 拖动状态。
4. 若 PR 合并了但 Linear 仍非 Done：多半是 PR 标题没带 `MEA-XX` 或 `Closes MEA-XX`，去 Settings → Integrations → GitHub → Reinstall，并修 PR 描述补 `Closes MEA-XX`。

### sync-linear 的幂等约定

- **按 title 去重**：修标题等于新建 issue；想改标题请先在 Linear 改，再回写本地规格。
- `state` 支持 `Backlog / Todo / InProgress / InReview / Done / Canceled`；其余值会被脚本拒绝。
- `labels` 缺失会被脚本自动创建。
