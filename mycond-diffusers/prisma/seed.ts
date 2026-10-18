/**
 * Наповнення бази: категорії, 30 дифузорів, палітра RAL.
 *
 *   npm run db:seed            — створює відсутнє; для наявних товарів оновлює лише технічні дані
 *                                (коефіцієнти розрахунку, живі перерізи, терміни). Ваші ціни, опції,
 *                                описи й фото не чіпає.
 *   npm run db:import-prices   — те саме + перезаписує ціни, доплати опцій і надбавки RAL
 *                                прайсом виробника з data/seed.json.
 */
import { Prisma, PrismaClient } from "@prisma/client";
import seed from "../data/seed.json";

const db = new PrismaClient();
const IMPORT_PRICES = process.argv.includes("--prices");

const POPULAR = ["RAL 9016", "RAL 9010", "RAL 9003", "RAL 9005", "RAL 9006", "RAL 7016", "RAL 7035", "RAL 9007"];

type SeedSize = { label: string; w?: number | null; h?: number | null; d?: number | null; freeArea?: number | null; price?: number; sort: number };

function summaryOf(md: string): string {
  const m = md.match(/## Призначення\s*\n+([^\n]+)/);
  const text = (m?.[1] ?? md.replace(/^## .*$/gm, "").trim().split("\n")[0] ?? "").replace(/\*\*/g, "");
  return text.length > 220 ? text.slice(0, 217).replace(/\s+\S*$/, "") + "…" : text;
}

const json = (v: unknown) => v as Prisma.InputJsonValue;

async function main() {
  for (const c of seed.categories) {
    await db.category.upsert({ where: { slug: c.slug }, update: {}, create: c });
  }
  const cats = Object.fromEntries((await db.category.findMany()).map((c) => [c.slug, c.id]));

  for (const p of seed.products) {
    const sizes = p.sizes as SeedSize[];
    const dims = (s: SeedSize) => ({ w: s.w ?? null, h: s.h ?? null, d: s.d ?? null, freeArea: s.freeArea ?? null, sort: s.sort });
    const existing = await db.product.findUnique({ where: { slug: p.slug }, include: { sizes: true } });

    if (!existing) {
      await db.product.create({
        data: {
          slug: p.slug,
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
          leadDays: p.leadDays,
          options: json(p.options),
          limits: json(p.limits),
          calc: json(p.calc),
          pricing: json(p.pricing),
          sizes: { create: sizes.map((s) => ({ ...dims(s), label: s.label, price: s.price ?? 0 })) },
        },
      });
      continue;
    }

    // технічні дані виробника — оновлюємо завжди
    await db.product.update({
      where: { id: existing.id },
      data: {
        calc: json(p.calc),
        leadDays: p.leadDays,
        limits: json(p.limits),
        ...(IMPORT_PRICES ? { options: json(p.options), pricing: json(p.pricing), mode: p.mode } : {}),
      },
    });
    for (const s of sizes) {
      const cur = existing.sizes.find((x) => x.label === s.label);
      const price = IMPORT_PRICES || !cur || cur.price <= 0 ? s.price ?? 0 : cur.price;
      if (cur) await db.productSize.update({ where: { id: cur.id }, data: { ...dims(s), price } });
      else await db.productSize.create({ data: { ...dims(s), label: s.label, price, productId: existing.id } });
    }
    // розміри, яких більше немає в каталозі, прибираємо лише якщо на них ще не задано ціну
    await db.productSize.deleteMany({ where: { productId: existing.id, price: { lte: 0 }, label: { notIn: sizes.map((s) => s.label) } } });
  }

  const colors = seed.ral.map((r, i) => ({ ...r, isStandard: r.name === "RAL 9016 глянець", popular: POPULAR.includes(r.code), sort: i }));
  if ((await db.ralColor.count()) === 0) {
    await db.ralColor.createMany({ data: colors, skipDuplicates: true });
  } else {
    for (const c of colors) {
      const cur = await db.ralColor.findUnique({ where: { name: c.name } });
      if (!cur) await db.ralColor.create({ data: c });
      else if (IMPORT_PRICES || cur.surchargePct === null) await db.ralColor.update({ where: { id: cur.id }, data: IMPORT_PRICES ? { surchargePct: c.surchargePct, isStandard: c.isStandard } : { surchargePct: c.surchargePct } });
    }
  }

  console.log(
    `Seeded: ${seed.categories.length} categories, ${seed.products.length} products, ${await db.ralColor.count()} RAL colours` +
      (IMPORT_PRICES ? " — ціни виробника імпортовано" : ""),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
