"""Draws the CV Studio app icon.

Writes assets/cv-studio.ico (Windows shortcut, all sizes) and
client/public/favicon.png (browser tab / in-app logo).
Usage: python scripts/make-icon.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
S = 1024  # drawing size; downscaled for each output


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))


def gradient(size, c0, c1):
    """Diagonal gradient from top-left (c0) to bottom-right (c1)."""
    g = Image.new('RGBA', (size, size))
    px = g.load()
    for y in range(size):
        for x in range(size):
            px[x, y] = lerp(c0, c1, (x + y) / (2 * size - 2)) + (255,)
    return g


def rounded_mask(size, box, radius):
    m = Image.new('L', (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle(box, radius=radius, fill=255)
    return m


def draw_icon():
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))

    # Tile: indigo -> violet, rounded, with a soft top highlight.
    tile = gradient(S, (79, 70, 229), (139, 92, 246))
    hl = Image.new('RGBA', (S, S), (255, 255, 255, 0))
    ImageDraw.Draw(hl).ellipse((-S * 0.3, -S * 0.75, S * 1.3, S * 0.45), fill=(255, 255, 255, 38))
    tile = Image.alpha_composite(tile, hl)
    img.paste(tile, (0, 0), rounded_mask(S, (24, 24, S - 24, S - 24), 230))

    # Page shadow.
    page = (262, 168, 762, 856)
    shadow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((page[0] + 10, page[1] + 30, page[2] + 10, page[3] + 30), radius=36, fill=(20, 14, 80, 120))
    img = Image.alpha_composite(img, shadow.filter(ImageFilter.GaussianBlur(28)))

    base = img.copy()  # tile + shadow, restored behind the folded corner
    d = ImageDraw.Draw(img)
    fold = 120
    x0, y0, x1, y1 = page
    d.rounded_rectangle(page, radius=36, fill=(255, 255, 255, 255))
    # Banner (CV header) clipped to the page, leaving the fold.
    banner = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    bd = ImageDraw.Draw(banner)
    bd.rounded_rectangle((x0, y0, x1, y0 + 230), radius=36, fill=(18, 22, 46, 255))
    bd.rectangle((x0, y0 + 120, x1, y0 + 230), fill=(18, 22, 46, 255))
    img = Image.alpha_composite(img, banner)
    corner = Image.new('L', (S, S), 0)
    ImageDraw.Draw(corner).polygon([(x1 - fold, y0 - 4), (x1 + 4, y0 - 4), (x1 + 4, y0 + fold)], fill=255)
    img.paste(base, (0, 0), corner)
    d = ImageDraw.Draw(img)
    # Fold flap.
    d.polygon([(x1 - fold, y0), (x1 - fold, y0 + fold - 18), (x1 - 18, y0 + fold)], fill=(196, 190, 255, 255))
    d.line([(x1 - fold, y0), (x1, y0 + fold)], fill=(160, 150, 250, 255), width=6)
    # Photo circle and name lines in the banner.
    d.ellipse((x0 + 44, y0 + 50, x0 + 174, y0 + 180), fill=(255, 255, 255, 255))
    d.ellipse((x0 + 58, y0 + 64, x0 + 160, y0 + 166), fill=(167, 160, 255, 255))
    d.rounded_rectangle((x0 + 200, y0 + 78, x0 + 380, y0 + 106), radius=14, fill=(255, 255, 255, 255))
    d.rounded_rectangle((x0 + 200, y0 + 128, x0 + 320, y0 + 150), radius=11, fill=(140, 132, 230, 255))
    # Section heading + text lines.
    y = y0 + 290
    for heading_w, lines in ((210, (380, 340, 360)), (170, (390, 300))):
        d.rounded_rectangle((x0 + 50, y, x0 + 50 + heading_w, y + 30), radius=15, fill=(91, 91, 240, 255))
        y += 58
        for w in lines:
            d.rounded_rectangle((x0 + 50, y, x0 + 50 + w, y + 20), radius=10, fill=(214, 217, 232, 255))
            y += 42
        y += 22
    return img


def main():
    icon = draw_icon()
    out_ico = ROOT / 'assets' / 'cv-studio.ico'
    out_ico.parent.mkdir(exist_ok=True)
    icon.save(out_ico, sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    fav = ROOT / 'client' / 'public' / 'favicon.png'
    fav.parent.mkdir(parents=True, exist_ok=True)
    icon.resize((128, 128), Image.LANCZOS).save(fav)
    icon.resize((512, 512), Image.LANCZOS).save(ROOT / 'assets' / 'cv-studio.png')
    print('wrote', out_ico, fav)


if __name__ == '__main__':
    main()
