import type { ProductData, RalData } from "@/lib/types";
import seed from "../data/seed.json";

/** Товар із data/seed.json у вигляді, який отримує конфігуратор */
export function product(slug: string): ProductData {
  const p = seed.products.find((x) => x.slug === slug);
  if (!p) throw new Error(`Немає товару ${slug} у seed.json`);
  return {
    id: 0,
    slug,
    code: p.code,
    name: p.name,
    mode: p.mode as ProductData["mode"],
    shape: p.shape as ProductData["shape"],
    leadDays: p.leadDays,
    options: p.options as ProductData["options"],
    calc: p.calc as ProductData["calc"],
    pricing: p.pricing as ProductData["pricing"],
    limits: p.limits as ProductData["limits"],
    sizes: (p.sizes as Record<string, unknown>[]).map((s, i) => ({
      label: s.label as string,
      w: (s.w as number) ?? null,
      h: (s.h as number) ?? null,
      d: (s.d as number) ?? null,
      freeArea: (s.freeArea as number) ?? null,
      price: (s.price as number) ?? 0,
      sort: i,
    })),
  };
}

export const colors: RalData[] = seed.ral.map((r, i) => ({
  id: i,
  code: r.code,
  name: r.name,
  hex: r.hex,
  finish: r.finish,
  isStandard: r.name === "RAL 9016 глянець",
  popular: false,
  surchargePct: (r as { surchargePct?: number }).surchargePct ?? null,
}));

/** Виробник округлює до сотих — допускаємо ±0,01 абсолютно або ±1,5 % */
export const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.011, Math.abs(b) * 0.015);
