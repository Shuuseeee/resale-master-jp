// scripts/scan-design-tokens.mjs — 扫描 snutils 设计语言落实情况
// 用法: node scripts/scan-design-tokens.mjs（无输出标记 = 全部落实）
import fs from 'fs';
import path from 'path';

const files = [];
const walk = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (!['node_modules', '.next'].includes(e.name)) walk(p);
    } else if (/\.tsx$/.test(e.name)) files.push(p);
  });
['app', 'components'].forEach(walk);

const rows = files
  .map((f) => {
    const s = fs.readFileSync(f, 'utf8');
    const count = (re) => (s.match(re) || []).length;
    return {
      f,
      nu: count(/var\(--(color|radius|shadow)/g), // snutils token
      ap: count(/["'` ](?:bg|text|border|ring|from|to|divide)-apple-/g), // apple-* 类
      gr: count(/(?:bg|text|border|divide)-(?:gray|slate|zinc|neutral)-\d/g), // 裸调色板
      dk: count(/dark:/g), // dark: 变体
      hx: count(/(?:bg|text|border)-\[#[0-9a-fA-F]{3,8}\]/g), // 硬编码 hex
      th: /from .@\/lib\/theme./.test(s) ? 'T' : ' ',
    };
  })
  .filter((r) => r.nu + r.ap + r.gr + r.dk + r.hx > 0);

rows.sort((a, b) => a.f.localeCompare(b.f));
console.log('newTok apple gray dark: hex theme  file');
rows.forEach((r) => {
  const legacy = r.ap + r.gr + r.dk + r.hx;
  const flag =
    r.nu === 0 && legacy > 0 ? ' <<< 未落实'
    : legacy > r.nu ? ' <<  混杂偏旧'
    : legacy > 0 ? ' ~ 少量残留'
    : '';
  console.log(
    `${String(r.nu).padStart(6)} ${String(r.ap).padStart(5)} ${String(r.gr).padStart(4)} ${String(r.dk).padStart(5)} ${String(r.hx).padStart(3)}   ${r.th}    ${r.f}${flag}`
  );
});
