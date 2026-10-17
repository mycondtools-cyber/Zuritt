import type { Product, ProductSize } from "@prisma/client";
import type { CalcParams, Limits, Mode, OptionGroup, ProductData, Shape } from "./types";

export type ProductWithSizes = Product & { sizes: ProductSize[] };

export function toProductData(p: ProductWithSizes): ProductData {
  return {
    id: p.id,
    slug: p.slug,
    code: p.code,
    name: p.name,
    mode: p.mode as Mode,
    shape: p.shape as Shape,
    leadDays: p.leadDays,
    options: (p.options as unknown as OptionGroup[]) ?? [],
    calc: p.calc as unknown as CalcParams,
    pricing: (p.pricing as unknown as ProductData["pricing"]) ?? {},
    limits: (p.limits as unknown as Limits) ?? {},
    sizes: [...p.sizes]
      .sort((a, b) => a.sort - b.sort)
      .map((s) => ({ id: s.id, label: s.label, w: s.w, h: s.h, d: s.d, freeArea: s.freeArea, price: s.price, sort: s.sort })),
  };
}

/** Мінімальна ціна «від» для картки каталогу */
export function priceFrom(p: ProductWithSizes): number {
  if (p.mode === "sizes") {
    const prices = p.sizes.map((s) => s.price).filter((x) => x > 0);
    return prices.length ? Math.min(...prices) : 0;
  }
  const pr = p.pricing as Record<string, number>;
  const l = p.limits as Limits;
  if (p.mode === "rect") return pr.perM2 ? Math.max(pr.min || 0, (pr.perM2 * (l.wMin ?? 0) * (l.hMin ?? 0)) / 1e6) : 0;
  return pr.perMeter ? (pr.perMeter * Math.max(l.lMin ?? 0, pr.minLengthMm || 0)) / 1000 : 0;
}

export const MOUNTING: Record<string, string> = {
  ceiling: "Стельовий",
  stretch: "Під натяжні стелі",
  hidden: "Прихований (під шпаклівку)",
  armstrong: "Стеля «Армстронг»",
  wall: "Стіновий",
};

export const SHAPES: Record<string, string> = {
  square: "Квадратні / прямокутні",
  round: "Круглі",
  slot: "Лінійні (щілинні)",
};

export const MODES: Record<Mode, string> = {
  sizes: "Типорозміри з таблиці",
  rect: "Довільний розмір Ш×В (ціна за м²)",
  slot: "Щілинний: довжина + к-сть щілин (ціна за м.п.)",
};
