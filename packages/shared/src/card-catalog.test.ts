import { describe, expect, it } from 'vitest';
import {
  CARD_CATALOG,
  AD_HOC_UNIT_PRICE,
  buildCustomCardSpec,
  getCardSpec,
  listCards,
  listUpgradeOptions,
} from './card-catalog';

describe('card-catalog', () => {
  describe('目录 schema', () => {
    it('散餐单价是 35 元', () => {
      expect(AD_HOC_UNIT_PRICE).toBe(35);
    });

    it('院外 4 种卡 / 院内 6 种卡', () => {
      expect(Object.keys(CARD_CATALOG.regular)).toHaveLength(4);
      expect(Object.keys(CARD_CATALOG.hospital)).toHaveLength(6);
    });

    it('所有卡都满足 meals × unitPrice = totalPrice', () => {
      for (const spec of [
        ...Object.values(CARD_CATALOG.regular),
        ...Object.values(CARD_CATALOG.hospital),
      ]) {
        expect(spec.meals * spec.unitPrice).toBe(spec.totalPrice);
      }
    });

    it('院内价格严格小于等于同规格院外价格（年卡相等；其它院内更便宜）', () => {
      // 大周卡 院内 230 < 院外 280
      expect(CARD_CATALOG.hospital.week.totalPrice).toBeLessThan(
        CARD_CATALOG.regular.week.totalPrice,
      );
      // 年卡 院内 9600 == 院外 9600
      expect(CARD_CATALOG.hospital.year.totalPrice).toBe(
        CARD_CATALOG.regular.year.totalPrice,
      );
    });
  });

  describe('getCardSpec', () => {
    it('院外会员拿到院外价目表的卡', () => {
      const spec = getCardSpec(false, 'month');
      expect(spec?.totalPrice).toBe(1000);
    });

    it('院内会员拿到院内价目表的卡', () => {
      const spec = getCardSpec(true, 'month');
      expect(spec?.totalPrice).toBe(880);
    });

    it('院外没有 small_week / experience，返回 null', () => {
      expect(getCardSpec(false, 'small_week')).toBeNull();
      expect(getCardSpec(false, 'experience')).toBeNull();
    });

    it('院内有 small_week 和 experience', () => {
      expect(getCardSpec(true, 'small_week')?.totalPrice).toBe(125);
      expect(getCardSpec(true, 'experience')?.totalPrice).toBe(50);
    });
  });

  describe('listCards', () => {
    it('按总价升序排列', () => {
      const cards = listCards(true);
      for (let i = 1; i < cards.length; i++) {
        expect(cards[i]!.totalPrice).toBeGreaterThanOrEqual(cards[i - 1]!.totalPrice);
      }
    });

    it('院内第一张是体验卡（50 元最便宜）', () => {
      const cards = listCards(true);
      expect(cards[0]?.code).toBe('experience');
    });

    it('院外第一张是大周卡', () => {
      const cards = listCards(false);
      expect(cards[0]?.code).toBe('week');
    });
  });

  describe('listUpgradeOptions（禁降级的核心逻辑）', () => {
    it('院内持 230 元大周卡 → 可升级到月/季/年（3 个选项）', () => {
      const options = listUpgradeOptions(true, 230);
      expect(options).toHaveLength(3);
      expect(options.map((o) => o.code)).toEqual(['month', 'season', 'year']);
    });

    it('院内持 880 元月卡 → 可升级到季/年（2 个选项）', () => {
      const options = listUpgradeOptions(true, 880);
      expect(options.map((o) => o.code)).toEqual(['season', 'year']);
    });

    it('持 9600 元年卡 → 无法升级（空数组）', () => {
      expect(listUpgradeOptions(true, 9600)).toHaveLength(0);
      expect(listUpgradeOptions(false, 9600)).toHaveLength(0);
    });

    it('同价位不算可升级（严格大于）', () => {
      // 假设有人持 230 元院内大周卡，院内大周卡本身 230 元不作为升级选项
      const options = listUpgradeOptions(true, 230);
      expect(options.map((o) => o.code)).not.toContain('week');
    });
  });

  describe('自定义套餐', () => {
    it('getCardSpec 对 custom 返回 null', () => {
      expect(getCardSpec(false, 'custom')).toBeNull();
      expect(getCardSpec(true, 'custom')).toBeNull();
    });

    it('buildCustomCardSpec 计算单价', () => {
      const s = buildCustomCardSpec('瓜包餐', 20, 500);
      expect(s.code).toBe('custom');
      expect(s.name).toBe('瓜包餐');
      expect(s.meals).toBe(20);
      expect(s.totalPrice).toBe(500);
      expect(s.unitPrice).toBe(25);
    });
  });
});
