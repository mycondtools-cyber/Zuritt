"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { jet, type Level } from "@/lib/calc";
import { computeField, geometry, isoline, sample, ZONE, type Field, type FlowKind } from "@/lib/flowfield";
import type { ProductData, Selection } from "@/lib/types";
import { useFormat } from "./use-format";

/** Верх шкали швидкості, м/с (вище — насичений червоний, як у CFD-звітах про комфорт) */
const VMAX = 1;
const PAD = 10;

/** Палітра Turbo (Google): поліноміальне наближення, t ∈ [0, 1] */
function turbo(t: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, t));
  const r = 34.61 + x * (1172.33 - x * (10793.56 - x * (33300.12 - x * (38394.49 - x * 14825.05))));
  const g = 23.31 + x * (557.33 + x * (1225.33 - x * (3574.96 - x * (1073.77 + x * 707.56))));
  const b = 27.2 + x * (3211.1 - x * (15327.97 - x * (27814 - x * (22569.18 - x * 6838.66))));
  return [r, g, b].map((c) => Math.max(0, Math.min(255, Math.round(c)))) as [number, number, number];
}

/** Охолодження: нейтральне приміщення → блакитний → глибокий синій */
function cool(t: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, t)) ** 0.8;
  const stops: [number, [number, number, number]][] = [
    [0, [244, 242, 236]],
    [0.25, [191, 219, 254]],
    [0.55, [96, 165, 250]],
    [0.8, [37, 99, 235]],
    [1, [30, 58, 138]],
  ];
  for (let i = 1; i < stops.length; i++) {
    const [a, ca] = stops[i - 1];
    const [b, cb] = stops[i];
    if (x <= b) {
      const u = (x - a) / (b - a);
      return ca.map((c, k) => Math.round(c + (cb[k] - c) * u)) as [number, number, number];
    }
  }
  return stops[stops.length - 1][1];
}

const LEVEL_COLOR: Record<Level, string> = { good: "var(--color-good)", ok: "var(--color-ok)", bad: "var(--color-bad)" };
type Mode = "speed" | "temp";

export function AirflowCfd({
  p,
  sel,
  airflow,
  distance,
  deltaT,
  kind,
  level,
}: {
  p: ProductData;
  sel: Selection;
  airflow: number;
  distance: number;
  deltaT: number;
  kind: FlowKind;
  level: Level;
}) {
  const t = useTranslations("configurator");
  const { num } = useFormat();
  const wrap = useRef<HTMLDivElement>(null);
  const heat = useRef<HTMLCanvasElement>(null);
  const parts = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(640);
  const [mode, setMode] = useState<Mode>("speed");

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const j = useMemo(() => jet(p, sel, airflow), [p, sel, airflow]);
  const geo = useMemo(() => geometry(kind, distance), [kind, distance]);
  const nx = width < 500 ? 150 : 230;
  const field = useMemo<Field | null>(() => (j ? computeField(geo, j, nx, deltaT) : null), [geo, j, nx, deltaT]);
  const tempOn = deltaT > 0 && (j?.tempK ?? 0) > 0;
  const m: Mode = tempOn ? mode : "speed";
  // шкала температури — до половини ΔT припливу: у приміщенні різниці невеликі, повна шкала робить поле блідим
  const tMax = Math.max(1, Math.round(deltaT / 2));

  // масштаб: приміщення вписується в ширину, висота — за пропорціями
  const k = (width - 2 * PAD) / geo.roomW;
  const height = Math.round(geo.ceil * k + 2 * PAD);
  const X = (x: number) => PAD + x * k;
  const Y = (y: number) => PAD + (geo.ceil - y) * k;

  // теплова карта поля
  useEffect(() => {
    const cv = heat.current;
    if (!cv || !field) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(width * dpr);
    cv.height = Math.round(height * dpr);
    const ctx = cv.getContext("2d")!;
    const img = new ImageData(field.nx, field.ny);
    for (let i = 0; i < field.nx * field.ny; i++) {
      const c = m === "speed" ? turbo(field.speed[i] / VMAX) : cool(-field.dT[i] / tMax);
      img.data.set([c[0], c[1], c[2], 255], i * 4);
    }
    const off = document.createElement("canvas");
    off.width = field.nx;
    off.height = field.ny;
    off.getContext("2d")!.putImageData(img, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(off, X(0), Y(geo.ceil), geo.roomW * k, geo.ceil * k);
  }, [field, m, width, height, tMax]); // eslint-disable-line react-hooks/exhaustive-deps

  // траєкторії частинок, що пливуть полем швидкості
  useEffect(() => {
    const cv = parts.current;
    if (!cv || !field) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(width * dpr);
    cv.height = Math.round(height * dpr);
    const ctx = cv.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const N = width < 500 ? 140 : 260;
    const starts = geo.axes.map((a) => a[0]);
    const spawn = () => {
      if (Math.random() < 0.55) {
        const s = starts[Math.floor(Math.random() * starts.length)];
        return { x: s.x + (Math.random() - 0.5) * 0.15, y: s.y - Math.random() * 0.08, age: 0, life: 4 + Math.random() * 6 };
      }
      return { x: Math.random() * geo.roomW, y: Math.random() * geo.ceil, age: 0, life: 2 + Math.random() * 5 };
    };
    const ps = Array.from({ length: N }, () => ({ ...spawn(), age: Math.random() * 3 }));
    const step = (q: { x: number; y: number }, dt: number) => {
      const vx = sample(field, field.vx, q.x, q.y);
      const vy = sample(field, field.vy, q.x, q.y);
      return { x: q.x + vx * dt, y: q.y + vy * dt, v: Math.hypot(vx, vy) };
    };
    const inside = (q: { x: number; y: number }) => q.x > 0.02 && q.x < geo.roomW - 0.02 && q.y > 0.02 && q.y < geo.ceil - 0.01;

    if (reduce) {
      // без анімації — статичні лінії течії
      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 70; i++) {
        let q = spawn();
        ctx.beginPath();
        ctx.moveTo(X(q.x), Y(q.y));
        for (let s = 0; s < 260 && inside(q); s++) {
          const n = step(q, 0.03);
          q = { ...q, x: n.x, y: n.y };
          ctx.lineTo(X(q.x), Y(q.y));
        }
        ctx.stroke();
      }
      return;
    }

    let raf = 0;
    let last = performance.now();
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(cv);
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!visible) return;
      // шлейф: попередні кадри поступово згасають
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,0.09)";
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = "source-over";
      ctx.lineCap = "round";
      for (const q of ps) {
        const n = step(q, dt * 1.6);
        q.age += dt;
        if (!inside(n) || q.age > q.life) {
          Object.assign(q, spawn());
          continue;
        }
        ctx.strokeStyle = `rgba(255,255,255,${Math.min(0.9, 0.35 + n.v * 1.2)})`;
        ctx.lineWidth = n.v > 0.5 ? 1.6 : 1.1;
        ctx.beginPath();
        ctx.moveTo(X(q.x), Y(q.y));
        ctx.lineTo(X(n.x), Y(n.y));
        ctx.stroke();
        q.x = n.x;
        q.y = n.y;
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [field, width, height]); // eslint-disable-line react-hooks/exhaustive-deps

  const isos = useMemo(() => {
    if (!field) return [];
    return m === "speed"
      ? [
          { level: 0.5, segs: isoline(field, field.speed, 0.5), main: false },
          { level: 0.25, segs: isoline(field, field.speed, 0.25), main: true },
        ]
      : [{ level: -2, segs: isoline(field, field.dT, -2), main: true }];
  }, [field, m]);

  if (!j || !field) return null;
  const vZone = j.at(distance);
  const dZone = deltaT > 0 ? j.dTat(distance, deltaT) : 0;
  const e = geo.entry;
  const personX = kind === "ceiling" ? e.x - 0.6 : e.x;
  const labelW = 156;
  const labelX = Math.min(Math.max(X(e.x) - labelW / 2, X(0) + 6), X(geo.roomW) - labelW - 6);
  const labelY = kind === "wall" ? Y(e.y) + 12 : Y(e.y) - 38;
  const ticks = m === "speed" ? [0, 0.25, 0.5, 0.75, 1] : [0, tMax / 4, tMax / 2, (3 * tMax) / 4, tMax];
  // підписи на полі читаються на будь-якому тлі
  const halo = { stroke: "rgba(12,12,12,0.55)", strokeWidth: 3, paintOrder: "stroke" as const, strokeLinejoin: "round" as const };
  const gradient = Array.from({ length: 11 }, (_, i) => {
    const c = m === "speed" ? turbo(i / 10) : cool(i / 10);
    return `rgb(${c.join(",")}) ${i * 10}%`;
  }).join(",");

  return (
    <figure className="mb-4 overflow-hidden rounded-xl border border-line bg-ink">
      <div className="flex flex-wrap items-center gap-2 px-3 pb-2 pt-3 text-white">
        <span className="text-sm font-bold">{t("cfdTitle")}</span>
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/70">{t("cfdBadge")}</span>
        {tempOn && (
          <span className="ml-auto flex rounded-lg bg-white/10 p-0.5 text-xs font-semibold">
            {(["speed", "temp"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={m === v}
                onClick={() => setMode(v)}
                className={`rounded-md px-2.5 py-1 transition ${m === v ? "bg-white text-ink" : "text-white/75 hover:text-white"}`}
              >
                {t(v === "speed" ? "cfdSpeed" : "cfdTemp")}
              </button>
            ))}
          </span>
        )}
      </div>

      <div ref={wrap} className="relative w-full" style={{ height }}>
        <canvas ref={heat} className="absolute inset-0 h-full w-full" />
        <canvas ref={parts} className="absolute inset-0 h-full w-full" />
        <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${t("cfdTitle")}: ${num(vZone, 2)} ${t("units.velocity")}`}>
          {/* ізолінії */}
          {isos.map(({ level: lv, segs, main }) => (
            <path
              key={lv}
              d={segs.map((s) => `M${X(s[0]).toFixed(1)},${Y(s[1]).toFixed(1)}L${X(s[2]).toFixed(1)},${Y(s[3]).toFixed(1)}`).join("")}
              stroke="white"
              strokeOpacity={main ? 0.95 : 0.5}
              strokeWidth={main ? 1.6 : 1}
              strokeDasharray={main ? "6 4" : "2 4"}
              fill="none"
            />
          ))}
          {/* робоча зона */}
          <line x1={X(0)} x2={X(geo.roomW)} y1={Y(ZONE)} y2={Y(ZONE)} stroke="white" strokeOpacity={0.55} strokeDasharray="3 5" />
          <text x={X(0) + 8} y={Y(ZONE) + 15} fontSize={11.5} fontWeight={600} fill="white" {...halo}>
            {t("vizZone")} · {num(ZONE, 1)} {t("vizM")}
          </text>
          {/* стіни, стеля, підлога */}
          <rect x={X(0)} y={Y(geo.ceil)} width={geo.roomW * k} height={geo.ceil * k} fill="none" stroke="#0c0c0c" strokeWidth={4} />
          {/* виріб */}
          {kind === "ceiling" ? (
            <rect x={X(geo.roomW / 2) - 0.32 * k} y={Y(geo.ceil) - 1} width={0.64 * k} height={5} rx={1.5} fill="var(--color-brand)" />
          ) : (
            <rect x={X(0) - 1} y={Y(geo.axes[0][0].y) - 0.13 * k} width={5} height={0.26 * k} rx={1.5} fill="var(--color-brand)" />
          )}
          {/* людина */}
          <g transform={`translate(${X(personX)},${Y(0)})`} fill="#0c0c0c" fillOpacity={0.55} stroke="white" strokeOpacity={0.5} strokeWidth={0.8}>
            <circle cx={0} cy={-1.62 * k} r={0.12 * k} />
            <rect x={-0.17 * k} y={-1.47 * k} width={0.34 * k} height={0.72 * k} rx={0.12 * k} />
            <rect x={-0.15 * k} y={-0.8 * k} width={0.12 * k} height={0.8 * k} rx={0.05 * k} />
            <rect x={0.03 * k} y={-0.8 * k} width={0.12 * k} height={0.8 * k} rx={0.05 * k} />
          </g>
          {/* показник біля людей */}
          <circle cx={X(e.x)} cy={Y(e.y)} r={6} fill={LEVEL_COLOR[level]} stroke="white" strokeWidth={2} />
          <g transform={`translate(${labelX},${labelY})`}>
            <rect width={labelW} height={26} rx={7} fill="white" fillOpacity={0.96} />
            <text x={labelW / 2} y={17} textAnchor="middle" fontSize={12} fontWeight={700} fill={LEVEL_COLOR[level]}>
              {m === "speed" ? t("vizAtZone", { v: `${num(vZone, 2)} ${t("units.velocity")}` }) : t("cfdAtZoneT", { v: num(dZone, 1) })}
            </text>
          </g>
          <text x={X(geo.roomW) - 8} y={Y(geo.ceil) + 16} textAnchor="end" fontSize={11.5} fill="white" {...halo}>
            {kind === "ceiling" ? t("vizCeiling", { h: num(geo.ceil, 1) }) : t("vizDistance", { d: num(distance, 1) })}
          </text>
        </svg>
      </div>

      {/* шкала */}
      <figcaption className="space-y-2 bg-white px-3 py-2.5 text-xs text-muted">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="font-semibold text-ink-2">{m === "speed" ? t("cfdScaleV") : t("cfdScaleT")}</span>
          <span className="min-w-48 flex-1">
            <span className="block h-2.5 rounded-full" style={{ background: `linear-gradient(90deg, ${gradient})` }} />
            <span className="mt-0.5 flex justify-between tabular-nums">
              {ticks.map((v, i) => (
                <span key={i}>
                  {m === "speed" ? num(v, 2) : num(-v, 1)}
                  {i === ticks.length - 1 ? (m === "speed" ? "+" : "−") : ""}
                </span>
              ))}
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="22" height="6" aria-hidden>
              <line x1="0" x2="22" y1="3" y2="3" stroke="var(--color-ink-2)" strokeWidth="1.6" strokeDasharray="6 4" />
            </svg>
            {m === "speed" ? t("cfdIsoV", { v: num(0.25, 2) }) : t("cfdIsoT", { v: num(2, 0) })}
          </span>
        </div>
        <p className="leading-relaxed">{t("cfdNote")}</p>
      </figcaption>
    </figure>
  );
}
