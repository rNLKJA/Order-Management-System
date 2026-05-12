/**
 * Zod schemas - 前后端共用的输入输出契约。
 *
 * 后端 Hono 路由用这些做 body 校验；前端表单也用它们在提交前校验，
 * 保持前后端同步（改一处，两端都变）。
 */

import { z } from 'zod';

// =========== 基础校验器 ===========

/** 中国大陆 11 位手机号 */
export const zPhone = z
  .string()
  .regex(/^1[3-9]\d{9}$/, '手机号应为 11 位，且以 1 开头');

/** 微信号 6-20 位字母数字下划线或连字符（可为空） */
export const zWechatId = z
  .string()
  .regex(/^[a-zA-Z0-9_-]{6,20}$/, '微信号 6-20 位字母/数字/下划线/连字符')
  .or(z.literal(''));

/** CNY 金额，非负，最多两位小数 */
export const zAmount = z
  .number()
  .nonnegative()
  .multipleOf(0.01, '金额最多保留 2 位小数');

/** ISO 8601 带时区 */
export const zIsoDateTime = z.string().datetime({ offset: true });

/** YYYY-MM-DD 日期 */
export const zDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式为 YYYY-MM-DD');

// =========== 认证 ===========

export const loginSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

// =========== 会员 ===========

export const memberCreateSchema = z.object({
  name: z.string().min(1).max(64),
  nickname: z.string().max(64).optional().default(''),
  phone: zPhone,
  wechat_id: zWechatId.optional().default(''),
  address: z.string().max(256).optional().default(''),
  dietary_notes: z.string().max(512).optional().default(''),
  is_hospital: z.boolean().default(false),
});
export type MemberCreateInput = z.infer<typeof memberCreateSchema>;

export const memberUpdateSchema = memberCreateSchema.partial();
export type MemberUpdateInput = z.infer<typeof memberUpdateSchema>;

// =========== 卡 ===========

const zCatalogCardCode = z.enum([
  'experience',
  'small_week',
  'week',
  'month',
  'season',
  'year',
  'staff',
]);

const cardPurchaseShared = z.object({
  member_id: z.number().int().positive(),
  is_hospital: z.boolean(),
  collector_user_id: z.number().int().positive().optional(),
  created_by_user_id: z.number().int().positive().optional(),
  purchased_at: zIsoDateTime.optional(),
  notes: z.string().max(512).optional().default(''),
});

export const cardPurchaseSchema = z.discriminatedUnion('card_code', [
  cardPurchaseShared.extend({
    card_code: zCatalogCardCode,
  }),
  cardPurchaseShared.extend({
    card_code: z.literal('custom'),
    custom_label: z.string().min(1).max(64).trim(),
    total_meals: z.number().int().positive().max(50_000),
    paid_amount: zAmount.positive(),
  }),
]);
export type CardPurchaseInput = z.infer<typeof cardPurchaseSchema>;

const cardUpgradeShared = z.object({
  is_hospital: z.boolean(),
  collector_user_id: z.number().int().positive().optional(),
  created_by_user_id: z.number().int().positive().optional(),
  notes: z.string().max(512).optional().default(''),
});

export const cardUpgradeSchema = z.discriminatedUnion('card_code', [
  cardUpgradeShared.extend({
    card_code: zCatalogCardCode,
  }),
  cardUpgradeShared.extend({
    card_code: z.literal('custom'),
    custom_label: z.string().min(1).max(64).trim(),
    total_meals: z.number().int().positive().max(50_000),
    paid_amount: zAmount.positive(),
  }),
]);
export type CardUpgradeInput = z.infer<typeof cardUpgradeSchema>;

/**
 * 续卡：不改卡种，按当前卡规格再买一张同级卡，剩余餐数结转到新卡。
 * 业务前提（在 API 层校验）：当前 active 卡 remaining_meals <= CARD_RENEWAL_THRESHOLD_MEALS。
 */
export const cardRenewSchema = z.object({
  collector_user_id: z.number().int().positive().optional(),
  created_by_user_id: z.number().int().positive().optional(),
  notes: z.string().max(512).optional().default(''),
});
export type CardRenewInput = z.infer<typeof cardRenewSchema>;

/**
 * 退卡：把 active 卡退钱并置 refunded，同时写一条支出 FinanceEntry 跟踪资金流。
 * 业务规则：
 *  - 仅 active 卡可退（upgraded / exhausted / refunded 都不行）
 *  - 0 ≤ refund_amount ≤ paid_amount
 *  - 已扣过的餐按原单价计算在 refund_amount 上由前端给出，后端只校验上下限
 */
export const cardRefundSchema = z.object({
  refund_amount: zAmount,
  reason: z.string().max(256).optional().default(''),
  collector_user_id: z.number().int().positive().optional(),
  created_by_user_id: z.number().int().positive().optional(),
});
export type CardRefundInput = z.infer<typeof cardRefundSchema>;

/**
 * 允许触发"续卡"的剩餐阈值：当前 active 卡剩餐 ≤ 该值时才开放。
 * 前后端共用这个常量，保证 UI 提示和 API 校验一致。
 */
export const CARD_RENEWAL_THRESHOLD_MEALS = 2;

// =========== 订餐 ===========

/** 截图凭证：须为 data URL，便于与会员头像一致存 DB */
export const zOrderProofImageDataUrl = z
  .string()
  .min(24)
  .refine(
    (s) => /^data:image\/(jpeg|jpg|png|webp|heic|heif);base64,/i.test(s),
    '须为 JPEG/PNG/WebP/HEIC 截图（data URL）',
  );

export const zOrderProofImages = z
  .array(zOrderProofImageDataUrl)
  .min(1, '请至少上传一张订餐凭证截图')
  .max(12, '凭证最多 12 张')
  .refine(
    (arr) => arr.reduce((sum, s) => sum + s.length, 0) <= 6_000_000,
    '凭证总体积过大，请减少张数或压缩图片',
  );

const orderCreateEntryFields = {
  member_id: z.number().int().positive().optional(),
  order_date: zDate,
  lunch_qty: z.number().int().min(0).optional().default(0),
  dinner_qty: z.number().int().min(0).optional().default(0),
  notes: z.string().max(512).optional().default(''),
  customer_name: z.string().max(64).optional().default(''),
  customer_phone: z.string().max(32).optional().default(''),
  customer_wechat: z.string().max(64).optional().default(''),
  customer_address: z.string().max(256).optional().default(''),
  customer_is_hospital: z.boolean().optional(),
  adhoc_unit_price: z.number().nonnegative().optional(),
  delivery_channel: z.enum(['self', 'courier']).optional().default('self'),
  courier_ref: z.string().max(64).optional().default(''),
  created_by_user_id: z.number().int().positive().optional(),
  /** 赠送餐：不扣卡、不记 meal_earned */
  is_gift: z.boolean().optional().default(false),
  /** 兼容旧客户端：显式免扣次员工餐；新口径使用卡种 staff（员工卡）正常下单 */
  is_staff_meal: z.boolean().optional().default(false),
} satisfies z.ZodRawShape;

type OrderCreateRefineFields = {
  member_id?: number;
  lunch_qty?: number;
  dinner_qty?: number;
  customer_name?: string;
  customer_phone?: string;
  customer_wechat?: string;
  customer_address?: string;
};

function withOrderCreateRefines<T extends z.ZodRawShape>(obj: z.ZodObject<T>) {
  return obj
    .refine((d) => {
      const v = d as OrderCreateRefineFields;
      return (v.lunch_qty ?? 0) + (v.dinner_qty ?? 0) > 0;
    }, {
      message: '午餐份数和晚餐份数至少有一项 > 0',
    })
    .refine(
      (d) => {
        const v = d as OrderCreateRefineFields;
        return (v.member_id ?? 0) > 0 || (v.customer_name ?? '').trim().length > 0;
      },
      { message: '请选择会员或填写散客姓名' },
    )
    .refine(
      (d) => {
        const v = d as OrderCreateRefineFields;
        const isWalkin = !v.member_id && (v.customer_name ?? '').trim().length > 0;
        if (!isWalkin) return true;
        return /^1[3-9]\d{9}$/.test((v.customer_phone ?? '').trim());
      },
      { message: '散客手机号必填，11 位且以 1 开头', path: ['customer_phone'] },
    )
    .refine(
      (d) => {
        const v = d as OrderCreateRefineFields;
        const isWalkin = !v.member_id && (v.customer_name ?? '').trim().length > 0;
        if (!isWalkin) return true;
        return (v.customer_wechat ?? '').trim().length > 0;
      },
      { message: '散客微信号必填', path: ['customer_wechat'] },
    )
    .refine(
      (d) => {
        const v = d as OrderCreateRefineFields;
        const isWalkin = !v.member_id && (v.customer_name ?? '').trim().length > 0;
        if (!isWalkin) return true;
        return (v.customer_address ?? '').trim().length > 0;
      },
      { message: '散客地址必填', path: ['customer_address'] },
    );
}

export const orderCreateEntrySchema = withOrderCreateRefines(
  z.object(orderCreateEntryFields),
);
export type OrderCreateEntryInput = z.infer<typeof orderCreateEntrySchema>;

export const orderCreateSchema = withOrderCreateRefines(
  z.object({
    ...orderCreateEntryFields,
    proof_images: zOrderProofImages,
  }),
);
export type OrderCreateInput = z.infer<typeof orderCreateSchema>;

/** 批量录入：共用一组凭证截图 */
export const orderBatchCreateSchema = z.object({
  proof_images: zOrderProofImages,
  entries: z.array(orderCreateEntrySchema).min(1).max(30),
});
export type OrderBatchCreateInput = z.infer<typeof orderBatchCreateSchema>;

export const orderUpdateSchema = z.object({
  order_date: zDate.optional(),
  meal_type: z.enum(['lunch', 'dinner']).optional(),
  quantity: z.number().int().positive().optional(),
  notes: z.string().max(512).optional(),
  created_by_user_id: z.number().int().positive().optional(),
});
export type OrderUpdateInput = z.infer<typeof orderUpdateSchema>;

export const orderCancelSchema = z.object({
  reason: z.string().max(256).optional().default(''),
});
export type OrderCancelInput = z.infer<typeof orderCancelSchema>;

// =========== 财务 ===========

export const expenseCreateSchema = z.object({
  entry_date: zDate,
  amount: zAmount.positive(),
  description: z.string().min(1).max(512),
  created_by_user_id: z.number().int().positive().optional(),
  /** general → manual_expense；salary → salary_expense（工资，便于平账统计） */
  expense_kind: z.enum(['general', 'salary']).optional().default('general'),
});
export type ExpenseCreateInput = z.infer<typeof expenseCreateSchema>;

export const otherProductIncomeCreateSchema = z.object({
  entry_date: zDate,
  amount: zAmount.positive(),
  description: z.string().min(1).max(512),
  created_by_user_id: z.number().int().positive().optional(),
});
export type OtherProductIncomeCreateInput = z.infer<typeof otherProductIncomeCreateSchema>;

/** 零售商品目录（其他产品销售，不绑定会员） */
export const retailProductCreateSchema = z.object({
  name: z.string().min(1).max(128),
  detail: z.string().max(512).optional().default(''),
});
export type RetailProductCreateInput = z.infer<typeof retailProductCreateSchema>;

export const retailProductPatchSchema = z
  .object({
    name: z.string().min(1).max(128).optional(),
    detail: z.string().max(512).optional(),
    is_active: z.boolean().optional(),
  })
  .refine((v) => v.name !== undefined || v.detail !== undefined || v.is_active !== undefined, {
    message: '至少提供一项修改',
  });
export type RetailProductPatchInput = z.infer<typeof retailProductPatchSchema>;

/** 从目录选品入账 misc_retail_income */
export const retailProductSaleCreateSchema = z.object({
  entry_date: zDate,
  product_id: z.number().int().positive(),
  quantity: z.number().int().positive(),
  amount: zAmount.positive(),
  collector_user_id: z.number().int().positive(),
  note: z.string().max(256).optional().default(''),
});
export type RetailProductSaleCreateInput = z.infer<typeof retailProductSaleCreateSchema>;

export const financeUpdateSchema = z.object({
  entry_date: zDate.optional(),
  amount: zAmount.optional(),
  description: z.string().max(512).optional(),
  category: z.string().optional(),
});
export type FinanceUpdateInput = z.infer<typeof financeUpdateSchema>;

// =========== 用户管理（admin） ===========

export const userCreateSchema = z.object({
  username: z
    .string()
    .regex(/^[a-zA-Z0-9_]{3,32}$/, 'username 3-32 位字母/数字/下划线'),
  full_name: z.string().min(1).max(64),
  role: z.enum(['admin', 'staff']).default('staff'),
});
export type UserCreateInput = z.infer<typeof userCreateSchema>;

export const userUpdateSchema = z.object({
  full_name: z.string().min(1).max(64).optional(),
  role: z.enum(['admin', 'staff']).optional(),
  is_active: z.boolean().optional(),
});
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

/**
 * 头像 data URL 上传。
 *  - 必须是 `data:image/(jpeg|png|webp);base64,` 开头
 *  - base64 总长上限 ~150KB（约 110KB 图片），前端压缩到 256×256 JPEG 通常 <40KB
 */
export const userAvatarUpdateSchema = z.object({
  avatar: z
    .string()
    .regex(
      /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/,
      '头像必须是 data:image/(jpeg|png|webp);base64 形式',
    )
    .max(200_000, '头像过大，请压缩后重试（上限约 150KB base64）'),
});
export type UserAvatarUpdateInput = z.infer<typeof userAvatarUpdateSchema>;
