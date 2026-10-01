import pymupdf, sys

SRC = '/home/user/Zuritt/Навчання інсталяторів (2)_compressed.pdf'
SEC = 'deck.pdf'          # partner-program section (14 slides)
EXT = 'extra.pdf'         # new slides x1..x8
OUT = sys.argv[1] if len(sys.argv) > 1 else 'full.pdf'

src = pymupdf.open(SRC)
G = (0.357, 0.694, 0.278)

def F(xref):
    return pymupdf.Font(fontbuffer=src.extract_font(xref)[3])
FONTS = {
    'reg': [F(220), F(224), pymupdf.Font(fontfile='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')],
    'bold': [F(205), F(197), pymupdf.Font(fontfile='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf')],
    'black': [F(268), F(200), pymupdf.Font(fontfile='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf')],
}

def put(page, x, y, text, size, color=(0, 0, 0), w='reg'):
    """Write text at baseline (x, y), picking per character the first subset font that has the glyph."""
    tw = pymupdf.TextWriter(page.rect, color=color)
    fonts = FONTS[w]
    run, runf = '', None
    def flush():
        nonlocal x, run
        if run:
            tw.append((x, y), run, font=runf, fontsize=size)
            x += runf.text_length(run, fontsize=size)
            run = ''
    for ch in text:
        f = next((f for f in fonts if ch == ' ' or f.has_glyph(ord(ch))), fonts[-1])
        if ch == ' ' and runf is not None:
            f = runf
        if f is not runf:
            flush()
            runf = f
        run += ch
    flush()
    tw.write_text(page)
    return x

def width(text, size, w='reg'):
    fonts = FONTS[w]
    return sum(next((f for f in fonts if c == ' ' or f.has_glyph(ord(c))), fonts[-1]).text_length(c, fontsize=size) for c in text)

def erase(page, rect, fill=None):
    page.add_redact_annot(rect, fill=False)
    page.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_NONE, graphics=pymupdf.PDF_REDACT_LINE_ART_NONE)

# ---------- fixes on original pages (1-based) ----------
P = lambda n: src[n - 1]

# 66: typo BeeThremic -> BeeThermic (same font, size, colour)
p = P(66)
erase(p, pymupdf.Rect(403, 128, 662, 183))
put(p, 403.9, 172.0, 'BeeThermic', 46, (0x22/255, 0x23/255, 0x28/255), 'black')

# 80: remove red check mark image, fix labels
p = P(80)
for im in p.get_images(full=True):
    r = p.get_image_rects(im[0])
    if r and r[0].x0 > 560 and r[0].y1 < 150:
        p.delete_image(im[0])
erase(p, pymupdf.Rect(73, 239.8, 225, 251))
put(p, 74.0, 249.4, 'Клас електрозахисту', 12)
for x0 in (412.4, 534.3):
    erase(p, pymupdf.Rect(x0 - 3, 484.2, x0 + 31, 495.3))
    put(p, x0 - 3 + (34 - width('RS485', 12)) / 2, 493.7, 'RS485', 12)

# 81: red warning -> branded callout
p = P(81)
erase(p, pymupdf.Rect(588, 450, 936, 503))
box = pymupdf.Rect(583, 443, 940, 512)
p.draw_rect(box, color=None, fill=(0.918, 0.961, 0.902))
p.draw_rect(pymupdf.Rect(box.x0, box.y0, box.x0 + 5, box.y1), color=None, fill=G)
put(p, 597, 462, 'Важливо:', 13, (0.18, 0.42, 0.13), 'bold')
put(p, 597 + width('Важливо: ', 13, 'bold'), 462, 'гідробокс поставляється без циркуляційного', 13, (0.1, 0.1, 0.1))
put(p, 597, 480, 'насоса і без пульта — пульт керування йде в комплекті', 13, (0.1, 0.1, 0.1))
put(p, 597, 498, 'з тепловим насосом.', 13, (0.1, 0.1, 0.1))

# 15-17: add the missing section tag
for n in (15, 16, 17):
    p = P(n)
    t = 'Сертифікація'
    wdt = width(t, 18, 'bold')
    p.draw_rect(pymupdf.Rect(70.7, 48.5, 84.6 + wdt + 14, 83.0), color=None, fill=G)
    put(p, 84.6, 71.0, t, 18, (1, 1, 1), 'bold')

# 180: remove internal notes "(навіщо?)"
p = P(180)
erase(p, pymupdf.Rect(683, 366, 771, 385.5))
erase(p, pymupdf.Rect(388, 414, 476, 433.5))

# 187: link marketing slide to the new section
p = P(187)
p.draw_rect(pymupdf.Rect(640, 150, 935, 200), color=None, fill=(0.918, 0.961, 0.902))
p.draw_rect(pymupdf.Rect(640, 150, 645, 200), color=None, fill=G)
put(p, 656, 171, 'Детальніше — розділ', 13, (0.18, 0.42, 0.13), 'bold')
put(p, 656, 189, '«Продаємо разом з вами», стор. 176', 13, (0.18, 0.42, 0.13), 'bold')

# ---------- assemble ----------
sec = pymupdf.open(SEC)
ext = pymupdf.open(EXT)
W, H = src[0].rect.width, src[0].rect.height
out = pymupdf.open()

def orig(a, b):
    out.insert_pdf(src, from_page=a - 1, to_page=b - 1)

def new(doc, i):
    pg = out.new_page(width=W, height=H)
    pg.show_pdf_page(pg.rect, doc, i)

orig(1, 1); new(ext, 0)                 # cover, agenda
orig(2, 21); new(ext, 1)                # ... model range, how to choose
orig(22, 61); new(ext, 2)               # ... BeeEco table (replaces 62)
orig(63, 92); new(ext, 3)               # ... split vs mono (replaces 93-94)
orig(95, 173); new(ext, 4)              # ... checklist
for i in range(12): new(sec, i)         # partner section 1-12
new(ext, 5)                             # objections
new(sec, 12); new(sec, 13)              # 4 steps, final
orig(177, 183); new(ext, 6)             # service ... resources (replaces 184-185)
orig(186, 187); new(ext, 7)             # monitoring, marketing, contacts
orig(188, 188)                          # thank you

# page numbers (skip cover and last)
n = len(out)
for i in range(1, n - 1):
    pg = out[i]
    s = str(i + 1)
    put(pg, W - 28 - width(s, 10), H - 14, s, 10, (0.62, 0.64, 0.62))

out.save(OUT, garbage=4, deflate=True)
print(n, 'pages ->', OUT)
