// components/dashboard/DashboardFilters.tsx — 仪表盘顶部筛选（复刻买取X：期间 / JAN / 进货来源 / 支付方式 / 仅已完成 / 按售出日）
// 桌面（≥lg）平铺；手机与交易页一致：横向 chip 栏 + 底部弹层（即点即生效，components/mobile-filter.tsx）
'use client';

import { useState } from 'react';
import Select from '@/components/Select';
import Switch from '@/components/Switch';
import DatePicker from '@/components/DatePicker';
import { CHIP_BAR, Chip, ClearChip, FilterSheet, SheetOptionList } from '@/components/mobile-filter';
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

const OPTION_TIPS = {
  completedOnly: '只统计有出售的进货：投资额只算已售部分，库存与预估利润不显示',
  sellBasis: '投资额、回收额、确定利润、已售数量按出售日期统计（投资额变成已售部分的原价）；关闭时按进货日。开启后不显示库存与含预估的卡片',
  sameDay:
    '月度趋势里回收额 / 确定利润和成本记在同一个月（按进货日时都记在进货月）。关闭 = 成本记在进货月、回收和利润记在卖出月（税务上的实际归属）。开启「按售出日」时本来就在同一个月，固定为开',
};

type SheetKey = 'period' | 'jan' | 'source' | 'card' | 'options';

function Toggle({ checked, onChange, label, tip, disabled = false }: { checked: boolean; onChange: (v: boolean) => void; label: string; tip: string; disabled?: boolean }) {
  const tooltip = useTooltip(tip);
  return (
    <label {...tooltip} className={`inline-flex items-center gap-2 text-sm text-[var(--color-text)] ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <Switch checked={checked} onClick={() => !disabled && onChange(!checked)} label={label} />
      {label}
    </label>
  );
}

/** 弹层里的开关行：手机上没有悬停提示，说明直接写在下面 */
function SheetSwitch({ checked, onChange, label, desc, disabled = false }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc: string; disabled?: boolean }) {
  return (
    <div className={`flex items-start gap-3 rounded-[var(--radius-md)] px-2 py-3 ${disabled ? 'opacity-50' : ''}`}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--color-text)]">{label}</p>
        <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{desc}</p>
      </div>
      <Switch checked={checked} onClick={() => !disabled && onChange(!checked)} label={label} />
    </div>
  );
}

const sectionTitle = 'px-3 pb-1 pt-3 text-xs font-semibold text-[var(--color-text-muted)]';

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
  const triggerClass = input.base + ' w-full';
  const [sheet, setSheet] = useState<SheetKey | null>(null);
  const close = () => setSheet(null);
  const cardOptions = [...paymentMethods.map(pm => ({ value: pm.id, label: pm.name })), { value: NO_CARD, label: '未设置支付方式' }];

  const periodLabel =
    f.period === 'year' ? `${f.year}年` : f.period === 'month' ? f.month : f.period === 'range' ? `${f.from || '…'} ~ ${f.to || '…'}` : '全部期间';
  const optionCount = [f.completedOnly, f.sellBasis, f.sameDay].filter(Boolean).length;

  return (
    <>
      {/* 手机：横向 chip 栏，点开底部弹层 */}
      <div className={CHIP_BAR + ' mb-4'}>
        {active && <ClearChip onClick={onReset} />}
        <Chip label={periodLabel} active={f.period !== 'all'} onClick={() => setSheet('period')} />
        <Chip label={f.jan || 'JAN'} active={!!f.jan} onClick={() => setSheet('jan')} />
        <Chip label={f.source || '进货来源'} active={!!f.source} onClick={() => setSheet('source')} />
        <Chip label={cardOptions.find(o => o.value === f.card)?.label ?? '支付方式'} active={!!f.card} onClick={() => setSheet('card')} />
        <Chip label={optionCount ? `统计方式（${optionCount}）` : '统计方式'} active={optionCount > 0} onClick={() => setSheet('options')} />
      </div>

      {sheet === 'period' && (
        <FilterSheet title="统计期间" onClose={close} showReset={f.period !== 'all'} onReset={() => set({ period: 'all' })}>
          <SheetOptionList options={[{ value: 'all', label: '全部' }]} value={f.period === 'all' ? 'all' : ''} onSelect={() => { set({ period: 'all' }); close(); }} />
          <p className={sectionTitle}>年度</p>
          <SheetOptionList
            options={options.years.map(y => ({ value: y, label: `${y}年` }))}
            value={f.period === 'year' ? f.year : ''}
            onSelect={year => { set({ period: 'year', year }); close(); }}
          />
          <p className={sectionTitle}>月度</p>
          <SheetOptionList
            options={options.months.map(m => ({ value: m, label: m }))}
            value={f.period === 'month' ? f.month : ''}
            onSelect={month => { set({ period: 'month', month }); close(); }}
          />
          <p className={sectionTitle}>期间</p>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 pb-2">
            <DatePicker selected={f.from ? parseDateFromLocal(f.from) : null} onChange={d => set({ period: 'range', from: d ? formatDateToLocal(d) : '' })} placeholder="开始日期" />
            <span className="text-[var(--color-text-muted)]">~</span>
            <DatePicker selected={f.to ? parseDateFromLocal(f.to) : null} onChange={d => set({ period: 'range', to: d ? formatDateToLocal(d) : '' })} placeholder="结束日期" />
          </div>
        </FilterSheet>
      )}
      {sheet === 'jan' && (
        <FilterSheet title="JAN" onClose={close} showReset={!!f.jan} onReset={() => set({ jan: '' })}>
          <SheetOptionList mono options={options.jans.map(([jan, name]) => ({ value: jan, label: jan, hint: name }))} value={f.jan} onSelect={jan => { set({ jan }); close(); }} />
        </FilterSheet>
      )}
      {sheet === 'source' && (
        <FilterSheet title="进货来源" onClose={close} showReset={!!f.source} onReset={() => set({ source: '' })}>
          <SheetOptionList options={options.sources.map(v => ({ value: v, label: v }))} value={f.source} onSelect={source => { set({ source }); close(); }} />
        </FilterSheet>
      )}
      {sheet === 'card' && (
        <FilterSheet title="支付方式" onClose={close} showReset={!!f.card} onReset={() => set({ card: '' })}>
          <SheetOptionList options={cardOptions} value={f.card} onSelect={card => { set({ card }); close(); }} />
        </FilterSheet>
      )}
      {sheet === 'options' && (
        <FilterSheet title="统计方式" onClose={close}>
          <div className="space-y-1 px-1">
            <SheetSwitch checked={f.completedOnly} onChange={completedOnly => set({ completedOnly })} label="仅已完成" desc={OPTION_TIPS.completedOnly} />
            <SheetSwitch checked={f.sellBasis} onChange={sellBasis => set({ sellBasis })} label="按售出日" desc={OPTION_TIPS.sellBasis} />
            <SheetSwitch checked={f.sellBasis || f.sameDay} disabled={f.sellBasis} onChange={sameDay => set({ sameDay })} label="同一天统计" desc={OPTION_TIPS.sameDay} />
          </div>
        </FilterSheet>
      )}

      {/* 桌面：平铺 */}
      <div className="mb-4 hidden flex-col gap-3 lg:flex">
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

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-44">
            <Select
              value={f.jan}
              onChange={jan => set({ jan })}
              placeholder="JAN"
              clearable
              className={triggerClass}
              options={options.jans.map(([jan, name]) => ({ value: jan, label: `${jan} ${name}` }))}
            />
          </div>
          <div className="w-44">
            <Select value={f.source} onChange={source => set({ source })} placeholder="进货来源" clearable className={triggerClass} options={options.sources.map(s => ({ value: s, label: s }))} />
          </div>
          <div className="w-44">
            <Select value={f.card} onChange={card => set({ card })} placeholder="支付方式" clearable className={triggerClass} options={cardOptions} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Toggle checked={f.completedOnly} onChange={completedOnly => set({ completedOnly })} label="仅已完成" tip={OPTION_TIPS.completedOnly} />
          <Toggle checked={f.sellBasis} onChange={sellBasis => set({ sellBasis })} label="按售出日" tip={OPTION_TIPS.sellBasis} />
          <Toggle
            checked={f.sellBasis || f.sameDay}
            disabled={f.sellBasis}
            onChange={sameDay => set({ sameDay })}
            label="同一天统计"
            tip={OPTION_TIPS.sameDay}
          />
          {active && (
            <button type="button" onClick={onReset} className="fluent-link text-sm">
              清除筛选
            </button>
          )}
        </div>
      </div>
    </>
  );
}
