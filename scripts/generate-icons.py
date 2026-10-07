#!/usr/bin/env python3
"""由 assets/branding/app-icon.png（带透明圆角的黑色方块，1254×1254）生成全部应用图标。

用法：python3 scripts/generate-icons.py        （需要 Pillow）
输出：
  public/icons/app-icon-{192,512}.png            purpose=any，保留透明圆角
  public/icons/app-icon-maskable-{192,512}.png   purpose=maskable，满铺 + 内容缩到 80% 留安全边距
  public/icons/apple-touch-icon.png              180×180，满铺不透明（iOS 自己加圆角）
  public/favicon.ico                             16 / 32 / 48
换图时只替换 assets/branding/app-icon.png 再运行本脚本。新图标文件名带版本，
因为 Service Worker 对 /icons/ 是 CacheFirst 30 天，覆盖同名文件旧设备会一直用旧图。
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets' / 'branding' / 'app-icon.png'
ICONS = ROOT / 'public' / 'icons'
ICONS.mkdir(parents=True, exist_ok=True)

master = Image.open(SRC).convert('RGBA')
BLACK = master.getpixel((master.width // 2, master.height // 2))[:3] + (255,)


def full_bleed(size: int) -> Image.Image:
    """黑底铺满的方形（把透明圆角填成黑色）"""
    canvas = Image.new('RGBA', master.size, BLACK)
    canvas.alpha_composite(master)
    return canvas.resize((size, size), Image.LANCZOS)


def maskable(size: int, scale: float = 0.8) -> Image.Image:
    base = full_bleed(size)
    inner = int(size * scale)
    canvas = Image.new('RGBA', (size, size), BLACK)
    canvas.alpha_composite(base.resize((inner, inner), Image.LANCZOS), ((size - inner) // 2, (size - inner) // 2))
    return canvas


for size in (192, 512):
    master.resize((size, size), Image.LANCZOS).save(ICONS / f'app-icon-{size}.png', optimize=True)
    maskable(size).save(ICONS / f'app-icon-maskable-{size}.png', optimize=True)

full_bleed(180).convert('RGB').save(ICONS / 'apple-touch-icon.png', optimize=True)

master.resize((256, 256), Image.LANCZOS).save(
    ROOT / 'public' / 'favicon.ico', format='ICO', sizes=[(16, 16), (32, 32), (48, 48)]
)
print('done')
