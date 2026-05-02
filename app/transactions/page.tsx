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
import TransactionGroupCard from '@/components/TransactionGroupCard';
import TransactionGroupRow from '@/components/TransactionGroupRow';
import BuybackComparisonModal from '@/components/BuybackComparisonModal';
import Modal, { ConfirmModal } from '@/components/Modal';
import BatchSaleForm from '@/components/BatchSaleForm';
import ReturnForm from '@/components/ReturnForm';
import QuickEditForm from '@/components/QuickEditForm';
import QuickCopyForm from '@/components/QuickCopyForm';
import Toast from '@/components/Toast';
import { deleteTransaction as deleteTransactionApi } from '@/lib/api/transactions';
import { exportTransactionsToCSV, downloadCSV } from '@/lib/api/export-csv';
import { getColumnPreferences, saveColumnPreferences } from '@/lib/api/user-preferences';
import { DEFAULT_COLUMNS, effectiveColumns, visibleColumnKeys, COLUMN_LABELS } from '@/lib/transactions/columns';
import type { ColumnConfig } from '@/lib/transactions/columns';
import TransactionColumnPicker from '@/components/TransactionColumnPicker';
import { useKaitorixPrices } from '@/hooks/useKaitorixPrices';
import { usePlatforms } from '@/contexts/PlatformsContext';
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

export interface TransactionGroup {
  janCode: string;
  productName: string;
  imageUrl: string | null;
  transactions: TransactionWithPayment[];
  totalQuantity: number;
  totalInStock: number;
  totalPending: number;
  totalSold: number;
  totalPurchasePrice: number;
  totalProfit: number | null;
  bestBuybackPrice: number;
  bestBuybackStore: string;
  bestExpectedProfit: number;
  latestDate: string;
}

type DisplayItem =
  | { type: 'transaction'; data: TransactionWithPayment }
  | { type: 'group'; data: TransactionGroup };

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
  const { purchasePlatforms, sellingPlatforms } = usePlatforms();
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
    const sellingPlatformIds = (searchParams.get('sp') || '').split(',').filter(Boolean);
    const janFilterMode = (searchParams.get('jfm') as 'include' | 'exclude') || 'include';
    const excludeJanCodes = (searchParams.get('ejc') || '').split(',').filter(Boolean);
    const dateMode = (searchParams.get('dm') as 'purchase' | 'sale') || 'purchase';
    if (dateFrom || dateTo || productName || janCode || status.length > 0 || paymentMethodIds.length > 0 || purchasePlatformIds.length > 0 || sellingPlatformIds.length > 0 || excludeJanCodes.length > 0) {
      return { dateFrom, dateTo, dateMode, productName, janCode, janFilterMode, excludeJanCodes, status, paymentMethodIds, purchasePlatformIds, sellingPlatformIds, buybackStore: '' };
    }
    return null;
  });
  const [exporting, setExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showComparison, setShowComparison] = useState(false);
  const [showJanList, setShowJanList] = useState(false);
  const [isGrouped, setIsGrouped] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // 列定制
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerDraft, setPickerDraft] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);

  // 列表页快捷操作 Modal 状态
  const [saleModalId, setSaleModalId] = useState<string | null>(null);
  const [returnModalId, setReturnModalId] = useState<string | null>(null);
  const [editModalId, setEditModalId] = useState<string | null>(null);
  const [copyModalId, setCopyModalId] = useState<string | null>(null);
  const [deleteModalId, setDeleteModalId] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // searchTerm 防抖：避免每次击键都触发 filter+sort
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // KaitoriX 买取价格
  // 注意：hook 接收全部 transactions 用于缓存查找，但 refresh 时只获取当前筛选的
  const kaitorixState = useKaitorixPrices(transactions);
  const { buybackMap: buybackPrices, isLoading: kaitorixLoading, progress: kaitorixProgress, enabled: kaitorixEnabled, refresh: refreshKaitorix, refreshMissing: refreshMissingKaitorix, stop: stopKaitorix } = kaitorixState;

  useEffect(() => {
    loadTransactions();
    loadPaymentMethods();
    getColumnPreferences().then(saved => {
      if (saved) {
        setColumns(saved);
        setPickerDraft(saved);
      }
    });
  }, []);

  useEffect(() => {
    const handler = () => loadTransactions();
    window.addEventListener('bfcache-restore', handler);
    return () => window.removeEventListener('bfcache-restore', handler);
  }, []);

  useEffect(() => {
    if (!showExportMenu) return;
    const handler = () => setShowExportMenu(false);
    document.addEventListener('click', handler, { capture: true });
    return () => document.removeEventListener('click', handler, { capture: true });
  }, [showExportMenu]);

  // 交易加载完成后自动补查缺失的买取价格（有缓存的跳过，不增加爬虫压力）
  useEffect(() => {
    if (transactions.length > 0 && kaitorixEnabled) {
      refreshMissingKaitorix();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions.length, kaitorixEnabled]);

  const visibleColumns = useMemo(() => visibleColumnKeys(columns), [columns]);

  const handleSaveColumns = useCallback(async () => {
    setColumns(pickerDraft);
    setPickerOpen(false);
    await saveColumnPreferences(pickerDraft);
    setToastMsg('列设置已保存');
  }, [pickerDraft]);

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
      if (activeFilters.dateMode === 'sale') params.set('dm', 'sale');
      if (activeFilters.productName) params.set('pn', activeFilters.productName);
      if (activeFilters.janCode) params.set('jan', activeFilters.janCode);
      if (activeFilters.status.length > 0) params.set('st', activeFilters.status.join(','));
      if (activeFilters.paymentMethodIds.length > 0) params.set('pm', activeFilters.paymentMethodIds.join(','));
      if (activeFilters.purchasePlatformIds.length > 0) params.set('pp', activeFilters.purchasePlatformIds.join(','));
      if (activeFilters.sellingPlatformIds.length > 0) params.set('sp', activeFilters.sellingPlatformIds.join(','));
      if (activeFilters.janFilterMode === 'exclude') params.set('jfm', 'exclude');
      if (activeFilters.excludeJanCodes.length > 0) params.set('ejc', activeFilters.excludeJanCodes.join(','));
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
          payment_method:payment_methods(id, name)
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

  const stats = useMemo(() => {
    let pending = 0, inStock = 0, awaitingPayment = 0, sold = 0, returned = 0;
    let totalCost = 0, totalProfit = 0, totalActualCashSpent = 0;
    transactions.forEach(t => {
      totalCost += t.purchase_price_total;
      switch (t.status) {
        case 'pending': pending++; break;
        case 'in_stock': inStock++; break;
        case 'awaiting_payment': awaitingPayment++; break;
        case 'sold':
          sold++;
          totalProfit += t.total_profit || 0;
          totalActualCashSpent += (t as any).aggregated_actual_cash_spent || 0;
          break;
        case 'returned': returned++; break;
      }
    });
    return {
      total: transactions.length,
      pending, inStock, awaitingPayment, sold, returned,
      totalCost, totalProfit,
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
  const filteredTransactions = useMemo(() => {
    // 搜索相关预计算（移出 filter 循环，每次 memo 只算一次）
    const term = debouncedSearchTerm.toLowerCase();
    // 匹配销售平台 ID 集合（Set 实现 O(1) 查找）
    const matchedSellingPlatformIdSet: Set<string> | null = debouncedSearchTerm
      ? new Set(sellingPlatforms.filter(p => p.name.toLowerCase().includes(term)).map(p => p.id))
      : null;

    return transactions
    .filter(t => {
      // 全局搜索
      if (debouncedSearchTerm) {
        const purchasePlatformName = t.purchase_platform_id
          ? (platformMap.get(t.purchase_platform_id) || '')
          : '';
        const matchesSellingPlatform = matchedSellingPlatformIdSet !== null &&
          (t.aggregated_selling_platform_ids?.some(id => matchedSellingPlatformIdSet.has(id)) ?? false);
        const matchesSaleOrderNumber = t.aggregated_sale_order_numbers?.some(
          n => n.toLowerCase().includes(term)
        ) ?? false;
        const matchesSearch =
          t.product_name.toLowerCase().includes(term) ||
          t.notes?.toLowerCase().includes(term) ||
          (t.jan_code || '').toLowerCase().includes(term) ||
          (t.order_number || '').toLowerCase().includes(term) ||
          t.purchase_price_total.toString().includes(term) ||
          purchasePlatformName.includes(term) ||
          matchesSellingPlatform ||
          matchesSaleOrderNumber;
        if (!matchesSearch) return false;
      }

      // 状态标签栏快速切换
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      if (!matchesStatus) return false;

      // 高级筛选
      if (activeFilters) {
        // 日期筛选（购买日期 or 售出日期）
        if (activeFilters.dateMode === 'sale') {
          const saleDate = (t as any).latest_sale_date;
          if (activeFilters.dateFrom && (!saleDate || saleDate < activeFilters.dateFrom)) return false;
          if (activeFilters.dateTo && (!saleDate || saleDate > activeFilters.dateTo)) return false;
        } else {
          if (activeFilters.dateFrom && t.date < activeFilters.dateFrom) return false;
          if (activeFilters.dateTo && t.date > activeFilters.dateTo) return false;
        }

        // 商品名称筛选（兼作搜索：同时匹配商品名、JAN、订单号、备注）
        if (activeFilters.productName) {
          const term = activeFilters.productName.toLowerCase();
          const matchesProductSearch = t.product_name.toLowerCase().includes(term) ||
            t.notes?.toLowerCase().includes(term) ||
            (t.jan_code || '').toLowerCase().includes(term) ||
            (t.order_number || '').toLowerCase().includes(term);
          if (!matchesProductSearch) return false;
        }

        // JAN码筛选（含む: 精确匹配 / 除外: 多选排除）
        if (activeFilters.janFilterMode === 'exclude') {
          if (activeFilters.excludeJanCodes.length > 0 && activeFilters.excludeJanCodes.includes(t.jan_code || '')) {
            return false;
          }
        } else {
          if (activeFilters.janCode && t.jan_code !== activeFilters.janCode) {
            return false;
          }
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

        // 售出平台筛选（交集：只要有一条销售记录属于选中平台即匹配）
        if (activeFilters.sellingPlatformIds.length > 0) {
          const hasMatch = t.aggregated_selling_platform_ids?.some(id =>
            activeFilters.sellingPlatformIds.includes(id)
          ) ?? false;
          if (!hasMatch) return false;
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
    });
  },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, debouncedSearchTerm, statusFilter, activeFilters, sortField, sortOrder, dateSortMode, profitSortMode, buybackPrices, platformMap, sellingPlatforms]
  );

  const selectedTransactions = useMemo(
    () => filteredTransactions.filter(t => selectedIds.has(t.id)),
    [filteredTransactions, selectedIds]
  );

  // 分组汇总辅助函数
  const buildGroupSummary = useCallback((janCode: string, txs: TransactionWithPayment[]): TransactionGroup => {
    let totalQuantity = 0, totalInStock = 0, totalPending = 0, totalSold = 0, totalPurchasePrice = 0;
    let totalProfit: number | null = null;
    let bestBuybackPrice = 0, bestBuybackStore = '', bestExpectedProfit = 0;
    let latestDate = '';

    txs.forEach(tx => {
      totalQuantity += tx.quantity;
      // pending（未着）不计入在库，单独统计
      if (tx.status === 'pending') {
        totalPending += tx.quantity;
      } else {
        totalInStock += tx.quantity_in_stock ?? Math.max(0, tx.quantity - (tx.quantity_sold ?? 0) - (tx.quantity_returned ?? 0));
      }
      totalSold += tx.quantity_sold ?? 0;
      totalPurchasePrice += tx.purchase_price_total;
      if (tx.aggregated_profit != null) {
        totalProfit = (totalProfit ?? 0) + tx.aggregated_profit;
      }
      if (tx.date > latestDate) latestDate = tx.date;

      const bb = buybackPrices.get(tx.id);
      if (bb && bb.maxPrice > bestBuybackPrice) {
        bestBuybackPrice = bb.maxPrice;
        bestBuybackStore = bb.maxStore;
        bestExpectedProfit = bb.expectedProfit;
      }
    });

    return {
      janCode,
      productName: txs[0].product_name,
      imageUrl: txs.find(t => t.image_url)?.image_url ?? null,
      transactions: txs,
      totalQuantity,
      totalInStock,
      totalPending,
      totalSold,
      totalPurchasePrice,
      totalProfit,
      bestBuybackPrice,
      bestBuybackStore,
      bestExpectedProfit,
      latestDate,
    };
  }, [buybackPrices]);

  // displayItems: filteredTransactions を分組/平铺に変換
  const displayItems = useMemo((): DisplayItem[] => {
    if (!isGrouped) {
      return filteredTransactions.map(t => ({ type: 'transaction' as const, data: t }));
    }

    // JAN ごとにグループ化
    const janMap = new Map<string, TransactionWithPayment[]>();
    const ungrouped: TransactionWithPayment[] = [];

    filteredTransactions.forEach(t => {
      if (!t.jan_code) { ungrouped.push(t); return; }
      const list = janMap.get(t.jan_code) || [];
      list.push(t);
      janMap.set(t.jan_code, list);
    });

    // 各 JAN の最初の要素の位置でソート順を維持
    const positionMap = new Map<string, number>();
    filteredTransactions.forEach((t, i) => positionMap.set(t.id, i));

    const items: DisplayItem[] = [];
    // 预计算每个分组的最小位置（避免在排序回调里重复 map+min）
    const groupMinPos = new Map<string, number>();
    janMap.forEach((txs, jan) => {
      if (txs.length < 2) {
        txs.forEach(t => items.push({ type: 'transaction', data: t }));
      } else {
        items.push({ type: 'group', data: buildGroupSummary(jan, txs) });
        let minPos = Infinity;
        txs.forEach(t => { const p = positionMap.get(t.id) ?? Infinity; if (p < minPos) minPos = p; });
        groupMinPos.set(jan, minPos);
      }
    });
    ungrouped.forEach(t => items.push({ type: 'transaction', data: t }));

    // filteredTransactions の順序を保持
    items.sort((a, b) => {
      const posA = a.type === 'transaction'
        ? (positionMap.get(a.data.id) ?? 0)
        : (groupMinPos.get(a.data.janCode) ?? 0);
      const posB = b.type === 'transaction'
        ? (positionMap.get(b.data.id) ?? 0)
        : (groupMinPos.get(b.data.janCode) ?? 0);
      return posA - posB;
    });

    return items;
  }, [filteredTransactions, isGrouped, buildGroupSummary]);

  const toggleGroupExpand = useCallback((janCode: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(janCode)) next.delete(janCode); else next.add(janCode);
      return next;
    });
  }, []);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const deleteTransaction = useCallback((id: string) => {
    setDeleteModalId(id);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteModalId) return;
    setDeleteSubmitting(true);
    const { error } = await deleteTransactionApi(deleteModalId);
    setDeleteSubmitting(false);
    if (error) {
      alert(error?.message || '删除失败,请重试');
      return;
    }
    setTransactions(prev => prev.filter(t => t.id !== deleteModalId));
    setDeleteModalId(null);
    setToastMsg('已删除');
  }, [deleteModalId]);

  const openQuickSale = useCallback((id: string) => setSaleModalId(id), []);
  const openQuickReturn = useCallback((id: string) => setReturnModalId(id), []);
  const openQuickEdit = useCallback((id: string) => setEditModalId(id), []);
  const openQuickCopy = useCallback((id: string) => setCopyModalId(id), []);

  const handleExportCSV = async (mode: 'filtered' | 'all' = 'filtered') => {
    setExporting(true);
    try {
      const ids = mode === 'all'
        ? transactions.map(t => t.id)
        : filteredTransactions.map(t => t.id);
      const csv = await exportTransactionsToCSV(ids);
      const suffix = mode === 'all' ? '_all' : '_filtered';
      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      downloadCSV(csv, `purchases_${dateStr}${suffix}.csv`);
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

  const selectGroup = useCallback((ids: string[]) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allSelected = ids.every(id => next.has(id));
      if (allSelected) {
        ids.forEach(id => next.delete(id));
      } else {
        ids.forEach(id => next.add(id));
      }
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
    if (!confirm(`确定删除已选的 ${selectedIds.size} 件交易吗？`)) return;
    const ids = [...selectedIds];
    const { error } = await supabase
      .from('transactions')
      .delete()
      .in('id', ids);
    if (!error) {
      setTransactions(prev => prev.filter(t => !ids.includes(t.id)));
      exitCompareMode();
    } else {
      alert('删除失败');
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
        <div className="flex items-center gap-3 text-[var(--color-text)]">
          <svg className="animate-spin h-8 w-8 text-[var(--color-primary)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-lg font-medium">加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={loadTransactions}>
    <div className={layout.page}>
      <div className={layout.container}>
        {/* 标题区域 */}
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className={heading.h1}>交易列表</h1>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">库存、利润、买取价格与销售状态</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto pb-1 xl:pb-0">
              {/* 分组/平铺切换按钮 */}
              <button
                onClick={() => setIsGrouped(v => !v)}
                title={isGrouped ? '平铺显示' : '分组显示'}
                className={`inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border px-3 py-2 text-sm font-semibold transition-all whitespace-nowrap ${
                  isGrouped
                    ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)] border-[var(--color-primary)]/30'
                    : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text)]'
                }`}
              >
                {isGrouped ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                )}
                <span className="hidden sm:inline">{isGrouped ? '平铺' : '分组'}</span>
              </button>
              {/* 多选模式按钮 */}
              <button
                onClick={() => { setCompareMode(!compareMode); setSelectedIds(new Set()); }}
                className={`inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border px-3 py-2 text-sm font-semibold transition-all whitespace-nowrap ${
                  compareMode
                    ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                    : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text)]'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <span className="hidden sm:inline">{compareMode ? '选择中' : '多选'}</span>
              </button>
              {kaitorixEnabled && (
                <button
                  onClick={kaitorixLoading ? stopKaitorix : () => refreshKaitorix(filteredTransactions)}
                  className={`inline-flex items-center gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-sm font-semibold transition-all whitespace-nowrap ${
                    kaitorixLoading
                      ? 'bg-[rgba(245,158,11,0.1)] text-[var(--color-warning)] border-[rgba(245,158,11,0.3)]'
                      : buybackPrices.size > 0
                        ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)] border-[var(--color-primary)]/30'
                        : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text)]'
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
              {kaitorixEnabled && buybackPrices.size > 0 && !kaitorixLoading && (
                <button
                  onClick={() => setShowJanList(true)}
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm font-semibold text-[var(--color-text-muted)] transition-all hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text)] whitespace-nowrap"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  <span className="hidden sm:inline">JAN 列表</span>
                </button>
              )}
              {/* CSV 导出：有筛选时提供筛选结果/全部两个选项 */}
              <div className="relative">
                <div className="flex">
                  <button
                    onClick={() => handleExportCSV('filtered')}
                    disabled={exporting}
                    className={'inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm font-semibold text-[var(--color-text-muted)] transition-all hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap' + (filteredTransactions.length < transactions.length ? ' rounded-r-none border-r-0' : '')}
                  >
                    {exporting ? (
                      <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    )}
                    <span className="hidden sm:inline">
                      {exporting ? '导出中...' : `CSV (${filteredTransactions.length})`}
                    </span>
                  </button>
                  {filteredTransactions.length < transactions.length && (
                    <button
                      onClick={() => setShowExportMenu(v => !v)}
                      disabled={exporting}
                      className="inline-flex items-center justify-center rounded-[var(--radius-md)] rounded-l-none border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2 py-2 text-sm font-semibold text-[var(--color-text-muted)] transition-all hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-40"
                      title="导出选项"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  )}
                </div>
                {showExportMenu && (
                  <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-[var(--shadow-lg)]">
                    <button
                      onClick={() => { handleExportCSV('filtered'); setShowExportMenu(false); }}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-[var(--color-text)] hover:bg-[var(--color-bg-subtle)]"
                    >
                      <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
                      </svg>
                      筛选结果 ({filteredTransactions.length}条)
                    </button>
                    <button
                      onClick={() => { handleExportCSV('all'); setShowExportMenu(false); }}
                      className="flex w-full items-center gap-2 border-t border-[var(--color-border)] px-4 py-2.5 text-left text-sm text-[var(--color-text)] hover:bg-[var(--color-bg-subtle)]"
                    >
                      <svg className="w-4 h-4 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                      </svg>
                      全部 ({transactions.length}条)
                    </button>
                  </div>
                )}
              </div>
              {/* 列定制齿轮 — 仅桌面表格视图 */}
              <button
                onClick={() => { setPickerDraft(columns); setPickerOpen(true); }}
                className="hidden md:flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text)]"
                title="自定义列"
                aria-label="自定义列"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <Link
                href="/transactions/add"
                className={button.primary + ' hidden lg:flex items-center gap-2 whitespace-nowrap'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                记录新交易
              </Link>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-4 lg:grid-cols-6">
          <div className={card.stat + ' !p-3 sm:!p-4'}>
            <div className="mb-1 text-xs uppercase tracking-[0.04em] text-[var(--color-text-muted)]">总成本</div>
            <div className="truncate text-base font-bold text-[var(--color-text)] sm:text-xl">{formatCurrency(stats.totalCost)}</div>
          </div>
          <div className={card.stat + ' !p-3 sm:!p-4'}>
            <div className="mb-1 text-xs uppercase tracking-[0.04em] text-[var(--color-text-muted)]">总利润</div>
            <div className={`truncate text-base font-bold sm:text-xl ${stats.totalProfit >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
              {formatCurrency(stats.totalProfit)}
            </div>
          </div>
          <div className={card.stat + ' !p-3 sm:!p-4'}>
            <div className="mb-1 text-xs uppercase tracking-[0.04em] text-[var(--color-text-muted)]">平均ROI</div>
            <div className={`truncate text-base font-bold sm:text-xl ${stats.avgROI >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
              {formatROI(stats.avgROI)}
            </div>
          </div>
          <div className={card.stat + ' !p-3 sm:!p-4 hidden lg:block'}>
            <div className="mb-1 text-xs uppercase tracking-[0.04em] text-[var(--color-text-muted)]">库存中</div>
            <div className="truncate text-base font-bold text-[var(--color-primary)] sm:text-xl">{stats.inStock}</div>
          </div>
          <div className={card.stat + ' !p-3 sm:!p-4 hidden lg:block'}>
            <div className="mb-1 text-xs uppercase tracking-[0.04em] text-[var(--color-text-muted)]">未到货</div>
            <div className="truncate text-base font-bold text-[var(--color-warning)] sm:text-xl">{stats.pending}</div>
          </div>
          <div className={card.stat + ' !p-3 sm:!p-4 hidden lg:block'}>
            <div className="mb-1 text-xs uppercase tracking-[0.04em] text-[var(--color-text-muted)]">已售出</div>
            <div className="truncate text-base font-bold text-[var(--color-success)] sm:text-xl">{stats.sold}</div>
          </div>
        </div>

        {/* 状态标签栏 */}
        <div className="mb-5 flex min-h-[42px] items-end gap-1 overflow-x-auto border-b border-[var(--color-border)]">
          {([
            { key: 'all', label: '全部', count: stats.total },
            { key: 'in_stock', label: '库存中', count: stats.inStock, color: 'amber' },
            { key: 'pending', label: '未到货', count: stats.pending, color: 'blue' },
            { key: 'awaiting_payment', label: '待入账', count: stats.awaitingPayment, color: 'indigo' },
            { key: 'sold', label: '已售出', count: stats.sold, color: 'emerald' },
            { key: 'returned', label: '已退货', count: stats.returned, color: 'red' },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`flex h-[42px] flex-shrink-0 items-center whitespace-nowrap border-b-2 px-4 text-sm font-semibold transition-colors ${
                statusFilter === tab.key
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              {tab.label}
              <span className="ml-1.5 text-xs opacity-75">
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
          sellingPlatforms={sellingPlatforms}
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
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text)]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* KaitoriX 加载进度条 */}
        {kaitorixLoading && kaitorixProgress && (
          <div className="mb-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3 shadow-[var(--shadow-sm)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[var(--color-text-muted)]">
                买取价格获取中... {kaitorixProgress.completed}/{kaitorixProgress.total}
                {kaitorixProgress.failed > 0 && (
                  <span className="text-[var(--color-danger)] ml-2">({kaitorixProgress.failed} 失败)</span>
                )}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">
                ~{Math.ceil((kaitorixProgress.total - kaitorixProgress.completed) * 6 / 60)} 分钟
              </span>
            </div>
            <div className="w-full bg-[var(--color-bg-subtle)] rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  kaitorixProgress.stopped
                    ? 'bg-[var(--color-danger)]'
                    : 'bg-[var(--color-primary)]'
                }`}
                style={{ width: `${(kaitorixProgress.completed / kaitorixProgress.total) * 100}%` }}
              />
            </div>
            {kaitorixProgress.stopped && (
              <p className="text-xs text-[var(--color-danger)] mt-1">
                请求被限制，已自动停止。已获取的价格数据仍然可用。
              </p>
            )}
          </div>
        )}

        {/* 筛选计数 */}
        {transactions.length > 0 && (
          <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] px-1 -mt-1 mb-2">
            <span>
              {filteredTransactions.length < transactions.length
                ? <><span className="font-semibold text-[var(--color-text)]">{filteredTransactions.length}</span> / {transactions.length} 件</>
                : <>{transactions.length} 件</>
              }
            </span>
            {filteredTransactions.length < transactions.length && (
              <span className="text-[var(--color-primary)]">已筛选</span>
            )}
          </div>
        )}

        {/* 交易列表 */}
        {filteredTransactions.length === 0 ? (
          <div className={card.primary + ' p-12 text-center'}>
            <svg className="w-16 h-16 text-[var(--color-primary)] opacity-60 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-[var(--color-text-muted)] text-lg">暂无交易记录</p>
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
              {displayItems.map((item) =>
                item.type === 'group' ? (
                  <TransactionGroupCard
                    key={item.data.janCode}
                    group={item.data}
                    isExpanded={expandedGroups.has(item.data.janCode)}
                    onToggle={() => toggleGroupExpand(item.data.janCode)}
                    dateSortMode={dateSortMode}
                    onDelete={deleteTransaction}
                    onMarkArrived={handleMarkArrived}
                    onQuickSale={openQuickSale}
                    onQuickReturn={openQuickReturn}
                    onQuickEdit={openQuickEdit}
                    onQuickCopy={openQuickCopy}
                    buybackPrices={buybackPrices}
                    purchasePlatforms={purchasePlatforms}
                    compareMode={compareMode}
                    selectedIds={selectedIds}
                    onToggleSelect={toggleSelect}
                    onSelectGroup={selectGroup}
                    onLongPress={(id) => { setCompareMode(true); toggleSelect(id); }}
                  />
                ) : (
                  <TransactionCard
                    key={item.data.id}
                    transaction={item.data}
                    dateSortMode={dateSortMode}
                    onDelete={deleteTransaction}
                    onMarkArrived={handleMarkArrived}
                    onQuickSale={openQuickSale}
                    onQuickReturn={openQuickReturn}
                    onQuickEdit={openQuickEdit}
                    onQuickCopy={openQuickCopy}
                    buybackInfo={buybackPrices.get(item.data.id)}
                    purchasePlatforms={purchasePlatforms}
                    compareMode={compareMode}
                    isSelected={selectedIds.has(item.data.id)}
                    onToggleSelect={toggleSelect}
                    onLongPress={(id) => { setCompareMode(true); toggleSelect(id); }}
                  />
                )
              )}
            </div>

            {/* 桌面端：表格 */}
            <div className="hidden md:block">
              <div className={card.primary + ' overflow-hidden'}>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-xs text-[var(--color-text-muted)] uppercase tracking-[0.04em]">
                        {visibleColumns.map(key => {
                          if (key === 'date') return (
                            <th key="date" className="px-4 py-3 text-left font-semibold">
                              <div className="flex items-center gap-1">
                                <button onClick={() => toggleSort('date')} className="flex items-center gap-1 hover:text-[var(--color-text)] transition-colors">
                                  {dateSortMode === 'purchase' ? '进货日期' : '销售日期'}
                                  {sortField === 'date' && (
                                    <svg className={`w-3.5 h-3.5 ${sortOrder === 'asc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                </button>
                                <button onClick={() => setDateSortMode(dateSortMode === 'purchase' ? 'sale' : 'purchase')} className="px-1 py-0.5 text-[10px] bg-[var(--color-bg-elevated)] rounded hover:text-[var(--color-primary)] transition-colors" title="切换日期类型">⇄</button>
                              </div>
                            </th>
                          );
                          if (key === 'price') return (
                            <th key="price" className="px-4 py-3 text-left font-semibold">
                              <div>进货单价</div>
                              <div className="text-[10px] text-[var(--color-text-muted)] font-normal normal-case">(不含返点)</div>
                            </th>
                          );
                          if (key === 'arrived') return <th key="arrived" className="px-2 py-3 text-center"></th>;
                          if (key === 'profit') return (
                            <th key="profit" className="px-4 py-3 text-right font-semibold">
                              <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                                <button onClick={() => toggleSort('total_profit')} className="flex items-center gap-1 hover:text-[var(--color-text)] transition-colors">
                                  {profitSortMode === 'actual' ? '利润' : '预估利润'}
                                  {sortField === 'total_profit' && (
                                    <svg className={`w-3.5 h-3.5 ${sortOrder === 'asc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                </button>
                                <button onClick={() => setProfitSortMode(profitSortMode === 'actual' ? 'expected' : 'actual')} className="px-1 py-0.5 text-[10px] bg-[var(--color-bg-elevated)] rounded hover:text-[var(--color-primary)] transition-colors" title="切换利润类型">⇄</button>
                              </div>
                            </th>
                          );
                          if (key === 'buyback') return (
                            <th key="buyback" className="px-4 py-3 text-right cursor-pointer hover:text-[var(--color-text)] transition-colors font-semibold" onClick={() => toggleSort('buyback_price')}>
                              <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                                {COLUMN_LABELS.buyback}
                                {sortField === 'buyback_price' && (
                                  <svg className={`w-3.5 h-3.5 ${sortOrder === 'asc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>
                            </th>
                          );
                          if (key === 'actions') return <th key="actions" className="px-2 py-3 text-center font-semibold">{COLUMN_LABELS.actions}</th>;
                          return <th key={key} className="px-4 py-3 text-left font-semibold">{COLUMN_LABELS[key]}</th>;
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
                      {displayItems.map((item) =>
                        item.type === 'group' ? (
                          <TransactionGroupRow
                            key={item.data.janCode}
                            group={item.data}
                            isExpanded={expandedGroups.has(item.data.janCode)}
                            onToggle={() => toggleGroupExpand(item.data.janCode)}
                            dateSortMode={dateSortMode}
                            onDelete={deleteTransaction}
                            onMarkArrived={handleMarkArrived}
                            onQuickSale={openQuickSale}
                            onQuickReturn={openQuickReturn}
                            onQuickEdit={openQuickEdit}
                            onQuickCopy={openQuickCopy}
                            buybackPrices={buybackPrices}
                            purchasePlatforms={purchasePlatforms}
                            compareMode={compareMode}
                            selectedIds={selectedIds}
                            onToggleSelect={toggleSelect}
                            onSelectGroup={selectGroup}
                            visibleColumns={visibleColumns}
                          />
                        ) : (
                          <TransactionRow
                            key={item.data.id}
                            transaction={item.data}
                            dateSortMode={dateSortMode}
                            onDelete={deleteTransaction}
                            onMarkArrived={handleMarkArrived}
                            onQuickSale={openQuickSale}
                            onQuickReturn={openQuickReturn}
                            onQuickEdit={openQuickEdit}
                            onQuickCopy={openQuickCopy}
                            buybackInfo={buybackPrices.get(item.data.id)}
                            purchasePlatforms={purchasePlatforms}
                            compareMode={compareMode}
                            isSelected={selectedIds.has(item.data.id)}
                            onToggleSelect={toggleSelect}
                            visibleColumns={visibleColumns}
                          />
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 多选模式浮动操作栏 */}
      {compareMode && (
        <div className="fixed bottom-24 md:bottom-6 inset-x-0 flex justify-center px-3 z-[9998] pointer-events-none">
          <div className="pointer-events-auto bg-[var(--color-header)] text-white rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] px-3 py-3 flex items-center gap-2 max-w-lg w-full border border-white/10">
            <div className="flex-1 text-sm min-w-0">
              {selectedIds.size === 0
                ? <span className="text-white/60 text-xs">请选择</span>
                : <span>已选 <span className="font-bold text-[var(--color-primary)]">{selectedIds.size}</span> 件</span>
              }
            </div>
            {/* 批量到货 */}
            {[...selectedIds].some(id => transactions.find(t => t.id === id && t.status === 'pending')) && (
              <button
                onClick={handleBatchArrival}
                className="px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-semibold bg-[var(--color-warning)] active:opacity-80 text-white transition-all whitespace-nowrap"
              >
                批量到货
              </button>
            )}
            {/* 批量删除 */}
            {selectedIds.size > 0 && (
              <button
                onClick={handleBatchDelete}
                className="px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-semibold bg-[var(--color-danger)] text-white active:opacity-80 transition-all whitespace-nowrap"
              >
                删除
              </button>
            )}
            {/* 买取比较 */}
            {kaitorixEnabled && buybackPrices.size > 0 && (
              <button
                disabled={selectedIds.size < 2}
                onClick={() => setShowComparison(true)}
                className={`px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-semibold transition-all whitespace-nowrap ${
                  selectedIds.size >= 2
                    ? 'bg-[var(--color-primary)] active:opacity-80 text-white'
                    : 'bg-white/10 text-white/40 cursor-not-allowed'
                }`}
              >
                比较
              </button>
            )}
            {selectedIds.size > 0 && (
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-white/60 hover:text-white transition-colors px-1"
              >
                清空
              </button>
            )}
            <button
              onClick={exitCompareMode}
              className="p-1.5 text-white/60 hover:text-white transition-colors flex-shrink-0"
              aria-label="退出多选模式"
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

      <JanListSheet
        isOpen={showJanList}
        onClose={() => setShowJanList(false)}
        transactions={compareMode && selectedIds.size > 0 ? selectedTransactions : filteredTransactions}
        buybackMap={buybackPrices}
      />

      {/* 出售 Modal */}
      {(() => {
        const tx = saleModalId ? transactions.find(t => t.id === saleModalId) : null;
        if (!tx) return null;
        return (
          <Modal
            isOpen={!!saleModalId}
            onClose={() => setSaleModalId(null)}
            title="记录销售"
            size="lg"
          >
            <BatchSaleForm
              transaction={tx}
              onSuccess={() => {
                setSaleModalId(null);
                loadTransactions();
                setToastMsg('销售已记录');
              }}
              onCancel={() => setSaleModalId(null)}
            />
          </Modal>
        );
      })()}

      {/* 退货 Modal */}
      {(() => {
        const tx = returnModalId ? transactions.find(t => t.id === returnModalId) : null;
        if (!tx) return null;
        return (
          <Modal
            isOpen={!!returnModalId}
            onClose={() => setReturnModalId(null)}
            title="记录退货"
            size="lg"
          >
            <ReturnForm
              transaction={tx}
              onSuccess={() => {
                setReturnModalId(null);
                loadTransactions();
                setToastMsg('退货已记录');
              }}
              onCancel={() => setReturnModalId(null)}
            />
          </Modal>
        );
      })()}

      {/* 快速编辑 Modal */}
      {(() => {
        const tx = editModalId ? transactions.find(t => t.id === editModalId) : null;
        if (!tx) return null;
        return (
          <Modal
            isOpen={!!editModalId}
            onClose={() => setEditModalId(null)}
            title="快速编辑"
            size="lg"
          >
            <QuickEditForm
              transaction={tx}
              paymentMethods={paymentMethods}
              purchasePlatforms={purchasePlatforms}
              onSuccess={() => {
                setEditModalId(null);
                loadTransactions();
                setToastMsg('已保存');
              }}
              onCancel={() => setEditModalId(null)}
            />
          </Modal>
        );
      })()}

      {/* 快速复制 Modal */}
      {(() => {
        const tx = copyModalId ? transactions.find(t => t.id === copyModalId) : null;
        if (!tx) return null;
        return (
          <Modal
            isOpen={!!copyModalId}
            onClose={() => setCopyModalId(null)}
            title="复制交易"
            size="lg"
          >
            <QuickCopyForm
              source={tx}
              onSuccess={() => {
                setCopyModalId(null);
                loadTransactions();
                setToastMsg('已创建新交易');
              }}
              onCancel={() => setCopyModalId(null)}
            />
          </Modal>
        );
      })()}

      {/* 删除确认 */}
      <ConfirmModal
        isOpen={!!deleteModalId}
        onClose={() => { if (!deleteSubmitting) setDeleteModalId(null); }}
        onConfirm={confirmDelete}
        title="删除交易"
        message={`确定要删除${deleteModalId ? `「${transactions.find(t => t.id === deleteModalId)?.product_name ?? ''}」` : ''}这条交易记录吗?此操作无法撤销。`}
        confirmText="删除"
        confirmVariant="danger"
        isLoading={deleteSubmitting}
      />

      {/* 列定制 Modal */}
      <Modal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="自定义列"
        size="sm"
      >
        <TransactionColumnPicker
          value={pickerDraft}
          onChange={setPickerDraft}
          onReset={() => setPickerDraft(DEFAULT_COLUMNS)}
        />
        <div className="flex justify-end gap-2 pt-4 border-t border-[var(--color-border)] mt-4">
          <button
            onClick={() => setPickerOpen(false)}
            className="px-4 py-2 text-sm text-[var(--color-text-muted)] border border-[var(--color-border)] rounded-[var(--radius-md)] active:opacity-70 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSaveColumns}
            className="px-4 py-2 text-sm bg-[var(--color-primary)] text-white rounded-[var(--radius-md)] active:opacity-80 transition-colors font-semibold"
          >
            保存
          </button>
        </div>
      </Modal>

      {toastMsg && <Toast message={toastMsg} onClose={() => setToastMsg(null)} />}
    </div>
    </PullToRefresh>
  );
}

// ─── JAN List Sheet ──────────────────────────────────────────────────────────

interface JanListSheetProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: TransactionWithPayment[];
  buybackMap: Map<string, { maxPrice: number; maxStore: string; expectedProfit?: number; allPrices?: Array<{ store: string; price: number; url: string }> }>;
}

function JanListSheet({ isOpen, onClose, transactions, buybackMap }: JanListSheetProps) {
  const [copied, setCopied] = useState(false);

  // 找出所有商品价格合计最高的那家店，列表统一用该店的 URL
  const { bestStore, bestStoreTotal, items, missingCount } = useMemo(() => {
    // Step 1: 按 JAN 去重，收集每个 JAN 的所有店铺报价
    const janMap = new Map<string, { name: string; allPrices: Array<{ store: string; price: number; url: string }> }>();
    for (const tx of transactions) {
      if (!tx.jan_code) continue;
      const bb = buybackMap.get(tx.id);
      if (!janMap.has(tx.jan_code)) {
        janMap.set(tx.jan_code, { name: tx.product_name || tx.jan_code, allPrices: bb?.allPrices ?? [] });
      } else if (bb?.allPrices?.length && !janMap.get(tx.jan_code)!.allPrices.length) {
        janMap.get(tx.jan_code)!.allPrices = bb.allPrices;
      }
    }

    // Step 2: 按店铺累加所有 JAN 的报价，找总额最高的店
    const storeTotals = new Map<string, { total: number; janData: Map<string, { url: string; price: number }> }>();
    for (const [jan, info] of janMap.entries()) {
      for (const p of info.allPrices) {
        if (!storeTotals.has(p.store)) storeTotals.set(p.store, { total: 0, janData: new Map() });
        const st = storeTotals.get(p.store)!;
        st.total += p.price;
        st.janData.set(jan, { url: p.url, price: p.price });
      }
    }

    let bestStore = '';
    let bestStoreTotal = 0;
    for (const [store, data] of storeTotals.entries()) {
      if (data.total > bestStoreTotal) { bestStoreTotal = data.total; bestStore = store; }
    }

    // Step 3: 用最高总价店铺的 URL 构建列表
    const bestData = bestStore ? storeTotals.get(bestStore) : null;
    let missingCount = 0;
    const items = Array.from(janMap.entries()).map(([jan, info]) => {
      const d = bestData?.janData.get(jan);
      if (!d) missingCount++;
      return { jan, name: info.name, price: d?.price ?? 0, storeUrl: d?.url ?? '' };
    }).sort((a, b) => b.price - a.price);

    return { bestStore, bestStoreTotal, items, missingCount };
  }, [transactions, buybackMap]);

  const copyAll = async () => {
    const text = items.map(item => item.jan).join('\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10020] flex flex-col bg-[var(--color-bg)]">
      {/* Header */}
      <div className="bg-[var(--color-header)] text-white">
        <div className="flex items-center justify-between px-4 pt-12 pb-3">
        <div>
          <h2 className="text-lg font-bold">JAN 买取列表</h2>
          <p className="text-xs text-white/65">
            {items.length} 个商品
            {bestStore ? (
              <span className="ml-1.5 text-[var(--color-primary)] font-semibold">
                · 最优店：{bestStore}（合计 ¥{bestStoreTotal.toLocaleString()}）
              </span>
            ) : null}
            {missingCount > 0 && (
              <span className="ml-1.5 text-[var(--color-warning)]">· {missingCount} 件该店无报价</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-semibold bg-white/10 text-white active:opacity-70"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {copied ? '已复制' : '复制 JAN'}
          </button>
          <button onClick={onClose} className="p-1.5 text-white/65 hover:text-white" aria-label="关闭">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        </div>
        <div className="h-[3px] bg-gradient-to-r from-[var(--color-primary)] to-[#34d399]" />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-[var(--color-text-muted)] text-sm">
            没有带 JAN 码的商品
          </div>
        ) : (
          items.map(item => {
            const href = item.storeUrl || undefined;
            const Tag = href ? 'a' : 'div';
            return (
              <Tag
                key={item.jan}
                {...(href ? { href, target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="flex items-center gap-3 bg-[var(--color-bg-elevated)] rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3 shadow-[var(--shadow-sm)] active:opacity-70"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-text)] truncate">{item.name}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5 font-mono">{item.jan}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  {item.price > 0 ? (
                    <p className="text-base font-bold text-[var(--color-success)]">
                      ¥{item.price.toLocaleString()}
                    </p>
                  ) : (
                    <p className="text-xs text-[var(--color-warning)]">无报价</p>
                  )}
                  {href && (
                    <svg className="w-4 h-4 text-[var(--color-text-muted)] mt-1 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  )}
                </div>
              </Tag>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <>
      <Suspense fallback={
        <div className={layout.page + ' flex items-center justify-center'}>
          <div className="flex items-center gap-3 text-[var(--color-text)]">
            <svg className="animate-spin h-8 w-8 text-[var(--color-primary)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-lg font-medium">加载中...</span>
          </div>
        </div>
      }>
        <TransactionsContent />
      </Suspense>
    </>
  );
}
