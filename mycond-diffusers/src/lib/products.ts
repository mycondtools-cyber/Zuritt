import type { Product, ProductSize } from "@prisma/client";
import { basePrice } from "./calc";
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
  const data = toProductData(p);
  if (p.mode === "sizes") {
    const prices = p.sizes.map((s) => s.price).filter((x) => x > 0);
    return prices.length ? Math.min(...prices) : 0;
  }
  const l = data.limits;
  const sel = {
    options: Object.fromEntries(data.options.map((g) => [g.key, g.default])),
    ralName: "",
    quantity: 1,
    width: l.wMin,
    height: l.hMin,
    length: l.lMin,
    // для боксів — найменші габарити
    extra: Object.fromEntries((l.extra ?? []).map((e) => [e.key, ["a", "b", "h"].includes(e.key) ? e.min : e.default])),
  };
  return Math.round(basePrice(data, sel));
}

export const MOUNTING: Record<string, string> = {
  ceiling: "Стельовий",
  stretch: "Під натяжні стелі",
  hidden: "Прихований (під шпаклівку)",
  armstrong: "Стеля «Армстронг»",
  wall: "Стіновий",
  facade: "Фасадний",
  duct: "На повітровід",
};

export const SHAPES: Record<string, string> = {
  square: "Квадратні / прямокутні",
  round: "Круглі",
  slot: "Лінійні (щілинні)",
  box: "Бокси / пленуми",
};

export const MODES: Record<Mode, string> = {
  sizes: "Типорозміри з таблиці",
  rect: "Довільний розмір Ш×В (ціна за м²)",
  slot: "Щілинний: довжина + к-сть щілин (ціна за м.п.)",
  box: "Бокс / пленум: габарити + патрубки",
};

/** Розділи каталогу (вкладки) */
export const GROUPS: [string, string][] = [
  ["diffusers", "Дифузори"],
  ["grilles", "Решітки"],
  ["anemostats", "Анемостати"],
  ["plenums", "Пленуми"],
];
