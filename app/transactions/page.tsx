// app/transactions/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import type { Transaction, PaymentMethod } from '@/types/database.types';
import { formatCurrency, formatROI } from '@/lib/financial/calculator';
import Link from 'next/link';
import { layout, heading, card, button, input } from '@/lib/theme';
import TransactionFilters, { type FilterValues } from '@/components/TransactionFilters';
import TransactionCard from '@/components/TransactionCard';
import TransactionRow from '@/components/TransactionRow';

interface TransactionWithPayment extends Transaction {
  payment_method?: PaymentMethod;
  latest_sale_date?: string | null;
  aggregated_profit?: number | null;
  aggregated_roi?: number | null;
}

type SortField = 'date' | 'purchase_price_total' | 'total_profit' | 'roi';
type SortOrder = 'asc' | 'desc';
type DateSortMode = 'purchase' | 'sale'; // 日期排序模式

interface PaymentMethodBasic {
  id: string;
  name: string;
}

export default function TransactionsPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<TransactionWithPayment[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodBasic[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_stock' | 'sold' | 'returned'>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [dateSortMode, setDateSortMode] = useState<DateSortMode>('purchase'); // 日期排序模式
  const [activeFilters, setActiveFilters] = useState<FilterValues | null>(null);

  // 统计数据
  const [stats, setStats] = useState({
    total: 0,
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
  }, []);

  useEffect(() => {
    calculateStats();
  }, [transactions]);

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
            .select('total_profit, roi, sale_date')
            .eq('transaction_id', transaction.id)
            .order('sale_date', { ascending: false });

          let latest_sale_date = null;
          let aggregated_profit = null;
          let aggregated_roi = null;

          if (salesRecords && salesRecords.length > 0) {
            // 获取最新销售日期
            latest_sale_date = salesRecords[0].sale_date;

            // 计算累计利润和ROI（对所有有销售记录的商品）
            if (transaction.quantity_sold > 0) {
              aggregated_profit = salesRecords.reduce((sum, r) => sum + (r.total_profit || 0), 0);
              aggregated_roi = salesRecords.reduce((sum, r) => sum + (r.roi || 0), 0) / salesRecords.length;
            }
          }

          return {
            ...transaction,
            latest_sale_date,
            aggregated_profit,
            aggregated_roi,
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

  const calculateStats = () => {
    const inStock = transactions.filter(t => t.status === 'in_stock');
    const sold = transactions.filter(t => t.status === 'sold');
    const returned = transactions.filter(t => t.status === 'returned');

    const totalCost = transactions.reduce((sum, t) => sum + t.purchase_price_total, 0);
    const totalProfit = sold.reduce((sum, t) => sum + (t.total_profit || 0), 0);
    const avgROI = sold.length > 0
      ? sold.reduce((sum, t) => sum + (t.roi || 0), 0) / sold.length
      : 0;

    setStats({
      total: transactions.length,
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

        {/* 统计卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4 mb-8">
          <div className={card.stat}>
            <div className="text-gray-600 dark:text-gray-400 text-sm mb-1">总交易</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
          </div>
          <div className={card.stat + ' border-emerald-500/30'}>
            <div className="text-emerald-600 dark:text-emerald-400 text-sm mb-1">已售出</div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.sold}</div>
          </div>
          <div className={card.stat + ' border-amber-500/30'}>
            <div className="text-amber-600 dark:text-amber-400 text-sm mb-1">库存中</div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.inStock}</div>
          </div>
          <div className={card.stat + ' border-red-500/30'}>
            <div className="text-red-600 dark:text-red-400 text-sm mb-1">已退货</div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.returned}</div>
          </div>
          <div className={card.stat}>
            <div className="text-gray-600 dark:text-gray-400 text-sm mb-1">总成本</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(stats.totalCost)}</div>
          </div>
          <div className={card.stat}>
            <div className="text-gray-600 dark:text-gray-400 text-sm mb-1">总利润</div>
            <div className={`text-2xl font-bold ${stats.totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {formatCurrency(stats.totalProfit)}
            </div>
          </div>
          <div className={card.stat}>
            <div className="text-gray-600 dark:text-gray-400 text-sm mb-1">平均ROI</div>
            <div className={`text-2xl font-bold ${stats.avgROI >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {formatROI(stats.avgROI)}
            </div>
          </div>
        </div>

        {/* 高级筛选器 */}
        <TransactionFilters
          onApply={handleApplyFilters}
          onClear={handleClearFilters}
          paymentMethods={paymentMethods}
        />

        {/* 筛选和搜索 */}
        <div className={card.primary + ' p-6 shadow-2xl mb-6'}>
          <div className="flex flex-col md:flex-row gap-4">
            {/* 搜索框 */}
            <div className="flex-1">
              <div className="relative">
                <input
                  type="text"
                  placeholder="搜索商品名称或备注..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={input.base + ' pl-12'}
                />
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* 状态筛选 */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className={input.base}
            >
              <option value="all">全部状态</option>
              <option value="in_stock">库存中</option>
              <option value="sold">已售出</option>
              <option value="returned">已退货</option>
            </select>
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
