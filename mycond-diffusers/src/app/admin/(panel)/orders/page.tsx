import Link from "next/link";
import { db } from "@/lib/db";
import { uah } from "@/lib/format";
import { STATUSES } from "@/lib/orders";

export const metadata = { title: "Заявки" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const orders = await db.order.findMany({ where: status ? { status } : undefined, orderBy: { createdAt: "desc" }, take: 200 });
  return (
    <div className="max-w-5xl space-y-4">
      <h1 className="text-2xl font-extrabold">Заявки</h1>
      <div className="flex flex-wrap gap-2">
        <Link href="/admin/orders" className="chip" aria-pressed={!status}>
          Усі
        </Link>
        {Object.entries(STATUSES).map(([k, v]) => (
          <Link key={k} href={`/admin/orders?status=${k}`} className="chip" aria-pressed={status === k}>
            {v.label}
          </Link>
        ))}
      </div>
      <div className="card divide-y divide-line">
        {orders.length === 0 && <p className="p-6 text-center text-sm text-muted">Заявок немає</p>}
        {orders.map((o) => (
          <Link key={o.id} href={`/admin/orders/${o.id}`} className="flex flex-wrap items-center gap-3 p-3 text-sm hover:bg-paper">
            <span className="w-12 font-bold">№{o.id}</span>
            <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${STATUSES[o.status]?.cls ?? ""}`}>{STATUSES[o.status]?.label ?? o.status}</span>
            <span className="font-semibold">{o.name}</span>
            <span className="text-muted">{o.phone}</span>
            {o.company && <span className="text-muted">· {o.company}</span>}
            <span className="ml-auto text-xs text-muted">{o.createdAt.toLocaleString("uk-UA", { timeZone: "Europe/Kyiv" })}</span>
            <span className="w-28 text-right font-semibold">{uah(o.totalUah)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
