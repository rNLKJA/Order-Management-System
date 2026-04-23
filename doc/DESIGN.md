# 订餐会员管理系统 — 界面设计规范 v2

> v2 于 2026-04-23 重写，全面适配 **React Native Paper MD3 + iOS 设计语言**。
> 对应代码：`apps/mobile/theme/paperTheme.ts`

---

## 1. 设计原则

| 原则 | 说明 |
| --- | --- |
| **iOS 风格** | 参照 Apple Human Interface Guidelines（HIG）——系统灰底、白卡、圆角、细边框 |
| **清爽** | 大量留白，每页焦点≤3个；所有文案中文；**全站禁止 emoji 滥用**（仅装饰性图标场景允许）|
| **沉稳** | 动态蓝（#007AFF）为唯一强调色，避免高饱和度对比 |
| **现代几何** | 卡片 16px 圆角、按钮 14px 圆角、小标签 8px；**禁止胶囊形（rounded-full）** |
| **可访问性** | 文字对比度 ≥ 4.5:1；关键操作有触觉反馈；忌口 / 备注用琥珀色醒目提示 |

---

## 2. 色彩系统

### 主色（iOS 动态蓝）

| 用途 | Token | HEX |
| --- | --- | --- |
| 品牌色 / 主按钮 / 链接 | `IOS_COLORS.blue` | `#007AFF` |
| 主色浅底 / 选中背景 | `IOS_COLORS.blueLight` | `#E3F0FF` |

### 背景 / 表面

| 用途 | Token | HEX |
| --- | --- | --- |
| 页面背景（Grouped） | `IOS_COLORS.systemGrouped` | `#F2F2F7` |
| 卡片背景 | `IOS_COLORS.card` | `#FFFFFF` |
| 次级背景 | `IOS_COLORS.systemSecondary` | `#EFEFF4` |

### 文字

| 用途 | Token | HEX |
| --- | --- | --- |
| 主文字 | `IOS_COLORS.label` | `#000000` |
| 次文字 | `IOS_COLORS.labelSecondary` | `#8E8E93` |
| 辅助文字 | `IOS_COLORS.labelTertiary` | `#C7C7CC` |

### 状态色

| 语义 | Token | HEX | 用途 |
| --- | --- | --- | --- |
| 成功 / 进行中 | `IOS_COLORS.green` | `#34C759` | 卡片进行中 / 已送达 Badge |
| 警告 / 续卡提醒 | `IOS_COLORS.orange` | `#FF9500` | 余额不足 Banner |
| 危险 / 删除 | `IOS_COLORS.red` | `#FF3B30` | 取消 / 危险操作 |
| 信息 / 已出餐 | `IOS_COLORS.blue` | `#007AFF` | 已出餐 Badge |
| 次级 / 已取消 | `IOS_COLORS.labelSecondary` | `#8E8E93` | 已取消 Badge |

### Badge 颜色速查

| 状态 | 背景色 | 文字色 |
| --- | --- | --- |
| 等待出餐 | `#FFF4E5` | `#FF9500` |
| 已出餐 | `#E3F0FF` | `#007AFF` |
| 已送达 | `#E8F8ED` | `#34C759` |
| 已取消 | `#F5F5F5` | `#8E8E93` |
| 卡进行中 | `#E8F8ED` | `#34C759` |
| 卡已升级 | `#E3F0FF` | `#007AFF` |
| 卡已用完 | `#F5F5F5` | `#8E8E93` |
| 午餐 | `#FFF8E1` | `#FF9500` |
| 晚餐 | `#F0F0FF` | `#5856D6` |
| 院内 | `#E3F0FF` | `#007AFF` |
| 院外 | `#E8F8ED` | `#34C759` |

---

## 3. 字体与字号（参照 iOS Typography）

字体栈：`system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif`

| 层级 | 字号 / 行高 | 粗细 | 使用场景 |
| --- | --- | --- | --- |
| Large Title | 34 / 41 | 700 | 页面大标题 |
| Title 1 | 28 / 34 | 700 | 仪表盘问候 |
| Title 2 | 22 / 28 | 700 | 分区标题 |
| Title 3 | 20 / 25 | 600 | 卡片标题 |
| Body | 17 / 22 | 400 | 正文 |
| Callout | 16 / 21 | 400 / 600 | 按钮 |
| Subhead | 15 / 20 | 400 | 列表内容 |
| Footnote | 13 / 18 | 400 | 辅助说明 |
| Caption | 12 / 16 | 400 | 标签 / 时间戳 |

数字列使用 `tabular-nums` 等宽字体保证对齐。

---

## 4. 圆角与阴影

| 组件 | 圆角 | 阴影 |
| --- | --- | --- |
| 大卡片（仪表盘 / 详情） | 18 | shadow 0 2 8 rgba(0,0,0,0.06) |
| 普通卡片 | 14–16 | shadow 0 1 4 rgba(0,0,0,0.04) |
| 主按钮 | 14 | 无 |
| 小按钮 / 标签 | 8–10 | 无 |
| Avatar | 圆形 (50%) | 无 |
| Modal Sheet | 20 (顶部) | 系统级 |

**禁止**：`borderRadius: 9999` 胶囊按钮；`borderRadius: 0` 无圆角。

---

## 5. 间距系统（4pt 基准格）

常用间距：4 / 8 / 12 / 16 / 20 / 24 / 32 / 48

- 页面外边距：`paddingHorizontal: 20`
- 卡片内边距：`padding: 16` 或 `padding: 18`
- 列表行内边距：`paddingHorizontal: 16, paddingVertical: 13–14`
- 图标间距：`gap: 8–12`
- 分组间距：`marginBottom: 20–24`

---

## 6. 布局结构

### 主界面（2×2 Grid Dashboard）

```
+---------------------------+
|  日期 · 问候语             |  ← Large Title
+------------+------------+
|  会员档案   |  每日订餐   |  ← 大卡片
|  icon + 副标题            |
+------------+------------+
|  财务记账   |  当前用户   |  ← 大卡片
|  icon + 副标题            |
+---------------------------+
|  今日快讯（新闻流）         |  ← 可点击行
+---------------------------+
```

手机单列宽 = `(screenWidth - 32 - 12) / 2`；
平板 / 桌面每卡最大 220px，多列。

### 导航结构

- 无全局导航栏（一次只有一个页面）
- 每个子页面顶部有"‹ 返回"按钮
- 模态页（购卡 / 升级）用 `Modal` + `formSheet`

---

## 7. 组件规范

### 按钮

| 类型 | 样式 | 颜色 | 使用 |
| --- | --- | --- | --- |
| 主按钮 | 填充 14 圆角 50px 高 | `#007AFF` 白字 | 购卡 / 登录 / 确认 |
| 次按钮 | 填充 14 圆角 48px 高 | `#34C759` 白字 | 开卡 / 新增 |
| 危险按钮 | 填充 14 圆角 50px 高 | `#FFF0F0` 红字 | 退出 / 取消 |
| 文字按钮 | 无背景 | `#007AFF` | 导航 / 链接 |

### 输入框

- 无边框，直接在卡片内部
- `backgroundColor: '#F2F2F7'` 搜索框
- 卡片内 label + input 上下排列（iOS 设置页样式）

### Badge / 标签

- 统一 `paddingHorizontal: 6-8, paddingVertical: 2-4, borderRadius: 6-8`
- 不使用边框，用半透明背景

### 列表行

- 高度约 54-60px（含垂直 padding）
- `hairlineWidth` 分割线，`marginLeft: 78`（缩进头像宽度）
- 右侧 `›` 箭头，灰色

---

## 8. 核心页面样板

### 8.0 登录页
- 深背景 `#F2F2F7`，居中白卡
- Logo（圆角蓝色方块）+ 应用名 + 副标题
- 两个 Label + Input 上下排布（iOS 设置样式）
- 蓝色圆角登录按钮

### 8.1 主界面
- 页面背景 `#F2F2F7`
- 顶部问候（日期 + 姓名）
- 2×2 卡片网格（大圆角，白底，彩色图标区）
- 今日快讯流（带图标 + 右箭头）

### 8.2 会员列表
- 搜索框（灰底胶囊）
- 院内 / 院外 / 全部筛选 Chip
- 列表行：圆形头像 + 姓名 + 标签 + 卡进度条

### 8.3 会员详情
- 顶部大头像 + 姓名 + 昵称 + 类型标签
- 联系方式分区（iOS 设置页分组样式）
- 当前卡片卡（带进度条、升级按钮）
- 累计统计（3 宫格）
- 历史卡片列表

### 8.4 购卡 / 升级 Modal
- `presentationStyle="formSheet"` 底部半屏
- 顶部"取消 / 标题 / 确认"导航栏
- 院内 / 院外 Toggle（iOS 分段控件样式）
- 2列卡片网格，选中态蓝色描边
- 底部汇总栏：应收 / 补差价 / 升级后剩餐

### 8.5 每日订餐
- 顶部汇总统计条（午 N 份 / 晚 N 份 / 待出餐 N / 总计）
- 餐别 Chip + 状态 Chip 双层筛选
- 按午 / 晚分 Section，Section Header 吸顶
- 每行：圆形头像 + 会员名 + 院内标签 + 状态 Badge + 卡类型 + 份数 + 忌口 / 备注

### 8.6 财务记账
- 汇总卡（本月收入 / 支出 / 净额）
- 分类小计 Chips（院内订阅 / 院外订阅 / 散餐 / 手动支出）
- 明细列表：收入绿色 / 支出红色金额；来源标签；已冲销条目半透明 + 删除线

---

## 9. 动效 / 交互

- 按钮按下：`opacity: 0.85` + `scale: 0.98`
- 列表行按下：背景变 `rgba(120,120,128,0.12)`
- Modal：`animationType="slide"` 底部弹出
- 加载态：`ActivityIndicator` with `#007AFF`

---

## 10. 禁止清单

- 禁止 emoji 作为功能图标（可做装饰）
- 禁止胶囊形按钮（`borderRadius > 30`）
- 禁止彩色表头（表头始终 `#F2F2F7` 或 `#fff`）
- 禁止同屏两个主按钮颜色竞争
- 禁止纯文字危险操作（必须二次确认 Alert）

---

## 11. 实现技术

- **React Native / React Native Paper MD3** + 自定义 `paperTheme`
- **StyleSheet** 代替 Tailwind（React Native 无 class）
- **SafeAreaView** 处理刘海 / Home 指示器
- **SectionList** 做分组列表（按午 / 晚 Section）
- **FlatList** 做普通列表
- **Modal** + `presentationStyle="formSheet"` 做购卡 / 升级弹窗
