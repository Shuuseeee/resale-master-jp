# -*- coding: utf-8 -*-
"""core 的场景测试：专测 0815 真实数据没覆盖到的规则分支。

    python3 core/tests.py

这些分支（スマホ3台/target_only/min_fill_ratio/transfer_fee/unmet fixed）平时不触发，
一旦哪天进了手机或宝可梦卡就会突然生效——没有测试就等于没有建模。
"""
import copy
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")))

from core import rules as R, shipping as S, baselines as B   # noqa: E402
from core.solver import solve                                # noqa: E402

FAILED = []


def check(name, got, want):
    if got == want:
        print("  PASS  %-52s %s" % (name, got))
    else:
        print("  FAIL  %-52s got=%r want=%r" % (name, got, want))
        FAILED.append(name)


def item(tid, name, price_map, qty=1, vol=0.3, mint=60, cat=None):
    it = dict(tid=tid, name=name, jan="0" * 13, qty=qty, qty_full=qty, qty_sold=0,
              total=0, cp=0, pp=0, ex=0, vol=vol, mint=mint,
              prices={s: (p, 0) for s, p in price_map.items()})
    if cat:
        it["cat"] = cat
    return it


BASE = R.load()


def with_store(name, patch):
    """复制一份规则，改某店的配置（不污染全局缓存）。"""
    r = copy.deepcopy(BASE)
    r["stores"][name].update(patch)
    R.validate(r)
    return r


# ---------------------------------------------------------------- 1. スマホ3台分支
print("\n[1] 買取商店「5点以上 или スマホ3台以上」的 OR 分支（旧 FREE_SHIP=(5,100000) 表达不了）")
phones = [item("P%d" % i, "iPhone 16 Pro 256GB", {"買取商店": 40000, "PANDA買取": 39000},
               cat="スマホ", vol=0.5) for i in range(1, 4)]
sol = solve(phones, ["買取商店", "PANDA買取"], BASE)
b = sol["boxes"]["買取商店"]
check("3台スマホ・12万円 → 免邮成立", (b["qty"], b["amount"], b["free"]), (3, 120000, True))
check("免邮判定文案", b["label"], "着払いの条件を満たすため送料無料")

# 同样 3 台但没写 cat → 分支不成立，退回自付
nocat = [item("P%d" % i, "iPhone 16 Pro 256GB", {"買取商店": 40000, "PANDA買取": 39000}, vol=0.5)
         for i in range(1, 4)]
sol2 = solve(nocat, ["買取商店", "PANDA買取"], BASE)
b2 = sol2["boxes"]["買取商店"]
check("同样3台但漏写 cat → 不免邮（category_warnings 会提示）", b2["free"], False)
check("category_warnings 有提示", len(R.category_warnings(BASE, nocat, ["買取商店"])) > 0, True)

# 件数不足且金额不足时的日语不足額文案
few = [item("A1", "ゲームソフト", {"買取商店": 3000})]
ev = S.evaluate(BASE, "買取商店", few, 3000, box_size=60, box_capacity=6.8, box_volume=0.3, box_fee=640)
check("不足額文案（件数と金額の両方）", ev["label"], "あと4点か3台と97,000円で送料無料")

# ---------------------------------------------------------------- 2. min_fill_ratio
print("\n[2] 買取商店「箱が過大だと対象外（隙間が箱の半分以上NG）」→ 告警而非否决")
# 5 点 12 万円但其中一件必须 140サイズ，总体积仅 5L → 140箱容量 99L，充填率 5%
bulky = [item("B1", "大型商品", {"買取商店": 116000}, vol=4.0, mint=140)] + \
        [item("B%d" % i, "小物", {"買取商店": 1000}, vol=0.25) for i in range(2, 6)]
sol = solve(bulky, ["買取商店"], BASE)
b = sol["boxes"]["買取商店"]
check("条件满足 → 免邮成立（箱型由大件顶上去，不算箱が過大）", (b["tier"], b["free"]), (140, True))
check("但必须给出充填率告警", any("充填率" in x for x in b["warnings"]), True)

# ---------------------------------------------------------------- 3. 買取ホムラ target_only
print("\n[3] 買取ホムラ 着払いキャンペーン：非対象商品混入则不适用")
homura_only = [item("H%d" % i, "iPhone 17 Pro", {"買取ホムラ": 100000}, cat="スマホ", vol=0.5)
               for i in range(1, 4)]
sol = solve(homura_only, ["買取ホムラ"], BASE)
check("iPhone17 x3 単独 → 免邮成立", sol["boxes"]["買取ホムラ"]["free"], True)

mixed = homura_only + [item("H9", "AirPods Pro 3", {"買取ホムラ": 20000}, vol=0.3)]
sol = solve(mixed, ["買取ホムラ"], BASE)
b = sol["boxes"]["買取ホムラ"]
check("混入 AirPods（唯一去处）→ 整箱不免邮", b["free"], False)
check("阻塞原因写明非対象商品混在", any("非対象商品" in x for x in b["blockers"]), True)

# 有第二个去处时，MILP 应把非対象商品挪走以保住免邮
# iPhone 体积大 → 混装时 ホムラ 要 100サイズ；挪走后 ホムラ 免邮0 + PANDA 60サイズ
# 费率从 rules 现算（各店収货地可能不同），不要硬编码——profile 一改就会失配
FEE = lambda store, size: next(f for (sz, _c, f) in R.tiers(BASE, store) if sz == size)
big_phones = [item("H%d" % i, "iPhone 17 Pro", {"買取ホムラ": 100000, "PANDA買取": 99000},
                   cat="スマホ", vol=8.0) for i in range(1, 4)]
mixed2 = big_phones + [item("H9", "AirPods Pro 3", {"買取ホムラ": 20000, "PANDA買取": 20000}, vol=0.3)]
sol = solve(mixed2, ["買取ホムラ", "PANDA買取"], BASE)
moved = "H9" in [r["item"]["tid"] for r in sol["boxes"].get("PANDA買取", {"rows": []})["rows"]]
check("有替代去处 → 非対象商品被挪走，ホムラ保住免邮",
      (sol["boxes"]["買取ホムラ"]["free"], moved), (True, True))
check("挪走后总净回款更高（ホムラ100サイズ%d → PANDA60サイズ%d）"
      % (FEE("買取ホムラ", 100), FEE("PANDA買取", 60)),
      sol["total"]["net"], 320000 - FEE("PANDA買取", 60))

# ---------------------------------------------------------------- 4. transfer_fee 阶梯
print("\n[4] 振込手数料阶梯（rules.json 目前无店配置，走合成规则测代码路径）")
r_tf = with_store("PANDA買取", {"transfer_fee": {"default": 660,
                                                 "tiers": [{"amount_at_least": 30000, "fee": 330},
                                                           {"amount_at_least": 50000, "fee": 0}]}})
check("求值器 2万円 → 660", S.transfer_fee(r_tf, "PANDA買取", 20000), 660)
check("求值器 3万円 → 330", S.transfer_fee(r_tf, "PANDA買取", 30000), 330)
check("求值器 6万円 → 0", S.transfer_fee(r_tf, "PANDA買取", 60000), 0)
one = [item("F1", "商品", {"PANDA買取": 35000})]
sol = solve(one, ["PANDA買取"], r_tf)
check("MILP 扣手数料 330 且净回款自洽",
      (sol["boxes"]["PANDA買取"]["transfer_fee"], sol["total"]["net"]),
      (330, 35000 - FEE("PANDA買取", 60) - 330))

# ---------------------------------------------------------------- 5. unmet fixed
print("\n[5] unmet.type=fixed（未达条件时收固定额，而非实际箱型运费）")
r_fx = with_store("森森買取", {"free_ship": dict(BASE["stores"]["森森買取"]["free_ship"],
                                                unmet={"type": "fixed", "amount": 500})})
one = [item("X1", "商品", {"森森買取": 20000})]
sol = solve(one, ["森森買取"], r_fx)
check("未达门槛按固定 500 而非 60サイズ 640", sol["boxes"]["森森買取"]["ship"], 500)

# ---------------------------------------------------------------- 6. 買取奨励金
print("\n[6] モバイル一番 買取奨励金（每满10万 +120，封顶5段）")
check("求值器 25万 → 240", S.incentive(BASE, "モバイル一番", 250000), 240)
check("求值器 80万 → 封顶 600", S.incentive(BASE, "モバイル一番", 800000), 600)
big = [item("M%d" % i, "スマホ", {"モバイル一番": 42000, "PANDA買取": 41000}, cat="スマホ", vol=0.5)
       for i in range(1, 6)]
sol = solve(big, ["モバイル一番", "PANDA買取"], BASE)
b = sol["boxes"]["モバイル一番"]
check("21万円 → 免邮 + 奨励金240", (b["free"], b["incentive"], b["net"]), (True, 240, 210000 + 240))

# ---------------------------------------------------------------- 7. 让价换免邮（核心差异）
print("\n[7] 让价换免邮：MILP 必须优于 splitRank 的子集枚举")
# 高額品 G1 在 PANDA 多卖 500，但把它让给買取商店才能凑够 10万 触发免邮（省1,260）；
# G6 只有 PANDA 出得起价，所以 PANDA 无论如何都要开一箱 —— 子集枚举无法表达这种混合分配
mix = [item("G1", "高額品", {"買取商店": 96500, "PANDA買取": 97000}, vol=1.0)] + \
      [item("G%d" % i, "小物", {"買取商店": 1200, "PANDA買取": 1000}, vol=5.0) for i in range(2, 6)] + \
      [item("G6", "PANDA専売品", {"買取商店": 5000, "PANDA買取": 9000}, vol=0.2)]
milp = solve(mix, ["買取商店", "PANDA買取"], BASE)
sub = B.baseline_subset(mix, ["買取商店", "PANDA買取"], BASE)
gre = B.baseline_greedy(mix, ["買取商店", "PANDA買取"], BASE)
check("MILP 让出 500 円换免邮，净回款高于子集枚举", milp["total"]["net"] > sub["total"]["net"], True)
check("三方不等式 贪心≤子集≤MILP", B.verify(gre, sub, milp)[0], True)
print("        贪心 %s / 子集枚举 %s / MILP %s"
      % (gre["total"]["net"], sub["total"]["net"], milp["total"]["net"]))

# ---------------------------------------------------------------- 8. 全量分配与不可行
print("\n[8] 全量分配语义（splitRank 会静默丢货，这里必须报错）")
from core.solver import Infeasible                             # noqa: E402
orphan = [item("O1", "无人收货", {"不存在店": 5000})]
try:
    solve(orphan, ["不存在店"], BASE)
    check("无可用店铺应抛 Infeasible", False, True)
except Infeasible:
    check("无可用店铺抛 Infeasible", True, True)

# ---------------------------------------------------------------- 9. 校验器
print("\n[9] rules.json 形状校验")
for bad, why in [
    ({"kind": "conditional"}, "conditional 缺 all_of"),
    ({"kind": "conditional", "all_of": [{"count": {}}]}, "count 缺 min"),
    ({"kind": "conditional", "all_of": [{"count": {"min": 1}, "amount": {"min": 1}}]}, "叶子含两个键"),
    ({"kind": "妙", "all_of": []}, "非法 kind"),
]:
    r = copy.deepcopy(BASE)
    r["stores"]["森森買取"]["free_ship"] = bad
    try:
        R.validate(r)
        check("应拒绝：%s" % why, False, True)
    except ValueError:
        check("拒绝：%s" % why, True, True)

# ---------------------------------------------------------------- 9.5 per-store 収货地
print("\n[9.5] 各店収货地による運賃の違い（rules.tiers(rules, store)）")
_def = {sz: f for (sz, _c, f) in R.tiers(BASE)}
_eno = {sz: f for (sz, _c, f) in R.tiers(BASE, "買取エノキング")}
_pan = {sz: f for (sz, _c, f) in R.tiers(BASE, "PANDA買取")}
check("既定(関東→関東 にゃんPay) 160サイズ", _def[160], 2442)
check("エノキング(ship_dest 同一都道府県) 160サイズ", _eno[160], 1910)
check("ship_dest 無しの店は既定表", _pan, _def)
check("エノキングは全档位が既定より安い",
      all(_eno[sz] < _def[sz] for sz in _def), True)
_caps_def = [c for (_s, c, _f) in R.tiers(BASE)]
_caps_eno = [c for (_s, c, _f) in R.tiers(BASE, "買取エノキング")]
check("容量は store に依存しない", _caps_def, _caps_eno)

# ---------------------------------------------------------------- 10. 宅急便运费计算器
print("\n[10] core/yamato.py —— 与官网割引シミュレータ逐值对拍")
from core import yamato as Y                                   # noqa: E402

# 2026-08-27 在 kuronekoyamato.co.jp 的割引シミュレータ上实跑并读取 DOM 得到的值。
# 条件：クロネコメンバーズ=はい／発送場所=営業所／送り状=アプリで事前予約／
#       発着同一都道府県=はい／支払=にゃんPay／営業所受け取り=利用しない
SITE_SAME_NYANPAY = {60: 478, 80: 748, 100: 1029, 120: 1310, 140: 1629, 160: 1910}
for _sz, _want in SITE_SAME_NYANPAY.items():
    check("同一都道府県 にゃんPay %dサイズ" % _sz,
          Y.fare(_sz, same_prefecture=True, payment="nyanpay12"), _want)

# 官网表示的「基本料金合計」（税込・10円切上げ）
SITE_SAME_BASE = {60: 790, 80: 1090, 100: 1410, 120: 1730, 140: 2090, 160: 2410}
for _sz, _want in SITE_SAME_BASE.items():
    check("同一都道府県 基本料金合計 %dサイズ" % _sz,
          Y.fare(_sz, same_prefecture=True, payment="cash",
                 digital_invoice=False, drop_off="pickup"), _want)

# 関東→関東 の基本料金合計（result_01.html の上段テーブル表示値）
SITE_KANTO_BASE = {60: 940, 80: 1230, 100: 1530, 120: 2040, 140: 2630, 160: 3020}
for _sz, _want in SITE_KANTO_BASE.items():
    check("関東→関東 基本料金合計 %dサイズ" % _sz,
          Y.fare(_sz, payment="cash", digital_invoice=False, drop_off="pickup"), _want)

# 2026-08-26 の実支払（買取エノキング宛 160サイズ）= 1,910 円 を再現できること
check("2026-08-26 実支払の再現 160サイズ",
      Y.fare(160, same_prefecture=True, payment="nyanpay12"), 1910)

# 割引の単調性：BIG15% ≤ にゃんPay12% ≤ メンバー割10% ≤ キャッシュレス ≤ 現金
for _sz in (60, 120, 160):
    _f = lambda pm: Y.fare(_sz, same_prefecture=True, payment=pm)
    check("割引単調性 %dサイズ" % _sz,
          _f("big15") <= _f("nyanpay12") <= _f("member10") <= _f("cashless") <= _f("cash"), True)

# 同一都道府県は必ず 関東→関東 より安い
for _sz in (60, 80, 100, 120, 140, 160):
    check("同一都道府県 < 関東→関東 %dサイズ" % _sz,
          Y.fare(_sz, same_prefecture=True, payment="nyanpay12")
          < Y.fare(_sz, payment="nyanpay12"), True)

print("\n" + "=" * 74)
if FAILED:
    print("FAILED %d 项: %s" % (len(FAILED), FAILED))
    sys.exit(1)
print("全部通过")
