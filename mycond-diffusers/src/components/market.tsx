"use client";

import { useLocale } from "next-intl";
import { createContext, useContext, useMemo } from "react";
import { convert, formatMoney, type Currency, type Market } from "@/lib/money";

const Ctx = createContext<Market | null>(null);

/** Валюта, курс і маржа поточної мовної версії (рахуються на сервері в макеті магазину) */
export function MarketProvider({ market, children }: { market: Market; children: React.ReactNode }) {
  return <Ctx.Provider value={market}>{children}</Ctx.Provider>;
}

/**
 * Ціни для клієнта. На вхід — гривні без маржі (як у базі й у price()),
 * на виході — сума у валюті ринку з маржею. alt = true — показати в євро.
 */
export function useMoney(alt = false) {
  const m = useContext(Ctx);
  const locale = useLocale();
  if (!m) throw new Error("useMoney outside MarketProvider");
  return useMemo(() => {
    const target = alt && m.currency !== "EUR" ? { currency: "EUR" as Currency, margin: m.margin, rate: m.eurRate } : m;
    const conv = (uah: number) => convert(uah, target);
    return {
      currency: target.currency,
      /** Валюта ринку і чи є сенс у перемикачі «€» */
      market: m,
      canAlt: m.currency !== "EUR",
      conv,
      fmt: (uah: number) => formatMoney(conv(uah), target.currency, locale),
      /** Сума за кількість: спершу ціна за 1 шт. у валюті, потім × кількість — як у рахунку */
      fmtTotal: (unitUah: number, qty: number) => formatMoney(Math.round(conv(unitUah) * qty * 100) / 100, target.currency, locale),
      fmtValue: (value: number) => formatMoney(value, target.currency, locale),
    };
  }, [m, alt, locale]);
}
