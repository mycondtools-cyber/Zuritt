"use client";

import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { RecolorSpec } from "@/lib/recolor";
import { useColorPreview, useRecolored } from "./color-preview";

const PREVIEW = "__preview__";
const MODEL = "__3d__";

// three.js (~600 КБ) вантажимо лише коли відкрили 3D
const Viewer3D = dynamic(() => import("./viewer3d"), { ssr: false, loading: () => <Loading3D /> });

function Loading3D() {
  const t = useTranslations("product");
  return <div className="flex h-full items-center justify-center text-sm text-muted">{t("loading3d")}</div>;
}

function Cube() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden>
      <path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z" />
      <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
    </svg>
  );
}

export function Gallery({ images, alt, recolor }: { images: string[]; alt: string; recolor?: RecolorSpec }) {
  const t = useTranslations();
  const ctx = useColorPreview();
  const preview = ctx?.color;
  const model = ctx?.model;
  const recolored = useRecolored(recolor, preview?.hex);
  // перший слайд — виріб в обраному кольорі RAL, далі 3D-модель, далі фото
  const slides = [...(recolor && preview ? [PREVIEW] : []), ...(model ? [MODEL] : []), ...images];
  const [cur, setCur] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);

  // змінили колір — показуємо попередній перегляд (якщо не дивляться 3D: там колір і так оновлюється)
  useEffect(() => {
    if (preview && cur !== MODEL) setCur(PREVIEW);
  }, [preview?.hex]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!slides.length) return <div className="card flex aspect-square items-center justify-center text-muted">{t("common.photoSoon")}</div>;
  const active = cur && slides.includes(cur) ? cur : slides[0];
  const srcOf = (s: string) => (s === PREVIEW ? (recolored ?? recolor!.image) : s);
  const photoNo = (s: string) => images.indexOf(s) + 1;

  return (
    <div>
      {active === MODEL && model ? (
        <div className="card relative aspect-square w-full overflow-hidden">
          <Viewer3D
            spec={model}
            hex={preview?.hex ?? "#f1f0ea"}
            finish={preview?.finish ?? "gloss"}
            labels={{ mm: t("common.mm"), drag: t("product.drag3d"), reset: t("product.reset3d"), dims: t("product.dims3d") }}
          />
          <span className="pointer-events-none absolute left-3 top-3 rounded-lg bg-ink px-2 py-1 text-xs font-bold text-white">3D</span>
        </div>
      ) : (
        <button type="button" className="card relative block aspect-square w-full overflow-hidden" onClick={() => setZoom(true)} aria-label={t("product.zoom")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={srcOf(active)} alt={alt} className="h-full w-full object-contain p-6" />
          {active === PREVIEW && preview && (
            <span className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-lg bg-white/90 px-2 py-1 text-xs font-semibold text-ink-2 shadow-sm">
              <span className="h-3 w-3 rounded-sm border border-black/10" style={{ background: preview.hex }} />
              {t("product.colorPreview", { name: preview.name })}
            </span>
          )}
        </button>
      )}
      {slides.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {slides.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setCur(s)}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border bg-white ${s === active ? "border-brand ring-1 ring-brand" : "border-line"}`}
              aria-label={s === PREVIEW ? t("product.colorPreview", { name: preview?.name ?? "" }) : s === MODEL ? t("product.view3d") : t("product.photo", { n: photoNo(s) })}
            >
              {s === MODEL ? (
                <span className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-[radial-gradient(ellipse_at_center,#ffffff,#e8ebee)] text-ink-2">
                  <Cube />
                  <span className="text-[10px] font-bold">3D</span>
                </span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={srcOf(s)} alt="" loading="lazy" className="h-full w-full object-contain p-1" />
              )}
              {s === PREVIEW && preview && <span className="absolute right-1 top-1 h-3 w-3 rounded-full border border-white shadow" style={{ background: preview.hex }} />}
            </button>
          ))}
        </div>
      )}
      {zoom && active !== MODEL && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4" onClick={() => setZoom(false)} role="dialog" aria-label={alt}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={srcOf(active)} alt={alt} className="max-h-full max-w-full rounded-2xl bg-white object-contain" />
        </div>
      )}
    </div>
  );
}
