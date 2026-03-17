// components/TransactionFilters.tsx
// 交易列表筛选组件 - 即时筛选 + 筛选标签

'use client';

import { useState, useEffect, useRef } from 'react';
import { input } from '@/lib/theme';
import DatePicker from '@/components/DatePicker';

export interface FilterValues {
  dateFrom: string;
  dateTo: string;
  productName: string;
  janCode: string;
  status: ('pending' | 'in_stock' | 'awaiting_payment' | 'sold' | 'returned')[];
  paymentMethodId: string;
  purchasePlatformId: string;
}

interface TransactionFiltersProps {
  onApply: (filters: FilterValues) => void;
  onClear: () => void;
  paymentMethods: Array<{ id: string; name: string }>;
  purchasePlatforms?: Array<{ id: string; name: string }>;
  initialValues?: FilterValues | null;
}

const emptyFilters: FilterValues = {
  dateFrom: '',
  dateTo: '',
  productName: '',
  janCode: '',
  status: [],
  paymentMethodId: '',
  purchasePlatformId: '',
};

const statusLabels: Record<string, string> = {
  pending: '未着',
  in_stock: '在庫',
  awaiting_payment: '入金待ち',
  sold: '売却済',
  returned: '返品済',
};

export default function TransactionFilters({ onApply, onClear, paymentMethods, purchasePlatforms, initialValues }: TransactionFiltersProps) {
  const hasInitialValues = initialValues && (initialValues.dateFrom || initialValues.dateTo || initialValues.productName || initialValues.janCode || initialValues.status.length > 0 || initialValues.paymentMethodId || initialValues.purchasePlatformId);

  const [filters, setFilters] = useState<FilterValues>(initialValues || { ...emptyFilters });
  const [isExpanded, setIsExpanded] = useState(!!hasInitialValues);
  const isFirstRender = useRef(true);

  // Auto-apply filters on change (skip first render)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const hasAny = filters.dateFrom || filters.dateTo || filters.productName || filters.janCode || filters.status.length > 0 || filters.paymentMethodId || filters.purchasePlatformId;
    if (hasAny) {
      onApply(filters);
    } else {
      onClear();
    }
  }, [filters]);

  const updateFilter = <K extends keyof FilterValues>(key: K, value: FilterValues[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const toggleStatus = (status: 'pending' | 'in_stock' | 'awaiting_payment' | 'sold' | 'returned') => {
    setFilters(prev => ({
      ...prev,
      status: prev.status.includes(status)
        ? prev.status.filter(s => s !== status)
        : [...prev.status, status]
    }));
  };

  const removeFilter = (key: keyof FilterValues, statusValue?: string) => {
    if (key === 'status' && statusValue) {
      setFilters(prev => ({
        ...prev,
        status: prev.status.filter(s => s !== statusValue),
      }));
    } else {
      setFilters(prev => ({
        ...prev,
        [key]: key === 'status' ? [] : '',
      }));
    }
  };

  const handleClearAll = () => {
    setFilters({ ...emptyFilters });
    onClear();
  };

  // Build active filter chips
  const activeChips: Array<{ key: keyof FilterValues; label: string; value?: string }> = [];
  if (filters.dateFrom) activeChips.push({ key: 'dateFrom', label: `${filters.dateFrom} 起` });
  if (filters.dateTo) activeChips.push({ key: 'dateTo', label: `${filters.dateTo} 至` });
  if (filters.productName) activeChips.push({ key: 'productName', label: `"${filters.productName}"` });
  if (filters.janCode) activeChips.push({ key: 'janCode', label: `JAN: ${filters.janCode}` });
  filters.status.forEach(s => activeChips.push({ key: 'status', label: statusLabels[s], value: s }));
  if (filters.paymentMethodId) {
    const pm = paymentMethods.find(p => p.id === filters.paymentMethodId);
    activeChips.push({ key: 'paymentMethodId', label: pm?.name || '支付方式' });
  }
  if (filters.purchasePlatformId) {
    const pp = purchasePlatforms?.find(p => p.id === filters.purchasePlatformId);
    activeChips.push({ key: 'purchasePlatformId', label: pp?.name || '采购平台' });
  }

  const hasActiveFilters = activeChips.length > 0;

  return (
    <div className="mb-6 space-y-3">
      {/* Filter toggle button + active chips */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
            isExpanded
              ? 'bg-teal-600 text-white shadow-md'
              : hasActiveFilters
                ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border border-teal-300 dark:border-teal-700'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
          data-testid="filter-toggle"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          筛选
          {hasActiveFilters && (
            <span className={`inline-flex items-center justify-center w-5 h-5 text-xs rounded-full ${
              isExpanded ? 'bg-white/20 text-white' : 'bg-teal-600 text-white'
            }`}>
              {activeChips.length}
            </span>
          )}
        </button>

        {/* Active filter chips */}
        {activeChips.map((chip, i) => (
          <span
            key={`${chip.key}-${chip.value || i}`}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 text-xs font-medium rounded-full border border-teal-200 dark:border-teal-800"
            data-testid={`filter-chip-${chip.key}`}
          >
            {chip.label}
            <button
              onClick={() => removeFilter(chip.key, chip.value)}
              className="ml-0.5 p-0.5 hover:bg-teal-200 dark:hover:bg-teal-800 rounded-full transition-colors"
              data-testid={`filter-chip-remove-${chip.key}`}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}

        {hasActiveFilters && (
          <button
            onClick={handleClearAll}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
            data-testid="filter-clear-all"
          >
            全部清除
          </button>
        )}
      </div>

      {/* Filter panel */}
      {isExpanded && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4" data-testid="filter-panel">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 日期范围 */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
                開始日期
              </label>
              <DatePicker
                selected={filters.dateFrom ? new Date(filters.dateFrom) : null}
                onChange={(date) => updateFilter('dateFrom', date ? date.toISOString().split('T')[0] : '')}
                placeholder="开始日期..."
                maxDate={filters.dateTo ? new Date(filters.dateTo) : undefined}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
                结束日期
              </label>
              <DatePicker
                selected={filters.dateTo ? new Date(filters.dateTo) : null}
                onChange={(date) => updateFilter('dateTo', date ? date.toISOString().split('T')[0] : '')}
                placeholder="结束日期..."
                minDate={filters.dateFrom ? new Date(filters.dateFrom) : undefined}
              />
            </div>

            {/* 商品名称 */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
                商品名称
              </label>
              <input
                type="text"
                value={filters.productName}
                onChange={(e) => updateFilter('productName', e.target.value)}
                className={input.base + ' w-full'}
                placeholder="按商品名称搜索..."
                data-testid="filter-product-name"
              />
            </div>

            {/* JAN絞込 */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
                JAN筛选
              </label>
              <input
                type="text"
                value={filters.janCode}
                onChange={(e) => updateFilter('janCode', e.target.value)}
                className={input.base + ' w-full'}
                placeholder="按JAN代码筛选..."
                data-testid="filter-jan-code"
              />
            </div>

            {/* 状態 */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
                状态
              </label>
              <div className="flex flex-wrap gap-1.5">
                {(['pending', 'in_stock', 'awaiting_payment', 'sold', 'returned'] as const).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleStatus(s)}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
                      filters.status.includes(s)
                        ? s === 'pending' ? 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 ring-1 ring-teal-400'
                        : s === 'in_stock' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 ring-1 ring-amber-400'
                        : s === 'awaiting_payment' ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-400'
                        : s === 'sold' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-400'
                        : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 ring-1 ring-red-400'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                    data-testid={`filter-status-${s}`}
                  >
                    {statusLabels[s]}
                  </button>
                ))}
              </div>
            </div>

            {/* 支付方式 */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
                支付方式
              </label>
              <select
                value={filters.paymentMethodId}
                onChange={(e) => updateFilter('paymentMethodId', e.target.value)}
                className={input.base + ' w-full'}
                data-testid="filter-payment-method"
              >
                <option value="">全部</option>
                {paymentMethods.map(pm => (
                  <option key={pm.id} value={pm.id}>{pm.name}</option>
                ))}
              </select>
            </div>

            {/* 采购平台 */}
            {purchasePlatforms && purchasePlatforms.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
                  采购平台
                </label>
                <select
                  value={filters.purchasePlatformId}
                  onChange={(e) => updateFilter('purchasePlatformId', e.target.value)}
                  className={input.base + ' w-full'}
                  data-testid="filter-purchase-platform"
                >
                  <option value="">全部</option>
                  {purchasePlatforms.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
