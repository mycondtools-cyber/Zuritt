import type { ProductData, Selection, SizeRow, SlotPricing, RectPricing, RalData, ShopSettings } from "./types";

export const AIR_DENSITY = 1.2;

export type Level = "good" | "ok" | "bad";

export interface AeroResult {
  freeArea: number;
  velocity: number;
  velocityAtZone: number;
  pressureDrop: number;
  deltaTAtZone: number | null;
  levels: { velocity: Level; velocityAtZone: Level; pressureDrop: Level };
}

/** Пороги, за якими даємо підказки (типові рекомендації для житлових і громадських приміщень) */
export const LIMITS = {
  velocity: { good: 3, ok: 5 },
  velocityAtZone: { good: 0.25, ok: 0.5 },
  pressureDrop: { good: 30, ok: 60 },
};

const level = (v: number, t: { good: number; ok: number }): Level => (v <= t.good ? "good" : v <= t.ok ? "ok" : "bad");

export function sizeDims(s: SizeRow): { w: number; h: number; d: number } {
  return { w: s.w ?? 0, h: s.h ?? 0, d: s.d ?? 0 };
}

function nSlots(sel: Selection): number {
  const n = parseInt(sel.options.nslots ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function slotWidth(p: ProductData, sel: Selection): number {
  const w = parseInt(sel.options.nslotswidth ?? "", 10);
  return Number.isFinite(w) && w > 0 ? w : p.calc.slotWidthMm ?? 20;
}

export function findSize(p: ProductData, sel: Selection): SizeRow | undefined {
  return p.sizes.find((s) => s.label === sel.sizeLabel);
}

/** Живий переріз, м² */
export function freeArea(p: ProductData, sel: Selection, size?: SizeRow): number {
  const k = p.calc.areaCoef || 0;
  if (p.mode === "sizes") {
    const s = size ?? findSize(p, sel);
    if (!s) return 0;
    if (s.freeArea) return s.freeArea;
    const { w, h, d } = sizeDims(s);
    if (d) return (k * Math.PI * (d / 1000) ** 2) / 4;
    return (k * w * h) / 1e6;
  }
  if (p.mode === "rect") return (k * (sel.width ?? 0) * (sel.height ?? 0)) / 1e6;
  return (k * nSlots(sel) * slotWidth(p, sel) * (sel.length ?? 0)) / 1e6;
}

/**
 * Орієнтовний аеродинамічний розрахунок:
 *  v0 = Q / (3600·A0)          — швидкість у живому перерізі
 *  dP = ζ·ρ·v0²/2              — втрата тиску
 *  vx = K·v0·√A0 / x           — швидкість струменя на відстані x (не більше v0)
 *  ΔTx = n·ΔT0·√A0 / x         — залишкова різниця температур у робочій зоні
 */
export function aero(
  p: ProductData,
  sel: Selection,
  airflow: number,
  distance: number,
  deltaT0: number | null,
  size?: SizeRow,
): AeroResult | null {
  const a = freeArea(p, sel, size);
  if (!(a > 0) || !(airflow > 0)) return null;
  const v0 = airflow / 3600 / a;
  const dp = (p.calc.zeta * AIR_DENSITY * v0 * v0) / 2;
  const x = Math.max(distance, 0.1);
  const vx = Math.min(v0, (p.calc.throwK * v0 * Math.sqrt(a)) / x);
  const dT = deltaT0 ? Math.min(Math.abs(deltaT0), (p.calc.tempK * Math.abs(deltaT0) * Math.sqrt(a)) / x) : null;
  return {
    freeArea: a,
    velocity: v0,
    velocityAtZone: vx,
    pressureDrop: dp,
    deltaTAtZone: dT,
    levels: {
      velocity: level(v0, LIMITS.velocity),
      velocityAtZone: level(vx, LIMITS.velocityAtZone),
      pressureDrop: level(dp, LIMITS.pressureDrop),
    },
  };
}

/** Найменший типорозмір, на якому швидкість і тиск у «зеленій» зоні */
export function recommendSize(p: ProductData, sel: Selection, airflow: number, distance: number): SizeRow | undefined {
  if (p.mode !== "sizes") return undefined;
  const sorted = [...p.sizes].sort((a, b) => freeArea(p, sel, a) - freeArea(p, sel, b));
  const ok = (s: SizeRow, lvl: Level[]) => {
    const r = aero(p, { ...sel, sizeLabel: s.label }, airflow, distance, null, s);
    return r && lvl.includes(r.levels.velocity) && lvl.includes(r.levels.velocityAtZone) && lvl.includes(r.levels.pressureDrop);
  };
  return sorted.find((s) => ok(s, ["good"])) ?? sorted.find((s) => ok(s, ["good", "ok"])) ?? sorted[sorted.length - 1];
}

/** Мінімальна довжина щілинного / к-сть щілин не підбираємо — лише радимо довжину для заданої к-сті щілин */
export function recommendSlotLength(p: ProductData, sel: Selection, airflow: number): number | undefined {
  if (p.mode !== "slot") return undefined;
  const perMm = freeArea(p, { ...sel, length: 1 });
  if (!(perMm > 0)) return undefined;
  const need = airflow / 3600 / LIMITS.velocity.good / perMm;
  const step = p.limits.step ?? 5;
  const min = p.limits.lMin ?? 0;
  const max = p.limits.lMax ?? 3000;
  return Math.min(max, Math.max(min, Math.ceil(need / step) * step));
}

export interface PriceResult {
  base: number;
  options: number;
  ral: number;
  unit: number;
  total: number;
  leadDays: number;
  onRequest: boolean;
}

export function price(
  p: ProductData,
  sel: Selection,
  ral: RalData | undefined,
  settings: Pick<ShopSettings, "ralSurchargePct" | "ralExtraDays">,
): PriceResult {
  let base = 0;
  if (p.mode === "sizes") {
    base = findSize(p, sel)?.price ?? 0;
  } else if (p.mode === "rect") {
    const pr = p.pricing as RectPricing;
    const m2 = ((sel.width ?? 0) * (sel.height ?? 0)) / 1e6;
    base = pr.perM2 ? Math.max(pr.min || 0, pr.perM2 * m2) : 0;
  } else {
    const pr = p.pricing as SlotPricing;
    const len = Math.max(sel.length ?? 0, pr.minLengthMm || 0) / 1000;
    const slots = 1 + (nSlots(sel) - 1) * ((pr.perExtraSlotPct ?? 0) / 100);
    base = (pr.perMeter || 0) * len * slots;
  }

  let pct = 0;
  let add = 0;
  for (const g of p.options) {
    const c = g.choices.find((c) => c.value === (sel.options[g.key] ?? g.default));
    if (c) {
      pct += c.pricePct || 0;
      add += c.priceAdd || 0;
    }
  }
  const options = (base * pct) / 100 + add;
  const nonStandard = !!ral && !ral.isStandard;
  const ralCost = nonStandard ? (base * settings.ralSurchargePct) / 100 : 0;
  const unit = round2(base + options + ralCost);
  const qty = Math.max(1, Math.floor(sel.quantity || 1));
  return {
    base: round2(base),
    options: round2(options),
    ral: round2(ralCost),
    unit,
    total: round2(unit * qty),
    leadDays: p.leadDays + (nonStandard ? settings.ralExtraDays : 0),
    onRequest: base <= 0,
  };
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Рядок маркування, як у прикладах замовлення виробника: «PDK (RAL 9016) 400x400» */
export function specString(p: ProductData, sel: Selection): string {
  const ral = sel.ralName ? ` (${sel.ralName.replace(/ глянець| мат/, (m) => (m.includes("мат") ? "M" : ""))})` : "";
  let dims = "";
  if (p.mode === "sizes") dims = sel.sizeLabel ?? "";
  else if (p.mode === "rect") dims = `${sel.width}x${sel.height}`;
  else dims = `${nSlots(sel)}x${slotWidth(p, sel)} L=${sel.length}${sel.angle ? ` ${sel.angle}°` : ""}`;
  return `${p.code}${ral} ${dims}`.trim();
}

/** Витрата повітря за кратністю: Q = S·H·n */
export function airflowByRoom(area: number, height: number, changes: number): number {
  return Math.round(area * height * changes);
}
