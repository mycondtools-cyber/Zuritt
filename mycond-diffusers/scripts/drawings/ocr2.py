"""Додаткові проходи OCR: rot — повернуто за годинниковою (вертикальні підписи), inv — інвертовано (білий текст на кольоровому)."""
import sys, subprocess, os
from PIL import Image, ImageOps
src, out, mode = sys.argv[1], sys.argv[2], sys.argv[3]
im = Image.open(src).convert("RGB")
w, h = im.size
k = max(1, min(3, 2600 // max(w, h)))
im = im.resize((w * k, h * k), Image.LANCZOS)
if mode == "rot":
    im = im.rotate(-90, expand=True)
else:
    im = ImageOps.invert(ImageOps.grayscale(im))
tmp = out + ".png"; im.save(tmp)
r = subprocess.run(["tesseract", tmp, "stdout", "-l", "ukr+eng", "--psm", "11", "tsv"], capture_output=True, text=True)
os.remove(tmp)
open(out, "w").write(f"#scale {k} {mode} {w} {h}\n" + r.stdout)
