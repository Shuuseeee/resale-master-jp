// app/transactions/page.tsx
'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import type { Transaction, PaymentMethod } from '@/types/database.types';
import { formatCurrency, formatROI } from '@/lib/financial/calculator';
import { markTransactionArrived } from '@/lib/api/financial';
import Link from 'next/link';
import { layout, heading, card, button, input } from '@/lib/theme';
import TransactionFilters, { type FilterValues } from '@/components/TransactionFilters';
import TransactionCard from '@/components/TransactionCard';
import TransactionRow from '@/components/TransactionRow';
import { getPurchasePlatforms } from '@/lib/api/platforms';
import { exportTransactionsToCSV, downloadCSV } from '@/lib/api/export-csv';

interface TransactionWithPayment extends Transaction {
  payment_method?: PaymentMethod;
  latest_sale_date?: string | null;
  aggregated_profit?: number | null;
  aggregated_roi?: number | null;
  aggregated_actual_cash_spent?: number | null;
}

type SortField = 'date' | 'purchase_price_total' | 'total_profit' | 'roi';
type SortOrder = 'asc' | 'desc';
type DateSortMode = 'purchase' | 'sale'; // 日期排序模式

interface PaymentMethodBasic {
  id: string;
  name: string;
}

function TransactionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [transactions, setTransactions] = useState<TransactionWithPayment[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodBasic[]>([]);
  const [purchasePlatforms, setPurchasePlatforms] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in_stock' | 'sold' | 'returned'>(
    () => (searchParams.get('tab') as any) || 'all'
  );
  const [sortField, setSortField] = useState<SortField>(() => (searchParams.get('sort') as SortField) || 'date');
  const [sortOrder, setSortOrder] = useState<SortOrder>(() => (searchParams.get('order') as SortOrder) || 'desc');
  const [dateSortMode, setDateSortMode] = useState<DateSortMode>(() => (searchParams.get('dsm') as DateSortMode) || 'purchase');
  const [activeFilters, setActiveFilters] = useState<FilterValues | null>(() => {
    // 从 URL 恢复高级筛选
    const dateFrom = searchParams.get('df') || '';
    const dateTo = searchParams.get('dt') || '';
    const productName = searchParams.get('pn') || '';
    const statusParam = searchParams.get('st');
    const status = statusParam ? statusParam.split(',') as FilterValues['status'] : [];
    const paymentMethodId = searchParams.get('pm') || '';
    const purchasePlatformId = searchParams.get('pp') || '';
    if (dateFrom || dateTo || productName || status.length > 0 || paymentMethodId || purchasePlatformId) {
      return { dateFrom, dateTo, productName, status, paymentMethodId, purchasePlatformId };
    }
    return null;
  });
  const [exporting, setExporting] = useState(false);

  // 统计数据
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inStock: 0,
    sold: 0,
    returned: 0,
    totalCost: 0,
    totalProfit: 0,
    avgROI: 0,
  });

  useEffect(() => {
    loadTransactions();
    loadPaymentMethods();
    loadPurchasePlatforms();
  }, []);

  useEffect(() => {
    calculateStats();
  }, [transactions]);

  // 筛选条件变化时同步到 URL
  const syncFiltersToURL = useCallback(() => {
    const params = new URLSearchParams();
    if (searchTerm) params.set('q', searchTerm);
    if (statusFilter !== 'all') params.set('tab', statusFilter);
    if (sortField !== 'date') params.set('sort', sortField);
    if (sortOrder !== 'desc') params.set('order', sortOrder);
    if (dateSortMode !== 'purchase') params.set('dsm', dateSortMode);
    if (activeFilters) {
      if (activeFilters.dateFrom) params.set('df', activeFilters.dateFrom);
      if (activeFilters.dateTo) params.set('dt', activeFilters.dateTo);
      if (activeFilters.productName) params.set('pn', activeFilters.productName);
      if (activeFilters.status.length > 0) params.set('st', activeFilters.status.join(','));
      if (activeFilters.paymentMethodId) params.set('pm', activeFilters.paymentMethodId);
      if (activeFilters.purchasePlatformId) params.set('pp', activeFilters.purchasePlatformId);
    }
    const qs = params.toString();
    router.replace(qs ? `/transactions?${qs}` : '/transactions', { scroll: false });
  }, [searchTerm, statusFilter, sortField, sortOrder, dateSortMode, activeFilters, router]);

  useEffect(() => {
    if (!loading) {
      syncFiltersToURL();
    }
  }, [searchTerm, statusFilter, sortField, sortOrder, dateSortMode, activeFilters, loading]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          payment_method:payment_methods(*)
        `)
        .order('date', { ascending: false });

      if (error) throw error;

      // 对于有销售记录的商品，计算累计利润和ROI，并获取最新销售日期
      const transactionsWithPartialProfit = await Promise.all(
        (data || []).map(async (transaction) => {
          // 获取该交易的所有销售记录
          const { data: salesRecords } = await supabase
            .from('sales_records')
            .select('total_profit, roi, actual_cash_spent, sale_date')
            .eq('transaction_id', transaction.id)
            .order('sale_date', { ascending: false });

          let latest_sale_date = null;
          let aggregated_profit = null;
          let aggregated_roi = null;
          let aggregated_actual_cash_spent = null;

          if (salesRecords && salesRecords.length > 0) {
            // 获取最新销售日期
            latest_sale_date = salesRecords[0].sale_date;

            // 计算累计利润和加权ROI（对所有有销售记录的商品）
            if (transaction.quantity_sold > 0) {
              aggregated_profit = salesRecords.reduce((sum, r) => sum + (r.total_profit || 0), 0);
              const totalCashSpent = salesRecords.reduce((sum, r) => sum + (r.actual_cash_spent || 0), 0);
              aggregated_actual_cash_spent = totalCashSpent;
              aggregated_roi = totalCashSpent > 0 ? (aggregated_profit / totalCashSpent) * 100 : 0;
            }
          }

          return {
            ...transaction,
            latest_sale_date,
            aggregated_profit,
            aggregated_roi,
            aggregated_actual_cash_spent,
          };
        })
      );

      setTransactions(transactionsWithPartialProfit);
    } catch (error) {
      console.error('加载交易记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPaymentMethods = async () => {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('id, name')
      .eq('is_active', true)
      .order('name');

    if (!error && data) {
      setPaymentMethods(data);
    }
  };

  const loadPurchasePlatforms = async () => {
    const data = await getPurchasePlatforms();
    setPurchasePlatforms(data.map(p => ({ id: p.id, name: p.name })));
  };

  const calculateStats = () => {
    const pending = transactions.filter(t => t.status === 'pending');
    const inStock = transactions.filter(t => t.status === 'in_stock');
    const sold = transactions.filter(t => t.status === 'sold');
    const returned = transactions.filter(t => t.status === 'returned');

    const totalCost = transactions.reduce((sum, t) => sum + t.purchase_price_total, 0);
    const totalProfit = sold.reduce((sum, t) => sum + (t.total_profit || 0), 0);
    const totalActualCashSpent = sold.reduce((sum, t) => sum + (t.aggregated_actual_cash_spent || 0), 0);
    const avgROI = totalActualCashSpent > 0
      ? (totalProfit / totalActualCashSpent) * 100
      : 0;

    setStats({
      total: transactions.length,
      pending: pending.length,
      inStock: inStock.length,
      sold: sold.length,
      returned: returned.length,
      totalCost,
      totalProfit,
      avgROI,
    });
  };

  const handleApplyFilters = (filters: FilterValues) => {
    setActiveFilters(filters);
  };

  const handleClearFilters = () => {
    setActiveFilters(null);
  };

  // 筛选和排序
  const filteredTransactions = transactions
    .filter(t => {
      // 原有的搜索和状态筛选
      const matchesSearch = t.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           t.notes?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;

      // 高级筛选
      if (activeFilters) {
        // 日期筛选
        if (activeFilters.dateFrom && t.date < activeFilters.dateFrom) return false;
        if (activeFilters.dateTo && t.date > activeFilters.dateTo) return false;

        // 商品名称筛选
        if (activeFilters.productName && !t.product_name.toLowerCase().includes(activeFilters.productName.toLowerCase())) {
          return false;
        }

        // 状态筛选（多选）
        if (activeFilters.status.length > 0 && !activeFilters.status.includes(t.status)) {
          return false;
        }

        // 支付方式筛选
        if (activeFilters.paymentMethodId && t.card_id !== activeFilters.paymentMethodId) {
          return false;
        }

        // 購入先筛选
        if (activeFilters.purchasePlatformId && t.purchase_platform_id !== activeFilters.purchasePlatformId) {
          return false;
        }
      }

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      let aValue: any;
      let bValue: any;

      // 如果是日期排序，根据模式选择购买日期或销售日期
      if (sortField === 'date') {
        if (dateSortMode === 'sale') {
          aValue = (a as any).latest_sale_date || '9999-12-31'; // 没有销售日期的排在最后
          bValue = (b as any).latest_sale_date || '9999-12-31';
        } else {
          aValue = a.date;
          bValue = b.date;
        }
      } else {
        aValue = a[sortField];
        bValue = b[sortField];
      }

      // 处理 null 值
      if (aValue === null || aValue === undefined) aValue = 0;
      if (bValue === null || bValue === undefined) bValue = 0;

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const deleteTransaction = async (id: string) => {
    if (!confirm('确定要删除这条交易记录吗？此操作无法撤销。')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setTransactions(transactions.filter(t => t.id !== id));
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败，请重试');
    }
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const csv = await exportTransactionsToCSV();
      downloadCSV(csv);
    } catch (error: any) {
      alert(error.message || 'CSV导出失败');
    } finally {
      setExporting(false);
    }
  };

  const handleMarkArrived = async (id: string) => {
    const success = await markTransactionArrived(id);
    if (success) {
      setTransactions(prev =>
        prev.map(t => t.id === id ? { ...t, status: 'in_stock' as const } : t)
      );
    } else {
      alert('着荷処理に失敗しました');
    }
  };

  if (loading) {
    return (
      <div className={layout.page + ' flex items-center justify-center'}>
        <div className="flex items-center gap-3 text-gray-900 dark:text-white">
          <svg className="animate-spin h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-xl">加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={layout.page}>
      <div className={layout.container}>
        {/* 标题区域 */}
        <div className={layout.section}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className={heading.h1 + ' mb-2'}>交易记录</h1>
              <p className="text-gray-600 dark:text-gray-400">管理您的所有转卖交易</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleExportCSV}
                disabled={exporting}
                className={button.primary + ' flex items-center gap-2 !bg-gray-700 hover:!bg-gray-600'}
              >
                {exporting ? (
                  <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                )}
                {exporting ? '导出中...' : 'CSV导出'}
              </button>
              <Link
                href="/transactions/add"
                className={button.primary + ' flex items-center gap-2'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                记录新交易
              </Link>
            </div>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className={card.stat}>
            <div className="text-gray-600 dark:text-gray-400 text-sm mb-1">总成本</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(stats.totalCost)}</div>
          </div>
          <div className={card.stat}>
            <div className="text-gray-600 dark:text-gray-400 text-sm mb-1">总利润</div>
            <div className={`text-2xl font-bold ${stats.totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'}`}>
              {formatCurrency(stats.totalProfit)}
            </div>
          </div>
          <div className={card.stat}>
            <div className="text-gray-600 dark:text-gray-400 text-sm mb-1">平均ROI</div>
            <div className={`text-2xl font-bold ${stats.avgROI >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'}`}>
              {formatROI(stats.avgROI)}
            </div>
          </div>
        </div>

        {/* タブバー */}
        <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
          {([
            { key: 'all', label: '全部', count: stats.total },
            { key: 'in_stock', label: '在庫', count: stats.inStock, color: 'amber' },
            { key: 'pending', label: '未着', count: stats.pending, color: 'teal' },
            { key: 'sold', label: '売却済', count: stats.sold, color: 'emerald' },
            { key: 'returned', label: '返品済', count: stats.returned, color: 'red' },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                statusFilter === tab.key
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 text-xs ${statusFilter === tab.key ? 'text-teal-100' : 'text-gray-400 dark:text-gray-500'}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* 高级筛选器 */}
        <TransactionFilters
          onApply={handleApplyFilters}
          onClear={handleClearFilters}
          paymentMethods={paymentMethods}
          purchasePlatforms={purchasePlatforms}
          initialValues={activeFilters}
        />

        {/* 搜索 */}
        <div className={card.primary + ' p-6 shadow-2xl mb-6'}>
          <div className="relative">
            <input
              type="text"
              placeholder="搜索商品名称或备注..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={input.base + ' pl-12 w-full'}
            />
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* 交易列表 */}
        {filteredTransactions.length === 0 ? (
          <div className={card.primary + ' shadow-2xl p-12 text-center'}>
            <svg className="w-16 h-16 text-gray-600 dark:text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-gray-600 dark:text-gray-400 text-lg">暂无交易记录</p>
            <Link
              href="/transactions/add"
              className={button.primary + ' inline-block mt-4'}
            >
              添加第一条交易
            </Link>
          </div>
        ) : (
          <>
            {/* 移动端：卡片列表 */}
            <div className="md:hidden space-y-3">
              {filteredTransactions.map((transaction) => (
                <TransactionCard
                  key={transaction.id}
                  transaction={transaction}
                  dateSortMode={dateSortMode}
                  onDelete={deleteTransaction}
                  onMarkArrived={handleMarkArrived}
                />
              ))}
            </div>

            {/* 桌面端：表格 */}
            <div className="hidden md:block">
              <div className={card.primary + ' shadow-2xl overflow-hidden'}>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                          商品
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleSort('date')}
                              className="flex items-center gap-1 hover:text-white transition-colors"
                            >
                              {dateSortMode === 'purchase' ? '购买日期' : '销售日期'}
                              {sortField === 'date' && (
                                <svg className={`w-4 h-4 ${sortOrder === 'asc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              )}
                            </button>
                            <button
                              onClick={() => setDateSortMode(dateSortMode === 'purchase' ? 'sale' : 'purchase')}
                              className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                              title="切换日期类型"
                            >
                              ⇄
                            </button>
                          </div>
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                          状态
                        </th>
                        <th
                          className="px-6 py-4 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                          onClick={() => toggleSort('purchase_price_total')}
                        >
                          <div className="flex items-center justify-end gap-1">
                            成本
                            {sortField === 'purchase_price_total' && (
                              <svg className={`w-4 h-4 ${sortOrder === 'asc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        </th>
                        <th
                          className="px-6 py-4 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                          onClick={() => toggleSort('total_profit')}
                        >
                          <div className="flex items-center justify-end gap-1">
                            利润
                            {sortField === 'total_profit' && (
                              <svg className={`w-4 h-4 ${sortOrder === 'asc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        </th>
                        <th
                          className="px-6 py-4 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                          onClick={() => toggleSort('roi')}
                        >
                          <div className="flex items-center justify-end gap-1">
                            ROI
                            {sortField === 'roi' && (
                              <svg className={`w-4 h-4 ${sortOrder === 'asc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        </th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                          操作
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {filteredTransactions.map((transaction) => (
                        <TransactionRow
                          key={transaction.id}
                          transaction={transaction}
                          dateSortMode={dateSortMode}
                          onDelete={deleteTransaction}
                          onMarkArrived={handleMarkArrived}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={
      <div className={layout.page + ' flex items-center justify-center'}>
        <div className="flex items-center gap-3 text-gray-900 dark:text-white">
          <svg className="animate-spin h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-xl">加载中...</span>
        </div>
      </div>
    }>
      <TransactionsContent />
    </Suspense>
  );
}
