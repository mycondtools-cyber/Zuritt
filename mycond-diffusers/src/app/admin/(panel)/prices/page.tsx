import { PriceGrid, type PriceProduct } from "@/components/admin/price-grid";
import { db } from "@/lib/db";

export const metadata = { title: "Ціни" };

export default async function PricesPage() {
  const [cats, products] = await Promise.all([
    db.category.findMany({ orderBy: { sort: "asc" } }),
    db.product.findMany({ include: { sizes: { orderBy: { sort: "asc" } } }, orderBy: { sort: "asc" } }),
  ]);
  const data: PriceProduct[] = products.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    category: cats.find((c) => c.id === p.categoryId)?.name ?? "",
    mode: p.mode,
    pricing: p.pricing as Record<string, number>,
    sizes: p.sizes.map((s) => ({ id: s.id, label: s.label, price: s.price })),
  }));
  return <PriceGrid products={data} categories={cats.map((c) => c.name)} />;
}
