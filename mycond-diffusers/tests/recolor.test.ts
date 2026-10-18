import { describe, expect, it } from "vitest";
import { hexToRgb, recolorPixels } from "@/lib/recolor";
import specs from "../data/recolor.json";

describe("попередній перегляд кольору RAL", () => {
  it("поза маскою пікселі не змінюються, в масці — колір із тінями фото", () => {
    // 3 пікселі: поза маскою; яскравість фарбування (base); тінь (половина base)
    const photo = new Uint8ClampedArray([10, 20, 30, 255, 200, 200, 200, 255, 100, 100, 100, 255]);
    const mask = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255]);
    recolorPixels(photo, mask, [204, 44, 36], 200);
    expect([...photo.slice(0, 3)]).toEqual([10, 20, 30]);
    expect([...photo.slice(4, 7)]).toEqual([204, 44, 36]);
    // тінь: половина яскравості → колір × 0,5^0,75
    expect([...photo.slice(8, 11)]).toEqual([121, 26, 21]);
  });

  it("hex → rgb", () => {
    expect(hexToRgb("#4faf4d")).toEqual([79, 175, 77]);
    expect(hexToRgb("fff")).toEqual([255, 255, 255]);
  });

  it("для кожного товару з маскою є фото й маска", async () => {
    const fs = await import("node:fs");
    for (const [slug, s] of Object.entries(specs as Record<string, { image: string; mask: string; base: number }>)) {
      expect(fs.existsSync(`public${s.image}`), slug).toBe(true);
      expect(fs.existsSync(`public${s.mask}`), slug).toBe(true);
      expect(s.base, slug).toBeGreaterThan(20);
    }
  });
});
