// components/TransactionFilters.tsx
// 交易列表筛选组件 - 平铺展开式筛选

'use client';

import { useState, useEffect, useRef } from 'react';
import DatePicker from '@/components/DatePicker';

export interface FilterValues {
  dateFrom: string;
  dateTo: string;
  productName: string;
  janCode: string;
  status: ('pending' | 'in_stock' | 'awaiting_payment' | 'sold' | 'returned')[];
  paymentMethodId: string;
  purchasePlatformId: string;
  orderNumber: string;
}

interface TransactionFiltersProps {
  onApply: (filters: FilterValues) => void;
  onClear: () => void;
  paymentMethods: Array<{ id: string; name: string }>;
  purchasePlatforms?: Array<{ id: string; name: string }>;
  janCodes?: string[];
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
  orderNumber: '',
};

const statusOptions = [
  { value: '', label: '状态' },
  { value: 'pending', label: '未着' },
  { value: 'in_stock', label: '在庫' },
  { value: 'awaiting_payment', label: '入金待ち' },
  { value: 'sold', label: '売却済' },
  { value: 'returned', label: '返品済' },
];

const inputClass = 'px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors';

export default function TransactionFilters({
  onApply,
  onClear,
  paymentMethods,
  purchasePlatforms,
  janCodes = [],
  initialValues,
}: TransactionFiltersProps) {
  const [filters, setFilters] = useState<FilterValues>(initialValues || { ...emptyFilters });
  const isFirstRender = useRef(true);
  const [janDropdownOpen, setJanDropdownOpen] = useState(false);
  const [janSearch, setJanSearch] = useState('');
  const janRef = useRef<HTMLDivElement>(null);

  // Auto-apply filters on change (skip first render)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const hasAny = filters.dateFrom || filters.dateTo || filters.productName || filters.janCode || filters.status.length > 0 || filters.paymentMethodId || filters.purchasePlatformId || filters.orderNumber;
    if (hasAny) {
      onApply(filters);
    } else {
      onClear();
    }
  }, [filters]);

  // Close JAN dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (janRef.current && !janRef.current.contains(e.target as Node)) {
        setJanDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const updateFilter = <K extends keyof FilterValues>(key: K, value: FilterValues[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const filteredJanCodes = janCodes.filter(j =>
    !janSearch || j.includes(janSearch)
  );

  return (
    <div className="mb-4 space-y-2" data-testid="filter-panel">
      {/* Row 1 */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Date range */}
        <div className="flex items-center gap-1">
          <div className="relative w-[130px]">
            <DatePicker
              selected={filters.dateFrom ? new Date(filters.dateFrom) : null}
              onChange={(date) => updateFilter('dateFrom', date ? date.toISOString().split('T')[0] : '')}
              placeholder="开始日期"
              maxDate={filters.dateTo ? new Date(filters.dateTo) : undefined}
              className={inputClass + ' w-full' + (filters.dateFrom ? ' pr-7' : '')}
            />
            {filters.dateFrom && (
              <button
                onClick={() => updateFilter('dateFrom', '')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 z-10"
                type="button"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <span className="text-gray-400 dark:text-gray-500 flex-shrink-0 text-sm">~</span>
          <div className="relative w-[130px]">
            <DatePicker
              selected={filters.dateTo ? new Date(filters.dateTo) : null}
              onChange={(date) => updateFilter('dateTo', date ? date.toISOString().split('T')[0] : '')}
              placeholder="结束日期"
              minDate={filters.dateFrom ? new Date(filters.dateFrom) : undefined}
              className={inputClass + ' w-full' + (filters.dateTo ? ' pr-7' : '')}
            />
            {filters.dateTo && (
              <button
                onClick={() => updateFilter('dateTo', '')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 z-10"
                type="button"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Platform dropdown with clear */}
        <div className="relative">
          <select
            value={filters.purchasePlatformId}
            onChange={(e) => updateFilter('purchasePlatformId', e.target.value)}
            className={inputClass + (filters.purchasePlatformId ? ' pr-8' : '')}
            data-testid="filter-purchase-platform"
          >
            <option value="">采购平台</option>
            {(purchasePlatforms || []).map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {filters.purchasePlatformId && (
            <button
              onClick={() => updateFilter('purchasePlatformId', '')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              type="button"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* JAN dropdown with search */}
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
            <button
              onClick={(e) => {
                e.stopPropagation();
                updateFilter('janCode', '');
                setJanSearch('');
              }}
              className="absolute right-7 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              type="button"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          {janDropdownOpen && (
            <div className="absolute z-50 top-full left-0 mt-1 w-[200px] max-h-[280px] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg overflow-hidden">
              <div className="p-1.5 border-b border-gray-200 dark:border-gray-700">
                <input
                  type="text"
                  value={janSearch}
                  onChange={(e) => setJanSearch(e.target.value)}
                  placeholder="搜索JAN..."
                  className="w-full px-2 py-1 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none"
                  autoFocus
                />
              </div>
              <div className="overflow-y-auto max-h-[220px]">
                {filteredJanCodes.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-400">无匹配</div>
                ) : (
                  filteredJanCodes.map(jan => (
                    <button
                      key={jan}
                      type="button"
                      onClick={() => {
                        updateFilter('janCode', jan);
                        setJanDropdownOpen(false);
                        setJanSearch('');
                      }}
                      className={`w-full text-left px-3 py-1.5 text-sm font-mono hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                        filters.janCode === jan ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300' : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {jan}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Account / Payment method dropdown with clear */}
        <div className="relative">
          <select
            value={filters.paymentMethodId}
            onChange={(e) => updateFilter('paymentMethodId', e.target.value)}
            className={inputClass + (filters.paymentMethodId ? ' pr-8' : '')}
            data-testid="filter-payment-method"
          >
            <option value="">账号</option>
            {paymentMethods.map(pm => (
              <option key={pm.id} value={pm.id}>{pm.name}</option>
            ))}
          </select>
          {filters.paymentMethodId && (
            <button
              onClick={() => updateFilter('paymentMethodId', '')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              type="button"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Status dropdown with clear */}
        <div className="relative">
          <select
            value={filters.status.length === 1 ? filters.status[0] : ''}
            onChange={(e) => {
              const val = e.target.value;
              updateFilter('status', val ? [val as FilterValues['status'][number]] : []);
            }}
            className={inputClass + (filters.status.length > 0 ? ' pr-8' : '')}
            data-testid="filter-status"
          >
            {statusOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {filters.status.length > 0 && (
            <button
              onClick={() => updateFilter('status', [])}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              type="button"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Order ID with clear */}
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
            <button
              onClick={() => updateFilter('orderNumber', '')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              type="button"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

    </div>
  );
}
