"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { LOCALE_NAMES, LOCALE_SHORT, routing, type Locale } from "@/i18n/routing";

/** Перемикач мови: та сама сторінка іншою мовою */
export function LocaleSwitcher() {
  const t = useTranslations("common");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="flex items-center gap-1 rounded-lg px-2 py-1.5 font-semibold hover:text-brand"
        aria-label={t("language")}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
        </svg>
        {LOCALE_SHORT[locale]}
      </button>
      {open && (
        <ul className="absolute right-0 top-full z-50 mt-1 min-w-36 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-lg">
          {routing.locales.map((l) => (
            <li key={l}>
              <Link
                href={search ? `${pathname}?${search}` : pathname}
                locale={l}
                hrefLang={l}
                onClick={() => setOpen(false)}
                className={`flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-paper ${l === locale ? "font-bold text-brand" : ""}`}
              >
                {LOCALE_NAMES[l]}
                <span className="text-xs text-muted">{LOCALE_SHORT[l]}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
