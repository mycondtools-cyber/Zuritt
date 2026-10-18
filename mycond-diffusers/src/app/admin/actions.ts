"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { checkPassword, createSession, destroySession, requireAdmin } from "@/lib/auth";
import { CONTENT_LOCALES } from "@/i18n/routing";
import { db } from "@/lib/db";
import type { ProductTranslation, Translations } from "@/lib/i18n-content";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import type { CalcParams, Choice, ExtraInput, Limits, OptionGroup, SizeRow } from "@/lib/types";

export async function login(_prev: string | null, form: FormData): Promise<string | null> {
  if (!(await checkPassword(String(form.get("password") ?? "")))) return "Невірний пароль";
  await createSession();
  redirect("/admin");
}

export async function logout() {
  await destroySession();
  redirect("/admin/login");
}

const n = (v: unknown, d = 0) => {
  const x = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(x) ? x : d;
};
const nOrNull = (v: unknown) => (v === null || v === undefined || v === "" ? null : n(v));

function sanitizeCalc(c: CalcParams): CalcParams {
  const out: CalcParams = { areaCoef: n(c.areaCoef), zeta: n(c.zeta), throwK: n(c.throwK), tempK: n(c.tempK) };
  if (c.slotWidthMm) out.slotWidthMm = n(c.slotWidthMm);
  if (c.jet === "plane" || c.jet === "compact") out.jet = c.jet;
  if (c.boxAuto === "af") out.boxAuto = "af";
  if (c.enabled === false) out.enabled = false;
  const by = Object.entries(c.byKey ?? {}).filter(([k]) => /^\d+(x\d+)?$/.test(k.trim()));
  if (by.length)
    out.byKey = Object.fromEntries(
      by.map(([k, v]) => [k.trim(), Object.fromEntries(Object.entries(v).filter(([, x]) => x !== null && x !== undefined && String(x) !== "").map(([kk, x]) => [kk, n(x)]))]),
    );
  return out;
}

function sanitizeLimits(l: Limits): Limits {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(l)) {
    if (k === "extra") {
      const rows = ((v ?? []) as ExtraInput[]).filter((e) => e.key?.trim());
      if (rows.length)
        out.extra = rows.map((e) => ({
          key: e.key.trim(),
          label: (e.label || e.key).trim(),
          unit: e.unit ?? "",
          min: n(e.min),
          max: n(e.max),
          step: n(e.step, 1) || 1,
          default: n(e.default),
          ...(e.hint ? { hint: e.hint } : {}),
        }));
    } else if (v !== "" && v !== null && v !== undefined) out[k] = n(v);
  }
  return out as Limits;
}

function sanitizePricing(pr: PricingInput): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(pr)) {
    if (k === "byKey") {
      const rows = Object.entries((v ?? {}) as Record<string, { fixed: number; perMeter: number }>).filter(([key]) => /^\d+(x\d+)?$/.test(key.trim()));
      if (rows.length) out.byKey = Object.fromEntries(rows.map(([key, r]) => [key.trim(), { fixed: n(r.fixed), perMeter: n(r.perMeter) }]));
    } else if (k === "perExtra") {
      const rows = Object.entries((v ?? {}) as Record<string, number>).filter(([key, x]) => key.trim() && x !== null && String(x) !== "");
      if (rows.length) out.perExtra = Object.fromEntries(rows.map(([key, x]) => [key.trim(), n(x)]));
    } else if (v !== null && v !== undefined && String(v) !== "") out[k] = n(v);
  }
  return out;
}

export type PricingInput = Record<string, number | Record<string, { fixed: number; perMeter: number }> | Record<string, number> | undefined>;

export interface ProductInput {
  id: number | null;
  slug: string;
  code: string;
  name: string;
  categoryId: number;
  mode: string;
  shape: string;
  mounting: string[];
  summary: string;
  description: string;
  images: string[];
  leadDays: number;
  active: boolean;
  sort: number;
  options: OptionGroup[];
  calc: CalcParams;
  pricing: PricingInput;
  limits: Limits;
  sizes: SizeRow[];
  translations: Translations<ProductTranslation>;
}

const clean = (v: unknown, max = 20000) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Лише відомі мови й поля, без порожніх рядків — щоб у БД не було сміття */
function sanitizeTranslations(t: Translations<ProductTranslation> | undefined): Translations<ProductTranslation> {
  const out: Translations<ProductTranslation> = {};
  for (const l of CONTENT_LOCALES) {
    const src = t?.[l];
    if (!src) continue;
    const tr: ProductTranslation = {};
    for (const k of ["name", "summary", "description"] as const) {
      const v = clean(src[k], k === "description" ? 50000 : 500);
      if (v) tr[k] = v;
    }
    const options: NonNullable<ProductTranslation["options"]> = {};
    for (const [key, g] of Object.entries(src.options ?? {})) {
      const choices = Object.fromEntries(Object.entries(g.choices ?? {}).map(([v, x]) => [v, clean(x, 200)]).filter(([, x]) => x));
      const og = { ...(clean(g.label, 200) && { label: clean(g.label, 200) }), ...(clean(g.hint, 1000) && { hint: clean(g.hint, 1000) }), ...(Object.keys(choices).length && { choices }) };
      if (Object.keys(og).length) options[key] = og;
    }
    if (Object.keys(options).length) tr.options = options;
    const extra: NonNullable<ProductTranslation["extra"]> = {};
    for (const [key, e] of Object.entries(src.extra ?? {})) {
      const ex = { ...(clean(e.label, 200) && { label: clean(e.label, 200) }), ...(clean(e.hint, 1000) && { hint: clean(e.hint, 1000) }), ...(clean(e.unit, 20) && { unit: clean(e.unit, 20) }) };
      if (Object.keys(ex).length) extra[key] = ex;
    }
    if (Object.keys(extra).length) tr.extra = extra;
    if (Object.keys(tr).length) out[l] = tr;
  }
  return out;
}

export async function saveProduct(input: ProductInput): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  await requireAdmin();
  const slug = input.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
  if (!slug || !input.code.trim() || !input.name.trim()) return { ok: false, error: "Заповніть slug, код і назву" };
  const clash = await db.product.findFirst({ where: { slug, NOT: input.id ? { id: input.id } : undefined } });
  if (clash) return { ok: false, error: `Slug «${slug}» вже зайнятий` };

  const options: OptionGroup[] = input.options
    .filter((g) => g.key.trim() && g.choices.length)
    .map((g) => ({
      key: g.key.trim(),
      label: g.label.trim() || g.key,
      hint: g.hint ?? "",
      default: g.choices.some((c) => c.value === g.default) ? g.default : g.choices[0].value,
      choices: g.choices
        .filter((c) => c.value.trim())
        .map((c) => {
          const out: Choice = { value: c.value.trim(), label: (c.label || c.value).trim(), priceAdd: n(c.priceAdd), pricePct: n(c.pricePct) };
          for (const k of ["pricePerSlot", "pricePerM", "pricePerSlotM", "pricePerM2", "pricePerConn", "pricePerConnMm"] as const) if (c[k]) out[k] = n(c[k]);
          if (c.calc) {
            const calc = Object.fromEntries(Object.entries(c.calc).filter(([, x]) => x !== null && x !== undefined && String(x) !== "").map(([k, x]) => [k, n(x)]));
            if (Object.keys(calc).length) out.calc = calc;
          }
          const bySize = Object.entries(c.priceBySize ?? {}).filter(([, v]) => v !== null && v !== undefined && String(v) !== "");
          if (bySize.length) out.priceBySize = Object.fromEntries(bySize.map(([k, v]) => [k, n(v)]));
          return out;
        }),
      ...(g.showIf?.key && g.showIf.values.length ? { showIf: { key: g.showIf.key, values: g.showIf.values.map((v) => v.trim()).filter(Boolean) } } : {}),
    }));

  const data = {
    slug,
    code: input.code.trim(),
    name: input.name.trim(),
    categoryId: input.categoryId,
    mode: input.mode,
    shape: input.shape,
    mounting: input.mounting,
    summary: input.summary.trim(),
    description: input.description,
    images: input.images.filter(Boolean),
    leadDays: Math.max(0, Math.round(n(input.leadDays, 5))),
    active: input.active,
    sort: Math.round(n(input.sort)),
    options: options as unknown as Prisma.InputJsonValue,
    calc: sanitizeCalc(input.calc) as unknown as Prisma.InputJsonValue,
    pricing: sanitizePricing(input.pricing) as Prisma.InputJsonValue,
    limits: sanitizeLimits(input.limits) as unknown as Prisma.InputJsonValue,
    translations: sanitizeTranslations(input.translations) as Prisma.InputJsonValue,
  };
  const sizes = input.sizes
    .filter((s) => s.label.trim())
    .map((s, i) => ({ label: s.label.trim(), w: nOrNull(s.w), h: nOrNull(s.h), d: nOrNull(s.d), freeArea: nOrNull(s.freeArea), price: n(s.price), sort: i }));

  const id = await db.$transaction(async (tx) => {
    const p = input.id ? await tx.product.update({ where: { id: input.id }, data }) : await tx.product.create({ data });
    await tx.productSize.deleteMany({ where: { productId: p.id } });
    if (sizes.length) await tx.productSize.createMany({ data: sizes.map((s) => ({ ...s, w: s.w === null ? null : Math.round(s.w), h: s.h === null ? null : Math.round(s.h), d: s.d === null ? null : Math.round(s.d), productId: p.id })) });
    return p.id;
  });
  revalidatePath("/", "layout");
  return { ok: true, id };
}

export async function deleteProduct(id: number) {
  await requireAdmin();
  await db.product.delete({ where: { id } });
  revalidatePath("/", "layout");
  redirect("/admin/products");
}

export async function duplicateProduct(id: number) {
  await requireAdmin();
  const p = await db.product.findUniqueOrThrow({ where: { id }, include: { sizes: true } });
  let slug = `${p.slug}-copy`;
  for (let i = 2; await db.product.findUnique({ where: { slug } }); i++) slug = `${p.slug}-copy-${i}`;
  const { id: _id, updatedAt: _u, sizes, ...rest } = p;
  const copy = await db.product.create({
    data: {
      ...rest,
      slug,
      name: `${p.name} (копія)`,
      active: false,
      options: p.options as Prisma.InputJsonValue,
      calc: p.calc as Prisma.InputJsonValue,
      pricing: p.pricing as Prisma.InputJsonValue,
      limits: p.limits as Prisma.InputJsonValue,
      translations: p.translations as Prisma.InputJsonValue,
      sizes: { create: sizes.map(({ id: _sid, productId: _pid, ...s }) => s) },
    },
  });
  redirect(`/admin/products/${copy.id}`);
}

export async function uploadImage(form: FormData): Promise<{ ok: true; urls: string[] } | { ok: false; error: string }> {
  await requireAdmin();
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  const urls: string[] = [];
  for (const f of files) {
    if (!/^image\/(png|jpe?g|webp|gif|svg\+xml)$/.test(f.type)) return { ok: false, error: `${f.name}: непідтримуваний формат` };
    if (f.size > 5 * 1024 * 1024) return { ok: false, error: `${f.name}: більше 5 МБ` };
    const m = await db.media.create({ data: { mime: f.type, data: Buffer.from(await f.arrayBuffer()) } });
    urls.push(`/api/media/${m.id}`);
  }
  return { ok: true, urls };
}

/** Масове оновлення цін типорозмірів та базових ставок */
export async function savePrices(
  sizes: { id: number; price: number }[],
  pricing: { productId: number; pricing: PricingInput }[],
): Promise<{ ok: true; count: number }> {
  await requireAdmin();
  await db.$transaction([
    ...sizes.map((s) => db.productSize.update({ where: { id: s.id }, data: { price: Math.max(0, n(s.price)) } })),
    ...pricing.map((p) => db.product.update({ where: { id: p.productId }, data: { pricing: sanitizePricing(p.pricing) as Prisma.InputJsonValue } })),
  ]);
  revalidatePath("/", "layout");
  return { ok: true, count: sizes.length + pricing.length };
}

export async function saveSettings(form: FormData) {
  await requireAdmin();
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof typeof DEFAULT_SETTINGS)[]) {
    const raw = form.get(key);
    if (raw === null) continue;
    const value = typeof DEFAULT_SETTINGS[key] === "number" ? n(raw, DEFAULT_SETTINGS[key] as number) : String(raw).trim();
    await db.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }
  revalidatePath("/", "layout");
  redirect("/admin/settings?saved=1");
}

export async function updateColor(id: number, data: { isStandard?: boolean; popular?: boolean; hex?: string; name?: string; surchargePct?: number | null }) {
  await requireAdmin();
  await db.ralColor.update({ where: { id }, data });
  revalidatePath("/", "layout");
}

export async function addColor(form: FormData) {
  await requireAdmin();
  const name = String(form.get("name") ?? "").trim();
  const hex = String(form.get("hex") ?? "#ffffff").trim();
  if (!name) return;
  const finish = /мат/i.test(name) ? "matt" : /глян/i.test(name) ? "gloss" : "special";
  await db.ralColor.upsert({
    where: { name },
    update: { hex },
    create: { name, hex, code: name.replace(/\s*(глянець|мат)\s*$/i, ""), finish, popular: true, sort: -1 },
  });
  revalidatePath("/", "layout");
}

export async function deleteColor(id: number) {
  await requireAdmin();
  await db.ralColor.delete({ where: { id } });
  revalidatePath("/", "layout");
}

export async function saveCategory(form: FormData) {
  await requireAdmin();
  const id = Number(form.get("id") || 0);
  const data = {
    slug: String(form.get("slug") ?? "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
    name: String(form.get("name") ?? "").trim(),
    description: String(form.get("description") ?? "").trim(),
    sort: Math.round(n(form.get("sort"))),
    group: String(form.get("group") ?? "diffusers"),
    translations: Object.fromEntries(
      CONTENT_LOCALES.map((l) => [l, { name: clean(form.get(`tr_${l}_name`), 200), description: clean(form.get(`tr_${l}_description`), 2000) }])
        .map(([l, t]) => [l, Object.fromEntries(Object.entries(t as Record<string, string>).filter(([, v]) => v))])
        .filter(([, t]) => Object.keys(t).length),
    ) as Prisma.InputJsonValue,
  };
  if (!data.slug || !data.name) return;
  if (id) await db.category.update({ where: { id }, data });
  else await db.category.create({ data });
  revalidatePath("/", "layout");
}

export async function deleteCategory(id: number) {
  await requireAdmin();
  if (await db.product.count({ where: { categoryId: id } })) return;
  await db.category.delete({ where: { id } });
  revalidatePath("/", "layout");
}

export async function setOrderStatus(id: number, status: string, note?: string) {
  await requireAdmin();
  await db.order.update({ where: { id }, data: { status, ...(note !== undefined ? { note } : {}) } });
  revalidatePath("/admin/orders");
}
