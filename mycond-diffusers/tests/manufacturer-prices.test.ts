/**
 * Звірка цін з калькулятором виробника (e-reshitka.com, жовтень 2026).
 * Типорозміри та доплати опцій — точно; щілинні, панелі довільного розміру та RAL — у межах допуску моделі.
 */
import { describe, expect, it } from "vitest";
import { price } from "@/lib/calc";
import type { Selection } from "@/lib/types";
import { colors, product } from "./helpers";
import cases from "./fixtures/manufacturer-prices.json";

const TOLERANCE: Record<string, number> = { size: 0.001, option: 0.001, rect: 0.035, slot: 0.05, ral: 0.025 };
/** У RSDM ціна виробника має стрибок на 2 щілинах — лінійна модель відхиляється до 7,5 % */
const SLOT_TOLERANCE: Record<string, number> = { rsdm: 0.075 };


const settings = { ralSurchargePct: 12, ralExtraDays: 0 };

describe("ціни як у виробника", () => {
  for (const c of cases) {
    const sel = c.sel as Partial<Selection>;
    const name = `${c.kind}: ${c.slug} ${sel.sizeLabel ?? ""}${sel.width ? `${sel.width}x${sel.height}` : ""}${sel.length ? `L${sel.length}` : ""} ${JSON.stringify(sel.options)} ${c.ral === "RAL 9016 глянець" ? "" : c.ral}`;
    it(name, () => {
      const r = price(product(c.slug), { ralName: c.ral, quantity: 1, ...sel, options: sel.options as Record<string, string> }, colors.find((x) => x.name === c.ral), settings);
      const tol = (c.kind === "slot" && SLOT_TOLERANCE[c.slug]) || TOLERANCE[c.kind];
      expect(Math.abs(r.unit - c.expected) / c.expected, `наша ${r.unit} грн vs виробник ${c.expected} грн`).toBeLessThanOrEqual(tol + 1e-9);
    });
  }
});
