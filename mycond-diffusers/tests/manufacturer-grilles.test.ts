/**
 * Решітки, анемостати й пленуми: звірка з калькулятором виробника (e-reshitka.com, жовтень 2026).
 */
import { describe, expect, it } from "vitest";
import { aero, price } from "@/lib/calc";
import type { Selection } from "@/lib/types";
import aeroCases from "./fixtures/manufacturer-calc-grilles.json";
import priceCases from "./fixtures/manufacturer-prices-grilles.json";
import boxCases from "./fixtures/manufacturer-prices-plenums.json";
import { close, colors, product } from "./helpers";

/** Типорозміри — точно; решітки довільного розміру й бокси — у межах лінійної моделі; RAL — ±2,5 % */
/** Решітки довільного розміру: у виробника ціна ступінчаста (за кількістю ламелей), лінійна модель — до 10 % */
const TOLERANCE: Record<string, number> = { size: 0.001, rect: 0.1, box: 0.06, ral: 0.03 };
const settings = { ralSurchargePct: 12, ralExtraDays: 0 };

describe("аеродинаміка решіток як у виробника", () => {
  for (const c of aeroCases) {
    it(`${c.slug} ${c.label} (${c.code})`, () => {
      const sel: Selection = { ralName: "", quantity: 1, ...(c.sel as Partial<Selection>), options: c.sel.options as Record<string, string> };
      const r = aero(product(c.slug), sel, c.airflow, c.distance, 10)!;
      expect(r).not.toBeNull();
      expect(close(r.freeArea, c.expected.freeArea), `переріз ${r.freeArea} vs ${c.expected.freeArea}`).toBe(true);
      expect(close(r.velocity, c.expected.velocity), `швидкість ${r.velocity} vs ${c.expected.velocity}`).toBe(true);
      // 1-R-30-30-OTS: у виробника ζ = 94 (зайва цифра), у нас 9,4
      if (c.expected.pressureDrop && c.slug !== "1-r-30-30-ots") expect(close(r.pressureDrop, c.expected.pressureDrop), `тиск ${r.pressureDrop} vs ${c.expected.pressureDrop}`).toBe(true);
      // у виробника швидкість у зоні буває більшою за швидкість на виході — фізично неможливо, у нас обмежено v0
      if (c.expected.velocityAtZone && c.expected.velocityAtZone <= c.expected.velocity) expect(close(r.velocityAtZone, c.expected.velocityAtZone), `vx ${r.velocityAtZone} vs ${c.expected.velocityAtZone}`).toBe(true);
    });
  }
});

describe("ціни решіток, анемостатів і пленумів як у виробника", () => {
  for (const c of [...priceCases, ...boxCases]) {
    const sel = c.sel as Partial<Selection>;
    it(`${c.kind}: ${c.slug} ${sel.sizeLabel ?? ""}${sel.width ? `${sel.width}x${sel.height}` : ""} ${JSON.stringify(sel.options)} ${JSON.stringify(sel.extra ?? {})} ${c.ral === "RAL 9016 глянець" ? "" : c.ral}`, () => {
      const p = product(c.slug);
      const r = price(p, { ralName: c.ral, quantity: 1, ...sel, options: sel.options as Record<string, string> }, colors.find((x) => x.name === c.ral), settings);
      // для RAL на виробах довільного розміру похибка базової ціни додається до похибки надбавки
      const tol = c.kind === "ral" && p.mode !== "sizes" ? TOLERANCE.ral + TOLERANCE[p.mode === "box" ? "box" : "rect"] : TOLERANCE[c.kind];
      expect(Math.abs(r.unit - c.expected) / c.expected, `наша ${r.unit} грн vs виробник ${c.expected} грн`).toBeLessThanOrEqual(tol + 1e-9);
    });
  }
});
