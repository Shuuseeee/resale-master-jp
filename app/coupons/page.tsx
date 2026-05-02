// app/coupons/page.tsx
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Coupon } from "@/types/database.types";
import { formatCurrency, daysUntil } from "@/lib/financial/calculator";
import { getTodayString } from "@/lib/utils/dateUtils";
import Link from "next/link";
import { layout, heading, card, button, tabs } from "@/lib/theme";
import PullToRefresh from "@/components/PullToRefresh";

type FilterType = "all" | "unused" | "used" | "expiring";

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("unused");

  useEffect(() => {
    loadCoupons();
  }, []);

  useEffect(() => {
    const handler = () => loadCoupons();
    window.addEventListener('bfcache-restore', handler);
    return () => window.removeEventListener('bfcache-restore', handler);
  }, []);

  const loadCoupons = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .order("expiry_date", { ascending: true });

      if (error) throw error;
      setCoupons(data || []);
    } catch (error) {
      console.error("优惠券读取失败:", error);
    } finally {
      setLoading(false);
    }
  };

  const markAsUsed = async (id: string) => {
    try {
      const { error } = await supabase
        .from("coupons")
        .update({
          is_used: true,
          used_date: getTodayString(),
        })
        .eq("id", id);

      if (error) throw error;
      await loadCoupons();
    } catch (error) {
      console.error("标记失败:", error);
      alert("标记为已使用失败");
    }
  };

  const deleteCoupon = async (id: string) => {
    if (!confirm("确定删除这张优惠券吗？")) return;

    try {
      const { error } = await supabase.from("coupons").delete().eq("id", id);

      if (error) throw error;
      await loadCoupons();
    } catch (error) {
      console.error("删除失败:", error);
      alert("删除失败");
    }
  };

  const getDiscountLabel = (coupon: Coupon) => {
    switch (coupon.discount_type) {
      case "percentage":
        const maxDiscountText = coupon.max_discount_amount > 0
          ? ` (上限 ${formatCurrency(coupon.max_discount_amount)})`
          : "";
        return `${coupon.discount_value}% OFF${maxDiscountText}`;
      case "fixed_amount":
        return `${formatCurrency(coupon.discount_value)} OFF`;
      case "point_multiply":
        return `积分 ${coupon.discount_value} 倍`;
      case "free_item":
        return "免费兑换";
      default:
        return "";
    }
  };

  const filteredCoupons = coupons.filter((coupon) => {
    const today = getTodayString();
    const daysLeft = daysUntil(coupon.expiry_date);

    switch (filter) {
      case "unused":
        return !coupon.is_used && coupon.expiry_date >= today;
      case "used":
        return coupon.is_used;
      case "expiring":
        return !coupon.is_used && daysLeft <= 7 && daysLeft >= 0;
      default:
        return true;
    }
  });

  const stats = {
    total: coupons.length,
    unused: coupons.filter(
      (c) =>
        !c.is_used && c.expiry_date >= getTodayString(),
    ).length,
    used: coupons.filter((c) => c.is_used).length,
    expiring: coupons.filter((c) => {
      const days = daysUntil(c.expiry_date);
      return !c.is_used && days <= 7 && days >= 0;
    }).length,
  };

  if (loading) {
    return (
      <div className={layout.page + " flex items-center justify-center"}>
        <div className="flex items-center gap-3 text-[var(--color-text)]">
          <svg
            className="animate-spin h-8 w-8 text-[var(--color-primary)]"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <span className="text-lg font-medium">加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={loadCoupons}>
    <div className={layout.page}>
      <div className={layout.container}>
        {/* 標題区域 */}
        <div className={layout.section}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className={heading.h1 + " mb-2"}>优惠券管理</h1>
              <p className="text-[var(--color-text-muted)]">
                管理优惠券、活动折扣与使用状态
              </p>
            </div>
            <Link
              href="/coupons/add"
              className={button.primary + " flex items-center gap-2"}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              添加优惠券
            </Link>
          </div>
        </div>

        {/* 統計カード */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className={card.stat}>
            <div className="text-[var(--color-text-muted)] text-sm mb-1">
              全部
            </div>
            <div className="text-2xl font-bold text-[var(--color-text)]">
              {stats.total}
            </div>
          </div>
          <div className={card.stat + " border-[var(--color-primary)]/30"}>
            <div className="text-[var(--color-success)] text-sm mb-1">
              未使用
            </div>
            <div className="text-2xl font-bold text-[var(--color-success)]">
              {stats.unused}
            </div>
          </div>
          <div className={card.stat + " border-[rgba(245,158,11,0.3)]"}>
            <div className="text-[var(--color-warning)] text-sm mb-1">
              即将过期
            </div>
            <div className="text-2xl font-bold text-[var(--color-warning)]">
              {stats.expiring}
            </div>
          </div>
          <div className={card.stat + " border-gray-500/30"}>
            <div className="text-[var(--color-text-muted)] text-sm mb-1">
              已使用
            </div>
            <div className="text-2xl font-bold text-[var(--color-text-muted)]">
              {stats.used}
            </div>
          </div>
        </div>

        {/* フィルター */}
        <div className={tabs.container + " mb-6"}>
          <div className="flex gap-2">
            <button
              onClick={() => setFilter("all")}
              className={`${tabs.tab.base} ${
                filter === "all" ? tabs.tab.active : tabs.tab.inactive
              }`}
            >
              全部
            </button>
            <button
              onClick={() => setFilter("unused")}
              className={`${tabs.tab.base} ${
                filter === "unused" ? tabs.tab.active : tabs.tab.inactive
              }`}
            >
              未使用
            </button>
            <button
              onClick={() => setFilter("expiring")}
              className={`${tabs.tab.base} ${
                filter === "expiring" ? tabs.tab.active : tabs.tab.inactive
              }`}
            >
              即将过期
            </button>
            <button
              onClick={() => setFilter("used")}
              className={`${tabs.tab.base} ${
                filter === "used" ? tabs.tab.active : tabs.tab.inactive
              }`}
            >
              已使用
            </button>
          </div>
        </div>

        {/* 优惠券列表 */}
        <div className={card.primary + " overflow-hidden"}>
          {filteredCoupons.length === 0 ? (
            <div className="p-12 text-center">
              <svg
                className="w-16 h-16 text-[var(--color-text-muted)] mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
                />
              </svg>
              <p className="text-[var(--color-text-muted)] text-lg">
                暂无优惠券
              </p>
              <Link
                href="/coupons/add"
                className={button.primary + " inline-block mt-4"}
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
                    className={`rounded-[var(--radius-lg)] p-5 border transition-all ${
                      coupon.is_used
                        ? "bg-[var(--color-bg-subtle)] border-[var(--color-border)] opacity-60"
                        : isExpired
                          ? "bg-[rgba(239,68,68,0.08)] border-[rgba(239,68,68,0.3)]"
                          : isExpiringSoon
                            ? "bg-[rgba(245,158,11,0.08)] border-[rgba(245,158,11,0.3)]"
                            : "bg-[var(--color-primary-light)] border-[var(--color-primary)]/30"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-[var(--color-text)] mb-1">
                          {coupon.name}
                        </h3>
                        <div className="text-sm text-[var(--color-text-muted)]">
                          {coupon.platform || "通用"}
                        </div>
                      </div>
                      {coupon.is_used && (
                        <span className="px-2 py-1 bg-[var(--color-text-muted)] text-white text-xs rounded-full">
                          已使用
                        </span>
                      )}
                    </div>

                    {coupon.coupon_code && (
                      <div className="mb-3">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(coupon.coupon_code!);
                            alert("优惠券代码已复制");
                          }}
                          className="px-3 py-1 bg-[var(--color-primary-light)] text-[var(--color-primary)] text-sm font-mono rounded-[var(--radius-md)] active:opacity-80 transition-opacity"
                        >
                          {coupon.coupon_code}
                        </button>
                      </div>
                    )}

                    <div className="mb-3">
                      <div className="text-2xl font-bold text-[var(--color-primary)] mb-1">
                        {getDiscountLabel(coupon)}
                      </div>
                      {coupon.min_purchase_amount > 0 && (
                        <div className="text-xs text-[var(--color-text-muted)]">
                          满 {formatCurrency(coupon.min_purchase_amount)} 可用
                        </div>
                      )}
                    </div>
                    <div className="mb-4 text-sm">
                      <div className="text-[var(--color-text-muted)]">
                        {coupon.start_date && `${coupon.start_date} ~ `}
                        {coupon.expiry_date}
                      </div>
                      <div
                        className={`font-medium ${
                          isExpired
                            ? "text-[var(--color-danger)]"
                            : isExpiringSoon
                              ? "text-[var(--color-warning)]"
                              : "text-[var(--color-success)]"
                        }`}
                      >
                        {isExpired
                          ? "已过期"
                          : daysLeft === 0
                            ? "今日到期"
                            : `剩余 ${daysLeft} 天`}
                      </div>
                    </div>

                    {coupon.notes && (
                      <div className="mb-4 text-sm text-[var(--color-text-muted)] border-t border-[var(--color-border)] pt-3">
                        {coupon.notes}
                      </div>
                    )}

                    <div className="flex gap-2">
                      {!coupon.is_used && !isExpired && (
                        <button
                          onClick={() => markAsUsed(coupon.id)}
                          className="flex-1 px-3 py-2 bg-[var(--color-primary)] active:opacity-70 text-white text-sm font-semibold rounded-[var(--radius-md)] transition-colors"
                        >
                          标记已使用
                        </button>
                      )}
                      <Link
                        href={`/coupons/${coupon.id}/edit`}
                        className="px-3 py-2 bg-[var(--color-bg-subtle)] text-[var(--color-text)] text-sm font-semibold rounded-[var(--radius-md)] active:opacity-80 transition-opacity"
                      >
                        编辑
                      </Link>
                      <button
                        onClick={() => deleteCoupon(coupon.id)}
                        className="px-3 py-2 bg-[var(--color-danger)] text-white text-sm font-semibold rounded-[var(--radius-md)] active:opacity-80 transition-opacity"
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
    </PullToRefresh>
  );
}
