// components/dashboard/DashboardFilters.tsx — 仪表盘顶部筛选（复刻买取X：期间 / JAN / 进货来源 / 支付方式 / 仅已完成 / 按售出日）
'use client';

import Select from '@/components/Select';
import Switch from '@/components/Switch';
import DatePicker from '@/components/DatePicker';
import { useTooltip } from '@/components/fluent/Tooltip';
import { formatDateToLocal, parseDateFromLocal } from '@/lib/utils/dateUtils';
import { input } from '@/lib/theme';
import { NO_CARD, type DashFilters, type PeriodMode } from '@/lib/dashboard/summary';

const PERIODS: { id: PeriodMode; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'year', label: '年度' },
  { id: 'month', label: '月度' },
  { id: 'range', label: '期间' },
];

function Toggle({ checked, onChange, label, tip }: { checked: boolean; onChange: (v: boolean) => void; label: string; tip: string }) {
  const tooltip = useTooltip(tip);
  return (
    <label {...tooltip} className="inline-flex cursor-pointer items-center gap-2 text-sm text-[var(--color-text)]">
      <Switch checked={checked} onClick={() => onChange(!checked)} label={label} />
      {label}
    </label>
  );
}

interface Props {
  filters: DashFilters;
  onChange: (next: DashFilters) => void;
  onReset: () => void;
  options: { years: string[]; months: string[]; jans: [string, string][]; sources: string[] };
  paymentMethods: { id: string; name: string }[];
  active: boolean;
}

export default function DashboardFilters({ filters: f, onChange, onReset, options, paymentMethods, active }: Props) {
  const set = (patch: Partial<DashFilters>) => onChange({ ...f, ...patch });
  const fieldClass = 'w-full md:w-44';
  const triggerClass = input.base + ' w-full';

  return (
    <div className="mb-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1" role="group" aria-label="统计期间">
          {PERIODS.map(p => (
            <button
              key={p.id}
              type="button"
              aria-pressed={f.period === p.id}
              onClick={() => set({ period: p.id })}
              className="fluent-btn fluent-btn--subtle fluent-btn--sm"
            >
              {p.label}
            </button>
          ))}
        </div>
        {f.period === 'year' && (
          <div className="w-28">
            <Select value={f.year} onChange={year => set({ year })} options={options.years.map(y => ({ value: y, label: `${y}年` }))} />
          </div>
        )}
        {f.period === 'month' && (
          <div className="w-32">
            <Select value={f.month} onChange={month => set({ month })} options={options.months.map(m => ({ value: m, label: m }))} />
          </div>
        )}
        {f.period === 'range' && (
          <div className="flex items-center gap-2">
            <div className="w-36">
              <DatePicker selected={f.from ? parseDateFromLocal(f.from) : null} onChange={d => set({ from: d ? formatDateToLocal(d) : '' })} placeholder="开始日期" />
            </div>
            <span className="text-[var(--color-text-muted)]">~</span>
            <div className="w-36">
              <DatePicker selected={f.to ? parseDateFromLocal(f.to) : null} onChange={d => set({ to: d ? formatDateToLocal(d) : '' })} placeholder="结束日期" />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 md:flex md:flex-wrap md:items-center">
        <div className={fieldClass}>
          <Select
            value={f.jan}
            onChange={jan => set({ jan })}
            placeholder="JAN"
            clearable
            className={triggerClass}
            options={options.jans.map(([jan, name]) => ({ value: jan, label: `${jan} ${name}` }))}
          />
        </div>
        <div className={fieldClass}>
          <Select value={f.source} onChange={source => set({ source })} placeholder="进货来源" clearable className={triggerClass} options={options.sources.map(s => ({ value: s, label: s }))} />
        </div>
        <div className={fieldClass}>
          <Select
            value={f.card}
            onChange={card => set({ card })}
            placeholder="支付方式"
            clearable
            className={triggerClass}
            options={[...paymentMethods.map(pm => ({ value: pm.id, label: pm.name })), { value: NO_CARD, label: '未设置支付方式' }]}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Toggle
          checked={f.completedOnly}
          onChange={completedOnly => set({ completedOnly })}
          label="仅已完成"
          tip="只统计有出售的进货：投资额只算已售部分，库存与预估利润不显示"
        />
        <Toggle
          checked={f.sellBasis}
          onChange={sellBasis => set({ sellBasis })}
          label="按售出日"
          tip="投资额、回收额、确定利润、已售数量按出售日期统计（投资额变成已售部分的原价）；关闭时按进货日。开启后不显示库存与含预估的卡片"
        />
        {active && (
          <button type="button" onClick={onReset} className="fluent-link text-sm">
            清除筛选
          </button>
        )}
      </div>
    </div>
  );
}
