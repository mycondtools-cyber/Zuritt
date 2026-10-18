import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { CartBadge } from "./cart";
import { LocaleSwitcher } from "./locale-switcher";

export async function SiteHeader({ phone }: { phone?: string }) {
  const t = await getTranslations("header");
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mycond-logo-square.png" alt="MYCOND" width={44} height={44} className="h-11 w-11 shrink-0 rounded-md" />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[15px] font-extrabold tracking-tight">{t("title")}</span>
            <span className="block truncate text-xs text-muted">{t("tagline")}</span>
          </span>
        </Link>
        <nav className="ml-auto flex items-center gap-1 text-sm font-medium sm:gap-3">
          <Link href="/" className="hidden rounded-lg px-2 py-1.5 hover:text-brand sm:block">
            {t("catalogue")}
          </Link>
          <Link href="/guide" className="hidden rounded-lg px-2 py-1.5 hover:text-brand sm:block">
            {t("guide")}
          </Link>
          {phone && (
            <a href={`tel:${phone.replace(/[^+\d]/g, "")}`} className="hidden rounded-lg px-2 py-1.5 font-semibold hover:text-brand md:block">
              {phone}
            </a>
          )}
          <LocaleSwitcher />
          <CartBadge />
        </nav>
      </div>
    </header>
  );
}

export async function SiteFooter({ phone, email, companyName }: { phone?: string; email?: string; companyName?: string }) {
  const t = await getTranslations("footer");
  return (
    <footer className="mt-16 border-t border-line bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <span>
          © {new Date().getFullYear()} {companyName}. {t("disclaimer")}
        </span>
        <span className="flex gap-4">
          {phone && <a href={`tel:${phone.replace(/[^+\d]/g, "")}`}>{phone}</a>}
          {email && <a href={`mailto:${email}`}>{email}</a>}
        </span>
      </div>
    </footer>
  );
}
