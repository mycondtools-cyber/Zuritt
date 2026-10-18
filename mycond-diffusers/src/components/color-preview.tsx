"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { hexToRgb, recolorPixels, type RecolorSpec } from "@/lib/recolor";

type PreviewColor = { hex: string; name: string } | null;
const Ctx = createContext<{ color: PreviewColor; setColor: (c: PreviewColor) => void } | null>(null);

/** Обраний у конфігураторі колір — для попереднього перегляду в галереї тієї ж сторінки */
export function ColorPreviewProvider({ children }: { children: React.ReactNode }) {
  const [color, setColor] = useState<PreviewColor>(null);
  return <Ctx.Provider value={{ color, setColor }}>{children}</Ctx.Provider>;
}

export function useColorPreview() {
  return useContext(Ctx);
}

function load(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Фото виробу, перефарбоване в колір hex (URL зображення; null — поки готується або якщо не вдалося) */
export function useRecolored(spec: RecolorSpec | undefined, hex: string | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  const src = useRef<{ photo: ImageData; mask: Uint8ClampedArray; w: number; h: number } | null>(null);
  const cache = useRef(new Map<string, string>());

  useEffect(() => {
    if (!spec || !hex) return;
    let cancelled = false;
    (async () => {
      const hit = cache.current.get(hex);
      if (hit) return setUrl(hit);
      if (!src.current) {
        const [photo, mask] = await Promise.all([load(spec.image), load(spec.mask)]);
        const w = photo.naturalWidth;
        const h = photo.naturalHeight;
        const cv = document.createElement("canvas");
        cv.width = w;
        cv.height = h;
        const ctx = cv.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(mask, 0, 0, w, h);
        const m = ctx.getImageData(0, 0, w, h).data;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(photo, 0, 0);
        src.current = { photo: ctx.getImageData(0, 0, w, h), mask: m, w, h };
      }
      if (cancelled) return;
      const { photo, mask, w, h } = src.current;
      const out = new ImageData(new Uint8ClampedArray(photo.data), w, h);
      recolorPixels(out.data, mask, hexToRgb(hex), spec.base);
      const cv = document.createElement("canvas");
      cv.width = w;
      cv.height = h;
      cv.getContext("2d")!.putImageData(out, 0, 0);
      const blob = await new Promise<Blob | null>((r) => cv.toBlob(r, "image/webp", 0.9));
      if (!blob || cancelled) return;
      const u = URL.createObjectURL(blob);
      cache.current.set(hex, u);
      setUrl(u);
    })().catch(() => setUrl(null));
    return () => {
      cancelled = true;
    };
  }, [spec, hex]);

  useEffect(() => {
    const c = cache.current;
    return () => c.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  return url;
}
