# 订餐会员管理系统 — 界面设计规范 v3

> v3 于 2026-04-23 重写。主题：**毛玻璃（Glassmorphism）+ Bento 网格 + Apple/Material 融合 + 交互优先**。
> 对应代码：
> - Tokens：`apps/mobile/theme/paperTheme.ts`
> - 共享组件：`apps/mobile/components/ui/*`
> - 全站强制：**不使用任何 emoji**（包括功能图标、装饰、占位符、错误提示、状态标记）

---

## 0. 设计目标

| 目标 | 说明 |
| --- | --- |
| **一致** | 所有页面共用同一套原语（GlassSurface / BentoGrid / AppHeader / StatusChip / StatTile），颜色、圆角、间距、动效全部 token 驱动 |
| **现代** | 毛玻璃表面（backdrop-blur + 半透明 + 细描边），大圆角（16–22），柔和阴影 |
| **有节奏** | Bento 网格：不同尺寸卡片组合成一屏视觉节奏（1×1 / 2×1 / 1×2 / 2×2），重要信息自然占更大格 |
| **跨平台统一** | Apple HIG（层级 / 留白 / 系统色）+ Material 3（elevation / tonal 背景 / ripple 反馈）融合 |
| **交互优先** | 所有可点元素必有按下反馈（缩放 / 颜色 / 触觉）；关键跳转≤1次点击；关键信息在首屏 |
| **无装饰性符号** | 不使用 emoji；状态用 `@expo/vector-icons` 的 Ionicons outline + 色彩标签表达 |

---

## 1. 设计语言融合策略

### Apple HIG（取其「克制与层级」）
- 系统色板（Dynamic iOS Blue、System Grouped Background）
- SF Symbols 风格线性图标（Ionicons `-outline` 系列替代）
- 大号 Title + 小号 Caption 的强对比字体层级
- 顶部「‹ 返回」+ 居中标题 + 右侧操作的导航栏

### Material 3（取其「层与反馈」）
- Elevation 以 **tint（alpha）** 表达，而非硬阴影
- Pressable Ripple：按压时 `rgba(0,0,0,0.04)` 漫染
- Tonal Surface：表面颜色随层级微变（`glass` token 分 3 层）

### Glassmorphism（取其「质感」）
- **表面**：半透明白 `rgba(255,255,255,0.72)` + `backdrop-filter: blur(20px)`（Web）/ `BlurView` 或半透明白（Native）
- **边**：`1px solid rgba(255,255,255,0.6)` 内描边 + `rgba(0,0,0,0.04)` 外轮廓
- **背景**：页面底色使用 **Mesh Gradient**（多个柔和色斑的 `LinearGradient`），玻璃在其上才有「透」的效果

### Bento Grid（取其「节奏」）
- 12 列栅格，卡片按 `span` 占格：`col-4 / col-6 / col-8 / col-12`
- 每屏主焦点 1–2 个 `col-8+`，次要信息 `col-4`
- 行高可变，高度跟随内容（`auto`）或显式 `row-span-2`

---

## 2. 色彩系统（v3）

### 品牌与状态（保留 iOS 语义色）

| Token | HEX | 说明 |
| --- | --- | --- |
| `color.brand` | `#007AFF` | 主按钮 / 链接 / 选中 |
| `color.brandSoft` | `#E3F0FF` | 选中背景 / Tag 浅底 |
| `color.success` | `#34C759` | 已送达 / 进行中 |
| `color.warning` | `#FF9500` | 余额告警 / 午餐标签 |
| `color.danger` | `#FF3B30` | 删除 / 取消 |
| `color.info` | `#5856D6` | 晚餐标签 / 辅助提示 |

### 文字

| Token | HEX | 用途 |
| --- | --- | --- |
| `text.primary` | `#1C1C1E` | 主文字 |
| `text.secondary` | `#3A3A3C` | 副标题 |
| `text.tertiary` | `#8E8E93` | 说明文字 |
| `text.quaternary` | `#C7C7CC` | 辅助 / 占位 |
| `text.inverse` | `#FFFFFF` | 在强调色底上的文字 |

### 背景（Mesh + Glass）

| Token | 值 | 用途 |
| --- | --- | --- |
| `bg.mesh` | 多点柔和渐变（详见 §3） | 页面底 |
| `glass.surface1` | `rgba(255,255,255,0.72)` | 主表面（Bento 卡 / Modal） |
| `glass.surface2` | `rgba(255,255,255,0.56)` | 嵌套表面（卡内分区） |
| `glass.surface3` | `rgba(255,255,255,0.40)` | 最内层 / 输入框 |
| `glass.border` | `rgba(255,255,255,0.6)` | 玻璃内边 |
| `glass.outline` | `rgba(0,0,0,0.06)` | 玻璃外轮廓 |
| `glass.tint.info` | `rgba(0,122,255,0.12)` | 品牌色玻璃 |
| `glass.tint.warn` | `rgba(255,149,0,0.12)` | 警告玻璃 |
| `glass.tint.ok` | `rgba(52,199,89,0.12)` | 成功玻璃 |

### Status Chip（统一配色）

| 状态 | Token | 前景 / 背景 |
| --- | --- | --- |
| 等待出餐 | `chip.pending` | `#FF9500` / `#FFF4E5` |
| 已出餐 | `chip.fulfilled` | `#007AFF` / `#E3F0FF` |
| 已送达 | `chip.delivered` | `#34C759` / `#E8F8ED` |
| 已取消 | `chip.cancelled` | `#8E8E93` / `#F2F2F7` |
| 院内 | `chip.hospital` | `#007AFF` / `#E3F0FF` |
| 院外 | `chip.regular` | `#34C759` / `#E8F8ED` |
| 午餐 | `chip.lunch` | `#FF9500` / `#FFF8E1` |
| 晚餐 | `chip.dinner` | `#5856D6` / `#F0F0FF` |

---

## 3. Mesh 背景

默认页面底层放一块全屏 Mesh Gradient，让玻璃面有通透感。

```
bg.mesh =
  LinearGradient(
    colors=[#F2F6FF, #FFF7F0, #F0FFF4],
    locations=[0, 0.5, 1],
    angle=135°,
  )
  + 3 个 RadialGradient 光斑：
    · 左上 rgba(0,122,255,0.10)  半径 40%
    · 右上 rgba(52,199,89,0.08)  半径 35%
    · 右下 rgba(255,149,0,0.08)  半径 35%
```

实现细节见 `apps/mobile/components/ui/MeshBackground.tsx`。不支持径向渐变的平台降级为三段 LinearGradient。

---

## 4. 字体层级

字体栈：`system-ui, -apple-system, "SF Pro Display", "PingFang SC", "Helvetica Neue", sans-serif`

| 层级 | Size / LH | Weight | 用途 |
| --- | --- | --- | --- |
| `type.display` | 34 / 40 | 700 | 大标题（少用） |
| `type.title1` | 28 / 34 | 700 | 页面主标题 / 问候语 |
| `type.title2` | 22 / 28 | 700 | 分区标题 |
| `type.title3` | 20 / 26 | 600 | Bento 大卡标题 |
| `type.headline` | 17 / 22 | 600 | 列表主文字 |
| `type.body` | 15 / 20 | 400 | 正文 |
| `type.callout` | 16 / 22 | 600 | 主按钮 |
| `type.footnote` | 13 / 18 | 400 | 辅助说明 |
| `type.caption` | 12 / 16 | 500 | Chip / 时间戳 / 标签 |

数字与金额一律 `fontVariant: ['tabular-nums']`。

---

## 5. 圆角、阴影、模糊

| Token | 值 |
| --- | --- |
| `radius.xs` | 6 |
| `radius.sm` | 10 |
| `radius.md` | 14 |
| `radius.lg` | 18 |
| `radius.xl` | 22 |
| `radius.pill` | 999（仅 chip / badge）|
| `shadow.card` | `0 2 12 rgba(0,0,0,0.06)` |
| `shadow.raised` | `0 4 24 rgba(0,0,0,0.10)` |
| `shadow.modal` | `0 16 48 rgba(0,0,0,0.18)` |
| `blur.glass` | 20px（Web `backdrop-filter`；Native `expo-blur` 或半透明降级）|

---

## 6. 间距（4pt 基准）

常用：`4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 56`

- 页面水平外边距：`16`（手机）/ `24`（平板+）
- Bento 卡内边距：`18`
- 卡内「分区」间距：`16`
- 内容最大宽度：`720`（桌面/平板居中）

---

## 7. Bento Grid 规范

```
<BentoGrid cols={12} gap={12}>
  <Bento span={8}>主入口 · 会员档案</Bento>
  <Bento span={4}>速览 · 待出餐</Bento>
  <Bento span={4}>速览 · 今日收入</Bento>
  <Bento span={4}>速览 · 今日支出</Bento>
  <Bento span={4}>速览 · 净额</Bento>
  <Bento span={6}>操作 · 财务记账</Bento>
  <Bento span={6}>操作 · 当前用户</Bento>
</BentoGrid>
```

- `span` 在手机（<480px）自动升到 `min(12, span*2)`，即 `4→8`，`6→12`
- 每个 `<Bento>` 默认是一块 `GlassSurface`
- 高度由内容决定，也可传 `rowSpan` 做宽矮/高窄变化
- 卡片内容 **水平居中**（`alignItems: 'center'`），数字用等宽

---

## 8. 核心共享组件

全部位于 `apps/mobile/components/ui/`。每个组件必须：
- 支持 `style` / `children` 透传
- 无硬编码颜色，只用 token
- 有 Press 反馈（若可点）

| 组件 | 职责 |
| --- | --- |
| `MeshBackground` | 全屏 mesh gradient + 顶部光斑 |
| `GlassSurface` | 毛玻璃卡片（web `backdrop-filter` / native 半透明白 + 内描边） |
| `BentoGrid` / `Bento` | 12 列 bento 布局 |
| `AppHeader` | 统一顶部栏：`‹ 返回` + 居中标题 + 右侧操作槽 |
| `SectionLabel` | 分组小标题（大写、灰、小） |
| `StatTile` | 速览格：label + value + 趋势色 |
| `StatusChip` | 统一状态标签（pending / delivered …） |
| `PrimaryButton` / `SecondaryButton` / `GhostButton` | 三种按钮 |
| `IconAvatar` | 圆角方形 icon 块（替代 emoji 头像） |

---

## 9. 交互 / 动效

| 场景 | 反馈 |
| --- | --- |
| 卡片按下 | `opacity: 0.92` + `scale: 0.985`（Reanimated spring） |
| 列表行按下 | `backgroundColor: rgba(0,0,0,0.04)` 渐变 80ms |
| 主按钮按下 | 亮度 −6%（Web `filter`；Native `backgroundColor` 插值） |
| 危险按钮 | 触觉 `Haptics.notificationAsync(Warning)` + 二次确认 |
| 模态出场 | `animationType="slide"`，`presentationStyle="formSheet"` |
| 页面切换 | `stack_animation: slide_from_right`（iOS）/ `fade_from_bottom`（Android） |
| 骨架屏 | 未加载内容使用 `glass.surface2` + 轻脉动 |

> 所有 destructive 操作必须 `Haptics.notificationAsync(WarningFeedback)`；Web 上无触觉退化为 `window.confirm`。

---

## 10. 无 emoji 规则（硬约束）

- **状态**：用 `StatusChip`（文字 + 色彩 + 小圆点），不用表情符号
- **午/晚餐**：文字 `午`/`晚` + Chip 颜色区分，不用太阳/月亮
- **警告**：`alert-circle-outline`（Ionicons），不用 `⚠️`
- **搜索**：`search-outline`（Ionicons），不用 `🔍`
- **关闭**：`close-outline`（Ionicons），不用 `✕`
- **空状态**：居中文字 + `information-circle-outline`，不用 `📋`
- **箭头**：`chevron-forward`（Ionicons），不用 `›`（ASCII 字符）

---

## 11. 各页版式（Bento 具体排布）

### 11.1 主界面（Dashboard）
```
Row 1  [ 问候 / 日期（col-12，无 surface） ]
Row 2  [ StatTile×4（每个 col-3）——今日收入 / 支出 / 净额 / 余餐不足 ]
Row 3  [ 会员档案 col-6 | 每日订餐 col-6 ]
Row 4  [ 财务记账 col-6 | 当前用户 col-6 ]
```
手机折叠后：`col-3→col-6`（一行两个），`col-6→col-12`（堆叠）。

### 11.2 会员列表
```
Header [AppHeader(会员档案, +新增)]
Row 1  [ 搜索 col-12 ]
Row 2  [ 全部/院内/院外 Chip 组 col-12 ]
Row 3  [ FlatList of GlassCard rows ]
```

### 11.3 会员详情
```
Header [AppHeader(会员详情, 编辑)]
Row 1  [ IconAvatar + 姓名 + 昵称 + StatusChip（col-12） ]
Row 2  [ 联系方式 col-12 · iOS 设置页样式 ]
Row 3  [ 当前卡 col-8 | 累计统计 col-4（StatTile×3 竖排） ]
Row 4  [ 历史卡片（col-12 列表） ]
```

### 11.4 每日订餐
```
Header [AppHeader(每日订餐)]
Row 1  [ StatTile×4（午/晚/待出/总计，col-3） ]
Row 2  [ 餐别 Chip（col-6）| 状态 Chip（col-6） ]
Row 3  [ SectionList（午/晚分组） ]
```

### 11.5 财务记账
```
Header [AppHeader(财务记账)]
Row 1  [ 总收入 col-4 | 总支出 col-4 | 净额 col-4 ]
Row 2  [ 筛选条 col-12 ]
Row 3  [ 明细列表 col-12 ]
FAB    [ +新增支出（右下浮动） ]
```

### 11.6 余餐不足提醒
```
Header [AppHeader(余餐不足提醒)]
Row 1  [ 说明横幅 col-12（warn tint） ]
Row 2  [ 会员列表 col-12 ]
```

### 11.7 登录
```
Center  [ Logo（IconAvatar 大号） + 标题 + 副标题 ]
        [ GlassSurface col-12 maxWidth 360 ]
          [ 用户名 · 密码 ]
          [ PrimaryButton 登录 ]
```

---

## 12. 响应式断点

| 断点 | 宽度 | 版式 |
| --- | --- | --- |
| `xs` | < 480 | 手机：Bento `span` 全部升格；maxWidth 无限制 |
| `sm` | 480–767 | 小平板：维持 Bento 原 span；内容最大 520 居中 |
| `md` | 768–1023 | 平板：maxWidth 720 |
| `lg` | ≥ 1024 | 桌面：maxWidth 960，Bento 可用 12 列完整 |

---

## 13. 禁止清单（v3）

- 禁止任何 emoji / Unicode 表情（不含情感符号）
- 禁止纯色实心无圆角矩形
- 禁止使用系统默认 `Alert`（Web 无法正确弹出），统一 `lib/confirm.ts`
- 禁止硬编码色值（必须走 token）
- 禁止在 Bento 卡内再嵌套 Bento（嵌套玻璃会模糊过度）
- 禁止同屏 >2 种强调色（除 StatusChip 外）

---

## 14. 实现技术栈

- **UI 基础**：React Native 0.74 + React Native Paper 5（MD3 主题）+ React Native Web
- **图标**：`@expo/vector-icons`（Ionicons outline 为主，MaterialCommunity 备选）
- **渐变**：`expo-linear-gradient`（Mesh 实现）
- **毛玻璃**：Web 使用 CSS `backdrop-filter`；Native 使用 `expo-blur`（后续引入）或半透明降级
- **动效**：`react-native-reanimated` 的 `withSpring` + `Pressable` 按下反馈
- **触觉**：`expo-haptics`（已集成）
- **路由**：`expo-router` file-based

---

## 15. 迁移检查表（从 v2 → v3）

每个页面 PR 合并前必须通过：

- [ ] 所有 emoji 已移除（grep 检查）
- [ ] 顶部栏统一使用 `<AppHeader />`
- [ ] 表面统一使用 `<GlassSurface />`，不再裸 `backgroundColor: '#fff'`
- [ ] 所有状态标签使用 `<StatusChip />`
- [ ] 所有按钮使用 `<PrimaryButton />` / `<SecondaryButton />` / `<GhostButton />`
- [ ] 主要信息用 `<BentoGrid>` 组织
- [ ] 可点元素按下有 `scale` 或 `opacity` 反馈
- [ ] 破坏性操作走 `confirmDestructive` + Haptics
- [ ] 数字使用 `fontVariant: ['tabular-nums']`
- [ ] 内容在宽屏居中（`maxWidth + alignSelf`）
