# -*- coding: utf-8 -*-
"""两条对照基线 + 三方不等式自检。

baseline_greedy   ——「每件卖全局最高价」，提示词 v2 明令禁止的贪心
baseline_subset   —— KaitoriX splitRank 的移植：枚举店铺子集，子集内仍按最高价分配
solve (solver.py) —— 全局 MILP

任何一天都必须满足   greedy ≤ subset ≤ MILP。
不等式一旦破了，说明三者里有人建模错了（历史上就是靠这个抓出漏建模的）。
"""
import itertools

from . import rules as R
from . import shipping as S
from .solver import usable_prices, participating, _finalize, Infeasible


def _assign(TX, subset, up):
    """子集内每件整批分给报价最高的店（splitScore 的等价实现）。"""
    alloc = {s: [] for s in subset}
    for t in TX:
        cand = {s: p for s, p in up[t["tid"]].items() if s in subset}
        if not cand:
            return None  # splitRank 会静默丢货；我们要求全量分配 → 视为不可行
        best = max(sorted(cand), key=lambda s: cand[s])
        alloc[best].append(dict(item=t, qty=t["qty"], unit=cand[best]))
    return alloc


def _score(rules, alloc, dropped, stale_limit):
    try:
        return _finalize(rules, alloc, dropped, stale_limit)
    except ValueError:
        return None  # 装不下任何箱型


def baseline_greedy(TX, candidates, rules=None, stale_limit=7, exclude=()):
    rules = rules or R.load()
    stores, dropped = participating(rules, [s for s in candidates if s not in exclude])
    up = {t["tid"]: usable_prices(t, stores, stale_limit) for t in TX}
    alloc = _assign(TX, stores, up)
    if alloc is None:
        raise Infeasible("贪心基线：有商品在可用店铺无报价")
    return _score(rules, {s: r for s, r in alloc.items() if r}, dropped, stale_limit)


def baseline_subset(TX, candidates, rules=None, stale_limit=7, exclude=(), max_stores=6,
                    top_n=1):
    """splitRank 移植。默认 max_stores=6（KaitoriX 原版硬限是3，这里放宽到用户确认可接受的上限）；
    传 None 才不设上限。

    这个上限不只是性能兜底：店铺子集是 itertools.combinations(stores, k) 逐档穷举，参与优化的
    店一旦变多，组合数按 C(n,k) 爆炸。2026-08-24 从 11 家扩到 28 家参与店后实测过：k=3 <1s，
    k=4 1.5s，k=5 8.9s，k=6 40s（用户确认可接受的上限），k=7 131s（用户确认的失控点，且净回款
    跟 k=3~6 完全一样——这份数据 3 家就已经封顶了，再往上纯粹白烧时间，没有换来更强的自检基线）。
    真要跑不限档的穷举，显式传 max_stores=None。

    top_n>1 时返回按净回款降序的前 N 个方案（原版 splitRank 的排行榜行为）。
    """
    rules = rules or R.load()
    stores, dropped = participating(rules, [s for s in candidates if s not in exclude])
    up = {t["tid"]: usable_prices(t, stores, stale_limit) for t in TX}
    cap = max_stores if max_stores is not None else len(stores)
    seen, results = set(), []
    for k in range(1, cap + 1):
        for sub in itertools.combinations(stores, k):
            alloc = _assign(TX, list(sub), up)
            if alloc is None:
                continue
            alloc = {s: r for s, r in alloc.items() if r}
            key = tuple(sorted(alloc))
            if key in seen:
                continue
            seen.add(key)
            sol = _score(rules, alloc, dropped, stale_limit)
            if sol:
                results.append(sol)
    if not results:
        raise Infeasible("子集枚举基线：无可行方案")
    results.sort(key=lambda s: (-s["total"]["net"], len(s["boxes"])))
    return results[0] if top_n == 1 else results[:top_n]


def verify(greedy, subset, milp, tol=0):
    """三方不等式自检。返回 (ok, 报告行)。"""
    g, s, m = greedy["total"]["net"], subset["total"]["net"], milp["total"]["net"]
    lines = [
        "贪心基线      净回款 %10s 円" % "{:,}".format(int(g)),
        "子集枚举基线  净回款 %10s 円  (splitRank 等价逻辑)" % "{:,}".format(int(s)),
        "全局 MILP     净回款 %10s 円" % "{:,}".format(int(m)),
        "MILP 比贪心多赚 %s 円；比子集枚举多赚 %s 円"
        % ("{:,}".format(int(m - g)), "{:,}".format(int(m - s))),
    ]
    ok = True
    if s < g - tol:
        lines.append("!! 自检失败：子集枚举 < 贪心（贪心是子集枚举的一个可行解，不该更优）")
        ok = False
    if m < s - tol:
        lines.append("!! 自检失败：MILP < 子集枚举（子集枚举的任何解都是 MILP 的可行解）")
        ok = False
    if ok:
        lines.append("自检 OK：贪心 ≤ 子集枚举 ≤ MILP")
    return ok, lines


def cross_check(sol):
    """事后重算 vs 各箱账目一致性自检。"""
    t = sol["total"]
    lines, ok = [], True
    rev = sum(b["amount"] for b in sol["boxes"].values())
    ship = sum(b["ship"] for b in sol["boxes"].values())
    qty = sum(b["qty"] for b in sol["boxes"].values())
    if rev != t["rev"] or ship != t["ship"] or qty != t["qty"]:
        lines.append("!! 各箱合计与总计不一致")
        ok = False
    for b in sol["boxes"].values():
        want = b["amount"] - b["ship"] - b["transfer_fee"] + b["incentive"]
        if want != b["net"]:
            lines.append("!! %s 净回款不自洽" % b["store"])
            ok = False
        if b["free"] and b["ship"] != 0:
            lines.append("!! %s 判定免邮但仍计运费" % b["store"])
            ok = False
        if not b["free"] and b["ship"] == 0 and b["tier_fee"] != 0:
            lines.append("!! %s 未免邮但运费为 0" % b["store"])
            ok = False
    if ok:
        lines.append("账目自检 OK：各箱合计＝总计，免邮判定与运费一致")
    return ok, lines


def unknown_store_flags(TX, candidates, rules=None, stale_limit=7, exclude=(), sol=None):
    """未参与优化的店报价高于本方案实际成交价 → 需要人工确认的清单。

    给了 sol 就跟方案里的真实成交单价比（更有意义）；没给则跟可用店最高价比。
    """
    rules = rules or R.load()
    stores, _ = participating(rules, [s for s in candidates if s not in exclude])
    got = {}
    if sol:
        for st_name, b in sol["boxes"].items():
            for r in b["rows"]:
                tid = r["item"]["tid"]
                if tid not in got or r["unit"] > got[tid][1]:
                    got[tid] = (st_name, r["unit"])
    out = []
    for t in TX:
        kn = usable_prices(t, stores, stale_limit)
        if not kn:
            continue
        if t["tid"] in got:
            ref_store, ref_price = got[t["tid"]]
            basis = "本方案成交"
        else:
            ref_store = max(sorted(kn), key=lambda s: kn[s])
            ref_price = kn[ref_store]
            basis = "可用店最高价"
        for s, (p, st) in t["prices"].items():
            if s in stores or st > stale_limit:
                continue
            info = rules["stores"].get(s)
            if info and info["free_ship"]["kind"] == R.KIND_PICKUP:
                continue  # 店頭専用は提示不要
            if p > ref_price:
                why = "本次排除" if info else "规则未确认"
                out.append(dict(tid=t["tid"], name=t["name"], store=s, price=p,
                                best=ref_store, best_price=ref_price, diff=p - ref_price,
                                basis=basis, why=why))
    return sorted(out, key=lambda d: -d["diff"])


def stale_drops(TX, candidates, rules=None, stale_limit=7):
    """被时效剔除的已知店报价清单。"""
    rules = rules or R.load()
    stores, _ = participating(rules, candidates)
    return [dict(tid=t["tid"], name=t["name"], store=s, price=p, stale=st)
            for t in TX for s, (p, st) in t["prices"].items()
            if s in stores and st > stale_limit]


def availability_report(rules, stores, day):
    rules = rules or R.load()
    out = []
    for s in stores:
        av = S.availability(rules, s, day)
        if not av["open"]:
            out.append(dict(store=s, reasons=av["reasons"]))
    return out
