import { aero, chosen, visibleGroups } from "./calc";
import { formatters } from "./format";
import type { CartItem, ProductData, Selection } from "./types";

export interface DetailLabels {
  size: string;
  sizeWH: string;
  length: string;
  angle: string;
  color: string;
  calc: string;
  mm: string;
  airflowUnit: string;
  velocityUnit: string;
  pressureUnit: string;
}

/**
 * Рядки «параметр: значення» для позиції заявки. Клієнт будує їх мовою сайту,
 * сервер — ще раз українською для менеджера (з тих самих даних вибору).
 */
export function itemDetails(p: ProductData, sel: Selection, calc: CartItem["calc"], l: DetailLabels, locale: string, ralText: (name: string) => string = (n) => n): CartItem["details"] {
  const { num } = formatters(locale);
  const lim = p.limits;
  const d: CartItem["details"] = [];
  if (p.mode === "sizes") d.push({ label: l.size, value: sel.sizeLabel ?? "" });
  if (p.mode === "rect") d.push({ label: l.sizeWH, value: `${sel.width}×${sel.height} ${l.mm}` });
  if (p.mode === "slot") d.push({ label: l.length, value: `${sel.length} ${l.mm}` });
  if (p.mode === "slot" && lim.angleMin) d.push({ label: l.angle, value: `${sel.angle}°` });
  for (const e of lim.extra ?? []) d.push({ label: e.label, value: `${sel.extra?.[e.key] ?? e.default}${e.unit ? ` ${e.unit}` : ""}` });
  for (const g of visibleGroups(p, sel)) d.push({ label: g.label, value: chosen(p, g, sel)?.label ?? "" });
  d.push({ label: l.color, value: ralText(sel.ralName) });
  const r = calc && p.calc.enabled !== false && p.mode !== "box" ? aero(p, sel, calc.airflow, calc.distance, calc.deltaT) : null;
  if (r && calc) d.push({ label: l.calc, value: `${calc.airflow} ${l.airflowUnit} · ${num(r.velocity, 1)} ${l.velocityUnit} · ${num(r.pressureDrop, 0)} ${l.pressureUnit}` });
  return d;
}

/** Підписи з файлу повідомлень (src/messages/<мова>.json) */
export function detailLabels(m: { details: Record<string, string>; common: Record<string, string>; configurator: { units: Record<string, string> } }): DetailLabels {
  return {
    size: m.details.size,
    sizeWH: m.details.sizeWH,
    length: m.details.length,
    angle: m.details.angle,
    color: m.details.color,
    calc: m.details.calc,
    mm: m.common.mm,
    airflowUnit: m.configurator.units.airflow,
    velocityUnit: m.configurator.units.velocity,
    pressureUnit: m.configurator.units.pressure,
  };
}
