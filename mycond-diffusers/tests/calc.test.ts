import { describe, expect, it } from "vitest";
import { aero, freeArea, jet, price, recommendSize, recommendSlotLength, specString } from "@/lib/calc";
import { product } from "./helpers";
import type { ProductData, Selection } from "@/lib/types";

const square: ProductData = {
  id: 1, slug: "pdk", code: "PDK", name: "Дифузор PDK", mode: "sizes", shape: "square", leadDays: 5,
  options: [
    { key: "dsdops", label: "Доповнення", hint: "", default: "Без доповнень", choices: [
      { value: "Без доповнень", label: "Без доповнень", priceAdd: 0, pricePct: 0 },
      { value: "Регульований", label: "Регульований", priceAdd: 0, pricePct: 20 },
    ] },
    { key: "dspopt", label: "Панель", hint: "", default: "Ні", choices: [
      { value: "Ні", label: "Ні", priceAdd: 0, pricePct: 0 },
      { value: "Так", label: "Так", priceAdd: 350, pricePct: 0 },
    ] },
  ],
  calc: { areaCoef: 0.33, zeta: 3, throwK: 1.8, tempK: 1.4 },
  pricing: {}, limits: {},
  sizes: [
    { label: "150x150", w: 150, h: 150, d: null, freeArea: null, price: 800, sort: 0 },
    { label: "300x300", w: 300, h: 300, d: null, freeArea: null, price: 1200, sort: 1 },
    { label: "600x600", w: 600, h: 600, d: null, freeArea: null, price: 2500, sort: 2 },
  ],
};
const sel = (o: Partial<Selection> = {}): Selection => ({ options: {}, ralName: "RAL 9016 глянець", quantity: 1, ...o });
const settings = { ralSurchargePct: 15, ralExtraDays: 3 };

describe("aero", () => {
  it("computes velocity and pressure drop from free area", () => {
    const r = aero(square, sel({ sizeLabel: "300x300" }), 300, 2, null)!;
    expect(r.freeArea).toBeCloseTo(0.0297, 4);
    expect(r.velocity).toBeCloseTo(300 / 3600 / 0.0297, 3);
    expect(r.pressureDrop).toBeCloseTo((3 * 1.2 * r.velocity ** 2) / 2, 6);
    expect(r.velocityAtZone).toBeLessThan(r.velocity);
  });

  it("uses catalogue free area when given (gypsum CRL Ø125 @100 m³/h ≈ 34 Pa)", () => {
    const crl: ProductData = { ...square, mode: "sizes", calc: { areaCoef: 1, zeta: 2.55, throwK: 2.7, tempK: 2 },
      sizes: [{ label: "D125", w: null, h: null, d: 125, freeArea: 0.00589, price: 0, sort: 0 }] };
    const r = aero(crl, sel({ sizeLabel: "D125" }), 100, 3, null)!;
    expect(r.pressureDrop).toBeGreaterThan(30);
    expect(r.pressureDrop).toBeLessThan(38);
  });

  it("recommends the smallest comfortable size", () => {
    expect(recommendSize(square, sel(), 80, 2.5)?.label).toBe("150x150");
    expect(recommendSize(square, sel(), 250, 4)?.label).toBe("300x300");
    expect(recommendSize(square, sel(), 900, 2.5)?.label).toBe("600x600");
  });

  it("returns null without size or airflow", () => {
    expect(aero(square, sel(), 300, 2, null)).toBeNull();
    expect(aero(square, sel({ sizeLabel: "300x300" }), 0, 2, null)).toBeNull();
  });
});

describe("slot", () => {
  const slot: ProductData = { ...square, code: "SD", mode: "slot", shape: "slot", options: [],
    calc: { areaCoef: 0.6, zeta: 2.5, throwK: 2.4, tempK: 1.9, slotWidthMm: 20 },
    pricing: { perMeter: 1000, perExtraSlotPct: 50, minLengthMm: 500 }, limits: { lMin: 150, lMax: 3000, step: 5 }, sizes: [] };

  it("area scales with slots and length", () => {
    expect(freeArea(slot, sel({ length: 1000, options: { nslots: "2" } }))).toBeCloseTo(0.024, 6);
  });
  it("price per meter with extra slots and min length", () => {
    expect(price(slot, sel({ length: 1000, options: { nslots: "3" } }), undefined, settings).unit).toBe(2000);
    expect(price(slot, sel({ length: 200, options: { nslots: "1" } }), undefined, settings).unit).toBe(500);
  });
  it("recommends length for target velocity", () => {
    const l = recommendSlotLength(slot, sel({ options: { nslots: "1" } }), 100)!;
    expect(l % 5).toBe(0);
    expect(aero(slot, sel({ length: l, options: { nslots: "1" } }), 100, 2, null)!.velocity).toBeLessThanOrEqual(3);
  });
});

describe("price", () => {
  it("adds option % / fixed and RAL surcharge", () => {
    const r = price(square, sel({ sizeLabel: "300x300", quantity: 3, options: { dsdops: "Регульований", dspopt: "Так" } }),
      { id: 1, code: "RAL 9005", name: "RAL 9005 глянець", hex: "#000", finish: "gloss", isStandard: false, popular: true }, settings);
    expect(r.base).toBe(1200);
    expect(r.options).toBe(240 + 350);
    expect(r.ral).toBe(268.5); // 15 % від ціни з опціями (1200 + 590)
    expect(r.unit).toBe(2059);
    expect(r.total).toBe(6177);
    expect(r.leadDays).toBe(8);
  });
  it("is on request when no base price", () => {
    expect(price({ ...square, sizes: [{ ...square.sizes[0], price: 0 }] }, sel({ sizeLabel: "150x150" }), undefined, settings).onRequest).toBe(true);
  });
  it("builds spec string", () => {
    expect(specString(square, sel({ sizeLabel: "400x400", ralName: "RAL 9005 мат" }))).toBe("PDK (RAL 9005M) 400x400");
  });
});


describe("профіль струменя (схема руху повітря)", () => {
  it("збігається зі швидкістю в робочій зоні з aero() і спадає з відстанню", () => {
    const cases: [string, Partial<Selection>][] = [
      ["pdk", { sizeLabel: "300x300" }],
      ["sd", { length: 1000, options: { nslots: "2" } }],
      ["1-r-25-35", { width: 400, height: 200 }],
    ];
    for (const [slug, sel] of cases) {
      const p = product(slug);
      const s: Selection = { ralName: "", quantity: 1, options: {}, ...sel };
      const j = jet(p, s, 300)!;
      expect(j.at(2)).toBeCloseTo(aero(p, s, 300, 2, null)!.velocityAtZone, 10);
      expect(j.at(4)).toBeLessThan(j.at(2));
      // далекобійність до 0,25 м/с — саме там швидкість 0,25
      const l = j.throwTo(0.25);
      if (l > 0.1) expect(j.at(l)).toBeCloseTo(Math.min(0.25, j.v0), 6);
    }
  });
});
