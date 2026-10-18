"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { RecolorSpec } from "@/lib/recolor";
import { useColorPreview, useRecolored } from "./color-preview";

const PREVIEW = "__preview__";

export function Gallery({ images, alt, recolor }: { images: string[]; alt: string; recolor?: RecolorSpec }) {
  const t = useTranslations();
  const preview = useColorPreview()?.color;
  const recolored = useRecolored(recolor, preview?.hex);
  // перший слайд — виріб в обраному кольорі RAL (поки готується — фото, з якого перефарбовуємо)
  const slides = recolor && preview ? [PREVIEW, ...images] : images;
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState(false);

  // змінили колір — показуємо попередній перегляд
  useEffect(() => {
    if (preview) setI(0);
  }, [preview?.hex]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!slides.length) return <div className="card flex aspect-square items-center justify-center text-muted">{t("common.photoSoon")}</div>;
  const k = Math.min(i, slides.length - 1);
  const srcOf = (s: string) => (s === PREVIEW ? (recolored ?? recolor!.image) : s);
  const current = srcOf(slides[k]);

  return (
    <div>
      <button type="button" className="card relative block aspect-square w-full overflow-hidden" onClick={() => setZoom(true)} aria-label={t("product.zoom")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current} alt={alt} className="h-full w-full object-contain p-6" />
        {slides[k] === PREVIEW && preview && (
          <span className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-lg bg-white/90 px-2 py-1 text-xs font-semibold text-ink-2 shadow-sm">
            <span className="h-3 w-3 rounded-sm border border-black/10" style={{ background: preview.hex }} />
            {t("product.colorPreview", { name: preview.name })}
          </span>
        )}
      </button>
      {slides.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {slides.map((s, n) => (
            <button
              key={s}
              type="button"
              onClick={() => setI(n)}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border bg-white ${n === k ? "border-brand ring-1 ring-brand" : "border-line"}`}
              aria-label={s === PREVIEW ? t("product.colorPreview", { name: preview?.name ?? "" }) : t("product.photo", { n: n + (slides[0] === PREVIEW ? 0 : 1) })}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={srcOf(s)} alt="" loading="lazy" className="h-full w-full object-contain p-1" />
              {s === PREVIEW && preview && <span className="absolute right-1 top-1 h-3 w-3 rounded-full border border-white shadow" style={{ background: preview.hex }} />}
            </button>
          ))}
        </div>
      )}
      {zoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4" onClick={() => setZoom(false)} role="dialog" aria-label={alt}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current} alt={alt} className="max-h-full max-w-full rounded-2xl bg-white object-contain" />
        </div>
      )}
    </div>
  );
}
