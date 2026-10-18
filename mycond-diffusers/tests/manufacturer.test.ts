/**
 * Звірка з програмою підбору виробника (відповіді калькулятора e-reshitka.com, жовтень 2026).
 * Наш розрахунок має відтворювати їхні цифри для кожної моделі та розміру.
 */
import { describe, expect, it } from "vitest";
import { aero } from "@/lib/calc";
import type { Selection } from "@/lib/types";
import { close, product } from "./helpers";
import cases from "./fixtures/manufacturer-calc.json";

/** Явні помилки в даних виробника, які ми свідомо виправили */
const KNOWN_ERRORS = new Set(["rda-s 600x600 p48"]);



describe("збіг з калькулятором виробника", () => {
  for (const c of cases) {
    const id = `${c.slug} ${c.label}`;
    if (KNOWN_ERRORS.has(id)) continue;
    it(`${id} @ ${c.airflow} м³/год, ${c.distance} м (${c.code})`, () => {
      const sel: Selection = { ralName: "", quantity: 1, ...(c.sel as Partial<Selection>), options: c.sel.options as Record<string, string> };
      const r = aero(product(c.slug), sel, c.airflow, c.distance, 10)!;
      expect(r).not.toBeNull();
      const got = { freeArea: r.freeArea, velocity: r.velocity, velocityAtZone: r.velocityAtZone, pressureDrop: r.pressureDrop, deltaT: r.deltaTAtZone ?? 0 };
      for (const k of Object.keys(c.expected) as (keyof typeof got)[]) {
        expect(close(got[k], c.expected[k]), `${k}: наш ${got[k].toFixed(4)} vs виробник ${c.expected[k]}`).toBe(true);
      }
    });
  }
});
