/**
 * Поле для візуалізації в стилі CFD: на осі струменя — ті самі швидкості й ΔT, що й у розрахунку.
 */
import { describe, expect, it } from "vitest";
import { aero, jet } from "@/lib/calc";
import { computeField, geometry, isoline, sample } from "@/lib/flowfield";
import type { Selection } from "@/lib/types";
import { product } from "./helpers";

const sel = (s: Partial<Selection>): Selection => ({ ralName: "", quantity: 1, options: {}, ...s });

describe("поле швидкості в перерізі приміщення", () => {
  for (const [slug, kind, s] of [
    ["pdk", "ceiling", { sizeLabel: "300x300" }],
    ["sd", "ceiling", { length: 1000, options: { nslots: "2" } }],
    ["1-r-25-35", "wall", { width: 400, height: 200 }],
  ] as const) {
    it(`${slug}: біля людей — швидкість і ΔT з розрахунку`, () => {
      const p = product(slug);
      const se = sel(s as Partial<Selection>);
      const j = jet(p, se, 300)!;
      const geo = geometry(kind, 2);
      const f = computeField(geo, j, 240, 10);
      const r = aero(p, se, 300, 2, 10)!;
      const v = sample(f, f.speed, geo.entry.x, geo.entry.y);
      // зворотний потік додає трохи, сітка трохи згладжує — допуск 25 %
      expect(Math.abs(v - r.velocityAtZone) / r.velocityAtZone).toBeLessThan(0.25);
      expect(Math.abs(-sample(f, f.dT, geo.entry.x, geo.entry.y) - r.deltaTAtZone!) / r.deltaTAtZone!).toBeLessThan(0.25);
    });
  }

  it("поперек струменя швидкість спадає, ізолінії будуються", () => {
    const p = product("pdk");
    const j = jet(p, sel({ sizeLabel: "300x300" }), 300)!;
    const geo = geometry("ceiling", 2);
    const f = computeField(geo, j, 200, 10);
    const { x } = geo.entry;
    const onAxis = sample(f, f.speed, x, geo.ceil - 1);
    const aside = sample(f, f.speed, x - 0.8, geo.ceil - 1);
    expect(aside).toBeLessThan(onAxis * 0.5);
    expect(isoline(f, f.speed, 0.25).length).toBeGreaterThan(10);
  });
});
