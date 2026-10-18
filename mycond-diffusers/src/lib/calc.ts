import type { Choice, OptionGroup, ProductData, RalData, RectPricing, Selection, ShopSettings, SizeRow, SlotPricing } from "./types";

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

/** Коефіцієнти з урахуванням уточнень для конкретної к-сті/ширини щілин */
export function coefs(p: ProductData, sel: Selection) {
  const c = p.calc;
  const by = c.byKey ?? {};
  const o = (p.mode === "slot" && (by[`${nSlots(sel)}x${slotWidth(p, sel)}`] ?? by[String(nSlots(sel))])) || {};
  return { zeta: o.zeta ?? c.zeta, throwK: o.throwK ?? c.throwK, tempK: o.tempK ?? c.tempK };
}

/**
 * Аеродинамічний розрахунок (та сама модель, що й у програмі підбору виробника):
 *  v0 = Q / (3600·A0)                 — швидкість у живому перерізі
 *  dP = ζ·ρ·v0²/2                     — втрата тиску
 *  компактний струмінь: vx = K·v0·√A0 / x,   ΔTx = n·ΔT0·√A0 / x
 *  плаский (щілинний):  vx = K·v0·√(b / x),  ΔTx = n·ΔT0·√(b / x),  b — ефективна ширина однієї щілини
 */
export function aero(
  p: ProductData,
  sel: Selection,
  airflow: number,
  distance: number,
  deltaT0: number | null,
  size?: SizeRow,
): AeroResult | null {
  if (p.calc.enabled === false) return null;
  const a = freeArea(p, sel, size);
  if (!(a > 0) || !(airflow > 0)) return null;
  const k = coefs(p, sel);
  const v0 = airflow / 3600 / a;
  const dp = (k.zeta * AIR_DENSITY * v0 * v0) / 2;
  const x = Math.max(distance, 0.1);
  const plane = p.mode === "slot" && p.calc.jet !== "compact";
  // для плаского струменя — ширина однієї щілини, м
  const decay = plane ? Math.sqrt(a / (nSlots(sel) * ((sel.length ?? 0) / 1000)) / x) : Math.sqrt(a) / x;
  const vx = Math.min(v0, k.throwK * v0 * decay);
  const dT = deltaT0 ? Math.min(Math.abs(deltaT0), k.tempK * Math.abs(deltaT0) * decay) : null;
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
  if (p.mode !== "sizes" || p.calc.enabled === false) return undefined;
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

/** Групи опцій, видимі при поточному виборі (з урахуванням showIf) */
export function visibleGroups(p: ProductData, sel: Selection): OptionGroup[] {
  return p.options.filter((g) => !g.showIf || g.showIf.values.includes(sel.options[g.showIf.key] ?? p.options.find((x) => x.key === g.showIf!.key)?.default ?? ""));
}

/** Чи доступний варіант для обраного типорозміру */
export function choiceAvailable(p: ProductData, c: Choice, sel: Selection): boolean {
  if (p.mode !== "sizes" || !c.priceBySize || !Object.keys(c.priceBySize).length) return true;
  return sel.sizeLabel !== undefined && sel.sizeLabel in c.priceBySize;
}

/** Обраний варіант групи: явний вибір, якщо доступний, інакше перший доступний */
export function chosen(p: ProductData, g: OptionGroup, sel: Selection): Choice | undefined {
  const want = g.choices.find((c) => c.value === (sel.options[g.key] ?? g.default));
  if (want && choiceAvailable(p, want, sel)) return want;
  return g.choices.find((c) => choiceAvailable(p, c, sel));
}

function choiceAdd(p: ProductData, c: Choice, sel: Selection): number {
  if (p.mode === "sizes" && c.priceBySize && sel.sizeLabel && sel.sizeLabel in c.priceBySize) return c.priceBySize[sel.sizeLabel];
  let add = c.priceAdd || 0;
  if (p.mode === "slot") {
    const n = nSlots(sel);
    const m = (sel.length ?? 0) / 1000;
    add += (c.pricePerSlot || 0) * n + (c.pricePerM || 0) * m + (c.pricePerSlotM || 0) * n * m;
  }
  return add;
}

export function basePrice(p: ProductData, sel: Selection): number {
  if (p.mode === "sizes") return findSize(p, sel)?.price ?? 0;
  if (p.mode === "rect") {
    const pr = p.pricing as RectPricing;
    const w = (sel.width ?? 0) / 1000;
    const h = (sel.height ?? 0) / 1000;
    if (!pr.perM2 && !pr.perM) return 0;
    return Math.max(pr.min || 0, (pr.fixed || 0) + (pr.perM2 || 0) * w * h + (pr.perM || 0) * 2 * (w + h));
  }
  const pr = p.pricing as SlotPricing;
  const len = Math.max(sel.length ?? 0, pr.minLengthMm || 0) / 1000;
  const n = nSlots(sel);
  const keys = Object.keys(pr.byKey ?? {});
  // точний ключ «n x ширина», потім «n», потім найближча ширина для тієї ж кількості щілин
  const key =
    [`${n}x${slotWidth(p, sel)}`, String(n)].find((k) => keys.includes(k)) ??
    keys
      .filter((k) => k.startsWith(`${n}x`))
      .sort((a, b) => Math.abs(+a.split("x")[1] - slotWidth(p, sel)) - Math.abs(+b.split("x")[1] - slotWidth(p, sel)))[0];
  const row = key ? pr.byKey![key] : undefined;
  if (row) return row.fixed + row.perMeter * len;
  if (!pr.perMeter) return 0;
  const slots = 1 + (n - 1) * ((pr.perExtraSlotPct ?? 0) / 100);
  return ((pr.fixed || 0) + pr.perMeter * len) * slots;
}

export function price(
  p: ProductData,
  sel: Selection,
  ral: RalData | undefined,
  settings: Pick<ShopSettings, "ralSurchargePct" | "ralExtraDays">,
): PriceResult {
  const base = basePrice(p, sel);
  let pct = 0;
  let add = 0;
  for (const g of visibleGroups(p, sel)) {
    const c = chosen(p, g, sel);
    if (c) {
      pct += c.pricePct || 0;
      add += choiceAdd(p, c, sel);
    }
  }
  const options = (base * pct) / 100 + add;
  const nonStandard = !!ral && !ral.isStandard;
  const ralPct = nonStandard ? (ral.surchargePct ?? settings.ralSurchargePct) : 0;
  const ralFactor = (p.pricing as { ralFactor?: number }).ralFactor ?? 1;
  // фарбується весь виріб — надбавка від ціни з опціями
  const ralCost = ((base + options) * ralPct * ralFactor) / 100;
  const unit = Math.round(base + options + ralCost);
  const qty = Math.max(1, Math.floor(sel.quantity || 1));
  return {
    base: round2(base),
    options: round2(options),
    ral: round2(ralCost),
    unit,
    total: unit * qty,
    leadDays: p.leadDays + (nonStandard && ralCost > 0 ? settings.ralExtraDays : 0),
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
