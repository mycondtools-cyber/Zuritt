import { NextResponse } from "next/server";
import { price, specString } from "@/lib/calc";
import { db } from "@/lib/db";
import { uah } from "@/lib/format";
import { toProductData } from "@/lib/products";
import { getSettings } from "@/lib/settings";
import type { CartItem } from "@/lib/types";

const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некоректний запит" }, { status: 400 });
  }
  const name = str(body.name, 120);
  const phone = str(body.phone, 40);
  if (!name || phone.replace(/\D/g, "").length < 9) return NextResponse.json({ error: "Вкажіть ім’я та телефон" }, { status: 400 });
  const rawItems = Array.isArray(body.items) ? (body.items as CartItem[]).slice(0, 100) : [];
  if (!rawItems.length) return NextResponse.json({ error: "Заявка порожня" }, { status: 400 });

  const settings = await getSettings();
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
    return [
      {
        slug: p.slug,
        code: p.code,
        name: p.name,
        spec: specString(data, sel),
        details: Array.isArray(i.details) ? i.details.slice(0, 20).map((d) => ({ label: str(d.label, 80), value: str(d.value, 200) })) : [],
        quantity,
        unitPrice: r.unit,
        total: r.total,
        leadDays: r.leadDays,
        onRequest: r.onRequest,
      },
    ];
  });
  if (!items.length) return NextResponse.json({ error: "Товари не знайдено" }, { status: 400 });
  const totalUah = items.reduce((s, i) => s + i.total, 0);

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
    },
  });

  if (settings.telegramBotToken && settings.telegramChatId) {
    const text = [
      `🆕 Заявка №${order.id}`,
      `${name}, ${phone}${order.company ? `, ${order.company}` : ""}${order.city ? `, ${order.city}` : ""}`,
      ...items.map((i) => `• ${i.spec} × ${i.quantity} — ${i.onRequest ? "за запитом" : uah(i.total)}`),
      `Разом: ${uah(totalUah)}`,
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
