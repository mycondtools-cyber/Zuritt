/**
 * Поле швидкості й температури в перерізі приміщення для візуалізації в стилі CFD.
 *
 * Це не чисельний розв'язок рівнянь Нав'є — Стокса, а інженерна модель струменя:
 *  — швидкість і ΔT на осі струменя — з jet() (та сама модель, що й розрахунок, звірена з програмою виробника);
 *  — поперек осі — гаусів профіль, ширина якого росте з відстанню (кут розкриття струменя ~ 12°);
 *  — зворотний потік у приміщенні — циркуляційні вихори, що замикають струмінь.
 * Тому значення в робочій зоні збігаються з цифрами розрахунку, а картинка показує, куди і як рухається повітря.
 */
import type { jet as jetFn } from "./calc";

export type Jet = NonNullable<ReturnType<typeof jetFn>>;
export type FlowKind = "ceiling" | "wall";

/** Висота робочої зони, м */
export const ZONE = 1.8;

export interface Pt {
  x: number;
  y: number;
  s: number;
}

export interface Geometry {
  kind: FlowKind;
  /** Висота й ширина приміщення, м */
  ceil: number;
  roomW: number;
  /** Осі струменів (м від лівої стіни й від підлоги; s — довжина вздовж осі) */
  axes: Pt[][];
  /** Точка, де рахується «швидкість біля людей» */
  entry: { x: number; y: number };
  /** Довжина вздовж намальованої осі → відстань у моделі (у точці entry — рівно distance) */
  toModel: (s: number) => number;
}

function polyline(pts: { x: number; y: number }[]): Pt[] {
  let s = 0;
  return pts.map((p, i) => {
    if (i) s += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y);
    return { ...p, s };
  });
}

/** Довжина вздовж осі, на якій вона перетинає рівень y (перший перетин) */
function sAtY(pts: Pt[], y: number) {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if ((a.y - y) * (b.y - y) <= 0 && a.y !== b.y) return a.s + ((b.s - a.s) * (a.y - y)) / (a.y - b.y);
  }
  return pts[pts.length - 1].s;
}

function sAtX(pts: Pt[], x: number) {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if ((a.x - x) * (b.x - x) <= 0 && a.x !== b.x) return a.s + ((b.s - a.s) * (x - a.x)) / (b.x - a.x);
  }
  return pts[pts.length - 1].s;
}

export function geometry(kind: FlowKind, distance: number): Geometry {
  const d = Math.max(distance, 0.3);
  if (kind === "ceiling") {
    // стельовий: настильний струмінь уздовж стелі, біля стіни опускається в робочу зону
    const ceil = Math.min(12, Math.max(2.5, d + ZONE));
    const roomW = Math.max(6, ceil * 1.9);
    const cx = roomW / 2;
    const yc = ceil - 0.06;
    const r = Math.min(0.5, (ceil - ZONE) * 0.4);
    const xd = roomW / 2 - 0.7; // відстань від центру до лінії опускання
    const run = xd - r;
    const axes = [-1, 1].map((dir) => {
      const raw: { x: number; y: number }[] = [];
      for (let i = 0; i <= 16; i++) raw.push({ x: cx + dir * (run * i) / 16, y: yc });
      for (let i = 1; i <= 10; i++) {
        const a = (i / 10) * (Math.PI / 2);
        raw.push({ x: cx + dir * (run + r * Math.sin(a)), y: yc - r * (1 - Math.cos(a)) });
      }
      const bottom = 0.35;
      for (let i = 1; i <= 20; i++) raw.push({ x: cx + dir * xd, y: yc - r - ((yc - r - bottom) * i) / 20 });
      return polyline(raw);
    });
    const sZone = sAtY(axes[1], ZONE);
    return { kind, ceil, roomW, axes, entry: { x: cx + xd, y: ZONE }, toModel: (s) => (s * d) / sZone };
  }
  // решітка на стіні: струмінь під стелею через приміщення, біля протилежної стіни опускається
  const ceil = 2.9;
  const roomW = Math.min(10, Math.max(6, d + 2));
  const h = ceil - 0.35;
  const xe = roomW - 0.6;
  const droop = (x: number) => h - 0.02 * x ** 1.4;
  const raw: { x: number; y: number }[] = [];
  for (let i = 0; i <= 30; i++) raw.push({ x: (xe * i) / 30, y: droop((xe * i) / 30) });
  const yEnd = droop(xe);
  const r = 0.4;
  for (let i = 1; i <= 8; i++) {
    const a = (i / 8) * (Math.PI / 2);
    raw.push({ x: xe + r * Math.sin(a) * 0.5, y: yEnd - r * (1 - Math.cos(a)) });
  }
  for (let i = 1; i <= 12; i++) raw.push({ x: xe + r * 0.5, y: yEnd - r - ((yEnd - r - 0.35) * i) / 12 });
  const axis = polyline(raw);
  const ex = Math.min(d, xe);
  const sEntry = sAtX(axis, ex);
  return { kind, ceil, roomW, axes: [axis], entry: { x: ex, y: droop(ex) }, toModel: (s) => (s * d) / sEntry };
}

export interface Field {
  nx: number;
  ny: number;
  /** Розмір комірки, м */
  cell: number;
  /** Модуль швидкості, м/с; компоненти швидкості (y — вгору) */
  speed: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  /** Відхилення температури від приміщення, K (для охолодження — від'ємне) */
  dT: Float32Array;
}

/** Найближча точка на ламаній: довжина вздовж осі, відстань до осі, дотична, чи точка за кінцем осі */
function nearest(pts: Pt[], x: number, y: number) {
  let best = { d2: Infinity, s: 0, tx: 1, ty: 0, past: 0 };
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const l2 = ex * ex + ey * ey || 1e-9;
    let t = ((x - a.x) * ex + (y - a.y) * ey) / l2;
    let past = 0;
    if (t > 1) {
      past = i === pts.length - 1 ? Math.sqrt(l2) * (t - 1) : 0;
      t = 1;
    }
    if (t < 0) t = 0;
    const px = a.x + ex * t;
    const py = a.y + ey * t;
    const d2 = (x - px) ** 2 + (y - py) ** 2;
    if (d2 < best.d2) {
      const l = Math.sqrt(l2);
      best = { d2, s: a.s + (b.s - a.s) * t, tx: ex / l, ty: ey / l, past };
    }
  }
  return best;
}

/**
 * nx — кількість комірок по ширині. dT0 — ΔT припливу (K, додатне — охолодження).
 * vZone — швидкість біля людей (для інтенсивності зворотного потоку).
 */
export function computeField(geo: Geometry, j: Jet, nx: number, dT0: number): Field {
  const cell = geo.roomW / nx;
  const ny = Math.max(8, Math.round(geo.ceil / cell));
  const n = nx * ny;
  const speed = new Float32Array(n);
  const vx = new Float32Array(n);
  const vy = new Float32Array(n);
  const dT = new Float32Array(n);
  const vZone = j.at(geo.toModel(geo.kind === "ceiling" ? nearest(geo.axes[1], geo.entry.x, geo.entry.y).s : nearest(geo.axes[0], geo.entry.x, geo.entry.y).s));
  // зворотний потік: швидкості в робочій зоні поза струменем зазвичай 0,1–0,4 від швидкості струменя біля людей
  const uRec = Math.min(0.2, Math.max(0.03, 0.3 * vZone));
  // напівширина струменя на відстані x (м): початкова + розкриття ~ 0,1·x
  const halfW = (xm: number) => 0.05 + (j.plane ? 0.09 : 0.11) * xm;

  for (let iy = 0; iy < ny; iy++) {
    const y = (ny - 1 - iy + 0.5) * cell; // рядок 0 — під стелею
    for (let ix = 0; ix < nx; ix++) {
      const x = (ix + 0.5) * cell;
      let u = 0;
      let tx = 0;
      let ty = 0;
      let t = 0;
      for (const ax of geo.axes) {
        const q = nearest(ax, x, y);
        const xm = geo.toModel(q.s);
        const b = halfW(xm);
        // за кінцем осі струмінь розсіюється
        const prof = Math.exp(-0.693 * (q.d2 / (b * b))) * Math.exp(-((q.past / 0.6) ** 2));
        const uj = j.at(xm) * prof;
        if (uj > u) {
          u = uj;
          tx = q.tx;
          ty = q.ty;
        }
        t = Math.max(t, dT0 ? j.dTat(xm, dT0) * prof : 0);
      }
      // циркуляційні вихори: ψ = A·sin(πξ)·sin(πη)
      let rx = 0;
      let ry = 0;
      const H = geo.ceil;
      const cellsX = geo.kind === "ceiling" ? [[0, geo.roomW / 2, 1], [geo.roomW / 2, geo.roomW, -1]] : [[0, geo.roomW, -1]];
      for (const [x0, x1, sign] of cellsX) {
        if (x < x0 || x > x1) continue;
        const W = x1 - x0;
        const xi = (x - x0) / W;
        const eta = y / H;
        // нормування: максимум |v| = uRec
        const A = (sign * uRec) / (Math.PI / Math.min(W, H));
        rx = A * Math.sin(Math.PI * xi) * (Math.PI / H) * Math.cos(Math.PI * eta);
        ry = -A * (Math.PI / W) * Math.cos(Math.PI * xi) * Math.sin(Math.PI * eta);
      }
      const k = iy * nx + ix;
      vx[k] = tx * u + rx;
      vy[k] = ty * u + ry;
      speed[k] = Math.hypot(vx[k], vy[k]);
      dT[k] = dT0 > 0 ? -t : t;
    }
  }
  return { nx, ny, cell, speed, vx, vy, dT };
}

/** Значення поля в точці (м), білінійна інтерполяція */
export function sample(f: Field, arr: Float32Array, x: number, y: number) {
  const gx = x / f.cell - 0.5;
  const gy = f.ny - 1 - (y / f.cell - 0.5);
  const x0 = Math.max(0, Math.min(f.nx - 1, Math.floor(gx)));
  const y0 = Math.max(0, Math.min(f.ny - 1, Math.floor(gy)));
  const x1 = Math.min(f.nx - 1, x0 + 1);
  const y1 = Math.min(f.ny - 1, y0 + 1);
  const fx = Math.max(0, Math.min(1, gx - x0));
  const fy = Math.max(0, Math.min(1, gy - y0));
  const a = arr[y0 * f.nx + x0] * (1 - fx) + arr[y0 * f.nx + x1] * fx;
  const b = arr[y1 * f.nx + x0] * (1 - fx) + arr[y1 * f.nx + x1] * fx;
  return a * (1 - fy) + b * fy;
}

/** Ізолінія рівня level (marching squares). Відрізки в метрах: [x1, y1, x2, y2] */
export function isoline(f: Field, arr: Float32Array, level: number): number[][] {
  const out: number[][] = [];
  const P = (ix: number, iy: number) => [(ix + 0.5) * f.cell, (f.ny - 1 - iy + 0.5) * f.cell];
  const lerp = (a: number[], b: number[], va: number, vb: number) => {
    const t = (level - va) / (vb - va || 1e-9);
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  };
  for (let iy = 0; iy < f.ny - 1; iy++) {
    for (let ix = 0; ix < f.nx - 1; ix++) {
      const v = [arr[iy * f.nx + ix], arr[iy * f.nx + ix + 1], arr[(iy + 1) * f.nx + ix + 1], arr[(iy + 1) * f.nx + ix]];
      const p = [P(ix, iy), P(ix + 1, iy), P(ix + 1, iy + 1), P(ix, iy + 1)];
      const pts: number[][] = [];
      for (let e = 0; e < 4; e++) {
        const a = v[e];
        const b = v[(e + 1) % 4];
        if ((a - level) * (b - level) < 0) pts.push(lerp(p[e], p[(e + 1) % 4], a, b));
      }
      if (pts.length === 2) out.push([...pts[0], ...pts[1]]);
      else if (pts.length === 4) out.push([...pts[0], ...pts[1]], [...pts[2], ...pts[3]]);
    }
  }
  return out;
}
