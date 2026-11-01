# -*- coding: utf-8 -*-
"""出货方案服务：把 core/ 的求解与自检包成两个纯函数，供 api/solve.py（Vercel Python 函数）调用。

- plan(payload)  全局最优分销方案 + 三方不等式自检 + 账目自检 + 需确认清单
- rules_summary(day)  各店包邮规则、核实日期、休业提示、运费口径

口径与原 ResaleAssist（~/Projects/ResaleAssist）一致：规则只在 core/rules.json 维护；
没有任何有效报价的商品不进求解，直接列为留库（原流程「时效剔除后无有效报价 → 转入留库」）。
"""
import datetime
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core import baselines as B  # noqa: E402
from core import rules as R  # noqa: E402
from core import shipping as S  # noqa: E402
from core.solver import Infeasible, participating, solve, usable_prices  # noqa: E402

# 规则核实超过这么多天就提示可能过期（原流程：约 2 周）
STALE_RULE_DAYS = 14


def _item(raw):
    prices = {s: (int(p[0]), int(p[1])) for s, p in (raw.get("prices") or {}).items()}
    return dict(
        tid=str(raw["tid"]),
        name=raw.get("name") or "",
        jan=raw.get("jan") or "",
        qty=int(raw["qty"]),
        qty_full=int(raw.get("qty_full", raw["qty"])),
        qty_sold=int(raw.get("qty_sold", 0)),
        total=float(raw.get("total", 0)),
        cp=float(raw.get("cp", 0)),
        pp=float(raw.get("pp", 0)),
        ex=float(raw.get("ex", 0)),
        vol=float(raw["vol"]),
        mint=int(raw["mint"]),
        cat=raw.get("cat"),
        prices=prices,
    )


def _net_unit_cost(t):
    full = t["qty_full"] or 1
    return (t["total"] - (t["pp"] + t["ex"] + t["cp"])) / full


def _box(b):
    return dict(
        store=b["store"],
        amount=b["amount"],
        qty=b["qty"],
        volume=round(b["volume"], 2),
        size=b["tier"],
        free_shipping=b["free"],
        shipping=b["ship"],
        rule=b["label"],
        blockers=b["blockers"],
        warnings=b["warnings"],
        transfer_fee=b["transfer_fee"],
        incentive=b["incentive"],
        net=b["net"],
        items=[
            dict(tid=r["item"]["tid"], name=r["item"]["name"], jan=r["item"]["jan"], qty=r["qty"], unit_price=r["unit"],
                 unit_cost=round(_net_unit_cost(r["item"]), 2))
            for r in b["rows"]
        ],
    )


def plan(payload):
    rules = R.load()
    stale_limit = int(payload.get("stale_limit") or 1)
    exclude = list(payload.get("exclude_stores") or [])
    day = payload.get("day") or datetime.date.today().isoformat()
    items = [_item(x) for x in payload.get("items") or []]
    if not items:
        return dict(ok=False, error="没有可分销的商品")

    candidates = sorted({s for t in items for s in t["prices"]})
    stores, _ = participating(rules, [s for s in candidates if s not in exclude])
    priced = [t for t in items if usable_prices(t, stores, stale_limit)]
    unpriced = [dict(tid=t["tid"], name=t["name"], jan=t["jan"], qty=t["qty"]) for t in items if t not in priced]
    if not priced:
        return dict(ok=False, error="所有商品在可用店铺里都没有有效报价（只用 %d 天前以内的，按日本时间日历日）" % stale_limit, unpriced=unpriced)

    try:
        sol = solve(priced, candidates, rules, stale_limit=stale_limit, exclude=exclude)
    except Infeasible as e:
        return dict(ok=False, error=str(e), unpriced=unpriced)
    greedy = B.baseline_greedy(priced, candidates, rules, stale_limit, exclude)
    subset = B.baseline_subset(priced, candidates, rules, stale_limit, exclude)
    verify_ok, verify_lines = B.verify(greedy, subset, sol)
    cross_ok, cross_lines = B.cross_check(sol)

    cost = sum(_net_unit_cost(r["item"]) * r["qty"] for b in sol["boxes"].values() for r in b["rows"])
    total = dict(sol["total"])
    total["cost"] = round(cost)
    total["profit"] = round(total["net"] - cost)

    return dict(
        ok=True,
        day=day,
        stale_limit=stale_limit,
        total=total,
        boxes=[_box(b) for b in sorted(sol["boxes"].values(), key=lambda b: -b["net"])],
        unpriced=unpriced,
        excluded_stores=[dict(store=s, reason=why) for s, why in sol["dropped"]],
        need_confirm=B.unknown_store_flags(priced, candidates, rules, stale_limit, exclude, sol=sol),
        stale_quotes=B.stale_drops(priced, candidates, rules, stale_limit),
        closed_stores=B.availability_report(rules, list(sol["boxes"].keys()), day),
        category_warnings=R.category_warnings(rules, priced, list(sol["boxes"].keys())),
        checks=dict(
            ok=verify_ok and cross_ok,
            lines=verify_lines + cross_lines,
            greedy_net=greedy["total"]["net"],
            subset_net=subset["total"]["net"],
        ),
    )


def _verified_age(verified, today):
    try:
        d = datetime.date.fromisoformat(str(verified)[:10])
    except ValueError:
        return None
    return (today - d).days


def rules_summary(day=None):
    rules = R.load()
    today = datetime.date.fromisoformat(day) if day else datetime.date.today()
    out = []
    for name, st in rules["stores"].items():
        age = _verified_age(st.get("verified", ""), today)
        out.append(dict(
            store=name,
            mail=bool(st.get("mail")),
            free_shipping=S.describe_free_ship(rules, name),
            verified=st.get("verified"),
            verified_days_ago=age,
            maybe_outdated=age is None or age > STALE_RULE_DAYS,
            availability=S.availability(rules, name, today.isoformat()),
            payment=st.get("payment"),
            notes=st.get("extra_conditions"),
        ))
    return dict(
        rules_version=rules.get("rules_version"),
        day=today.isoformat(),
        stale_rule_days=STALE_RULE_DAYS,
        shipping_profile=S.profile_line(rules),
        tariff=S.tariff_line(rules),
        stores=out,
    )
