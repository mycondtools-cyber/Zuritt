"use client";

import { useMemo, useState, useTransition } from "react";
import { savePrices } from "@/app/admin/actions";
import { Hint } from "@/components/hint";
import { round2 } from "@/lib/calc";

export interface PriceProduct {
  id: number;
  code: string;
  name: string;
  category: string;
  mode: string;
  pricing: Record<string, number>;
  sizes: { id: number; label: string; price: number }[];
}

const RATE_FIELDS: Record<string, [string, string][]> = {
  rect: [
    ["perM2", "грн/м²"],
    ["min", "мін., грн"],
  ],
  slot: [
    ["perMeter", "грн/м.п."],
    ["perExtraSlotPct", "+% за щілину"],
  ],
};

export function PriceGrid({ products, categories }: { products: PriceProduct[]; categories: string[] }) {
  const [rows, setRows] = useState(products);
  const [changedSizes, setChangedSizes] = useState<Set<number>>(new Set());
  const [changedProducts, setChangedProducts] = useState<Set<number>>(new Set());
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const [pct, setPct] = useState("");
  const [onlyEmpty, setOnlyEmpty] = useState(false);
  const [csv, setCsv] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  const visible = useMemo(
    () =>
      rows.filter(
        (p) =>
          (!cat || p.category === cat) &&
          (!q || `${p.code} ${p.name}`.toLowerCase().includes(q.toLowerCase())) &&
          (!onlyEmpty || (p.mode === "sizes" ? p.sizes.some((s) => s.price <= 0) : !(p.pricing.perM2 || p.pricing.perMeter))),
      ),
    [rows, cat, q, onlyEmpty],
  );

  const setSizePrice = (pid: number, sid: number, price: number) => {
    setRows((r) => r.map((p) => (p.id !== pid ? p : { ...p, sizes: p.sizes.map((s) => (s.id === sid ? { ...s, price } : s)) })));
    setChangedSizes((s) => new Set(s).add(sid));
  };
  const setRate = (pid: number, key: string, value: number) => {
    setRows((r) => r.map((p) => (p.id !== pid ? p : { ...p, pricing: { ...p.pricing, [key]: value } })));
    setChangedProducts((s) => new Set(s).add(pid));
  };

  function applyPct() {
    const k = 1 + (parseFloat(pct.replace(",", ".")) || 0) / 100;
    if (k === 1) return;
    const ids = new Set(visible.map((p) => p.id));
    const cs = new Set(changedSizes);
    const cp = new Set(changedProducts);
    setRows((r) =>
      r.map((p) => {
        if (!ids.has(p.id)) return p;
        if (p.mode === "sizes") {
          p.sizes.forEach((s) => cs.add(s.id));
          return { ...p, sizes: p.sizes.map((s) => ({ ...s, price: round2(s.price * k) })) };
        }
        cp.add(p.id);
        const pricing = { ...p.pricing };
        for (const f of ["perM2", "min", "perMeter"]) if (pricing[f]) pricing[f] = round2(pricing[f] * k);
        return { ...p, pricing };
      }),
    );
    setChangedSizes(cs);
    setChangedProducts(cp);
    setMsg(`Змінено на ${pct}% для ${visible.length} товарів — збережіть`);
  }

  function exportCsv() {
    const lines = ["Код;Розмір;Ціна, грн"];
    for (const p of rows) {
      if (p.mode === "sizes") p.sizes.forEach((s) => lines.push(`${p.code};${s.label};${s.price}`));
      else for (const [k] of RATE_FIELDS[p.mode] ?? []) lines.push(`${p.code};${k};${p.pricing[k] ?? 0}`);
    }
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `prices-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  function importCsv(text: string) {
    let hits = 0;
    const miss: string[] = [];
    for (const line of text.split(/\r?\n/)) {
      const parts = line.split(/[;\t,]/).map((x) => x.trim());
      if (parts.length < 3) continue;
      const [code, size, priceRaw] = parts;
      const price = parseFloat(priceRaw.replace(/\s/g, "").replace(",", "."));
      if (!Number.isFinite(price)) continue;
      const p = rows.find((r) => r.code.toLowerCase() === code.toLowerCase());
      if (!p) {
        miss.push(code);
        continue;
      }
      if (p.mode === "sizes") {
        const s = p.sizes.find((x) => x.label.toLowerCase() === size.toLowerCase());
        if (s) {
          setSizePrice(p.id, s.id, price);
          hits++;
        } else miss.push(`${code} ${size}`);
      } else if ((RATE_FIELDS[p.mode] ?? []).some(([k]) => k === size)) {
        setRate(p.id, size, price);
        hits++;
      } else miss.push(`${code} ${size}`);
    }
    setCsv(null);
    setMsg(`Імпортовано ${hits} цін${miss.length ? `; не знайдено: ${[...new Set(miss)].slice(0, 8).join(", ")}${miss.length > 8 ? "…" : ""}` : ""}. Перевірте і збережіть.`);
  }

  function save() {
    start(async () => {
      const sizes = rows.flatMap((p) => p.sizes.filter((s) => changedSizes.has(s.id)).map((s) => ({ id: s.id, price: s.price })));
      const pricing = rows.filter((p) => changedProducts.has(p.id)).map((p) => ({ productId: p.id, pricing: p.pricing }));
      const r = await savePrices(sizes, pricing);
      setChangedSizes(new Set());
      setChangedProducts(new Set());
      setMsg(`Збережено ${r.count} змін`);
    });
  }

  const changes = changedSizes.size + changedProducts.size;

  return (
    <div className="max-w-6xl pb-24">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-extrabold">Ціни</h1>
        <button className="btn-ghost !py-2" onClick={exportCsv}>
          Експорт CSV
        </button>
        <button className="btn-ghost !py-2" onClick={() => setCsv("")}>
          Імпорт з Excel
        </button>
      </div>

      <div className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <label>
          <span className="label">Категорія</span>
          <select className="input" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Усі</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Пошук</span>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Код або назва" />
        </label>
        <label className="flex items-center gap-2 pb-2.5 text-sm">
          <input type="checkbox" checked={onlyEmpty} onChange={(e) => setOnlyEmpty(e.target.checked)} /> лише без цін
        </label>
        <div className="ml-auto flex items-end gap-2">
          <label>
            <span className="label">
              Змінити на % <Hint text="Застосовується до всіх товарів у поточному фільтрі. Напр. 10 — підняти на 10%, -5 — знизити." />
            </span>
            <input className="input !w-24" value={pct} onChange={(e) => setPct(e.target.value)} placeholder="+10" />
          </label>
          <button className="btn-ghost" onClick={applyPct}>
            Застосувати
          </button>
        </div>
      </div>

      {csv !== null && (
        <div className="card mb-4 p-4">
          <p className="mb-2 text-sm text-ink-2">
            Скопіюйте з Excel три колонки: <b>Код</b>, <b>Розмір</b>, <b>Ціна</b> (напр. «PDK 300x300 1250»). Для щілинних розмір = <code>perMeter</code>, для довільних —{" "}
            <code>perM2</code> / <code>min</code>.
          </p>
          <textarea className="input min-h-40 font-mono text-xs" value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={"PDK\t300x300\t1250\nNCD\tD200\t980"} />
          <div className="mt-2 flex gap-2">
            <button className="btn-primary" onClick={() => importCsv(csv)}>
              Імпортувати
            </button>
            <button className="btn-ghost" onClick={() => setCsv(null)}>
              Скасувати
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {visible.map((p) => (
          <section key={p.id} className="card p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded bg-ink px-1.5 py-0.5 text-xs font-bold text-white">{p.code}</span>
              <a href={`/admin/products/${p.id}`} className="font-semibold hover:text-brand">
                {p.name}
              </a>
              <span className="ml-auto text-xs text-muted">{p.category}</span>
            </div>
            {p.mode === "sizes" ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                {p.sizes.map((s) => (
                  <label key={s.id} className="block">
                    <span className="mb-1 block text-xs font-semibold text-ink-2">{s.label}</span>
                    <input
                      className={`input !py-1.5 ${changedSizes.has(s.id) ? "border-brand bg-brand-soft" : s.price > 0 ? "" : "border-ok bg-ok-soft"}`}
                      inputMode="decimal"
                      value={s.price || ""}
                      placeholder="0"
                      onChange={(e) => setSizePrice(p.id, s.id, parseFloat(e.target.value.replace(",", ".")) || 0)}
                    />
                  </label>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {(RATE_FIELDS[p.mode] ?? []).map(([k, l]) => (
                  <label key={k} className="block w-36">
                    <span className="mb-1 block text-xs font-semibold text-ink-2">{l}</span>
                    <input
                      className={`input !py-1.5 ${changedProducts.has(p.id) ? "border-brand bg-brand-soft" : p.pricing[k] ? "" : "border-ok bg-ok-soft"}`}
                      inputMode="decimal"
                      value={p.pricing[k] || ""}
                      placeholder="0"
                      onChange={(e) => setRate(p.id, k, parseFloat(e.target.value.replace(",", ".")) || 0)}
                    />
                  </label>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur lg:left-[220px]">
        <div className="flex max-w-6xl items-center gap-3 p-3 sm:px-6">
          <button className="btn-primary" onClick={save} disabled={pending || changes === 0}>
            {pending ? "Збереження…" : `Зберегти${changes ? ` (${changes})` : ""}`}
          </button>
          <span className="text-sm text-muted">{msg}</span>
        </div>
      </div>
    </div>
  );
}
