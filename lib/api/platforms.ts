// lib/api/platforms.ts
// 购入平台 / 出手平台 API

import { supabase } from '@/lib/supabase/client';
import type { PurchasePlatform, SellingPlatform } from '@/types/database.types';

/**
 * 获取购入平台列表（内置 + 用户自定义，仅 active）
 */
export async function getPurchasePlatforms(): Promise<PurchasePlatform[]> {
  const { data, error } = await supabase
    .from('purchase_platforms')
    .select('*')
    .eq('is_active', true)
    .order('is_builtin', { ascending: false })
    .order('name', { ascending: true });

  if (error) {
    console.error('获取购入平台失败:', error);
    return [];
  }

  return data || [];
}

/**
 * 创建用户自定义购入平台
 */
export async function createPurchasePlatform(name: string): Promise<PurchasePlatform | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('purchase_platforms')
    .insert({ user_id: user.id, name, is_builtin: false })
    .select()
    .single();

  if (error) {
    console.error('创建购入平台失败:', error);
    return null;
  }

  return data;
}

/**
 * 获取出手平台列表（内置 + 用户自定义，仅 active）
 */
export async function getSellingPlatforms(): Promise<SellingPlatform[]> {
  const { data, error } = await supabase
    .from('selling_platforms')
    .select('*')
    .eq('is_active', true)
    .order('is_builtin', { ascending: false })
    .order('name', { ascending: true });

  if (error) {
    console.error('获取出手平台失败:', error);
    return [];
  }

  return data || [];
}

/**
 * 创建用户自定义出手平台
 */
export async function createSellingPlatform(name: string): Promise<SellingPlatform | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('selling_platforms')
    .insert({ user_id: user.id, name, is_builtin: false })
    .select()
    .single();

  if (error) {
    console.error('创建出手平台失败:', error);
    return null;
  }

  return data;
}
