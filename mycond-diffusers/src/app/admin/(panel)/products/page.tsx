import Link from "next/link";
import { db } from "@/lib/db";
import { uah } from "@/lib/format";
import { MODES, priceFrom } from "@/lib/products";
import type { Mode } from "@/lib/types";

export const metadata = { title: "Товари" };

export default async function ProductsAdmin() {
  const [cats, products] = await Promise.all([
    db.category.findMany({ orderBy: { sort: "asc" } }),
    db.product.findMany({ include: { sizes: true }, orderBy: [{ sort: "asc" }] }),
  ]);
  return (
    <div className="max-w-6xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Товари</h1>
        <Link href="/admin/products/new" className="btn-primary">
          + Новий товар
        </Link>
      </div>
      {cats.map((c) => {
        const list = products.filter((p) => p.categoryId === c.id);
        if (!list.length) return null;
        return (
          <section key={c.id} className="mb-6">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted">{c.name}</h2>
            <div className="card divide-y divide-line overflow-hidden">
              {list.map((p) => {
                const from = priceFrom(p);
                const missing = p.mode === "sizes" ? p.sizes.filter((s) => s.price <= 0).length : from > 0 ? 0 : 1;
                return (
                  <Link key={p.id} href={`/admin/products/${p.id}`} className="flex items-center gap-3 p-3 hover:bg-paper">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.images[0] ? <img src={p.images[0]} alt="" className="h-11 w-11 rounded-lg border border-line object-contain" /> : <span className="h-11 w-11 rounded-lg bg-paper" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">
                        <span className="mr-2 rounded bg-ink px-1.5 py-0.5 text-xs text-white">{p.code}</span>
                        {p.name}
                      </span>
                      <span className="block text-xs text-muted">{MODES[p.mode as Mode]}</span>
                    </span>
                    {!p.active && <span className="rounded-md bg-paper px-2 py-0.5 text-xs text-muted">прихований</span>}
                    {missing > 0 && <span className="rounded-md bg-ok-soft px-2 py-0.5 text-xs text-ok">без ціни: {p.mode === "sizes" ? missing : "так"}</span>}
                    <span className="w-28 text-right text-sm font-semibold">{from > 0 ? `від ${uah(from)}` : "—"}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
