"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { useCart } from "./cart";
import { useMoney } from "./market";

export function CartView() {
  const cart = useCart();
  const t = useTranslations("cart");
  const tc = useTranslations("common");
  const locale = useLocale();
  const money = useMoney();
  const [form, setForm] = useState({ name: "", phone: "", email: "", company: "", city: "", comment: "" });
  const [state, setState] = useState<{ status: "idle" | "sending" | "done" | "error"; message?: string; id?: number }>({ status: "idle" });

  if (!cart.ready) return <div className="py-16 text-center text-muted">{tc("loading")}</div>;

  if (state.status === "done")
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-good-soft text-2xl text-good">✓</div>
        <h1 className="mt-4 text-2xl font-extrabold">{t("sentTitle", { id: state.id ?? 0 })}</h1>
        <p className="mt-2 text-ink-2">{t("sentText")}</p>
        <Link href="/" className="btn-primary mt-6">
          {tc("toCatalogue")}
        </Link>
      </div>
    );

  if (!cart.items.length)
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-extrabold">{t("emptyTitle")}</h1>
        <p className="mt-2 text-muted">{t("emptyText")}</p>
        <Link href="/" className="btn-primary mt-6">
          {tc("toCatalogue")}
        </Link>
      </div>
    );

  const hasOnRequest = cart.items.some((i) => i.unitPrice <= 0);
  const maxLead = Math.max(...cart.items.map((i) => i.leadDays));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState({ status: "sending" });
    try {
      const res = await fetch("/api/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, locale, items: cart.items }) });
      const data = await res.json();
      if (!res.ok) throw new Error(t.has(`errors.${data.code}`) ? t(`errors.${data.code}`) : t("errors.network"));
      cart.clear();
      setState({ status: "done", id: data.id });
    } catch (err) {
      setState({ status: "error", message: err instanceof Error && err.message ? err.message : t("errors.network") });
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
      <h1 className="text-2xl font-extrabold">{t("title")}</h1>
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
                    aria-label={t("quantity")}
                    className="input !w-20 !py-1.5"
                    type="number"
                    min={1}
                    value={i.quantity}
                    onChange={(e) => cart.setQty(i.uid, parseInt(e.target.value, 10))}
                  />
                  <span className="text-sm font-bold">{i.unitPrice > 0 ? money.fmtTotal(i.unitPrice, i.quantity) : tc("priceOnRequest")}</span>
                  <button className="ml-auto text-sm text-muted hover:text-bad" onClick={() => cart.remove(i.uid)}>
                    {t("remove")}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <form onSubmit={submit} className="card h-fit space-y-3 p-5 lg:sticky lg:top-20">
          <div className="flex items-baseline justify-between">
            <span className="text-muted">{t("total")}</span>
            <span className="text-2xl font-extrabold">{money.fmtValue(cart.items.reduce((s, i) => s + (i.unitPrice > 0 ? Math.round(money.conv(i.unitPrice) * i.quantity * 100) / 100 : 0), 0))}</span>
          </div>
          {hasOnRequest && <p className="text-xs text-ok">{t("onRequestNote")}</p>}
          <p className="text-xs text-muted">{t("leadNote", { days: maxLead })}</p>
          <hr className="border-line" />
          {field("name", t("name"), { required: true, autoComplete: "name" })}
          {field("phone", t("phone"), { required: true, type: "tel", autoComplete: "tel", placeholder: t("phonePlaceholder") })}
          {field("email", t("email"), { type: "email", autoComplete: "email" })}
          <div className="grid grid-cols-2 gap-3">
            {field("company", t("company"))}
            {field("city", t("city"))}
          </div>
          <label className="block">
            <span className="label">{t("comment")}</span>
            <textarea className="input min-h-20" value={form.comment} onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))} />
          </label>
          {state.status === "error" && <p className="text-sm text-bad">{state.message}</p>}
          <button className="btn-primary w-full !py-3" disabled={state.status === "sending"}>
            {state.status === "sending" ? t("sending") : t("submit")}
          </button>
        </form>
      </div>
    </div>
  );
}
