import Link from "next/link";
import { CartBadge } from "./cart";

export function SiteHeader({ phone }: { phone?: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <img src="/brand/mycond-logo.png" alt="Mycond" width={45} height={40} className="h-10 w-auto rounded-md" />
          <span className="leading-tight">
            <span className="block text-[15px] font-extrabold tracking-tight">Повітророзподіл</span>
            <span className="block text-xs text-muted">дифузори · решітки · пленуми</span>
          </span>
        </Link>
        <nav className="ml-auto flex items-center gap-1 text-sm font-medium sm:gap-3">
          <Link href="/" className="hidden rounded-lg px-2 py-1.5 hover:text-brand sm:block">
            Каталог
          </Link>
          <Link href="/guide" className="hidden rounded-lg px-2 py-1.5 hover:text-brand sm:block">
            Як підібрати
          </Link>
          {phone && (
            <a href={`tel:${phone.replace(/[^+\d]/g, "")}`} className="hidden rounded-lg px-2 py-1.5 font-semibold hover:text-brand md:block">
              {phone}
            </a>
          )}
          <CartBadge />
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter({ phone, email, companyName }: { phone?: string; email?: string; companyName?: string }) {
  return (
    <footer className="mt-16 border-t border-line bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <span>
          © {new Date().getFullYear()} {companyName}. Розрахунки орієнтовні — остаточний підбір уточнює інженер.
        </span>
        <span className="flex gap-4">
          {phone && <a href={`tel:${phone.replace(/[^+\d]/g, "")}`}>{phone}</a>}
          {email && <a href={`mailto:${email}`}>{email}</a>}
        </span>
      </div>
    </footer>
  );
}
