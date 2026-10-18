import { NextResponse } from "next/server";
import { price, specString } from "@/lib/calc";
import { routing } from "@/i18n/routing";
import uk from "@/messages/uk.json";
import { db } from "@/lib/db";
import { detailLabels, itemDetails } from "@/lib/details";
import { uah } from "@/lib/format";
import { toProductData } from "@/lib/products";
import { convert, formatMoney } from "@/lib/money";
import { getMarket, getSettings } from "@/lib/settings";
import type { CartItem } from "@/lib/types";

const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");
/** code — ключ повідомлення cart.errors.* (клієнт показує його мовою сайту), error — текст для інших клієнтів */
const fail = (code: keyof typeof uk.cart.errors) => NextResponse.json({ code, error: uk.cart.errors[code] }, { status: 400 });
const num = (v: unknown, min: number, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : null);

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("bad_request");
  }
  const name = str(body.name, 120);
  const phone = str(body.phone, 40);
  if (!name || phone.replace(/\D/g, "").length < 9) return fail("contact");
  const rawItems = Array.isArray(body.items) ? (body.items as CartItem[]).slice(0, 100) : [];
  if (!rawItems.length) return fail("empty");
  const locale = (routing.locales as readonly string[]).includes(String(body.locale)) ? String(body.locale) : routing.defaultLocale;

  const settings = await getSettings();
  const market = await getMarket(locale, settings);
  const slugs = [...new Set(rawItems.map((i) => String(i.slug)))];
  const [products, colors] = await Promise.all([
    db.product.findMany({ where: { slug: { in: slugs } }, include: { sizes: true } }),
    db.ralColor.findMany(),
  ]);

  // Ціни перераховуємо на сервері — клієнтським значенням не довіряємо
  const items = rawItems.flatMap((i) => {
    const p = products.find((x) => x.slug === i.slug);
    if (!p || !i.selection) return [];
    const data = toProductData(p);
    const quantity = Math.min(10000, Math.max(1, Math.floor(Number(i.quantity) || 1)));
    const sel = { ...i.selection, quantity };
    const r = price(data, sel, colors.find((c) => c.name === sel.ralName), settings);
    const airflow = num(i.calc?.airflow, 1, 100000);
    const distance = num(i.calc?.distance, 0.1, 100);
    const calc = airflow && distance ? { airflow, distance, deltaT: num(i.calc?.deltaT, 0, 50) } : undefined;
    return [
      {
        slug: p.slug,
        code: p.code,
        name: p.name,
        spec: specString(data, sel),
        // менеджер бачить параметри українською, незалежно від мови сайту клієнта
        details: itemDetails(data, sel, calc, detailLabels(uk), "uk"),
        quantity,
        unitPrice: r.unit,
        total: r.total,
        // у валюті клієнта з маржею — так, як він бачив на сайті
        unitLocal: r.onRequest ? 0 : convert(r.unit, market),
        totalLocal: r.onRequest ? 0 : Math.round(convert(r.unit, market) * quantity * 100) / 100,
        leadDays: r.leadDays,
        onRequest: r.onRequest,
      },
    ];
  });
  if (!items.length) return fail("not_found");
  const totalUah = items.reduce((s, i) => s + i.total, 0);
  const total = Math.round(items.reduce((s, i) => s + i.totalLocal, 0) * 100) / 100;
  const money = (v: number) => formatMoney(v, market.currency, "uk");

  const order = await db.order.create({
    data: {
      name,
      phone,
      email: str(body.email, 120),
      company: str(body.company, 160),
      city: str(body.city, 120),
      comment: str(body.comment, 2000),
      items,
      totalUah,
      locale,
      currency: market.currency,
      fxRate: market.rate,
      margin: market.margin,
      total,
    },
  });

  if (settings.telegramBotToken && settings.telegramChatId) {
    const text = [
      `🆕 Заявка №${order.id}${locale !== routing.defaultLocale ? ` (${locale.toUpperCase()})` : ""}`,
      `${name}, ${phone}${order.company ? `, ${order.company}` : ""}${order.city ? `, ${order.city}` : ""}`,
      ...items.map((i) => `• ${i.spec} × ${i.quantity} — ${i.onRequest ? "за запитом" : money(i.totalLocal)}`),
      `Разом: ${money(total)}${market.currency !== "UAH" || market.margin !== 1 ? ` (база ${uah(totalUah)}, маржа ×${market.margin}${market.currency !== "UAH" ? `, курс ${market.rate}` : ""})` : ""}`,
      order.comment ? `💬 ${order.comment}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    await fetch(`https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: settings.telegramChatId, text }),
    }).catch(() => undefined);
  }

  return NextResponse.json({ id: order.id });
}
