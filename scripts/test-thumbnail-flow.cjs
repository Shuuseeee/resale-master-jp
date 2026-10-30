// 无测试框架：用隔离的 Supabase / fetch 替身验证导入与后台取图衔接，不访问线上。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks, globals = {}) {
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, {
    exports, require: name => {
      assert.ok(name in mocks, `未模拟的依赖：${name}`);
      return mocks[name];
    },
    console, process: { env: { CRON_SECRET: 'test-secret' } }, ...globals,
  }, { filename: file });
  return exports;
}

test('导入 501 个不同 JAN：全部分批入队，重复 JAN 去重，重复导入也补图', async () => {
  const requests = [];
  const purchases = Array.from({ length: 501 }, (_, i) => ({
    jan: String(4900000000000 + i), source: '', unitPrice: 1, quantity: 1,
    shippingFee: 0, pointsUsed: 0, arrivals: [], sales: [], returns: [],
  }));
  purchases.push(purchases[0]);
  const { commitOrderImport } = load('lib/api/order-import.ts', {
    '@/lib/supabase/client': { supabase: { rpc: async () => ({ data: { purchases: 0, skipped: 502 }, error: null }) } },
    '@/lib/expenses/categories': {},
    '@/lib/order-data/parse': {},
  }, {
    fetch: async (_url, options) => {
      const jans = JSON.parse(options.body).jans;
      assert.ok(jans.length <= 500, '单次请求不能超过服务端 500 个 JAN 的上限');
      requests.push(jans);
      return { ok: true };
    },
  });
  const result = await commitOrderImport({ parsed: { purchases, expenses: [] }, paymentMethods: [], pointsPlatforms: [] });
  assert.equal(result.skipped, 502);
  assert.equal(requests.length, 2);
  assert.equal(requests.flat().length, 501);
});

test('每日任务先补入历史漏图 JAN，再处理队列；补入失败不能假报成功', async () => {
  for (const failBackfill of [false, true]) {
    const calls = [];
    const { GET } = load('app/api/thumbnail/process/route.ts', {
      'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
      '@/lib/server/jan-thumbnails': {
        enqueueMissingThumbnails: async () => { calls.push('backfill'); if (failBackfill) throw Error('backfill failed'); return 3; },
        processThumbnailQueue: async () => { calls.push('process'); return { succeeded: 3 }; },
        cleanupThumbnailQueue: async () => { calls.push('cleanup'); return 0; },
      },
    });
    const response = await GET({ headers: { get: () => 'Bearer test-secret' } });
    assert.equal(response.status, failBackfill ? 500 : 200);
    assert.deepEqual(calls, failBackfill ? ['backfill'] : ['backfill', 'process', 'cleanup']);
  }
});

test('交易写入失败不入图片队列；图片接口失败不把已成功的导入报成失败', async () => {
  for (const failImport of [false, true]) {
    let calls = 0;
    const { commitOrderImport, OrderImportError } = load('lib/api/order-import.ts', {
      '@/lib/supabase/client': { supabase: { rpc: async () => ({ data: { purchases: 1 }, error: failImport ? { message: 'rollback' } : null }) } },
      '@/lib/expenses/categories': {},
      '@/lib/order-data/parse': {},
    }, {
      console: { error: () => {} },
      fetch: async () => { calls++; return { ok: false, status: 503 }; },
    });
    const prepared = {
      parsed: { purchases: [{ jan: '4900000000000', source: '', arrivals: [], sales: [], returns: [] }], expenses: [] },
      paymentMethods: [], pointsPlatforms: [],
    };
    if (failImport) await assert.rejects(commitOrderImport(prepared), OrderImportError);
    else assert.equal((await commitOrderImport(prepared)).purchases, 1);
    assert.equal(calls, failImport ? 0 : 1);
  }
});

test('图片缓存晚于交易加载：继续刷新直到出图，且无图时有重试上限', () => {
  let options;
  let now = 0;
  const { useJanThumbnails } = load('hooks/useJanThumbnails.ts', {
    '@tanstack/react-query': { useQuery: value => { options = value; return {}; } },
    react: { useMemo: fn => fn() },
    '@/lib/api/jan-thumbnails': { fetchJanThumbnails: async () => new Map() },
  }, { Date: { now: () => now } });
  useJanThumbnails(['4900000000000']);
  assert.equal(options.refetchInterval({ state: { data: new Map(), dataUpdateCount: 1, errorUpdateCount: 0 } }), 5000);
  assert.equal(options.refetchInterval({ state: { data: new Map([['4900000000000', {}]]), dataUpdateCount: 2, errorUpdateCount: 0 } }), false);
  now = 120_000;
  assert.equal(options.refetchInterval({ state: { data: new Map(), dataUpdateCount: 24, errorUpdateCount: 0 } }), false);
  assert.equal(options.refetchInterval({ state: { dataUpdateCount: 0, errorUpdateCount: 24 } }), false);
  // 再次进入时，已有缓存的请求次数不能阻止新一轮等图。
  useJanThumbnails(['4900000000000']);
  assert.equal(options.refetchInterval({ state: { data: new Map(), dataUpdateCount: 24, errorUpdateCount: 0 } }), 5000);
  useJanThumbnails([]);
  assert.equal(options.enabled, false);
});
