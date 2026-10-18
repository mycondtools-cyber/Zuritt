import Link from "next/link";
import { db } from "@/lib/db";
import { uah } from "@/lib/format";
import { formatMoney, type Currency } from "@/lib/money";

export default async function Dashboard() {
  const [products, active, sizes, zeroSizes, orders, newOrders, latest] = await Promise.all([
    db.product.count(),
    db.product.count({ where: { active: true } }),
    db.productSize.count(),
    db.productSize.count({ where: { price: { lte: 0 } } }),
    db.order.count(),
    db.order.count({ where: { status: "new" } }),
    db.order.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
  ]);
  const stats: [string, string | number, string?][] = [
    ["Товарів", `${active} / ${products}`, "активних / усього"],
    ["Типорозмірів", sizes, zeroSizes ? `${zeroSizes} без ціни` : "усі з цінами"],
    ["Заявок", orders, `${newOrders} нових`],
  ];
  return (
    <div className="max-w-5xl space-y-6">
      <h1 className="text-2xl font-extrabold">Огляд</h1>
      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map(([l, v, s]) => (
          <div key={l} className="card p-4">
            <p className="text-sm text-muted">{l}</p>
            <p className="text-2xl font-extrabold">{v}</p>
            {s && <p className="text-xs text-muted">{s}</p>}
          </div>
        ))}
      </div>
      {zeroSizes > 0 && (
        <div className="card flex flex-wrap items-center gap-3 border-ok bg-ok-soft p-4 text-sm text-ok">
          {zeroSizes} позицій показуються як «Ціна за запитом».
          <Link href="/admin/prices" className="btn-primary ml-auto !py-2">
            Заповнити ціни
          </Link>
        </div>
      )}
      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">Останні заявки</h2>
          <Link href="/admin/orders" className="text-sm text-brand">
            Усі →
          </Link>
        </div>
        {latest.length === 0 ? (
          <p className="text-sm text-muted">Заявок поки немає.</p>
        ) : (
          <ul className="divide-y divide-line">
            {latest.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`} className="flex items-center gap-3 py-2 text-sm hover:text-brand">
                  <span className="font-semibold">№{o.id}</span>
                  <span>{o.name}</span>
                  <span className="text-muted">{o.phone}</span>
                  <span className="ml-auto font-semibold">{o.total > 0 ? formatMoney(o.total, o.currency as Currency, "uk") : uah(o.totalUah)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
