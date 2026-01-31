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

/**
 * 格式化数字为带逗号的字符串（用于显示）
 * @param value 数字值
 * @param decimals 小数位数，默认2位
 * @returns 格式化后的字符串，如 "1,234.56"
 */
export function formatNumberWithCommas(value: number, decimals: number = 2): string {
  if (isNaN(value)) return '0';

  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * 处理数字输入事件
 * 在 onChange 事件中使用，自动清理输入并更新状态
 * @param e 输入事件
 * @param setter 状态更新函数
 * @param field 字段名（可选，用于对象状态）
 */
export function handleNumberInputChange(
  e: React.ChangeEvent<HTMLInputElement>,
  setter: (value: any) => void,
  field?: string
): void {
  const cleaned = cleanNumberInput(e.target.value);
  const value = parseFloat(cleaned) || 0;

  if (field) {
    setter((prev: any) => ({ ...prev, [field]: value }));
  } else {
    setter(value);
  }
}

/**
 * 处理粘贴事件
 * 自动清理粘贴的内容
 * @param e 粘贴事件
 * @returns 清理后的数字
 */
export function handleNumberPaste(e: React.ClipboardEvent<HTMLInputElement>): number {
  e.preventDefault();
  const pastedText = e.clipboardData.getData('text');
  const cleaned = cleanNumberInput(pastedText);
  const value = parseFloat(cleaned) || 0;

  // 更新输入框的值
  const input = e.currentTarget;
  input.value = cleaned;

  // 触发 change 事件
  const event = new Event('input', { bubbles: true });
  input.dispatchEvent(event);

  return value;
}
