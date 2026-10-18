"""
Маски для попереднього перегляду кольору RAL.

Для кожного товару обирає фото виробу на білому тлі з найсвітлішим фарбуванням (білий/сірий
перефарбовується правдоподібно, чорний — ні), вирізає виріб (GrabCut) і зберігає маску
public/products/<slug>/recolor-mask.png. Підсумок — data/recolor.json.

  python3 scripts/recolor/build_masks.py            # усі товари
  python3 scripts/recolor/build_masks.py pdk sd     # лише вказані

Потрібно: pip install opencv-python-headless numpy
"""
import glob, json, os, sys
import cv2
import numpy as np

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
PRODUCTS = os.path.join(ROOT, "public", "products")
OUT = os.path.join(ROOT, "data", "recolor.json")
# фото з цих товарів не перефарбовуємо: оцинковані бокси, гіпс під фарбування на об'єкті
SKIP = {"af-box", "flx-box", "pb", "pb-vd", "ps", "crl", "pcr", "sqr"}
# перевірено очима (scripts/recolor/preview.py): перефарбування виглядає погано — тінь на підлозі,
# біле на білому тлі, креслення замість фото, плями
REJECT = {"evf", "svf", "jn", "sdt", "1-r-30-30", "du-1-30-30", "l15-30-30", "2-dr-35-75", "sd", "lhc-30-40", "1-nr-35-45", "ncd",
          "clt", "1-rn-30-30", "lr-25-65", "du-3-40-20", "rg", "sdh", "ssg"}


def white_bg_ratio(img):
    """Частка майже білих пікселів по краю кадру — фото виробу на білому тлі."""
    h, w = img.shape[:2]
    b = max(4, min(h, w) // 40)
    edge = np.concatenate([img[:b].reshape(-1, 3), img[-b:].reshape(-1, 3), img[:, :b].reshape(-1, 3), img[:, -b:].reshape(-1, 3)])
    return float(((edge.min(axis=1) > 225) & (edge.max(axis=1) - edge.min(axis=1) < 18)).mean())


def product_mask(img):
    h, w = img.shape[:2]
    # сегментація на зменшеній копії (у 5–10 разів швидше), маска — назад до розміру фото
    k = min(1.0, 560 / max(h, w))
    small = cv2.resize(img, (int(w * k), int(h * k)), interpolation=cv2.INTER_AREA)
    sh, sw = small.shape[:2]
    mask = np.zeros((sh, sw), np.uint8)
    m = max(3, min(sh, sw) // 50)
    bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    cv2.grabCut(small, mask, (m, m, sw - 2 * m, sh - 2 * m), bgd, fgd, 5, cv2.GC_INIT_WITH_RECT)
    fg = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    fg = (cv2.resize(fg, (w, h), interpolation=cv2.INTER_LINEAR) > 127).astype(np.uint8) * 255
    # лише сам виріб: найбільший фрагмент і співмірні з ним (підписи, острівці, тіні — геть)
    n, lab, st, _ = cv2.connectedComponentsWithStats(fg)
    keep = np.zeros_like(fg)
    big = max((st[i, cv2.CC_STAT_AREA] for i in range(1, n)), default=0)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] >= max(0.3 * big, 0.01 * h * w):
            keep[lab == i] = 255
    # не фарбуємо кольорові деталі: логотип MYCOND, наклейки, мідь/латунь
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    colored = (hsv[..., 1] > 70) & (hsv[..., 2] > 60)
    keep[cv2.dilate(colored.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0] = 0
    # рівний контур без «пилки»: закриття дрібних щербин і згладжування межі
    keep = cv2.morphologyEx(keep, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    keep = (cv2.GaussianBlur(keep, (0, 0), 2.0) > 127).astype(np.uint8) * 255
    return cv2.GaussianBlur(keep, (0, 0), 1.0)


def analyse(path):
    img = cv2.imread(path)
    if img is None:
        return None
    h, w = img.shape[:2]
    if white_bg_ratio(img) < 0.85:
        return None  # інтер'єр, банер, фото з фоном
    mask = product_mask(img)
    area = (mask > 127).mean()
    if not 0.06 < area < 0.85:
        return None
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    lum = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)[mask > 127]
    # креслення: на білому тлі, але «виробу» майже немає (тонкі лінії) — відсіюємо за заповненістю
    fill = (cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((9, 9), np.uint8)) > 127).mean() / max(area, 1e-6)
    if fill < 0.7:
        return None
    if (lum > 248).mean() > 0.6 or np.median(lum) >= 245:
        return None  # «виріб» білий як папір — креслення або пересвічене фото
    med = float(np.median(lum))
    if med < 150:
        # темний виріб: світле тло, що видно крізь щілини й отвори, — не фарбуємо
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        bg = ((gray > 225) & (hsv[..., 1] < 30)).astype(np.uint8) * 255
        mask = cv2.min(mask, 255 - cv2.GaussianBlur(cv2.dilate(bg, np.ones((3, 3), np.uint8)), (0, 0), 1.0))
        lum = gray[mask > 127]
    base = float(np.percentile(lum, 92))
    return {"mask": mask, "base": base, "median": med, "area": float(area)}


def main(slugs):
    data = json.load(open(OUT)) if os.path.exists(OUT) else {}
    for slug in slugs:
        if slug in SKIP or slug in REJECT:
            data.pop(slug, None)
            continue
        best = None
        for f in sorted(glob.glob(os.path.join(PRODUCTS, slug, "[0-9]*.webp"))):
            a = analyse(f)
            # світле фарбування (білий/сірий) перефарбовується правдоподібно; далі — більший виріб у кадрі
            if a and a["median"] > 105:
                a["score"] = a["area"] * (1 - abs(a["median"] - 215) / 215)
                if best is None or a["score"] > best[1]["score"]:
                    best = (f, a)
        if not best:
            # лише темні фото (графіт, чорний): перефарбовуємо з розтягнутим тоновим діапазоном — переглянути очима
            for f in sorted(glob.glob(os.path.join(PRODUCTS, slug, "[0-9]*.webp"))):
                a = analyse(f)
                if a and a["median"] > 30 and (best is None or a["area"] > best[1]["area"]):
                    best = (f, a)
        if not best:
            data.pop(slug, None)
            print(f"{slug}: немає придатного фото")
            continue
        f, a = best
        cv2.imwrite(os.path.join(PRODUCTS, slug, "recolor-mask.png"), a["mask"], [cv2.IMWRITE_PNG_COMPRESSION, 9])
        data[slug] = {"image": f"/products/{slug}/{os.path.basename(f)}", "mask": f"/products/{slug}/recolor-mask.png", "base": round(a["base"], 1)}
        print(f"{slug}: {os.path.basename(f)} base {a['base']:.0f} area {a['area']:.2f}")
    json.dump(dict(sorted(data.items())), open(OUT, "w"), indent=1)


if __name__ == "__main__":
    args = sys.argv[1:] or sorted(os.listdir(PRODUCTS))
    main([s for s in args if os.path.isdir(os.path.join(PRODUCTS, s))])
