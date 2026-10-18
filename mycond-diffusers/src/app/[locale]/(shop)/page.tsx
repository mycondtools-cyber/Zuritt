import { getTranslations, setRequestLocale } from "next-intl/server";
import { Catalogue, type CatalogueItem } from "@/components/catalogue";
import { db } from "@/lib/db";
import { localizeCategory, localizeProduct } from "@/lib/i18n-content";
import { priceFrom } from "@/lib/products";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ g?: string }> };

export default async function Home({ params, searchParams }: Props) {
  const [{ locale }, { g }] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const [cats, products] = await Promise.all([
    db.category.findMany({ orderBy: { sort: "asc" } }),
    db.product.findMany({ where: { active: true }, include: { sizes: true }, orderBy: [{ sort: "asc" }] }),
  ]);
  const items: CatalogueItem[] = products.map((raw) => {
    const p = localizeProduct(raw, locale);
    return {
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
    };
  });

  return (
    <>
      <section className="py-8 sm:py-12">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand">{t("kicker")}</p>
        <h1 className="mt-2 max-w-3xl text-3xl font-extrabold tracking-tight sm:text-4xl">{t("title")}</h1>
        <ol className="mt-6 grid gap-3 sm:grid-cols-3">
          {([1, 2, 3] as const).map((n) => (
            <li key={n} className="card flex gap-3 p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft font-bold text-brand">{n}</span>
              <span>
                <span className="block font-bold">{t(`step${n}Title`)}</span>
                <span className="block text-sm text-muted">{t(`step${n}Text`)}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
      <Catalogue
        categories={cats.map((raw) => {
          const c = localizeCategory(raw, locale);
          return { slug: c.slug, name: c.name, description: c.description, group: c.group };
        })}
        items={items}
        initialGroup={["diffusers", "grilles", "anemostats", "plenums"].includes(g ?? "") ? g : "diffusers"}
      />
    </>
  );
}
