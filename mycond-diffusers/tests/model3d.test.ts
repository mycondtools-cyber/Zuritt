import { describe, expect, it } from "vitest";
import { modelSpec } from "@/lib/model3d/spec";
import type { Selection } from "@/lib/types";
import { product } from "./helpers";

const sel = (s: Partial<Selection>): Selection => ({ ralName: "", quantity: 1, options: {}, ...s });

describe("опис 3D-моделі з обраних розмірів", () => {
  it("PDK: посадковий розмір і регульований варіант", () => {
    expect(modelSpec(product("pdk"), sel({ sizeLabel: "450x450" }))).toMatchObject({ kind: "square-ceiling", size: 450, adjustable: false });
    expect(modelSpec(product("pdk-r"), sel({ sizeLabel: "300x300" }))).toMatchObject({ size: 300, adjustable: true });
  });
  it("решітки: Ш×В, однорядні/дворядні, кут ламелей", () => {
    expect(modelSpec(product("1-r-25-35"), sel({ width: 500, height: 200 }))).toMatchObject({ kind: "grille", w: 500, h: 200, double: false, angle: 0 });
    expect(modelSpec(product("2-r-25-65"), sel({ width: 400, height: 300 }))).toMatchObject({ double: true });
    expect(modelSpec(product("l15-25-35"), sel({ width: 400, height: 300 }))).toMatchObject({ angle: 15 });
  });
  it("щілинний: довжина й к-сть щілин; анемостат і круглий — діаметр", () => {
    expect(modelSpec(product("sd"), sel({ length: 1500, options: { nslots: "3" } }))).toMatchObject({ kind: "slot", length: 1500, slots: 3 });
    expect(modelSpec(product("kn"), sel({ sizeLabel: "D125" }))).toMatchObject({ kind: "disc", d: 125, exhaust: false });
    expect(modelSpec(product("ncd"), sel({ sizeLabel: "D250" }))).toMatchObject({ kind: "round-ceiling", d: 250 });
  });
  it("стельові панелі: візерунок і кількість отворів з типорозміру", () => {
    expect(modelSpec(product("rda-s"), sel({ sizeLabel: "500x500/24" }))).toMatchObject({ kind: "panel", w: 500, pattern: "swirl", count: 24 });
    expect(modelSpec(product("dcc"), sel({ width: 600, height: 600 }))).toMatchObject({ kind: "panel", w: 600, h: 600, pattern: "radial" });
    expect(modelSpec(product("dpf-1"), sel({ sizeLabel: "300x300/16" }))).toMatchObject({ pattern: "dimple-grid", count: 16 });
  });
  it("вихрові, гіпсові, сопла: діаметр; DRP — фланець за кресленням", () => {
    expect(modelSpec(product("drp"), sel({ sizeLabel: "D200" }))).toMatchObject({ kind: "swirl-round", d: 200, flange: 296 });
    expect(modelSpec(product("vdl"), sel({ sizeLabel: "D250" }))).toMatchObject({ kind: "swirl-round", blades: 8 });
    expect(modelSpec(product("sqr"), sel({ sizeLabel: "D125" }))).toMatchObject({ kind: "plaster", d: 125, square: true });
    expect(modelSpec(product("jn"), sel({ sizeLabel: "D160" }))).toMatchObject({ kind: "nozzle", d: 160 });
  });
  it("решітки інших конструкцій: стиль лицьової частини", () => {
    expect(modelSpec(product("pf-30-30"), sel({ width: 400, height: 300 }))).toMatchObject({ kind: "grille", style: "perforated", perf: "square" });
    expect(modelSpec(product("g-30-70"), sel({ width: 600, height: 400 }))).toMatchObject({ style: "louvre", mesh: true });
    expect(modelSpec(product("mvm"), sel({ sizeLabel: "200x200" }))).toMatchObject({ kind: "grille", w: 200, h: 200 });
  });
  it("щілинні: кутовий SDA, CLT з треком; пленуми — габарити з полів", () => {
    expect(modelSpec(product("sda"), sel({ length: 400 }))).toMatchObject({ kind: "slot", corner: true, length: 400 });
    expect(modelSpec(product("clt"), sel({ length: 1200 }))).toMatchObject({ track: true, hidden: true });
    expect(modelSpec(product("pb"), sel({ extra: { a: 400, b: 800, h: 350, connD: 200, connCount: 2 } }))).toMatchObject({ kind: "box", a: 400, b: 800, h: 350, connD: 200, conns: 2 });
    expect(modelSpec(product("af-box"), sel({ extra: { holesC: 6 }, options: { rows: "2", holeDia: "75" } }))).toMatchObject({ kind: "box", holes: { n: 6, d: 75, rows: 2 } });
  });
  it("модель є в кожного виробу каталогу", async () => {
    const seed = (await import("../data/seed.json")).default as { products: { slug: string }[] };
    const missing = seed.products.map((x) => x.slug).filter((s) => !modelSpec(product(s), sel({})));
    expect(missing).toEqual([]);
  });
});
