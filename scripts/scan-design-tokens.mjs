// scripts/scan-design-tokens.mjs — 扫描 snutils 设计语言落实情况
// 用法: node scripts/scan-design-tokens.mjs（无标记输出 = 全部落实；有残留时退出码为 1）
import fs from 'fs';
import path from 'path';

const files = [];
const walk = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (!['node_modules', '.next', 'sw'].includes(e.name)) walk(p);
    } else if (
      (/\.(tsx|ts)$/.test(e.name) && !/\.d\.ts$/.test(e.name)) ||
      // CSS 也纳入扫描；globals.css / themes.css 是 token 定义源，允许 hex/rgba
      (/\.css$/.test(e.name) && !['globals.css', 'themes.css'].includes(e.name))
    ) files.push(p);
  });
['app', 'components', 'lib', 'assets'].forEach(walk);

// 所有 Tailwind 调色板色名（palette 类一律禁止，色值应走 var(--color-*) token）
const HUES =
  '(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|gray|slate|zinc|neutral|stone)';

const rows = files
  .map((f) => {
    const s = fs.readFileSync(f, 'utf8');
    const count = (re) => (s.match(re) || []).length;
    // CSS 文件：直接检测裸 hex / rgb(a)，颜色应一律引用 var(--color-*)
    if (f.endsWith('.css')) {
      return {
        f,
        nu: count(/var\(--(color|radius|shadow)/g),
        ap: 0, gr: 0, dk: 0,
        hx: count(/#[0-9a-fA-F]{3,8}\b/g),
        rg: count(/rgba?\(/g),
        am: 0,
        th: ' ',
      };
    }
    return {
      f,
      nu: count(/var\(--(color|radius|shadow)/g), // snutils token
      ap: count(/["'` ](?:bg|text|border|ring|from|to|divide)-apple-/g), // apple-* 类
      gr: count(new RegExp(`(?:bg|text|border|divide|ring|from|to|via)-${HUES}-\\d`, 'g')), // 裸调色板
      dk: count(/dark:/g), // dark: 变体
      hx: count(/-\[[^\]]*#[0-9a-fA-F]{3,8}/g), // 硬编码 hex（含 shadow/gradient 内嵌）
      rg: count(/-\[[^\]]*rgba?\(/g), // 硬编码 rgb(a)（含 shadow 内嵌）
      am: count(/var\(--[a-z-]+\)\]\/\d+/g), // var + 透明度修饰符（应改用派生 token）
      th: /from .@\/lib\/theme./.test(s) ? 'T' : ' ',
    };
  })
  .filter((r) => r.nu + r.ap + r.gr + r.dk + r.hx + r.rg + r.am > 0);

rows.sort((a, b) => a.f.localeCompare(b.f));
console.log('newTok apple gray dark: hex rgba a/mod theme  file');
let dirty = 0;
rows.forEach((r) => {
  const legacy = r.ap + r.gr + r.dk + r.hx + r.rg + r.am;
  const flag =
    r.nu === 0 && legacy > 0 ? ' <<< 未落实'
    : legacy > r.nu ? ' <<  混杂偏旧'
    : legacy > 0 ? ' ~ 残留'
    : '';
  if (flag) dirty++;
  console.log(
    `${String(r.nu).padStart(6)} ${String(r.ap).padStart(5)} ${String(r.gr).padStart(4)} ${String(r.dk).padStart(5)} ${String(r.hx).padStart(3)} ${String(r.rg).padStart(4)} ${String(r.am).padStart(5)}   ${r.th}    ${r.f}${flag}`
  );
});
if (dirty > 0) {
  console.log(`\n${dirty} 个文件存在残留`);
  process.exitCode = 1;
}
