"use client";

import { useMemo, useState } from "react";
import { aero, airflowByRoom, LIMITS, price, recommendSize, recommendSlotLength, specString, type Level } from "@/lib/calc";
import { eur, num, uah } from "@/lib/format";
import type { CartItem, ProductData, RalData, Selection, ShopSettings } from "@/lib/types";
import { useCart } from "./cart";
import { Hint } from "./hint";
import { RalPicker } from "./ral-picker";

type PublicSettings = Omit<ShopSettings, "telegramBotToken" | "telegramChatId">;

const LEVEL_STYLE: Record<Level, string> = {
  good: "bg-good-soft text-good",
  ok: "bg-ok-soft text-ok",
  bad: "bg-bad-soft text-bad",
};
const LEVEL_TEXT: Record<Level, string> = { good: "добре", ok: "допустимо", bad: "забагато" };

function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card p-4 sm:p-5">
      <h2 className="mb-3 flex items-center gap-2 font-bold">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand text-xs text-white">{n}</span>
        {title}
        {hint && <Hint text={hint} />}
      </h2>
      {children}
    </section>
  );
}

function NumberField({
  label,
  hint,
  value,
  onChange,
  min,
  max,
  step,
  unit,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}) {
  const [raw, setRaw] = useState(String(value));
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    setRaw(String(value));
  }
  const out = (min !== undefined && value < min) || (max !== undefined && value > max);
  return (
    <label className="block">
      <span className="label">
        {label}
        {hint && <Hint text={hint} />}
      </span>
      <span className="relative block">
        <input
          className={`input pr-12 ${out ? "border-bad" : ""}`}
          type="number"
          inputMode="decimal"
          value={raw}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            setRaw(e.target.value);
            const v = parseFloat(e.target.value.replace(",", "."));
            if (Number.isFinite(v)) onChange(v);
          }}
        />
        {unit && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">{unit}</span>}
      </span>
      {(min !== undefined || max !== undefined) && (
        <span className={`mt-1 block text-xs ${out ? "text-bad" : "text-muted"}`}>
          {min !== undefined && max !== undefined ? `від ${min} до ${max}` : ""}
          {step ? ` · крок ${step}` : ""} {unit}
        </span>
      )}
    </label>
  );
}

function Metric({ label, value, unit, level, hint }: { label: string; value: string; unit: string; level?: Level; hint: string }) {
  return (
    <div className="rounded-xl border border-line p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted">
        {label} <Hint text={hint} />
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-xl font-extrabold tabular-nums">{value}</span>
        <span className="text-xs text-muted">{unit}</span>
      </div>
      {level && <span className={`mt-1.5 inline-block rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${LEVEL_STYLE[level]}`}>{LEVEL_TEXT[level]}</span>}
    </div>
  );
}

export function Configurator({ product: p, image, colors, settings }: { product: ProductData; image?: string; colors: RalData[]; settings: PublicSettings }) {
  const cart = useCart();
  const standard = colors.find((c) => c.isStandard) ?? colors[0];

  const [options, setOptions] = useState<Record<string, string>>(() => Object.fromEntries(p.options.map((g) => [g.key, g.default])));
  const [sizeLabel, setSizeLabel] = useState<string | undefined>(undefined);
  const [width, setWidth] = useState(p.limits.wDefault ?? p.limits.wMin ?? 300);
  const [height, setHeight] = useState(p.limits.hDefault ?? p.limits.hMin ?? 300);
  const [length, setLength] = useState(p.limits.lDefault ?? 1000);
  const [angle, setAngle] = useState(p.limits.angleDefault ?? 90);
  const [ralName, setRalName] = useState(standard?.name ?? "");
  const [quantity, setQuantity] = useState(1);
  const [airflow, setAirflow] = useState(150);
  const [distance, setDistance] = useState(2);
  const [deltaT, setDeltaT] = useState<number>(0);
  const [currency, setCurrency] = useState<"uah" | "eur">("uah");
  const [room, setRoom] = useState({ open: false, area: 20, height: 2.7, changes: 2 });
  const [added, setAdded] = useState(false);

  const base: Selection = { options, ralName, quantity, width, height, length, angle: p.limits.angleMin ? angle : undefined };
  const recommended = useMemo(() => recommendSize(p, base, airflow, distance), [p, options, airflow, distance]); // eslint-disable-line react-hooks/exhaustive-deps
  const effectiveSize = sizeLabel ?? recommended?.label ?? p.sizes[0]?.label;
  const sel: Selection = { ...base, sizeLabel: effectiveSize };
  const ral = colors.find((c) => c.name === ralName);
  const result = aero(p, sel, airflow, distance, deltaT || null);
  const pr = price(p, sel, ral, settings);
  const spec = specString(p, sel);
  const slotHint = recommendSlotLength(p, sel, airflow);

  const lim = p.limits;
  const dimsValid =
    p.mode === "sizes"
      ? !!effectiveSize
      : p.mode === "rect"
        ? width >= (lim.wMin ?? 0) && width <= (lim.wMax ?? 1e9) && height >= (lim.hMin ?? 0) && height <= (lim.hMax ?? 1e9)
        : length >= (lim.lMin ?? 0) && length <= (lim.lMax ?? 1e9);

  const money = (uahValue: number) => (currency === "uah" ? uah(uahValue) : eur(uahValue / (settings.eurRate || 1)));

  function addToCart() {
    const details: CartItem["details"] = [];
    if (p.mode === "sizes") details.push({ label: "Розмір", value: effectiveSize ?? "" });
    if (p.mode === "rect") details.push({ label: "Розмір Ш×В", value: `${width}×${height} мм` });
    if (p.mode === "slot") details.push({ label: "Довжина", value: `${length} мм` });
    if (p.mode === "slot" && lim.angleMin) details.push({ label: "Кут", value: `${angle}°` });
    for (const g of p.options) details.push({ label: g.label, value: options[g.key] ?? g.default });
    details.push({ label: "Колір", value: ralName });
    if (result) details.push({ label: "Розрахунок", value: `${airflow} м³/год · ${num(result.velocity, 1)} м/с · ${num(result.pressureDrop, 0)} Па` });
    cart.add({
      uid: crypto.randomUUID(),
      slug: p.slug,
      code: p.code,
      name: p.name,
      image,
      spec,
      details,
      unitPrice: pr.unit,
      quantity,
      leadDays: pr.leadDays,
      selection: sel,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  }

  let n = 1;
  return (
    <div className="space-y-4">
      {/* 1. Розрахунок — спочатку витрата, щоб підібрати розмір */}
      <Step n={n++} title="Скільки повітря подаємо?" hint="Вкажіть витрату повітря на один дифузор. Якщо не знаєте — порахуйте за площею приміщення.">
        <div className="grid gap-3 sm:grid-cols-3">
          <NumberField
            label="Витрата повітря"
            hint="Скільки повітря проходить через один дифузор за годину. Береться з проєкту або з розрахунку кратності."
            value={airflow}
            onChange={setAirflow}
            min={10}
            max={5000}
            step={10}
            unit="м³/год"
          />
          <NumberField
            label="До робочої зони"
            hint="Відстань від дифузора до зони, де перебувають люди (зазвичай висота стелі мінус 1,8 м). Чим ближче — тим вища швидкість потоку біля людей."
            value={distance}
            onChange={setDistance}
            min={0.5}
            max={15}
            step={0.1}
            unit="м"
          />
          <NumberField
            label="ΔT припливу"
            hint="Різниця між температурою приміщення і припливного повітря (напр. кондиціонер дає +8 К холодніше). Необов’язково — 0, якщо вентиляція без нагріву/охолодження."
            value={deltaT}
            onChange={setDeltaT}
            min={0}
            max={20}
            step={1}
            unit="K"
          />
        </div>
        <button type="button" className="mt-3 text-sm font-semibold text-brand" onClick={() => setRoom((r) => ({ ...r, open: !r.open }))}>
          {room.open ? "Сховати" : "Не знаю витрату — порахувати за приміщенням"}
        </button>
        {room.open && (
          <div className="mt-3 grid gap-3 rounded-xl bg-paper p-3 sm:grid-cols-4 sm:items-end">
            <NumberField label="Площа" value={room.area} onChange={(v) => setRoom((r) => ({ ...r, area: v }))} unit="м²" />
            <NumberField label="Висота" value={room.height} onChange={(v) => setRoom((r) => ({ ...r, height: v }))} unit="м" />
            <NumberField
              label="Кратність"
              hint="Скільки разів на годину оновлюється повітря: житло 1–2, офіс 2–4, кухня/санвузол 5–10."
              value={room.changes}
              onChange={(v) => setRoom((r) => ({ ...r, changes: v }))}
              unit="1/год"
            />
            <button type="button" className="btn-primary" onClick={() => setAirflow(airflowByRoom(room.area, room.height, room.changes))}>
              = {airflowByRoom(room.area, room.height, room.changes)} м³/год
            </button>
          </div>
        )}
      </Step>

      {/* 2. Розмір */}
      <Step
        n={n++}
        title={p.mode === "slot" ? "Довжина та щілини" : "Розмір"}
        hint={p.mode === "sizes" ? "Посадковий розмір — під отвір або повітровід. Ми позначаємо найменший розмір, що працює тихо й без протягів." : undefined}
      >
        {p.mode === "sizes" && (
          <>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {p.sizes.map((s) => {
                const r = aero(p, { ...sel, sizeLabel: s.label }, airflow, distance, null, s);
                const isRec = recommended?.label === s.label;
                return (
                  <button
                    key={s.label}
                    type="button"
                    className="chip relative text-left"
                    aria-pressed={effectiveSize === s.label}
                    onClick={() => setSizeLabel(s.label)}
                  >
                    <span className="block font-bold">{s.label}</span>
                    <span className="block text-[11px] text-muted">{r ? `${num(r.velocity, 1)} м/с` : "—"}</span>
                    {isRec && <span className="absolute -right-1.5 -top-2 rounded-md bg-good px-1.5 py-0.5 text-[10px] font-bold text-white">радимо</span>}
                  </button>
                );
              })}
            </div>
            {sizeLabel && recommended && sizeLabel !== recommended.label && (
              <button type="button" className="mt-3 text-sm font-semibold text-brand" onClick={() => setSizeLabel(undefined)}>
                Повернути рекомендований {recommended.label}
              </button>
            )}
          </>
        )}
        {p.mode === "rect" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField label="Ширина L" value={width} onChange={setWidth} min={lim.wMin} max={lim.wMax} step={lim.step} unit="мм" />
            <NumberField label="Висота H" value={height} onChange={setHeight} min={lim.hMin} max={lim.hMax} step={lim.step} unit="мм" />
          </div>
        )}
        {p.mode === "slot" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField label="Довжина" hint="Загальна довжина дифузора. Довгі лінії збираються з кількох секцій." value={length} onChange={setLength} min={lim.lMin} max={lim.lMax} step={lim.step} unit="мм" />
            {lim.angleMin !== undefined && (
              <NumberField label="Кут кутового елемента" value={angle} onChange={setAngle} min={lim.angleMin} max={lim.angleMax} step={lim.angleStep} unit="°" />
            )}
            {slotHint && slotHint !== length && (
              <p className="text-sm text-muted sm:col-span-2">
                Для {airflow} м³/год з обраною кількістю щілин радимо довжину від <b>{slotHint} мм</b>.{" "}
                <button type="button" className="font-semibold text-brand" onClick={() => setLength(slotHint)}>
                  Застосувати
                </button>
              </p>
            )}
          </div>
        )}
      </Step>

      {/* 3. Опції */}
      {p.options.length > 0 && (
        <Step n={n++} title="Виконання">
          <div className="space-y-4">
            {p.options.map((g) => (
              <div key={g.key}>
                <p className="label">
                  {g.label}
                  <Hint text={g.hint} />
                </p>
                <div className="flex flex-wrap gap-2">
                  {g.choices.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      className="chip"
                      aria-pressed={(options[g.key] ?? g.default) === c.value}
                      onClick={() => setOptions((o) => ({ ...o, [g.key]: c.value }))}
                      disabled={g.choices.length === 1}
                    >
                      {c.label}
                      {(c.priceAdd > 0 || c.pricePct > 0) && (
                        <span className="ml-1 text-xs text-muted">+{c.pricePct > 0 ? `${c.pricePct}%` : uah(c.priceAdd)}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Step>
      )}

      {/* 4. Колір */}
      <Step n={n++} title="Колір RAL" hint="Корпус фарбується порошковою фарбою. Стандарт — білий RAL 9016, інші кольори виготовляються під замовлення.">
        <RalPicker colors={colors} value={ralName} onChange={setRalName} surchargePct={settings.ralSurchargePct} />
      </Step>

      {/* 5. Результат */}
      <section className="card overflow-hidden">
        <div className="p-4 sm:p-5">
          <h2 className="mb-3 flex items-center gap-2 font-bold">
            Розрахунок
            <Hint text="Орієнтовний розрахунок за довідковими коефіцієнтами. Для відповідальних об’єктів остаточний підбір перевіряє інженер." />
          </h2>
          {result && dimsValid ? (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Metric label="Живий переріз" value={num(result.freeArea, 4)} unit="м²" hint="Площа, через яку реально проходить повітря (без рамки й ламелей)." />
                <Metric
                  label="Швидкість на виході"
                  value={num(result.velocity, 2)}
                  unit="м/с"
                  level={result.levels.velocity}
                  hint={`До ${LIMITS.velocity.good} м/с — тихо (житло, офіс), до ${LIMITS.velocity.ok} м/с — допустимо, вище — чутний шум.`}
                />
                <Metric
                  label="У робочій зоні"
                  value={num(result.velocityAtZone, 2)}
                  unit="м/с"
                  level={result.levels.velocityAtZone}
                  hint={`Швидкість потоку біля людей. До ${LIMITS.velocityAtZone.good} м/с — комфортно, вище ${LIMITS.velocityAtZone.ok} м/с — відчувається протяг.`}
                />
                <Metric
                  label="Втрата тиску"
                  value={num(result.pressureDrop, 0)}
                  unit="Па"
                  level={result.levels.pressureDrop}
                  hint={`Скільки тиску «з’їдає» дифузор. До ${LIMITS.pressureDrop.good} Па — добре, понад ${LIMITS.pressureDrop.ok} Па — вентилятор працюватиме важче й гучніше.`}
                />
              </div>
              {result.deltaTAtZone !== null && (
                <p className="mt-3 text-sm text-ink-2">
                  Різниця температур у робочій зоні ≈ <b>{num(result.deltaTAtZone, 1)} K</b>
                  {result.deltaTAtZone > 1.5 ? " — відчутно, краще збільшити розмір або відстань." : " — комфортно."}
                </p>
              )}
              <Verdict result={result} />
            </>
          ) : (
            <p className="text-sm text-muted">{dimsValid ? "Вкажіть витрату повітря, щоб побачити розрахунок." : "Перевірте розміри — вони поза допустимим діапазоном."}</p>
          )}
        </div>

        <div className="border-t border-line bg-paper p-4 sm:p-5">
          <p className="text-xs text-muted">Маркування для замовлення</p>
          <p className="mt-0.5 font-mono text-sm font-bold">{spec}</p>
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <div>
              <div className="mb-1 flex gap-1 text-xs">
                {(["uah", "eur"] as const).map((c) => (
                  <button key={c} type="button" className={`rounded-md px-2 py-0.5 font-semibold ${currency === c ? "bg-ink text-white" : "text-muted"}`} onClick={() => setCurrency(c)}>
                    {c === "uah" ? "₴ грн" : "€ EUR"}
                  </button>
                ))}
              </div>
              {pr.onRequest ? (
                <p className="text-xl font-extrabold">Ціна за запитом</p>
              ) : (
                <>
                  <p className="text-2xl font-extrabold tabular-nums">{money(pr.total)}</p>
                  <p className="text-xs text-muted">
                    {money(pr.unit)} × {quantity} шт.
                    {pr.ral > 0 && ` · у т.ч. фарбування ${money(pr.ral * quantity)}`}
                  </p>
                </>
              )}
              <p className="mt-1 text-xs text-muted">Виготовлення: {pr.leadDays} роб. днів</p>
            </div>
            <div className="ml-auto flex items-end gap-2">
              <label className="w-24">
                <span className="mb-1 block text-xs text-muted">Кількість</span>
                <input className="input" type="number" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))} />
              </label>
              <button type="button" className="btn-primary !py-3" onClick={addToCart} disabled={!dimsValid}>
                {added ? "✓ Додано" : "Додати до заявки"}
              </button>
            </div>
          </div>
          {added && (
            <a href="/cart" className="mt-3 block text-sm font-semibold text-brand">
              Перейти до заявки ({cart.count}) →
            </a>
          )}
        </div>
      </section>
    </div>
  );
}

function Verdict({ result }: { result: NonNullable<ReturnType<typeof aero>> }) {
  const tips: string[] = [];
  if (result.levels.velocity === "bad") tips.push("Швидкість на виході завелика — буде шумно. Оберіть більший розмір або поставте кілька дифузорів.");
  if (result.levels.velocityAtZone === "bad") tips.push("Біля людей буде протяг. Збільште розмір, кількість дифузорів або оберіть вихровий тип.");
  if (result.levels.pressureDrop === "bad") tips.push("Великий опір: вентилятору знадобиться більше тиску. Збільште розмір.");
  const allGood = Object.values(result.levels).every((l) => l === "good");
  return (
    <div className={`mt-3 rounded-xl p-3 text-sm ${allGood ? "bg-good-soft text-good" : tips.length ? "bg-bad-soft text-bad" : "bg-ok-soft text-ok"}`}>
      {allGood ? "✓ Розмір підходить: тихо, без протягів і з невеликим опором." : tips.length ? tips.map((t) => <p key={t}>• {t}</p>) : "Працюватиме, але з невеликим запасом — для житлових кімнат краще розмір більше."}
    </div>
  );
}
