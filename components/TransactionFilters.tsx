// components/TransactionFilters.tsx
// 交易列表筛选组件 - ServiceNow风格

'use client';

import { useState } from 'react';
import { button, input } from '@/lib/theme';
import DatePicker from '@/components/DatePicker';

export interface FilterValues {
  dateFrom: string;
  dateTo: string;
  productName: string;
  status: ('in_stock' | 'sold' | 'returned')[];
  paymentMethodId: string;
}

interface TransactionFiltersProps {
  onApply: (filters: FilterValues) => void;
  onClear: () => void;
  paymentMethods: Array<{ id: string; name: string }>;
}

export default function TransactionFilters({ onApply, onClear, paymentMethods }: TransactionFiltersProps) {
  const [filters, setFilters] = useState<FilterValues>({
    dateFrom: '',
    dateTo: '',
    productName: '',
    status: [],
    paymentMethodId: '',
  });

  const [isExpanded, setIsExpanded] = useState(false);

  const handleApply = () => {
    onApply(filters);
  };

  const handleClear = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      productName: '',
      status: [],
      paymentMethodId: '',
    });
    onClear();
  };

  const toggleStatus = (status: 'in_stock' | 'sold' | 'returned') => {
    setFilters(prev => ({
      ...prev,
      status: prev.status.includes(status)
        ? prev.status.filter(s => s !== status)
        : [...prev.status, status]
    }));
  };

  const hasActiveFilters = filters.dateFrom || filters.dateTo || filters.productName || filters.status.length > 0 || filters.paymentMethodId;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg mb-6">
      {/* 筛选器标题栏 */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            筛选器
            {hasActiveFilters && (
              <span className="ml-2 text-sm text-blue-600 dark:text-blue-400">
                (已应用)
              </span>
            )}
          </h3>
        </div>
        <svg
          className={`w-5 h-5 text-gray-600 dark:text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* 筛选器内容 */}
      {isExpanded && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
          {/* 日期范围 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              日期范围
            </label>
            <div className="grid grid-cols-2 gap-3">
              <DatePicker
                selected={filters.dateFrom ? new Date(filters.dateFrom) : null}
                onChange={(date) => setFilters({ ...filters, dateFrom: date ? date.toISOString().split('T')[0] : '' })}
                placeholder="开始日期"
                maxDate={filters.dateTo ? new Date(filters.dateTo) : undefined}
              />
              <DatePicker
                selected={filters.dateTo ? new Date(filters.dateTo) : null}
                onChange={(date) => setFilters({ ...filters, dateTo: date ? date.toISOString().split('T')[0] : '' })}
                placeholder="结束日期"
                minDate={filters.dateFrom ? new Date(filters.dateFrom) : undefined}
              />
            </div>
          </div>

          {/* 商品名称 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              商品名称
            </label>
            <input
              type="text"
              value={filters.productName}
              onChange={(e) => setFilters({ ...filters, productName: e.target.value })}
              className={input.base}
              placeholder="搜索商品名称..."
            />
          </div>

          {/* 状态 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              状态
            </label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.status.includes('in_stock')}
                  onChange={() => toggleStatus('in_stock')}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">库存中</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.status.includes('sold')}
                  onChange={() => toggleStatus('sold')}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">已售出</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.status.includes('returned')}
                  onChange={() => toggleStatus('returned')}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">已退货</span>
              </label>
            </div>
          </div>

          {/* 支付方式 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              支付方式
            </label>
            <select
              value={filters.paymentMethodId}
              onChange={(e) => setFilters({ ...filters, paymentMethodId: e.target.value })}
              className={input.base}
            >
              <option value="">全部</option>
              {paymentMethods.map(pm => (
                <option key={pm.id} value={pm.id}>{pm.name}</option>
              ))}
            </select>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleApply}
              className={button.primary + ' flex-1'}
            >
              应用筛选
            </button>
            <button
              onClick={handleClear}
              className={button.secondary + ' flex-1'}
            >
              清除筛选
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
