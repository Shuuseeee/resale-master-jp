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
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{ minWidth }}
        className={`${inputClass} flex items-center gap-1`}
      >
        {selected.length === 0 ? (
          <span className="text-gray-400 dark:text-gray-500 truncate">{placeholder}</span>
        ) : (
          <div className="flex items-center gap-1 overflow-hidden flex-1 min-w-0">
            {selected.slice(0, 2).map(val => {
              const label = options.find(o => o.value === val)?.label ?? val;
              return (
                <span key={val} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 text-xs rounded flex-shrink-0">
                  {label}
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); toggle(val); }}
                    className="ml-0.5 hover:text-teal-900 dark:hover:text-teal-100 leading-none cursor-pointer"
                  >×</span>
                </span>
              );
            })}
            {selected.length > 2 && (
              <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">+{selected.length - 2}</span>
            )}
          </div>
        )}
        <svg className="w-3.5 h-3.5 text-gray-400 ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 min-w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg overflow-hidden">
          {options.map(opt => {
            const isChecked = selected.includes(opt.value);
            return (
              <label
                key={opt.value}
                className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors ${
                  isChecked
                    ? 'bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/30'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggle(opt.value)}
                  className="w-3.5 h-3.5 rounded accent-teal-600 flex-shrink-0"
                />
                <span className={`text-sm whitespace-nowrap ${isChecked ? 'text-teal-700 dark:text-teal-300 font-medium' : 'text-gray-700 dark:text-gray-300'}`}>
                  {opt.label}
                </span>
              </label>
            );
          })}
          {selected.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 px-3 py-1.5">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onChange([]); setOpen(false); }}
                className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
              >
                リセット
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
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex-1"
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          <span>筛选条件</span>
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-teal-500 text-white text-[10px] font-bold">
              {activeCount}
            </span>
          )}
          <svg
            className={`w-4 h-4 ml-auto text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
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
          className={`p-1.5 rounded-lg border transition-colors ${
            pinned
              ? 'bg-teal-50 dark:bg-teal-900/30 border-teal-300 dark:border-teal-700 text-teal-600 dark:text-teal-400'
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
          }`}
        >
          <svg className="w-4 h-4" fill={pinned ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        </button>
      </div>

      {/* 筛选内容：移动端受折叠控制，桌面端始终展开 */}
      <div className={`space-y-2 lg:block ${isExpanded ? 'block' : 'hidden'}`}>
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
        <div className="flex items-center gap-1">
          {/* 模式切换 */}
          <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600 text-xs">
            <button
              type="button"
              onClick={() => switchJanMode('include')}
              className={`px-2 py-1.5 transition-colors ${
                filters.janFilterMode === 'include'
                  ? 'bg-teal-500 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              包含
            </button>
            <button
              type="button"
              onClick={() => switchJanMode('exclude')}
              className={`px-2 py-1.5 transition-colors border-l border-gray-300 dark:border-gray-600 ${
                filters.janFilterMode === 'exclude'
                  ? 'bg-orange-500 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              除外
            </button>
          </div>

          {/* include モード: 単一選択 */}
          {filters.janFilterMode === 'include' && (
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
          )}

          {/* exclude モード: 多選 */}
          {filters.janFilterMode === 'exclude' && (
            <MultiSelect
              options={janCodes.map(j => ({ value: j, label: j }))}
              selected={filters.excludeJanCodes}
              onChange={(vals) => updateFilter('excludeJanCodes', vals)}
              placeholder="除外JAN"
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
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <select
              value={filters.buybackStore}
              onChange={(e) => updateFilter('buybackStore', e.target.value)}
              className={inputClass + ' w-[140px]' + (filters.buybackStore ? ' pr-8' : '')}
            >
              <option value="">买取店</option>
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
      </div>{/* end 折叠内容 */}
    </div>
  );
}
