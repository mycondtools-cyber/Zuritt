import { notFound } from "next/navigation";
import { ProductEditor } from "@/components/admin/product-editor";
import type { ProductInput } from "@/app/admin/actions";
import { db } from "@/lib/db";
import type { CalcParams, Limits, OptionGroup } from "@/lib/types";

export const metadata = { title: "Редагування товару" };

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cats = await db.category.findMany({ orderBy: { sort: "asc" } });
  let input: ProductInput;
  if (id === "new") {
    input = {
      id: null,
      slug: "",
      code: "",
      name: "",
      categoryId: cats[0]?.id ?? 0,
      mode: "sizes",
      shape: "square",
      mounting: ["ceiling"],
      summary: "",
      description: "## Призначення\n\n",
      images: [],
      leadDays: 5,
      active: false,
      sort: 100,
      options: [],
      calc: { areaCoef: 0.33, zeta: 3, throwK: 1.8, tempK: 1.4 },
      pricing: {},
      limits: {},
      sizes: [],
      translations: {},
    };
  } else {
    const p = await db.product.findUnique({ where: { id: Number(id) || 0 }, include: { sizes: { orderBy: { sort: "asc" } } } });
    if (!p) notFound();
    input = {
      id: p.id,
      slug: p.slug,
      code: p.code,
      name: p.name,
      categoryId: p.categoryId,
      mode: p.mode,
      shape: p.shape,
      mounting: p.mounting,
      summary: p.summary,
      description: p.description,
      images: p.images,
      leadDays: p.leadDays,
      active: p.active,
      sort: p.sort,
      options: p.options as unknown as OptionGroup[],
      calc: p.calc as unknown as CalcParams,
      pricing: p.pricing as Record<string, number>,
      limits: p.limits as Limits,
      sizes: p.sizes.map((s) => ({ id: s.id, label: s.label, w: s.w, h: s.h, d: s.d, freeArea: s.freeArea, price: s.price, sort: s.sort })),
      translations: (p.translations as ProductInput["translations"]) ?? {},
    };
  }
  return <ProductEditor initial={input} categories={cats.map((c) => ({ id: c.id, name: c.name }))} />;
}
