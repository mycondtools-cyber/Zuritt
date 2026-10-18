"""Перевірка перефарбування: той самий алгоритм, що й у браузері (src/lib/recolor.ts)."""
import json, os, sys
import cv2
import numpy as np

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")


def recolor(img, mask, rgb, base):
    m = mask.astype(np.float32)[..., None] / 255
    lum = (0.2126 * img[..., 2] + 0.7152 * img[..., 1] + 0.0722 * img[..., 0]).astype(np.float32)[..., None]
    target = np.array(rgb[::-1], np.float32)
    t = lum / base
    hi = np.clip((t - 1) / max(255 / base - 1, 1e-3), 0, 1) ** 1.3 * 0.85
    # м'якші тіні (t^0,75): порошкова фарба виглядає рівніше, світлі RAL не «сіріють»
    out = np.where(t <= 1, target * np.clip(t, 0, 1) ** 0.75, target + (255 - target) * hi)
    return np.clip(img * (1 - m) + out * m, 0, 255).astype(np.uint8)


if __name__ == "__main__":
    data = json.load(open(os.path.join(ROOT, "data", "recolor.json")))
    if len(sys.argv) > 2:
        data = {k: v for k, v in data.items() if k in sys.argv[2:]}
    colors = [(241, 240, 234), (56, 62, 66), (204, 44, 36), (31, 77, 141)]  # RAL 9016, 7016, 3020, 5015
    T = 170
    rows = []
    for slug, d in data.items():
        img = cv2.imread(ROOT + "/public" + d["image"])
        mask = cv2.imread(ROOT + "/public" + d["mask"], cv2.IMREAD_GRAYSCALE)
        tiles = [img] + [recolor(img, mask, c, d["base"]) for c in colors]
        def fit(im):
            h, w = im.shape[:2]; s = T / max(h, w)
            t = cv2.resize(im, (int(w * s), int(h * s)))
            return cv2.copyMakeBorder(t, 0, T - t.shape[0], 0, T - t.shape[1], cv2.BORDER_CONSTANT, value=(255, 255, 255))
        row = np.hstack([fit(t) for t in tiles])
        cv2.putText(row, slug, (3, 14), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 255), 1)
        rows.append(row)
    out = sys.argv[1]
    for k in range(0, len(rows), 8):
        pair = rows[k:k + 8]
        left, right = pair[:4], pair[4:]
        while len(right) < len(left): right.append(np.full_like(left[0], 255))
        cv2.imwrite(f"{out}/recolor{k // 8}.png", np.hstack([np.vstack(left), np.full((len(left) * T, 8, 3), 200, np.uint8), np.vstack(right)]))
    print(len(rows))
