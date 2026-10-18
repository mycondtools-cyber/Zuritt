"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteProduct, duplicateProduct, saveProduct, uploadImage, type ProductInput } from "@/app/admin/actions";
import { Hint } from "@/components/hint";
import { Markdown } from "@/components/markdown";
import { TranslationsEditor } from "./translations-editor";
import { MODES, MOUNTING, SHAPES } from "@/lib/products";
import type { Choice, ExtraInput, OptionGroup, SizeRow } from "@/lib/types";

const CALC_FIELDS: ["areaCoef" | "zeta" | "throwK" | "tempK" | "slotWidthMm", string, string][] = [
  ["areaCoef", "Коеф. живого перерізу", "Частка габаритної площі, через яку проходить повітря (0,1–0,7). Використовується, якщо в розмірі не вказано живий переріз."],
  ["zeta", "ζ — опір", "Коефіцієнт місцевого опору: dP = ζ·ρ·v²/2. Типово 2–4 для дифузорів, ~1 для сопел."],
  ["throwK", "K — далекобійність", "Згасання швидкості струменя: vx = K·v0·√A / x (для щілинних — плаский струмінь vx = K·v0·√(b/x))."],
  ["tempK", "n — температура", "Згасання різниці температур: зазвичай ≈ 0,7–0,8·K."],
  ["slotWidthMm", "Ширина щілини, мм", "Для щілинних, якщо ширина не обирається в опціях."],
];

function Section({ title, hint, children, actions }: { title: string; hint?: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="card p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="font-bold">{title}</h2>
        {hint && <Hint text={hint} />}
        <div className="ml-auto flex gap-2">{actions}</div>
      </div>
      {children}
    </section>
  );
}

function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">
        {label}
        {hint && <Hint text={hint} />}
      </span>
      {children}
    </label>
  );
}

const numVal = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const parse = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));

export function ProductEditor({ initial, categories }: { initial: ProductInput; categories: { id: number; name: string }[] }) {
  const router = useRouter();
  const [p, setP] = useState<ProductInput>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState(false);
  const [dirty, setDirty] = useState(false);

  const set = <K extends keyof ProductInput>(k: K, v: ProductInput[K]) => {
    setP((x) => ({ ...x, [k]: v }));
    setDirty(true);
  };
  const setSize = (i: number, patch: Partial<SizeRow>) => set("sizes", p.sizes.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const setGroup = (i: number, patch: Partial<OptionGroup>) => set("options", p.options.map((g, k) => (k === i ? { ...g, ...patch } : g)));
  const setChoice = (gi: number, ci: number, patch: Partial<Choice>) =>
    setGroup(gi, { choices: p.options[gi].choices.map((c, k) => (k === ci ? { ...c, ...patch } : c)) });
  const move = <T,>(arr: T[], i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= arr.length) return arr;
    const a = [...arr];
    [a[i], a[j]] = [a[j], a[i]];
    return a;
  };

  function save() {
    setMsg(null);
    start(async () => {
      const r = await saveProduct(p);
      if (!r.ok) return setMsg({ ok: false, text: r.error });
      setDirty(false);
      setMsg({ ok: true, text: "Збережено" });
      if (!p.id) router.replace(`/admin/products/${r.id}`);
      else router.refresh();
    });
  }

  async function onUpload(files: FileList | null) {
    if (!files?.length) return;
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append("files", f));
    setMsg({ ok: true, text: "Завантаження фото…" });
    const r = await uploadImage(fd);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    set("images", [...p.images, ...r.urls]);
    setMsg({ ok: true, text: "Фото додано — не забудьте зберегти" });
  }

  const pricing = p.pricing as Record<string, number | undefined>;
  const limits = p.limits as Record<string, number | undefined>;
  const setPricing = (k: string, v: string) => set("pricing", { ...p.pricing, [k]: parse(v) ?? 0 });
  const slotRows = (p.pricing.byKey ?? {}) as Record<string, { fixed: number; perMeter: number }>;
  const setSlotRow = (key: string, patch: Partial<{ fixed: number; perMeter: number }>, newKey = key) =>
    set("pricing", {
      ...p.pricing,
      byKey: Object.fromEntries(
        (key in slotRows ? Object.entries(slotRows) : [...Object.entries(slotRows), [key, { fixed: 0, perMeter: 0 }] as const]).map(([k, r]) =>
          k === key ? [newKey, { ...r, ...patch }] : [k, r],
        ),
      ),
    });
  const [openBySize, setOpenBySize] = useState<string | null>(null);
  const setLimit = (k: string, v: string) => set("limits", { ...p.limits, [k]: parse(v) ?? undefined });

  return (
    <div className="max-w-5xl space-y-4 pb-24">
      <div className="flex flex-wrap items-center gap-3">
        <a href="/admin/products" className="text-sm text-muted hover:text-brand">
          ← Товари
        </a>
        <h1 className="text-xl font-extrabold">{p.id ? `${p.code} — ${p.name}` : "Новий товар"}</h1>
        {p.id && (
          <a href={`/d/${p.slug}`} target="_blank" className="text-sm text-brand">
            На сайті ↗
          </a>
        )}
      </div>

      <Section title="Основне">
        <div className="grid gap-3 sm:grid-cols-6">
          <Field label="Код / маркування" className="sm:col-span-1">
            <input className="input" value={p.code} onChange={(e) => set("code", e.target.value)} />
          </Field>
          <Field label="Назва" className="sm:col-span-3">
            <input className="input" value={p.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Адреса (slug)" hint="Латиницею, використовується в посиланні /d/slug" className="sm:col-span-2">
            <input className="input" value={p.slug} onChange={(e) => set("slug", e.target.value)} />
          </Field>
          <Field label="Категорія" className="sm:col-span-2">
            <select className="input" value={p.categoryId} onChange={(e) => set("categoryId", Number(e.target.value))}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Форма" className="sm:col-span-2">
            <select className="input" value={p.shape} onChange={(e) => set("shape", e.target.value)}>
              {Object.entries(SHAPES).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Термін виготовлення, роб. днів" className="sm:col-span-1">
            <input className="input" type="number" value={p.leadDays} onChange={(e) => set("leadDays", Number(e.target.value))} />
          </Field>
          <Field label="Порядок" hint="Менше — вище в каталозі" className="sm:col-span-1">
            <input className="input" type="number" value={p.sort} onChange={(e) => set("sort", Number(e.target.value))} />
          </Field>
          <div className="sm:col-span-6">
            <span className="label">Монтаж</span>
            <div className="flex flex-wrap gap-2">
              {Object.entries(MOUNTING).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  className="chip"
                  aria-pressed={p.mounting.includes(v)}
                  onClick={() => set("mounting", p.mounting.includes(v) ? p.mounting.filter((m) => m !== v) : [...p.mounting, v])}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <Field label="Короткий опис (у картці)" className="sm:col-span-6">
            <textarea className="input min-h-16" value={p.summary} onChange={(e) => set("summary", e.target.value)} />
          </Field>
          <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-6">
            <input type="checkbox" className="h-4 w-4 accent-[var(--color-brand)]" checked={p.active} onChange={(e) => set("active", e.target.checked)} />
            Показувати на сайті
          </label>
        </div>
      </Section>

      <Section
        title="Фото"
        hint="Перше фото — головне в каталозі. Можна завантажити файл або вставити посилання."
        actions={
          <label className="btn-ghost cursor-pointer !py-1.5">
            + Завантажити
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => onUpload(e.target.files)} />
          </label>
        }
      >
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {p.images.map((src, i) => (
            <div key={src + i} className="group relative rounded-xl border border-line bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="aspect-square w-full object-contain p-1" />
              {i === 0 && <span className="absolute left-1 top-1 rounded bg-brand px-1 text-[10px] font-bold text-white">головне</span>}
              <div className="flex justify-between border-t border-line text-xs">
                <button type="button" className="px-2 py-1 hover:text-brand" onClick={() => set("images", move(p.images, i, -1))} aria-label="Вліво">
                  ←
                </button>
                <button type="button" className="px-2 py-1 text-bad" onClick={() => set("images", p.images.filter((_, k) => k !== i))} aria-label="Видалити">
                  ✕
                </button>
                <button type="button" className="px-2 py-1 hover:text-brand" onClick={() => set("images", move(p.images, i, 1))} aria-label="Вправо">
                  →
                </button>
              </div>
            </div>
          ))}
        </div>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const input = (e.currentTarget.elements.namedItem("url") as HTMLInputElement) ?? null;
            if (input?.value.trim()) {
              set("images", [...p.images, input.value.trim()]);
              input.value = "";
            }
          }}
        >
          <input name="url" className="input" placeholder="https://… посилання на фото" />
          <button className="btn-ghost">Додати</button>
        </form>
      </Section>

      <Section title="Розміри та ціна" hint="Спосіб задання розміру визначає, що бачить клієнт у конфігураторі і як рахується ціна.">
        <div className="mb-4 flex flex-wrap gap-2">
          {Object.entries(MODES).map(([v, l]) => (
            <button key={v} type="button" className="chip" aria-pressed={p.mode === v} onClick={() => set("mode", v)}>
              {l}
            </button>
          ))}
        </div>

        {p.mode === "sizes" && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr>
                    <th className="pb-2 font-semibold">Типорозмір</th>
                    <th className="pb-2 font-semibold">Ш, мм</th>
                    <th className="pb-2 font-semibold">В, мм</th>
                    <th className="pb-2 font-semibold">Ø, мм</th>
                    <th className="pb-2 font-semibold">
                      <span className="inline-flex items-center gap-1">
                        Живий переріз, м² <Hint text="З каталогу виробника. Якщо порожньо — рахується з коефіцієнта живого перерізу." />
                      </span>
                    </th>
                    <th className="pb-2 font-semibold">Ціна, грн</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {p.sizes.map((s, i) => (
                    <tr key={i}>
                      <td className="py-1 pr-2">
                        <input className="input !py-1.5" value={s.label} onChange={(e) => setSize(i, { label: e.target.value })} />
                      </td>
                      {(["w", "h", "d"] as const).map((k) => (
                        <td key={k} className="py-1 pr-2">
                          <input className="input !w-20 !py-1.5" inputMode="numeric" value={numVal(s[k])} onChange={(e) => setSize(i, { [k]: parse(e.target.value) })} />
                        </td>
                      ))}
                      <td className="py-1 pr-2">
                        <input className="input !w-28 !py-1.5" inputMode="decimal" value={numVal(s.freeArea)} placeholder="авто" onChange={(e) => setSize(i, { freeArea: parse(e.target.value) })} />
                      </td>
                      <td className="py-1 pr-2">
                        <input
                          className={`input !w-28 !py-1.5 font-semibold ${s.price > 0 ? "" : "border-ok bg-ok-soft"}`}
                          inputMode="decimal"
                          value={numVal(s.price)}
                          onChange={(e) => setSize(i, { price: parse(e.target.value) ?? 0 })}
                        />
                      </td>
                      <td className="whitespace-nowrap py-1 text-xs">
                        <button type="button" className="px-1 hover:text-brand" onClick={() => set("sizes", move(p.sizes, i, -1))} aria-label="Вгору">
                          ↑
                        </button>
                        <button type="button" className="px-1 hover:text-brand" onClick={() => set("sizes", move(p.sizes, i, 1))} aria-label="Вниз">
                          ↓
                        </button>
                        <button type="button" className="px-1 text-bad" onClick={() => set("sizes", p.sizes.filter((_, k) => k !== i))} aria-label="Видалити">
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              className="btn-ghost mt-3 !py-1.5"
              onClick={() => set("sizes", [...p.sizes, { label: "", w: null, h: null, d: null, freeArea: null, price: 0, sort: p.sizes.length }])}
            >
              + Розмір
            </button>
          </>
        )}

        {p.mode === "rect" && (
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Фіксована частина, грн" hint="Ціна = фіксована + площа × ставка за м² + периметр × ставка за м, але не менше мінімальної">
              <input className="input" value={numVal(pricing.fixed)} onChange={(e) => setPricing("fixed", e.target.value)} />
            </Field>
            <Field label="За м² площі, грн">
              <input className="input" value={numVal(pricing.perM2)} onChange={(e) => setPricing("perM2", e.target.value)} />
            </Field>
            <Field label="За м периметра, грн">
              <input className="input" value={numVal(pricing.perM)} onChange={(e) => setPricing("perM", e.target.value)} />
            </Field>
            <Field label="Мінімальна ціна, грн">
              <input className="input" value={numVal(pricing.min)} onChange={(e) => setPricing("min", e.target.value)} />
            </Field>
            {(
              [
                ["wMin", "Ширина від"],
                ["wMax", "Ширина до"],
                ["hMin", "Висота від"],
                ["hMax", "Висота до"],
                ["wDefault", "Ширина за замовч."],
                ["hDefault", "Висота за замовч."],
                ["step", "Крок, мм"],
              ] as const
            ).map(([k, l]) => (
              <Field key={k} label={l}>
                <input className="input" value={numVal(limits[k])} onChange={(e) => setLimit(k, e.target.value)} />
              </Field>
            ))}
          </div>
        )}

        {p.mode === "slot" && (
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="sm:col-span-4">
              <p className="label">
                Ціна за кількістю щілин
                <Hint text="Ціна = фіксована частина + довжина (м) × ставка за метр. Ключ «2» — для 2 щілин, «2x30» — для 2 щілин шириною 30 мм." />
              </p>
              <table className="w-full max-w-lg text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr>
                    <th className="font-semibold">Ключ</th>
                    <th className="font-semibold">Фіксована, грн</th>
                    <th className="font-semibold">За метр, грн</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(slotRows).map(([key, r]) => (
                    <tr key={key}>
                      <td className="py-1 pr-2">
                        <input className="input !w-24 !py-1.5 font-mono" defaultValue={key} onBlur={(e) => e.target.value !== key && setSlotRow(key, {}, e.target.value)} />
                      </td>
                      <td className="py-1 pr-2">
                        <input className="input !py-1.5" inputMode="decimal" value={numVal(r.fixed)} onChange={(e) => setSlotRow(key, { fixed: parse(e.target.value) ?? 0 })} />
                      </td>
                      <td className="py-1 pr-2">
                        <input className="input !py-1.5" inputMode="decimal" value={numVal(r.perMeter)} onChange={(e) => setSlotRow(key, { perMeter: parse(e.target.value) ?? 0 })} />
                      </td>
                      <td className="py-1 text-xs">
                        <button type="button" className="text-bad" aria-label="Видалити" onClick={() => set("pricing", { ...p.pricing, byKey: Object.fromEntries(Object.entries(slotRows).filter(([k]) => k !== key)) })}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button type="button" className="mt-1 text-sm font-semibold text-brand" onClick={() => setSlotRow(String(Object.keys(slotRows).length + 1), { fixed: 0, perMeter: 0 })}>
                + рядок
              </button>
            </div>
            <Field label="Мін. довжина для ціни, мм" hint="Коротші дифузори рахуються як ця довжина">
              <input className="input" value={numVal(pricing.minLengthMm)} onChange={(e) => setPricing("minLengthMm", e.target.value)} />
            </Field>
            <div className="sm:col-span-3" />
            {(
              [
                ["lMin", "Довжина від, мм"],
                ["lMax", "Довжина до, мм"],
                ["lDefault", "За замовчуванням"],
                ["step", "Крок, мм"],
                ["angleMin", "Кут від, °"],
                ["angleMax", "Кут до, °"],
                ["angleStep", "Крок кута"],
                ["angleDefault", "Кут за замовч."],
              ] as const
            ).map(([k, l]) => (
              <Field key={k} label={l} hint={k === "angleMin" ? "Лише для кутових елементів; залиште порожнім, якщо кута немає" : undefined}>
                <input className="input" value={numVal(limits[k])} onChange={(e) => setLimit(k, e.target.value)} />
              </Field>
            ))}
          </div>
        )}
        {p.mode === "box" && (
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Фіксована частина, грн" hint="Ціна = фіксована + площа поверхні × ставка за м² + довжина ребер × ставка за м + додаткові поля + патрубки й опції">
              <input className="input" value={numVal(pricing.fixed)} onChange={(e) => setPricing("fixed", e.target.value)} />
            </Field>
            <Field label="За м² поверхні, грн">
              <input className="input" value={numVal(pricing.perM2)} onChange={(e) => setPricing("perM2", e.target.value)} />
            </Field>
            <Field label="За м ребер, грн">
              <input className="input" value={numVal(pricing.perM)} onChange={(e) => setPricing("perM", e.target.value)} />
            </Field>
            <Field label="Мінімальна ціна, грн">
              <input className="input" value={numVal(pricing.min)} onChange={(e) => setPricing("min", e.target.value)} />
            </Field>
          </div>
        )}

        <div className="mt-5">
          <p className="label">
            Додаткові поля
            <Hint text="Числові поля конфігуратора: діаметр патрубка, ширина рамки, габарити боксу (ключі a, b, h), діаметр і кількість підключень (connD, connCount). Ставка — доплата за одиницю значення." />
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="font-semibold">Ключ</th>
                  <th className="font-semibold">Назва</th>
                  <th className="font-semibold">Од.</th>
                  <th className="font-semibold">Від</th>
                  <th className="font-semibold">До</th>
                  <th className="font-semibold">Крок</th>
                  <th className="font-semibold">За замовч.</th>
                  {p.mode !== "sizes" && p.mode !== "slot" && <th className="font-semibold">грн / од.</th>}
                  <th />
                </tr>
              </thead>
              <tbody>
                {(p.limits.extra ?? []).map((e, i) => {
                  const setE = (patch: Partial<ExtraInput>) => set("limits", { ...p.limits, extra: (p.limits.extra ?? []).map((x, k) => (k === i ? { ...x, ...patch } : x)) });
                  const perExtra = (p.pricing.perExtra ?? {}) as Record<string, number>;
                  return (
                    <tr key={i}>
                      <td className="py-1 pr-2">
                        <input className="input !w-24 !py-1.5 font-mono text-xs" value={e.key} onChange={(ev) => setE({ key: ev.target.value })} />
                      </td>
                      <td className="py-1 pr-2">
                        <input className="input !py-1.5" value={e.label} onChange={(ev) => setE({ label: ev.target.value })} />
                      </td>
                      <td className="py-1 pr-2">
                        <input className="input !w-16 !py-1.5" value={e.unit} onChange={(ev) => setE({ unit: ev.target.value })} />
                      </td>
                      {(["min", "max", "step", "default"] as const).map((f) => (
                        <td key={f} className="py-1 pr-2">
                          <input className="input !w-20 !py-1.5" inputMode="decimal" value={numVal(e[f])} onChange={(ev) => setE({ [f]: parse(ev.target.value) ?? 0 })} />
                        </td>
                      ))}
                      {p.mode !== "sizes" && p.mode !== "slot" && (
                        <td className="py-1 pr-2">
                          <input
                            className="input !w-24 !py-1.5"
                            inputMode="decimal"
                            value={numVal(perExtra[e.key])}
                            onChange={(ev) => set("pricing", { ...p.pricing, perExtra: { ...perExtra, [e.key]: parse(ev.target.value) ?? 0 } })}
                          />
                        </td>
                      )}
                      <td className="py-1 text-xs">
                        <button type="button" className="text-bad" aria-label="Видалити поле" onClick={() => set("limits", { ...p.limits, extra: (p.limits.extra ?? []).filter((_, k) => k !== i) })}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className="mt-1 text-sm font-semibold text-brand"
            onClick={() => set("limits", { ...p.limits, extra: [...(p.limits.extra ?? []), { key: `x${(p.limits.extra ?? []).length + 1}`, label: "Нове поле", unit: "мм", min: 0, max: 1000, step: 1, default: 100 }] })}
          >
            + поле
          </button>
        </div>

        <div className="mt-4 max-w-xs">
          <Field label="Коефіцієнт фарбування RAL" hint="Множник надбавки за колір: 1 — як у еталонного дифузора PDK, 0 — колір не впливає на ціну (напр. гіпсові під фарбування на об’єкті).">
            <input className="input" value={numVal(pricing.ralFactor)} placeholder="1" onChange={(e) => set("pricing", { ...p.pricing, ralFactor: parse(e.target.value) ?? undefined })} />
          </Field>
        </div>
      </Section>

      <Section
        title="Опції"
        hint="Кнопки вибору в конфігураторі. Доплата: фіксована (грн) або % від базової ціни. Ключі nslots і nslotswidth використовуються в розрахунку щілинних."
        actions={
          <button
            type="button"
            className="btn-ghost !py-1.5"
            onClick={() => set("options", [...p.options, { key: `opt${p.options.length + 1}`, label: "Нова опція", hint: "", default: "", choices: [{ value: "Так", label: "Так", priceAdd: 0, pricePct: 0 }] }])}
          >
            + Опція
          </button>
        }
      >
        <div className="space-y-4">
          {p.options.length === 0 && <p className="text-sm text-muted">Опцій немає.</p>}
          {p.options.map((g, gi) => (
            <div key={gi} className="rounded-xl border border-line p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_140px_2fr_auto]">
                <input className="input font-semibold" value={g.label} onChange={(e) => setGroup(gi, { label: e.target.value })} placeholder="Назва" />
                <input className="input font-mono text-xs" value={g.key} onChange={(e) => setGroup(gi, { key: e.target.value })} placeholder="ключ" />
                <input className="input" value={g.hint} onChange={(e) => setGroup(gi, { hint: e.target.value })} placeholder="Підказка для клієнта" />
                <div className="flex items-center text-xs">
                  <button type="button" className="px-1.5" onClick={() => set("options", move(p.options, gi, -1))} aria-label="Вгору">
                    ↑
                  </button>
                  <button type="button" className="px-1.5" onClick={() => set("options", move(p.options, gi, 1))} aria-label="Вниз">
                    ↓
                  </button>
                  <button type="button" className="px-1.5 text-bad" onClick={() => set("options", p.options.filter((_, k) => k !== gi))} aria-label="Видалити опцію">
                    ✕
                  </button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                Показувати, лише коли
                <select
                  className="input !w-auto !py-1 text-xs"
                  value={g.showIf?.key ?? ""}
                  onChange={(e) => setGroup(gi, { showIf: e.target.value ? { key: e.target.value, values: g.showIf?.values ?? [] } : undefined })}
                >
                  <option value="">завжди</option>
                  {p.options
                    .filter((o) => o.key !== g.key)
                    .map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                </select>
                {g.showIf && (
                  <>
                    =
                    <input
                      className="input !w-56 !py-1 text-xs"
                      placeholder="значення через кому"
                      defaultValue={g.showIf.values.join(", ")}
                      onBlur={(e) => setGroup(gi, { showIf: { key: g.showIf!.key, values: e.target.value.split(",").map((v) => v.trim()).filter(Boolean) } })}
                    />
                  </>
                )}
              </div>
              <table className="mt-2 w-full text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr>
                    <th className="font-semibold">За замовч.</th>
                    <th className="font-semibold">Значення</th>
                    <th className="font-semibold">+ грн</th>
                    <th className="font-semibold">+ %</th>
                    {p.mode === "slot" && (
                      <>
                        <th className="font-semibold">+ грн/щілину</th>
                        <th className="font-semibold">+ грн/м</th>
                        <th className="font-semibold">+ грн/м·щілину</th>
                      </>
                    )}
                    {(p.mode === "rect" || p.mode === "box") && <th className="font-semibold">+ грн/м²</th>}
                    {p.mode === "box" && (
                      <>
                        <th className="font-semibold">+ грн/підкл.</th>
                        <th className="font-semibold">+ грн/мм Ø</th>
                      </>
                    )}
                    {p.mode === "sizes" && <th className="font-semibold">За розмірами</th>}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {g.choices.flatMap((c, ci) => [
                    <tr key={ci}>
                      <td className="w-20 py-1">
                        <input type="radio" name={`def-${gi}`} checked={(g.default || g.choices[0]?.value) === c.value} onChange={() => setGroup(gi, { default: c.value })} />
                      </td>
                      <td className="py-1 pr-2">
                        <input className="input !py-1.5" value={c.label} onChange={(e) => setChoice(gi, ci, c.value === c.label ? { label: e.target.value, value: e.target.value } : { label: e.target.value })} />
                      </td>
                      <td className="w-28 py-1 pr-2">
                        <input className="input !py-1.5" inputMode="decimal" value={numVal(c.priceAdd)} onChange={(e) => setChoice(gi, ci, { priceAdd: parse(e.target.value) ?? 0 })} />
                      </td>
                      <td className="w-24 py-1 pr-2">
                        <input className="input !py-1.5" inputMode="decimal" value={numVal(c.pricePct)} onChange={(e) => setChoice(gi, ci, { pricePct: parse(e.target.value) ?? 0 })} />
                      </td>
                      {p.mode === "slot" &&
                        (["pricePerSlot", "pricePerM", "pricePerSlotM"] as const).map((f) => (
                          <td key={f} className="w-24 py-1 pr-2">
                            <input className="input !py-1.5" inputMode="decimal" value={numVal(c[f])} onChange={(e) => setChoice(gi, ci, { [f]: parse(e.target.value) ?? undefined })} />
                          </td>
                        ))}
                      {(p.mode === "rect" || p.mode === "box") && (
                        <td className="w-24 py-1 pr-2">
                          <input className="input !py-1.5" inputMode="decimal" value={numVal(c.pricePerM2)} onChange={(e) => setChoice(gi, ci, { pricePerM2: parse(e.target.value) ?? undefined })} />
                        </td>
                      )}
                      {p.mode === "box" &&
                        (["pricePerConn", "pricePerConnMm"] as const).map((f) => (
                          <td key={f} className="w-24 py-1 pr-2">
                            <input className="input !py-1.5" inputMode="decimal" value={numVal(c[f])} onChange={(e) => setChoice(gi, ci, { [f]: parse(e.target.value) ?? undefined })} />
                          </td>
                        ))}
                      {p.mode === "sizes" && (
                        <td className="py-1 pr-2 text-xs">
                          <button type="button" className="font-semibold text-brand" onClick={() => setOpenBySize(openBySize === `${gi}-${ci}` ? null : `${gi}-${ci}`)}>
                            {c.priceBySize && Object.keys(c.priceBySize).length ? `${Object.keys(c.priceBySize).length} розм.` : "задати"}
                          </button>
                        </td>
                      )}
                      <td className="w-8 py-1 text-xs">
                        <button type="button" className="text-bad" onClick={() => setGroup(gi, { choices: g.choices.filter((_, k) => k !== ci) })} aria-label="Видалити варіант">
                          ✕
                        </button>
                      </td>
                    </tr>,
                    openBySize === `${gi}-${ci}` && (
                      <tr key={`${ci}-bysize`}>
                        <td />
                        <td colSpan={5} className="pb-3">
                          <p className="mb-1 text-xs text-muted">Доплата для кожного розміру, грн. Порожнє поле — варіант недоступний для цього розміру (якщо заповнено хоча б один).</p>
                          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                            {p.sizes.map((sz) => (
                              <label key={sz.label} className="text-xs">
                                <span className="block font-semibold">{sz.label}</span>
                                <input
                                  className="input !py-1"
                                  inputMode="decimal"
                                  value={numVal(c.priceBySize?.[sz.label])}
                                  onChange={(e) => {
                                    const v = parse(e.target.value);
                                    const next = { ...(c.priceBySize ?? {}) };
                                    if (v === null) delete next[sz.label];
                                    else next[sz.label] = v;
                                    setChoice(gi, ci, { priceBySize: next });
                                  }}
                                />
                              </label>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ),
                  ])}
                </tbody>
              </table>
              <button
                type="button"
                className="mt-1 text-sm font-semibold text-brand"
                onClick={() => setGroup(gi, { choices: [...g.choices, { value: `Варіант ${g.choices.length + 1}`, label: `Варіант ${g.choices.length + 1}`, priceAdd: 0, pricePct: 0 }] })}
              >
                + варіант
              </button>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Коефіцієнти розрахунку" hint="Впливають на швидкість, тиск і рекомендацію розміру. Відкалібровані за програмою підбору виробника.">
        <label className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={p.calc.enabled !== false} onChange={(e) => set("calc", { ...p.calc, enabled: e.target.checked ? undefined : false })} />
          Показувати розрахунок на сайті
        </label>
        <div className="grid gap-3 sm:grid-cols-5">
          {CALC_FIELDS.map(([k, l, h]) => (
            <Field key={k} label={l} hint={h}>
              <input
                className="input"
                inputMode="decimal"
                value={numVal(p.calc[k])}
                onChange={(e) => set("calc", { ...p.calc, [k]: parse(e.target.value) ?? undefined })}
              />
            </Field>
          ))}
        </div>
        {p.mode === "slot" && (
          <div className="mt-4">
            <p className="label">
              Уточнення за кількістю щілин
              <Hint text="Ключ «2» — для 2 щілин, «2x30» — для 2 щілин шириною 30 мм. Порожнє поле — береться загальний коефіцієнт вище." />
            </p>
            <table className="w-full max-w-xl text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="font-semibold">Ключ</th>
                  <th className="font-semibold">ζ</th>
                  <th className="font-semibold">K</th>
                  <th className="font-semibold">n</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {Object.entries(p.calc.byKey ?? {}).map(([key, v]) => {
                  const setRow = (patch: Record<string, number | null>, newKey = key) => {
                    const entries = Object.entries(p.calc.byKey ?? {}).map(([k, x]) => (k === key ? [newKey, { ...x, ...patch }] : [k, x]));
                    set("calc", { ...p.calc, byKey: Object.fromEntries(entries) });
                  };
                  return (
                    <tr key={key}>
                      <td className="py-1 pr-2">
                        <input className="input !w-24 !py-1.5 font-mono" defaultValue={key} onBlur={(e) => e.target.value !== key && setRow({}, e.target.value)} />
                      </td>
                      {(["zeta", "throwK", "tempK"] as const).map((f) => (
                        <td key={f} className="py-1 pr-2">
                          <input className="input !py-1.5" inputMode="decimal" value={numVal(v[f])} onChange={(e) => setRow({ [f]: parse(e.target.value) })} />
                        </td>
                      ))}
                      <td className="py-1 text-xs">
                        <button
                          type="button"
                          className="text-bad"
                          aria-label="Видалити"
                          onClick={() => set("calc", { ...p.calc, byKey: Object.fromEntries(Object.entries(p.calc.byKey ?? {}).filter(([k]) => k !== key)) })}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <button
              type="button"
              className="mt-1 text-sm font-semibold text-brand"
              onClick={() => set("calc", { ...p.calc, byKey: { ...(p.calc.byKey ?? {}), [String(Object.keys(p.calc.byKey ?? {}).length + 1)]: {} } })}
            >
              + рядок
            </button>
          </div>
        )}
      </Section>

      <Section
        title="Опис"
        hint="Формат: «## Заголовок», порожній рядок між абзацами, «- » для списку, **жирний**."
        actions={
          <button type="button" className="btn-ghost !py-1.5" onClick={() => setPreview((v) => !v)}>
            {preview ? "Редагувати" : "Перегляд"}
          </button>
        }
      >
        {preview ? <Markdown source={p.description} /> : <textarea className="input min-h-80 font-mono text-xs" value={p.description} onChange={(e) => set("description", e.target.value)} />}
      </Section>

      <Section title="Переклади" hint="Англійська, польська та інші мови сайту. Порожні поля показуються українською.">
        <TranslationsEditor
          base={{ name: p.name, summary: p.summary, description: p.description, options: p.options, extra: p.limits.extra ?? [] }}
          value={p.translations}
          onChange={(v) => set("translations", v)}
        />
      </Section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur lg:left-[220px]">
        <div className="flex max-w-5xl flex-wrap items-center gap-3 p-3 sm:px-6">
          <button className="btn-primary" onClick={save} disabled={pending}>
            {pending ? "Збереження…" : "Зберегти"}
          </button>
          {msg ? <span className={`text-sm ${msg.ok ? "text-good" : "text-bad"}`}>{msg.text}</span> : dirty && <span className="text-sm text-ok">Є незбережені зміни</span>}
          {p.id && (
            <span className="ml-auto flex gap-2">
              <button type="button" className="btn-ghost !py-2" onClick={() => start(() => duplicateProduct(p.id!))}>
                Дублювати
              </button>
              <button
                type="button"
                className="btn-ghost !py-2 hover:!border-bad hover:!text-bad"
                onClick={() => confirm(`Видалити «${p.name}» назавжди?`) && start(() => deleteProduct(p.id!))}
              >
                Видалити
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
