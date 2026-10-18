"use client";

import { useState } from "react";
import { CONTENT_LOCALES, LOCALE_NAMES } from "@/i18n/routing";
import type { ProductTranslation, Translations } from "@/lib/i18n-content";
import type { ExtraInput, OptionGroup } from "@/lib/types";

type Base = { name: string; summary: string; description: string; options: OptionGroup[]; extra: ExtraInput[] };

/** Скільки полів перекладено з тих, що є українською */
function progress(base: Base, tr: ProductTranslation = {}) {
  let total = 0;
  let done = 0;
  const count = (src: string | undefined, dst: string | undefined) => {
    if (!src?.trim()) return;
    total++;
    if (dst?.trim()) done++;
  };
  count(base.name, tr.name);
  count(base.summary, tr.summary);
  count(base.description, tr.description);
  for (const g of base.options) {
    count(g.label, tr.options?.[g.key]?.label);
    count(g.hint, tr.options?.[g.key]?.hint);
    for (const c of g.choices) count(c.label, tr.options?.[g.key]?.choices?.[c.value]);
  }
  for (const e of base.extra) {
    count(e.label, tr.extra?.[e.key]?.label);
    count(e.hint, tr.extra?.[e.key]?.hint);
  }
  return { done, total };
}

/**
 * Переклад контенту товару. Порожнє поле — на сайті показується українською.
 * Ключі опцій і значення варіантів не перекладаються — лише підписи.
 */
export function TranslationsEditor({ base, value, onChange }: { base: Base; value: Translations<ProductTranslation>; onChange: (v: Translations<ProductTranslation>) => void }) {
  const [locale, setLocale] = useState<string>(CONTENT_LOCALES[0]);
  const tr = value[locale] ?? {};
  const update = (patch: (t: ProductTranslation) => ProductTranslation) => onChange({ ...value, [locale]: patch(structuredClone(tr)) });
  const setField = (k: "name" | "summary" | "description", v: string) => update((t) => ({ ...t, [k]: v }));
  const setOpt = (key: string, patch: { label?: string; hint?: string; choice?: [string, string] }) =>
    update((t) => {
      const o = { ...(t.options ?? {}) };
      const g = { ...(o[key] ?? {}) };
      if (patch.label !== undefined) g.label = patch.label;
      if (patch.hint !== undefined) g.hint = patch.hint;
      if (patch.choice) g.choices = { ...(g.choices ?? {}), [patch.choice[0]]: patch.choice[1] };
      o[key] = g;
      return { ...t, options: o };
    });
  const setExtra = (key: string, k: "label" | "hint" | "unit", v: string) =>
    update((t) => ({ ...t, extra: { ...(t.extra ?? {}), [key]: { ...(t.extra?.[key] ?? {}), [k]: v } } }));

  const Src = ({ text }: { text: string }) => <span className="mb-1 block truncate text-xs text-muted" title={text}>🇺🇦 {text}</span>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {CONTENT_LOCALES.map((l) => {
          const { done, total } = progress(base, value[l]);
          return (
            <button key={l} type="button" className="chip" aria-pressed={locale === l} onClick={() => setLocale(l)}>
              {LOCALE_NAMES[l]}{" "}
              <span className={`text-xs ${done === total ? "text-good" : "text-muted"}`}>
                {done}/{total}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">Назва</span>
          <Src text={base.name} />
          <input className="input" value={tr.name ?? ""} onChange={(e) => setField("name", e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Короткий опис</span>
          <Src text={base.summary} />
          <textarea className="input min-h-16" value={tr.summary ?? ""} onChange={(e) => setField("summary", e.target.value)} />
        </label>
      </div>

      {base.options.length > 0 && (
        <div className="space-y-3">
          <p className="label">Опції</p>
          {base.options.map((g) => {
            const t = tr.options?.[g.key];
            return (
              <div key={g.key} className="rounded-xl border border-line p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <Src text={g.label} />
                    <input className="input" placeholder="Назва групи" value={t?.label ?? ""} onChange={(e) => setOpt(g.key, { label: e.target.value })} />
                  </label>
                  {g.hint && (
                    <label className="block">
                      <Src text={g.hint} />
                      <input className="input" placeholder="Підказка" value={t?.hint ?? ""} onChange={(e) => setOpt(g.key, { hint: e.target.value })} />
                    </label>
                  )}
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {g.choices.map((c) => (
                    <label key={c.value} className="block">
                      <Src text={c.label} />
                      <input className="input !py-1.5" value={t?.choices?.[c.value] ?? ""} onChange={(e) => setOpt(g.key, { choice: [c.value, e.target.value] })} />
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {base.extra.length > 0 && (
        <div className="space-y-2">
          <p className="label">Додаткові поля</p>
          {base.extra.map((e) => (
            <div key={e.key} className="grid gap-2 sm:grid-cols-[1fr_2fr_100px]">
              <label className="block">
                <Src text={e.label} />
                <input className="input !py-1.5" value={tr.extra?.[e.key]?.label ?? ""} onChange={(x) => setExtra(e.key, "label", x.target.value)} />
              </label>
              <label className="block">
                <Src text={e.hint ?? "—"} />
                <input className="input !py-1.5" value={tr.extra?.[e.key]?.hint ?? ""} onChange={(x) => setExtra(e.key, "hint", x.target.value)} disabled={!e.hint} />
              </label>
              <label className="block">
                <Src text={e.unit || "—"} />
                <input className="input !py-1.5" value={tr.extra?.[e.key]?.unit ?? ""} onChange={(x) => setExtra(e.key, "unit", x.target.value)} />
              </label>
            </div>
          ))}
        </div>
      )}

      <label className="block">
        <span className="label">Опис (Markdown, та сама структура, що й українською)</span>
        <textarea className="input min-h-64 font-mono text-xs" placeholder={base.description} value={tr.description ?? ""} onChange={(e) => setField("description", e.target.value)} />
      </label>
    </div>
  );
}
