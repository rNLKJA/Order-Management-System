/**
 * Drizzle schema - 与 plan §4 数据模型一一对应。
 *
 * 设计原则：
 * - 所有业务表带 created_by_user_id / created_at / updated_at
 * - 人员字段一律 *_user_id 通用 FK；"谁是默认收款/录入/送达人"存在 settings 表
 * - 时间一律存 UTC；前端按 Asia/Shanghai 展示
 */

import { sql } from 'drizzle-orm';
import {
  sqliteTable,
  integer,
  text,
  real,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

// =========== users ===========

export const users = sqliteTable(
  'users',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    username: text('username').notNull(),
    password_hash: text('password_hash').notNull(),
    full_name: text('full_name').notNull(),
    role: text('role', { enum: ['admin', 'staff'] }).notNull(),
    is_active: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    token_version: integer('token_version').notNull().default(1),
    /**
     * 头像：data URL（data:image/jpeg;base64,...）。
     * 前端上传前压缩到 256×256 JPEG，base64 不超过 ~80KB；
     * 生产大规模用户时应该换成 R2/S3 URL，现在图省事直接塞 DB。
     */
    avatar_url: text('avatar_url'),
    created_at: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
  },
  (t) => ({
    usernameIdx: uniqueIndex('users_username_idx').on(t.username),
  }),
);

// =========== settings ===========

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updated_at: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
});

// =========== members ===========

export const members = sqliteTable(
  'members',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    uid: text('uid').notNull(),
    name: text('name').notNull(),
    nickname: text('nickname').notNull().default(''),
    phone: text('phone').notNull(),
    wechat_id: text('wechat_id').notNull().default(''),
    address: text('address').notNull().default(''),
    dietary_notes: text('dietary_notes').notNull().default(''),
    is_hospital: integer('is_hospital', { mode: 'boolean' }).notNull().default(false),
    /**
     * 内部员工/股东等待遇：订餐同赠送餐（免开卡、不扣次、金额 0、送达不写 meal_earned）。
     * 在「会员档案」勾选，不再在单笔下单处单独 toggle。
     */
    is_staff: integer('is_staff', { mode: 'boolean' }).notNull().default(false),
    is_active: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    /**
     * 散客标记。散客是"有过订单但没开卡的人"，由 POST /api/orders 的 customer_name
     * 自动创建。uid 统一以 `__WALKIN__{name}` 规则存放，便于定位和去重。
     * 一旦为散客开了第一张卡，此字段翻成 false，该人正式成为会员。
     */
    is_walkin: integer('is_walkin', { mode: 'boolean' }).notNull().default(false),
    created_by_user_id: integer('created_by_user_id')
      .notNull()
      .references(() => users.id),
    created_at: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
    updated_at: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
  },
  (t) => ({
    uidIdx: uniqueIndex('members_uid_idx').on(t.uid),
    phoneIdx: index('members_phone_idx').on(t.phone),
    wechatIdx: index('members_wechat_idx').on(t.wechat_id),
    activeIdx: index('members_active_idx').on(t.is_active),
    walkinIdx: index('members_walkin_idx').on(t.is_walkin),
  }),
);

// =========== cards ===========

export const cards = sqliteTable(
  'cards',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    member_id: integer('member_id')
      .notNull()
      .references(() => members.id),
    card_code: text('card_code').notNull(),
    is_hospital: integer('is_hospital', { mode: 'boolean' }).notNull(),
    total_meals: integer('total_meals').notNull(),
    used_meals: integer('used_meals').notNull().default(0),
    remaining_meals: integer('remaining_meals').notNull(),
    unit_price: real('unit_price').notNull(),
    paid_amount: real('paid_amount').notNull(),
    status: text('status', { enum: ['active', 'upgraded', 'exhausted', 'refunded'] })
      .notNull()
      .default('active'),
    upgraded_from_id: integer('upgraded_from_id').references((): any => cards.id),
    collector_user_id: integer('collector_user_id')
      .notNull()
      .references(() => users.id),
    created_by_user_id: integer('created_by_user_id')
      .notNull()
      .references(() => users.id),
    purchased_at: integer('purchased_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
    created_at: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
    updated_at: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
    notes: text('notes').notNull().default(''),
    /** 自定义卡名称；仅 card_code='custom' */
    custom_label: text('custom_label'),
    /** 自定义卡单次购买的餐数（续卡按此档加餐）；仅 custom */
    custom_pack_meals: integer('custom_pack_meals'),
    // 退卡相关（仅 status='refunded' 时有值；新增为 nullable 所以老数据不用迁移）
    refund_amount: real('refund_amount'),
    refund_reason: text('refund_reason'),
    refunded_at: integer('refunded_at', { mode: 'timestamp_ms' }),
    refunded_by_user_id: integer('refunded_by_user_id').references(() => users.id),
  },
  (t) => ({
    memberIdx: index('cards_member_idx').on(t.member_id),
    statusIdx: index('cards_status_idx').on(t.status),
  }),
);

// =========== order_proof_sets ===========

/** 一次录入共用的凭证 JSON；多行 daily_orders 共享同一 proof_set_id，避免重复存 data URL。 */
export const order_proof_sets = sqliteTable(
  'order_proof_sets',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    proof_images_json: text('proof_images_json').notNull(),
    created_by_user_id: integer('created_by_user_id')
      .notNull()
      .references(() => users.id),
    created_at: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
  },
  (t) => ({
    createdByIdx: index('order_proof_sets_created_by_idx').on(t.created_by_user_id),
  }),
);

// =========== daily_orders ===========

export const daily_orders = sqliteTable(
  'daily_orders',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    member_id: integer('member_id')
      .notNull()
      .references(() => members.id),
    card_id: integer('card_id').references(() => cards.id),
    order_date: text('order_date').notNull(), // YYYY-MM-DD
    meal_type: text('meal_type', { enum: ['lunch', 'dinner'] }).notNull(),
    quantity: integer('quantity').notNull(),
    amount: real('amount').notNull().default(0),
    /** 散客姓名（非空 → 该订单是散客 adhoc，不关联任何会员卡） */
    customer_name: text('customer_name').notNull().default(''),
    status: text('status', {
      enum: ['pending', 'fulfilled', 'delivered', 'cancelled'],
    })
      .notNull()
      .default('pending'),
    fulfilled_at: integer('fulfilled_at', { mode: 'timestamp_ms' }),
    fulfilled_by_user_id: integer('fulfilled_by_user_id').references(() => users.id),
    delivered_at: integer('delivered_at', { mode: 'timestamp_ms' }),
    delivered_by_user_id: integer('delivered_by_user_id').references(() => users.id),
    cancelled_at: integer('cancelled_at', { mode: 'timestamp_ms' }),
    cancelled_by_user_id: integer('cancelled_by_user_id').references(() => users.id),
    cancel_reason: text('cancel_reason').notNull().default(''),
    /** 送餐渠道：self = 本店员工自送；courier = 已外包快递。
     *  目前所有订单默认 self；未来快递系统接入后在下单或"送餐" tab
     *  里切换，出餐页可以按 channel 过滤。 */
    delivery_channel: text('delivery_channel', { enum: ['self', 'courier'] })
      .notNull()
      .default('self'),
    /** 外包渠道的承运方标识（快递公司名 / 骑手 id），留 text 字段未来扩展 */
    courier_ref: text('courier_ref').notNull().default(''),
    created_by_user_id: integer('created_by_user_id')
      .notNull()
      .references(() => users.id),
    created_at: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
    updated_at: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
    notes: text('notes').notNull().default(''),
    /** 赠送餐：不扣会员卡次数；送达时不记 meal_earned 收入 */
    is_gift: integer('is_gift', { mode: 'boolean' }).notNull().default(false),
    /** 员工餐标记：下单时若会员 is_staff 为真会自动置 true；与赠送同口径不计收入 */
    is_staff_meal: integer('is_staff_meal', { mode: 'boolean' }).notNull().default(false),
    /** JSON 数组：订餐凭证截图 data URL 列表（审计用） */
    proof_images_json: text('proof_images_json').notNull().default('[]'),
    /** 非空时凭证正文在 order_proof_sets，本列常为 [] */
    proof_set_id: integer('proof_set_id').references(() => order_proof_sets.id),
  },
  (t) => ({
    memberIdx: index('orders_member_idx').on(t.member_id),
    cardIdx: index('orders_card_idx').on(t.card_id),
    dateIdx: index('orders_date_idx').on(t.order_date),
    statusIdx: index('orders_status_idx').on(t.status),
    deliveryChannelIdx: index('orders_delivery_channel_idx').on(t.delivery_channel),
    proofSetIdx: index('daily_orders_proof_set_idx').on(t.proof_set_id),
  }),
);

// =========== finance_entries ===========

export const finance_entries = sqliteTable(
  'finance_entries',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    entry_date: text('entry_date').notNull(), // YYYY-MM-DD
    type: text('type', { enum: ['income', 'expense'] }).notNull(),
    amount: real('amount').notNull(),
    category: text('category').notNull(),
    description: text('description').notNull().default(''),
    ref_card_id: integer('ref_card_id').references(() => cards.id),
    ref_order_id: integer('ref_order_id').references(() => daily_orders.id),
    source: text('source', { enum: ['auto', 'manual', 'imported_legacy'] })
      .notNull()
      .default('manual'),
    voided: integer('voided', { mode: 'boolean' }).notNull().default(false),
    collector_user_id: integer('collector_user_id').references(() => users.id),
    created_by_user_id: integer('created_by_user_id')
      .notNull()
      .references(() => users.id),
    created_at: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
    updated_at: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
  },
  (t) => ({
    dateIdx: index('finance_date_idx').on(t.entry_date),
    typeIdx: index('finance_type_idx').on(t.type),
    categoryIdx: index('finance_category_idx').on(t.category),
  }),
);

// =========== audit_logs ===========

export const audit_logs = sqliteTable(
  'audit_logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    user_id: integer('user_id')
      .notNull()
      .references(() => users.id),
    action: text('action', {
      enum: ['create', 'update', 'delete', 'fulfill', 'deliver', 'cancel'],
    }).notNull(),
    entity: text('entity', {
      enum: ['member', 'card', 'daily_order', 'finance_entry', 'user'],
    }).notNull(),
    entity_id: integer('entity_id').notNull(),
    diff_json: text('diff_json').notNull().default('{}'),
    created_at: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
  },
  (t) => ({
    entityIdx: index('audit_entity_idx').on(t.entity, t.entity_id),
    userIdx: index('audit_user_idx').on(t.user_id),
    createdIdx: index('audit_created_idx').on(t.created_at),
  }),
);

// =========== tomorrow_summaries ===========

export const tomorrow_summaries = sqliteTable(
  'tomorrow_summaries',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    target_date: text('target_date').notNull(),
    generated_at: integer('generated_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
    stale: integer('stale', { mode: 'boolean' }).notNull().default(false),
    payload_json: text('payload_json').notNull(),
  },
  (t) => ({
    dateIdx: uniqueIndex('tomorrow_date_idx').on(t.target_date),
  }),
);

// =========== notifications ===========

export const notifications = sqliteTable(
  'notifications',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    user_id: integer('user_id')
      .notNull()
      .references(() => users.id),
    type: text('type').notNull(),
    payload_json: text('payload_json').notNull().default('{}'),
    read_at: integer('read_at', { mode: 'timestamp_ms' }),
    created_at: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
  },
  (t) => ({
    userIdx: index('notif_user_idx').on(t.user_id),
  }),
);

// =========== idempotency_keys ===========

export const idempotency_keys = sqliteTable('idempotency_keys', {
  key: text('key').primaryKey(),
  response_json: text('response_json').notNull(),
  created_at: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
});

// =========== export_logs ===========

export const export_logs = sqliteTable(
  'export_logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    user_id: integer('user_id')
      .notNull()
      .references(() => users.id),
    kind: text('kind').notNull(),
    params_json: text('params_json').notNull().default('{}'),
    bytes: integer('bytes').notNull().default(0),
    created_at: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
  },
  (t) => ({
    userIdx: index('export_user_idx').on(t.user_id),
    createdIdx: index('export_created_idx').on(t.created_at),
  }),
);

/** 汇总计算记录 sheet：按行导入的「总收入/总支出/剩余」快照（V5 xlsm） */
export const imported_summary_snapshots = sqliteTable(
  'imported_summary_snapshots',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    snapshot_date: text('snapshot_date').notNull(),
    total_income: real('total_income').notNull(),
    total_expense: real('total_expense').notNull(),
    balance: real('balance').notNull(),
    source_sheet: text('source_sheet').notNull().default('汇总计算记录'),
    extra_json: text('extra_json').notNull().default('{}'),
    created_by_user_id: integer('created_by_user_id')
      .notNull()
      .references(() => users.id),
    created_at: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
  },
  (t) => ({
    dateIdx: index('imported_summary_snapshots_date_idx').on(t.snapshot_date),
  }),
);

/** 每周结账 sheet 行（V5 xlsm） */
export const imported_weekly_closings = sqliteTable(
  'imported_weekly_closings',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    period_label: text('period_label').notNull(),
    inferred_date: text('inferred_date'),
    amount: real('amount').notNull(),
    description: text('description').notNull().default(''),
    sort_order: integer('sort_order').notNull(),
    source_sheet: text('source_sheet').notNull().default('每周结账'),
    extra_json: text('extra_json').notNull().default('{}'),
    created_by_user_id: integer('created_by_user_id')
      .notNull()
      .references(() => users.id),
    created_at: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
  },
  (t) => ({
    sortIdx: index('imported_weekly_closings_sort_idx').on(t.sort_order),
  }),
);

/** 订餐汇总 sheet：客户宽表整行 JSON + 核心份数列（V5 xlsm） */
export const imported_order_summaries = sqliteTable(
  'imported_order_summaries',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    customer_id: text('customer_id').notNull(),
    excel_row: integer('excel_row').notNull(),
    total_meals: integer('total_meals'),
    used_meals: integer('used_meals'),
    remaining_meals: integer('remaining_meals'),
    row_json: text('row_json').notNull(),
    source_sheet: text('source_sheet').notNull().default('订餐汇总'),
    created_by_user_id: integer('created_by_user_id')
      .notNull()
      .references(() => users.id),
    created_at: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
  },
  (t) => ({
    cidIdx: index('imported_order_summaries_cid_idx').on(t.customer_id),
  }),
);

// =========== 类型导出 ===========

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Member = typeof members.$inferSelect;
export type NewMember = typeof members.$inferInsert;
export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
export type DailyOrder = typeof daily_orders.$inferSelect;
export type NewDailyOrder = typeof daily_orders.$inferInsert;
export type FinanceEntry = typeof finance_entries.$inferSelect;
export type NewFinanceEntry = typeof finance_entries.$inferInsert;
export type ImportedSummarySnapshot = typeof imported_summary_snapshots.$inferSelect;
export type ImportedWeeklyClosing = typeof imported_weekly_closings.$inferSelect;
export type ImportedOrderSummary = typeof imported_order_summaries.$inferSelect;
export type AuditLog = typeof audit_logs.$inferSelect;
export type NewAuditLog = typeof audit_logs.$inferInsert;
export type Setting = typeof settings.$inferSelect;
