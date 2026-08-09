// lib/utils/janInput.ts
// JAN 批量输入解析 —— 支持 Excel 列 / CSV / 手打逗号列表粘贴

export interface ParsedJanInput {
  codes: string[];       // 合法 JAN，保序去重
  scientific: string[];  // 科学计数法 token（Excel 常规格式导致，原值不可还原）
  ignored: string[];     // 其他非数字 token（多列粘贴带进来的商品名等）
}

/** 全角数字转半角（日文输入法常见），与 lib/number-utils.ts 保持同一实现 */
const toHalfWidthDigits = (s: string): string =>
  s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));

/** Excel 常规格式复制出来的科学计数法，如 4.55E+12 */
const SCIENTIFIC = /^\d(?:\.\d+)?[eE]\+?\d+$/;

/**
 * 解析批量 JAN 输入
 *
 * 分隔符按优先级判定：输入含换行/Tab 时只按换行/Tab 切分，
 * 此时单元格内的逗号一律视为千位分隔符（4,549,995,623,086）；
 * 无换行/Tab 时才按逗号/顿号/分号/空格切分（手打 a,b,c 的场景）。
 */
export function parseJanInput(raw: string): ParsedJanInput {
  const empty: ParsedJanInput = { codes: [], scientific: [], ignored: [] };
  if (!raw) return empty;

  const text = toHalfWidthDigits(raw);
  const hasRowSep = /[\n\r\t]/.test(text);
  const tokens = hasRowSep ? text.split(/[\n\r\t]+/) : text.split(/[,，、;；\s]+/);

  const codes: string[] = [];
  const scientific: string[] = [];
  const ignored: string[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    // Excel 对含逗号的单元格会加双引号；前导 ' 是文本格式标记
    const trimmed = token.replace(/^["'\s]+|["'\s]+$/g, '');
    if (!trimmed) continue;

    // 必须先于数字清洗判定，否则会被当成非数字丢进 ignored
    if (SCIENTIFIC.test(trimmed)) {
      scientific.push(trimmed);
      continue;
    }

    // 去千位逗号、单元格内空格、连字符
    const cleaned = trimmed.replace(/[,\s-]/g, '');
    if (!/^\d{6,14}$/.test(cleaned)) {
      ignored.push(trimmed);
      continue;
    }

    if (!seen.has(cleaned)) {
      seen.add(cleaned);
      codes.push(cleaned);
    }
  }

  return { codes, scientific, ignored };
}

/** 保序去重合并两组 JAN */
export function mergeJanCodes(existing: string[], added: string[]): string[] {
  const seen = new Set(existing);
  const merged = [...existing];
  for (const code of added) {
    if (seen.has(code)) continue;
    seen.add(code);
    merged.push(code);
  }
  return merged;
}
