/**
 * Параметрична геометрія виробів (three.js). Одиниці — метри.
 *
 * Система координат: площина стелі / стіни — z = 0, приміщення — z > 0 (фасад дивиться в +Z),
 * повітровід і гільза — z < 0. Рамки й конуси будуються протягуванням поперечного перерізу
 * (з радіусами й бортами) по прямокутнику з кутовим з'єднанням «на вус» або обертанням профілю.
 *
 * Габарит — з обраного розміру; дрібні пропорції (ширина рамки, крок ламелей, профіль конусів) — типові для серії.
 * Коли будуть креслення / CAD виробника, уточнюються константи в цьому файлі.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { ModelSpec } from "./spec";

export type Finish = "gloss" | "matt" | "metallic";

export interface Materials {
  paint: THREE.MeshPhysicalMaterial;
  dark: THREE.MeshStandardMaterial;
  inner: THREE.MeshStandardMaterial;
  zinc: THREE.MeshStandardMaterial;
}

/** Порошкова фарба: глянець / мат / металік (RAL 9006, 9007) */
export function applyFinish(m: THREE.MeshPhysicalMaterial, hex: string, finish: Finish) {
  m.color.set(hex);
  m.roughness = finish === "matt" ? 0.66 : finish === "metallic" ? 0.36 : 0.32;
  m.metalness = finish === "metallic" ? 0.75 : 0;
  m.clearcoat = finish === "gloss" ? 0.45 : 0;
  m.clearcoatRoughness = 0.22;
}

export function makeMaterials(hex: string, finish: Finish): Materials {
  const paint = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide });
  applyFinish(paint, hex, finish);
  const dark = new THREE.MeshStandardMaterial({ color: 0x16181b, roughness: 0.5, metalness: 0.1, side: THREE.DoubleSide });
  const inner = new THREE.MeshStandardMaterial({ color: 0x08090a, roughness: 0.95, side: THREE.DoubleSide });
  const zinc = new THREE.MeshStandardMaterial({ color: 0xb9bec4, roughness: 0.4, metalness: 0.85, side: THREE.DoubleSide });
  return { paint, dark, inner, zinc };
}

const mm = (v: number) => v / 1000;
type P = [number, number];

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Дуга профілю: центр (cu, cz), радіус r, кути a0 → a1 (рад), n сегментів (без початкової точки) */
function arc(cu: number, cz: number, r: number, a0: number, a1: number, n = 5): P[] {
  const out: P[] = [];
  for (let i = 1; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([cu + r * Math.cos(a), cz + r * Math.sin(a)]);
  }
  return out;
}

/** Гострий кут профілю: точка дублюється, щоб нормалі не згладжувались через ребро */
const sharp = (p: P): P[] => [p, [p[0], p[1]]];

/**
 * Протягування замкненого профілю [u, z] по прямокутнику з піврозмірами hw × hh.
 * u — відступ від зовнішнього краю всередину, z — висота над площиною монтажу.
 * Кути — «на вус» (як у зібраної алюмінієвої рамки), нормалі згладжені вздовж профілю.
 */
function rectSweep(profile: P[], hw: number, hh: number) {
  const sides: [number, number, number, number][] = [
    [-1, -1, 1, -1],
    [1, -1, 1, 1],
    [1, 1, -1, 1],
    [-1, 1, -1, -1],
  ];
  const parts = sides.map(([sx, sy, ex, ey]) => {
    const pos: number[] = [];
    for (const [u, z] of profile) pos.push(sx * (hw - u), sy * (hh - u), z, ex * (hw - u), ey * (hh - u), z);
    const idx: number[] = [];
    const n = profile.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      idx.push(2 * i, 2 * j, 2 * i + 1, 2 * i + 1, 2 * j, 2 * j + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  });
  return mergeGeometries(parts)!;
}

/** Тіло обертання навколо осі Z з замкненого профілю [r, z] */
function lathe(profile: P[], segments = 112) {
  const g = new THREE.LatheGeometry(
    profile.map(([r, z]) => new THREE.Vector2(Math.max(0, r), z)),
    segments,
  );
  g.rotateX(Math.PI / 2); // вісь обертання Y → Z
  g.computeVertexNormals();
  return g;
}

/** Профіль [y, z], протягнутий уздовж осі X на довжину L (бруски щілинного профілю) */
function barX(profile: P[], L: number) {
  const s = new THREE.Shape(profile.map(([y, z]) => new THREE.Vector2(y, z)));
  const g = new THREE.ExtrudeGeometry(s, { depth: L, bevelEnabled: false, curveSegments: 6 });
  // (shapeX, shapeY, extrude) → (x = extrude, y = shapeX, z = shapeY)
  g.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1));
  g.translate(-L / 2, 0, 0);
  g.computeVertexNormals();
  return g;
}

/** Переріз лицьової рамки: ширина полиці b, висота t, радіус зовнішнього краю r, внутрішній край — завальцований */
function frameProfile(b: number, t: number, r = mm(2.5)): P[] {
  const ri = Math.min(mm(1.6), t / 3);
  return [
    ...sharp([b - ri, 0]),
    ...sharp([0, 0]),
    [0, t - r],
    ...arc(r, t - r, r, Math.PI, Math.PI / 2),
    [b - ri * 2, t],
    ...arc(b - ri * 2, t - ri, ri, Math.PI / 2, 0, 4),
    [b, mm(1)],
  ];
}

/**
 * Переріз конуса «врівень з рамкою» (за кресленням PDK): нижній (зовнішній) край — у лицьовій площині zFace,
 * смуга йде похило всередину й угору до внутрішнього краю на висоті zFace − rise. th — товщина металу.
 */
function flushConeProfile(w: number, zFace: number, rise: number, th = mm(1.2)): P[] {
  return [...sharp([0, zFace]), ...sharp([w, zFace - rise]), ...sharp([w - th * 0.6, zFace - rise - th]), ...sharp([0, zFace - th * 1.6])];
}

/** Профіль ламелі (лінза) з хордою c і товщиною t, екструдований на довжину L уздовж X; хорда — уздовж Z */
function blade(c: number, t: number, L: number) {
  const s = new THREE.Shape();
  s.moveTo(-c / 2, 0);
  s.bezierCurveTo(-c / 4, t * 0.9, c / 4, t * 0.6, c / 2, 0);
  s.bezierCurveTo(c / 4, -t * 0.5, -c / 4, -t * 0.6, -c / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: L, bevelEnabled: true, bevelThickness: mm(0.4), bevelSize: mm(0.3), bevelSegments: 2, curveSegments: 10 });
  g.translate(0, 0, -L / 2);
  g.rotateY(Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

/** Прямокутна гільза (повітровід) W×H глибиною d, від z0 назад */
function sleeve(W: number, H: number, d: number, mat: THREE.Material, z0 = 0, wall = mm(0.8)) {
  const g = new THREE.Group();
  const add = (w: number, h: number, x: number, y: number) => {
    const m = mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z0 - d / 2);
    g.add(m);
  };
  add(W, wall, 0, H / 2);
  add(W, wall, 0, -H / 2);
  add(wall, H, W / 2, 0);
  add(wall, H, -W / 2, 0);
  return g;
}

function backPlate(W: number, H: number, z: number, mats: Materials, round = false) {
  const m = mesh(round ? new THREE.CircleGeometry(W / 2, 64) : new THREE.PlaneGeometry(W, H), mats.inner);
  m.position.z = z;
  return m;
}

export interface Dims {
  /** Габарит лицьової частини, м */
  width: number;
  height: number;
  /** Номінальний (посадковий) розмір, який показують розмірні лінії, м */
  nomW: number;
  nomH: number;
  /** Підписи розмірів (номінал), мм */
  labelW: string;
  labelH?: string;
  round?: boolean;
  /** Отвір у стелі / стіні під виріб, м (круглий — діаметр holeW) */
  holeW: number;
  holeH: number;
  /** Логотип на лицьовій рамці: центр, площина, висота, м */
  logo?: { x: number; y: number; z: number; h: number };
}

export function buildModel(spec: ModelSpec, mats: Materials): { group: THREE.Group; dims: Dims } {
  const g = new THREE.Group();
  switch (spec.kind) {
    case "square-ceiling": {
      // за кресленням PDK-4: лицьова панель L+112, рамка 25 мм (отвір L+62) виступає зі стелі на 6 мм,
      // нижні краї всіх конусів — у площині рамки, конуси йдуть похило вгору до горловини L+5 (25 мм у стелі), висота 48 мм
      const N = mm(spec.size);
      const F = N + mm(112);
      const half = F / 2;
      const t = mm(6);
      const band = mm(25);
      g.add(mesh(rectSweep(frameProfile(band + mm(1), t, mm(2)), half, half), mats.paint));
      const slope = Math.tan((31 * Math.PI) / 180);
      const a0 = half - band;
      const inner = Math.max(mm(10), N * 0.05); // центральна площадка
      const n = spec.cones + 1; // конуси + центральний
      const step = (a0 - inner) / n;
      for (let i = 0; i < n; i++) {
        const a = a0 - i * step;
        // кожен наступний конус починається трохи всередині попереднього: з фасаду щілин не видно, повітря виходить між ними
        const w = i === n - 1 ? step : step + mm(1.5);
        g.add(mesh(rectSweep(flushConeProfile(w, t, w * slope), a, a), mats.paint));
      }
      // центральна площадка — у глибині, як на кресленні
      const plate = mesh(new THREE.BoxGeometry(inner * 2, inner * 2, mm(1.2)), mats.paint);
      plate.position.z = t - step * slope - mm(0.6);
      g.add(plate);
      if (spec.adjustable) {
        // регульований: поворотні пластини в горловині
        const nb = Math.max(4, Math.round((N * 0.8) / mm(32)));
        for (let k = 0; k < nb; k++) {
          const b = mesh(blade(mm(28), mm(2.4), N * 0.86), mats.paint);
          b.rotation.z = Math.PI / 2;
          b.rotation.y = 0.35;
          b.position.set(-N * 0.4 + (k * N * 0.8) / (nb - 1), 0, -mm(30));
          g.add(b);
        }
      }
      const neckBottom = t - mm(23);
      g.add(sleeve(N + mm(5), N + mm(5), mm(25), mats.paint, neckBottom));
      g.add(sleeve(N, N, mm(120), mats.zinc, neckBottom - mm(25)));
      g.add(backPlate(N, N, neckBottom - mm(145), mats));
      const lh = mm(9);
      return {
        group: g,
        dims: { width: F, height: F, nomW: N, nomH: N, labelW: `${spec.size}`, labelH: `${spec.size}`, holeW: N + mm(62), holeH: N + mm(62), logo: { x: half - band / 2 - lh * 2.2, y: -half + band / 2, z: t, h: lh } },
      };
    }
    case "round-ceiling": {
      // як PDK: рамка-фланець виступає на 6 мм, конуси врівень з нею й ідуть угору до горловини
      const R = mm(spec.d) / 2;
      const Rf = R + mm(56);
      const t = mm(6);
      const band = mm(25);
      g.add(mesh(lathe(frameProfile(band + mm(1), t, mm(2)).map(([u, z]) => [Rf - u, z] as P)), mats.paint));
      const slope = Math.tan((31 * Math.PI) / 180);
      const r0 = Rf - band;
      const inner = Math.max(mm(10), R * 0.1);
      const n = 5;
      const step = (r0 - inner) / n;
      for (let i = 0; i < n; i++) {
        const ro = r0 - i * step;
        const w = i === n - 1 ? step : step + mm(1.5);
        g.add(mesh(lathe(flushConeProfile(w, t, w * slope).map(([u, z]) => [ro - u, z] as P)), mats.paint));
      }
      const zc = t - step * slope;
      g.add(mesh(lathe([[inner, zc], [0, zc], [0, zc - mm(1.2)], [inner, zc - mm(1.2)]]), mats.paint));
      g.add(mesh(lathe([[R, t - mm(23)], [R, -mm(130)], [R - mm(0.8), -mm(130)], [R - mm(0.8), t - mm(23)]]), mats.zinc));
      g.add(backPlate(2 * R, 2 * R, -mm(130), mats, true));
      return { group: g, dims: { width: 2 * Rf, height: 2 * Rf, nomW: 2 * R, nomH: 2 * R, labelW: `Ø${spec.d}`, round: true, holeW: 2 * (Rf - band), holeH: 0 } };
    }
    case "disc": {
      const R = mm(spec.d) / 2;
      const Rf = R + mm(spec.d > 150 ? 30 : 22);
      // фланець з плавним переходом у горловину (верх) і товщиною металу (низ)
      const top: P[] = [];
      for (let i = 0; i <= 14; i++) {
        const a = (i / 14) * (Math.PI / 2);
        top.push([R + (Rf - R) * Math.sin(a), mm(2) + mm(5) * Math.cos(a)]);
      }
      const prof: P[] = [[R - mm(1), -mm(55)], ...sharp([R, -mm(55)]), [R, mm(2)], ...top.slice(1), ...arc(Rf - mm(1.2), mm(2), mm(1.2), 0, -Math.PI / 2, 4), [Rf - mm(3), mm(0.8)], [R + mm(2), mm(1)], [R - mm(1), mm(0.5)]];
      g.add(mesh(lathe(prof), mats.paint));
      // центральна тарілка на штоку, винесена в приміщення
      const Rd = R * (spec.exhaust ? 0.8 : 0.88);
      const z0 = mm(spec.exhaust ? 10 : 15);
      const bulge = mm(spec.exhaust ? 3 : 7);
      const disc: P[] = [[0, z0 + bulge]];
      for (let i = 1; i <= 18; i++) {
        const r = (Rd * i) / 18;
        disc.push([r, z0 + bulge * (1 - (r / Rd) ** 2)]);
      }
      disc.push(...arc(Rd - mm(1.5), z0 - mm(0.2), mm(1.5), 0, -Math.PI / 2, 4), [Rd * 0.3, z0 - mm(4)], [0, z0 - mm(4)]);
      g.add(mesh(lathe(disc), mats.paint));
      const stem = mesh(new THREE.CylinderGeometry(mm(3), mm(3), mm(60), 20), mats.zinc);
      stem.rotation.x = Math.PI / 2;
      stem.position.z = -mm(18);
      g.add(stem);
      g.add(backPlate(2 * R, 2 * R, -mm(55), mats, true));
      return { group: g, dims: { width: 2 * Rf, height: 2 * Rf, nomW: 2 * R, nomH: 2 * R, labelW: `Ø${spec.d}`, round: true, holeW: 2 * R + mm(4), holeH: 0 } };
    }
    case "grille": {
      const W = mm(spec.w);
      const H = mm(spec.h);
      const f = mm(spec.w > 600 || spec.h > 600 ? 30 : 24);
      const t = mm(9);
      g.add(mesh(rectSweep(frameProfile(f + mm(2), t, mm(3)), W / 2 + f, H / 2 + f), mats.paint));
      g.add(sleeve(W, H, mm(70), mats.paint, t - mm(1), mm(1)));
      // ламелі врівень з лицьовою рамкою
      const chord = mm(18);
      const p = mm(spec.pitch);
      const n = Math.max(2, Math.floor((H - mm(6)) / p));
      const y0 = -((n - 1) * p) / 2;
      for (let i = 0; i < n; i++) {
        const b = mesh(blade(chord, mm(2.6), W - mm(2)), mats.paint);
        b.rotation.x = -(spec.angle * Math.PI) / 180;
        b.position.set(0, y0 + i * p, t - chord / 2 - mm(0.5));
        g.add(b);
      }
      if (spec.double) {
        const pv = mm(22);
        const m = Math.max(2, Math.floor((W - mm(6)) / pv));
        const x0 = -((m - 1) * pv) / 2;
        for (let i = 0; i < m; i++) {
          const b = mesh(blade(mm(16), mm(2.4), H - mm(2)), mats.paint);
          b.rotation.z = Math.PI / 2;
          b.position.set(x0 + i * pv, 0, t - chord - mm(12));
          g.add(b);
        }
      }
      g.add(backPlate(W, H, t - mm(71), mats));
      const lh = Math.min(mm(11), f * 0.42);
      return {
        group: g,
        dims: { width: W + 2 * f, height: H + 2 * f, nomW: W, nomH: H, labelW: `${spec.w}`, labelH: `${spec.h}`, holeW: W + mm(6), holeH: H + mm(6), logo: { x: W / 2 + f / 2 - lh * 1.9, y: -H / 2 - f / 2, z: t, h: lh } },
      };
    }
    case "slot": {
      const L = mm(spec.length);
      const sw = mm(spec.slotW);
      const div = mm(5);
      const rail = mm(spec.hidden ? 40 : 13);
      const Hs = spec.slots * sw + (spec.slots - 1) * div;
      const Ht = Hs + 2 * rail;
      const t = mm(spec.hidden ? 1.5 : 4);
      // профіль полиці: лицьова поверхня із заокругленими кромками + стінка назад у повітровід
      const railProfile = (y0: number, y1: number, back: number, wallAtY1: boolean): P[] => {
        const r = Math.min(mm(1.5), t * 0.45);
        const face: P[] = [[y0, t - r], [y0 + r, t], [y1 - r, t], [y1, t - r]];
        const wt = mm(1.2);
        return wallAtY1
          ? [[y0, 0], ...face, [y1, -back], [y1 - wt, -back], [y1 - wt, 0]]
          : [[y0, -back], ...face, [y1, 0], [y0 + wt, 0], [y0 + wt, -back]];
      };
      g.add(mesh(barX(railProfile(Hs / 2, Hs / 2 + rail, mm(40), false), L), mats.paint));
      g.add(mesh(barX(railProfile(-Hs / 2 - rail, -Hs / 2, mm(40), true), L), mats.paint));
      for (let i = 1; i < spec.slots; i++) {
        const y1 = Hs / 2 - i * (sw + div) + div;
        g.add(mesh(barX(railProfile(y1 - div, y1, mm(35), true), L), mats.paint));
      }
      // дефлектори в кожній щілині (чорні, як у серійних SD) — одразу за лицьовою площиною
      for (let i = 0; i < spec.slots; i++) {
        const yc = Hs / 2 - sw / 2 - i * (sw + div);
        const c = mesh(new THREE.CylinderGeometry(sw * 0.34, sw * 0.34, L - mm(4), 28, 1, false, Math.PI * 0.15, Math.PI * 1.1), mats.dark);
        c.rotation.z = Math.PI / 2;
        c.position.set(0, yc, -sw * 0.34 - mm(1));
        g.add(c);
      }
      // торцеві заглушки
      for (const x of [-L / 2, L / 2]) {
        const e = mesh(new THREE.BoxGeometry(mm(3), Ht, t + mm(40)), mats.paint);
        e.position.set(x, 0, t - (t + mm(40)) / 2);
        g.add(e);
      }
      g.add(sleeve(L, Hs, mm(80), mats.zinc, -mm(40)));
      g.add(backPlate(L, Hs, -mm(120), mats));
      return { group: g, dims: { width: L, height: Ht, nomW: L, nomH: Ht, labelW: `L ${spec.length}`, holeW: L - mm(2), holeH: Hs + mm(6) } };
    }
  }
}
