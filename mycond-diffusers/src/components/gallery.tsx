"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

export function Gallery({ images, alt }: { images: string[]; alt: string }) {
  const t = useTranslations();
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState(false);
  if (!images.length) return <div className="card flex aspect-square items-center justify-center text-muted">{t("common.photoSoon")}</div>;
  return (
    <div>
      <button type="button" className="card block aspect-square w-full overflow-hidden" onClick={() => setZoom(true)} aria-label={t("product.zoom")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[i]} alt={alt} className="h-full w-full object-contain p-6" />
      </button>
      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((src, k) => (
            <button
              key={src}
              type="button"
              onClick={() => setI(k)}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border bg-white ${k === i ? "border-brand ring-1 ring-brand" : "border-line"}`}
              aria-label={t("product.photo", { n: k + 1 })}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" loading="lazy" className="h-full w-full object-contain p-1" />
            </button>
          ))}
        </div>
      )}
      {zoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4" onClick={() => setZoom(false)} role="dialog" aria-label={alt}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[i]} alt={alt} className="max-h-full max-w-full rounded-2xl bg-white object-contain" />
        </div>
      )}
    </div>
  );
}
