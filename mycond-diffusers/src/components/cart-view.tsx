"use client";

import Link from "next/link";
import { useState } from "react";
import { uah } from "@/lib/format";
import { useCart } from "./cart";

export function CartView() {
  const cart = useCart();
  const [form, setForm] = useState({ name: "", phone: "", email: "", company: "", city: "", comment: "" });
  const [state, setState] = useState<{ status: "idle" | "sending" | "done" | "error"; message?: string; id?: number }>({ status: "idle" });

  if (!cart.ready) return <div className="py-16 text-center text-muted">Завантаження…</div>;

  if (state.status === "done")
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-good-soft text-2xl text-good">✓</div>
        <h1 className="mt-4 text-2xl font-extrabold">Заявку №{state.id} надіслано</h1>
        <p className="mt-2 text-ink-2">Менеджер зв’яжеться з вами, підтвердить ціну та термін виготовлення.</p>
        <Link href="/" className="btn-primary mt-6">
          До каталогу
        </Link>
      </div>
    );

  if (!cart.items.length)
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-extrabold">Заявка порожня</h1>
        <p className="mt-2 text-muted">Оберіть дифузор у каталозі та натисніть «Додати до заявки».</p>
        <Link href="/" className="btn-primary mt-6">
          До каталогу
        </Link>
      </div>
    );

  const hasOnRequest = cart.items.some((i) => i.unitPrice <= 0);
  const maxLead = Math.max(...cart.items.map((i) => i.leadDays));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState({ status: "sending" });
    try {
      const res = await fetch("/api/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, items: cart.items }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Помилка");
      cart.clear();
      setState({ status: "done", id: data.id });
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : "Помилка надсилання" });
    }
  }

  const field = (k: keyof typeof form, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block">
      <span className="label">{label}</span>
      <input className="input" value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} {...props} />
    </label>
  );

  return (
    <div className="py-8">
      <h1 className="text-2xl font-extrabold">Заявка</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <ul className="space-y-3">
          {cart.items.map((i) => (
            <li key={i.uid} className="card flex gap-4 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {i.image && <img src={i.image} alt="" className="h-20 w-20 shrink-0 rounded-xl border border-line object-contain p-1" />}
              <div className="min-w-0 flex-1">
                <Link href={`/d/${i.slug}`} className="font-bold hover:text-brand">
                  {i.name}
                </Link>
                <p className="font-mono text-xs font-semibold text-ink-2">{i.spec}</p>
                <p className="mt-1 text-xs text-muted">{i.details.map((d) => `${d.label}: ${d.value}`).join(" · ")}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <input
                    aria-label="Кількість"
                    className="input !w-20 !py-1.5"
                    type="number"
                    min={1}
                    value={i.quantity}
                    onChange={(e) => cart.setQty(i.uid, parseInt(e.target.value, 10))}
                  />
                  <span className="text-sm font-bold">{i.unitPrice > 0 ? uah(i.unitPrice * i.quantity) : "Ціна за запитом"}</span>
                  <button className="ml-auto text-sm text-muted hover:text-bad" onClick={() => cart.remove(i.uid)}>
                    Видалити
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <form onSubmit={submit} className="card h-fit space-y-3 p-5 lg:sticky lg:top-20">
          <div className="flex items-baseline justify-between">
            <span className="text-muted">Разом</span>
            <span className="text-2xl font-extrabold">{uah(cart.total)}</span>
          </div>
          {hasOnRequest && <p className="text-xs text-ok">Частина позицій — за запитом: менеджер назве ціну.</p>}
          <p className="text-xs text-muted">Орієнтовний термін виготовлення: до {maxLead} роб. днів.</p>
          <hr className="border-line" />
          {field("name", "Ім’я *", { required: true, autoComplete: "name" })}
          {field("phone", "Телефон *", { required: true, type: "tel", autoComplete: "tel", placeholder: "+380…" })}
          {field("email", "Email", { type: "email", autoComplete: "email" })}
          <div className="grid grid-cols-2 gap-3">
            {field("company", "Компанія")}
            {field("city", "Місто")}
          </div>
          <label className="block">
            <span className="label">Коментар</span>
            <textarea className="input min-h-20" value={form.comment} onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))} />
          </label>
          {state.status === "error" && <p className="text-sm text-bad">{state.message}</p>}
          <button className="btn-primary w-full !py-3" disabled={state.status === "sending"}>
            {state.status === "sending" ? "Надсилаємо…" : "Надіслати заявку"}
          </button>
        </form>
      </div>
    </div>
  );
}
