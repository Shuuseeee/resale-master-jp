# -*- coding: utf-8 -*-
"""规则加载 / 校验 / 商品匹配。

rules.json 是各店免邮・运费・手数料规则的唯一真源；本模块只负责把它读进来、
校验形状、并提供「某件商品是否命中某个条件」这类纯函数。
求值（判定免邮/算钱）在 shipping.py，编成 MILP 约束在 solver.py。
"""
import json
import os

RULES_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "rules.json")

# free_ship.kind 的合法取值
KIND_ALWAYS = "always"            # 无条件免邮
KIND_NEVER = "never"              # 元払い，永远自付
KIND_UNKNOWN = "unknown"          # 规则未知 → 保守按自付，且不应参与优化
KIND_CONDITIONAL = "conditional"  # 按 all_of 条件树判定
KIND_PICKUP = "pickup_only"       # 仅店頭，完全不参与
VALID_KINDS = {KIND_ALWAYS, KIND_NEVER, KIND_UNKNOWN, KIND_CONDITIONAL, KIND_PICKUP}

# 条件叶子的合法键
LEAF_KEYS = {"amount", "count", "weighted_count"}

_cache = {}


def load(path=None):
    """读取并校验 rules.json（按路径缓存）。"""
    p = path or RULES_PATH
    if p not in _cache:
        with open(p, encoding="utf-8") as fh:
            r = json.load(fh)
        validate(r)
        _cache[p] = r
    return _cache[p]


# ---------------------------------------------------------------- 校验

def _validate_cond(node, where):
    if not isinstance(node, dict):
        raise ValueError("%s: 条件必须是对象，得到 %r" % (where, node))
    keys = set(node) & (LEAF_KEYS | {"any_of", "all_of"})
    if len(keys) != 1:
        raise ValueError("%s: 条件必须恰好含 any_of/all_of/amount/count/weighted_count 之一，得到 %s"
                         % (where, sorted(set(node))))
    k = keys.pop()
    if k in ("any_of", "all_of"):
        kids = node[k]
        if not isinstance(kids, list) or not kids:
            raise ValueError("%s.%s: 必须是非空数组" % (where, k))
        for i, c in enumerate(kids):
            _validate_cond(c, "%s.%s[%d]" % (where, k, i))
        return
    body = node[k]
    if "min" not in body:
        raise ValueError("%s.%s: 缺少 min" % (where, k))
    if k == "weighted_count" and not body.get("weights"):
        raise ValueError("%s.weighted_count: 缺少 weights" % where)


def validate(rules):
    boxes = rules.get("boxes") or {}
    tiers = boxes.get("tiers")
    if not tiers:
        raise ValueError("rules.boxes.tiers 缺失")
    sizes = [t["size"] for t in tiers]
    if sizes != sorted(sizes):
        raise ValueError("rules.boxes.tiers 必须按 size 升序")
    for t in tiers:
        for key in ("size", "capacity_l", "fee"):
            if key not in t:
                raise ValueError("rules.boxes.tiers[%s] 缺少 %s" % (t.get("size"), key))
    caps = [t["capacity_l"] for t in tiers]
    if caps != sorted(caps):
        raise ValueError("rules.boxes.tiers 的 capacity_l 必须随 size 单调递增")

    for name, s in (rules.get("stores") or {}).items():
        fs = s.get("free_ship")
        if not fs:
            raise ValueError("store %s: 缺少 free_ship" % name)
        kind = fs.get("kind")
        if kind not in VALID_KINDS:
            raise ValueError("store %s: free_ship.kind=%r 非法，合法值 %s" % (name, kind, sorted(VALID_KINDS)))
        if kind == KIND_CONDITIONAL:
            if not fs.get("all_of"):
                raise ValueError("store %s: conditional 必须提供 all_of" % name)
            for i, c in enumerate(fs["all_of"]):
                _validate_cond(c, "store %s.free_ship.all_of[%d]" % (name, i))
            if fs.get("max_size") is not None and fs["max_size"] not in sizes:
                raise ValueError("store %s: max_size=%s 不在箱型档位 %s 内" % (name, fs["max_size"], sizes))
            mf = fs.get("min_fill_ratio")
            if mf is not None and not (0 < mf < 1):
                raise ValueError("store %s: min_fill_ratio 必须在 (0,1)" % name)
        unmet = fs.get("unmet") or {"type": "actual"}
        if unmet.get("type") not in ("actual", "fixed"):
            raise ValueError("store %s: unmet.type 只能是 actual/fixed" % name)
        if unmet.get("type") == "fixed" and "amount" not in unmet:
            raise ValueError("store %s: unmet.type=fixed 时必须给 amount" % name)

        inc = s.get("incentive")
        if inc is not None:
            if inc.get("kind") != "per_amount_step":
                raise ValueError("store %s: 目前只支持 incentive.kind=per_amount_step" % name)
            for key in ("step", "amount", "max_steps"):
                if key not in inc:
                    raise ValueError("store %s: incentive 缺少 %s" % (name, key))

        tf = s.get("transfer_fee")
        if tf is not None:
            if "default" not in tf:
                raise ValueError("store %s: transfer_fee 缺少 default" % name)
            prev = None
            for t in tf.get("tiers") or []:
                if "amount_at_least" not in t or "fee" not in t:
                    raise ValueError("store %s: transfer_fee.tiers 目前只支持 {amount_at_least, fee}"
                                     "（其它形状会破坏 MILP 的阶梯线性化，需要先扩展 solver）" % name)
                if t["fee"] > tf["default"]:
                    raise ValueError("store %s: transfer_fee tier 的 fee 必须 ≤ default（只支持随金额递减）" % name)
                if prev is not None and t["amount_at_least"] <= prev:
                    raise ValueError("store %s: transfer_fee.tiers 必须按 amount_at_least 严格升序" % name)
                prev = t["amount_at_least"]
    return rules


# ---------------------------------------------------------------- 取值助手

def tiers(rules, store=None):
    """[(size, 有效容量L, 运费), ...]，已乘 fill_factor。

    容量与 store 无关；**运费与 store 有关**——収货地の都道府県が違えば宅急便の基礎運賃が違う。
    store が `ship_dest` を持てば core.yamato で現算し、無ければ boxes.tiers[].fee
    （= boxes.profile の既定目的地で算出済み）をそのまま使う。
    """
    ff = rules["boxes"].get("fill_factor", 1.0)
    fees = _store_fees(rules, store) if store else None
    return [(t["size"], t["capacity_l"] * ff,
             fees[t["size"]] if fees else t["fee"])
            for t in rules["boxes"]["tiers"]]


def _store_fees(rules, store):
    """该店的 {size: 运费}；没有 ship_dest 覆盖则返回 None（调用方用默认表）。"""
    dest = (rules["stores"].get(store) or {}).get("ship_dest")
    if not dest:
        return None
    from . import yamato as Y
    pf = rules["boxes"].get("profile") or {}
    return {t["size"]: Y.fare(
                t["size"],
                origin=pf.get("origin_region", "関東"),
                dest=dest.get("region", pf.get("default_dest_region", "関東")),
                same_prefecture=dest.get("same_prefecture",
                                         pf.get("default_same_prefecture", False)),
                payment=pf.get("payment", "member10"),
                member=pf.get("member", True),
                digital_invoice=pf.get("digital_invoice", True),
                drop_off=pf.get("drop_off", "depot"),
                depot_receive=pf.get("depot_receive", False))
            for t in rules["boxes"]["tiers"]}


def store(rules, name):
    st = rules["stores"].get(name)
    if st is None:
        raise KeyError("rules.json 里没有店铺 %r（未确认规则的店不应参与优化）" % name)
    return st


def free_ship_of(rules, name):
    return store(rules, name)["free_ship"]


def is_mail_store(rules, name):
    st = rules["stores"].get(name)
    return bool(st) and st.get("mail", True) and st["free_ship"]["kind"] != KIND_PICKUP


def known_stores(rules, mail_only=True):
    return [n for n in rules["stores"] if not mail_only or is_mail_store(rules, n)]


# ---------------------------------------------------------------- 商品匹配

def _has(name, pats):
    low = (name or "").lower()
    return any(p.lower() in low for p in pats)


def item_matches(item, cond):
    """商品是否命中一个 count / weighted_count 条件的筛选部分。"""
    cats = cond.get("categories")
    if cats and item.get("cat") not in cats:
        return False
    inc = cond.get("include_name_patterns")
    if inc and not _has(item.get("name"), inc):
        return False
    exc = cond.get("exclude_name_patterns")
    if exc and _has(item.get("name"), exc):
        return False
    return True


def _matches_name_rule(name, rule):
    """count_exclude_name_rules 的一条规则：strip 前缀后，按 all_of(各组任一命中) + none_of 判定。

    例：買取wiki 的「チェキ相紙不计点数」——单纯按 ['チェキ','フィルム'] 部分一致会把机身、
    アルバム 也误杀，所以拆成 strip 品牌词 + 两组 any_of（'フィルム/フイルム' 且
    'チェキ/instax/インスタックス'）+ none_of 排除周边配件。
    """
    text = name or ""
    for s in rule.get("strip") or []:
        text = text.replace(s, "")
    for group in rule.get("all_of") or []:
        if not _has(text, group):
            return False
    if rule.get("none_of") and _has(text, rule["none_of"]):
        return False
    return True


def countable_flags(items, fs):
    """free_ship 级别的整体排除（count_exclude_*）→ 每件是否计入件数条件（不影响金额条件）。"""
    ex_cat = fs.get("count_exclude_categories") or []
    ex_pat = fs.get("count_exclude_name_patterns") or []
    ex_rules = fs.get("count_exclude_name_rules") or []
    out = []
    for it in items:
        ok = True
        if ex_cat and it.get("cat") in ex_cat:
            ok = False
        if ok and ex_pat and _has(it.get("name"), ex_pat):
            ok = False
        if ok and ex_rules and any(_matches_name_rule(it.get("name"), r) for r in ex_rules):
            ok = False
        out.append(ok)
    return out


def _walk_leaves(node, acc):
    if "any_of" in node:
        for c in node["any_of"]:
            _walk_leaves(c, acc)
    elif "all_of" in node:
        for c in node["all_of"]:
            _walk_leaves(c, acc)
    else:
        acc.append(node)
    return acc


def leaves(fs):
    """展开 free_ship 条件树里的所有叶子条件。"""
    acc = []
    for c in fs.get("all_of") or []:
        _walk_leaves(c, acc)
    return acc


def target_flags(items, fs):
    """target_only 用：哪些商品属于「着払い対象商品」。

    定义为命中条件树中任一 count/weighted_count 叶子的筛选条件。
    纯 amount 条件不筛商品，故不参与。
    """
    lv = [c for c in leaves(fs) if "count" in c or "weighted_count" in c]
    if not lv:
        return [True] * len(items)
    out = []
    for it in items:
        hit = False
        for c in lv:
            body = c.get("count") or c.get("weighted_count")
            if "weighted_count" in c:
                w = body.get("weights") or {}
                if w.get(it.get("cat"), 0) > 0:
                    hit = True
                    break
            elif item_matches(it, body):
                hit = True
                break
        out.append(hit)
    return out


def category_warnings(rules, items, stores):
    """规则里用到了分类，但数据没写 cat → 返回警告文案（静默漏建模的常见来源）。"""
    used = set()
    for s in stores:
        fs = rules["stores"].get(s, {}).get("free_ship", {})
        for c in leaves(fs):
            body = c.get("count") or {}
            for cat in body.get("categories") or []:
                used.add((s, cat))
            for cat in (c.get("weighted_count", {}).get("weights") or {}):
                used.add((s, cat))
    if not used:
        return []
    have = {it.get("cat") for it in items if it.get("cat")}
    return ["%s 的免邮规则含「%s」分支，但本次数据里没有任何商品声明 cat='%s' → 该分支恒不成立"
            % (s, cat, cat) for (s, cat) in sorted(used) if cat not in have]
