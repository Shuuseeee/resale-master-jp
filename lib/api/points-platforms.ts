// lib/api/points-platforms.ts
// 积分平台管理 API

import { supabase } from '@/lib/supabase/client';
import type { PointsPlatform } from '@/types/database.types';

/**
 * 根据ID获取积分平台
 */
export async function getPointsPlatformById(id: string): Promise<PointsPlatform | null> {
  const { data, error } = await supabase
    .from('points_platforms')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('获取积分平台失败:', error);
    return null;
  }

  return data;
}

/**
 * 计算积分的日元价值
 * @param points 积分数量
 * @param platformId 积分平台ID
 */
export async function calculatePointsValue(
  points: number,
  platformId: string | null
): Promise<number> {
  if (!platformId || points === 0) {
    return 0;
  }

  // All points are 1:1 (1 point = 1 yen)
  return points;
}

/**
 * 计算交易的总积分价值
 * @param platformPoints 平台积分数量
 * @param platformPointsPlatformId 平台积分平台ID
 * @param cardPoints 信用卡积分数量
 * @param cardPointsPlatformId 信用卡积分平台ID
 */
export async function calculateTotalPointsValue(
  platformPoints: number,
  platformPointsPlatformId: string | null,
  cardPoints: number,
  cardPointsPlatformId: string | null
): Promise<{
  platformPointsValue: number;
  cardPointsValue: number;
  totalValue: number;
}> {
  // All points are 1:1 (1 point = 1 yen)
  const platformValue = platformPointsPlatformId ? platformPoints : 0;
  const cardValue = cardPointsPlatformId ? cardPoints : 0;

  return {
    platformPointsValue: platformValue,
    cardPointsValue: cardValue,
    totalValue: platformValue + cardValue
  };
}
