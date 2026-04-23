/**
 * 演示 Mock 数据 — 仅用于 UI 开发阶段展示效果。
 * 实际数据来自 API。
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
  status: 'active' | 'upgraded' | 'exhausted';
  purchased_at: string;
  collector: string;
  notes?: string;
  upgraded_from?: string;
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

// 今日汇总
export const MOCK_TODAY_SUMMARY = {
  lunch_count: 8,
  dinner_count: 2,
  pending: 5,
  fulfilled: 1,
  delivered: 2,
  income_today: 880 + 280,
  expense_today: 320,
  renewal_warnings: 2, // 萍水相逢剩3餐，小米剩1餐
};
