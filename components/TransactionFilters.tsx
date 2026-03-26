// components/TransactionFilters.tsx
// 交易列表筛选组件 - 平铺展开式筛选

'use client';

import { useState, useEffect, useRef } from 'react';
import DatePicker from '@/components/DatePicker';
import { formatDateToLocal, parseDateFromLocal } from '@/lib/utils/dateUtils';

export interface FilterValues {
  dateFrom: string;
  dateTo: string;
  productName: string;
  janCode: string;
  status: ('pending' | 'in_stock' | 'awaiting_payment' | 'sold' | 'returned')[];
  paymentMethodIds: string[];
  purchasePlatformIds: string[];
  orderNumber: string;
  buybackStore: string;
}

interface TransactionFiltersProps {
  onApply: (filters: FilterValues) => void;
  onClear: () => void;
  paymentMethods: Array<{ id: string; name: string }>;
  purchasePlatforms?: Array<{ id: string; name: string }>;
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
  status: [],
  paymentMethodIds: [],
  purchasePlatformIds: [],
  orderNumber: '',
  buybackStore: '',
};

const statusOptions = [
  { value: 'pending', label: '未着' },
  { value: 'in_stock', label: '在庫' },
  { value: 'awaiting_payment', label: '入金待ち' },
  { value: 'sold', label: '売却済' },
  { value: 'returned', label: '返品済' },
];

const inputClass = 'px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors';

// ── 多选下拉组件 ──────────────────────────────────────────
interface MultiSelectProps {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  minWidth?: string;
}

function MultiSelect({ options, selected, onChange, placeholder, minWidth = '120px' }: MultiSelectProps) {
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

  const displayLabel = selected.length === 0
    ? placeholder
    : selected.length === 1
      ? options.find(o => o.value === selected[0])?.label ?? selected[0]
      : `${placeholder} (${selected.length})`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{ minWidth }}
        className={`${inputClass} flex items-center gap-1 ${selected.length > 0 ? 'pr-8' : ''}`}
      >
        <span className={`truncate ${selected.length > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
          {displayLabel}
        </span>
        <svg className="w-3.5 h-3.5 text-gray-400 ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {selected.length > 0 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onChange([]); }}
          className="absolute right-6 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 z-10"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 min-w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg overflow-hidden">
          {options.map(opt => (
            <label
              key={opt.value}
              className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={() => toggle(opt.value)}
                className="w-3.5 h-3.5 rounded accent-teal-600 flex-shrink-0"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">{opt.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
// ─────────────────────────────────────────────────────────

export default function TransactionFilters({
  onApply,
  onClear,
  paymentMethods,
  purchasePlatforms,
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

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    const hasAny = filters.dateFrom || filters.dateTo || filters.productName || filters.janCode
      || filters.status.length > 0 || filters.paymentMethodIds.length > 0
      || filters.purchasePlatformIds.length > 0 || filters.orderNumber || filters.buybackStore;
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

  return (
    <div className="mb-4 space-y-2" data-testid="filter-panel">
      {/* Row 1 */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Date range */}
        <div className="flex items-center gap-1">
          <div className="relative w-[150px]">
            <DatePicker
              selected={filters.dateFrom ? parseDateFromLocal(filters.dateFrom) : null}
              onChange={(date) => updateFilter('dateFrom', date ? formatDateToLocal(date) : '')}
              placeholder="开始日期"
              maxDate={filters.dateTo ? parseDateFromLocal(filters.dateTo) ?? undefined : undefined}
              className={inputClass + ' w-full' + (filters.dateFrom ? ' pr-7' : '')}
            />
            {filters.dateFrom && (
              <button onClick={() => updateFilter('dateFrom', '')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 z-10" type="button">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
          <span className="text-gray-400 dark:text-gray-500 flex-shrink-0 text-sm">~</span>
          <div className="relative w-[150px]">
            <DatePicker
              selected={filters.dateTo ? parseDateFromLocal(filters.dateTo) : null}
              onChange={(date) => updateFilter('dateTo', date ? formatDateToLocal(date) : '')}
              placeholder="结束日期"
              minDate={filters.dateFrom ? parseDateFromLocal(filters.dateFrom) ?? undefined : undefined}
              className={inputClass + ' w-full' + (filters.dateTo ? ' pr-7' : '')}
            />
            {filters.dateTo && (
              <button onClick={() => updateFilter('dateTo', '')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 z-10" type="button">
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

        {/* JAN 单选下拉（含搜索） */}
        <div className="relative" ref={janRef}>
          <button
            type="button"
            onClick={() => setJanDropdownOpen(!janDropdownOpen)}
            className={inputClass + ' flex items-center gap-1 min-w-[120px]'}
          >
            <span className={filters.janCode ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}>
              {filters.janCode || 'JAN'}
            </span>
            <svg className="w-4 h-4 text-gray-400 ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {filters.janCode && (
            <button onClick={(e) => { e.stopPropagation(); updateFilter('janCode', ''); setJanSearch(''); }} className="absolute right-7 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" type="button">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
          {janDropdownOpen && (
            <div className="absolute z-50 top-full left-0 mt-1 w-[200px] max-h-[280px] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg overflow-hidden">
              <div className="p-1.5 border-b border-gray-200 dark:border-gray-700">
                <input type="text" value={janSearch} onChange={(e) => setJanSearch(e.target.value)} placeholder="搜索JAN..." className="w-full px-2 py-1 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none" autoFocus />
              </div>
              <div className="overflow-y-auto max-h-[220px]">
                {filteredJanCodes.length === 0
                  ? <div className="px-3 py-2 text-sm text-gray-400">无匹配</div>
                  : filteredJanCodes.map(jan => (
                    <button key={jan} type="button" onClick={() => { updateFilter('janCode', jan); setJanDropdownOpen(false); setJanSearch(''); }} className={`w-full text-left px-3 py-1.5 text-sm font-mono hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${filters.janCode === jan ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300' : 'text-gray-700 dark:text-gray-300'}`}>
                      {jan}
                    </button>
                  ))
                }
              </div>
            </div>
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

        {/* 订单ID */}
        <div className="relative">
          <input
            type="text"
            value={filters.orderNumber}
            onChange={(e) => updateFilter('orderNumber', e.target.value)}
            className={inputClass + ' w-[140px]' + (filters.orderNumber ? ' pr-8' : '')}
            placeholder="订单ID"
            data-testid="filter-order-number"
          />
          {filters.orderNumber && (
            <button onClick={() => updateFilter('orderNumber', '')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" type="button">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
      </div>

      {/* Row 2: 买取店铺筛选 */}
      {hasBuybackData && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">买取</span>
          <div className="relative">
            <select
              value={filters.buybackStore}
              onChange={(e) => updateFilter('buybackStore', e.target.value)}
              className={inputClass + ' w-[140px]' + (filters.buybackStore ? ' pr-8' : '')}
            >
              <option value="">店铺名</option>
              {buybackStores.map(store => (
                <option key={store} value={store}>{store}</option>
              ))}
            </select>
            {filters.buybackStore && (
              <button onClick={() => updateFilter('buybackStore', '')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" type="button">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
