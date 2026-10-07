'use client';

import { createContext, useCallback, useContext } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import type { PurchasePlatform, SellingPlatform } from '@/types/database.types';
import { useAuth } from '@/contexts/AuthContext';

interface PlatformsContextType {
  purchasePlatforms: PurchasePlatform[];
  sellingPlatforms: SellingPlatform[];
  refreshPlatforms: () => Promise<void>;
}

const PlatformsContext = createContext<PlatformsContextType | undefined>(undefined);

const EMPTY_PURCHASE: PurchasePlatform[] = [];
const EMPTY_SELLING: SellingPlatform[] = [];

// 注意：这里不复用 lib/api/platforms.ts 的 getPurchasePlatforms / getSellingPlatforms。
// 它们出错时吞掉错误并返回 []，放进 useQuery 会把一次失败当成「成功的空列表」并持久化进离线缓存，
// 之后离线就再也看不到平台名。这里必须抛错，让 Query 保留上一次的好数据。
async function fetchPlatforms(): Promise<{ purchase: PurchasePlatform[]; selling: SellingPlatform[] }> {
  const [purchase, selling] = await Promise.all([
    supabase
      .from('purchase_platforms')
      .select('*')
      .eq('is_active', true)
      .order('is_builtin', { ascending: false })
      .order('name', { ascending: true }),
    supabase
      .from('selling_platforms')
      .select('*')
      .eq('is_active', true)
      .order('is_builtin', { ascending: false })
      .order('name', { ascending: true }),
  ]);
  if (purchase.error) throw purchase.error;
  if (selling.error) throw selling.error;
  return { purchase: purchase.data ?? [], selling: selling.data ?? [] };
}

export function PlatformsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // enabled 依赖登录用户；未登录 / 离线且 token 过期时查询被禁用，但从离线缓存恢复出来的数据仍会返回
  const { data } = useQuery({
    queryKey: ['platforms'],
    queryFn: fetchPlatforms,
    enabled: !!user,
  });

  const refreshPlatforms = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['platforms'] });
  }, [queryClient]);

  return (
    <PlatformsContext.Provider
      value={{
        purchasePlatforms: data?.purchase ?? EMPTY_PURCHASE,
        sellingPlatforms: data?.selling ?? EMPTY_SELLING,
        refreshPlatforms,
      }}
    >
      {children}
    </PlatformsContext.Provider>
  );
}

export function usePlatforms() {
  const context = useContext(PlatformsContext);
  if (!context) throw new Error('usePlatforms must be used within PlatformsProvider');
  return context;
}
