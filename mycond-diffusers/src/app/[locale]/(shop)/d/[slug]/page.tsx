import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ColorPreviewProvider } from "@/components/color-preview";
import { Configurator } from "@/components/configurator";
import { Gallery } from "@/components/gallery";
import { Markdown } from "@/components/markdown";
import { Link } from "@/i18n/navigation";
import recolorSpecs from "../../../../../../data/recolor.json";
import { db } from "@/lib/db";
import type { RecolorSpec } from "@/lib/recolor";
import { localizeCategory, localizeProduct } from "@/lib/i18n-content";
import { toProductData, vizKind } from "@/lib/products";
import { getSettings, publicSettings } from "@/lib/settings";

type Params = { params: Promise<{ slug: string; locale: string }> };

async function load(slug: string, locale: string) {
  const p = await db.product.findFirst({ where: { slug, active: true }, include: { sizes: true, category: true } });
  return p ? { ...localizeProduct(p, locale), category: localizeCategory(p.category, locale) } : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, locale } = await params;
  const p = await load(slug, locale);
  return p ? { title: p.name, description: p.summary } : {};
}

export default async function ProductPage({ params }: Params) {
  const { slug, locale } = await params;
  setRequestLocale(locale);
  const p = await load(slug, locale);
  if (!p) notFound();
  const t = await getTranslations();
  const [colors, settings, related] = await Promise.all([
    db.ralColor.findMany({ orderBy: { sort: "asc" } }),
    getSettings(),
    db.product.findMany({ where: { categoryId: p.categoryId, active: true, NOT: { id: p.id } }, orderBy: { sort: "asc" }, take: 6 }),
  ]).then(([c, s, r]) => [c, s, r.map((x) => localizeProduct(x, locale))] as const);

  return (
    <div className="py-6">
      <nav className="mb-4 text-sm text-muted">
        <Link href="/" className="hover:text-brand">
          {t("product.breadcrumb")}
        </Link>{" "}
        / <span>{p.category.name}</span>
      </nav>
      <ColorPreviewProvider>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Gallery images={p.images} alt={p.name} recolor={(recolorSpecs as Record<string, RecolorSpec>)[p.slug]} />
        </div>
        <div>
          <span className="rounded-lg bg-ink px-2 py-1 text-xs font-bold text-white">{p.code}</span>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">{p.name}</h1>
          {p.summary && <p className="mt-2 text-ink-2">{p.summary}</p>}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {p.mounting.map((m) => (
              <span key={m} className="rounded-lg bg-brand-soft px-2 py-1 text-xs font-semibold text-brand">
                {t.has(`mounting.${m}`) ? t(`mounting.${m}`) : m}
              </span>
            ))}
          </div>
          <div className="mt-6">
            <Configurator
              product={toProductData(p)}
              image={p.images[0]}
              colors={colors.map((c) => ({ id: c.id, code: c.code, name: c.name, hex: c.hex, finish: c.finish, isStandard: c.isStandard, popular: c.popular, surchargePct: c.surchargePct }))}
              settings={publicSettings(settings)}
              viz={vizKind(p.category.slug, p.mounting, p.mode)}
            />
          </div>
        </div>
      </div>

      </ColorPreviewProvider>

      {p.description && (
        <section className="card mt-8 p-5 sm:p-8">
          <h2 className="mb-4 text-xl font-extrabold">{t("product.description")}</h2>
          <div className="max-w-3xl">
            <Markdown source={p.description} />
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-extrabold">{t("product.related", { category: p.category.name })}</h2>
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
