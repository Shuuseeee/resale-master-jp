'use client';

import { useState, useEffect } from 'react';
import {
  getPointsByStatus,
  getPointsStats,
  confirmPointsReceived,
  batchConfirmPoints,
  type PointRecord,
  type PointsStats
} from '@/lib/api/financial';
import { layout, heading, card, button, badge, alert, loading as loadingStyles, empty, tabs } from '@/lib/theme';

export default function PointsPage() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'received' | 'expired' | 'all'>('pending');
  const [points, setPoints] = useState<PointRecord[]>([]);
  const [stats, setStats] = useState<PointsStats | null>(null);
  const [confirmingPointId, setConfirmingPointId] = useState<string | null>(null);
  const [confirmingAll, setConfirmingAll] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 加载数据
  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, pointsData] = await Promise.all([
        getPointsStats(),
        getPointsByStatus(activeTab === 'all' ? undefined : activeTab)
      ]);
      setStats(statsData);
      setPoints(pointsData);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // 确认单个积分
  const handleConfirmPoint = async (pointId: string) => {
    setConfirmingPointId(pointId);
    try {
      const success = await confirmPointsReceived(pointId);
      if (success) {
        setSuccessMessage('积分已确认');
        setTimeout(() => setSuccessMessage(null), 3000);
        await loadData();
      }
    } catch (error) {
      console.error('确认积分失败:', error);
    } finally {
      setConfirmingPointId(null);
    }
  };

  // 批量确认所有待确认积分
  const handleConfirmAll = async () => {
    const pendingPointIds = points
      .filter(p => p.point_status === 'pending')
      .map(p => p.id);

    if (pendingPointIds.length === 0) return;

    setConfirmingAll(true);
    try {
      const confirmedCount = await batchConfirmPoints(pendingPointIds);
      if (confirmedCount > 0) {
        setSuccessMessage(`已确认 ${confirmedCount} 条积分记录`);
        setTimeout(() => setSuccessMessage(null), 3000);
        await loadData();
      }
    } catch (error) {
      console.error('批量确认失败:', error);
    } finally {
      setConfirmingAll(false);
    }
  };

  // 格式化日期
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  // 获取状态徽章样式
  const getStatusBadge = (status: string) => {
    const badgeMap = {
      pending: badge.pending,
      received: badge.success,
      expired: badge.error
    };
    const labels = {
      pending: '待确认',
      received: '已收到',
      expired: '已过期'
    };
    return (
      <span className={badgeMap[status as keyof typeof badgeMap]}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  return (
    <div className={layout.page}>
      <div className={layout.container}>
        {/* 页面标题 */}
        <div className={layout.section}>
          <h1 className={heading.h1}>积分管理</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">查看和管理您的所有积分记录</p>
        </div>

        {/* 成功提示 */}
        {successMessage && (
          <div className={alert.success}>
            {successMessage}
          </div>
        )}

        {/* 统计卡片 */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className={card.stat}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 dark:text-gray-400 text-sm">待确认积分</span>
                <span className="text-amber-600 dark:text-amber-400">⏳</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {stats.total_pending_points.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-500">
                {stats.total_pending_count} 条记录
              </div>
            </div>

            <div className={card.stat}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 dark:text-gray-400 text-sm">已收到积分</span>
                <span className="text-emerald-600 dark:text-emerald-400">✓</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {stats.total_received_points.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-500">
                {stats.total_received_count} 条记录
              </div>
            </div>

            <div className={card.stat}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 dark:text-gray-400 text-sm">已过期积分</span>
                <span className="text-red-600 dark:text-red-400">✕</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {stats.total_expired_count}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-500">
                条记录
              </div>
            </div>

            <div className={card.stat}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 dark:text-gray-400 text-sm">积分总价值</span>
                <span className="text-blue-600 dark:text-blue-400">¥</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                ¥{stats.total_value.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-500">
                已收到积分价值
              </div>
            </div>
          </div>
        )}

        {/* Tab导航 */}
        <div className={tabs.container + ' mb-6'}>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('pending')}
              className={`${tabs.tab.base} ${
                activeTab === 'pending'
                  ? 'bg-amber-600 text-white'
                  : tabs.tab.inactive
              }`}
            >
              待确认
            </button>
            <button
              onClick={() => setActiveTab('received')}
              className={`${tabs.tab.base} ${
                activeTab === 'received'
                  ? 'bg-emerald-600 text-white'
                  : tabs.tab.inactive
              }`}
            >
              已收到
            </button>
            <button
              onClick={() => setActiveTab('expired')}
              className={`${tabs.tab.base} ${
                activeTab === 'expired'
                  ? 'bg-red-600 text-white'
                  : tabs.tab.inactive
              }`}
            >
              已过期
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`${tabs.tab.base} ${
                activeTab === 'all'
                  ? tabs.tab.active
                  : tabs.tab.inactive
              }`}
            >
              全部
            </button>
          </div>
        </div>

        {/* 批量操作按钮 */}
        {activeTab === 'pending' && points.length > 0 && (
          <div className="mb-6 flex justify-end">
            <button
              onClick={handleConfirmAll}
              disabled={confirmingAll}
              className={button.success}
            >
              {confirmingAll ? '确认中...' : '一键确认全部'}
            </button>
          </div>
        )}

        {/* 积分列表 */}
        {loading ? (
          <div className={loadingStyles.container}>
            <div className={loadingStyles.spinner}></div>
            <p className={loadingStyles.text}>加载中...</p>
          </div>
        ) : points.length === 0 ? (
          <div className={empty.container}>
            <p className={empty.text}>暂无积分记录</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {points.map((point) => (
              <div
                key={point.id}
                className={card.primary + ' p-6'}
              >
                {/* 商品名称 */}
                <h3 className="text-gray-900 dark:text-white font-semibold mb-3 line-clamp-2">
                  {point.product_name}
                </h3>

                {/* 详细信息 */}
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">购买日期</span>
                    <span className="text-gray-900 dark:text-gray-300">{formatDate(point.purchase_date)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">支付方式</span>
                    <span className="text-gray-900 dark:text-gray-300">{point.payment_method_name || '-'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">平台积分</span>
                    <div className="text-right">
                      <div className="text-blue-600 dark:text-blue-400 font-medium">
                        {point.expected_platform_points?.toLocaleString() || 0} P
                      </div>
                      {point.platform_points_platform_name && (
                        <div className="text-xs text-gray-500 dark:text-gray-500">
                          {point.platform_points_platform_name}
                        </div>
                      )}
                    </div>
                  </div>
                  {point.extra_platform_points > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">额外积分</span>
                      <div className="text-right">
                        <div className="text-cyan-600 dark:text-cyan-400 font-medium">
                          {point.extra_platform_points?.toLocaleString() || 0} P
                        </div>
                        {point.extra_platform_points_platform_name && (
                          <div className="text-xs text-gray-500 dark:text-gray-500">
                            {point.extra_platform_points_platform_name}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">信用卡积分</span>
                    <div className="text-right">
                      <div className="text-purple-600 dark:text-purple-400 font-medium">
                        {point.expected_card_points?.toLocaleString() || 0} P
                      </div>
                      {point.card_points_platform_name && (
                        <div className="text-xs text-gray-500 dark:text-gray-500">
                          {point.card_points_platform_name}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-gray-200 dark:border-gray-700">
                    <span className="text-gray-600 dark:text-gray-400 font-medium">积分价值</span>
                    <span className="text-gray-900 dark:text-white font-bold">
                      ¥{point.total_points.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* 状态和操作 */}
                <div className="flex items-center justify-between">
                  {getStatusBadge(point.point_status)}
                  {point.point_status === 'pending' && (
                    <button
                      onClick={() => handleConfirmPoint(point.id)}
                      disabled={confirmingPointId === point.id}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white text-sm rounded-lg font-medium transition-colors"
                    >
                      {confirmingPointId === point.id ? '确认中...' : '确认'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
