#!/usr/bin/env python3
"""由 assets/branding/app-icon.png（带透明圆角的黑色方块 + 白色「買取」，1254×1254）生成全部应用图标。

配色取自 Microsoft Loop 官方图标（loop-logo.svg）：左上深紫 #6D05E8、右上紫 #9237E3、下方青 #48E6F3，左下最亮的青 #51E6FF。
两种用法（2026-10-11 用户决定）：
  · 图标（主屏幕 / favicon / MCP）：渐变底 + 白字——小尺寸也醒目
  · 品牌标志（左上角、登录页）：透明底，字本身填渐变——大尺寸更精致

用法：python3 scripts/generate-icons.py        （需要 Pillow）
输出：
  public/icons/v2/app-icon-{192,512}.png            purpose=any，保留透明圆角
  public/icons/v2/app-icon-maskable-{192,512}.png   purpose=maskable，满铺 + 字缩到 80% 留安全边距
  public/icons/v2/apple-touch-icon.png              180×180，满铺不透明（iOS 自己加圆角）
  public/icons/v2/brand-mark.png                    品牌标志：透明底渐变字，按字形原比例裁切
  public/favicon.ico                                16 / 32 / 48
  assets/branding/app-icon-1024.png                 给原生 App（Xcode AppIcon）：1024 满铺不透明、无圆角
换图或换色时改这里再运行。**输出目录带版本（ICON_VERSION），换图时 +1 并同步 lib/brand-icons.ts**：
Service Worker 对 /icons/ 是 CacheFirst 30 天，覆盖同名文件旧设备会一直用旧图。
"""
import math
from pathlib import Path
from PIL import Image, ImageChops

ICON_VERSION = 'v2'
ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets' / 'branding' / 'app-icon.png'
ICONS = ROOT / 'public' / 'icons' / ICON_VERSION
ICONS.mkdir(parents=True, exist_ok=True)

master = Image.open(SRC).convert('RGBA')
W = master.width
SHAPE = master.getchannel('A')                                        # 圆角外形
# 白字（保留抗锯齿边缘）。原图的黑底不是纯黑，先把亮度压到 64–192 之间再拉满，否则满铺版本会透出一圈圆角方块的影子
GLYPH = ImageChops.multiply(master.convert('L').point(lambda v: max(0, min(255, (v - 64) * 2))), SHAPE)

# ---- Loop 配色的渐变（在 512 坐标里逐像素算，再放大；渐变平滑，放大无损） ----
N = 512


def _hex(h: str):
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def _linear(p1, p2, c1, c2) -> Image.Image:
    img = Image.new('RGBA', (N, N))
    px = img.load()
    dx, dy = p2[0] - p1[0], p2[1] - p1[1]
    l2 = dx * dx + dy * dy
    for y in range(N):
        for x in range(N):
            t = max(0.0, min(1.0, ((x - p1[0]) * dx + (y - p1[1]) * dy) / l2))
            px[x, y] = tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3)) + (255,)
    return img


def _radial(c, rx, ry, col, a0) -> Image.Image:
    img = Image.new('RGBA', (N, N))
    px = img.load()
    for y in range(N):
        for x in range(N):
            t = min(1.0, math.hypot((x - c[0]) / rx, (y - c[1]) / ry))
            px[x, y] = col + (int(255 * a0 * (1 - t)),)
    return img


GRADIENT = _linear((400, 0), (230, 512), _hex('9237e3'), _hex('48e6f3'))
GRADIENT.alpha_composite(_radial((0, 150), 260, 380, _hex('6d05e8'), 1))
GRADIENT.alpha_composite(_radial((150, 520), 280, 220, _hex('51e6ff'), 0.85))
WHITE = Image.new('RGBA', (W, W), (255, 255, 255, 255))


def full_bleed(size: int, glyph_scale: float = 1.0) -> Image.Image:
    """渐变铺满的方形 + 白字；glyph_scale < 1 时字整体缩小居中（maskable 安全区）"""
    canvas = GRADIENT.resize((W, W), Image.LANCZOS)
    if glyph_scale == 1.0:
        canvas.paste(WHITE, (0, 0), GLYPH)
    else:
        inner = int(W * glyph_scale)
        g = GLYPH.resize((inner, inner), Image.LANCZOS)
        off = (W - inner) // 2
        canvas.paste(Image.new('RGBA', (inner, inner), (255, 255, 255, 255)), (off, off), g)
    return canvas.resize((size, size), Image.LANCZOS)


def rounded(size: int) -> Image.Image:
    sq = full_bleed(W)
    out = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    out.paste(sq, (0, 0), SHAPE)
    return out.resize((size, size), Image.LANCZOS)


def brand_mark(height: int) -> Image.Image:
    """透明底、字本身填渐变；按字形外框裁切，渐变铺满整个字"""
    bbox = GLYPH.point(lambda v: 255 if v > 32 else 0).getbbox()
    g = GLYPH.crop(bbox)
    w = round(g.width * height / g.height)
    g = g.resize((w, height), Image.LANCZOS)
    out = Image.new('RGBA', (w, height), (0, 0, 0, 0))
    out.paste(GRADIENT.resize((w, height), Image.LANCZOS), (0, 0), g)
    return out


for size in (192, 512):
    rounded(size).save(ICONS / f'app-icon-{size}.png', optimize=True)
    full_bleed(size, 0.8).convert('RGB').save(ICONS / f'app-icon-maskable-{size}.png', optimize=True)

full_bleed(180).convert('RGB').save(ICONS / 'apple-touch-icon.png', optimize=True)
brand_mark(160).save(ICONS / 'brand-mark.png', optimize=True)
rounded(256).save(ROOT / 'public' / 'favicon.ico', format='ICO', sizes=[(16, 16), (32, 32), (48, 48)])
full_bleed(1024).convert('RGB').save(ROOT / 'assets' / 'branding' / 'app-icon-1024.png', optimize=True)
print('done')
