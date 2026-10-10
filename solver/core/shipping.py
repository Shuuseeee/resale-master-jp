# -*- coding: utf-8 -*-
"""规则求值器：给定「这一箱装了什么」，判定免邮/运费/手数料，并生成日语不足額文案。

对应 KaitoriX 的 splitShipping / splitCondOk / splitTransferFee，
扩展了 max_size、min_fill_ratio、target_only、incentive 这几项它没有的东西。

这里是**事后求值**（给报告用）。求解时的等价约束在 solver.py，
两边必须给出一致的结论——regression 里有交叉断言。
"""
from . import rules as R


def pick_tier(rules, volume, min_size=60, store=None):
    """按体积和最小箱型选最小可用档位 → (size, fee)。装不下则 raise。

    store を渡すとその店の収货地に応じた運賃（core.rules.tiers 参照）で返す。
    """
    for (size, cap, fee) in R.tiers(rules, store):
        if cap >= volume - 1e-9 and size >= min_size:
            return size, fee
    raise ValueError("体积 %.1fL / 最小箱型 %s 超出最大箱型" % (volume, min_size))


# ---------------------------------------------------------------- 条件判定

def _count_of(items, cond, flags):
    n = 0
    for it, ok in zip(items, flags):
        if ok and R.item_matches(it, cond):
            n += it["qty"]
    return n


def _weighted_of(items, cond, flags):
    w = cond.get("weights") or {}
    tot = 0.0
    for it, ok in zip(items, flags):
        if ok:
            tot += w.get(it.get("cat"), 0) * it["qty"]
    return tot


def cond_ok(node, items, amount, flags):
    if "any_of" in node:
        return any(cond_ok(c, items, amount, flags) for c in node["any_of"])
    if "all_of" in node:
        return all(cond_ok(c, items, amount, flags) for c in node["all_of"])
    if "amount" in node:
        return amount >= node["amount"]["min"]
    if "count" in node:
        return _count_of(items, node["count"], flags) >= node["count"]["min"]
    if "weighted_count" in node:
        return _weighted_of(items, node["weighted_count"], flags) >= node["weighted_count"]["min"]
    return True


def _lack(node, items, amount, flags):
    """单个叶子条件还差多少 → 日语短语；无法表达则 None。"""
    if "amount" in node:
        return "{:,}円".format(int(node["amount"]["min"] - amount))
    if "count" in node:
        c = node["count"]
        n = _count_of(items, c, flags)
        unit = "台" if (c.get("categories") and "スマホ" in c["categories"]) else "点"
        return "%d%s" % (c["min"] - n, unit)
    if "weighted_count" in node:
        c = node["weighted_count"]
        return "換算%g点" % (c["min"] - _weighted_of(items, c, flags))
    return None


def _shortfall(node, items, amount, flags):
    if cond_ok(node, items, amount, flags):
        return None
    if "any_of" in node:
        cands = [t for t in (_shortfall(c, items, amount, flags) for c in node["any_of"]) if t]
        return "か".join(cands) if cands else None
    if "all_of" in node:
        cands = [t for t in (_shortfall(c, items, amount, flags) for c in node["all_of"]) if t]
        return "と".join(cands) if cands else None
    return _lack(node, items, amount, flags)


# ---------------------------------------------------------------- 主求值

def evaluate(rules, store_name, items, amount, box_size=None, box_capacity=None,
             box_volume=None, box_fee=None):
    """判定一箱货在某店是否免邮。

    items: [{name, qty, cat?, ...}]  amount: 该箱买取金额
    box_size/box_capacity/box_volume: 用于 max_size 与 min_fill_ratio 判定（缺省则跳过该项）
    box_fee: 未达条件时的实际运费（缺省 0）

    返回 dict(free, cost, label, blockers)
    """
    fs = R.free_ship_of(rules, store_name)
    kind = fs["kind"]
    fee = box_fee or 0

    if kind == R.KIND_ALWAYS:
        return dict(free=True, cost=0, label="条件なしで着払いOK", blockers=[], warnings=[])
    if kind == R.KIND_PICKUP:
        return dict(free=False, cost=fee, label="店頭買取のみ（郵送不可）", blockers=["郵送不可"], warnings=[])
    if kind == R.KIND_NEVER:
        return dict(free=False, cost=fee, label="元払い（着払い対応なし）のため自己負担",
                    blockers=[], warnings=[])
    if kind == R.KIND_UNKNOWN:
        return dict(free=False, cost=fee, label="送料条件が未確認のため自己負担で計算",
                    blockers=[], warnings=[])

    flags = R.countable_flags(items, fs)
    blockers, warnings = [], []

    # 条件树
    unmet_nodes = [c for c in fs["all_of"] if not cond_ok(c, items, amount, flags)]
    for c in unmet_nodes:
        t = _shortfall(c, items, amount, flags)
        if t:
            blockers.append("あと" + t)

    # 箱型上限
    max_size = fs.get("max_size")
    if max_size is not None and box_size is not None and box_size > max_size:
        blockers.append("%dサイズ超过（上限%dサイズ）" % (box_size, max_size))

    # 箱が過大（隙間が半分以上）—— 只告警不否决。
    # 装什么纸箱是打包时人决定的：60サイズ档位不等于必须用 27x21x12 的箱，
    # 三辺合計さえ収まれば小さい箱でよい。这里的 capacity 是档位上限而非实际箱体，
    # 拿它算充填率会把「小件用小箱」误判成「箱が過大」。故仅在档位是被大件顶上去时提示人工确认。
    mf = fs.get("min_fill_ratio")
    if mf is not None and box_capacity and box_volume is not None:
        if box_volume < mf * box_capacity - 1e-9:
            warnings.append("充填率%.0f%%（%s要求 隙間が箱の半分未満）：発送時は中身に見合う箱を使うこと，"
                            "大件で箱型が上がっている場合は事前確認推奨"
                            % (box_volume / box_capacity * 100, store_name))

    # target_only：非対象商品混入
    if fs.get("target_only"):
        tf = R.target_flags(items, fs)
        strays = [it["name"] for it, ok in zip(items, tf) if not ok]
        if strays:
            blockers.append("非対象商品が混在（%s）" % "、".join(s[:16] for s in strays[:3]))

    if not blockers:
        return dict(free=True, cost=0, label="着払いの条件を満たすため送料無料",
                    blockers=[], warnings=warnings)

    unmet = fs.get("unmet") or {"type": "actual"}
    cost = unmet["amount"] if unmet["type"] == "fixed" else fee
    lack = [b for b in blockers if b.startswith("あと")]
    if lack:
        label = "と".join(b[2:] for b in lack)
        label = "あと" + label + "で送料無料"
        other = [b for b in blockers if not b.startswith("あと")]
        if other:
            label += "（ただし " + "／".join(other) + "）"
    else:
        label = "着払い条件を満たさない：" + "／".join(blockers)
    return dict(free=False, cost=cost, label=label, blockers=blockers, warnings=warnings)


# ---------------------------------------------------------------- 规则渲染（报告用）

def _describe_cond(node, top=True):
    if "any_of" in node:
        txt = "または".join(_describe_cond(c, False) for c in node["any_of"])
        return txt if (top and len(node["any_of"]) == 1) else "（%s）" % txt
    if "all_of" in node:
        txt = "かつ".join(_describe_cond(c, False) for c in node["all_of"])
        return txt if top else "（%s）" % txt
    if "amount" in node:
        return "買取金額≥{:,}円".format(node["amount"]["min"])
    if "count" in node:
        c = node["count"]
        what = "／".join(c.get("categories") or c.get("include_name_patterns") or [])
        unit = "台" if (c.get("categories") and "スマホ" in c["categories"]) else "点"
        ex = "（%s除く）" % "／".join(c["exclude_name_patterns"]) if c.get("exclude_name_patterns") else ""
        return "%s%d%s以上%s" % (what + " " if what else "", c["min"], unit, ex)
    if "weighted_count" in node:
        return "換算点数≥%g" % node["weighted_count"]["min"]
    return "（無条件）"


def describe_free_ship(rules, store_name):
    """把某店的免邮规则渲染成一行文字（写进报告/Excel 假设表，避免手抄规则）。"""
    fs = R.free_ship_of(rules, store_name)
    kind = fs["kind"]
    if kind == R.KIND_ALWAYS:
        return "無条件で着払いOK"
    if kind == R.KIND_NEVER:
        return "元払い（着払い対応なし、送料自己負担）"
    if kind == R.KIND_UNKNOWN:
        return "送料条件未確認（保守的に自己負担で計算）"
    if kind == R.KIND_PICKUP:
        return "店頭買取のみ（郵送不可、最適化に参加させない）"
    parts = ["かつ".join(_describe_cond(c) for c in fs["all_of"])]
    if fs.get("max_size"):
        parts.append("≤%dサイズ" % fs["max_size"])
    if fs.get("carriers"):
        parts.append("/".join(fs["carriers"]) + "限定")
    if fs.get("target_only"):
        parts.append("対象商品のみ（非対象商品は同梱不可）")
    if fs.get("min_fill_ratio"):
        parts.append("箱が過大（隙間が箱の%.0f%%以上）は対象外" % (fs["min_fill_ratio"] * 100))
    txt = "かつ".join(parts) + " → 着払い（送料無料）"
    if fs.get("multi_box"):
        txt += "｜複数個口: " + fs["multi_box"]
    if fs.get("extra_conditions"):
        txt += "｜その他: " + fs["extra_conditions"]
    return txt


def tariff_line(rules, store=None):
    """该店（省略则默认目的地）的各档运费一行。"""
    return "　".join("%d→%s" % (sz, "{:,}".format(fee)) for (sz, _c, fee) in R.tiers(rules, store))


def profile_line(rules):
    """寄件口径（boxes.profile）的人类可读一行。"""
    pf = rules["boxes"].get("profile") or {}
    pay = {"cash": "現金", "cashless": "キャッシュレス", "member10": "クロネコメンバー割10%",
           "nyanpay12": "にゃんPay 12%", "big15": "メンバー割BIG 15%"}.get(pf.get("payment"), pf.get("payment"))
    drop = {"depot": "営業所持込", "conveni": "コンビニ/取扱店/PUDO", "pickup": "自宅集荷"}.get(pf.get("drop_off"))
    return "発地%s／既定着地%s%s／%s／%s／%s／営業所受取%s" % (
        pf.get("origin_region"), pf.get("default_dest_region"),
        "（同一都道府県）" if pf.get("default_same_prefecture") else "",
        pay, "デジタル送り状" if pf.get("digital_invoice") else "手書き",
        drop, "利用" if pf.get("depot_receive") else "不使用")


def capacity_line(rules):
    return "　".join("%d→%g" % (t["size"], t["capacity_l"]) for t in rules["boxes"]["tiers"])


# ---------------------------------------------------------------- 手数料 / 奨励金

def transfer_fee(rules, store_name, amount):
    """振込手数料（随金额递减的阶梯）。未配置则 0。"""
    tf = R.store(rules, store_name).get("transfer_fee")
    if not tf:
        return 0
    fee = tf["default"]
    for t in tf.get("tiers") or []:
        if amount >= t["amount_at_least"]:
            fee = t["fee"]
    return fee


def incentive(rules, store_name, amount):
    """買取奨励金（每满 step 加 amount，封顶 max_steps）。未配置则 0。"""
    inc = R.store(rules, store_name).get("incentive")
    if not inc:
        return 0
    steps = min(int(amount // inc["step"]), inc["max_steps"])
    return steps * inc["amount"]


# ---------------------------------------------------------------- 营业日

def _in_range(day, rng):
    return rng["from"] <= day <= rng["to"]


WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def availability(rules, store_name, day):
    """day: 'YYYY-MM-DD'。返回 dict(open, reasons) —— 仅作提示，不自动排除店铺。

    休業判定不直接改变最优化（是否剔除由当日 runner 决定，因为「休業中でも
    予約して再開日到着指定で発送」这种操作是可行的），只负责把事实摆出来。
    """
    st = R.store(rules, store_name)
    reasons = []
    for rng in st.get("holidays") or []:
        if _in_range(day, rng):
            reasons.append("休業 %s〜%s%s" % (rng["from"], rng["to"],
                                             "（%s）" % rng["note"] if rng.get("note") else ""))
    import datetime
    wd = WEEKDAYS[datetime.date(*map(int, day.split("-"))).weekday()]
    if wd in (st.get("weekly_closed") or []):
        reasons.append("%s定休" % {"sun": "日曜", "sat": "土曜"}.get(wd, wd))
    return dict(open=not reasons, reasons=reasons)
