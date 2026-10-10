# -*- coding: utf-8 -*-
"""规则 → MILP 编译器 + 求解。

把 rules.json 的条件树编成整数规划约束，全局求解「哪件货去哪家店」。
和 KaitoriX 的 splitRank 的本质区别：splitRank 只枚举「启用哪几家店」，
店内固定按最高价分配，做不出「让价换免邮」；这里 x[i,s] 是决策变量，
同一 JAN 也可拆到多店。

商品 dict 约定（沿用 data_YYYYMMDD.py）:
    tid, name, jan, qty, vol, mint, prices={store: (price, stale_days)}
    cat  —— 可选，分类（"スマホ" 等），驱动「スマホ3台以上」这类分支
"""
from collections import defaultdict

import pulp

from . import rules as R
from . import shipping as S

# 平级判别用的极小惩罚（总量 < 0.5 円，不会改变日元级最优，只让等价最优变确定）：
EPS_TIER = 1e-4   # 免邮时箱型不影响成本 → 选最小箱
EPS_BOX = 1e-3    # 等价方案里箱数越少越好（每箱＝一次予約・発送・振込）


class Infeasible(Exception):
    pass


def usable_prices(item, stores, stale_limit):
    return {s: p for s, (p, st) in item["prices"].items()
            if s in stores and st <= stale_limit}


def participating(rules, candidates):
    """筛掉未知规则店 / 店頭専用店，返回 (可用店, 剔除说明)。"""
    keep, dropped = [], []
    for s in candidates:
        st = rules["stores"].get(s)
        if st is None:
            dropped.append((s, "规则未确认，不参与优化"))
            continue
        kind = st["free_ship"]["kind"]
        if kind == R.KIND_PICKUP:
            dropped.append((s, "仅店頭買取，无郵送"))
        elif kind == R.KIND_UNKNOWN:
            dropped.append((s, "送料条件未公表"))
        elif not st.get("mail", True):
            dropped.append((s, "不支持郵送"))
        else:
            keep.append(s)
    return keep, dropped


def solve(TX, candidates, rules=None, stale_limit=7, exclude=(), msg=0):
    """全局最优分销。返回 solution dict。"""
    rules = rules or R.load()
    stores, dropped = participating(rules, [s for s in candidates if s not in exclude])
    dropped += [(s, "本次手动排除") for s in exclude if s in candidates]
    if not stores:
        raise Infeasible("没有任何可参与优化的店铺")

    sidx = {s: i for i, s in enumerate(stores)}
    TIERS = R.tiers(rules)

    up = {t["tid"]: usable_prices(t, stores, stale_limit) for t in TX}
    orphans = [t for t in TX if not up[t["tid"]]]
    if orphans:
        raise Infeasible("以下商品在可用店铺里没有有效报价（报价过期或无人收），无法全量分配：\n  "
                         + "\n  ".join("%s %s" % (t["tid"], t["name"]) for t in orphans))

    prob = pulp.LpProblem("resale", pulp.LpMaximize)
    N = sum(t["qty"] for t in TX)

    # 分配变量：x[tid, store] ∈ [0, qty]，同一 JAN 可拆多店
    x = {}
    for t in TX:
        for s in up[t["tid"]]:
            x[(t["tid"], s)] = pulp.LpVariable("x_%s_%d" % (t["tid"], sidx[s]), 0, t["qty"], cat="Integer")
        prob += pulp.lpSum(x[(t["tid"], s)] for s in up[t["tid"]]) == t["qty"], "alloc_%s" % t["tid"]

    y, f, pay, z, ship_terms, fee_terms, inc_terms = {}, {}, {}, {}, [], [], []
    rev, cnt, vol = {}, {}, {}
    tiebreak = []
    counter = [0]

    def newbin(prefix, s):
        counter[0] += 1
        return pulp.LpVariable("%s_%d_%d" % (prefix, sidx[s], counter[0]), cat="Binary")

    def compile_cond(node, s, items):
        """返回二元变量 b，满足 b=1 ⟹ 条件成立（b=0 不作约束）。"""
        b = newbin("c", s)
        if "any_of" in node:
            kids = [compile_cond(c, s, items) for c in node["any_of"]]
            prob.addConstraint(b <= pulp.lpSum(kids))
        elif "all_of" in node:
            for c in node["all_of"]:
                prob.addConstraint(b <= compile_cond(c, s, items))
        elif "amount" in node:
            prob.addConstraint(rev[s] >= node["amount"]["min"] * b)
        elif "count" in node:
            c = node["count"]
            flags = R.countable_flags(items, R.free_ship_of(rules, s))
            expr = pulp.lpSum(x[(t["tid"], s)] for t, ok in zip(items, flags)
                              if ok and R.item_matches(t, c))
            prob.addConstraint(expr >= c["min"] * b)
        elif "weighted_count" in node:
            c = node["weighted_count"]
            w = c.get("weights") or {}
            flags = R.countable_flags(items, R.free_ship_of(rules, s))
            expr = pulp.lpSum(w.get(t.get("cat"), 0) * x[(t["tid"], s)]
                              for t, ok in zip(items, flags) if ok and w.get(t.get("cat"), 0))
            prob.addConstraint(expr >= c["min"] * b)
        return b

    for s in stores:
        items = [t for t in TX if s in up[t["tid"]]]
        if not items:
            continue
        rev[s] = pulp.lpSum(up[t["tid"]][s] * x[(t["tid"], s)] for t in items)
        cnt[s] = pulp.lpSum(x[(t["tid"], s)] for t in items)
        vol[s] = pulp.lpSum(t["vol"] * x[(t["tid"], s)] for t in items)

        y[s] = pulp.LpVariable("y_%d" % sidx[s], cat="Binary")
        prob += cnt[s] <= N * y[s]
        prob += cnt[s] >= y[s]

        # 箱型档位
        for (size, cap, _fee) in TIERS:
            z[(s, size)] = pulp.LpVariable("z_%d_%d" % (sidx[s], size), cat="Binary")
        prob += pulp.lpSum(z[(s, size)] for (size, _, _) in TIERS) == y[s]
        prob += vol[s] <= pulp.lpSum(cap * z[(s, size)] for (size, cap, _) in TIERS)
        for t in items:  # 每件商品的最小箱型（三辺合計约束）
            for (size, _, _) in TIERS:
                if size < t["mint"]:
                    prob += x[(t["tid"], s)] <= t["qty"] * (1 - z[(s, size)])
        tiebreak.append(pulp.lpSum(size * z[(s, size)] for (size, _, _) in TIERS))

        # 免邮
        fs = R.free_ship_of(rules, s)
        kind = fs["kind"]
        if kind == R.KIND_ALWAYS:
            f[s] = y[s]
        elif kind == R.KIND_CONDITIONAL:
            fv = pulp.LpVariable("f_%d" % sidx[s], cat="Binary")
            prob += fv <= y[s]
            for c in fs["all_of"]:
                prob += fv <= compile_cond(c, s, items)
            if fs.get("max_size") is not None:
                prob += fv <= pulp.lpSum(z[(s, size)] for (size, _, _) in TIERS
                                         if size <= fs["max_size"])
            # min_fill_ratio 不进约束（见 shipping.evaluate 里的说明：档位容量 ≠ 实际箱体，
            # 拿它当硬约束会把「小件用小箱」误判成箱過大）。改由 _finalize 输出告警。
            if fs.get("target_only"):
                tflags = R.target_flags(items, fs)
                for t, ok in zip(items, tflags):
                    if not ok:
                        prob += x[(t["tid"], s)] <= t["qty"] * (1 - fv)
            f[s] = fv
        else:  # never / unknown
            f[s] = 0
        pay[s] = y[s] - f[s]

        # 运费：pay=1 时按所选箱型收费（unmet.fixed 则按固定额）
        unmet = fs.get("unmet") or {"type": "actual"}
        if unmet["type"] == "fixed":
            ship_terms.append(unmet["amount"] * pay[s])
        else:
            for (size, _, fee) in R.tiers(rules, s):   # 运费按该店収货地
                wv = pulp.LpVariable("w_%d_%d" % (sidx[s], size), cat="Binary")
                prob += wv <= z[(s, size)]
                prob += wv <= pay[s]
                prob += wv >= z[(s, size)] + pay[s] - 1
                ship_terms.append(fee * wv)

        # 買取奨励金（每满 step +amount，封顶 max_steps）
        inc = R.store(rules, s).get("incentive")
        if inc:
            prev = None
            for k in range(1, inc["max_steps"] + 1):
                hv = pulp.LpVariable("h_%d_%d" % (sidx[s], k), cat="Binary")
                prob += rev[s] >= inc["step"] * k * hv
                prob += hv <= y[s]
                if prev is not None:
                    prob += hv <= prev
                inc_terms.append(inc["amount"] * hv)
                prev = hv

        # 振込手数料（随金额递减的阶梯）
        tf = R.store(rules, s).get("transfer_fee")
        if tf:
            fee_terms.append(tf["default"] * y[s])
            prevg, prevfee = None, tf["default"]
            for tier in tf.get("tiers") or []:
                gv = pulp.LpVariable("g_%d_%d" % (sidx[s], tier["amount_at_least"]), cat="Binary")
                prob += rev[s] >= tier["amount_at_least"] * gv
                prob += gv <= y[s]
                if prevg is not None:
                    prob += gv <= prevg
                fee_terms.append(-(prevfee - tier["fee"]) * gv)
                prevg, prevfee = gv, tier["fee"]

    prob += (pulp.lpSum(rev.values()) + pulp.lpSum(inc_terms)
             - pulp.lpSum(ship_terms) - pulp.lpSum(fee_terms)
             - EPS_TIER * pulp.lpSum(tiebreak) - EPS_BOX * pulp.lpSum(y.values()))

    status = prob.solve(pulp.PULP_CBC_CMD(msg=msg))
    if pulp.LpStatus[status] != "Optimal":
        raise Infeasible("MILP 未求得最优解：%s" % pulp.LpStatus[status])

    # ---------------- 提取 + 事后重算（不信任目标函数值，全部用 shipping.py 复算）
    alloc = defaultdict(list)
    for t in TX:
        for s in up[t["tid"]]:
            v = int(round(x[(t["tid"], s)].value() or 0))
            if v > 0:
                alloc[s].append(dict(item=t, qty=v, unit=up[t["tid"]][s]))

    return _finalize(rules, alloc, dropped, stale_limit,
                     milp_status=pulp.LpStatus[status],
                     milp_objective=pulp.value(prob.objective))


def _finalize(rules, alloc, dropped, stale_limit, milp_status=None, milp_objective=None):
    """把分配结果算成账（solve 和 baselines 共用，保证口径一致）。"""
    TIERS = R.tiers(rules)
    boxes, tot = {}, dict(rev=0, ship=0, fee=0, inc=0, qty=0)
    for s, rows in alloc.items():
        if not rows:
            continue
        items = [dict(r["item"], qty=r["qty"]) for r in rows]
        amount = sum(r["unit"] * r["qty"] for r in rows)
        n = sum(r["qty"] for r in rows)
        volume = sum(r["item"]["vol"] * r["qty"] for r in rows)
        mint = max(r["item"]["mint"] for r in rows)
        size, fee = S.pick_tier(rules, volume, mint, store=s)
        cap = next(c for (sz, c, _) in TIERS if sz == size)
        ev = S.evaluate(rules, s, items, amount, box_size=size, box_capacity=cap,
                        box_volume=volume, box_fee=fee)
        tfee = S.transfer_fee(rules, s, amount)
        binc = S.incentive(rules, s, amount)
        boxes[s] = dict(store=s, rows=rows, amount=amount, qty=n, volume=volume,
                        tier=size, tier_fee=fee, free=ev["free"], ship=ev["cost"],
                        label=ev["label"], blockers=ev["blockers"], warnings=ev["warnings"],
                        transfer_fee=tfee, incentive=binc,
                        net=amount - ev["cost"] - tfee + binc)
        tot["rev"] += amount
        tot["ship"] += ev["cost"]
        tot["fee"] += tfee
        tot["inc"] += binc
        tot["qty"] += n
    tot["net"] = tot["rev"] - tot["ship"] - tot["fee"] + tot["inc"]
    return dict(boxes=boxes, total=tot, dropped=dropped, stale_limit=stale_limit,
                milp_status=milp_status, milp_objective=milp_objective)
