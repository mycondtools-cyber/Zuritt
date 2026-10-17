import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { uah } from "@/lib/format";
import { STATUSES, type OrderItem } from "@/lib/orders";
import { setOrderStatus } from "../../../actions";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const o = await db.order.findUnique({ where: { id: Number((await params).id) || 0 } });
  if (!o) notFound();
  const items = o.items as unknown as OrderItem[];
  async function update(form: FormData) {
    "use server";
    await setOrderStatus(o!.id, String(form.get("status")), String(form.get("note") ?? ""));
  }
  return (
    <div className="max-w-4xl space-y-4">
      <Link href="/admin/orders" className="text-sm text-muted hover:text-brand">
        ← Заявки
      </Link>
      <h1 className="text-2xl font-extrabold">Заявка №{o.id}</h1>
      <div className="grid gap-4 md:grid-cols-[1fr_300px]">
        <div className="card divide-y divide-line">
          {items.map((i, k) => (
            <div key={k} className="p-4">
              <div className="flex gap-3">
                <Link href={`/d/${i.slug}`} target="_blank" className="font-semibold hover:text-brand">
                  {i.name}
                </Link>
                <span className="ml-auto whitespace-nowrap font-semibold">{i.onRequest ? "за запитом" : uah(i.total)}</span>
              </div>
              <p className="font-mono text-sm">
                {i.spec} × {i.quantity}
              </p>
              <p className="mt-1 text-xs text-muted">{i.details.map((d) => `${d.label}: ${d.value}`).join(" · ")}</p>
              <p className="mt-1 text-xs text-muted">
                {i.onRequest ? "" : `${uah(i.unitPrice)}/шт · `}виготовлення {i.leadDays} дн.
              </p>
            </div>
          ))}
          <div className="flex justify-between p-4 font-bold">
            <span>Разом</span>
            <span>{uah(o.totalUah)}</span>
          </div>
        </div>
        <div className="space-y-4">
          <div className="card space-y-1 p-4 text-sm">
            <p className="font-bold">{o.name}</p>
            <a href={`tel:${o.phone}`} className="block text-brand">
              {o.phone}
            </a>
            {o.email && (
              <a href={`mailto:${o.email}`} className="block text-brand">
                {o.email}
              </a>
            )}
            {o.company && <p>{o.company}</p>}
            {o.city && <p>{o.city}</p>}
            {o.comment && <p className="mt-2 rounded-lg bg-paper p-2">{o.comment}</p>}
            <p className="pt-2 text-xs text-muted">{o.createdAt.toLocaleString("uk-UA", { timeZone: "Europe/Kyiv" })}</p>
          </div>
          <form action={update} className="card space-y-3 p-4">
            <label className="block">
              <span className="label">Статус</span>
              <select name="status" className="input" defaultValue={o.status}>
                {Object.entries(STATUSES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">Нотатка менеджера</span>
              <textarea name="note" className="input min-h-20" defaultValue={o.note} />
            </label>
            <button className="btn-primary w-full">Зберегти</button>
          </form>
        </div>
      </div>
    </div>
  );
}
