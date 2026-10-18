import sys, subprocess, os, re
from PIL import Image
src = sys.argv[1]; out = sys.argv[2]
im = Image.open(src).convert("RGB")
w, h = im.size
k = max(1, min(2, 2000 // max(w, h)))
im = im.resize((w * k, h * k), Image.LANCZOS)
tmp = out + ".png"; im.save(tmp)
r = subprocess.run(["tesseract", tmp, "stdout", "-l", "ukr+eng", "--psm", "11", "tsv"], capture_output=True, text=True)
os.remove(tmp)
open(out, "w").write(f"#scale {k}\n" + r.stdout)
