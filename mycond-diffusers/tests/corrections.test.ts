/**
 * Аномалії даних виробника, які ми виправили правдоподібними значеннями (docs/manufacturer-check.md).
 * Перевіряємо, що виправлені значення фізично послідовні.
 */
import { describe, expect, it } from "vitest";
import { aero, price } from "@/lib/calc";
import type { Selection } from "@/lib/types";
import { colors, product } from "./helpers";

const sel = (s: Partial<Selection>): Selection => ({ ralName: "", quantity: 1, options: {}, ...s });
const settings = { ralSurchargePct: 12, ralExtraDays: 0 };

describe("виправлені аномалії", () => {
  it("SD / SDH: опір зменшується, а ΔT у зоні зростає з кількістю щілин", () => {
    for (const slug of ["sd", "sdh"]) {
      const r = [1, 2, 3, 4, 5, 6].map((n) => aero(product(slug), sel({ length: 1000, options: { nslots: String(n) } }), 300, 2, 10)!);
      for (let i = 1; i < r.length; i++) {
        expect(r[i].pressureDrop).toBeLessThan(r[i - 1].pressureDrop);
        expect(r[i].deltaTAtZone!).toBeGreaterThanOrEqual(r[i - 1].deltaTAtZone! - 0.01);
      }
    }
  });

  it("CLT, RSDM: 4 щілини дають меншу швидкість у зоні, ніж 3", () => {
    for (const [slug, w] of [["clt", "50"], ["rsdm", "30"]]) {
      const at = (n: number) => aero(product(slug), sel({ length: 1000, options: { nslots: String(n), nslotswidth: w } }), 300, 2, 10)!.velocityAtZone;
      expect(at(4)).toBeLessThan(at(3));
    }
  });

  it("PDK+R має більший опір, ніж PDK", () => {
    const s = sel({ sizeLabel: "300x300" });
    expect(aero(product("pdk-r"), s, 300, 2, 10)!.pressureDrop).toBeGreaterThan(aero(product("pdk"), s, 300, 2, 10)!.pressureDrop);
  });

  it("DPF-1: живий переріз зростає з розміром", () => {
    const a = product("dpf-1").sizes.map((s) => s.freeArea!);
    for (let i = 1; i < a.length; i++) expect(a[i]).toBeGreaterThan(a[i - 1]);
  });

  it("1-R-30-30-OTS: опір як у 1-R-30-30", () => {
    const s = sel({ width: 300, height: 300 });
    expect(aero(product("1-r-30-30-ots"), s, 300, 2, 10)!.pressureDrop).toBeCloseTo(aero(product("1-r-30-30"), s, 300, 2, 10)!.pressureDrop, 6);
  });

  it("панель 595×595 до PDK 350×350 не дорожча, ніж до 400×400", () => {
    const add = (size: string) => {
      const p = product("pdk");
      const o = (v: string) => price(p, sel({ sizeLabel: size, options: { dsdops: "Без доповнень", dspopt: v } }), undefined, settings).unit;
      return o("Так") - o("Ні");
    };
    expect(add("350x350")).toBeLessThanOrEqual(add("400x400"));
  });

  it("VDL, DVA: колір RAL змінює ціну", () => {
    const ral = colors.find((c) => !c.isStandard)!;
    for (const slug of ["vdl", "dva"]) {
      const p = product(slug);
      const s = sel({ sizeLabel: p.sizes[0].label });
      expect(price(p, { ...s, ralName: ral.name }, ral, settings).unit).toBeGreaterThan(price(p, s, undefined, settings).unit);
    }
  });

  it("CLT: демпфер для 2 щілин дорожчий, ніж для 1", () => {
    const p = product("clt");
    const d = (n: string) => {
      const o = (a: string) => price(p, sel({ length: 1000, options: { nslots: n, nslotswidth: "50", edges: "2", sladditions: a } }), undefined, settings).unit;
      return o("Наявність демпфера") - o("Без доповнень");
    };
    expect(d("2")).toBeGreaterThan(d("1"));
  });

  it("RSD: без торців не дорожче, ніж з двома", () => {
    const p = product("rsd");
    const e = (n: string) => price(p, sel({ length: 1000, options: { nslots: "1", nslotswidth: "20", sladditions: "Без доповнень", edges: n } }), undefined, settings).unit;
    expect(e("1")).toBeLessThan(e("2"));
    expect(e("0")).toBeLessThan(e("1"));
  });
});
