import { memo } from 'react';
import { StatTile } from '../ui/StatTile';
import { Bento, BentoGrid } from '../ui/BentoGrid';
import { COLORS, SPACING } from '../../theme/paperTheme';
import { formatCNY } from '@meal/shared';

export type TodayQuickTab = 'summary' | 'fulfillment';

export type TodayFinanceSnapshot = {
  income: number;
  expense: number;
  net: number;
  realized_income: number;
  realized_net: number;
};

type Props = {
  tab: TodayQuickTab;
  fin: TodayFinanceSnapshot;
  pendingCount: number;
};

function HomeTodayStatsInner({ tab, fin, pendingCount }: Props) {
  if (tab === 'summary') {
    return (
      <BentoGrid gap={SPACING.md}>
        <Bento span={3} mobileSpan={6}>
          <StatTile
            layout="compact"
            label="今日总收入"
            value={formatCNY(fin.income)}
            icon="arrow-up-circle-outline"
            color={COLORS.brand}
            tint="info"
            hint="账本全部收入（含预收等）"
          />
        </Bento>
        <Bento span={3} mobileSpan={6}>
          <StatTile
            layout="compact"
            label="今日支出"
            value={formatCNY(fin.expense)}
            icon="arrow-down-circle-outline"
            color={COLORS.danger}
            tint="danger"
          />
        </Bento>
        <Bento span={3} mobileSpan={6}>
          <StatTile
            layout="compact"
            label="今日净额"
            value={formatCNY(fin.net)}
            icon={fin.net >= 0 ? 'checkmark-circle-outline' : 'close-circle-outline'}
            color={fin.net >= 0 ? COLORS.success : COLORS.danger}
            tint={fin.net >= 0 ? 'ok' : 'danger'}
            hint="总收入减总支出"
          />
        </Bento>
        <Bento span={3} mobileSpan={6}>
          <StatTile
            layout="compact"
            label="待出餐"
            value={`${pendingCount} 份`}
            icon="time-outline"
            color={COLORS.warning}
            tint="warn"
          />
        </Bento>
      </BentoGrid>
    );
  }

  return (
    <BentoGrid gap={SPACING.md}>
      <Bento span={3} mobileSpan={6}>
        <StatTile
          layout="compact"
          label="今日履约收入"
          value={formatCNY(fin.realized_income)}
          icon="restaurant-outline"
          color={COLORS.success}
          tint="ok"
          hint="已送达餐费（院内/院外/散客）"
        />
      </Bento>
      <Bento span={3} mobileSpan={6}>
        <StatTile
          layout="compact"
          label="今日支出"
          value={formatCNY(fin.expense)}
          icon="arrow-down-circle-outline"
          color={COLORS.danger}
          tint="danger"
        />
      </Bento>
      <Bento span={3} mobileSpan={6}>
        <StatTile
          layout="compact"
          label="今日净额"
          value={formatCNY(fin.realized_net)}
          icon={fin.realized_net >= 0 ? 'checkmark-circle-outline' : 'close-circle-outline'}
          color={fin.realized_net >= 0 ? COLORS.success : COLORS.danger}
          tint={fin.realized_net >= 0 ? 'ok' : 'danger'}
          hint="履约收入减当日支出"
        />
      </Bento>
      <Bento span={3} mobileSpan={6}>
        <StatTile
          layout="compact"
          label="待出餐"
          value={`${pendingCount} 份`}
          icon="time-outline"
          color={COLORS.warning}
          tint="warn"
        />
      </Bento>
    </BentoGrid>
  );
}

export const HomeTodayStats = memo(HomeTodayStatsInner);
