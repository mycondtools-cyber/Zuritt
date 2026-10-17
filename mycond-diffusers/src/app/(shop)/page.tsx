import { Catalogue, type CatalogueItem } from "@/components/catalogue";
import { db } from "@/lib/db";
import { priceFrom } from "@/lib/products";

export default async function Home() {
  const [cats, products] = await Promise.all([
    db.category.findMany({ orderBy: { sort: "asc" } }),
    db.product.findMany({ where: { active: true }, include: { sizes: true }, orderBy: [{ sort: "asc" }] }),
  ]);
  const items: CatalogueItem[] = products.map((p) => ({
    slug: p.slug,
    code: p.code,
    name: p.name,
    summary: p.summary,
    image: p.images[0],
    category: cats.find((c) => c.id === p.categoryId)?.slug ?? "",
    shape: p.shape,
    mounting: p.mounting,
    priceFrom: priceFrom(p),
    sizesCount: p.mode === "sizes" ? p.sizes.length : 0,
    mode: p.mode,
  }));

  return (
    <>
      <section className="py-8 sm:py-12">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand">Вентиляційні дифузори</p>
        <h1 className="mt-2 max-w-3xl text-3xl font-extrabold tracking-tight sm:text-4xl">
          Підберіть дифузор за 3 кроки — і одразу побачите ціну та розрахунок
        </h1>
        <ol className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            ["1", "Оберіть тип", "Стельовий, щілинний, ротаційний чи вихровий — фільтри підкажуть."],
            ["2", "Вкажіть витрату повітря", "Конфігуратор сам підбере розмір без шуму й протягів."],
            ["3", "Колір і заявка", "Будь-який RAL, ціна в грн/€ і термін виготовлення одразу."],
          ].map(([n, t, d]) => (
            <li key={n} className="card flex gap-3 p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft font-bold text-brand">{n}</span>
              <span>
                <span className="block font-bold">{t}</span>
                <span className="block text-sm text-muted">{d}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
      <Catalogue categories={cats.map((c) => ({ slug: c.slug, name: c.name, description: c.description }))} items={items} />
    </>
  );
}
