"""Перекладені версії креслень: стираємо український рядок фоном і пишемо переклад тим самим кольором і висотою.
python3 render_tr.py <scratch> <public_dir> <dict.json>
dict.json: {"укр рядок": {"en": "...", "pl": "..."}}
"""
import json, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

S, PUB, DICT = sys.argv[1], sys.argv[2], sys.argv[3]
lines = json.load(open(f"{S}/lines.json"))
tr = json.load(open(DICT))
FONT = {"r": "/usr/share/fonts/opentype/inter/Inter-Medium.otf", "b": "/usr/share/fonts/opentype/inter/Inter-SemiBold.otf"}
manifest = {}


def colors(a, x0, y0, x1, y1):
    h, w = a.shape[:2]
    pad = max(3, (y1 - y0) // 3)
    X0, Y0, X1, Y1 = max(0, x0 - pad), max(0, y0 - pad), min(w, x1 + pad), min(h, y1 + pad)
    ring = np.concatenate([a[Y0:y0, X0:X1].reshape(-1, 3), a[y1:Y1, X0:X1].reshape(-1, 3), a[Y0:Y1, X0:x0].reshape(-1, 3), a[Y0:Y1, x1:X1].reshape(-1, 3)])
    bg = np.median(ring, axis=0) if len(ring) else np.array([255, 255, 255])
    box = a[y0:y1, x0:x1].reshape(-1, 3).astype(int)
    d = np.abs(box - bg).sum(1)
    ink = box[d > np.percentile(d, 85)] if len(box) else box
    fg = np.median(ink, axis=0) if len(ink) else np.array([40, 40, 40])
    # смуга фону навколо однорідна? (інакше — під текстом лінії / заливка, стираємо обережно)
    uniform = np.abs(ring.astype(int) - bg).sum(1).mean() < 25 if len(ring) else True
    return tuple(int(v) for v in bg), tuple(int(v) for v in fg), uniform


def fit(text, h, maxw, bold):
    size = max(8, int(h * 1.18))
    while size > 7:
        f = ImageFont.truetype(FONT["b" if bold else "r"], size)
        l, t, r, b = f.getbbox(text)
        if r - l <= maxw:
            return f
        size -= 1
    return ImageFont.truetype(FONT["b" if bold else "r"], 7)


for img, ls in lines.items():
    todo = [(t, *bb[:4], bb[4] if len(bb) > 4 else "h") for t, *bb in ls if t in tr]
    if not todo:
        continue
    src = Image.open(f"{PUB}/{img}").convert("RGB")
    a = np.asarray(src)
    for lang in ("en", "pl"):
        im = src.copy()
        dr = ImageDraw.Draw(im)
        for t, x0, y0, x1, y1, orient in todo:
            out = tr[t].get(lang)
            if out is None:
                continue
            bg, fg, uniform = colors(a, x0, y0, x1, y1)
            h = y1 - y0
            dr.rectangle([x0 - 2, y0 - 2, x1 + 2, y1 + 2], fill=bg)
            if not out:
                continue  # двомовний підпис: український рядок прибираємо, англійський уже є
            if t.isupper() and out.upper() != out:
                out = out.upper()
            if orient == "v":
                # вертикальний підпис (читається знизу вгору): малюємо горизонтально й повертаємо на 90° проти годинникової
                th, ln = x1 - x0, y1 - y0
                f = fit(out, th, ln * 1.12 + 6, False)
                l, tt, r, b = f.getbbox(out)
                tile = Image.new("RGBA", (r - l + 4, b - tt + 4), (0, 0, 0, 0))
                ImageDraw.Draw(tile).text((2 - l, 2 - tt), out, font=f, fill=fg + (255,))
                tile = tile.rotate(90, expand=True)
                im.paste(tile, (int((x0 + x1) / 2 - tile.width / 2), int((y0 + y1) / 2 - tile.height / 2)), tile)
                continue
            bold = sum(fg) < 200 and h > 14
            f = fit(out, h, (x1 - x0) * 1.12 + 6, bold)
            l, tt, r, b = f.getbbox(out)
            cx = (x0 + x1) / 2
            dr.text((cx - (r - l) / 2 - l, y0 + (h - (b - tt)) / 2 - tt), out, font=f, fill=fg)
        dst = img.replace(".webp", f".{lang}.webp")
        im.save(f"{PUB}/{dst}", "WEBP", quality=90, method=6)
        manifest.setdefault("/" + img, []).append(lang)
json.dump(manifest, open(f"{S}/manifest.json", "w"), indent=1, sort_keys=True)
print(len(manifest), "images translated")
