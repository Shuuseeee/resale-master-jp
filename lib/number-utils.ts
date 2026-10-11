/**
 * 数字输入工具函数
 * 用于处理用户输入的数字，支持逗号分隔、全角数字等
 */

/**
 * 清理数字输入字符串
 * 移除逗号、空格等非数字字符，保留小数点和负号
 * @param value 输入的字符串
 * @returns 清理后的数字字符串
 */
export function cleanNumberInput(value: string): string {
  if (!value) return '';

  // 移除所有逗号、空格、全角字符
  return value
    .replace(/,/g, '') // 移除逗号
    .replace(/\s/g, '') // 移除空格
    .replace(/，/g, '') // 移除全角逗号
    .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)) // 全角数字转半角
    .trim();
}

/**
 * 解析数字输入
 * @param value 输入的字符串
 * @param defaultValue 解析失败时返回的默认值
 * @returns 解析后的数字
 */
export function parseNumberInput(value: string, defaultValue: number = 0): number {
  const cleaned = cleanNumberInput(value);
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? defaultValue : parsed;
}
