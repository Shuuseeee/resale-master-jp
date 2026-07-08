// components/TransactionFilters.tsx
// 交易列表筛选组件 - 桌面端平铺展开；移动端 chip 栏 + 底部弹层（即点即生效）

'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, X } from 'lucide-react';
import DatePicker from '@/components/DatePicker';
import { formatDateToLocal, parseDateFromLocal } from '@/lib/utils/dateUtils';

export interface FilterValues {
  dateFrom: string;
  dateTo: string;
  productName: string;
  janCode: string;
  janFilterMode: 'include' | 'exclude';
  excludeJanCodes: string[];
  status: ('pending' | 'in_stock' | 'awaiting_payment' | 'sold' | 'returned')[];
  paymentMethodIds: string[];
  purchasePlatformIds: string[];
  sellingPlatformIds: string[];
  buybackStore: string;
}

interface TransactionFiltersProps {
  onApply: (filters: FilterValues) => void;
  onClear: () => void;
  paymentMethods: Array<{ id: string; name: string }>;
  purchasePlatforms?: Array<{ id: string; name: string }>;
  sellingPlatforms?: Array<{ id: string; name: string }>;
  janCodes?: string[];
  initialValues?: FilterValues | null;
  hasBuybackData?: boolean;
  buybackStores?: string[];
}

export const emptyFilters: FilterValues = {
  dateFrom: '',
  dateTo: '',
  productName: '',
  janCode: '',
  janFilterMode: 'include',
  excludeJanCodes: [],
  status: [],
  paymentMethodIds: [],
  purchasePlatformIds: [],
  sellingPlatformIds: [],
  buybackStore: '',
};

const statusOptions = [
  { value: 'pending', label: '未到货' },
  { value: 'in_stock', label: '库存中' },
  { value: 'awaiting_payment', label: '待入账' },
  { value: 'sold', label: '已售出' },
  { value: 'returned', label: '已退货' },
];

const inputClass = 'min-h-[40px] px-3.5 py-2.5 text-sm bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-[var(--radius-md)] text-[var(--color-text)] placeholder-[color:var(--color-text-muted)] placeholder:opacity-50 focus:outline-none focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary-light)] transition-all';

// ── 多选下拉组件 ──────────────────────────────────────────
interface MultiSelectProps {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  minWidth?: string;
}

function MultiSelect({ options, selected, onChange, placeholder, minWidth = '140px' }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value]);
  };

  return (
    <div className="relative w-full sm:w-auto" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{ minWidth }}
        className={`${inputClass} flex w-full items-center gap-1 text-left`}
      >
        {selected.length === 0 ? (
          <span className="text-[var(--color-text-muted)] truncate">{placeholder}</span>
        ) : (
          <div className="flex items-center gap-1 overflow-hidden flex-1 min-w-0">
            {selected.slice(0, 2).map(val => {
              const label = options.find(o => o.value === val)?.label ?? val;
              return (
                <span key={val} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-[var(--color-primary-light)] text-[var(--color-primary)] text-xs rounded flex-shrink-0">
                  {label}
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); toggle(val); }}
                    className="ml-0.5 hover:text-[var(--color-primary-hover)] leading-none cursor-pointer"
                  >×</span>
                </span>
              );
            })}
            {selected.length > 2 && (
              <span className="text-xs text-[var(--color-text-muted)] flex-shrink-0">+{selected.length - 2}</span>
            )}
          </div>
        )}
        <svg className="w-3.5 h-3.5 text-[var(--color-text-muted)] ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 min-w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-lg)] overflow-hidden">
          {options.map(opt => {
            const isChecked = selected.includes(opt.value);
            return (
              <label
                key={opt.value}
                className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors ${
                  isChecked
                    ? 'bg-[var(--color-primary-light)] hover:bg-[var(--color-primary-light)]'
                    : 'hover:bg-[var(--color-bg-subtle)]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggle(opt.value)}
                  className="w-3.5 h-3.5 rounded accent-[var(--color-primary)] flex-shrink-0"
                />
                <span className={`text-sm whitespace-nowrap ${isChecked ? 'text-[var(--color-primary)] font-semibold' : 'text-[var(--color-text)]'}`}>
                  {opt.label}
                </span>
              </label>
            );
          })}
          {selected.length > 0 && (
            <div className="border-t border-[var(--color-border)] px-3 py-1.5">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onChange([]); setOpen(false); }}
                className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors"
              >
                重置
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
// ─────────────────────────────────────────────────────────

// ── 移动端筛选 chip ──────────────────────────────────────
function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-9 flex-shrink-0 items-center gap-1 rounded-full border px-3 text-sm transition-colors ${
        active
          ? 'border-[var(--color-primary-border)] bg-[var(--color-primary-light)] font-semibold text-[var(--color-primary)]'
          : 'border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text)]'
      }`}
    >
      <span className="max-w-[40vw] truncate">{label}</span>
      <ChevronDown className={`h-3.5 w-3.5 flex-shrink-0 ${active ? '' : 'text-[var(--color-text-muted)]'}`} />
    </button>
  );
}

// ── 移动端筛选底部弹层 ──────────────────────────────────
interface FilterSheetProps {
  title: string;
  onClose: () => void;
  onReset?: () => void;
  showReset?: boolean;
  children: React.ReactNode;
}

function FilterSheet({ title, onClose, onReset, showReset = false, children }: FilterSheetProps) {
  // 锁定背景滚动（与 Modal 相同策略）
  useEffect(() => {
    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollY);
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[10010] lg:hidden">
      <div
        className="absolute inset-0 bg-black/50 animate-fade-in"
        onClick={onClose}
        onTouchMove={(e) => e.preventDefault()}
        aria-hidden="true"
      />
      <div className="absolute inset-x-0 bottom-0 flex max-h-[70vh] flex-col rounded-t-[20px] border-t border-[var(--color-border)] bg-[var(--color-bg-elevated)] animate-slide-up">
        <div className="mx-auto mt-2 h-1 w-12 flex-shrink-0 rounded-full bg-[var(--color-border)]" />
        <div className="flex flex-shrink-0 items-center justify-between px-4 pb-1 pt-1.5">
          <h3 className="text-base font-semibold text-[var(--color-text)]">{title}</h3>
          <div className="flex items-center">
            {showReset && onReset && (
              <button type="button" onClick={onReset} className="px-3 py-1.5 text-sm text-[var(--color-text-muted)] active:text-[var(--color-danger)]">
                重置
              </button>
            )}
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm font-semibold text-[var(--color-primary)]">
              完成
            </button>
          </div>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-2 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-1">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── 弹层内多选列表（即点即生效）──────────────────────────
function SheetCheckList({
  options,
  selected,
  onToggle,
  mono = false,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  mono?: boolean;
}) {
  if (options.length === 0) {
    return <div className="px-3 py-4 text-center text-sm text-[var(--color-text-muted)]">无可选项</div>;
  }
  return (
    <div>
      {options.map(opt => {
        const checked = selected.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onToggle(opt.value)}
            className={`flex min-h-[48px] w-full items-center justify-between rounded-[var(--radius-md)] px-3 text-left text-sm transition-colors active:bg-[var(--color-bg-subtle)] ${mono ? 'font-mono' : ''} ${
              checked ? 'font-semibold text-[var(--color-primary)]' : 'text-[var(--color-text)]'
            }`}
          >
            <span className="truncate">{opt.label}</span>
            {checked && <Check className="h-4 w-4 flex-shrink-0 text-[var(--color-primary)]" />}
          </button>
        );
      })}
    </div>
  );
}
// ─────────────────────────────────────────────────────────

type SheetKey = 'date' | 'status' | 'purchase' | 'selling' | 'payment' | 'jan' | 'buyback';

export default function TransactionFilters({
  onApply,
  onClear,
  paymentMethods,
  purchasePlatforms,
  sellingPlatforms,
  janCodes = [],
  initialValues,
  hasBuybackData = false,
  buybackStores = [],
}: TransactionFiltersProps) {
  const [filters, setFilters] = useState<FilterValues>(initialValues || { ...emptyFilters });
  const isFirstRender = useRef(true);
  const [janDropdownOpen, setJanDropdownOpen] = useState(false);
  const [janSearch, setJanSearch] = useState('');
  const janRef = useRef<HTMLDivElement>(null);

  // 移动端：当前打开的筛选弹层
  const [openSheet, setOpenSheet] = useState<SheetKey | null>(null);

  // 激活的筛选条件数量
  const activeCount = [
    !!(filters.dateFrom || filters.dateTo),
    !!filters.productName,
    !!(filters.janCode || filters.excludeJanCodes.length > 0),
    filters.status.length > 0,
    filters.paymentMethodIds.length > 0,
    filters.purchasePlatformIds.length > 0,
    filters.sellingPlatformIds.length > 0,
    !!filters.buybackStore,
  ].filter(Boolean).length;

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    const hasAny = filters.dateFrom || filters.dateTo || filters.productName || filters.janCode
      || filters.excludeJanCodes.length > 0
      || filters.status.length > 0 || filters.paymentMethodIds.length > 0
      || filters.purchasePlatformIds.length > 0 || filters.sellingPlatformIds.length > 0
      || filters.buybackStore;
    if (hasAny) { onApply(filters); } else { onClear(); }
  }, [filters]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (janRef.current && !janRef.current.contains(e.target as Node)) setJanDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const updateFilter = <K extends keyof FilterValues>(key: K, value: FilterValues[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const filteredJanCodes = janCodes.filter(j => !janSearch || j.includes(janSearch));

  const switchJanMode = (mode: 'include' | 'exclude') => {
    setFilters(prev => ({
      ...prev,
      janFilterMode: mode,
      // clear the other mode's selection when switching
      janCode: mode === 'exclude' ? '' : prev.janCode,
      excludeJanCodes: mode === 'include' ? [] : prev.excludeJanCodes,
    }));
  };

  // ── 移动端 chip 文案 ──
  const mmdd = (s: string) => (s ? s.slice(5).replace('-', '/') : '');
  const dateChipLabel = filters.dateFrom || filters.dateTo
    ? `${mmdd(filters.dateFrom) || '…'}〜${mmdd(filters.dateTo) || '…'}`
    : '日期';
  const multiChipLabel = (noun: string, ids: string[], resolve: (id: string) => string) =>
    ids.length === 0 ? noun : ids.length === 1 ? resolve(ids[0]) : `${resolve(ids[0])} +${ids.length - 1}`;
  const statusChipLabel = multiChipLabel('状态', filters.status, v => statusOptions.find(o => o.value === v)?.label ?? v);
  const purchaseChipLabel = multiChipLabel('采购平台', filters.purchasePlatformIds, id => (purchasePlatforms || []).find(p => p.id === id)?.name ?? id);
  const sellingChipLabel = multiChipLabel('售出平台', filters.sellingPlatformIds, id => (sellingPlatforms || []).find(p => p.id === id)?.name ?? id);
  const paymentChipLabel = multiChipLabel('账号', filters.paymentMethodIds, id => paymentMethods.find(p => p.id === id)?.name ?? id);
  const janChipLabel = filters.janCode
    ? filters.janCode
    : filters.excludeJanCodes.length > 0 ? `排除 ${filters.excludeJanCodes.length} 个JAN` : 'JAN';

  const applyDatePreset = (kind: '7d' | '30d' | 'month') => {
    const today = new Date();
    const from = new Date(today);
    if (kind === '7d') from.setDate(today.getDate() - 6);
    else if (kind === '30d') from.setDate(today.getDate() - 29);
    else from.setDate(1);
    setFilters(prev => ({ ...prev, dateFrom: formatDateToLocal(from), dateTo: formatDateToLocal(today) }));
  };

  const toggleIn = (list: string[], v: string) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v]);

  return (
    <div className="mb-4 space-y-2" data-testid="filter-panel">
      {/* 移动端：横向 chip 栏，点击弹出对应筛选弹层 */}
      <div className="flex gap-2 overflow-x-auto lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {activeCount > 0 && (
          <button
            type="button"
            onClick={() => setFilters({ ...emptyFilters })}
            className="flex h-9 flex-shrink-0 items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 text-sm text-[var(--color-text-muted)] active:text-[var(--color-danger)]"
          >
            <X className="h-3.5 w-3.5" />
            清除
          </button>
        )}
        {/* 最高报价店使用频率最高，固定在 chip 栏最前 */}
        {hasBuybackData && (
          <Chip label={filters.buybackStore || '最高报价店'} active={!!filters.buybackStore} onClick={() => setOpenSheet('buyback')} />
        )}
        <Chip label={dateChipLabel} active={!!(filters.dateFrom || filters.dateTo)} onClick={() => setOpenSheet('date')} />
        <Chip label={statusChipLabel} active={filters.status.length > 0} onClick={() => setOpenSheet('status')} />
        {(purchasePlatforms || []).length > 0 && (
          <Chip label={purchaseChipLabel} active={filters.purchasePlatformIds.length > 0} onClick={() => setOpenSheet('purchase')} />
        )}
        {(sellingPlatforms || []).length > 0 && (
          <Chip label={sellingChipLabel} active={filters.sellingPlatformIds.length > 0} onClick={() => setOpenSheet('selling')} />
        )}
        <Chip label={paymentChipLabel} active={filters.paymentMethodIds.length > 0} onClick={() => setOpenSheet('payment')} />
        {janCodes.length > 0 && (
          <Chip
            label={janChipLabel}
            active={!!filters.janCode || filters.excludeJanCodes.length > 0}
            onClick={() => { setJanSearch(''); setOpenSheet('jan'); }}
          />
        )}
      </div>

      {/* 桌面端平铺筛选面板 */}
      <div className="hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3 shadow-[var(--shadow-sm)] lg:block">
      {/* Row 1 */}
      <div className="grid grid-cols-1 gap-3 lg:flex lg:flex-wrap lg:items-center lg:gap-2">
        {/* Date range */}
        <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 lg:w-auto lg:grid-cols-[150px_auto_150px]">
          <div className="relative min-w-0 lg:w-[150px]">
            <DatePicker
              selected={filters.dateFrom ? parseDateFromLocal(filters.dateFrom) : null}
              onChange={(date) => updateFilter('dateFrom', date ? formatDateToLocal(date) : '')}
              placeholder="开始日期"
              maxDate={filters.dateTo ? parseDateFromLocal(filters.dateTo) ?? undefined : undefined}
              className={inputClass + ' w-full' + (filters.dateFrom ? ' pr-7' : '')}
            />
            {filters.dateFrom && (
              <button onClick={() => updateFilter('dateFrom', '')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)] z-10" type="button">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
          <span className="text-[var(--color-text-muted)] flex-shrink-0 text-sm">~</span>
          <div className="relative min-w-0 lg:w-[150px]">
            <DatePicker
              selected={filters.dateTo ? parseDateFromLocal(filters.dateTo) : null}
              onChange={(date) => updateFilter('dateTo', date ? formatDateToLocal(date) : '')}
              placeholder="结束日期"
              minDate={filters.dateFrom ? parseDateFromLocal(filters.dateFrom) ?? undefined : undefined}
              className={inputClass + ' w-full' + (filters.dateTo ? ' pr-7' : '')}
            />
            {filters.dateTo && (
              <button onClick={() => updateFilter('dateTo', '')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)] z-10" type="button">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        </div>

        {/* 采购平台 多选 */}
        {(purchasePlatforms || []).length > 0 && (
          <MultiSelect
            options={(purchasePlatforms || []).map(p => ({ value: p.id, label: p.name }))}
            selected={filters.purchasePlatformIds}
            onChange={(vals) => updateFilter('purchasePlatformIds', vals)}
            placeholder="采购平台"
          />
        )}

        {/* 售出平台 多选 */}
        {(sellingPlatforms || []).length > 0 && (
          <MultiSelect
            options={(sellingPlatforms || []).map(p => ({ value: p.id, label: p.name }))}
            selected={filters.sellingPlatformIds}
            onChange={(vals) => updateFilter('sellingPlatformIds', vals)}
            placeholder="售出平台"
          />
        )}

        {/* JAN 筛选（含む/除外切换） */}
        <div className="grid w-full grid-cols-[auto_1fr] items-center gap-2 lg:w-auto">
          {/* 模式切换 */}
          <div className="flex overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] text-xs">
            <button
              type="button"
              onClick={() => switchJanMode('include')}
              className={`px-3 py-2 font-semibold transition-colors ${
                filters.janFilterMode === 'include'
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle)]'
              }`}
            >
              包含
            </button>
            <button
              type="button"
              onClick={() => switchJanMode('exclude')}
              className={`border-l border-[var(--color-border)] px-3 py-2 font-semibold transition-colors ${
                filters.janFilterMode === 'exclude'
                  ? 'bg-[var(--color-warning)] text-white'
                  : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle)]'
              }`}
            >
              排除
            </button>
          </div>

          {/* include モード: 単一選択 */}
          {filters.janFilterMode === 'include' && (
            <div className="relative min-w-0" ref={janRef}>
              <button
                type="button"
                onClick={() => setJanDropdownOpen(!janDropdownOpen)}
                className={inputClass + ' flex w-full items-center gap-1 text-left lg:min-w-[120px]'}
              >
                <span className={filters.janCode ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)]'}>
                  {filters.janCode || 'JAN'}
                </span>
                <svg className="w-4 h-4 text-[var(--color-text-muted)] ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {filters.janCode && (
                <button onClick={(e) => { e.stopPropagation(); updateFilter('janCode', ''); setJanSearch(''); }} className="absolute right-7 top-1/2 -translate-y-1/2 p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)]" type="button">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
              {janDropdownOpen && (
                <div className="absolute z-50 top-full left-0 mt-1 w-full min-w-[220px] max-h-[280px] bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-lg)] overflow-hidden">
                  <div className="p-1.5 border-b border-[var(--color-border)]">
                    <input type="text" value={janSearch} onChange={(e) => setJanSearch(e.target.value)} placeholder="搜索 JAN..." className="w-full px-2 py-1 text-sm bg-[var(--color-bg-subtle)] border border-[var(--color-border)] rounded-[var(--radius-sm)] text-[var(--color-text)] placeholder-[color:var(--color-text-muted)] focus:outline-none" autoFocus />
                  </div>
                  <div className="overflow-y-auto max-h-[220px]">
                    {filteredJanCodes.length === 0
                      ? <div className="px-3 py-2 text-sm text-[var(--color-text-muted)]">无匹配</div>
                      : filteredJanCodes.map(jan => (
                        <button key={jan} type="button" onClick={() => { updateFilter('janCode', jan); setJanDropdownOpen(false); setJanSearch(''); }} className={`w-full text-left px-3 py-1.5 text-sm font-mono transition-colors hover:bg-[var(--color-bg-subtle)] ${filters.janCode === jan ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)]' : 'text-[var(--color-text)]'}`}>
                          {jan}
                        </button>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>
          )}

          {/* exclude モード: 多選 */}
          {filters.janFilterMode === 'exclude' && (
            <MultiSelect
              options={janCodes.map(j => ({ value: j, label: j }))}
              selected={filters.excludeJanCodes}
              onChange={(vals) => updateFilter('excludeJanCodes', vals)}
              placeholder="排除 JAN"
              minWidth="160px"
            />
          )}
        </div>

        {/* 账号 多选 */}
        <MultiSelect
          options={paymentMethods.map(pm => ({ value: pm.id, label: pm.name }))}
          selected={filters.paymentMethodIds}
          onChange={(vals) => updateFilter('paymentMethodIds', vals)}
          placeholder="账号"
        />

        {/* 状态 多选 */}
        <MultiSelect
          options={statusOptions}
          selected={filters.status}
          onChange={(vals) => updateFilter('status', vals as FilterValues['status'])}
          placeholder="状态"
          minWidth="100px"
        />

        {/* 最高报价店：与其他筛选器平级，加入同一行自动换行（买取数据加载后出现） */}
        {hasBuybackData && (
          <div className="relative w-full sm:w-auto">
            <select
              value={filters.buybackStore}
              onChange={(e) => updateFilter('buybackStore', e.target.value)}
              className={inputClass + ' w-full sm:w-[160px]' + (filters.buybackStore ? ' pr-8' : '')}
            >
              <option value="">最高报价店</option>
              {buybackStores.map(store => (
                <option key={store} value={store}>{store}</option>
              ))}
            </select>
            {filters.buybackStore && (
              <button onClick={() => updateFilter('buybackStore', '')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)]" type="button">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        )}

      </div>
      </div>{/* end 桌面面板 */}

      {/* ── 移动端筛选弹层 ── */}
      {openSheet === 'date' && (
        <FilterSheet
          title="日期范围"
          onClose={() => setOpenSheet(null)}
          showReset={!!(filters.dateFrom || filters.dateTo)}
          onReset={() => setFilters(prev => ({ ...prev, dateFrom: '', dateTo: '' }))}
        >
          <div className="space-y-3 px-2 pt-1">
            <div className="flex gap-2">
              {([['7d', '近7天'], ['30d', '近30天'], ['month', '本月']] as const).map(([kind, label]) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => applyDatePreset(kind)}
                  className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)] py-2 text-sm text-[var(--color-text)] active:bg-[var(--color-primary-light)]"
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <DatePicker
                selected={filters.dateFrom ? parseDateFromLocal(filters.dateFrom) : null}
                onChange={(date) => updateFilter('dateFrom', date ? formatDateToLocal(date) : '')}
                placeholder="开始日期"
                maxDate={filters.dateTo ? parseDateFromLocal(filters.dateTo) ?? undefined : undefined}
                className={inputClass + ' w-full'}
              />
              <span className="text-sm text-[var(--color-text-muted)]">~</span>
              <DatePicker
                selected={filters.dateTo ? parseDateFromLocal(filters.dateTo) : null}
                onChange={(date) => updateFilter('dateTo', date ? formatDateToLocal(date) : '')}
                placeholder="结束日期"
                minDate={filters.dateFrom ? parseDateFromLocal(filters.dateFrom) ?? undefined : undefined}
                className={inputClass + ' w-full'}
              />
            </div>
          </div>
        </FilterSheet>
      )}

      {openSheet === 'status' && (
        <FilterSheet
          title="状态"
          onClose={() => setOpenSheet(null)}
          showReset={filters.status.length > 0}
          onReset={() => updateFilter('status', [])}
        >
          <SheetCheckList
            options={statusOptions}
            selected={filters.status}
            onToggle={(v) => updateFilter('status', toggleIn(filters.status, v) as FilterValues['status'])}
          />
        </FilterSheet>
      )}

      {openSheet === 'purchase' && (
        <FilterSheet
          title="采购平台"
          onClose={() => setOpenSheet(null)}
          showReset={filters.purchasePlatformIds.length > 0}
          onReset={() => updateFilter('purchasePlatformIds', [])}
        >
          <SheetCheckList
            options={(purchasePlatforms || []).map(p => ({ value: p.id, label: p.name }))}
            selected={filters.purchasePlatformIds}
            onToggle={(v) => updateFilter('purchasePlatformIds', toggleIn(filters.purchasePlatformIds, v))}
          />
        </FilterSheet>
      )}

      {openSheet === 'selling' && (
        <FilterSheet
          title="售出平台"
          onClose={() => setOpenSheet(null)}
          showReset={filters.sellingPlatformIds.length > 0}
          onReset={() => updateFilter('sellingPlatformIds', [])}
        >
          <SheetCheckList
            options={(sellingPlatforms || []).map(p => ({ value: p.id, label: p.name }))}
            selected={filters.sellingPlatformIds}
            onToggle={(v) => updateFilter('sellingPlatformIds', toggleIn(filters.sellingPlatformIds, v))}
          />
        </FilterSheet>
      )}

      {openSheet === 'payment' && (
        <FilterSheet
          title="账号"
          onClose={() => setOpenSheet(null)}
          showReset={filters.paymentMethodIds.length > 0}
          onReset={() => updateFilter('paymentMethodIds', [])}
        >
          <SheetCheckList
            options={paymentMethods.map(pm => ({ value: pm.id, label: pm.name }))}
            selected={filters.paymentMethodIds}
            onToggle={(v) => updateFilter('paymentMethodIds', toggleIn(filters.paymentMethodIds, v))}
          />
        </FilterSheet>
      )}

      {openSheet === 'jan' && (
        <FilterSheet
          title="JAN 筛选"
          onClose={() => setOpenSheet(null)}
          showReset={!!filters.janCode || filters.excludeJanCodes.length > 0}
          onReset={() => setFilters(prev => ({ ...prev, janCode: '', excludeJanCodes: [] }))}
        >
          <div className="px-2 pt-1">
            <div className="mb-2 flex overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] text-xs">
              <button
                type="button"
                onClick={() => switchJanMode('include')}
                className={`flex-1 py-2 font-semibold transition-colors ${
                  filters.janFilterMode === 'include' ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-muted)]'
                }`}
              >
                包含
              </button>
              <button
                type="button"
                onClick={() => switchJanMode('exclude')}
                className={`flex-1 border-l border-[var(--color-border)] py-2 font-semibold transition-colors ${
                  filters.janFilterMode === 'exclude' ? 'bg-[var(--color-warning)] text-white' : 'text-[var(--color-text-muted)]'
                }`}
              >
                排除
              </button>
            </div>
            <input
              type="text"
              inputMode="numeric"
              value={janSearch}
              onChange={(e) => setJanSearch(e.target.value)}
              placeholder="搜索 JAN..."
              className={inputClass + ' mb-1 w-full'}
            />
            {filters.janFilterMode === 'include' ? (
              filteredJanCodes.length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-[var(--color-text-muted)]">无匹配</div>
              ) : (
                filteredJanCodes.map(jan => (
                  <button
                    key={jan}
                    type="button"
                    onClick={() => { updateFilter('janCode', filters.janCode === jan ? '' : jan); setOpenSheet(null); }}
                    className={`flex min-h-[48px] w-full items-center justify-between rounded-[var(--radius-md)] px-3 text-left font-mono text-sm transition-colors active:bg-[var(--color-bg-subtle)] ${
                      filters.janCode === jan ? 'font-semibold text-[var(--color-primary)]' : 'text-[var(--color-text)]'
                    }`}
                  >
                    {jan}
                    {filters.janCode === jan && <Check className="h-4 w-4 flex-shrink-0 text-[var(--color-primary)]" />}
                  </button>
                ))
              )
            ) : (
              <SheetCheckList
                options={filteredJanCodes.map(j => ({ value: j, label: j }))}
                selected={filters.excludeJanCodes}
                onToggle={(v) => updateFilter('excludeJanCodes', toggleIn(filters.excludeJanCodes, v))}
                mono
              />
            )}
          </div>
        </FilterSheet>
      )}

      {openSheet === 'buyback' && (
        <FilterSheet
          title="最高报价店"
          onClose={() => setOpenSheet(null)}
          showReset={!!filters.buybackStore}
          onReset={() => updateFilter('buybackStore', '')}
        >
          <div className="px-2 pt-1">
            {buybackStores.map(store => (
              <button
                key={store}
                type="button"
                onClick={() => { updateFilter('buybackStore', filters.buybackStore === store ? '' : store); setOpenSheet(null); }}
                className={`flex min-h-[48px] w-full items-center justify-between rounded-[var(--radius-md)] px-3 text-left text-sm transition-colors active:bg-[var(--color-bg-subtle)] ${
                  filters.buybackStore === store ? 'font-semibold text-[var(--color-primary)]' : 'text-[var(--color-text)]'
                }`}
              >
                <span className="truncate">{store}</span>
                {filters.buybackStore === store && <Check className="h-4 w-4 flex-shrink-0 text-[var(--color-primary)]" />}
              </button>
            ))}
          </div>
        </FilterSheet>
      )}
    </div>
  );
}
