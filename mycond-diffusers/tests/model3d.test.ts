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
  it("вироби без моделі — null", () => {
    expect(modelSpec(product("pb"), sel({}))).toBeNull();
    expect(modelSpec(product("drp"), sel({}))).toBeNull();
  });
});
