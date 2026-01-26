// app/transactions/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Transaction, PaymentMethod } from '@/types/database.types';
import { formatCurrency, formatROI } from '@/lib/financial/calculator';
import Link from 'next/link';
import Image from 'next/image';
import { layout, heading, card, button, badge, input, tabs } from '@/lib/theme';

interface TransactionWithPayment extends Transaction {
  payment_method?: PaymentMethod;
}

type SortField = 'date' | 'purchase_price_total' | 'total_profit' | 'roi';
type SortOrder = 'asc' | 'desc';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<TransactionWithPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_stock' | 'sold'>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // 统计数据
  const [stats, setStats] = useState({
    total: 0,
    inStock: 0,
    sold: 0,
    totalCost: 0,
    totalProfit: 0,
    avgROI: 0,
  });

  useEffect(() => {
    loadTransactions();
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

      setTransactions(data || []);
    } catch (error) {
      console.error('加载交易记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = () => {
    const inStock = transactions.filter(t => t.status === 'in_stock');
    const sold = transactions.filter(t => t.status === 'sold');

    const totalCost = transactions.reduce((sum, t) => sum + t.purchase_price_total, 0);
    const totalProfit = sold.reduce((sum, t) => sum + (t.total_profit || 0), 0); // 使用 total_profit 而不是 cash_profit
    const avgROI = sold.length > 0
      ? sold.reduce((sum, t) => sum + (t.roi || 0), 0) / sold.length
      : 0;

    setStats({
      total: transactions.length,
      inStock: inStock.length,
      sold: sold.length,
      totalCost,
      totalProfit,
      avgROI,
    });
  };

  // 筛选和排序
  const filteredTransactions = transactions
    .filter(t => {
      const matchesSearch = t.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           t.notes?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];

      // 处理 null 值
      if (aValue === null) aValue = 0;
      if (bValue === null) bValue = 0;

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
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
            </select>
          </div>
        </div>

        {/* 交易列表 */}
        <div className={card.primary + ' shadow-2xl overflow-hidden'}>
          {filteredTransactions.length === 0 ? (
            <div className="p-12 text-center">
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
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      商品
                    </th>
                    <th
                      className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                      onClick={() => toggleSort('date')}
                    >
                      <div className="flex items-center gap-1">
                        日期
                        {sortField === 'date' && (
                          <svg className={`w-4 h-4 ${sortOrder === 'asc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        )}
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
                    // 移动端点击整行也能进入详情
                    <tr key={transaction.id} className="hover:bg-gray-100 dark:bg-gray-700 transition-colors" onClick={() => {if (window.innerWidth < 768) location.href = `/transactions/${transaction.id}`}}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {transaction.image_url && (
                            <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-800 flex-shrink-0">
                              <Image
                                src={transaction.image_url}
                                alt={transaction.product_name}
                                width={48}
                                height={48}
                                className="object-cover w-full h-full"
                              />
                            </div>
                          )}
                          <div>
                            <div className="text-gray-900 dark:text-white font-medium">{transaction.product_name}</div>
                            {transaction.payment_method && (
                              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                {transaction.payment_method.name}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {new Date(transaction.date).toLocaleDateString('zh-CN')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap" >
                        {transaction.status === 'sold' ? (
                          <span className={badge.success + ' border border-emerald-500/30'}>
                            已售出
                          </span>
                        ) : (
                          <span className={badge.pending + ' border border-amber-500/30'}>
                            库存中
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-900 dark:text-white font-mono">
                        {formatCurrency(transaction.purchase_price_total)}
                      </td>
                      <td className="px-6 py-4 text-right font-mono">
                        {transaction.status === 'sold' ? (
                          <span className={transaction.total_profit && transaction.total_profit >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                            {formatCurrency(transaction.total_profit || 0)}
                          </span>
                        ) : (
                          <span className="text-gray-500 dark:text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right font-mono">
                        {transaction.status === 'sold' ? (
                          <span className={transaction.roi && transaction.roi >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                            {formatROI(transaction.roi || 0)}
                          </span>
                        ) : (
                          <span className="text-gray-500 dark:text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/transactions/${transaction.id}`}
                            className="p-2 text-gray-600 dark:text-gray-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all"
                            title="查看详情"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </Link>
                          <Link
                            href={`/transactions/${transaction.id}/edit`}
                            className="p-2 text-gray-600 dark:text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all"
                            title="编辑"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </Link>
                          <button
                            onClick={() => deleteTransaction(transaction.id)}
                            className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                            title="删除"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
