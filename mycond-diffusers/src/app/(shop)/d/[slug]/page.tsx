import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Configurator } from "@/components/configurator";
import { Gallery } from "@/components/gallery";
import { Markdown } from "@/components/markdown";
import { db } from "@/lib/db";
import { MOUNTING, toProductData } from "@/lib/products";
import { getSettings, publicSettings } from "@/lib/settings";

type Params = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  return db.product.findFirst({ where: { slug, active: true }, include: { sizes: true, category: true } });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const p = await load((await params).slug);
  return p ? { title: p.name, description: p.summary } : {};
}

export default async function ProductPage({ params }: Params) {
  const p = await load((await params).slug);
  if (!p) notFound();
  const [colors, settings, related] = await Promise.all([
    db.ralColor.findMany({ orderBy: { sort: "asc" } }),
    getSettings(),
    db.product.findMany({ where: { categoryId: p.categoryId, active: true, NOT: { id: p.id } }, orderBy: { sort: "asc" }, take: 6 }),
  ]);

  return (
    <div className="py-6">
      <nav className="mb-4 text-sm text-muted">
        <Link href="/" className="hover:text-brand">
          Каталог
        </Link>{" "}
        / <span>{p.category.name}</span>
      </nav>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Gallery images={p.images} alt={p.name} />
        </div>
        <div>
          <span className="rounded-lg bg-ink px-2 py-1 text-xs font-bold text-white">{p.code}</span>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">{p.name}</h1>
          {p.summary && <p className="mt-2 text-ink-2">{p.summary}</p>}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {p.mounting.map((m) => (
              <span key={m} className="rounded-lg bg-brand-soft px-2 py-1 text-xs font-semibold text-brand">
                {MOUNTING[m] ?? m}
              </span>
            ))}
          </div>
          <div className="mt-6">
            <Configurator
              product={toProductData(p)}
              image={p.images[0]}
              colors={colors.map((c) => ({ id: c.id, code: c.code, name: c.name, hex: c.hex, finish: c.finish, isStandard: c.isStandard, popular: c.popular }))}
              settings={publicSettings(settings)}
            />
          </div>
        </div>
      </div>

      {p.description && (
        <section className="card mt-8 p-5 sm:p-8">
          <h2 className="mb-4 text-xl font-extrabold">Опис та виготовлення</h2>
          <div className="max-w-3xl">
            <Markdown source={p.description} />
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-extrabold">Інші з категорії «{p.category.name}»</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {related.map((r) => (
              <Link key={r.id} href={`/d/${r.slug}`} className="card w-44 shrink-0 overflow-hidden hover:border-brand">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {r.images[0] && <img src={r.images[0]} alt={r.name} loading="lazy" className="aspect-square w-full object-contain p-3" />}
                <p className="border-t border-line p-2 text-xs font-semibold">{r.name}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
