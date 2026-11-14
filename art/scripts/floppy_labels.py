# Builds the blank floppy label atlas: 3x2 cells, row-major from the top-left,
# cell i = click_project_0i (layout in docs/scene-contract.md). Titles are drawn at runtime.
# Run from the repo root: python3 art/scripts/floppy_labels.py
import random
from PIL import Image, ImageDraw, ImageFilter

# Win98 teal, amber, LEGO pink, walnut, sage, slate: one band colour per disk.
BANDS = ["#1d7f7f", "#c8862f", "#e48aa6", "#6b4128", "#7d9367", "#4d5f7a"]
CELL_W, CELL_H = 512, 384


def label(band, rng):
    img = Image.new("RGB", (CELL_W, CELL_H), "#e9dfc8")
    d = ImageDraw.Draw(img)
    for _ in range(900):  # paper fibre and age speckle
        x, y = rng.randrange(CELL_W), rng.randrange(CELL_H)
        t = rng.randint(-14, 8)
        d.point((x, y), fill=(233 + t, 223 + t, 200 + t))
    d.rectangle((0, 0, CELL_W, 70), fill=band)
    for y in range(150, CELL_H - 20, 52):  # ruled lines
        d.line((22, y, CELL_W - 22, y), fill="#b9c6d6", width=2)
    return img.filter(ImageFilter.GaussianBlur(0.6))


rng = random.Random(7)
atlas = Image.new("RGB", (CELL_W * 3, CELL_H * 2))
for i, band in enumerate(BANDS):
    atlas.paste(label(band, rng), ((i % 3) * CELL_W, (i // 3) * CELL_H))
atlas.save("art/textures/floppy_labels.png")
print("art/textures/floppy_labels.png", atlas.size)
