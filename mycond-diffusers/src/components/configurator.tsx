"use client";

import { useLocale, useMessages, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import { aero, airflowByRoom, choiceAvailable, chosen, LIMITS, price, recommendSize, recommendSlotLength, specString, visibleGroups, type Level } from "@/lib/calc";
import { detailLabels, itemDetails } from "@/lib/details";
import { ralLabel } from "@/lib/i18n-content";
import { modelSpec } from "@/lib/model3d/spec";
import type { VizKind } from "@/lib/products";
import type { ProductData, RalData, Selection, ShopSettings } from "@/lib/types";
import { useCart } from "./cart";
import { AirflowCfd } from "./airflow-cfd";
import { useColorPreview } from "./color-preview";
import { Hint } from "./hint";
import { useMoney } from "./market";
import { RalPicker } from "./ral-picker";
import { useFormat } from "./use-format";

type PublicSettings = Omit<ShopSettings, "telegramBotToken" | "telegramChatId" | "fx" | "markets">;

const LEVEL_STYLE: Record<Level, string> = {
  good: "bg-good-soft text-good",
  ok: "bg-ok-soft text-ok",
  bad: "bg-bad-soft text-bad",
};
const CURRENCY_LABEL = { UAH: "₴ UAH", PLN: "zł PLN", EUR: "€ EUR" } as const;
const LEVEL_KEY: Record<Level, "levelGood" | "levelOk" | "levelBad"> = { good: "levelGood", ok: "levelOk", bad: "levelBad" };

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
  const t = useTranslations("configurator");
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
          {min !== undefined && max !== undefined ? t("range", { min, max }) : ""}
          {step ? ` · ${t("step", { step })}` : ""} {unit}
        </span>
      )}
    </label>
  );
}

function Metric({ label, value, unit, level, hint }: { label: string; value: string; unit: string; level?: Level; hint: string }) {
  const t = useTranslations("configurator");
  return (
    <div className="rounded-xl border border-line p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted">
        {label} <Hint text={hint} />
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-xl font-extrabold tabular-nums">{value}</span>
        <span className="text-xs text-muted">{unit}</span>
      </div>
      {level && <span className={`mt-1.5 inline-block rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${LEVEL_STYLE[level]}`}>{t(LEVEL_KEY[level])}</span>}
    </div>
  );
}

export function Configurator({ product: p, image, colors, settings, viz }: { product: ProductData; image?: string; colors: RalData[]; settings: PublicSettings; viz?: VizKind }) {
  const cart = useCart();
  const t = useTranslations("configurator");
  const tc = useTranslations("common");
  const tr = useTranslations("ral");
  const messages = useMessages();
  const locale = useLocale();
  const { num } = useFormat();
  const ralText = (name: string) => ralLabel(name, { gloss: tr("suffixGloss"), matt: tr("suffixMatt"), chrome: tr("chrome") });
  const u = (k: "airflow" | "velocity" | "area" | "pressure" | "perHour") => t(`units.${k}`);
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
  const [deltaT, setDeltaT] = useState<number>(10);
  const [inEur, setInEur] = useState(false);
  const money = useMoney(inEur);
  const [room, setRoom] = useState({ open: false, area: 20, height: 2.7, changes: 2 });
  const [added, setAdded] = useState(false);

  const [extra, setExtra] = useState<Record<string, number>>(() => Object.fromEntries((p.limits.extra ?? []).map((e) => [e.key, e.default])));
  const calcOn = p.calc.enabled !== false && p.mode !== "box";
  const base: Selection = { options, ralName, quantity, width, height, length, angle: p.limits.angleMin ? angle : undefined, extra };
  const recommended = useMemo(() => recommendSize(p, base, airflow, distance), [p, options, airflow, distance]); // eslint-disable-line react-hooks/exhaustive-deps
  const effectiveSize = sizeLabel ?? recommended?.label ?? p.sizes[0]?.label;
  const sel: Selection = { ...base, sizeLabel: effectiveSize };
  const ral = colors.find((c) => c.name === ralName);
  // обраний колір — у галерею (попередній перегляд виробу в цьому кольорі)
  const previewCtx = useColorPreview();
  const setPreview = previewCtx?.setColor;
  useEffect(() => {
    if (setPreview && ral)
      setPreview({ hex: ral.hex, name: ralText(ral.name), finish: /9006|9007/.test(ral.code) ? "metallic" : ral.finish === "matt" ? "matt" : "gloss" });
  }, [ral?.hex, ral?.name]); // eslint-disable-line react-hooks/exhaustive-deps
  // параметрична 3D-модель з обраних розмірів
  const spec3d = modelSpec(p, sel);
  const specKey = JSON.stringify(spec3d);
  useEffect(() => {
    previewCtx?.setModel(spec3d);
  }, [specKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const result = aero(p, sel, airflow, distance, deltaT || null);
  const pr = price(p, sel, ral, settings);
  const groups = visibleGroups(p, sel);
  const spec = specString(p, sel);
  const slotHint = recommendSlotLength(p, sel, airflow);

  const lim = p.limits;
  const dimsValid =
    p.mode === "sizes"
      ? !!effectiveSize
      : p.mode === "rect"
        ? width >= (lim.wMin ?? 0) && width <= (lim.wMax ?? 1e9) && height >= (lim.hMin ?? 0) && height <= (lim.hMax ?? 1e9)
        : p.mode === "slot"
          ? length >= (lim.lMin ?? 0) && length <= (lim.lMax ?? 1e9)
          : true;
  const extrasValid = (lim.extra ?? []).every((e) => extra[e.key] >= e.min && extra[e.key] <= e.max);


  function addToCart() {
    const calcInput = result ? { airflow, distance, deltaT: deltaT || null } : undefined;
    const details = itemDetails(p, sel, calcInput, detailLabels(messages as unknown as Parameters<typeof detailLabels>[0]), locale, ralText);
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
      calc: calcInput,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  }

  let n = 1;
  return (
    <div className="space-y-4">
      {/* 1. Розрахунок — спочатку витрата, щоб підібрати розмір */}
      {calcOn && (
      <Step n={n++} title={t("airTitle")} hint={t("airHint")}>
        <div className="grid gap-3 sm:grid-cols-3">
          <NumberField
            label={t("airflow")}
            hint={t("airflowHint")}
            value={airflow}
            onChange={setAirflow}
            min={10}
            max={5000}
            step={10}
            unit={u("airflow")}
          />
          <NumberField
            label={t("distance")}
            hint={t("distanceHint")}
            value={distance}
            onChange={setDistance}
            min={0.5}
            max={15}
            step={0.1}
            unit={tc("m")}
          />
          <NumberField
            label={t("deltaT")}
            hint={t("deltaTHint")}
            value={deltaT}
            onChange={setDeltaT}
            min={0}
            max={20}
            step={1}
            unit="K"
          />
        </div>
        <button type="button" className="mt-3 text-sm font-semibold text-brand" onClick={() => setRoom((r) => ({ ...r, open: !r.open }))}>
          {room.open ? t("roomHide") : t("roomShow")}
        </button>
        {room.open && (
          <div className="mt-3 grid gap-3 rounded-xl bg-paper p-3 sm:grid-cols-4 sm:items-end">
            <NumberField label={t("roomArea")} value={room.area} onChange={(v) => setRoom((r) => ({ ...r, area: v }))} unit={u("area")} />
            <NumberField label={t("roomHeight")} value={room.height} onChange={(v) => setRoom((r) => ({ ...r, height: v }))} unit={tc("m")} />
            <NumberField
              label={t("roomChanges")}
              hint={t("roomChangesHint")}
              value={room.changes}
              onChange={(v) => setRoom((r) => ({ ...r, changes: v }))}
              unit={u("perHour")}
            />
            <button type="button" className="btn-primary" onClick={() => setAirflow(airflowByRoom(room.area, room.height, room.changes))}>
              = {airflowByRoom(room.area, room.height, room.changes)} {u("airflow")}
            </button>
          </div>
        )}
      </Step>
      )}

      {/* 2. Розмір */}
      <Step
        n={n++}
        title={t(p.mode === "slot" ? "sizeTitleSlot" : p.mode === "box" ? "sizeTitleBox" : "sizeTitle")}
        hint={p.mode === "sizes" ? t("sizeHint") : undefined}
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
                    <span className="block text-[11px] text-muted">{r ? `${num(r.velocity, 1)} ${u("velocity")}` : "—"}</span>
                    {isRec && <span className="absolute -right-1.5 -top-2 rounded-md bg-good px-1.5 py-0.5 text-[10px] font-bold text-white">{t("recommended")}</span>}
                  </button>
                );
              })}
            </div>
            {p.sizes.some((s) => s.label.includes("/")) && <p className="mt-2 text-xs text-muted">{t("planksNote")}</p>}
            {sizeLabel && recommended && sizeLabel !== recommended.label && (
              <button type="button" className="mt-3 text-sm font-semibold text-brand" onClick={() => setSizeLabel(undefined)}>
                {t("backToRecommended", { size: recommended.label })}
              </button>
            )}
          </>
        )}
        {p.mode === "rect" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField label={t("width")} value={width} onChange={setWidth} min={lim.wMin} max={lim.wMax} step={lim.step} unit={tc("mm")} />
            <NumberField label={t("height")} value={height} onChange={setHeight} min={lim.hMin} max={lim.hMax} step={lim.step} unit={tc("mm")} />
          </div>
        )}
        {p.mode === "slot" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField label={t("length")} hint={t("lengthHint")} value={length} onChange={setLength} min={lim.lMin} max={lim.lMax} step={lim.step} unit={tc("mm")} />
            {lim.angleMin !== undefined && (
              <NumberField label={t("angle")} value={angle} onChange={setAngle} min={lim.angleMin} max={lim.angleMax} step={lim.angleStep} unit="°" />
            )}
            {slotHint && slotHint !== length && (
              <p className="text-sm text-muted sm:col-span-2">
                {t.rich("slotAdvice", { airflow, length: slotHint, b: (c) => <b>{c}</b> })}{" "}
                <button type="button" className="font-semibold text-brand" onClick={() => setLength(slotHint)}>
                  {t("apply")}
                </button>
              </p>
            )}
          </div>
        )}
        {(lim.extra?.length ?? 0) > 0 && (
          <div className={`grid gap-3 sm:grid-cols-3 ${p.mode === "box" ? "" : "mt-3"}`}>
            {lim.extra!.map((e) => (
              <NumberField
                key={e.key}
                label={e.label}
                hint={e.hint}
                value={extra[e.key]}
                onChange={(v) => setExtra((x) => ({ ...x, [e.key]: v }))}
                min={e.min}
                max={e.max}
                step={e.step}
                unit={e.unit}
              />
            ))}
          </div>
        )}
      </Step>

      {/* 3. Опції */}
      {groups.length > 0 && (
        <Step n={n++} title={t("optionsTitle")}>
          <div className="space-y-4">
            {groups.map((g) => {
              const current = chosen(p, g, sel);
              return (
                <div key={g.key}>
                  <p className="label">
                    {g.label}
                    <Hint text={g.hint} />
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {g.choices.map((c) => {
                      const available = choiceAvailable(p, c, sel);
                      // реальна доплата відносно поточного вибору
                      const delta = available && !pr.onRequest ? price(p, { ...sel, options: { ...options, [g.key]: c.value } }, ral, settings).unit - pr.unit : 0;
                      return (
                        <button
                          key={c.value}
                          type="button"
                          className="chip"
                          aria-pressed={current?.value === c.value}
                          onClick={() => setOptions((o) => ({ ...o, [g.key]: c.value }))}
                          disabled={g.choices.length === 1 || !available}
                          title={available ? undefined : t("unavailable")}
                        >
                          {c.label}
                          {delta !== 0 && current?.value !== c.value && (
                            <span className="ml-1 text-xs text-muted">
                              {delta > 0 ? "+" : "−"}
                              {money.fmt(Math.abs(delta))}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Step>
      )}

      {/* 4. Колір */}
      <Step n={n++} title={t("colorTitle")} hint={t("colorHint")}>
        <RalPicker colors={colors} value={ralName} onChange={setRalName} surchargeUah={pr.onRequest ? 0 : Math.round(pr.ral)} />
      </Step>

      {/* 5. Результат */}
      <section className="card overflow-hidden">
        {p.mode !== "box" && (
        <div className="p-4 sm:p-5">
          <h2 className="mb-3 flex items-center gap-2 font-bold">
            {t("calcTitle")}
            <Hint text={t("calcHint")} />
          </h2>
          {result && dimsValid ? (
            <>
              {viz && p.calc.throwK > 0 && (
                <AirflowCfd p={p} sel={sel} airflow={airflow} distance={distance} deltaT={deltaT} kind={viz} level={result.levels.velocityAtZone} />
              )}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Metric label={t("freeArea")} value={num(result.freeArea, 4)} unit={u("area")} hint={t("freeAreaHint")} />
                <Metric
                  label={t("velocity")}
                  value={num(result.velocity, 2)}
                  unit={u("velocity")}
                  level={result.levels.velocity}
                  hint={t("velocityHint", LIMITS.velocity)}
                />
                {p.calc.throwK > 0 && (
                <Metric
                  label={t("zone")}
                  value={num(result.velocityAtZone, 2)}
                  unit={u("velocity")}
                  level={result.levels.velocityAtZone}
                  hint={t("zoneHint", LIMITS.velocityAtZone)}
                />
                )}
                {p.calc.zeta > 0 && (
                <Metric
                  label={t("pressure")}
                  value={num(result.pressureDrop, result.pressureDrop < 10 ? 1 : 0)}
                  unit={u("pressure")}
                  level={result.levels.pressureDrop}
                  hint={t("pressureHint", LIMITS.pressureDrop)}
                />
                )}
              </div>
              {result.deltaTAtZone !== null && p.calc.tempK > 0 && (
                <p className="mt-3 text-sm text-ink-2">
                  {t.rich("deltaTZone", { value: num(result.deltaTAtZone, 2), b: (c) => <b>{c}</b> })}
                  {result.deltaTAtZone > 2 ? t("deltaTBad") : t("deltaTGood")}
                </p>
              )}
              <Verdict result={result} />
            </>
          ) : (
            <p className="text-sm text-muted">
              {t(p.calc.enabled === false ? "calcDisabled" : dimsValid ? "calcNeedAirflow" : "calcBadDims")}
            </p>
          )}
        </div>

        )}

        <div className="border-t border-line bg-paper p-4 sm:p-5">
          <p className="text-xs text-muted">{t("marking")}</p>
          <p className="mt-0.5 font-mono text-sm font-bold">{spec}</p>
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <div>
              <div className="mb-1 flex gap-1 text-xs">
                {money.canAlt &&
                  [false, true].map((eurOn) => (
                    <button key={String(eurOn)} type="button" className={`rounded-md px-2 py-0.5 font-semibold ${inEur === eurOn ? "bg-ink text-white" : "text-muted"}`} onClick={() => setInEur(eurOn)}>
                      {eurOn ? "€ EUR" : CURRENCY_LABEL[money.market.currency]}
                    </button>
                  ))}
              </div>
              {pr.onRequest ? (
                <p className="text-xl font-extrabold">{tc("priceOnRequest")}</p>
              ) : (
                <>
                  <p className="text-2xl font-extrabold tabular-nums">{money.fmtTotal(pr.unit, quantity)}</p>
                  <p className="text-xs text-muted">
                    {t("unitTimesQty", { unit: money.fmt(pr.unit), qty: quantity })}
                    {pr.ral > 0 && t("ralIncluded", { value: money.fmtTotal(pr.ral, quantity) })}
                  </p>
                </>
              )}
              <p className="mt-1 text-xs text-muted">{t("leadTime", { days: pr.leadDays })}</p>
            </div>
            <div className="ml-auto flex items-end gap-2">
              <label className="w-24">
                <span className="mb-1 block text-xs text-muted">{t("quantity")}</span>
                <input className="input" type="number" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))} />
              </label>
              <button type="button" className="btn-primary !py-3" onClick={addToCart} disabled={!dimsValid || !extrasValid}>
                {added ? t("added") : t("addToCart")}
              </button>
            </div>
          </div>
          {added && (
            <Link href="/cart" className="mt-3 block text-sm font-semibold text-brand">
              {t("goToCart", { count: cart.count })}
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}

function Verdict({ result }: { result: NonNullable<ReturnType<typeof aero>> }) {
  const t = useTranslations("configurator");
  const tips: string[] = [];
  if (result.levels.velocity === "bad") tips.push(t("tipVelocity"));
  if (result.levels.velocityAtZone === "bad") tips.push(t("tipZone"));
  if (result.levels.pressureDrop === "bad") tips.push(t("tipPressure"));
  const allGood = Object.values(result.levels).every((l) => l === "good");
  return (
    <div className={`mt-3 rounded-xl p-3 text-sm ${allGood ? "bg-good-soft text-good" : tips.length ? "bg-bad-soft text-bad" : "bg-ok-soft text-ok"}`}>
      {allGood ? t("verdictGood") : tips.length ? tips.map((x) => <p key={x}>• {x}</p>) : t("verdictOk")}
    </div>
  );
}
