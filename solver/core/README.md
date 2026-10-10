# core/ —— 分销计算引擎

规则、求解、自检的唯一实现。每天的目录（`202608/0815/` 之类）只放**当天的数据和当天的人工决策**。

```
core/
  rules.json    各店免邮/运费/手数料规则 + 宅急便费率  ← 规则改这里，只改这里
  yamato.py     宅急便运费计算器（官网割引シミュレータ算法の移植）＋ yamato_tariff_*.json 费率表
  rules.py      加载、形状校验、商品匹配
  shipping.py   求值器：免邮判定、日语不足額文案、手数料/奨励金、箱型选择、规则渲染
  solver.py     规则 → MILP 编译 + 全局求解
  baselines.py  贪心 / 子集枚举两条对照基线 + 三方不等式自检
  tests.py      场景测试（跑：python3 core/tests.py）
```

## 每天怎么用

抄 `202608/0815/optimize_core.py` 当模板，只改三处：数据文件、`DAY`、`EXCLUDE`。

```python
from core import rules as R, baselines as B
from core.solver import solve

RULES = R.load()
CANDIDATES = sorted({s for t in TX for s in t["prices"]})   # 全部报价来源，core 自己筛
sol    = solve(TX, CANDIDATES, RULES, stale_limit=7, exclude=["買取エノキング"])
greedy = B.baseline_greedy(TX, CANDIDATES, RULES, 7, ["買取エノキング"])
subset = B.baseline_subset(TX, CANDIDATES, RULES, 7, ["買取エノキング"])
assert B.verify(greedy, subset, sol)[0]     # 贪心 ≤ 子集枚举 ≤ MILP
assert B.cross_check(sol)[0]                # 各箱合计＝总计、免邮判定与运费一致
```

`solve()` 会自己把规则未确认的店、店頭専用店筛掉，`dropped` 里带原因。

## 商品数据字段

```python
dict(tid="T01", name="...", jan="4938833024404",
     qty=1,            # 在库可分销数（分配变量的上界，可拆到多店）
     qty_full=1, qty_sold=0,
     total=3200, cp=96, pp=33, ex=66,     # 净成本 = total - (pp + ex + cp)
     vol=0.3,          # 体积(L)，录入时已含缓冲
     mint=60,          # 最小箱型（三辺合計约束）
     cat="スマホ",      # 可选，但漏写会让「スマホ3台以上」分支恒不成立
     prices={"買取商店": (3200, 0)})       # {店: (报价, 报价年龄天数)}
```

**`cat` 必须写。** 只要进手机，`買取商店/買取一丁目/モバイル一番` 的「5点以上**或**スマホ3台以上」
里的 OR 分支就会生效——漏写 `cat` 会让 3 台手机被判成不免邮，白丢一个箱的运费。
漏写时 `rules.category_warnings()` 会提示，跑 runner 时留意。

## rules.json 规则 DSL

条件树取自 KaitoriX 的 `KX_SHIPPING_RULES`，加了它没有的 `max_size` / `min_fill_ratio` /
`target_only` / `incentive` / `holidays` / `exclude_name_patterns`。

```jsonc
"free_ship": {
  "kind": "conditional",        // always | never | unknown | conditional | pickup_only
  "all_of": [                   // 全部满足才免邮
    { "any_of": [               // 任一满足即可
        { "count": { "min": 5 } },
        { "count": { "min": 3, "categories": ["スマホ"] } }
    ]},
    { "amount": { "min": 100000 } }
  ],
  "max_size": 160,              // 箱型上限，超了不免邮
  "min_fill_ratio": 0.5,        // 「箱が過大NG」→ 只告警不否决（理由见下）
  "target_only": true,          // 着払い対象商品のみ，混入非対象商品则整箱不免邮
  "unmet": { "type": "actual" } // 未达条件时的运费：actual=按箱型 / fixed=固定额
}
```

叶子条件三种：`amount{min}`、`count{min, categories?, include_name_patterns?, exclude_name_patterns?}`、
`weighted_count{min, weights}`。另有 free_ship 级的 `count_exclude_categories` /
`count_exclude_name_patterns` 做整体排除。

其它字段：`incentive`（買取奨励金，每满 `step` 加 `amount`，封顶 `max_steps`）、
`transfer_fee`（振込手数料，`tiers` 只支持 `{amount_at_least, fee}` 且随金额递减）、
`holidays` / `weekly_closed`（只出提示，不自动剔店——「休業中でも予約して再開日到着指定で発送」是可行的，
剔不剔由当天的人决定）。

改完 `rules.json` 跑一遍 `python3 core/tests.py` 和 `python3 202608/0815/regression.py`。

### 运费：为什么不能直接读 `boxes.tiers[].fee`

宅急便的基础运赁是 **発地 × 着地 × サイズ** 的矩阵，而且「発着が同一都道府県内」走**另一张更便宜的表**
（160サイズ 税込基本料金 2,410 vs 関東→関東 3,020）。`boxes.tiers[].fee` 只是
`boxes.profile` 的**默认目的地**算出来的一行，某店若在 `ship_dest` 里声明了自己的収货地，
真实运费就不是这一行。

所以取运费一律 `R.tiers(rules, store)`，或 `S.pick_tier(rules, vol, mint, store=s)`。
`boxes.profile` 描述寄件口径（origin_region / payment / member / digital_invoice / drop_off /
depot_receive），改它等于改所有店的运费——改完必跑 `python3 core/tests.py`。

折扣算法（`core/yamato.py`，官网 `result_01.min.js` 的逐行移植）：
百分比折扣打在**税抜**基础运赁上 → ×1.1 → 四舍五入到 1 円 → 再减
デジタル割 60／持込割 150（会员＋デジタル送り状；否则 100）／営業所受取 60。
**顺序不能颠倒**，2026-08-26 那次算错运费就是把固定额和百分比的顺序搞反了。

### 为什么 `min_fill_ratio` 不进 MILP

買取商店 写明「箱が過大だと対象外（隙間が箱の半分以上はNG）」。但 `capacity_l` 是**档位上限**，
不是实际纸箱：60サイズ只要求三辺合計≤60cm，小件用小箱一样是 60サイズ。拿档位容量算充填率，
会把「3 台手机装小箱」误判成箱過大（实测过，会白白判掉一次合法免邮）。
所以它只在结果里出 `warnings`，由人在打包时确认。

## 为什么是 MILP 而不是 KaitoriX 的 splitRank

`splitRank/splitScore` 只枚举「启用哪几家店」，店内固定按最高价分配，做不出**让价换免邮**，
也不能拆同一 JAN、没有箱型档位、遇到子集内无人报价会静默丢货。
`baselines.baseline_subset()` 就是它的等价移植，留着当对照：**任何一天都必须
`贪心 ≤ 子集枚举 ≤ MILP`**，破了就说明三者里有人建模错了。

2026-08-15 实测：贪心 151,770 ／ 子集枚举 153,280 ／ MILP 153,540。
差额来自 MILP 把 PS5 让给買取商店（少卖 1,300 円）凑到 10 万免邮，省下两箱运费。
