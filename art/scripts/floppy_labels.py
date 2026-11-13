# Builds the floppy label atlas (3x2 cells, left-to-right = click_project_01..06).
# Run from the repo root: python3 art/scripts/floppy_labels.py
import random
from PIL import Image, ImageDraw, ImageFilter, ImageFont

LABELS = [
    ("01", "CI360 TEST AGENT", "SAS · 2026"),
    ("02", "COE EVENT LOG", "NCSU · LARAVEL/VUE"),
    ("03", "TRISH98", "THIS PORTFOLIO"),
    ("04", "EWB GUATEMALA", "WATER PROJECT · 2025"),
    ("05", "WiCS", "MENTEE · 2024-"),
    ("06", "RESUME.TXT", "READ ME FIRST"),
]
# Win98 teal, amber, LEGO pink, walnut, sage, slate: one band colour per disk.
BANDS = ["#1d7f7f", "#c8862f", "#e48aa6", "#6b4128", "#7d9367", "#4d5f7a"]
CELL_W, CELL_H = 512, 384
FONT = "public/fonts/departure-mono-regular.woff2"


def label(num, title, sub, band, rng):
    img = Image.new("RGB", (CELL_W, CELL_H), "#e9dfc8")
    d = ImageDraw.Draw(img)
    for _ in range(900):  # paper fibre and age speckle
        x, y = rng.randrange(CELL_W), rng.randrange(CELL_H)
        t = rng.randint(-14, 8)
        d.point((x, y), fill=(233 + t, 223 + t, 200 + t))
    d.rectangle((0, 0, CELL_W, 70), fill=band)
    d.text((24, 12), num, font=ImageFont.truetype(FONT, 46), fill="#f4ecd8")
    d.text((CELL_W - 150, 26), "3.5\" HD", font=ImageFont.truetype(FONT, 26), fill="#f4ecd8")
    for y in range(150, CELL_H - 20, 52):  # ruled lines
        d.line((22, y, CELL_W - 22, y), fill="#b9c6d6", width=2)
    size = 56 if len(title) <= 12 else 42
    d.text((26, 92), title, font=ImageFont.truetype(FONT, size), fill="#262230")
    d.text((26, 214), sub, font=ImageFont.truetype(FONT, 30), fill="#4a4250")
    return img.filter(ImageFilter.GaussianBlur(0.6))


rng = random.Random(7)
atlas = Image.new("RGB", (CELL_W * 3, CELL_H * 2))
for i, (num, title, sub) in enumerate(LABELS):
    atlas.paste(label(num, title, sub, BANDS[i], rng), ((i % 3) * CELL_W, (i // 3) * CELL_H))
atlas.save("art/textures/floppy_labels.png")
print("art/textures/floppy_labels.png", atlas.size)
