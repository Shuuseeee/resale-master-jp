// app/dashboard/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { getDashboardStats, confirmPointsReceived, batchConfirmPoints } from '@/lib/api/financial';
import {
  calculateWaterLevel,
  getWaterLevelStatus,
  formatCurrency,
  daysUntil,
  getUrgencyLevel
} from '@/lib/financial/calculator';
import type { WaterLevelData, UpcomingPayment, PendingPoint, BankAccount } from '@/lib/api/financial';
import Link from 'next/link';
import { layout, heading, card, button, badge, alert as alertStyles } from '@/lib/theme';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [waterLevel, setWaterLevel] = useState<WaterLevelData | null>(null);
  const [upcomingPayments, setUpcomingPayments] = useState<UpcomingPayment[]>([]);
  const [pendingPoints, setPendingPoints] = useState<PendingPoint[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [confirmingPointId, setConfirmingPointId] = useState<string | null>(null);
  const [confirmingAll, setConfirmingAll] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getDashboardStats();
      setWaterLevel(data.waterLevel);
      setUpcomingPayments(data.upcomingPayments);
      setPendingPoints(data.pendingPoints);
      setBankAccounts(data.bankAccounts);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPoint = async (pointId: string) => {
    setConfirmingPointId(pointId);
    try {
      const success = await confirmPointsReceived(pointId);
      if (success) {
        setSuccessMessage('积分已确认！');
        setTimeout(() => setSuccessMessage(null), 3000);
        await loadData(); // 重新加载数据
      } else {
        alert('确认积分失败，请重试');
      }
    } catch (error) {
      console.error('确认积分失败:', error);
      alert('确认积分失败，请重试');
    } finally {
      setConfirmingPointId(null);
    }
  };

  const handleConfirmAllPoints = async () => {
    if (pendingPoints.length === 0) return;

    setConfirmingAll(true);
    try {
      const pointIds = pendingPoints.map(p => p.id);
      const confirmedCount = await batchConfirmPoints(pointIds);

      if (confirmedCount > 0) {
        setSuccessMessage(`成功确认 ${confirmedCount} 笔积分！`);
        setTimeout(() => setSuccessMessage(null), 3000);
        await loadData(); // 重新加载数据
      } else {
        alert('批量确认失败，请重试');
      }
    } catch (error) {
      console.error('批量确认失败:', error);
      alert('批量确认失败，请重试');
    } finally {
      setConfirmingAll(false);
    }
  };

  const waterLevelPercentage = waterLevel 
    ? calculateWaterLevel(waterLevel.total_balance, waterLevel.upcoming_payments_30d)
    : 0;
  
  const waterLevelStatus = getWaterLevelStatus(waterLevelPercentage);

  const statusColors = {
    safe: 'from-emerald-500 to-teal-500',
    warning: 'from-amber-500 to-orange-500',
    danger: 'from-red-500 to-rose-500',
  };

  const urgencyColors = {
    urgent: 'bg-red-500/20 border-red-500/50 text-red-400',
    warning: 'bg-amber-500/20 border-amber-500/50 text-amber-400',
    normal: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-gray-900 dark:text-gray-300',
    expired: 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400',
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-900 dark:text-gray-900 dark:text-white text-xl">加载中...</div>
      </div>
    );
  }

  return (
    <div className={layout.page}>
      {/* 成功提示 */}
      {successMessage && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-6 py-3 rounded-lg shadow-lg animate-fade-in">
          {successMessage}
        </div>
      )}

      <div className={layout.container}>
        {/* 标题 */}
        <div className={layout.section}>
          <h1 className={heading.h1 + ' mb-2'}>财务仪表盘</h1>
          <p className="text-gray-600 dark:text-gray-400">实时监控您的财务状况</p>
        </div>

        {/* 财务安全水位线 */}
        <div className={layout.section}>
          <div className={card.primary + ' p-6 shadow-2xl'}>
            <h2 className={heading.h2 + ' mb-6 flex items-center gap-3'}>
              <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${statusColors[waterLevelStatus]}`}></div>
              财务安全水位线
            </h2>

            {/* 水位进度条 */}
            <div className="mb-6">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                <span>可用余额 vs 30日内应付</span>
                <span className="font-mono">{waterLevelPercentage.toFixed(1)}%</span>
              </div>
              <div className="h-8 bg-slate-800 rounded-full overflow-hidden relative">
                <div 
                  className={`h-full bg-gradient-to-r ${statusColors[waterLevelStatus]} transition-all duration-1000 ease-out relative`}
                  style={{ width: `${waterLevelPercentage}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                </div>
              </div>
            </div>

            {/* 统计卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-700 rounded-xl p-4 border border-gray-300 dark:border-gray-600/50">
                <div className="text-gray-600 dark:text-gray-400 text-sm mb-1">总余额</div>
                <div className="text-2xl font-bold text-emerald-400">
                  {formatCurrency(waterLevel?.total_balance || 0)}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-700 rounded-xl p-4 border border-gray-300 dark:border-gray-600/50">
                <div className="text-gray-600 dark:text-gray-400 text-sm mb-1">30日应付</div>
                <div className="text-2xl font-bold text-amber-400">
                  {formatCurrency(waterLevel?.upcoming_payments_30d || 0)}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-700 rounded-xl p-4 border border-gray-300 dark:border-gray-600/50">
                <div className="text-gray-600 dark:text-gray-400 text-sm mb-1">7日应付</div>
                <div className="text-2xl font-bold text-orange-400">
                  {formatCurrency(waterLevel?.upcoming_payments_7d || 0)}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-700 rounded-xl p-4 border border-gray-300 dark:border-gray-600/50">
                <div className="text-gray-600 dark:text-gray-400 text-sm mb-1">待处理</div>
                <div className="text-lg font-bold text-rose-400">
                  {waterLevel?.expiring_coupons_3d || 0} 券 / {waterLevel?.expiring_points_7d || 0} 积分
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 即将到期的支付 */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-2xl">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <div className="w-1 h-6 bg-gradient-to-b from-orange-500 to-red-500 rounded-full"></div>
              即将到期的支付
            </h2>

            {upcomingPayments.length === 0 ? (
              <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                <div className="text-4xl mb-2">
                  <svg className="w-12 h-12 mx-auto text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>暂无即将到期的支付</div>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {upcomingPayments.map((payment, index) => {
                  const days = daysUntil(payment.expected_payment_date);
                  const urgency = getUrgencyLevel(payment.expected_payment_date);
                  
                  return (
                    <div 
                      key={index}
                      className={`p-4 rounded-xl border ${urgencyColors[urgency]} transition-all hover:scale-[1.02]`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-semibold">{payment.payment_method_name}</div>
                          <div className="text-sm opacity-75">
                            {payment.transaction_count} 笔交易
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold">
                            {formatCurrency(payment.total_amount)}
                          </div>
                          <div className="text-xs opacity-75">
                            {days > 0 ? `${days}天后` : days === 0 ? '今天' : '已逾期'}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs opacity-60">
                        还款日: {payment.expected_payment_date}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 待确认积分 */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <div className="w-1 h-6 bg-gradient-to-b from-amber-500 to-yellow-500 rounded-full"></div>
                待确认积分
              </h2>
              <div className="flex items-center gap-3">
                <Link
                  href="/points"
                  className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
                >
                  查看全部 →
                </Link>
                {pendingPoints.length > 0 && (
                  <button
                    onClick={handleConfirmAllPoints}
                    disabled={confirmingAll}
                    className="px-4 py-2 bg-gradient-to-r bg-green-500/20 hover:bg-green-500/30 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {confirmingAll ? '确认中...' : '一键确认全部'}
                  </button>
                )}
              </div>
            </div>

            {pendingPoints.length === 0 ? (
              <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                <div className="text-4xl mb-2">
                  <svg className="w-12 h-12 mx-auto text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>所有积分已确认</div>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {pendingPoints.map((point) => {
                  const days = point.points_expiry_date ? daysUntil(point.points_expiry_date) : null;
                  
                  return (
                    <div 
                      key={point.id}
                      className={`p-4 rounded-xl border ${urgencyColors[point.urgency_level]} transition-all hover:scale-[1.02]`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="font-semibold">{point.product_name}</div>
                          <div className="text-sm opacity-75">
                            {point.payment_method_name || '未知支付方式'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold">
                            {point.total_points.toLocaleString()} P
                          </div>
                          {days !== null && (
                            <div className="text-xs opacity-75">
                              {days > 0 ? `${days}天后过期` : '已过期'}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-xs opacity-60">
                        <span>购买日: {point.purchase_date}</span>
                        <button
                          onClick={() => handleConfirmPoint(point.id)}
                          disabled={confirmingPointId === point.id}
                          className="px-3 py-1 bg-green-500/20 hover:bg-green-500/30 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {confirmingPointId === point.id ? '确认中...' : '确认'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 银行账户余额 */}
        <div className="mt-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <div className="w-1 h-6 bg-gradient-to-b from-cyan-500 to-blue-500 rounded-full"></div>
                账户余额
              </h2>
              <Link 
                href="/accounts"
                className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                管理账户 →
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {bankAccounts.map((account) => (
                <div
                  key={account.id}
                  className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-5 border border-blue-200 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-600 transition-all"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="text-gray-900 dark:text-white text-sm font-medium">{account.name}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {account.account_type === 'checking' && '普通账户'}
                        {account.account_type === 'savings' && '储蓄账户'}
                        {account.account_type === 'wallet' && '电子钱包'}
                      </div>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(account.current_balance)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 快速操作 */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            href="/transactions/add"
            className="bg-blue-600 hover:bg-blue-700 rounded-xl p-6 text-center transition-all transform hover:scale-105 shadow-lg text-white"
          >
            <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <div className="font-semibold">记录交易</div>
          </Link>

          <Link
            href="/transactions"
            className="bg-blue-600 hover:bg-blue-700 rounded-xl p-6 text-center transition-all transform hover:scale-105 shadow-lg text-white"
          >
            <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <div className="font-semibold">交易列表</div>
          </Link>

          <Link
            href="/coupons"
            className="bg-blue-600 hover:bg-blue-700 rounded-xl p-6 text-center transition-all transform hover:scale-105 shadow-lg text-white"
          >
            <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
            <div className="font-semibold">优惠券</div>
          </Link>

          <Link
            href="/points"
            className="bg-blue-600 hover:bg-blue-700 rounded-xl p-6 text-center transition-all transform hover:scale-105 shadow-lg text-white"
          >
            <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="font-semibold">积分管理</div>
          </Link>

          <Link
            href="/analytics"
            className="bg-blue-600 hover:bg-blue-700 rounded-xl p-6 text-center transition-all transform hover:scale-105 shadow-lg text-white"
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