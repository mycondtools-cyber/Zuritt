import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { logout } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: { default: "Адмінка", template: "%s · Адмінка" }, robots: { index: false } };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const newOrders = await db.order.count({ where: { status: "new" } });
  const nav: [string, string, number?][] = [
    ["/admin", "Огляд"],
    ["/admin/orders", "Заявки", newOrders],
    ["/admin/products", "Товари"],
    ["/admin/prices", "Ціни"],
    ["/admin/colors", "Кольори RAL"],
    ["/admin/categories", "Категорії"],
    ["/admin/settings", "Налаштування"],
  ];
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[220px_1fr]">
      <aside className="border-b border-line bg-ink text-white lg:min-h-screen lg:border-b-0">
        <div className="flex items-center justify-between p-4 lg:block">
          <Link href="/admin" className="font-extrabold">
            Дифузори · Адмін
          </Link>
          <Link href="/" target="_blank" className="text-xs text-white/60 hover:text-white lg:mt-1 lg:block">
            Відкрити сайт ↗
          </Link>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:px-3">
          {nav.map(([href, label, badge]) => (
            <Link key={href} href={href} className="flex shrink-0 items-center justify-between rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white">
              {label}
              {!!badge && <span className="ml-2 rounded-full bg-brand-2 px-1.5 text-xs font-bold">{badge}</span>}
            </Link>
          ))}
          <form action={logout} className="lg:mt-4">
            <button className="w-full rounded-lg px-3 py-2 text-left text-sm text-white/50 hover:text-white">Вийти</button>
          </form>
        </nav>
      </aside>
      <main className="min-w-0 p-4 sm:p-6">{children}</main>
    </div>
  );
}
