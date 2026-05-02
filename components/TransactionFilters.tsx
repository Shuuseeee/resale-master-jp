// components/TransactionFilters.tsx
// 交易列表筛选组件 - 平铺展开式筛选

'use client';

import { useState, useEffect, useRef } from 'react';
import DatePicker from '@/components/DatePicker';
import { formatDateToLocal, parseDateFromLocal } from '@/lib/utils/dateUtils';

export interface FilterValues {
  dateFrom: string;
  dateTo: string;
  dateMode: 'purchase' | 'sale';
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
  dateMode: 'purchase',
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

const FILTER_PIN_KEY = 'tx_filter_panel_pinned';

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

  // 折叠面板 & pin 偏好
  const [pinned, setPinned] = useState(() => {
    try { return localStorage.getItem(FILTER_PIN_KEY) === '1'; } catch { return false; }
  });
  const [isExpanded, setIsExpanded] = useState(() => {
    try { return localStorage.getItem(FILTER_PIN_KEY) === '1'; } catch { return false; }
  });

  const togglePin = () => {
    const next = !pinned;
    setPinned(next);
    try { localStorage.setItem(FILTER_PIN_KEY, next ? '1' : '0'); } catch {}
    if (next) setIsExpanded(true);
  };

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

  return (
    <div className="mb-4 space-y-2" data-testid="filter-panel">
      {/* 折叠面板头部 (仅移动端显示) */}
      <div className="flex items-center gap-2 lg:hidden">
        <button
          type="button"
          onClick={() => setIsExpanded(v => !v)}
          className="flex min-h-[40px] flex-1 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm font-semibold text-[var(--color-text-muted)] transition-colors active:bg-[var(--color-bg-subtle)]"
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          <span>筛选条件</span>
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-[var(--color-primary)] text-white text-[10px] font-bold">
              {activeCount}
            </span>
          )}
          <svg
            className={`w-4 h-4 ml-auto text-[var(--color-text-muted)] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {/* Pin 按钮 */}
        <button
          type="button"
          onClick={togglePin}
          title={pinned ? '取消固定（下次默认折叠）' : '固定展开（下次默认展开）'}
          className={`flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border transition-colors ${
            pinned
              ? 'bg-[var(--color-primary-light)] border-[var(--color-primary)]/30 text-[var(--color-primary)]'
              : 'bg-[var(--color-bg-elevated)] border-[var(--color-border)] text-[var(--color-text-muted)] active:bg-[var(--color-bg-subtle)]'
          }`}
        >
          <svg className="w-4 h-4" fill={pinned ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        </button>
      </div>

      {/* 筛选内容：移动端受折叠控制，桌面端始终展开 */}
      <div className={`rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3 shadow-[var(--shadow-sm)] lg:block ${isExpanded ? 'block' : 'hidden'}`}>
      {/* Row 1 */}
      <div className="grid grid-cols-1 gap-3 lg:flex lg:flex-wrap lg:items-center lg:gap-2">
        {/* Date range */}
        <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 lg:w-auto lg:grid-cols-[auto_150px_auto_150px]">
          {/* 购买/售出 日期模式切换 */}
          <div className="col-span-3 flex overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] text-xs lg:col-span-1">
            <button
              type="button"
              onClick={() => updateFilter('dateMode', 'purchase')}
              className={`flex-1 px-3 py-2 font-semibold transition-colors lg:flex-none ${
                filters.dateMode === 'purchase'
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle)]'
              }`}
            >
              购买
            </button>
            <button
              type="button"
              onClick={() => updateFilter('dateMode', 'sale')}
              className={`flex-1 border-l border-[var(--color-border)] px-3 py-2 font-semibold transition-colors lg:flex-none ${
                filters.dateMode === 'sale'
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle)]'
              }`}
            >
              售出
            </button>
          </div>
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

      </div>

      {/* Row 2: 买取店铺筛选 */}
      {hasBuybackData && (
        <div className="mt-3 grid grid-cols-1 gap-3 border-t border-[var(--color-border)] pt-3 lg:flex lg:flex-wrap lg:items-center lg:gap-2">
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
        </div>
      )}
      </div>{/* end 折叠内容 */}
    </div>
  );
}
