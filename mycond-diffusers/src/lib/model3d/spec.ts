/**
 * Опис параметричної 3D-моделі за обраним виробом і розмірами (без three.js — легкий модуль, тестується).
 * Усі розміри — у мм. Геометрію будує src/lib/model3d/build.ts.
 */
import type { ProductData, Selection } from "../types";

/** Вигляд лицьової частини решітки: класичні ламелі, жалюзі (зовнішні/дверні), гравітаційні пластини, перфорація, лінійні бруски */
export type GrilleStyle = "blades" | "louvre" | "flaps" | "perforated" | "bars";

/** Візерунок стельової панелі */
export type PanelPattern = "radial" | "square" | "dimple-grid" | "dimple-ring" | "swirl" | "star";

export type ModelSpec =
  | { kind: "square-ceiling"; size: number; cones: number; adjustable: boolean }
  | { kind: "round-ceiling"; d: number }
  | {
      kind: "grille";
      w: number;
      h: number;
      double: boolean;
      angle: number;
      pitch: number;
      style?: GrilleStyle;
      /** Ширина ламелі (жалюзі), мм */
      chord?: number;
      /** Перфорація: шестикутні чи квадратні отвори */
      perf?: "hex" | "square";
      /** За перфорацією — регулювальні жалюзі (PF-30-60) */
      behind?: boolean;
      /** Сітка / фільтр за жалюзі */
      mesh?: boolean;
      /** Ширина лицьової рамки, мм */
      frame?: number;
    }
  | { kind: "slot"; length: number; slots: number; slotW: number; hidden: boolean; corner?: boolean; track?: boolean }
  | { kind: "disc"; d: number; exhaust: boolean }
  | { kind: "panel"; w: number; h: number; pattern: PanelPattern; count: number }
  | { kind: "quad"; w: number; h: number }
  | { kind: "swirl-round"; d: number; blades: number; flange: number }
  | { kind: "bell"; d: number }
  | { kind: "cde"; d: number }
  | { kind: "plaster"; d: number; square: boolean }
  | { kind: "nozzle"; d: number }
  | { kind: "round-grille"; d: number }
  | {
      kind: "box";
      /** Ширина × довжина × висота корпусу, мм */
      a: number;
      b: number;
      h: number;
      connD: number;
      conns: number;
      /** Патрубок зверху під вихровий дифузор (PB-VD), мм */
      top?: number;
      /** Горловина під щілинний дифузор (PS), мм */
      neck?: number;
      /** Отвори під гнучкі труби (AF, FLX): кількість, діаметр, рядів */
      holes?: { n: number; d: number; rows: number };
    };

const SLOT = new Set(["sd", "sd-d", "sd-p", "sdh", "sdh-d", "sdh-p", "sdt", "rsd", "sda", "sdha", "clt", "rsdm"]);
const DISC = new Set(["kn", "kw", "kpp", "svf", "evf", "vs"]);
// решітки з ламелями: регульовані/нерегульовані, радіальні, лінійні, димовидалення, сталеві, зовнішні з ламелями
const GRILLE = /^(1-|2-|l-|l15-|lh-|lhc-|lr-|lr15-|nr-ots|r-30-20|du-|sg$|ssg$|n-)/;

/** Решітки інших конструкцій: стиль лицьової частини та пропорції серії */
const GRILLE_STYLE: Record<string, Partial<Extract<ModelSpec, { kind: "grille" }>>> = {
  "d-30-30": { style: "louvre", chord: 30, pitch: 22, angle: 40, frame: 20 },
  "g-30-70": { style: "louvre", chord: 70, pitch: 62, angle: 45, mesh: true, frame: 21 },
  "ge-30-50": { style: "louvre", chord: 50, pitch: 44, angle: 42, frame: 18 },
  "nf-45-50": { style: "louvre", chord: 50, pitch: 46, angle: 40, mesh: true, frame: 24 },
  sge: { style: "louvre", chord: 26, pitch: 30, angle: 38, frame: 22 },
  mvm: { style: "louvre", chord: 14, pitch: 13, angle: 45, frame: 14 },
  "gv-p-25-35": { style: "flaps", pitch: 35, angle: 12, frame: 20 },
  "gv-p-35-45": { style: "flaps", pitch: 45, angle: 12, frame: 20 },
  "pf-30-05": { style: "perforated", perf: "hex", pitch: 7, frame: 20 },
  "pf-30-30": { style: "perforated", perf: "square", pitch: 11, frame: 20 },
  "pf-30-60": { style: "perforated", perf: "hex", pitch: 7, behind: true, frame: 20 },
  rg: { style: "bars", pitch: 12, frame: 6 },
};

const PANEL: Record<string, PanelPattern> = { dcc: "radial", dcs: "square", "dpf-1": "dimple-grid", "dpf-3": "dimple-ring", "rda-s": "swirl", "rdc-s": "star" };

/** Вироби на стіні / фасаді: вигляд збоку, а не знизу */
const WALL_KINDS = new Set<ModelSpec["kind"]>(["grille", "nozzle", "round-grille"]);

export function surfaceOf(m: ModelSpec): "ceiling" | "wall" {
  return WALL_KINDS.has(m.kind) && !(m.kind === "grille" && m.style === "bars") ? "wall" : "ceiling";
}

const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : d);

/** Розміри обраного типорозміру: Ш×В або діаметр, а також число після «/» (кількість отворів / лопаток) */
function sizeDims(p: ProductData, sel: Selection) {
  const s = p.sizes.find((x) => x.label === sel.sizeLabel) ?? p.sizes[0];
  if (!s) return { w: 0, h: 0, d: 0, n: 0 };
  const m = s.label.match(/(\d+)\s*[xх×]\s*(\d+)/);
  const md = s.label.match(/[DØ]\s*(\d+)/i);
  const mn = s.label.match(/\/(\d+)/);
  return { w: s.w ?? (m ? +m[1] : 0), h: s.h ?? (m ? +m[2] : 0), d: s.d ?? (md ? +md[1] : 0), n: mn ? +mn[1] : 0 };
}

/** Ш×В виробу довільного розміру (рамкова решітка, панель) */
function rectDims(p: ProductData, sel: Selection) {
  return { w: num(sel.width, p.limits.wDefault ?? 400), h: num(sel.height, p.limits.hDefault ?? 200) };
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
    const corner = slug === "sda" || slug === "sdha";
    return {
      kind: "slot",
      length: num(sel.length, p.limits.lDefault ?? 1000),
      slots,
      slotW: Math.min(slotW, 50),
      hidden: slug.startsWith("sdh") || slug === "clt" || slug === "rsdm",
      ...(corner ? { corner: true } : {}),
      ...(slug === "clt" ? { track: true } : {}),
    };
  }
  if (PANEL[slug]) {
    const { w, h, n } = p.mode === "sizes" ? sizeDims(p, sel) : { ...rectDims(p, sel), n: 0 };
    if (!w) return null;
    return { kind: "panel", w, h: h || w, pattern: PANEL[slug], count: n || (slug === "dpf-3" ? 16 : 0) };
  }
  if (slug === "rd") return { kind: "quad", ...rectDims(p, sel) };
  if (slug === "drp" || slug === "vdl") {
    const { d } = sizeDims(p, sel);
    if (!d) return null;
    // DRP за кресленням: фланець D1 ≈ 1.4–1.5·D; VDL — вужчий фланець і 8 лопаток
    return slug === "drp" ? { kind: "swirl-round", d, blades: d >= 400 ? 24 : 16, flange: Math.round(d * (d <= 250 ? 1.48 : 1.42)) } : { kind: "swirl-round", d, blades: 8, flange: Math.round(d * 1.3) };
  }
  if (slug === "dva" || slug === "cde" || slug === "jn" || slug === "elc") {
    const { d } = sizeDims(p, sel);
    if (!d) return null;
    return slug === "dva" ? { kind: "bell", d } : slug === "cde" ? { kind: "cde", d } : slug === "jn" ? { kind: "nozzle", d } : { kind: "round-grille", d };
  }
  if (slug === "crl" || slug === "pcr" || slug === "sqr") {
    const { d } = sizeDims(p, sel);
    return d ? { kind: "plaster", d, square: slug === "sqr" } : null;
  }
  if (p.mode === "box") {
    const x = sel.extra ?? {};
    const def = (k: string, d: number) => num(x[k], p.limits.extra?.find((e) => e.key === k)?.default ?? d);
    const connD = def("connD", 160);
    const conns = Math.max(1, Math.min(10, Math.round(def("connCount", 1))));
    if (slug === "af-box" || slug === "flx-box") {
      const hd = num(Number(sel.options?.holeDia), slug === "af-box" ? 75 : 63);
      const rows = Math.max(1, Math.min(3, parseInt(sel.options?.rows ?? "2", 10) || 2));
      const n = Math.max(1, Math.round(def("holesC", 2)) + Math.round(num(x.holesL, 0)) + Math.round(num(x.holesR, 0)));
      const cols = Math.ceil(n / rows);
      const pitch = hd + 25;
      return { kind: "box", a: cols * pitch + 40, b: Math.max(300, connD + 200), h: rows * pitch + 30, connD, conns: 1, holes: { n, d: hd, rows } };
    }
    if (slug === "pb-vd") {
      const a = def("a", 300);
      return { kind: "box", a, b: a, h: def("h", 300), connD, conns, top: def("vd", 250) };
    }
    if (slug === "ps") return { kind: "box", a: def("b", 200), b: def("a", 1000), h: def("h", 250), connD, conns, neck: def("neck", 100) };
    return { kind: "box", a: def("a", 300), b: def("b", 600), h: def("h", 300), connD, conns };
  }
  if (GRILLE_STYLE[slug] && p.mode !== "sizes") {
    const { w, h } = rectDims(p, sel);
    return { kind: "grille", w, h, double: false, angle: 0, pitch: 20, ...GRILLE_STYLE[slug] };
  }
  if (slug === "mvm") {
    const { w, h } = sizeDims(p, sel);
    return w ? { kind: "grille", w, h: h || w, double: false, angle: 0, pitch: 20, ...GRILLE_STYLE.mvm } : null;
  }
  if (GRILLE.test(slug) && p.mode === "rect") {
    const { w, h } = rectDims(p, sel);
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
