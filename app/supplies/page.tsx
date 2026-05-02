// app/supplies/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { getSuppliesCosts, deleteSuppliesCost } from '@/lib/api/supplies';
import type { SuppliesCost } from '@/types/database.types';
import { formatCurrency } from '@/lib/financial/calculator';
import Link from 'next/link';
import { layout, heading, card, button, badge } from '@/lib/theme';
import PullToRefresh from '@/components/PullToRefresh';
import { formatDateToLocal, parseDateFromLocal } from '@/lib/utils/dateUtils';

const CATEGORY_LABELS: Record<string, string> = {
  '包装材料': '包装材料',
  '运输耗材': '运输耗材',
  '标签打印': '标签打印',
  '其他': '其他',
};

export default function SuppliesPage() {
  const [supplies, setSupplies] = useState<SuppliesCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadSupplies();
  }, []);

  useEffect(() => {
    const handler = () => loadSupplies();
    window.addEventListener('bfcache-restore', handler);
    return () => window.removeEventListener('bfcache-restore', handler);
  }, []);

  const loadSupplies = async () => {
    setLoading(true);
    try {
      const data = await getSuppliesCosts();
      setSupplies(data);
    } catch (error) {
      console.error('加载耗材记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这条耗材记录吗？')) {
      return;
    }

    const success = await deleteSuppliesCost(id);
    if (success) {
      setSupplies(supplies.filter(s => s.id !== id));
    } else {
      alert('删除失败，请重试');
    }
  };

  const filteredSupplies = filter === 'all'
    ? supplies
    : supplies.filter(s => s.category === filter);

  const totalCost = filteredSupplies.reduce((sum, s) => sum + s.amount, 0);

  // 按月份统计
  const monthlyStats = supplies.reduce((acc, supply) => {
    const month = supply.purchase_date.substring(0, 7);
    if (!acc[month]) {
      acc[month] = 0;
    }
    acc[month] += supply.amount;
    return acc;
  }, {} as Record<string, number>);

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
    <PullToRefresh onRefresh={loadSupplies}>
    <div className={layout.page}>
      <div className={layout.container}>
        {/* 标题区域 */}
        <div className={layout.section}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className={heading.h1 + ' mb-2'}>耗材成本管理</h1>
              <p className="text-[var(--color-text-muted)]">
                管理包装材料、运输耗材等固定成本
              </p>
            </div>
            <Link
              href="/supplies/add"
              className={button.primary + ' flex items-center gap-2'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              添加耗材记录
            </Link>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className={card.stat}>
            <div className="text-[var(--color-text-muted)] text-sm mb-1">总耗材成本</div>
            <div className="text-2xl font-bold text-[var(--color-text)]">
              {formatCurrency(totalCost)}
            </div>
          </div>
          <div className={card.stat}>
            <div className="text-[var(--color-text-muted)] text-sm mb-1">记录数量</div>
            <div className="text-2xl font-bold text-[var(--color-text)]">
              {filteredSupplies.length}
            </div>
          </div>
          <div className={card.stat}>
            <div className="text-[var(--color-text-muted)] text-sm mb-1">本月耗材</div>
            <div className="text-2xl font-bold text-[var(--color-text)]">
              {formatCurrency(monthlyStats[formatDateToLocal(new Date()).substring(0, 7)] || 0)}
            </div>
          </div>
          <div className={card.stat}>
            <div className="text-[var(--color-text-muted)] text-sm mb-1">平均单笔</div>
            <div className="text-2xl font-bold text-[var(--color-text)]">
              {formatCurrency(filteredSupplies.length > 0 ? totalCost / filteredSupplies.length : 0)}
            </div>
          </div>
        </div>

        {/* 筛选器 */}
        <div className={card.primary + ' p-4 mb-6'}>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-bg-subtle)] text-[var(--color-text)] active:opacity-80'
              }`}
            >
              全部
            </button>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === key
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-[var(--color-bg-subtle)] text-[var(--color-text)] active:opacity-80'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 耗材列表 */}
        <div className={card.primary + ' overflow-hidden'}>
          {filteredSupplies.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="w-16 h-16 text-[var(--color-text-muted)] mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-[var(--color-text-muted)] text-lg">暂无耗材记录</p>
              <Link
                href="/supplies/add"
                className={button.primary + ' inline-block mt-4'}
              >
                添加第一条记录
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                      日期
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                      分类
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                      描述
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                      金额
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {filteredSupplies.map((supply) => (
                    <tr key={supply.id} className="active:opacity-80 transition-colors">
                      <td className="px-6 py-4 text-[var(--color-text)] whitespace-nowrap">
                        {parseDateFromLocal(supply.purchase_date)?.toLocaleDateString('zh-CN') ?? supply.purchase_date}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={badge.info}>
                          {CATEGORY_LABELS[supply.category] || supply.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[var(--color-text)]">
                        {supply.description || '-'}
                      </td>
                      <td className="px-6 py-4 text-right text-[var(--color-text)] font-mono font-semibold">
                        {formatCurrency(supply.amount)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/supplies/${supply.id}/edit`}
                            className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] rounded-[var(--radius-md)] transition-all"
                            title="编辑"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </Link>
                          <button
                            onClick={() => handleDelete(supply.id)}
                            className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[rgba(239,68,68,0.1)] rounded-[var(--radius-md)] transition-all"
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

        {/* 月度统计 */}
        {Object.keys(monthlyStats).length > 0 && (
          <div className={card.primary + ' p-6 mt-8'}>
            <h2 className={heading.h3 + ' mb-4'}>月度统计</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {Object.entries(monthlyStats)
                .sort((a, b) => b[0].localeCompare(a[0]))
                .map(([month, amount]) => (
                  <div key={month} className="bg-[var(--color-bg-subtle)] rounded-[var(--radius-md)] p-4">
                    <div className="text-sm text-[var(--color-text-muted)] mb-1">
                      {month}
                    </div>
                    <div className="text-lg font-bold text-[var(--color-text)]">
                      {formatCurrency(amount)}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
    </PullToRefresh>
  );
}
