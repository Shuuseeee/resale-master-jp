# -*- coding: utf-8 -*-
"""ヤマト宅急便 割引後運賃の計算器。

官网割引シミュレータ（`ytc/search/payment/simulation_files/js/result_01.min.js` 的 TK 分支）
的逐行移植，费率表来自同目录的 TK.json / DT.json（本地快照：yamato_tariff_20260827.json）。

要点（这几条是 2026-08-26 那次算错运费的根因）：
  * 折扣打在**税抜**基础运赁上，再乘 1.1，最后四舍五入到 1 円——不是先算税込再打折。
  * `発着が同一都道府県内` 用的是**另一张表**（DT），比同区域跨県的 TK 便宜一大截。
  * デジタル割 -60 / 持込割 -150（会员+デジタル送り状时；否则 -100）/ 営業所受取 -60
    都是在打完百分比折扣**之后**减的固定额。
"""
import json
import os

_HERE = os.path.dirname(os.path.abspath(__file__))
TARIFF_FILE = os.path.join(_HERE, "yamato_tariff_20260827.json")
TAX = 1.1
DIGITAL_DISCOUNT = 60      # デジタル割
DEPOT_PICKUP_MEMBER = 150  # 営業所持込（クロネコメンバーズ＋デジタル送り状）
DEPOT_PICKUP_PLAIN = 100   # 営業所持込（それ以外）／コンビニ・取扱店・PUDO
DEPOT_RECEIVE = 60         # 営業所受け取りサービス

# 支払方法 → 税抜運賃に対する割引率。None = 割引なし（現金は10円切上げ、キャッシュレスは切上げなし）
PAYMENTS = {
    "cash":      None,   # 現金
    "cashless":  None,   # QR/クレカ/電子マネー/オンライン決済
    "member10":  0.10,   # クロネコメンバー割
    "nyanpay12": 0.12,   # にゃんPay
    "big15":     0.15,   # クロネコメンバー割BIG
}

_cache = None


def load(path=TARIFF_FILE):
    global _cache
    if _cache is None:
        with open(path, encoding="utf-8") as fh:
            _cache = json.load(fh)
    return _cache


def base_fare(size, origin="関東", dest="関東", same_prefecture=False, tariff=None):
    """税抜の基礎運賃。same_prefecture=True なら DT 表（発着同一都道府県内）。"""
    t = tariff or load()
    if same_prefecture:
        return t["DT"][str(size)]
    return t["TK"][origin][dest][str(size)]


def fare(size, origin="関東", dest="関東", same_prefecture=False,
         payment="member10", member=True, digital_invoice=True,
         drop_off="depot", depot_receive=False, tariff=None):
    """割引後の支払額（税込・円）。

    payment       : PAYMENTS のキー
    member        : クロネコメンバーズか
    digital_invoice: デジタル送り状（スマホで送る／アプリ事前予約／ネコピット）。False は手書き
    drop_off      : "depot"(営業所) / "conveni"(コンビニ・取扱店・PUDO) / "pickup"(自宅集荷)
    depot_receive : 営業所受け取りサービスを使うか
    """
    if payment not in PAYMENTS:
        raise ValueError("unknown payment: %s" % payment)
    r = base_fare(size, origin, dest, same_prefecture, tariff)

    rate = PAYMENTS[payment]
    if rate is not None:
        amount = round((r - round(rate * r)) * TAX)
    elif payment == "cash":
        n = round(r * TAX)
        amount = 10 * -(-n // 10)          # 10円切上げ
    else:                                   # cashless
        amount = round(r * TAX)

    if digital_invoice:
        amount -= DIGITAL_DISCOUNT
    if drop_off == "conveni":
        amount -= DEPOT_PICKUP_PLAIN
    elif drop_off == "depot":
        amount -= DEPOT_PICKUP_MEMBER if (member and digital_invoice) else DEPOT_PICKUP_PLAIN
    elif drop_off != "pickup":
        raise ValueError("unknown drop_off: %s" % drop_off)
    if depot_receive:
        amount -= DEPOT_RECEIVE
    return amount


def fare_table(sizes=(60, 80, 100, 120, 140, 160), **kw):
    return {s: fare(s, **kw) for s in sizes}


if __name__ == "__main__":
    for tag, kw in (("東京→東京(同一都道府県) にゃんPay", dict(same_prefecture=True, payment="nyanpay12")),
                    ("東京→東京(同一都道府県) メンバー割", dict(same_prefecture=True, payment="member10")),
                    ("関東→関東 にゃんPay", dict(payment="nyanpay12")),
                    ("関東→関東 メンバー割", dict(payment="member10"))):
        t = fare_table(**kw)
        print("%-32s %s" % (tag, "　".join("%d→%s" % (s, "{:,}".format(v)) for s, v in t.items())))
