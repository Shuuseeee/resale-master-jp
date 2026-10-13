// components/transactions/AwaitingOrderCard.tsx — 待入账「按订单」的对账卡片
// 一张卡片 = 一张出售订单（同一订单售出建的 sale_orders；没有的按 店铺 + 订单号）。逐件列 商品 × 数量 × 单价 = 小计
// （同一商品同一单价来自几笔进货时合并成一行），
// 与买取店的承诺书逐行对得上；应入金额 = 买取合计 − 手续费（平台费用）。运费不计入：用户的运费单独记在经费里，店铺也不从货款扣。
// 「实际入金」只用来比对（不存库），一致显示 ✓，不一致显示差额。
'use client';

import { useState } from 'react';
import { CheckmarkCircle16Filled } from '@fluentui/react-icons/headless/svg/checkmark-circle';
import { formatCurrency } from '@/lib/financial/calculator';
import { button, card } from '@/lib/theme';
import { parseNumberInput } from '@/lib/number-utils';

export interface AwaitingOrderLine {
  saleId: string;
  transactionId: string;
  productName: string;
  janCode: string | null;
  qty: number;
  unitPrice: number;
  subtotal: number;
  fee: number;
}

export interface AwaitingOrder {
  key: string;
  platformName: string | null;
  orderNumber: string | null;
  saleDate: string;
  daysPending: number;
  lines: AwaitingOrderLine[];
  total: number;
  fees: number;
  expected: number;
  transactionIds: string[];
}

export default function AwaitingOrderCard({ order, onConfirm }: { order: AwaitingOrder; onConfirm: () => void }) {
  const [actual, setActual] = useState('');
  const actualValue = actual.trim() === '' ? null : parseNumberInput(actual, 0);
  const diff = actualValue == null ? null : actualValue - order.expected;
  const urgent = order.daysPending >= 14 ? 'text-[var(--color-danger)]' : order.daysPending >= 7 ? 'text-[var(--color-warning)]' : 'text-[var(--color-text-muted)]';

  return (
    <div className={card.primary + ' p-4'}>
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {order.platformName && (
              <span className="inline-flex shrink-0 items-center rounded-[var(--radius-sm)] bg-[var(--label-platform-bg)] px-1.5 text-sm leading-[22px] text-[var(--label-platform-fg)]">
                {order.platformName}
              </span>
            )}
            <span className="select-all font-mono text-sm font-semibold text-[var(--color-text)]">{order.orderNumber ? `订单 ${order.orderNumber}` : '无订单号'}</span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
            <span>{order.saleDate.replace(/-/g, '/')} 售出</span>
            <span className={urgent + ' font-medium'}>待 {order.daysPending} 天</span>
          </div>
        </div>
        <button type="button" onClick={onConfirm} className={button.primary + ' shrink-0'}>
          确认入账
        </button>
      </div>

      {/* 逐件：与承诺书逐行对照 */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
            <th className="py-1 text-left font-normal">商品</th>
            <th className="py-1 text-right font-normal">数量</th>
            <th className="py-1 text-right font-normal">单价</th>
            <th className="py-1 text-right font-normal">小计</th>
          </tr>
        </thead>
        <tbody>
          {order.lines.map(l => (
            <tr key={l.saleId} className="border-b border-[var(--color-border)] last:border-b-0">
              <td className="py-1.5 pr-2">
                <div className="line-clamp-1 break-all text-[var(--color-text)]">{l.productName}</div>
                {l.janCode && <div className="font-mono text-xs text-[var(--color-text-muted)]">{l.janCode}</div>}
              </td>
              <td className="py-1.5 text-right tabular-nums">{l.qty}</td>
              <td className="py-1.5 text-right tabular-nums">{formatCurrency(l.unitPrice)}</td>
              <td className="py-1.5 text-right tabular-nums text-[var(--color-text)]">{formatCurrency(l.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="mt-2 space-y-1 border-t border-[var(--color-border)] pt-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-[var(--color-text-secondary)]">买取合计</dt>
          <dd className="tabular-nums text-[var(--color-text)]">{formatCurrency(order.total)}</dd>
        </div>
        {order.fees > 0 && (
          <div className="flex justify-between">
            <dt className="text-[var(--color-text-secondary)]">手续费</dt>
            <dd className="tabular-nums text-[var(--color-text)]">−{formatCurrency(order.fees)}</dd>
          </div>
        )}
        <div className="flex items-baseline justify-between">
          <dt className="font-semibold text-[var(--color-text)]">应入金额</dt>
          <dd className="text-lg font-semibold tabular-nums text-[var(--color-text)]">{formatCurrency(order.expected)}</dd>
        </div>
      </dl>

      {/* 实际入金：只用来比对，不存库 */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="text-sm text-[var(--color-text-secondary)]" htmlFor={`actual-${order.key}`}>
          实际入金
        </label>
        <input
          id={`actual-${order.key}`}
          type="text"
          inputMode="numeric"
          value={actual}
          onChange={e => setActual(e.target.value)}
          placeholder="对照入金明细填"
          className="fluent-input w-40"
        />
        {diff != null &&
          (diff === 0 ? (
            <span className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-success)]">
              <CheckmarkCircle16Filled />
              一致
            </span>
          ) : (
            <span className="text-sm font-medium text-[var(--color-danger)]">
              {diff > 0 ? '多' : '少'} {formatCurrency(Math.abs(diff))}
            </span>
          ))}
      </div>
    </div>
  );
}
