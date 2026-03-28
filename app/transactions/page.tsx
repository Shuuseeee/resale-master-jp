// app/transactions/page.tsx
'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
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
import BuybackComparisonModal from '@/components/BuybackComparisonModal';
import { getPurchasePlatforms } from '@/lib/api/platforms';
import { exportTransactionsToCSV, downloadCSV } from '@/lib/api/export-csv';
import { useKaitorixPrices } from '@/hooks/useKaitorixPrices';
import PullToRefresh from '@/components/PullToRefresh';

interface TransactionWithPayment extends Transaction {
  payment_method?: PaymentMethod;
  latest_sale_date?: string | null;
  aggregated_profit?: number | null;
  aggregated_roi?: number | null;
  aggregated_actual_cash_spent?: number | null;
  aggregated_selling_platform_ids?: string[];
  aggregated_sale_order_numbers?: string[];
}

type SortField = 'date' | 'purchase_price_total' | 'total_profit' | 'roi' | 'buyback_price' | 'expected_profit';
type SortOrder = 'asc' | 'desc';
type DateSortMode = 'purchase' | 'sale'; // 日期排序模式
type ProfitSortMode = 'actual' | 'expected'; // 利润排序模式

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
  const [sellingPlatforms, setSellingPlatforms] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in_stock' | 'awaiting_payment' | 'sold' | 'returned'>(
    () => (searchParams.get('tab') as any) || 'all'
  );
  const [sortField, setSortField] = useState<SortField>(() => (searchParams.get('sort') as SortField) || 'date');
  const [sortOrder, setSortOrder] = useState<SortOrder>(() => (searchParams.get('order') as SortOrder) || 'desc');
  const [dateSortMode, setDateSortMode] = useState<DateSortMode>(() => (searchParams.get('dsm') as DateSortMode) || 'purchase');
  const [profitSortMode, setProfitSortMode] = useState<ProfitSortMode>('actual');
  const [activeFilters, setActiveFilters] = useState<FilterValues | null>(() => {
    // 从 URL 恢复高级筛选
    const dateFrom = searchParams.get('df') || '';
    const dateTo = searchParams.get('dt') || '';
    const productName = searchParams.get('pn') || '';
    const janCode = searchParams.get('jan') || '';
    const statusParam = searchParams.get('st');
    const status = statusParam ? statusParam.split(',') as FilterValues['status'] : [];
    const paymentMethodIds = (searchParams.get('pm') || '').split(',').filter(Boolean);
    const purchasePlatformIds = (searchParams.get('pp') || '').split(',').filter(Boolean);
    if (dateFrom || dateTo || productName || janCode || status.length > 0 || paymentMethodIds.length > 0 || purchasePlatformIds.length > 0) {
      return { dateFrom, dateTo, productName, janCode, status, paymentMethodIds, purchasePlatformIds, buybackStore: '' };
    }
    return null;
  });
  const [exporting, setExporting] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showComparison, setShowComparison] = useState(false);

  // KaitoriX 买取价格
  // 注意：hook 接收全部 transactions 用于缓存查找，但 refresh 时只获取当前筛选的
  const kaitorixState = useKaitorixPrices(transactions);
  const { buybackMap: buybackPrices, isLoading: kaitorixLoading, progress: kaitorixProgress, enabled: kaitorixEnabled, refresh: refreshKaitorix, refreshMissing: refreshMissingKaitorix, stop: stopKaitorix } = kaitorixState;

  useEffect(() => {
    loadTransactions();
    loadPaymentMethods();
    loadPurchasePlatforms();
    loadSellingPlatforms();
  }, []);

  useEffect(() => {
    const handler = () => loadTransactions();
    window.addEventListener('bfcache-restore', handler);
    return () => window.removeEventListener('bfcache-restore', handler);
  }, []);

  // 交易加载完成后自动补查缺失的买取价格（有缓存的跳过，不增加爬虫压力）
  useEffect(() => {
    if (transactions.length > 0 && kaitorixEnabled) {
      refreshMissingKaitorix();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions.length, kaitorixEnabled]);

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
      if (activeFilters.janCode) params.set('jan', activeFilters.janCode);
      if (activeFilters.status.length > 0) params.set('st', activeFilters.status.join(','));
      if (activeFilters.paymentMethodIds.length > 0) params.set('pm', activeFilters.paymentMethodIds.join(','));
      if (activeFilters.purchasePlatformIds.length > 0) params.set('pp', activeFilters.purchasePlatformIds.join(','));
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
      const txList = data || [];

      // 一次性批量拉取所有 sales_records，避免 N+1 查询
      const ids = txList.map(t => t.id);
      const { data: allSalesRecords } = ids.length > 0
        ? await supabase
            .from('sales_records')
            .select('transaction_id, total_profit, actual_cash_spent, sale_date, selling_platform_id, sale_order_number')
            .in('transaction_id', ids)
            .order('sale_date', { ascending: false })
        : { data: [] };

      // 按 transaction_id 分组
      const salesByTx = new Map<string, typeof allSalesRecords>();
      (allSalesRecords || []).forEach(r => {
        const list = salesByTx.get(r.transaction_id) || [];
        list.push(r);
        salesByTx.set(r.transaction_id, list);
      });

      const transactionsWithPartialProfit = txList.map(transaction => {
        const salesRecords = salesByTx.get(transaction.id) || [];

        let latest_sale_date = null;
        let aggregated_profit = null;
        let aggregated_roi = null;
        let aggregated_actual_cash_spent = null;
        let aggregated_selling_platform_ids: string[] = [];

        if (salesRecords.length > 0) {
          latest_sale_date = salesRecords[0].sale_date;

          if (transaction.quantity_sold > 0) {
            aggregated_profit = salesRecords.reduce((sum, r) => sum + (r.total_profit || 0), 0);
            const totalCashSpent = salesRecords.reduce((sum, r) => sum + (r.actual_cash_spent || 0), 0);
            aggregated_actual_cash_spent = totalCashSpent;
            aggregated_roi = totalCashSpent > 0 ? (aggregated_profit / totalCashSpent) * 100 : 0;
          }
          aggregated_selling_platform_ids = Array.from(
            new Set(salesRecords.map(r => r.selling_platform_id).filter(Boolean) as string[])
          );
        }

        const aggregated_sale_order_numbers = salesRecords
          .map(r => r.sale_order_number)
          .filter(Boolean) as string[];

        return {
          ...transaction,
          latest_sale_date,
          aggregated_profit,
          aggregated_roi,
          aggregated_actual_cash_spent,
          aggregated_selling_platform_ids,
          aggregated_sale_order_numbers,
        };
      });

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

  const loadSellingPlatforms = async () => {
    const { data, error } = await supabase
      .from('selling_platforms')
      .select('id, name');

    if (!error && data) {
      setSellingPlatforms(data);
    }
  };

  const stats = useMemo(() => {
    const sold = transactions.filter(t => t.status === 'sold');
    const totalCost = transactions.reduce((sum, t) => sum + t.purchase_price_total, 0);
    const totalProfit = sold.reduce((sum, t) => sum + (t.total_profit || 0), 0);
    const totalActualCashSpent = sold.reduce((sum, t) => sum + ((t as any).aggregated_actual_cash_spent || 0), 0);
    return {
      total: transactions.length,
      pending: transactions.filter(t => t.status === 'pending').length,
      inStock: transactions.filter(t => t.status === 'in_stock').length,
      awaitingPayment: transactions.filter(t => t.status === 'awaiting_payment').length,
      sold: sold.length,
      returned: transactions.filter(t => t.status === 'returned').length,
      totalCost,
      totalProfit,
      avgROI: totalActualCashSpent > 0 ? (totalProfit / totalActualCashSpent) * 100 : 0,
    };
  }, [transactions]);

  const handleApplyFilters = (filters: FilterValues) => {
    setActiveFilters(filters);
  };

  const handleClearFilters = () => {
    setActiveFilters(null);
  };
  const platformMap = useMemo(
    () => new Map(purchasePlatforms.map(p => [p.id, p.name.toLowerCase()])),
    [purchasePlatforms]
  );

  const storeNames = useMemo(() =>
    Array.from(new Set(
      Array.from(buybackPrices.values()).flatMap(info => info.allPrices?.map(p => p.store) || [])
    )).sort(),
    [buybackPrices]
  );

  const janCodes = useMemo(() =>
    [...new Set(transactions.map(t => t.jan_code).filter((j): j is string => !!j))].sort(),
    [transactions]
  );

  // 筛选和排序
  const filteredTransactions = useMemo(() => transactions
    .filter(t => {
      // 全局搜索
      if (searchTerm) {
        const term = searchTerm.toLowerCase();

        // 反向映射：根据搜索词找出匹配的销售平台 ID 集合
        const matchedSellingPlatformIds = sellingPlatforms
          .filter(p => p.name.toLowerCase().includes(term))
          .map(p => p.id);

        // 正向映射：获取当前记录的购入平台名称
        const purchasePlatformName = t.purchase_platform_id 
          ? (platformMap.get(t.purchase_platform_id) || '') 
          : '';

        // 检查销售平台交集
        const matchesSellingPlatform = t.aggregated_selling_platform_ids?.some(id => 
          matchedSellingPlatformIds.includes(id)
        ) ?? false;

        // 综合匹配逻辑
        const matchesSaleOrderNumber = t.aggregated_sale_order_numbers?.some(
          n => n.toLowerCase().includes(term)
        ) ?? false;

        const matchesSearch =
          t.product_name.toLowerCase().includes(term) ||
          t.notes?.toLowerCase().includes(term) ||
          (t.jan_code || '').toLowerCase().includes(term) ||
          (t.order_number || '').toLowerCase().includes(term) ||
          t.purchase_price_total.toString().includes(term) || // 金额匹配
          purchasePlatformName.includes(term) ||              // 购入平台匹配
          matchesSellingPlatform ||                           // 销售平台匹配
          matchesSaleOrderNumber;                             // 销售注文番号匹配

        if (!matchesSearch) return false;
      }

      // 状态标签栏快速切换
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      if (!matchesStatus) return false;

      // 高级筛选
      if (activeFilters) {
        // 日期筛选
        if (activeFilters.dateFrom && t.date < activeFilters.dateFrom) return false;
        if (activeFilters.dateTo && t.date > activeFilters.dateTo) return false;

        // 商品名称筛选（兼作搜索：同时匹配商品名、JAN、订单号、备注）
        if (activeFilters.productName) {
          const term = activeFilters.productName.toLowerCase();
          const matchesProductSearch = t.product_name.toLowerCase().includes(term) ||
            t.notes?.toLowerCase().includes(term) ||
            (t.jan_code || '').toLowerCase().includes(term) ||
            (t.order_number || '').toLowerCase().includes(term);
          if (!matchesProductSearch) return false;
        }

        // JAN码筛选（精确匹配，来自下拉选择）
        if (activeFilters.janCode && t.jan_code !== activeFilters.janCode) {
          return false;
        }

        // 状态筛选（多选）
        if (activeFilters.status.length > 0 && !activeFilters.status.includes(t.status)) {
          return false;
        }

        // 支付方式筛选
        if (activeFilters.paymentMethodIds.length > 0 && !activeFilters.paymentMethodIds.includes(t.card_id || '')) {
          return false;
        }

        // 購入先筛选
        if (activeFilters.purchasePlatformIds.length > 0 && !activeFilters.purchasePlatformIds.includes(t.purchase_platform_id || '')) {
          return false;
        }

        // 买取店铺筛选（仅对已加载买取数据的记录有效）
        if (activeFilters.buybackStore) {
          const buyback = buybackPrices.get(t.id);
          if (!buyback) return false;
          const storeTerm = activeFilters.buybackStore.toLowerCase();
          if (!buyback.maxStore?.toLowerCase().includes(storeTerm)) return false;
        }
      }

      return true;
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
      } else if (sortField === 'buyback_price') {
        aValue = buybackPrices.get(a.id)?.maxPrice || 0;
        bValue = buybackPrices.get(b.id)?.maxPrice || 0;
      } else if (sortField === 'total_profit' || sortField === 'expected_profit') {
        if (profitSortMode === 'expected') {
          aValue = buybackPrices.get(a.id)?.expectedProfit || 0;
          bValue = buybackPrices.get(b.id)?.expectedProfit || 0;
        } else {
          aValue = a.total_profit;
          bValue = b.total_profit;
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
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, searchTerm, statusFilter, activeFilters, sortField, sortOrder, dateSortMode, profitSortMode, buybackPrices, platformMap, sellingPlatforms]
  );

  const selectedTransactions = useMemo(
    () => filteredTransactions.filter(t => selectedIds.has(t.id)),
    [filteredTransactions, selectedIds]
  );

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const deleteTransaction = useCallback(async (id: string) => {
    if (!confirm('确定要删除这条交易记录吗？此操作无法撤销。')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setTransactions(prev => prev.filter(t => t.id !== id));
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败，请重试');
    }
  }, []);

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const ids = filteredTransactions.map(t => t.id);
      const csv = await exportTransactionsToCSV(ids);
      downloadCSV(csv);
    } catch (error: any) {
      alert(error.message || 'CSV导出失败');
    } finally {
      setExporting(false);
    }
  };

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const exitCompareMode = useCallback(() => {
    setCompareMode(false);
    setSelectedIds(new Set());
    setShowComparison(false);
  }, []);

  const handleBatchArrival = useCallback(async () => {
    const pendingIds = [...selectedIds].filter(id =>
      transactions.find(t => t.id === id && t.status === 'pending')
    );
    if (pendingIds.length === 0) return;
    const { error } = await supabase
      .from('transactions')
      .update({ status: 'in_stock' })
      .in('id', pendingIds);
    if (!error) {
      setTransactions(prev =>
        prev.map(t => pendingIds.includes(t.id) ? { ...t, status: 'in_stock' as const } : t)
      );
      setSelectedIds(new Set());
    } else {
      alert('到货处理失败');
    }
  }, [selectedIds, transactions]);

  const handleBatchDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`選択した ${selectedIds.size} 件を削除してよろしいですか？`)) return;
    const ids = [...selectedIds];
    const { error } = await supabase
      .from('transactions')
      .delete()
      .in('id', ids);
    if (!error) {
      setTransactions(prev => prev.filter(t => !ids.includes(t.id)));
      exitCompareMode();
    } else {
      alert('削除に失敗しました');
    }
  }, [selectedIds, exitCompareMode]);

  const handleMarkArrived = useCallback(async (id: string) => {
    const success = await markTransactionArrived(id);
    if (success) {
      setTransactions(prev =>
        prev.map(t => t.id === id ? { ...t, status: 'in_stock' as const } : t)
      );
    } else {
      alert('到货处理失败');
    }
  }, []);

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
    <PullToRefresh onRefresh={loadTransactions}>
    <div className={layout.page}>
      <div className={layout.container}>
        {/* 标题区域 */}
        <div className={layout.section}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className={heading.h1 + ' mb-2'}>交易记录</h1>
              <p className="text-gray-600 dark:text-gray-400">管理您的所有转卖交易</p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              {/* 選択モードボタン */}
              <button
                onClick={() => { setCompareMode(!compareMode); setSelectedIds(new Set()); }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                  compareMode
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <span className="hidden sm:inline">{compareMode ? '選択中' : '選択'}</span>
              </button>
              {kaitorixEnabled && (
                <button
                  onClick={kaitorixLoading ? stopKaitorix : () => refreshKaitorix(filteredTransactions)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    kaitorixLoading
                      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                      : buybackPrices.size > 0
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {kaitorixLoading ? (
                    <>
                      <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="hidden sm:inline">
                        {kaitorixProgress
                          ? `${kaitorixProgress.completed}/${kaitorixProgress.total}`
                          : '加载中...'}
                      </span>
                      <span className="hidden sm:inline text-xs opacity-70">停止</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span className="hidden sm:inline">获取买取价格</span>
                    </>
                  )}
                </button>
              )}
              <button
                onClick={handleExportCSV}
                disabled={exporting}
                className={button.secondary + ' flex items-center gap-2 whitespace-nowrap'}
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
                {exporting ? '导出中...' : <><span className="hidden sm:inline">CSV导出</span></>}
              </button>
              <Link
                href="/transactions/add"
                className={button.primary + ' flex items-center gap-2 whitespace-nowrap'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden sm:inline">记录新交易</span>
              </Link>
            </div>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
          <div className={card.stat + ' !p-3 sm:!p-6'}>
            <div className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm mb-1">总成本</div>
            <div className="text-base sm:text-2xl font-bold text-gray-900 dark:text-white truncate">{formatCurrency(stats.totalCost)}</div>
          </div>
          <div className={card.stat + ' !p-3 sm:!p-6'}>
            <div className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm mb-1">总利润</div>
            <div className={`text-base sm:text-2xl font-bold truncate ${stats.totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'}`}>
              {formatCurrency(stats.totalProfit)}
            </div>
          </div>
          <div className={card.stat + ' !p-3 sm:!p-6'}>
            <div className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm mb-1">平均ROI</div>
            <div className={`text-base sm:text-2xl font-bold truncate ${stats.avgROI >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'}`}>
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
            { key: 'awaiting_payment', label: '入金待ち', count: stats.awaitingPayment, color: 'indigo' },
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
          janCodes={janCodes}
          initialValues={activeFilters}
          hasBuybackData={buybackPrices.size > 0}
          buybackStores={storeNames}
        />

        {/* 全局搜索 */}
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="搜索商品名称、JAN、订单号..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={input.base + ' pl-10 w-full'}
          />
          <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* KaitoriX 加载进度条 */}
        {kaitorixLoading && kaitorixProgress && (
          <div className="mb-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-600 dark:text-gray-400">
                买取価格を取得中... {kaitorixProgress.completed}/{kaitorixProgress.total}
                {kaitorixProgress.failed > 0 && (
                  <span className="text-red-500 ml-2">({kaitorixProgress.failed} 失败)</span>
                )}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-500">
                ~{Math.ceil((kaitorixProgress.total - kaitorixProgress.completed) * 6 / 60)} 分钟
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  kaitorixProgress.stopped
                    ? 'bg-red-500'
                    : 'bg-teal-500'
                }`}
                style={{ width: `${(kaitorixProgress.completed / kaitorixProgress.total) * 100}%` }}
              />
            </div>
            {kaitorixProgress.stopped && (
              <p className="text-xs text-red-500 mt-1">
                请求被限制，已自动停止。已获取的价格数据仍然可用。
              </p>
            )}
          </div>
        )}

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
                  buybackInfo={buybackPrices.get(transaction.id)}
                  purchasePlatforms={purchasePlatforms}
                  compareMode={compareMode}
                  isSelected={selectedIds.has(transaction.id)}
                  onToggleSelect={toggleSelect}
                />
              ))}
            </div>

            {/* 桌面端：表格 */}
            <div className="hidden md:block">
              <div className={card.primary + ' shadow-2xl overflow-hidden'}>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        <th className="px-3 py-3 text-left">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => toggleSort('date')}
                              className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white transition-colors"
                            >
                              {dateSortMode === 'purchase' ? '进货日期' : '销售日期'}
                              {sortField === 'date' && (
                                <svg className={`w-3.5 h-3.5 ${sortOrder === 'asc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              )}
                            </button>
                            <button
                              onClick={() => setDateSortMode(dateSortMode === 'purchase' ? 'sale' : 'purchase')}
                              className="px-1 py-0.5 text-[10px] bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                              title="切换日期类型"
                            >
                              ⇄
                            </button>
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left">商品名</th>
                        <th className="px-3 py-3 text-left">
                          <div>进货单价</div>
                          <div className="text-[10px] text-gray-400 font-normal normal-case">(不含返点)</div>
                        </th>
                        <th className="px-3 py-3 text-left">来源渠道</th>
                        <th className="px-3 py-3 text-left">订单号</th>
                        <th className="px-3 py-3 text-left">账号</th>
                        <th className="px-3 py-3 text-left">状态</th>
                        <th className="px-2 py-3 text-center"></th>
                        <th className="px-3 py-3 text-right">
                          <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                            <button
                              onClick={() => toggleSort('total_profit')}
                              className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white transition-colors"
                            >
                              {profitSortMode === 'actual' ? '利润' : '预估利润'}
                              {sortField === 'total_profit' && (
                                <svg className={`w-3.5 h-3.5 ${sortOrder === 'asc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              )}
                            </button>
                            <button
                              onClick={() => setProfitSortMode(profitSortMode === 'actual' ? 'expected' : 'actual')}
                              className="px-1 py-0.5 text-[10px] bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                              title="切换利润类型"
                            >
                              ⇄
                            </button>
                          </div>
                        </th>
                        <th
                          className="px-3 py-3 text-right cursor-pointer hover:text-gray-900 dark:hover:text-white transition-colors"
                          onClick={() => toggleSort('buyback_price')}
                        >
                          <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                            最高价
                            {sortField === 'buyback_price' && (
                              <svg className={`w-3.5 h-3.5 ${sortOrder === 'asc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        </th>
                        <th className="px-2 py-3 text-center">操作</th>
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
                          buybackInfo={buybackPrices.get(transaction.id)}
                          purchasePlatforms={purchasePlatforms}
                          compareMode={compareMode}
                          isSelected={selectedIds.has(transaction.id)}
                          onToggleSelect={toggleSelect}
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

      {/* 選択モード浮動操作バー */}
      {compareMode && (
        <div className="fixed bottom-24 md:bottom-6 inset-x-0 flex justify-center px-4 z-[9998] pointer-events-none">
          <div className="pointer-events-auto bg-gray-900 dark:bg-gray-800 text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-2 max-w-lg w-full border border-gray-700">
            <div className="flex-1 text-sm min-w-0">
              {selectedIds.size === 0
                ? <span className="text-gray-400 text-xs">タップして選択</span>
                : <span>已选 <span className="font-bold text-teal-400">{selectedIds.size}</span> 件</span>
              }
            </div>
            {/* 一括到着 */}
            {[...selectedIds].some(id => transactions.find(t => t.id === id && t.status === 'pending')) && (
              <button
                onClick={handleBatchArrival}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-orange-500 hover:bg-orange-400 text-white transition-all whitespace-nowrap"
              >
                一括到着
              </button>
            )}
            {/* 一括削除 */}
            {selectedIds.size > 0 && (
              <button
                onClick={handleBatchDelete}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-500 text-white transition-all whitespace-nowrap"
              >
                削除
              </button>
            )}
            {/* 买取比较 */}
            {kaitorixEnabled && buybackPrices.size > 0 && (
              <button
                disabled={selectedIds.size < 2}
                onClick={() => setShowComparison(true)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                  selectedIds.size >= 2
                    ? 'bg-teal-500 hover:bg-teal-400 text-white'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                比較
              </button>
            )}
            {selectedIds.size > 0 && (
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-gray-400 hover:text-white transition-colors px-1"
              >
                クリア
              </button>
            )}
            <button
              onClick={exitCompareMode}
              className="p-1.5 text-gray-400 hover:text-white transition-colors flex-shrink-0"
              aria-label="選択モード終了"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* 比较结果 Modal */}
      <BuybackComparisonModal
        isOpen={showComparison}
        onClose={() => setShowComparison(false)}
        selectedTransactions={selectedTransactions}
        buybackMap={buybackPrices}
      />
    </div>
    </PullToRefresh>
  );
}

export default function TransactionsPage() {
  return (
    <>
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
    </>
  );
}
