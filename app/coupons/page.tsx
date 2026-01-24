// app/coupons/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Coupon } from '@/types/database.types';
import { formatCurrency, daysUntil } from '@/lib/financial/calculator';
import Link from 'next/link';

type FilterType = 'all' | 'unused' | 'used' | 'expiring';

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('unused');

  useEffect(() => {
    loadCoupons();
  }, []);

  const loadCoupons = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .order('expiry_date', { ascending: true });

      if (error) throw error;
      setCoupons(data || []);
    } catch (error) {
      console.error('加载优惠券失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsUsed = async (id: string) => {
    try {
      const { error } = await supabase
        .from('coupons')
        .update({
          is_used: true,
          used_date: new Date().toISOString().split('T')[0]
        })
        .eq('id', id);

      if (error) throw error;
      await loadCoupons();
    } catch (error) {
      console.error('标记失败:', error);
      alert('标记失败，请重试');
    }
  };

  const deleteCoupon = async (id: string) => {
    if (!confirm('确定要删除这张优惠券吗？')) return;

    try {
      const { error } = await supabase
        .from('coupons')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadCoupons();
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败，请重试');
    }
  };

  const getDiscountLabel = (coupon: Coupon) => {
    switch (coupon.discount_type) {
      case 'percentage':
        return `${coupon.discount_value}% 折扣`;
      case 'fixed_amount':
        return `${formatCurrency(coupon.discount_value)} 优惠`;
      case 'free_shipping':
        return '免运费';
      default:
        return '';
    }
  };

  const filteredCoupons = coupons.filter(coupon => {
    const today = new Date().toISOString().split('T')[0];
    const daysLeft = daysUntil(coupon.expiry_date);

    switch (filter) {
      case 'unused':
        return !coupon.is_used && coupon.expiry_date >= today;
      case 'used':
        return coupon.is_used;
      case 'expiring':
        return !coupon.is_used && daysLeft <= 7 && daysLeft >= 0;
      default:
        return true;
    }
  });

  const stats = {
    total: coupons.length,
    unused: coupons.filter(c => !c.is_used && c.expiry_date >= new Date().toISOString().split('T')[0]).length,
    used: coupons.filter(c => c.is_used).length,
    expiring: coupons.filter(c => {
      const days = daysUntil(c.expiry_date);
      return !c.is_used && days <= 7 && days >= 0;
    }).length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="relative max-w-7xl mx-auto px-4 py-8">
        {/* 标题区域 */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">优惠券管理</h1>
              <p className="text-gray-600 dark:text-gray-400">管理您的优惠券和折扣码</p>
            </div>
            <Link
              href="/coupons/add"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all transform hover:scale-105 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              添加优惠券
            </Link>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-gray-600 dark:text-gray-400 text-sm mb-1">全部</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-green-500/30">
            <div className="text-green-500 text-sm mb-1">未使用</div>
            <div className="text-2xl font-bold text-green-500">{stats.unused}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-orange-500/30">
            <div className="text-orange-500 text-sm mb-1">即将过期</div>
            <div className="text-2xl font-bold text-orange-500">{stats.expiring}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-500/30">
            <div className="text-gray-500 text-sm mb-1">已使用</div>
            <div className="text-2xl font-bold text-gray-500">{stats.used}</div>
          </div>
        </div>

        {/* 筛选器 */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-2xl mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              全部
            </button>
            <button
              onClick={() => setFilter('unused')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filter === 'unused'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              未使用
            </button>
            <button
              onClick={() => setFilter('expiring')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filter === 'expiring'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              即将过期
            </button>
            <button
              onClick={() => setFilter('used')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filter === 'used'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              已使用
            </button>
          </div>
        </div>

        {/* 优惠券列表 */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden">
          {filteredCoupons.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
              <p className="text-gray-600 dark:text-gray-400 text-lg">暂无优惠券</p>
              <Link
                href="/coupons/add"
                className="inline-block mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                添加第一张优惠券
              </Link>
            </div>
          ) : (
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCoupons.map((coupon) => {
                const daysLeft = daysUntil(coupon.expiry_date);
                const isExpired = daysLeft < 0;
                const isExpiringSoon = daysLeft <= 7 && daysLeft >= 0;

                return (
                  <div
                    key={coupon.id}
                    className={`rounded-xl p-5 border-2 transition-all ${
                      coupon.is_used
                        ? 'bg-gray-50 dark:bg-gray-700/50 border-gray-300 dark:border-gray-600 opacity-60'
                        : isExpired
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800'
                        : isExpiringSoon
                        ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-800'
                        : 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-800'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                          {coupon.name}
                        </h3>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {coupon.platform || '通用'}
                        </div>
                      </div>
                      {coupon.is_used && (
                        <span className="px-2 py-1 bg-gray-500 text-white text-xs rounded-full">
                          已使用
                        </span>
                      )}
                    </div>

                    <div className="mb-3">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                        {getDiscountLabel(coupon)}
                      </div>
                      {coupon.min_purchase_amount > 0 && (
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          满 {formatCurrency(coupon.min_purchase_amount)} 可用
                        </div>
                      )}
                    </div>

                    <div className="mb-4 text-sm">
                      <div className="text-gray-600 dark:text-gray-400">
                        过期日期: {coupon.expiry_date}
                      </div>
                      <div className={`font-medium ${
                        isExpired
                          ? 'text-red-600 dark:text-red-400'
                          : isExpiringSoon
                          ? 'text-orange-600 dark:text-orange-400'
                          : 'text-green-600 dark:text-green-400'
                      }`}>
                        {isExpired
                          ? '已过期'
                          : daysLeft === 0
                          ? '今天过期'
                          : `还有 ${daysLeft} 天`}
                      </div>
                    </div>

                    {coupon.notes && (
                      <div className="mb-4 text-sm text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-600 pt-3">
                        {coupon.notes}
                      </div>
                    )}

                    <div className="flex gap-2">
                      {!coupon.is_used && !isExpired && (
                        <button
                          onClick={() => markAsUsed(coupon.id)}
                          className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          标记已使用
                        </button>
                      )}
                      <Link
                        href={`/coupons/${coupon.id}/edit`}
                        className="px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors"
                      >
                        编辑
                      </Link>
                      <button
                        onClick={() => deleteCoupon(coupon.id)}
                        className="px-3 py-2 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 text-sm font-medium rounded-lg transition-colors"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
