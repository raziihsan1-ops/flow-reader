# Flow Reader's icon: a cyan tile with a white page; one line on the page is highlighted yellow.
# Makes the web-app icons (iPhone / browser) and the Android launcher icons and splash screens.
# Run: python3 tools/make-icons.py
import os, glob
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), '..')
RES = os.path.join(ROOT, 'android/app/src/main/res')
WEB = os.path.join(ROOT, 'public/icons')
os.makedirs(WEB, exist_ok=True)
S = 4  # draw big, then shrink, for smooth edges

def gradient(n):
    top, bottom = (79, 195, 217), (30, 79, 138)
    img = Image.new('RGB', (n, n))
    d = ImageDraw.Draw(img)
    for y in range(n):
        for_t = y / (n - 1)
        c = tuple(int(top[i] + (bottom[i] - top[i]) * for_t) for i in range(3))
        d.line([(0, y), (n, y)], fill=c)
    return img

def page(d, n, cx, cy, w):
    # a white page with text lines, one highlighted
    h = w * 1.25
    x0, y0 = cx - w / 2, cy - h / 2
    d.rounded_rectangle([x0, y0, x0 + w, y0 + h], radius=w * 0.1, fill=(255, 255, 255))
    lx, lw = x0 + w * 0.17, w * 0.66
    rows = [0.22, 0.36, 0.50, 0.64, 0.78]
    for i, r in enumerate(rows):
        y = y0 + h * r
        width = lw * (0.62 if i == len(rows) - 1 else 1)
        if i == 2:
            d.rounded_rectangle([lx - w * 0.05, y - h * 0.055, lx + width + w * 0.05, y + h * 0.055], radius=w * 0.03, fill=(255, 227, 92))
        d.rounded_rectangle([lx, y - h * 0.018, lx + width, y + h * 0.018], radius=h * 0.018, fill=(36, 52, 72) if i == 2 else (176, 190, 204))

def tile(n, shape='square', page_scale=0.5, full=False):
    big = n * S
    img = gradient(big).convert('RGBA')
    d = ImageDraw.Draw(img)
    page(d, big, big / 2, big / 2, big * page_scale)
    if not full:
        mask = Image.new('L', (big, big), 0)
        md = ImageDraw.Draw(mask)
        if shape == 'circle': md.ellipse([0, 0, big - 1, big - 1], fill=255)
        else: md.rounded_rectangle([0, 0, big - 1, big - 1], radius=big * 0.22, fill=255)
        img.putalpha(mask)
    return img.resize((n, n), Image.LANCZOS)

def foreground(n):
    big = n * S
    img = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    page(ImageDraw.Draw(img), big, big / 2, big / 2, big * 0.36)
    return img.resize((n, n), Image.LANCZOS)

# Web / iPhone
tile(192, full=False).save(os.path.join(WEB, 'icon-192.png'))
tile(512, full=False).save(os.path.join(WEB, 'icon-512.png'))
tile(512, page_scale=0.4, full=True).save(os.path.join(WEB, 'icon-maskable-512.png'))
tile(180, full=True).convert('RGB').save(os.path.join(WEB, 'apple-touch-icon.png'))

# Android launcher
for dens, legacy in {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}.items():
    folder = os.path.join(RES, f'mipmap-{dens}')
    tile(legacy).save(os.path.join(folder, 'ic_launcher.png'))
    tile(legacy, shape='circle').save(os.path.join(folder, 'ic_launcher_round.png'))
    fg = int(legacy * 108 / 48)
    foreground(fg).save(os.path.join(folder, 'ic_launcher_foreground.png'))
    gradient(fg).save(os.path.join(folder, 'ic_launcher_background.png'))
for name in ('ic_launcher.xml', 'ic_launcher_round.xml'):
    with open(os.path.join(RES, 'mipmap-anydpi-v26', name), 'w') as f:
        f.write('<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@mipmap/ic_launcher_background"/>\n    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n</adaptive-icon>\n')

# Splash screens: Flow's dark background with the icon in the middle
for p in glob.glob(os.path.join(RES, 'drawable*/splash.png')):
    w, h = Image.open(p).size
    img = Image.new('RGB', (w, h), (11, 13, 16))
    n = int(min(w, h) * 0.22)
    t = tile(n)
    img.paste(t, ((w - n) // 2, (h - n) // 2), t)
    img.save(p)
print('icons done')
