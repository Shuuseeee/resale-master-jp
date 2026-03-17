// app/dashboard/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { getDashboardStats } from '@/lib/api/financial';
import {
  formatCurrency,
  daysUntil,
  getUrgencyLevel
} from '@/lib/financial/calculator';
import Link from 'next/link';
import { layout, heading, card, button, badge } from '@/lib/theme';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [inStockCount, setInStockCount] = useState(0);
  const [monthlyProfit, setMonthlyProfit] = useState(0);
  const [monthlySalesCount, setMonthlySalesCount] = useState(0);
  const [expiringCoupons, setExpiringCoupons] = useState<any[]>([]);
  const [totalInvestment, setTotalInvestment] = useState(0);
  const [totalRecovered, setTotalRecovered] = useState(0);
  const [confirmedProfit, setConfirmedProfit] = useState(0);
  const [unrealizedStockCost, setUnrealizedStockCost] = useState(0);
  const [expectedPoints, setExpectedPoints] = useState(0);
  const [includePoints, setIncludePoints] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getDashboardStats();
      setInStockCount(data.inStockCount);
      setMonthlyProfit(data.monthlyProfit);
      setMonthlySalesCount(data.monthlySalesCount);
      setExpiringCoupons(data.expiringCoupons);
      setTotalInvestment(data.totalInvestment);
      setTotalRecovered(data.totalRecovered);
      setConfirmedProfit(data.confirmedProfit);
      setUnrealizedStockCost(data.unrealizedStockCost);
      setExpectedPoints(data.expectedPoints);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const urgencyColors: Record<string, string> = {
    urgent: 'bg-red-500/20 border-red-500/50 text-red-600 dark:text-red-300',
    warning: 'bg-amber-500/20 border-amber-500/50 text-amber-600 dark:text-amber-300',
    normal: 'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800 text-gray-900 dark:text-gray-300',
    expired: 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400',
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-900 dark:text-white text-xl">加载中...</div>
      </div>
    );
  }

  return (
    <div className={layout.page}>
      <div className={layout.container}>
        {/* 标题 */}
        <div className={layout.section}>
          <h1 className={heading.h1 + ' mb-2'}>仪表盘</h1>
          <p className="text-gray-600 dark:text-gray-400">查看业务概览</p>
        </div>

        {/* KPI カード */}
        <div className="mb-8">
          {/* ポイント含むトグル */}
          <div className="flex justify-end mb-3">
            <button
              onClick={() => setIncludePoints(!includePoints)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                includePoints
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600'
              }`}
            >
              <div className={`w-8 h-4 rounded-full relative transition-colors ${includePoints ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${includePoints ? 'left-4' : 'left-0.5'}`} />
              </div>
              包含积分价值
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* 在庫数 */}
            <div className={card.primary + ' p-4'}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 dark:text-gray-400 text-xs">库存数</span>
                <svg className="w-5 h-5 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{inStockCount.toLocaleString()}</div>
              <div className="text-xs text-gray-500 mt-1">个</div>
            </div>

            {/* 総投資額 */}
            <div className={card.primary + ' p-4'}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 dark:text-gray-400 text-xs">总投资额</span>
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalInvestment)}</div>
              <div className="text-xs text-gray-500 mt-1">全部交易总计</div>
            </div>

            {/* 回収済み */}
            <div className={card.primary + ' p-4'}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 dark:text-gray-400 text-xs">已回收</span>
                <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalRecovered)}</div>
              <div className="text-xs text-gray-500 mt-1">销售总额</div>
            </div>

            {/* 確定利益 */}
            <div className={card.primary + ' p-4'}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 dark:text-gray-400 text-xs">确认利润</span>
                <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div className={`text-2xl font-bold ${confirmedProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(confirmedProfit)}
              </div>
              <div className="text-xs text-gray-500 mt-1">已售出部分</div>
            </div>

            {/* 未回収在庫原価 */}
            <div className={card.primary + ' p-4'}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 dark:text-gray-400 text-xs">未回收库存</span>
                <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{formatCurrency(unrealizedStockCost)}</div>
              <div className="text-xs text-gray-500 mt-1">在庫+未着</div>
            </div>

            {/* 今月の利益 / 期待ポイント */}
            <div className={card.primary + ' p-4'}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 dark:text-gray-400 text-xs">
                  {includePoints ? '预期积分' : '本月利润'}
                </span>
                <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {includePoints ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  )}
                </svg>
              </div>
              {includePoints ? (
                <>
                  <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{expectedPoints.toLocaleString()}</div>
                  <div className="text-xs text-gray-500 mt-1">pt（在庫+未着）</div>
                </>
              ) : (
                <>
                  <div className={`text-2xl font-bold ${monthlyProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {formatCurrency(monthlyProfit)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{monthlySalesCount}笔</div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
          {/* 期限間近のクーポン */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <div className="w-1 h-6 bg-gradient-to-b from-amber-500 to-yellow-500 rounded-full"></div>
                即将过期的优惠券
              </h2>
              <Link
                href="/coupons"
                className="text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors"
              >
                全部显示 →
              </Link>
            </div>

            {expiringCoupons.length === 0 ? (
              <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                <svg className="w-12 h-12 mx-auto text-green-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>没有即将过期的优惠券</div>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {expiringCoupons.map((coupon) => {
                  const days = daysUntil(coupon.expiry_date);
                  const urgency = getUrgencyLevel(coupon.expiry_date);

                  return (
                    <div
                      key={coupon.id}
                      className={`p-4 rounded-xl border ${urgencyColors[urgency]} transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <div className="font-semibold">{coupon.name}</div>
                        <div className="text-xs opacity-75">
                          {days > 0 ? `还有${days}天` : days === 0 ? '今日到期' : '已过期'}
                        </div>
                      </div>
                      <div className="text-sm opacity-75">
                        {coupon.discount_type === 'percentage' && `${coupon.discount_value}% OFF`}
                        {coupon.discount_type === 'fixed_amount' && `${formatCurrency(coupon.discount_value)} OFF`}
                        {coupon.discount_type === 'free_shipping' && '免运费'}
                        {coupon.platform && ` · ${coupon.platform}`}
                      </div>
                      <div className="text-xs opacity-60 mt-1">
                        有效期: {coupon.expiry_date}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* クイックアクション */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            href="/transactions/add"
            className="bg-teal-600 hover:bg-teal-700 rounded-xl p-6 text-center transition-all duration-200 hover:-translate-y-1 hover:shadow-xl shadow-lg text-white"
          >
            <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <div className="font-semibold">记录交易</div>
          </Link>

          <Link
            href="/transactions"
            className="bg-teal-600 hover:bg-teal-700 rounded-xl p-6 text-center transition-all duration-200 hover:-translate-y-1 hover:shadow-xl shadow-lg text-white"
          >
            <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <div className="font-semibold">交易列表</div>
          </Link>

          <Link
            href="/coupons"
            className="bg-teal-600 hover:bg-teal-700 rounded-xl p-6 text-center transition-all duration-200 hover:-translate-y-1 hover:shadow-xl shadow-lg text-white"
          >
            <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
            <div className="font-semibold">优惠券</div>
          </Link>

          <Link
            href="/analytics"
            className="bg-teal-600 hover:bg-teal-700 rounded-xl p-6 text-center transition-all duration-200 hover:-translate-y-1 hover:shadow-xl shadow-lg text-white"
          >
            <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <div className="font-semibold">数据分析</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
