/**
 * Опис параметричної 3D-моделі за обраним виробом і розмірами (без three.js — легкий модуль, тестується).
 * Усі розміри — у мм. Геометрію будує src/lib/model3d/build.ts.
 */
import type { ProductData, Selection } from "../types";

export type ModelSpec =
  | { kind: "square-ceiling"; size: number; cones: number; adjustable: boolean }
  | { kind: "round-ceiling"; d: number }
  | { kind: "grille"; w: number; h: number; double: boolean; angle: number; pitch: number }
  | { kind: "slot"; length: number; slots: number; slotW: number; hidden: boolean }
  | { kind: "disc"; d: number; exhaust: boolean };

const SLOT = new Set(["sd", "sd-d", "sd-p", "sdh", "sdh-d", "sdh-p", "sdt", "rsd"]);
const DISC = new Set(["kn", "kw", "kpp", "svf", "evf", "vs"]);
// решітки з ламелями: регульовані/нерегульовані, радіальні, лінійні, димовидалення, сталеві, зовнішні з ламелями
const GRILLE = /^(1-|2-|l-|l15-|lh-|lhc-|lr-|lr15-|nr-ots|r-30-20|du-|sg$|ssg$|n-)/;

const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : d);

/** Розміри обраного типорозміру: Ш×В або діаметр */
function sizeDims(p: ProductData, sel: Selection) {
  const s = p.sizes.find((x) => x.label === sel.sizeLabel) ?? p.sizes[0];
  if (!s) return { w: 0, h: 0, d: 0 };
  const m = s.label.match(/(\d+)\s*[xх×]\s*(\d+)/);
  const md = s.label.match(/[DØ]\s*(\d+)/i);
  return { w: s.w ?? (m ? +m[1] : 0), h: s.h ?? (m ? +m[2] : 0), d: s.d ?? (md ? +md[1] : 0) };
}

export function modelSpec(p: ProductData, sel: Selection): ModelSpec | null {
  const slug = p.slug;
  if (slug === "pdk" || slug === "pdk-r") {
    const { w } = sizeDims(p, sel);
    if (!w) return null;
    return { kind: "square-ceiling", size: w, cones: w <= 225 ? 3 : 4, adjustable: slug === "pdk-r" || sel.options?.dsdops === "Регульований" };
  }
  if (slug === "ncd") {
    const { d } = sizeDims(p, sel);
    return d ? { kind: "round-ceiling", d } : null;
  }
  if (DISC.has(slug)) {
    const { d } = sizeDims(p, sel);
    return d ? { kind: "disc", d, exhaust: slug === "kw" || slug === "evf" } : null;
  }
  if (SLOT.has(slug)) {
    const slots = Math.max(1, Math.min(6, parseInt(sel.options?.nslots ?? "1", 10) || 1));
    const slotW = num(Number(sel.options?.nslotswidth), num(p.calc.slotWidthMm, 20));
    return { kind: "slot", length: num(sel.length, 1000), slots, slotW: Math.min(slotW, 40), hidden: slug.startsWith("sdh") };
  }
  if (GRILLE.test(slug) && p.mode === "rect") {
    const w = num(sel.width, p.limits.wDefault ?? 400);
    const h = num(sel.height, p.limits.hDefault ?? 200);
    return {
      kind: "grille",
      w,
      h,
      double: /^(2-|n-2r)/.test(slug),
      angle: /15-/.test(slug) ? 15 : slug.startsWith("du-") || slug.startsWith("n-") ? 40 : 0,
      pitch: slug.startsWith("l") ? 15 : 20,
    };
  }
  return null;
}
