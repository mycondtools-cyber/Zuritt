/**
 * Валюти й маржа за ринками (мовними версіями сайту).
 * Усі ціни в базі — у гривнях без маржі; клієнт бачить: ціна × маржа ринку ÷ курс валюти.
 */
import { INTL_LOCALE, type Locale } from "@/i18n/routing";

export type Currency = "UAH" | "EUR" | "PLN";
export const CURRENCIES: Currency[] = ["UAH", "EUR", "PLN"];
export const CURRENCY_NAMES: Record<Currency, string> = { UAH: "Гривня, ₴", EUR: "Євро, €", PLN: "Злотий, zł" };

/** Курси: скільки гривень коштує 1 одиниця валюти */
export interface FxRates {
  /** true — курси НБУ оновлюються автоматично; false — використовуються введені вручну */
  auto: boolean;
  EUR: number;
  PLN: number;
  /** Дата курсу НБУ (ДД.ММ.РРРР) */
  date?: string;
  /** Коли курси востаннє оновлено (ISO) */
  updatedAt?: string;
}

/** Налаштування ринку в адмінці */
export interface MarketSetting {
  currency: Currency;
  /** Коефіцієнт маржі: 1 — без націнки, 1,15 — +15 % */
  margin: number;
}

/** Ринок для поточної мови: валюта, маржа й курс */
export interface Market extends MarketSetting {
  locale: string;
  /** Гривень за 1 одиницю валюти ринку */
  rate: number;
  /** Гривень за 1 євро — для перемикача «у євро» */
  eurRate: number;
}

export const DEFAULT_MARKETS: Record<string, MarketSetting> = {
  uk: { currency: "UAH", margin: 1 },
  en: { currency: "EUR", margin: 1 },
  pl: { currency: "PLN", margin: 1 },
};

export const DEFAULT_FX: FxRates = { auto: true, EUR: 50.75, PLN: 11.9 };

export const rateOf = (currency: Currency, fx: Pick<FxRates, "EUR" | "PLN">) => (currency === "UAH" ? 1 : fx[currency] || 1);

export function marketFor(locale: string, markets: Record<string, MarketSetting> | undefined, fx: FxRates): Market {
  const s = { ...(DEFAULT_MARKETS[locale] ?? DEFAULT_MARKETS.uk), ...(markets?.[locale] ?? {}) };
  const margin = Number.isFinite(s.margin) && s.margin > 0 ? s.margin : 1;
  return { locale, currency: s.currency, margin, rate: rateOf(s.currency, fx), eurRate: rateOf("EUR", fx) };
}

/** Ціна за 1 шт. у валюті ринку: гривні — цілі, інші валюти — до копійки (гроша, цента) */
export function convert(uah: number, m: Pick<Market, "currency" | "margin" | "rate">): number {
  const v = (uah * m.margin) / (m.currency === "UAH" ? 1 : m.rate);
  return m.currency === "UAH" ? Math.round(v) : Math.round(v * 100) / 100;
}

export function formatMoney(value: number, currency: Currency, locale: string): string {
  const intl = INTL_LOCALE[locale as Locale] ?? "uk-UA";
  if (currency === "UAH") {
    const n = new Intl.NumberFormat(intl, { maximumFractionDigits: 2 }).format(value);
    return `${n} ${locale === "uk" ? "грн" : "UAH"}`;
  }
  return new Intl.NumberFormat(intl, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}
