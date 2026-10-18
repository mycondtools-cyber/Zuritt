/**
 * Валюти й маржа мовних версій: ціна з прайсу (грн) × маржа ÷ курс.
 */
import { describe, expect, it } from "vitest";
import { convert, formatMoney, marketFor, type FxRates } from "@/lib/money";

const fx: FxRates = { auto: true, EUR: 50.5, PLN: 11.56 };

describe("ринки", () => {
  it("за замовчуванням: uk — гривні, en — євро, pl — злоті, без маржі", () => {
    expect(marketFor("uk", undefined, fx)).toMatchObject({ currency: "UAH", margin: 1, rate: 1 });
    expect(marketFor("en", undefined, fx)).toMatchObject({ currency: "EUR", margin: 1, rate: 50.5 });
    expect(marketFor("pl", undefined, fx)).toMatchObject({ currency: "PLN", margin: 1, rate: 11.56 });
  });

  it("налаштування з адмінки перекривають типові; некоректна маржа → 1", () => {
    expect(marketFor("pl", { pl: { currency: "EUR", margin: 1.2 } }, fx)).toMatchObject({ currency: "EUR", margin: 1.2, rate: 50.5 });
    expect(marketFor("en", { en: { currency: "EUR", margin: 0 } }, fx).margin).toBe(1);
  });

  it("перерахунок: маржа, курс і округлення", () => {
    expect(convert(1000, marketFor("uk", { uk: { currency: "UAH", margin: 1.1 } }, fx))).toBe(1100);
    expect(convert(1000, marketFor("en", undefined, fx))).toBe(19.8);
    expect(convert(1000, marketFor("pl", { pl: { currency: "PLN", margin: 1.15 } }, fx))).toBe(99.48);
    expect(convert(775.4, marketFor("uk", undefined, fx))).toBe(775);
  });

  it("формат суми мовою сайту", () => {
    expect(formatMoney(1234, "UAH", "uk").replace(/\s/g, " ")).toBe("1 234 грн");
    expect(formatMoney(19.8, "EUR", "en")).toBe("€19.80");
    expect(formatMoney(99.48, "PLN", "pl").replace(/\s/g, " ")).toBe("99,48 zł");
  });
});
