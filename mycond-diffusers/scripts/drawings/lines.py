"""Рядки з кирилицею з OCR-файлів: зображення → [(текст, x0, y0, x1, y1, орієнтація)] у пікселях оригіналу; зведений список фраз.
Проходи: звичайний (*.tsv), повернутий за годинниковою (*.rot.tsv → вертикальні підписи «v»), інвертований (*.inv.tsv).
"""
import json, os, re, sys
from collections import defaultdict

S = sys.argv[1]
CYR = re.compile(r"[А-Яа-яІіЇїЄєҐґ]")
out = defaultdict(list)
phrases = defaultdict(int)


def overlaps(a, b):
    ix = max(0, min(a[2], b[2]) - max(a[0], b[0]))
    iy = max(0, min(a[3], b[3]) - max(a[1], b[1]))
    inter = ix * iy
    area = min((a[2] - a[0]) * (a[3] - a[1]), (b[2] - b[0]) * (b[3] - b[1])) or 1
    return inter / area > 0.4


# спершу звичайний прохід, потім інвертований і повернутий — дублікати відкидаємо
files = sorted(f for f in os.listdir(f"{S}/ocr") if f.endswith(".tsv"))
files.sort(key=lambda f: (f.endswith(".rot.tsv"), f.endswith(".inv.tsv")))
for f in files:
    raw = open(f"{S}/ocr/{f}").read().splitlines()
    head = raw[0].split() if raw and raw[0].startswith("#scale") else ["#scale", "1"]
    k = int(head[1])
    mode = head[2] if len(head) > 2 else "plain"
    H = int(head[4]) * k if len(head) > 4 else 0
    img = re.sub(r"(\.rot|\.inv)?\.tsv$", "", f).replace("_", "/")
    groups = defaultdict(list)
    for r in (r.split("\t") for r in raw[2:]):
        if len(r) < 12 or r[0] != "5":
            continue
        txt = r[11].strip()
        conf = float(r[10])
        if not txt or conf < 35:
            continue
        x, y, w, h = map(int, r[6:10])
        groups[(r[2], r[3], r[4])].append((int(r[5]), txt, x, y, w, h, conf))
    for ws in groups.values():
        ws.sort()
        text = " ".join(w[1] for w in ws)
        conf = sum(w[6] for w in ws) / len(ws)
        longest = max(len(re.sub(r"[^А-Яа-яІіЇїЄєҐґ]", "", w[1])) for w in ws)
        if not CYR.search(text) or longest < 4 or conf < 70:
            continue
        a0 = min(w[2] for w in ws)
        b0 = min(w[3] for w in ws)
        a1 = max(w[2] + w[4] for w in ws)
        b1 = max(w[3] + w[5] for w in ws)
        if mode == "rot":
            # повернуте за годинниковою: (xr, yr) → (x = yr, y = H − xr)
            box = [b0 // k, (H - a1) // k, b1 // k, (H - a0) // k]
            orient = "v"
        else:
            box = [a0 // k, b0 // k, a1 // k, b1 // k]
            orient = "h"
        if any(overlaps(box, o[1:5]) for o in out[img]):
            continue
        out[img].append([text, *box, orient])
        phrases[text] += 1
json.dump(out, open(f"{S}/lines.json", "w"), ensure_ascii=False, indent=0)
json.dump(sorted(phrases.items(), key=lambda x: -x[1]), open(f"{S}/phrases.json", "w"), ensure_ascii=False, indent=0)
print(len(out), "images with Cyrillic;", len(phrases), "unique lines")
