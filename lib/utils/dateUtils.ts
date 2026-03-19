// lib/utils/dateUtils.ts
// 日期处理工具函数 - 修复时区问题

/**
 * 将 Date 对象格式化为 YYYY-MM-DD 字符串（本地时区）
 * 避免使用 toISOString() 导致的 UTC 时区偏移问题
 */
export function formatDateToLocal(date: Date | null | undefined): string {
  if (!date) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * 将 YYYY-MM-DD 字符串解析为 Date 对象（本地时区）
 * 避免使用 new Date(string) 导致的 UTC 时区偏移问题
 */
export function parseDateFromLocal(dateString: string | null | undefined): Date | null {
  if (!dateString) return null;

  const [year, month, day] = dateString.split('-').map(Number);

  if (!year || !month || !day) return null;

  const date = new Date(year, month - 1, day);

  return isNaN(date.getTime()) ? null : date;
}

/**
 * 获取今天的日期字符串 YYYY-MM-DD（本地时区）
 */
export function getTodayString(): string {
  return formatDateToLocal(new Date());
}

/**
 * 计算两个日期之间的天数差
 */
export function daysBetween(date1: Date | string, date2: Date | string): number {
  const d1 = typeof date1 === 'string' ? parseDateFromLocal(date1) : date1;
  const d2 = typeof date2 === 'string' ? parseDateFromLocal(date2) : date2;

  if (!d1 || !d2) return 0;

  const diffTime = d2.getTime() - d1.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * 计算距离指定日期还有多少天
 */
export function daysUntil(dateString: string): number {
  const targetDate = parseDateFromLocal(dateString);
  if (!targetDate) return -999;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = targetDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
