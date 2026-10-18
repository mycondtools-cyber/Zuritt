"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { jet, LIMITS, type Level } from "@/lib/calc";
import type { VizKind } from "@/lib/products";
import type { ProductData, Selection } from "@/lib/types";
import { useFormat } from "./use-format";

/** Висота робочої зони, м */
const ZONE = 1.8;
/** Ширина полотна за замовчуванням; на вузьких екранах — ширина контейнера, щоб написи лишались читабельними */
const VB_MAX = 640;
const PAD = 22;

/** Колір швидкості: від темно-синього (швидко) до світлого (майже штиль) */
const STOPS: [number, [number, number, number]][] = [
  [0.1, [219, 234, 254]],
  [0.25, [147, 197, 253]],
  [0.5, [96, 165, 250]],
  [1, [59, 130, 246]],
  [3, [29, 78, 216]],
];
function vColor(v: number) {
  const lv = Math.log(Math.max(v, 0.1));
  for (let i = 1; i < STOPS.length; i++) {
    const [v1, c1] = STOPS[i - 1];
    const [v2, c2] = STOPS[i];
    if (v <= v2) {
      const t = Math.min(
        1,
        Math.max(0, (lv - Math.log(v1)) / (Math.log(v2) - Math.log(v1))),
      );
      return `rgb(${c1.map((c, k) => Math.round(c + (c2[k] - c) * t)).join(",")})`;
    }
  }
  return `rgb(${STOPS[STOPS.length - 1][1].join(",")})`;
}

const ZONE_FILL: Record<Level, string> = {
  good: "var(--color-good-soft)",
  ok: "var(--color-ok-soft)",
  bad: "var(--color-bad-soft)",
};
const ZONE_TEXT: Record<Level, string> = {
  good: "var(--color-good)",
  ok: "var(--color-ok)",
  bad: "var(--color-bad)",
};

type Pt = { x: number; y: number; s: number };

/** Точки осі струменя (м): x — від лівої стіни, y — від підлоги, s — довжина вздовж струменя */
function sample(
  seg: (t: number) => { x: number; y: number },
  from: number,
  n: number,
  out: Pt[],
) {
  let prev = seg(0);
  let s = from;
  for (let i = 1; i <= n; i++) {
    const p = seg(i / n);
    s += Math.hypot(p.x - prev.x, p.y - prev.y);
    out.push({ ...p, s });
    prev = p;
  }
  return s;
}

/**
 * Схематичний розріз приміщення з потоком повітря. Швидкість уздовж струменя — та сама модель, що й «У робочій зоні»;
 * геометрія потоку умовна (стельові — вздовж стелі й униз, решітки — горизонтально від стіни).
 */
export function AirflowViz({
  p,
  sel,
  airflow,
  distance,
  kind,
  level,
}: {
  p: ProductData;
  sel: Selection;
  airflow: number;
  distance: number;
  kind: Exclude<VizKind, null>;
  level: Level;
}) {
  const t = useTranslations("configurator");
  const { num } = useFormat();
  const clipId = useId();
  const box = useRef<HTMLElement>(null);
  const [VB_W, setVbW] = useState(VB_MAX);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setVbW(Math.round(Math.min(VB_MAX, Math.max(340, e.contentRect.width)))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const VB_H = VB_W < 520 ? 280 : 300;
  const j = jet(p, sel, airflow);
  if (!j || !(distance > 0)) return null;

  const vZone = j.at(distance);
  const throw25 = j.throwTo(LIMITS.velocityAtZone.good);

  // геометрія приміщення, м
  const ceil =
    kind === "ceiling" ? Math.min(12, Math.max(2.5, distance + ZONE)) : 2.9;
  const roomW =
    kind === "ceiling"
      ? Math.max(6, ceil * 1.9)
      : Math.min(10, Math.max(6, distance + 2));
  const sc = Math.min((VB_W - 2 * PAD) / roomW, (VB_H - 2 * PAD) / ceil);
  const ox = (VB_W - roomW * sc) / 2;
  const X = (x: number) => ox + x * sc;
  const Y = (y: number) => VB_H - PAD - y * sc;

  // осі струменів і точка входу в робочу зону
  const axes: Pt[][] = [];
  let entry: { x: number; y: number };
  let pathToZone: number;
  if (kind === "ceiling") {
    const cx = roomW / 2;
    const r = Math.min(0.45, (ceil - ZONE) * 0.4);
    const run = roomW / 2 - 0.75 - r;
    for (const dir of [-1, 1]) {
      const pts: Pt[] = [{ x: cx, y: ceil, s: 0 }];
      let s = sample(
        (u) => ({ x: cx + dir * run * u, y: ceil - 0.02 }),
        0,
        14,
        pts,
      );
      s = sample(
        (u) => ({
          x: cx + dir * (run + r * Math.sin((u * Math.PI) / 2)),
          y: ceil - r * (1 - Math.cos((u * Math.PI) / 2)),
        }),
        s,
        10,
        pts,
      );
      sample(
        (u) => ({
          x: cx + dir * (run + r),
          y: ceil - r - u * (ceil - r - ZONE + 0.9),
        }),
        s,
        18,
        pts,
      );
      axes.push(pts);
    }
    entry = { x: cx + run + r, y: ZONE };
    pathToZone = run + (Math.PI * r) / 2 + (ceil - r - ZONE);
  } else {
    const h = ceil - 0.35;
    const len = roomW - 0.3;
    // холодний струмінь трохи провисає — суто для наочності
    const pts: Pt[] = [{ x: 0, y: h, s: 0 }];
    sample(
      (u) => ({ x: u * len, y: h - 0.025 * (u * len) ** 1.4 }),
      0,
      36,
      pts,
    );
    axes.push(pts);
    const ex = Math.min(distance, len);
    // для решіток швидкість рахується на осі струменя на відстані «до людей»
    entry = { x: ex, y: h - 0.025 * ex ** 1.4 };
    pathToZone = distance;
  }
  // довжина вздовж намальованої осі → відстань у моделі (у точці входу в зону — рівно «До робочої зони»)
  const toModel = (s: number) => (s * distance) / pathToZone;

  // струмінь — суцільна стрічка, що розширюється; кожен відрізок має колір швидкості в цій точці
  const segs = axes.flatMap((pts, k) => {
    const half = (q: Pt) => ((0.06 + (kind === "ceiling" ? 0.2 : 0.11) * toModel(q.s)) * sc) / 2;
    const norm = (i: number) => {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(pts.length - 1, i + 1)];
      const dx = X(b.x) - X(a.x);
      const dy = Y(b.y) - Y(a.y);
      const l = Math.hypot(dx, dy) || 1;
      return [-dy / l, dx / l];
    };
    const edge = pts.map((q, i) => {
      const [nx, ny] = norm(i);
      const h = half(q);
      return {
        l: [X(q.x) + nx * h, Y(q.y) + ny * h],
        r: [X(q.x) - nx * h, Y(q.y) - ny * h],
      };
    });
    const total = pts[pts.length - 1].s;
    return pts.slice(1).map((q, i) => {
      const a = edge[i];
      const b = edge[i + 1];
      const fade = Math.max(0.2, 1 - q.s / (total * 1.1));
      return (
        <polygon
          key={`${k}-${i}`}
          points={[a.l, b.l, b.r, a.r].map((c) => c.join(",")).join(" ")}
          fill={vColor(j.at(toModel(q.s)))}
          stroke={vColor(j.at(toModel(q.s)))}
          strokeWidth={0.6}
          opacity={0.8 * fade}
        />
      );
    });
  });
  const flowDur = Math.min(6, Math.max(0.8, 3 / Math.sqrt(j.v0)));
  const personX = kind === "ceiling" ? entry.x - 0.55 : entry.x;
  const vLabel = `${num(vZone, 2)} ${t("units.velocity")}`;

  return (
    <figure ref={box} className="mb-4 overflow-hidden rounded-xl border border-line bg-white">
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="block h-auto w-full"
        role="img"
        aria-label={`${t("vizTitle")}: ${vLabel}`}
      >
        {/* приміщення */}
        <rect
          x={X(0)}
          y={Y(ceil)}
          width={roomW * sc}
          height={ceil * sc}
          fill="var(--color-paper)"
        />
        <rect
          x={X(0)}
          y={Y(ZONE)}
          width={roomW * sc}
          height={ZONE * sc}
          fill={ZONE_FILL[level]}
          opacity={0.75}
        />
        <line
          x1={X(0)}
          x2={X(roomW)}
          y1={Y(ZONE)}
          y2={Y(ZONE)}
          stroke={ZONE_TEXT[level]}
          strokeDasharray="5 5"
          strokeWidth={1}
          opacity={0.6}
        />
        <text
          x={X(0) + 8}
          y={Y(ZONE) + 16}
          fontSize={12}
          fill={ZONE_TEXT[level]}
          fontWeight={600}
        >
          {t("vizZone")} · {num(ZONE, 1)} {t("vizM")}
        </text>
        <line
          x1={X(0)}
          x2={X(roomW)}
          y1={Y(ceil)}
          y2={Y(ceil)}
          stroke="var(--color-ink)"
          strokeWidth={3}
        />
        <line
          x1={X(0)}
          x2={X(roomW)}
          y1={Y(0)}
          y2={Y(0)}
          stroke="var(--color-ink)"
          strokeWidth={3}
        />
        <line
          x1={X(0)}
          x2={X(0)}
          y1={Y(0)}
          y2={Y(ceil)}
          stroke="var(--color-ink)"
          strokeWidth={3}
        />
        <line
          x1={X(roomW)}
          x2={X(roomW)}
          y1={Y(0)}
          y2={Y(ceil)}
          stroke="var(--color-ink-2)"
          strokeWidth={1}
          opacity={0.4}
        />

        {/* струмінь: колір — швидкість у цій точці */}
        <clipPath id={clipId}>
          <rect x={X(0)} y={Y(ceil)} width={roomW * sc} height={ceil * sc} />
        </clipPath>
        <g clipPath={`url(#${clipId})`}>
          {segs}
          {axes.map((pts, k) => (
            <polyline
              key={k}
              points={pts.map((q) => `${X(q.x)},${Y(q.y)}`).join(" ")}
              fill="none"
              stroke="white"
              strokeWidth={2}
              strokeLinecap="round"
              strokeDasharray="3 16"
              opacity={0.85}
              style={{ animation: `jetflow ${flowDur}s linear infinite` }}
            />
          ))}
        </g>

        {/* виріб */}
        {kind === "ceiling" ? (
          <rect
            x={X(roomW / 2) - 0.3 * sc}
            y={Y(ceil) - 2}
            width={0.6 * sc}
            height={6}
            rx={1.5}
            fill="var(--color-brand)"
          />
        ) : (
          <rect
            x={X(0) - 2}
            y={Y(ceil - 0.35) - 0.12 * sc}
            width={6}
            height={0.24 * sc}
            rx={1.5}
            fill="var(--color-brand)"
          />
        )}

        {/* людина */}
        <g
          transform={`translate(${X(personX)},${Y(0)})`}
          fill="var(--color-ink-2)"
          opacity={0.55}
        >
          <circle cx={0} cy={-1.62 * sc} r={0.12 * sc} />
          <rect
            x={-0.17 * sc}
            y={-1.47 * sc}
            width={0.34 * sc}
            height={0.72 * sc}
            rx={0.12 * sc}
          />
          <rect
            x={-0.15 * sc}
            y={-0.8 * sc}
            width={0.12 * sc}
            height={0.8 * sc}
            rx={0.05 * sc}
          />
          <rect
            x={0.03 * sc}
            y={-0.8 * sc}
            width={0.12 * sc}
            height={0.8 * sc}
            rx={0.05 * sc}
          />
        </g>

        {/* швидкість біля людей */}
        <circle
          cx={X(entry.x)}
          cy={Y(entry.y)}
          r={6}
          fill={ZONE_TEXT[level]}
          stroke="white"
          strokeWidth={2}
        />
        <g
          transform={`translate(${Math.min(Math.max(X(entry.x) - 70, X(0) + 4), VB_W - PAD - 144)},${kind === "wall" ? Y(entry.y) + 14 : Y(entry.y) - 34})`}
        >
          <rect
            width={140}
            height={24}
            rx={6}
            fill="white"
            stroke={ZONE_TEXT[level]}
          />
          <text
            x={70}
            y={16}
            textAnchor="middle"
            fontSize={12}
            fontWeight={700}
            fill={ZONE_TEXT[level]}
          >
            {t("vizAtZone", { v: vLabel })}
          </text>
        </g>

        {/* розміри */}
        {kind === "ceiling" ? (
          <text
            x={X(roomW) - 6}
            y={Y(ceil) + 16}
            textAnchor="end"
            fontSize={12}
            fill="var(--color-ink-2)"
          >
            {t("vizCeiling", { h: num(ceil, 1) })}
          </text>
        ) : (
          <g>
            <line
              x1={X(0)}
              x2={X(entry.x)}
              y1={Y(0) - 10}
              y2={Y(0) - 10}
              stroke="var(--color-ink-2)"
              strokeWidth={1}
              markerEnd="url(#arr)"
              markerStart="url(#arr)"
            />
            <text
              x={(X(0) + X(entry.x)) / 2}
              y={Y(0) - 15}
              textAnchor="middle"
              fontSize={12}
              fill="var(--color-ink-2)"
            >
              {t("vizDistance", { d: num(distance, 1) })}
            </text>
          </g>
        )}
        <defs>
          <marker
            id="arr"
            viewBox="0 0 10 10"
            refX="5"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" fill="var(--color-ink-2)" />
          </marker>
        </defs>
      </svg>
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-3 py-2 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          {t("vizLegend")}
          {[2, 1, 0.5, 0.25, 0.1].map((v) => (
            <span key={v} className="flex items-center gap-0.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ background: vColor(v) }}
              />
              {num(v, v < 1 ? (v === 0.25 ? 2 : 1) : 0)}
            </span>
          ))}
        </span>
        {throw25 > 0 && (
          <span>
            {t("vizThrow", {
              l: num(Math.min(throw25, 99), 1),
              v: num(LIMITS.velocityAtZone.good, 2),
            })}
          </span>
        )}
        <span className="ml-auto">{t("vizNote")}</span>
      </figcaption>
    </figure>
  );
}
