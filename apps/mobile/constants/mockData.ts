/**
 * 前端视图模型类型定义。
 *
 * 历史：本文件早期存放纯 mock 数据（MOCK_MEMBERS / MOCK_FINANCE / mockPurchaseCard 等），
 * 用于 UI 开发阶段的静态演示。接入真实 API 后，mock 数据全部删除，仅保留视图模型
 * 的 TypeScript 类型 —— API 层通过 `lib/member-view.ts`、`lib/order-view.ts` 把后端
 * 返回的 DTO 转成这里的 shape，让组件代码不受 API 契约变更的影响。
 *
 * 没有任何运行时值（常量/函数）从本文件导出。
 */

export interface MockCard {
  id: number;
  card_code: string;
  card_name: string;
  is_hospital: boolean;
  total_meals: number;
  used_meals: number;
  remaining_meals: number;
  unit_price: number;
  paid_amount: number;
  status: 'active' | 'upgraded' | 'exhausted' | 'refunded';
  purchased_at: string;
  /** 收款人姓名（来自 /api/users 的 full_name） */
  collector: string;
  /** 录入者姓名（来自 /api/users 的 full_name） */
  recorder?: string;
  notes?: string;
  upgraded_from?: string;
  /** 退卡金额（仅 refunded 状态有值） */
  refund_amount?: number;
  /** 退卡时间（仅 refunded 状态有值） */
  refunded_at?: string;
  /** 退卡原因 */
  refund_reason?: string;
}

export interface MockMember {
  id: number;
  uid: string;
  name: string;
  nickname: string;
  phone: string;
  wechat_id: string;
  address: string;
  dietary_notes: string;
  is_hospital: boolean;
  /** 散客标记：true 时在会员档案页应该过滤掉，只在散客目录可见 */
  is_walkin?: boolean;
  active_card: MockCard | null;
  card_history: MockCard[];
  stats: {
    total_purchased_meals: number;
    total_consumed_meals: number;
    total_paid_amount: number;
  };
}

export interface MockOrder {
  id: number;
  member_name: string;
  member_nickname: string;
  member_id: number;
  order_date: string;
  meal_type: 'lunch' | 'dinner';
  quantity: number;
  amount: number;
  status: 'pending' | 'fulfilled' | 'delivered' | 'cancelled';
  is_hospital: boolean;
  dietary_notes: string;
  notes: string;
  /** 取消原因（含「配送失败：xxx」） */
  cancel_reason?: string;
  card_type: string | null;
  /** 送餐渠道：self=员工自送（默认）；courier=外包快递 */
  delivery_channel: 'self' | 'courier';
  /** 外包渠道承运方（快递公司/骑手 id） */
  courier_ref?: string;
  /** 散客姓名（非空 → walk-in，不关联会员卡） */
  customer_name?: string;
}

export interface MockFinance {
  id: number;
  entry_date: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string;
  source: 'auto' | 'manual';
  voided: boolean;
  /** 真实发生时间戳（ISO）；来自后端 created_at */
  created_at?: string;
}

export interface MemberUpdateInput {
  name: string;
  nickname: string;
  phone: string;
  wechat_id: string;
  address: string;
  dietary_notes: string;
  is_hospital: boolean;
}
