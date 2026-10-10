// components/dashboard/SummaryCards.tsx — 六张指标卡（复刻买取X：投资额 / 回收额 / 确定利润 / 利润（含预估）/ 已售数量 / 库存）
'use client';

import { useState, type ReactNode } from 'react';
import Switch from '@/components/Switch';
import { InfoTip } from '@/components/dashboard/controls';
import { formatCurrency } from '@/lib/financial/calculator';
import { card } from '@/lib/theme';
import type { DashSummary } from '@/lib/dashboard/summary';

function Card({ label, tip, extra, value, tone, children }: { label: ReactNode; tip: string; extra?: ReactNode; value: string; tone?: 'success' | 'danger'; children?: ReactNode }) {
  const toneClass = tone === 'success' ? 'text-[var(--color-success)]' : tone === 'danger' ? 'text-[var(--color-danger)]' : 'text-[var(--color-text)]';
  return (
    <div className={card.primary + ' flex flex-col p-4'}>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className="flex items-center gap-1 whitespace-nowrap text-xs font-medium text-[var(--color-text-muted)]">
          {label}
          <InfoTip text={tip} />
        </span>
        {extra}
      </div>
      <div className={`mt-1 truncate text-xl font-semibold ${toneClass}`}>{value}</div>
      {children && <div className="mt-1 space-y-0.5 text-xs text-[var(--color-text-muted)]">{children}</div>}
    </div>
  );
}

const tone = (n: number) => (n > 0 ? 'success' : n < 0 ? 'danger' : undefined);

export default function SummaryCards({ s }: { s: DashSummary }) {
  const [cashOnly, setCashOnly] = useState(false);
  const profit = cashOnly ? s.cashProfit : s.profit;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      <Card
        label="投资额（总额）"
        tip="进货单价 × 数量（不含运费）。实际投资额 = 总额 − 获得积分（把积分返点当成即时减免算出的现金成本）。按售出日 / 仅已完成时只算已售部分。"
        value={formatCurrency(s.investment)}
      >
        <div>实际 {formatCurrency(s.netInvestment)}</div>
        <div>使用积分 {formatCurrency(s.pointsUsed)}</div>
        <div>获得积分 {formatCurrency(s.pointsEarned)}</div>
        <div>经费 {formatCurrency(s.expenses)}</div>
      </Card>

      <Card label="回收额" tip="各次出售的售价 × 数量合计。扣除 = 平台手续费 + 运费等。" value={formatCurrency(s.revenue)}>
        <div>扣除 {formatCurrency(s.deduction)}</div>
      </Card>

      <Card
        label="确定利润"
        tip="回收额 − 扣除 − 售出部分成本 − 退货损失 − 经费。只算已售出部分。打开「不计积分」= 不把积分返点算作利润的纯现金利润。利润率 = 确定利润 ÷（售出部分成本 + 退货损失）。"
        extra={
          <label className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-[var(--color-text-muted)]">
            不计积分
            <Switch checked={cashOnly} onClick={() => setCashOnly(!cashOnly)} label="不计积分" />
          </label>
        }
        value={formatCurrency(profit)}
        tone={tone(profit)}
      >
        <div>利润率 {s.profitRate.toFixed(1)}%</div>
        {s.returnLoss > 0 && <div>退货损失 −{formatCurrency(s.returnLoss)}</div>}
        {s.expenses > 0 && <div>经费 −{formatCurrency(s.expenses)}</div>}
      </Card>

      {!s.hideStock && (
        <Card
          label="利润（含预估）"
          tip="确定利润 + 预估利润。预估利润 = 未售部分按当前最高买取价（7 天内的报价、按设置里勾选的店铺）卖掉的利润。"
          value={formatCurrency(s.totalWithEstimated)}
          tone={tone(s.totalWithEstimated)}
        >
          <div>预估利润（未售） {formatCurrency(s.estimatedProfit)}</div>
        </Card>
      )}

      <Card label="已售数量" tip="已售出商品的累计数量（含多次出售）。" value={s.soldQty.toLocaleString()} />

      {!s.hideStock && (
        <Card label="库存" tip="尚未卖出的数量（已到货 + 未到货），下方是按进货单价计算的金额。" value={s.unsoldQty.toLocaleString()}>
          <div>已到货 {s.unsoldQty - s.pendingQty} / 未到货 {s.pendingQty}</div>
          <div>{formatCurrency(s.unsoldCost)}</div>
          <div>已到货 {formatCurrency(s.arrivedCost)} / 未到货 {formatCurrency(s.pendingCost)}</div>
        </Card>
      )}
    </div>
  );
}
