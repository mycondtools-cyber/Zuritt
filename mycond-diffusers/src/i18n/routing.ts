import { defineRouting } from "next-intl/routing";

/**
 * Мови сайту. Щоб додати нову:
 *  1) додайте код у `locales` і назву в LOCALE_NAMES / INTL_LOCALE;
 *  2) створіть src/messages/<код>.json (скопіюйте en.json і перекладіть);
 *  3) перекладіть товари й категорії в адмінці (вкладка мови в картці товару).
 * Українська — основна: адреси без префікса (/d/pdk), інші — з префіксом (/en/d/pdk).
 */
export const routing = defineRouting({
  locales: ["uk", "en", "pl"],
  defaultLocale: "uk",
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];

export const LOCALE_NAMES: Record<Locale, string> = { uk: "Українська", en: "English", pl: "Polski" };
export const LOCALE_SHORT: Record<Locale, string> = { uk: "UA", en: "EN", pl: "PL" };
/** Локаль для форматування чисел і дат */
export const INTL_LOCALE: Record<Locale, string> = { uk: "uk-UA", en: "en-GB", pl: "pl-PL" };
/** Мови перекладу контенту (усі, крім основної) */
export const CONTENT_LOCALES = routing.locales.filter((l) => l !== routing.defaultLocale) as Exclude<Locale, "uk">[];
