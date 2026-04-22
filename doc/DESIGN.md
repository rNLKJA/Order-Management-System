# 订餐会员管理系统 — 界面设计规范

> **[过期提示] 本文档为 Tailwind / HTML 阶段的旧版，技术栈已切换到 Expo + React Native Paper，将在实施第 16 步"主题 + design.md 重写"一次性翻新。**
>
> **仍然有效的部分**（设计语言基线，翻新时必须保留）：
> - 淡蓝 `sky-500` 作主色（HEX `#0EA5E9`）+ `slate` 中性色 + 柔和档状态色（`emerald / amber / rose / sky`）
> - 圆角 8–12px，禁胶囊形状（`rounded-full`）
> - **全站禁止 emoji**
> - 中文界面；金额 `¥1,234.00`；日期 `YYYY-MM-DD`；份数 `10 餐 / 剩余 4 餐`
> - 数字列 `tabular-nums` 等宽对齐
> - 主操作按钮每页唯一；危险操作二次确认；Modal 键盘关闭 / 主按钮回车提交
>
> **已过期的部分**（第 16 步会整体替换）：
> - 所有 Tailwind token 和 class 写法（`text-2xl` / `rounded-xl` / `p-4` / `gap-6` ...）—— React Native 没有 class，要改 Paper `configureFonts` + `theme.roundness` + `StyleSheet` 数值
> - HTML 组件示例（`<div class="..."`）—— 要改 Paper 组件（`<Card> / <DataTable> / <Chip> / <Portal><Dialog> / <Menu> / <Appbar>`）
> - 桌面"顶部条 + 侧栏 220px"单一布局 —— 要补 **mobile < 768 底部 Tab（含出餐入口）** / **tablet 768–1023 Drawer + 2 列** / **desktop ≥ 1024 Drawer + 4 列** 三套
> - Lucide 图标 —— 要换 `@expo/vector-icons` 的 `MaterialCommunityIcons`
> - 导出放在顶部条 —— 新方案导出是独立 `/export` 页
> - Badge 色表缺：订单 4 种状态（`等待出餐 / 已出餐 / 已送达（锁）/ 已取消`）、餐别 2 种（`午 / 晚`）、配送区 2 种（`院内 / 院外`）
> - 页面样板缺 5 张：**次日接龙汇总 / 今日收工报表 / 移动 Summary（日周月年 + 基准线）/ 出餐工作流（4 Tab + 双 Chip，手机专用）/ 导出页（日期范围选择器）**
>
> **使用约定**：
> - 实施第 5–15 步若需参考颜色 / 圆角 / 字号基线，可临时参考本文档的数值
> - 所有 Tailwind / HTML 细节一律忽略，以最终 React Native Paper 实现为准
> - 第 16 步完成后，本警告会被移除，整份文档重写

---

本文档定义系统前端的视觉与交互规范。实施时所有页面、组件、文案必须与本规范一致，避免随性改动。

## 1. 设计原则

- **清爽**：大面积留白，低信息密度，单页同时呈现的数据块不超过 5 个
- **沉稳**：淡蓝作为主色，避免高饱和度 / 强对比 / 霓虹色
- **专业**：几何化圆角（统一 8–12px），细边框 + 弱阴影替代重边框
- **纯文字 + 线性图标**：**全站禁止使用 emoji**；图标使用 Lucide（线性风、细描边），作为视觉辅助而非装饰
- **中文界面**：所有可见文案中文；数字 / 单位保持半角（10 餐、¥280）；时间用 `YYYY-MM-DD`；金额用 `¥` 前缀 + 千分位
- **键盘友好**：表单可 Tab 穿梭，Modal 支持 Esc 关闭，主操作按钮 Enter 提交

## 2. 色彩系统（Tailwind 约定）

主色沿用 Tailwind 的 `sky` 色阶（淡蓝），强调色用 `slate` 中性灰，状态色取默认语义色的"柔和档"。

### 主色

| 用途 | Tailwind Token | HEX | 说明 |
| --- | --- | --- | --- |
| Primary / 品牌色 | `sky-500` | `#0EA5E9` | 主操作按钮、活跃导航、链接 |
| Primary-hover | `sky-600` | `#0284C7` | 主按钮悬停 |
| Primary-soft / 背景点缀 | `sky-50` | `#F0F9FF` | Hero 区域、选中背景、标签底色 |
| Primary-border | `sky-200` | `#BAE6FD` | 选中态描边、信息卡左侧竖条 |
| Focus ring | `sky-400` | `#38BDF8` | 表单聚焦 / 键盘焦点 |

### 中性色（文字与边框）

| 用途 | Token | HEX |
| --- | --- | --- |
| 页面背景 | `slate-50` | `#F8FAFC` |
| 卡片背景 | `white` | `#FFFFFF` |
| 一级文字 | `slate-900` | `#0F172A` |
| 二级文字 | `slate-600` | `#475569` |
| 辅助文字 / 占位 | `slate-400` | `#94A3B8` |
| 分隔线 / 细边框 | `slate-200` | `#E2E8F0` |
| 表格斑马纹 | `slate-50` | `#F8FAFC` |

### 状态色（柔和档）

| 语义 | 文字 | 背景（Badge / Banner） | 边框 |
| --- | --- | --- | --- |
| 成功 | `emerald-700` | `emerald-50` | `emerald-200` |
| 警告（续卡提醒） | `amber-700` | `amber-50` | `amber-200` |
| 错误 / 危险操作 | `rose-700` | `rose-50` | `rose-200` |
| 信息 | `sky-700` | `sky-50` | `sky-200` |

状态色**仅用于** Badge、Banner、表格行左侧色条；按钮语义（主/次/危险）走主色+中性色体系。

## 3. 字体与字号

- 字体栈：`'PingFang SC', 'HarmonyOS Sans SC', 'Microsoft YaHei', 'Inter', system-ui, sans-serif`
- 数字强制 `font-variant-numeric: tabular-nums`（金额、份数列对齐）
- 基础字号 14px；行高 1.6

| 层级 | class | 字号 / 行高 | 使用场景 |
| --- | --- | --- | --- |
| H1 页面主标题 | `text-2xl font-semibold tracking-tight` | 24 / 32 | 每页顶部唯一 |
| H2 分区标题 | `text-lg font-semibold` | 18 / 28 | 卡片标题、面板区域 |
| H3 子标题 | `text-base font-medium` | 16 / 24 | 表格章节 |
| Body 正文 | `text-sm` | 14 / 22 | 默认 |
| Caption 辅助 | `text-xs text-slate-500` | 12 / 18 | 备注、说明 |
| Metric 面板数字 | `text-3xl font-semibold tabular-nums` | 30 / 36 | 顶部统计卡片 |

## 4. 圆角与阴影

几何风，**统一 8–12px**，避免胶囊形状（按钮保持 8px，不用 `rounded-full`）。

| 组件 | 圆角 | 阴影 |
| --- | --- | --- |
| 按钮 | `rounded-lg`（8px） | 无 |
| 输入框 / 下拉 | `rounded-lg`（8px） | 无（focus 时加 ring） |
| 卡片 / 面板 | `rounded-xl`（12px） | `shadow-sm` + `border border-slate-200` |
| Modal | `rounded-2xl`（16px） | `shadow-xl` |
| Badge / Tag | `rounded-md`（6px） | 无 |
| 头像 | `rounded-lg`（8px，方圆） | 无，**不使用 `rounded-full` 圆形头像** |

## 5. 间距网格

全站遵循 4px 基础网格。常用间距：

- 组件内部：`p-3`（12）/ `p-4`（16）/ `p-6`（24）
- 组件之间：`gap-3`（12）/ `gap-4`（16）/ `gap-6`（24）
- 页面主内边距：`px-6 py-6`（侧栏容器 `px-8 py-8`）
- 卡片内标题与内容：`mb-4`

## 6. 布局骨架

```
+-------------------------------------------------------------+
|  顶部条（高 56px）                                           |
|  Logo/文字标  |          主菜单（水平）       |  搜索 / 导出 |
+-------------+------------------------------------------------+
|             |                                                |
|  侧栏 220px |   页面主内容                                   |
|  - 面板     |   1) 页面标题（H1）                            |
|  - 会员     |   2) 操作条（右侧主按钮）                      |
|  - 卡片     |   3) 指标卡片区（4 列或 3 列）                 |
|  - 订餐     |   4) 主内容表格 / 图表                         |
|  - 财务     |                                                |
|  - 备份     |                                                |
|  - 设置     |                                                |
+-------------+------------------------------------------------+
```

- 页面最大宽度 1440px，居中
- 侧栏固定宽 220px，顶部条固定高 56px
- 当前活跃菜单项：`bg-sky-50 text-sky-700 border-l-2 border-sky-500`，其他项 `text-slate-600 hover:bg-slate-50`

## 7. 组件规范

### 按钮

| 类型 | 样式 | 使用 |
| --- | --- | --- |
| Primary | `bg-sky-500 hover:bg-sky-600 text-white rounded-lg px-4 h-9 text-sm font-medium` | 每个页面 / Modal 最多一个（保存、提交、确认） |
| Secondary | `bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg px-4 h-9` | 次要操作（取消、返回、刷新） |
| Ghost | `text-slate-600 hover:bg-slate-100 rounded-lg px-3 h-8` | 表格行内操作 |
| Danger | `bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-lg px-4 h-9` | 删除确认（二次弹窗） |
| IconBtn | `h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-slate-100` | 图标按钮，`aria-label` 必填 |

按钮禁用态：`opacity-50 cursor-not-allowed`。

### 输入框 / Select / Textarea

- 高 36px（`h-9`）；圆角 `rounded-lg`
- 常态：`border border-slate-200 bg-white`
- Focus：`outline-none ring-2 ring-sky-400/40 border-sky-400`
- 错误：`border-rose-300 ring-2 ring-rose-200`，下方 `text-xs text-rose-600` 错误文案
- Label 放在输入框上方（`text-sm text-slate-700 mb-1`），必填加 `*`（红）

### 卡片 / 面板

```
<div class="rounded-xl border border-slate-200 bg-white shadow-sm">
  <div class="px-6 py-4 border-b border-slate-100">
    <h2 class="text-lg font-semibold text-slate-900">...</h2>
  </div>
  <div class="p-6">...</div>
</div>
```

### 指标卡（Metric Card）

- 白底、`rounded-xl`、`border-slate-200`、`shadow-sm`
- 结构：顶部一行小标题（`text-sm text-slate-500`）+ 中部大数字（`text-3xl font-semibold`）+ 底部环比或说明（`text-xs text-slate-500`）
- 左侧可加 2px 淡蓝竖条 `border-l-2 border-sky-500`（仅主数据卡使用）
- **不使用 emoji 或装饰性图标填充**

### 表格

- 表头 `bg-slate-50 text-slate-600 text-xs font-medium uppercase tracking-wide`
- 单元格 `py-3 px-4 text-sm`
- 行分隔：`divide-y divide-slate-100`（不要在每行画粗边）
- 悬停：`hover:bg-sky-50/40`
- 数字列右对齐、等宽字体
- 空态：居中展示一行说明 + 一个次级按钮（"新增第一条"），不使用插图占位

### Badge（状态）

| 状态 | class |
| --- | --- |
| 进行中 | `bg-sky-50 text-sky-700 border border-sky-200` |
| 已用完 | `bg-slate-100 text-slate-600 border border-slate-200` |
| 已升级 | `bg-emerald-50 text-emerald-700 border border-emerald-200` |
| 待续卡 | `bg-amber-50 text-amber-700 border border-amber-200` |

统一 `rounded-md px-2 py-0.5 text-xs font-medium`。

### Modal

- 遮罩：`bg-slate-900/40 backdrop-blur-sm`
- 面板：`max-w-lg w-full rounded-2xl bg-white shadow-xl`
- 顶部 `px-6 py-4 border-b border-slate-100` 含标题 + 关闭按钮
- 主体 `px-6 py-5`
- 底部操作条 `px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-2`
- 支持 Esc 关闭；`primary` 按钮默认聚焦；打开时背景禁止滚动

### 搜索 / Autocomplete

- 顶部条右侧提供全局会员搜索（UID / 姓名 / 昵称 / 手机）
- 下拉项：姓名加粗 + UID 淡色 + 右侧剩餐 Badge
- 键盘：↑↓ 切换、Enter 选中、Esc 关闭

### 复选框（医院订阅切换）

- 使用原生 checkbox 配 Tailwind：`h-4 w-4 rounded border-slate-300 text-sky-500 focus:ring-sky-400`
- 标签放右侧：`医院订阅（院内价格表）`
- 切换后价格表立即重渲染，不需要二次确认

## 8. 核心页面样板

### 8.1 面板（Dashboard）

- 顶部 4 个指标卡：总会员数 / 今日用餐 / 待续卡 / 本月净额
- 中部两栏：左 2/3 是近 7 日用餐趋势柱状图；右 1/3 是收入分类饼图（院内 / 院外 / 散餐）
- 下部「续卡提醒」表：剩餐 ≤ 2 的会员列表，最右操作列有「升级」「录入用餐」链接按钮

### 8.2 会员列表

- 顶部操作条：左侧搜索框，右侧「新增会员」主按钮 + 「导出 Excel」次按钮
- 表格列：UID / 姓名 / 昵称 / 手机 / 类型（院内/院外 Badge）/ 当前卡种 / 剩余餐 / 操作
- 点击行进入会员详情

### 8.3 会员详情

- 顶部：姓名 + UID + 医院订阅 checkbox
- 第一排三个指标卡：当前剩餐 / 累计购买餐数 / 累计消费餐数
- "当前卡"面板：卡种名、进度条（已用/总）、到账金额、购买日期
- "开卡记录"表：购卡日期 / 卡种 / 总餐 / 已用 / 剩余 / 金额 / 状态（Badge）
- 右上操作：无 active 卡时 `购买新卡`；有 active 卡时 `升级卡种` + `录入用餐`

### 8.4 购卡 / 升级 Modal

- 顶部医院订阅复选框（切换左右两列价格表）
- 价格卡列表（4 列网格）：卡种名 + 餐数 + 单价 + 总价；选中态 `ring-2 ring-sky-400 bg-sky-50 border-sky-300`
- 升级模式下不可用的更低等级卡显示为灰色（`opacity-50 cursor-not-allowed`），悬停 tooltip 提示"不支持降级"
- 底部汇总行：应收 / 升级需补差 / 升级后剩餐
- 右下角主按钮：`确认购买` / `确认升级`

### 8.5 每日订餐

- 页面上半：今日用餐列表（按扣卡 / 散餐分组），每行展示会员 + 份数 + 扣减后剩餐
- 页面下半：「快速录入」Modal 入口 + 「批量录入」表格（一行一个会员，直接填份数）
- 扣到剩餐 0 时行内出现琥珀色 Banner「已用完，提醒续卡」

### 8.6 财务

- 三个指标卡：本月收入 / 本月支出 / 本月净额
- 分类小计条：院内订阅 / 院外订阅 / 散餐 / 手动支出
- 明细表：日期 / 类型 / 分类 Badge / 金额 / 备注 / 来源（auto/manual）
- 右上角：「新增支出」主按钮、「导出 Excel」次按钮
- 筛选区：日期区间、类型、分类

## 9. 可访问性与国际化

- 所有图标按钮必须带 `aria-label`
- 所有表单控件必须有关联 `<label>`
- 关键操作（升级、删除）必须二次确认
- 文案统一使用中文，数字 / 日期 / 金额格式：
  - 金额：`¥1,000.00`
  - 日期：`2026-04-21`
  - 时间：`2026-04-21 14:30`
  - 份数：`10 餐`、`剩余 4 餐`

## 10. 禁止清单

- 禁止使用 emoji（在标题、按钮、提示、占位、错误等任何位置）
- 禁止彩色插画、装饰性 3D 元素、渐变光效
- 禁止 `rounded-full` 按钮（除非是 4×4 以下的状态圆点）
- 禁止同一页面出现两种主色按钮
- 禁止使用对话气泡、贴纸感的边框
- 禁止超过 3 种状态色同屏并列
- 禁止彩色表头（表头仅使用 `slate-50` 或白色）
