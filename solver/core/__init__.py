# -*- coding: utf-8 -*-
"""ResaleAssist 分销计算核心。

    from core import rules, shipping, solver, baselines

    rules      规则唯一真源（rules.json）的加载/校验/商品匹配
    shipping   规则求值器：免邮判定、日语不足額文案、手数料/奨励金、箱型选择
    solver     规则 → MILP 编译与全局求解
    baselines  贪心 / 子集枚举两条对照基线 + 三方不等式自检
"""
from . import rules, shipping, solver, baselines  # noqa: F401

__all__ = ["rules", "shipping", "solver", "baselines"]
