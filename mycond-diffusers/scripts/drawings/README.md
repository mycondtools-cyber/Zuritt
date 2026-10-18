# Переклад написів на кресленнях

Для креслень з українськими написами поруч з оригіналом лежать `NN.en.webp` і `NN.pl.webp`. Галерея (`src/components/gallery.tsx`) бере версію під мову сторінки за списком `src/lib/localized-images.json`.

Як перекласти заново (наприклад, після нових креслень або правок словника):

```bash
W=/tmp/drawings && mkdir -p $W/ocr && cp scripts/drawings/*.py $W/
cd public
# 1. розпізнавання тексту (tesseract-ocr + tesseract-ocr-ukr): звичайний прохід по всіх зображеннях,
#    а для креслень — ще повернутий (вертикальні підписи) та інвертований (білий текст на кольоровому)
export OMP_THREAD_LIMIT=1
ls products/*/[0-9]*.webp | grep -v '\.[a-z][a-z]\.webp' | xargs -P 4 -I{} sh -c 'python3 '$W'/ocr1.py {} '$W'/ocr/$(echo {} | tr / _).tsv'
# (rot / inv: python3 $W/ocr2.py <img> <out>.rot.tsv rot | inv)
# 2. рядки з кирилицею → lines.json (або взяти готовий scripts/drawings/lines.json)
python3 $W/lines.py $W
# 3. накладання перекладу за словником scripts/drawings/dict.json
python3 $W/render_tr.py $W . ../scripts/drawings/dict.json && cp $W/manifest.json ../src/lib/localized-images.json
```

Словник `dict.json`: ключ — рядок так, як його розпізнав OCR; `"en": ""` — двомовний підпис, де англійський рядок уже є (український прибирається). Рядків, яких немає в словнику, скрипт не чіпає.
