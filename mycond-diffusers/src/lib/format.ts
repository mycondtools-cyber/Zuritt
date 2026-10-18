import { INTL_LOCALE, type Locale } from "@/i18n/routing";

const UAH_LABEL: Record<string, string> = { uk: "грн" };

/** Форматування цін і чисел для мови сайту (адмінка — українська за замовчуванням) */
export function formatters(locale: string = "uk") {
  const intl = INTL_LOCALE[locale as Locale] ?? "uk-UA";
  const uahLabel = UAH_LABEL[locale] ?? "UAH";
  return {
    uah: (n: number) => new Intl.NumberFormat(intl, { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n) + " " + uahLabel,
    eur: (n: number) => new Intl.NumberFormat(intl, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + " €",
    num: (n: number, d = 2) => new Intl.NumberFormat(intl, { minimumFractionDigits: d, maximumFractionDigits: d }).format(n),
  };
}

export const { uah, eur, num } = formatters("uk");
