/**
 * 演示 Mock 数据 — 仅用于 UI 开发阶段展示效果。
 * 实际数据来自 API。
 */

import {
  getCardSpec,
  CARD_RENEWAL_THRESHOLD_MEALS,
  type CardSpec,
  type SubscriptionCardCode,
} from '@meal/shared';

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
  collector: string;
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

/** 收款人候选（与 PROCESS §4.2 对齐） */
export const COLLECTORS = ['孙梦瑶', '孙漫林', '徐超', '高平'] as const;
export type Collector = (typeof COLLECTORS)[number];
export const DEFAULT_COLLECTOR: Collector = '孙梦瑶';

/** 录入者候选 */
export const RECORDERS = ['高平', '孙梦瑶', '孙漫林'] as const;
export type Recorder = (typeof RECORDERS)[number];
export const DEFAULT_RECORDER: Recorder = '高平';

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
  card_type: string | null;
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
  /** 真实发生时间戳（ISO）；mock 种子数据没有则回退到 entry_date */
  created_at?: string;
}

export const TODAY = '2026-04-23';

// ==================== 会员 ====================

export const MOCK_MEMBERS: MockMember[] = [
  {
    id: 1,
    uid: '牙巴(13985739933)',
    name: '杨晓芸',
    nickname: '牙巴',
    phone: '13985739933',
    wechat_id: 'yaxiao_yun',
    address: '门诊口腔科',
    dietary_notes: '',
    is_hospital: true,
    active_card: {
      id: 101,
      card_code: 'month',
      card_name: '月卡',
      is_hospital: true,
      total_meals: 40,
      used_meals: 22,
      remaining_meals: 18,
      unit_price: 22,
      paid_amount: 880,
      status: 'active',
      purchased_at: '2026-03-26T08:30:00+08:00',
      collector: '孙梦瑶',
    },
    card_history: [
      {
        id: 101,
        card_code: 'month',
        card_name: '月卡',
        is_hospital: true,
        total_meals: 40,
        used_meals: 22,
        remaining_meals: 18,
        unit_price: 22,
        paid_amount: 880,
        status: 'active',
        purchased_at: '2026-03-26T08:30:00+08:00',
        collector: '孙梦瑶',
      },
      {
        id: 51,
        card_code: 'week',
        card_name: '大周卡',
        is_hospital: true,
        total_meals: 10,
        used_meals: 10,
        remaining_meals: 0,
        unit_price: 23,
        paid_amount: 230,
        status: 'exhausted',
        purchased_at: '2026-02-10T09:00:00+08:00',
        collector: '孙梦瑶',
      },
    ],
    stats: { total_purchased_meals: 50, total_consumed_meals: 32, total_paid_amount: 1110 },
  },
  {
    id: 2,
    uid: '木木(13885305500)',
    name: '黄华',
    nickname: '木木',
    phone: '13885305500',
    wechat_id: 'mumu_hh',
    address: '急诊抢救室',
    dietary_notes: '',
    is_hospital: true,
    active_card: {
      id: 102,
      card_code: 'season',
      card_name: '季卡',
      is_hospital: true,
      total_meals: 120,
      used_meals: 25,
      remaining_meals: 95,
      unit_price: 21,
      paid_amount: 2520,
      status: 'active',
      purchased_at: '2026-04-01T10:00:00+08:00',
      collector: '孙梦瑶',
      notes: '从月卡升级',
      upgraded_from: '月卡',
    },
    card_history: [
      {
        id: 102,
        card_code: 'season',
        card_name: '季卡',
        is_hospital: true,
        total_meals: 120,
        used_meals: 25,
        remaining_meals: 95,
        unit_price: 21,
        paid_amount: 2520,
        status: 'active',
        purchased_at: '2026-04-01T10:00:00+08:00',
        collector: '孙梦瑶',
        upgraded_from: '月卡',
      },
      {
        id: 52,
        card_code: 'month',
        card_name: '月卡',
        is_hospital: true,
        total_meals: 40,
        used_meals: 12,
        remaining_meals: 0,
        unit_price: 22,
        paid_amount: 880,
        status: 'upgraded',
        purchased_at: '2026-03-01T08:00:00+08:00',
        collector: '孙梦瑶',
      },
    ],
    stats: { total_purchased_meals: 160, total_consumed_meals: 37, total_paid_amount: 3400 },
  },
  {
    id: 3,
    uid: '萍水相逢(13595308265)',
    name: '于学萍',
    nickname: '萍水相逢',
    phone: '13595308265',
    wechat_id: 'pingshui_yxp',
    address: '人和苑3栋24层3号',
    dietary_notes: '',
    is_hospital: false,
    active_card: {
      id: 103,
      card_code: 'week',
      card_name: '大周卡',
      is_hospital: false,
      total_meals: 10,
      used_meals: 7,
      remaining_meals: 3,
      unit_price: 28,
      paid_amount: 280,
      status: 'active',
      purchased_at: '2026-04-14T09:30:00+08:00',
      collector: '孙梦瑶',
    },
    card_history: [
      {
        id: 103,
        card_code: 'week',
        card_name: '大周卡',
        is_hospital: false,
        total_meals: 10,
        used_meals: 7,
        remaining_meals: 3,
        unit_price: 28,
        paid_amount: 280,
        status: 'active',
        purchased_at: '2026-04-14T09:30:00+08:00',
        collector: '孙梦瑶',
      },
    ],
    stats: { total_purchased_meals: 10, total_consumed_meals: 7, total_paid_amount: 280 },
  },
  {
    id: 4,
    uid: '小米(18685398777)',
    name: '武亚敏',
    nickname: '小米',
    phone: '18685398777',
    wechat_id: 'xiaomi_wym',
    address: '门诊4楼MMC门诊采血室',
    dietary_notes: '无忌口',
    is_hospital: true,
    active_card: {
      id: 104,
      card_code: 'small_week',
      card_name: '小周卡',
      is_hospital: true,
      total_meals: 5,
      used_meals: 4,
      remaining_meals: 1,
      unit_price: 25,
      paid_amount: 125,
      status: 'active',
      purchased_at: '2026-04-18T10:00:00+08:00',
      collector: '孙梦瑶',
    },
    card_history: [
      {
        id: 104,
        card_code: 'small_week',
        card_name: '小周卡',
        is_hospital: true,
        total_meals: 5,
        used_meals: 4,
        remaining_meals: 1,
        unit_price: 25,
        paid_amount: 125,
        status: 'active',
        purchased_at: '2026-04-18T10:00:00+08:00',
        collector: '孙梦瑶',
      },
    ],
    stats: { total_purchased_meals: 5, total_consumed_meals: 4, total_paid_amount: 125 },
  },
  {
    id: 5,
    uid: '匡匡(13638533477)',
    name: '匡贵榕',
    nickname: '匡匡',
    phone: '13638533477',
    wechat_id: 'kuang_kuang',
    address: '门诊部四楼西侧',
    dietary_notes: '8份餐中餐，其中一餐是男士用餐',
    is_hospital: true,
    active_card: {
      id: 105,
      card_code: 'year',
      card_name: '年卡',
      is_hospital: true,
      total_meals: 480,
      used_meals: 160,
      remaining_meals: 320,
      unit_price: 20,
      paid_amount: 9600,
      status: 'active',
      purchased_at: '2026-01-05T08:00:00+08:00',
      collector: '孙梦瑶',
    },
    card_history: [
      {
        id: 105,
        card_code: 'year',
        card_name: '年卡',
        is_hospital: true,
        total_meals: 480,
        used_meals: 160,
        remaining_meals: 320,
        unit_price: 20,
        paid_amount: 9600,
        status: 'active',
        purchased_at: '2026-01-05T08:00:00+08:00',
        collector: '孙梦瑶',
      },
    ],
    stats: { total_purchased_meals: 480, total_consumed_meals: 160, total_paid_amount: 9600 },
  },
  {
    id: 6,
    uid: '老陈(13800001111)',
    name: '陈建国',
    nickname: '老陈',
    phone: '13800001111',
    wechat_id: 'chen_jg',
    address: '院外 · 青羊区清江东路 22 号',
    dietary_notes: '不吃牛肉',
    is_hospital: false,
    active_card: null,
    card_history: [
      {
        id: 106,
        card_code: 'month',
        card_name: '月卡',
        is_hospital: false,
        total_meals: 20,
        used_meals: 20,
        remaining_meals: 0,
        unit_price: 30,
        paid_amount: 600,
        status: 'exhausted',
        purchased_at: '2026-02-12T09:00:00+08:00',
        collector: '孙梦瑶',
      },
      {
        id: 107,
        card_code: 'week',
        card_name: '周卡',
        is_hospital: false,
        total_meals: 5,
        used_meals: 5,
        remaining_meals: 0,
        unit_price: 32,
        paid_amount: 160,
        status: 'exhausted',
        purchased_at: '2026-01-20T09:30:00+08:00',
        collector: '孙梦瑶',
      },
    ],
    stats: { total_purchased_meals: 25, total_consumed_meals: 25, total_paid_amount: 760 },
  },
  {
    id: 7,
    uid: '小玉(13700002222)',
    name: '张玉',
    nickname: '小玉',
    phone: '13700002222',
    wechat_id: 'xiao_yu_zhang',
    address: '门诊部 3 楼东侧',
    dietary_notes: '',
    is_hospital: true,
    active_card: null,
    card_history: [
      {
        id: 108,
        card_code: 'week',
        card_name: '周卡',
        is_hospital: true,
        total_meals: 5,
        used_meals: 5,
        remaining_meals: 0,
        unit_price: 25,
        paid_amount: 125,
        status: 'exhausted',
        purchased_at: '2026-04-01T08:00:00+08:00',
        collector: '孙梦瑶',
      },
    ],
    stats: { total_purchased_meals: 5, total_consumed_meals: 5, total_paid_amount: 125 },
  },
];

// ==================== 今日订单 ====================

export const MOCK_TODAY_ORDERS: MockOrder[] = [
  {
    id: 1001, member_id: 1, member_name: '杨晓芸', member_nickname: '牙巴',
    order_date: TODAY, meal_type: 'lunch', quantity: 1, amount: 0,
    status: 'pending', is_hospital: true, dietary_notes: '', notes: '',
    card_type: '月卡',
  },
  {
    id: 1002, member_id: 2, member_name: '黄华', member_nickname: '木木',
    order_date: TODAY, meal_type: 'lunch', quantity: 1, amount: 0,
    status: 'fulfilled', is_hospital: true, dietary_notes: '', notes: '一份少辣',
    card_type: '季卡',
  },
  {
    id: 1003, member_id: 3, member_name: '于学萍', member_nickname: '萍水相逢',
    order_date: TODAY, meal_type: 'lunch', quantity: 2, amount: 0,
    status: 'pending', is_hospital: false, dietary_notes: '', notes: '',
    card_type: '大周卡',
  },
  {
    id: 1004, member_id: 4, member_name: '武亚敏', member_nickname: '小米',
    order_date: TODAY, meal_type: 'lunch', quantity: 1, amount: 0,
    status: 'pending', is_hospital: true, dietary_notes: '无忌口', notes: '',
    card_type: '小周卡',
  },
  {
    id: 1005, member_id: 5, member_name: '匡贵榕', member_nickname: '匡匡',
    order_date: TODAY, meal_type: 'lunch', quantity: 2, amount: 0,
    status: 'delivered', is_hospital: true, dietary_notes: '一份男士用餐', notes: '',
    card_type: '年卡',
  },
  {
    id: 1006, member_id: 4, member_name: '武亚敏', member_nickname: '小米',
    order_date: TODAY, meal_type: 'dinner', quantity: 1, amount: 0,
    status: 'pending', is_hospital: true, dietary_notes: '无忌口', notes: '',
    card_type: '小周卡',
  },
  {
    id: 1007, member_id: 2, member_name: '黄华', member_nickname: '木木',
    order_date: TODAY, meal_type: 'dinner', quantity: 1, amount: 0,
    status: 'pending', is_hospital: true, dietary_notes: '', notes: '下午5点前送到',
    card_type: '季卡',
  },
  // 散餐
  {
    id: 1008, member_id: 0, member_name: '花花', member_nickname: '花花',
    order_date: TODAY, meal_type: 'lunch', quantity: 1, amount: 35,
    status: 'delivered', is_hospital: false, dietary_notes: '', notes: '',
    card_type: null,
  },
];

// ==================== 财务 ====================

export const MOCK_FINANCE: MockFinance[] = [
  {
    id: 2001, entry_date: '2026-04-23', type: 'income', amount: 880,
    category: 'hospital_sub', description: '牙巴 - 院内月卡', source: 'auto', voided: false,
  },
  {
    id: 2002, entry_date: '2026-04-22', type: 'income', amount: 280,
    category: 'regular_sub', description: '萍水相逢 - 院外大周卡', source: 'auto', voided: false,
  },
  {
    id: 2003, entry_date: '2026-04-22', type: 'income', amount: 1640,
    category: 'hospital_sub', description: '木木 - 月卡升级季卡（补差 ¥1640）', source: 'auto', voided: false,
  },
  {
    id: 2004, entry_date: '2026-04-21', type: 'income', amount: 35,
    category: 'ad_hoc', description: '花花 - 散餐 1份', source: 'auto', voided: false,
  },
  {
    id: 2005, entry_date: '2026-04-23', type: 'expense', amount: 320,
    category: 'manual_expense', description: '买菜（孙漫林）', source: 'manual', voided: false,
  },
  {
    id: 2006, entry_date: '2026-04-22', type: 'expense', amount: 310,
    category: 'manual_expense', description: '鸡腿 310元', source: 'manual', voided: false,
  },
  {
    id: 2007, entry_date: '2026-04-22', type: 'expense', amount: 50,
    category: 'manual_expense', description: '鸡蛋 50元', source: 'manual', voided: false,
  },
  {
    id: 2008, entry_date: '2026-04-21', type: 'income', amount: 125,
    category: 'hospital_sub', description: '小米 - 院内小周卡', source: 'auto', voided: false,
  },
];

// ==================== 开卡 / 升级 helper（mock 侧原地修改，便于 UI 演示）====================

let nextCardId = 200;
let nextFinanceId = 3000;

export interface PurchaseCardInput {
  memberId: number;
  spec: CardSpec;
  isHospital: boolean;
  collector: Collector;
  recorder: Recorder;
  notes?: string;
}

export interface UpgradeCardInput extends PurchaseCardInput {
  /** 来源卡 id（会被标为 upgraded） */
  fromCardId: number;
}

/** 续卡：同卡种、同价目表；spec / isHospital 沿用旧卡，不需要传 */
export interface RenewCardInput {
  memberId: number;
  fromCardId: number;
  collector: Collector;
  recorder: Recorder;
  notes?: string;
}

/** 退卡：把当前 active 卡整张作废，按剩餐 × 单价退款并记一笔支出 */
export interface RefundCardInput {
  memberId: number;
  fromCardId: number;
  /** 退款经办人 */
  operator: Collector;
  /** 退卡原因（可选） */
  reason?: string;
}

export interface PurchaseResult {
  card: MockCard;
  finance: MockFinance;
}

export interface UpgradeResult {
  card: MockCard;
  finance: MockFinance;
  diff: number;
}

export interface RenewResult {
  card: MockCard;
  finance: MockFinance;
  /** 从旧卡结转到新卡的餐数 */
  carriedMeals: number;
}

export interface RefundResult {
  card: MockCard;
  finance: MockFinance;
  /** 实际退款金额（剩餐 × 单价） */
  refundAmount: number;
}

/** 估算退款金额（不改数据，仅用于确认弹层展示） */
export function calcRefundAmount(card: MockCard): number {
  return round2(card.unit_price * Math.max(0, card.remaining_meals));
}

function todayDateStr(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function pushFinance(entry: Omit<MockFinance, 'id'>): MockFinance {
  const full: MockFinance = {
    id: nextFinanceId++,
    created_at: new Date().toISOString(),
    ...entry,
  };
  MOCK_FINANCE.unshift(full);
  return full;
}

/**
 * 为某会员新购一张卡（mock：会员当前无 active 卡时使用）。
 * 与 PROCESS §4.2 / §8.1 对齐：新建 active 卡 + 写财务收入（hospital_sub / regular_sub 分类）。
 */
export function mockPurchaseCard(input: PurchaseCardInput): PurchaseResult {
  const member = MOCK_MEMBERS.find((m) => m.id === input.memberId);
  if (!member) throw new Error('会员不存在');
  if (member.active_card) {
    throw new Error('该会员已有进行中的卡，请走升级流程');
  }
  const now = new Date().toISOString();
  const card: MockCard = {
    id: nextCardId++,
    card_code: input.spec.code,
    card_name: input.spec.name,
    is_hospital: input.isHospital,
    total_meals: input.spec.meals,
    used_meals: 0,
    remaining_meals: input.spec.meals,
    unit_price: input.spec.unitPrice,
    paid_amount: input.spec.totalPrice,
    status: 'active',
    purchased_at: now,
    collector: input.collector,
    recorder: input.recorder,
    notes: input.notes?.trim() || undefined,
  };
  member.active_card = card;
  member.card_history = [card, ...member.card_history];
  member.stats.total_purchased_meals += card.total_meals;
  member.stats.total_paid_amount += card.paid_amount;

  const finance = pushFinance({
    entry_date: todayDateStr(),
    type: 'income',
    amount: card.paid_amount,
    category: input.isHospital ? 'hospital_sub' : 'regular_sub',
    description: `${member.nickname || member.name} · ${input.isHospital ? '院内' : '院外'}${card.card_name}（收款：${input.collector}）`,
    source: 'auto',
    voided: false,
  });

  return { card, finance };
}

/**
 * 升级：旧卡标 upgraded，新卡 active；补差价 = 新总价 − 旧已付；新剩餐 = 新总餐 − 旧已用。
 * 与 PROCESS §4.2 / §4.3 / §8.1 一致（禁降级 / 禁同价，财务入补差价）。
 */
export function mockUpgradeCard(input: UpgradeCardInput): UpgradeResult {
  const member = MOCK_MEMBERS.find((m) => m.id === input.memberId);
  if (!member) throw new Error('会员不存在');
  const oldCard = member.card_history.find((c) => c.id === input.fromCardId);
  if (!oldCard) throw new Error('原卡不存在');
  if (input.spec.totalPrice <= oldCard.paid_amount) {
    throw new Error('不支持降级或同价升级');
  }
  const now = new Date().toISOString();
  const newRemaining = Math.max(0, input.spec.meals - oldCard.used_meals);
  const diff = round2(input.spec.totalPrice - oldCard.paid_amount);
  const newCard: MockCard = {
    id: nextCardId++,
    card_code: input.spec.code,
    card_name: input.spec.name,
    is_hospital: input.isHospital,
    total_meals: input.spec.meals,
    used_meals: oldCard.used_meals,
    remaining_meals: newRemaining,
    unit_price: input.spec.unitPrice,
    paid_amount: input.spec.totalPrice,
    status: 'active',
    purchased_at: now,
    collector: input.collector,
    recorder: input.recorder,
    notes: input.notes?.trim() || undefined,
    upgraded_from: oldCard.card_name,
  };
  oldCard.status = 'upgraded';
  member.active_card = newCard;
  member.card_history = [newCard, ...member.card_history];
  member.stats.total_purchased_meals += newCard.total_meals - oldCard.total_meals;
  member.stats.total_paid_amount += diff;

  const finance = pushFinance({
    entry_date: todayDateStr(),
    type: 'income',
    amount: diff,
    category: input.isHospital ? 'hospital_sub' : 'regular_sub',
    description: `${member.nickname || member.name} · ${oldCard.card_name}→${newCard.card_name}（补差 ¥${diff}，收款：${input.collector}）`,
    source: 'auto',
    voided: false,
  });

  return { card: newCard, finance, diff };
}

/**
 * 续卡：同卡种、同价目表再开一张，剩餐结转到新卡；按新卡全价收款。
 * 前提：旧卡 active 且剩餐 ≤ CARD_RENEWAL_THRESHOLD_MEALS。
 */
export function mockRenewCard(input: RenewCardInput): RenewResult {
  const member = MOCK_MEMBERS.find((m) => m.id === input.memberId);
  if (!member) throw new Error('会员不存在');
  const oldCard = member.card_history.find((c) => c.id === input.fromCardId);
  if (!oldCard) throw new Error('原卡不存在');
  if (oldCard.status !== 'active') {
    throw new Error(`仅 active 状态的卡可续，当前状态：${oldCard.status}`);
  }
  if (oldCard.remaining_meals > CARD_RENEWAL_THRESHOLD_MEALS) {
    throw new Error(
      `续卡前提：剩餐 ≤ ${CARD_RENEWAL_THRESHOLD_MEALS}，当前剩餐 ${oldCard.remaining_meals}`,
    );
  }

  const spec = getCardSpec(oldCard.is_hospital, oldCard.card_code as SubscriptionCardCode);
  if (!spec) {
    throw new Error(
      `当前卡种 ${oldCard.card_code} 已不在${oldCard.is_hospital ? '院内' : '院外'}价目表，无法续卡`,
    );
  }

  const now = new Date().toISOString();
  const carriedMeals = Math.max(0, oldCard.remaining_meals);
  const newTotal = spec.meals + carriedMeals;

  const newCard: MockCard = {
    id: nextCardId++,
    card_code: spec.code,
    card_name: spec.name,
    is_hospital: oldCard.is_hospital,
    total_meals: newTotal,
    used_meals: 0,
    remaining_meals: newTotal,
    unit_price: spec.unitPrice,
    paid_amount: spec.totalPrice,
    status: 'active',
    purchased_at: now,
    collector: input.collector,
    recorder: input.recorder,
    notes: input.notes?.trim() || undefined,
    upgraded_from: oldCard.card_name,
  };

  oldCard.status = 'upgraded';
  member.active_card = newCard;
  member.card_history = [newCard, ...member.card_history];
  member.stats.total_purchased_meals += spec.meals;
  member.stats.total_paid_amount += spec.totalPrice;

  const finance = pushFinance({
    entry_date: todayDateStr(),
    type: 'income',
    amount: newCard.paid_amount,
    category: newCard.is_hospital ? 'hospital_sub' : 'regular_sub',
    description: `${member.nickname || member.name} · 续卡 ${newCard.card_name}（结转 ${carriedMeals} 份，收款：${input.collector}）`,
    source: 'auto',
    voided: false,
  });

  return { card: newCard, finance, carriedMeals };
}

/**
 * 退卡：把 active 卡整张作废。
 * 规则（与 UI 文案一致）：
 *  - 退款金额 = 单价 × 剩餐
 *  - 旧卡状态置为 'refunded'，并记 refund_amount / refunded_at / refund_reason
 *  - 会员 active_card 清空，再想用必须重新开卡
 *  - 财务记一笔 expense（category = manual_expense，description 前缀【退卡】）
 *  - stats 不回退（total_purchased_meals / total_paid_amount 保留历史轨迹）
 */
export function mockRefundCard(input: RefundCardInput): RefundResult {
  const member = MOCK_MEMBERS.find((m) => m.id === input.memberId);
  if (!member) throw new Error('会员不存在');
  const card = member.card_history.find((c) => c.id === input.fromCardId);
  if (!card) throw new Error('原卡不存在');
  if (card.status !== 'active') {
    throw new Error(`仅 active 状态的卡可退，当前状态：${card.status}`);
  }

  const now = new Date().toISOString();
  const refundAmount = calcRefundAmount(card);
  const reason = input.reason?.trim() || undefined;

  card.status = 'refunded';
  card.refund_amount = refundAmount;
  card.refunded_at = now;
  card.refund_reason = reason;
  member.active_card = null;

  const finance = pushFinance({
    entry_date: todayDateStr(),
    type: 'expense',
    amount: refundAmount,
    category: 'manual_expense',
    description: `【退卡】${member.nickname || member.name} · ${card.card_name}（剩 ${card.remaining_meals} 份 × ¥${card.unit_price}，经办：${input.operator}${reason ? ` · 原因：${reason}` : ''}）`,
    source: 'manual',
    voided: false,
  });

  return { card, finance, refundAmount };
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

/**
 * Mock 会员资料编辑。
 * 不修改 uid（由 昵称(手机号) 规则生成，仅创建时写入）。
 */
export function mockUpdateMember(memberId: number, patch: MemberUpdateInput): MockMember {
  const member = MOCK_MEMBERS.find((m) => m.id === memberId);
  if (!member) throw new Error('会员不存在');
  member.name = patch.name.trim();
  member.nickname = patch.nickname.trim();
  member.phone = patch.phone.trim();
  member.wechat_id = patch.wechat_id.trim();
  member.address = patch.address.trim();
  member.dietary_notes = patch.dietary_notes.trim();
  member.is_hospital = patch.is_hospital;
  return member;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ==================== 今日财务汇总（与 MOCK_FINANCE 联动）====================

export interface DayFinanceSummary {
  /** 收入：按当天入账的开卡/升级/散餐等实收金额 */
  income: number;
  /** 支出：当天录入的支出金额（不含已冲销） */
  expense: number;
  /** 净额 = income - expense */
  net: number;
}

/**
 * 统计指定日期的收入 / 支出 / 净额。数据源：{@link MOCK_FINANCE}。
 * 口径：
 *  - entry_date === date
 *  - voided === false（冲销条目不计入）
 */
export function summariseFinanceForDate(
  date: string,
  entries: MockFinance[] = MOCK_FINANCE,
): DayFinanceSummary {
  let income = 0;
  let expense = 0;
  for (const e of entries) {
    if (e.voided) continue;
    if (e.entry_date !== date) continue;
    if (e.type === 'income') income += e.amount;
    else expense += e.amount;
  }
  return { income, expense, net: income - expense };
}

// 今日订餐汇总（固定 mock，不影响财务）
export const MOCK_TODAY_SUMMARY = {
  lunch_count: 8,
  dinner_count: 2,
  pending: 5,
  fulfilled: 1,
  delivered: 2,
  renewal_warnings: 1,
};
