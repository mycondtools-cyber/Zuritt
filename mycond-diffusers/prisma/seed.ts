/**
 * Початкове наповнення бази: категорії, 30 дифузорів, палітра RAL, налаштування.
 * Ціни стартують з нуля («Ціна за запитом») — їх заповнюють в адмінці.
 * Повторний запуск оновлює опис/фото/опції, але НЕ чіпає вже введені ціни.
 *   npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import seed from "../data/seed.json";

const db = new PrismaClient();

const POPULAR = ["RAL 9016", "RAL 9010", "RAL 9003", "RAL 9005", "RAL 9006", "RAL 7016", "RAL 7035", "RAL 9007"];

function summaryOf(md: string): string {
  const m = md.match(/## Призначення\s*\n+([^\n]+)/);
  const text = (m?.[1] ?? md.replace(/^## .*$/gm, "").trim().split("\n")[0] ?? "").replace(/\*\*/g, "");
  return text.length > 220 ? text.slice(0, 217).replace(/\s+\S*$/, "") + "…" : text;
}

async function main() {
  for (const c of seed.categories) {
    await db.category.upsert({ where: { slug: c.slug }, update: { name: c.name, description: c.description, sort: c.sort }, create: c });
  }
  const cats = Object.fromEntries((await db.category.findMany()).map((c) => [c.slug, c.id]));

  for (const p of seed.products) {
    const data = {
      code: p.code,
      name: p.name,
      categoryId: cats[p.category],
      mode: p.mode,
      shape: p.shape,
      mounting: p.mounting,
      summary: summaryOf(p.description),
      description: p.description,
      images: p.images,
      sort: p.sort,
      options: p.options,
      limits: p.limits,
    };
    const existing = await db.product.findUnique({ where: { slug: p.slug } });
    if (existing) {
      await db.product.update({ where: { id: existing.id }, data });
      continue;
    }
    await db.product.create({
      data: {
        ...data,
        slug: p.slug,
        leadDays: p.leadDays,
        calc: p.calc,
        pricing: p.pricing,
        sizes: {
          create: p.sizes.map((s: Record<string, unknown>) => ({
            label: s.label as string,
            w: (s.w as number) ?? null,
            h: (s.h as number) ?? null,
            d: (s.d as number) ?? null,
            freeArea: (s.freeArea as number) ?? null,
            price: 0,
            sort: s.sort as number,
          })),
        },
      },
    });
  }

  if ((await db.ralColor.count()) === 0) {
    await db.ralColor.createMany({
      data: seed.ral.map((r, i) => ({
        ...r,
        isStandard: r.code === "RAL 9016",
        popular: POPULAR.includes(r.code),
        sort: i,
      })),
      skipDuplicates: true,
    });
  }

  console.log(`Seeded: ${seed.categories.length} categories, ${seed.products.length} products, ${await db.ralColor.count()} RAL colours`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
