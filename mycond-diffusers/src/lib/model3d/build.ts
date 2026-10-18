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
  /** Копії фарби з картою прозорості (перфорація) — колір і фактура оновлюються разом з paint */
  variants: THREE.MeshPhysicalMaterial[];
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
  return { paint, dark, inner, zinc, variants: [] };
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

/** Овальний отвір (щілина з заокругленими кінцями) довжиною len, шириною w, під кутом ang */
function slotPath(cx: number, cy: number, len: number, w: number, ang: number) {
  const r = w / 2;
  const hl = Math.max(0, len / 2 - r);
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const pts: THREE.Vector2[] = [];
  for (let k = 0; k <= 8; k++) {
    const a = -Math.PI / 2 + (k / 8) * Math.PI;
    pts.push(new THREE.Vector2(hl + r * Math.cos(a), r * Math.sin(a)));
  }
  for (let k = 0; k <= 8; k++) {
    const a = Math.PI / 2 + (k / 8) * Math.PI;
    pts.push(new THREE.Vector2(-hl + r * Math.cos(a), r * Math.sin(a)));
  }
  return new THREE.Path(pts.map((p) => new THREE.Vector2(cx + p.x * c - p.y * s, cy + p.x * s + p.y * c)));
}

function circlePath(cx: number, cy: number, r: number) {
  const p = new THREE.Path();
  p.absarc(cx, cy, r, 0, Math.PI * 2, true);
  return p;
}

/** Плоский лист W×H з отворами, товщиною th; лицьова площина — z */
function holedPlate(W: number, H: number, holes: THREE.Path[], z: number, th = mm(1)) {
  const s = new THREE.Shape();
  s.moveTo(-W / 2, -H / 2);
  s.lineTo(W / 2, -H / 2);
  s.lineTo(W / 2, H / 2);
  s.lineTo(-W / 2, H / 2);
  s.holes.push(...holes);
  const g = new THREE.ExtrudeGeometry(s, { depth: th, bevelEnabled: false, curveSegments: 10 });
  g.translate(0, 0, z - th);
  g.computeVertexNormals();
  return g;
}

/** Плитка карти прозорості: перфорація (шестикутна / квадратна), сітка або суцільно */
function alphaTile(kind: "hex" | "square" | "mesh") {
  const w = 64;
  const h = kind === "hex" ? Math.round(64 * Math.sqrt(3)) : 64;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = kind === "mesh" ? "#000" : "#fff";
  ctx.fillRect(0, 0, w, h);
  if (kind === "mesh") {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, 6);
    ctx.fillRect(0, 0, 6, h);
  } else {
    ctx.fillStyle = "#000";
    if (kind === "square") ctx.fillRect(9, 9, 46, 46);
    else
      for (const [x, y] of [[32, h * 0.25], [0, h * 0.75], [64, h * 0.75]]) {
        ctx.beginPath();
        ctx.arc(x, y, 23, 0, Math.PI * 2);
        ctx.fill();
      }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return { tex: t, aspect: h / w };
}

/** Лист з візерунком отворів через карту прозорості (тисячі отворів без важкої геометрії) */
function patternSheet(W: number, H: number, pitch: number, kind: "hex" | "square" | "mesh", mats: Materials, z: number, zinc = false) {
  const { tex, aspect } = alphaTile(kind);
  tex.repeat.set(W / pitch, H / (pitch * aspect));
  let mat: THREE.Material;
  if (zinc) mat = Object.assign(mats.zinc.clone(), { alphaMap: tex, alphaTest: 0.5 });
  else {
    const m = mats.paint.clone();
    m.alphaMap = tex;
    m.alphaTest = 0.5;
    mats.variants.push(m);
    mat = m;
  }
  const sheet = mesh(new THREE.PlaneGeometry(W, H), mat);
  sheet.position.z = z;
  return sheet;
}

/** Плоска пластина len × chord товщиною th, нахилена на ang навколо своєї довгої осі, центр (x, y, z), поворот rot у площині фасаду */
function slat(len: number, chord: number, th: number, ang: number, x: number, y: number, z: number, rot = 0) {
  const g = new THREE.BoxGeometry(len, chord, th);
  g.rotateX(ang);
  g.rotateZ(rot);
  g.translate(x, y, z);
  return g;
}

/** Круглий патрубок радіуса r довжиною len уздовж +Z від z0, з зиґом (ребром жорсткості) і темним нутром */
function spigot(r: number, len: number, mats: Materials) {
  const g = new THREE.Group();
  const c = mesh(new THREE.CylinderGeometry(r, r, len, 56, 1, true), mats.zinc);
  c.rotation.x = Math.PI / 2;
  c.position.z = len / 2;
  g.add(c);
  const bead = mesh(new THREE.TorusGeometry(r + mm(1), mm(2), 8, 56), mats.zinc);
  bead.position.z = len * 0.55;
  g.add(bead);
  const d = mesh(new THREE.CircleGeometry(r * 0.98, 40), mats.inner);
  d.position.z = mm(2);
  g.add(d);
  return g;
}

/** Зібрати багато дрібних деталей (ламелі, лопатки) в одну геометрію */
function merged(parts: THREE.BufferGeometry[], mat: THREE.Material) {
  return mesh(mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)))!, mat);
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
  /** Отвір довільної форми (кутовий щілинний), м — замість holeW × holeH */
  holePath?: [number, number][];
  /** false — виріб не монтується врівень з поверхнею (пленум-бокс): показуємо лише окремо */
  mount?: boolean;
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
    case "grille":
      return grille(spec, mats, g);
    case "slot":
      return slots(spec, mats, g);
    case "panel":
      return panel(spec, mats, g);
    case "quad":
      return quad(spec, mats, g);
    case "swirl-round":
      return swirlRound(spec, mats, g);
    case "bell":
      return bell(spec, mats, g);
    case "cde":
      return cde(spec, mats, g);
    case "plaster":
      return plaster(spec, mats, g);
    case "nozzle":
      return nozzle(spec, mats, g);
    case "round-grille":
      return roundGrille(spec, mats, g);
    case "box":
      return box(spec, mats, g);
  }
}

type Built = { group: THREE.Group; dims: Dims };
type Of<K extends ModelSpec["kind"]> = Extract<ModelSpec, { kind: K }>;

/** Логотип на нижній смузі рамки шириною f біля правого краю */
const frameLogo = (W: number, H: number, f: number, z: number) => {
  const lh = Math.min(mm(11), f * 0.42);
  return f >= mm(14) ? { x: W / 2 + f / 2 - lh * 1.9, y: -H / 2 - f / 2, z, h: lh } : undefined;
};

function grille(spec: Of<"grille">, mats: Materials, g: THREE.Group): Built {
  const W = mm(spec.w);
  const H = mm(spec.h);
  const style = spec.style ?? "blades";
  if (style === "bars") {
    // RG: поздовжні бруски з кроком pitch, торцеві планки й поперечні стяжки ззаду, без лицьової рамки
    const t = mm(2);
    const d = mm(15);
    const p = mm(spec.pitch);
    const f = mm(spec.frame ?? 6);
    const n = Math.max(2, Math.round(H / p) + 1);
    const bars: THREE.BufferGeometry[] = [];
    for (let i = 0; i < n; i++) bars.push(slat(W, mm(3), d, 0, 0, -H / 2 + (i * H) / (n - 1), t - d / 2).rotateX(0));
    for (const x of [-W / 2 - f / 2, W / 2 + f / 2]) bars.push(slat(f, H + mm(3), d, 0, x, 0, t - d / 2));
    const ties = Math.max(2, Math.round(W / mm(150)));
    for (let i = 0; i <= ties; i++) bars.push(slat(mm(3), H, mm(6), 0, -W / 2 + (i * W) / ties, 0, t - d + mm(3)));
    g.add(merged(bars, mats.paint));
    g.add(backPlate(W, H, -mm(40), mats));
    return { group: g, dims: { width: W + 2 * f, height: H, nomW: W, nomH: H, labelW: `${spec.w}`, labelH: `${spec.h}`, holeW: W + 2 * f, holeH: H + mm(4) } };
  }
  const f = mm(spec.frame ?? (spec.w > 600 || spec.h > 600 ? 30 : 24));
  const t = mm(style === "blades" ? 9 : 7);
  const chord = mm(spec.chord ?? 18);
  const depth = Math.max(mm(70), chord + mm(30));
  g.add(mesh(rectSweep(frameProfile(f + mm(2), t, mm(3)), W / 2 + f, H / 2 + f), mats.paint));
  // за жалюзі й перфорацією — темне нутро повітроводу, як на фото
  g.add(sleeve(W, H, depth, style === "blades" ? mats.paint : mats.inner, t - mm(1), mm(1)));
  const p = mm(spec.pitch);
  const ang = (spec.angle * Math.PI) / 180;
  // жалюзі: плоскі пластини під кутом, передня кромка — біля лицьової площини
  const louvres = (c: number, pitch: number, zFront: number) => {
    const n = Math.max(2, Math.floor((H - mm(4)) / pitch));
    const y0 = -((n - 1) * pitch) / 2;
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < n; i++) parts.push(slat(W - mm(2), c, mm(1.2), Math.PI / 2 - ang, 0, y0 + i * pitch, zFront - (c * Math.cos(ang)) / 2));
    return merged(parts, mats.paint);
  };
  if (style === "blades") {
    const n = Math.max(2, Math.floor((H - mm(6)) / p));
    const y0 = -((n - 1) * p) / 2;
    for (let i = 0; i < n; i++) {
      const b = mesh(blade(chord, mm(2.6), W - mm(2)), mats.paint);
      b.rotation.x = -ang;
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
  } else if (style === "louvre") {
    g.add(louvres(chord, p, t - mm(1)));
    if (spec.mesh) g.add(patternSheet(W, H, mm(9), "mesh", mats, t - chord - mm(10), true));
  } else if (style === "flaps") {
    // гравітаційні пластини на шарнірі вгорі, внахлест, трохи відхилені вперед
    const n = Math.max(2, Math.ceil(H / p));
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < n; i++) {
      const yTop = H / 2 - i * p;
      const hgt = Math.min(p + mm(8), yTop + H / 2 - mm(2));
      const geo = new THREE.BoxGeometry(W - mm(4), hgt, mm(1));
      geo.translate(0, -hgt / 2, 0);
      geo.rotateX(-ang);
      geo.translate(0, yTop, t - mm(10) - i * mm(0.3));
      parts.push(geo);
    }
    g.add(merged(parts, mats.paint));
  } else {
    // перфорований лист врівень з рамкою
    g.add(patternSheet(W + mm(2), H + mm(2), mm(spec.pitch), spec.perf ?? "hex", mats, t - mm(1.5)));
    if (!spec.behind) g.add(backPlate(W, H, t - mm(12), mats));
    if (spec.behind) g.add(louvres(mm(22), mm(40), t - mm(14)));
  }
  g.add(backPlate(W, H, t - depth - mm(1), mats));
  return {
    group: g,
    dims: { width: W + 2 * f, height: H + 2 * f, nomW: W, nomH: H, labelW: `${spec.w}`, labelH: `${spec.h}`, holeW: W + mm(6), holeH: H + mm(6), logo: frameLogo(W, H, f, t) },
  };
}

/** Одна лінія щілинного дифузора довжиною L уздовж X, центр — у нулі */
function slotLine(spec: Of<"slot">, L: number, mats: Materials, caps: [boolean, boolean] = [true, true]) {
  const g = new THREE.Group();
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
    const r = Math.min(sw * 0.34, mm(9));
    const c = mesh(new THREE.CylinderGeometry(r, r, L - mm(4), 28, 1, false, Math.PI * 0.15, Math.PI * 1.1), mats.dark);
    c.rotation.z = Math.PI / 2;
    c.position.set(0, yc, -r - mm(1));
    g.add(c);
  }
  if (spec.track) {
    // CLT: трек освітлення по центру й поворотний світильник
    g.add(mesh(slat(L - mm(6), mm(18), mm(8), 0, 0, 0, t - mm(5)), mats.dark));
    const lamp = new THREE.Group();
    const body = mesh(new THREE.CylinderGeometry(mm(24), mm(24), mm(80), 32), mats.dark);
    body.rotation.x = 0.5;
    body.position.set(0, -mm(18), mm(46));
    lamp.add(body);
    const lens = mesh(new THREE.CircleGeometry(mm(19), 32), new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xffe7b0, emissiveIntensity: 0.6 }));
    lens.position.set(0, -mm(18) - Math.sin(0.5) * mm(40.5), mm(46) - Math.cos(0.5) * mm(40.5));
    lens.rotation.x = Math.PI + 0.5;
    lamp.add(lens);
    const stem = mesh(new THREE.BoxGeometry(mm(14), mm(14), mm(26)), mats.dark);
    stem.position.set(0, 0, t + mm(12));
    lamp.add(stem);
    lamp.position.x = -L * 0.22;
    g.add(lamp);
  }
  // торцеві заглушки
  [-L / 2, L / 2].forEach((x, i) => {
    if (!caps[i]) return;
    const e = mesh(new THREE.BoxGeometry(mm(3), Ht, t + mm(40)), mats.paint);
    e.position.set(x, 0, t - (t + mm(40)) / 2);
    g.add(e);
  });
  g.add(sleeve(L, Hs, mm(80), mats.zinc, -mm(40)));
  g.add(backPlate(L, Hs, -mm(120), mats));
  return { line: g, Hs, Ht };
}

function slots(spec: Of<"slot">, mats: Materials, g: THREE.Group): Built {
  const L = mm(spec.length);
  if (!spec.corner) {
    const { line, Hs, Ht } = slotLine(spec, L, mats);
    g.add(line);
    return { group: g, dims: { width: L, height: Ht, nomW: L, nomH: Ht, labelW: `L ${spec.length}`, holeW: L - mm(2), holeH: Hs + mm(6) } };
  }
  // кутовий елемент (SDA, SDHA): дві лінії по L під 90°, стик — у куті
  const a = slotLine(spec, L, mats);
  const { Hs, Ht } = a;
  a.line.position.x = L / 2 - Ht / 2;
  g.add(a.line);
  const bLen = L - Ht;
  const b = slotLine(spec, bLen, mats, [false, true]);
  b.line.rotation.z = -Math.PI / 2;
  b.line.position.y = -Ht / 2 - bLen / 2;
  g.add(b.line);
  const end = L - Ht / 2;
  // центруємо за габаритом
  const cx = (end - Ht / 2) / 2;
  const cy = -(end - Ht / 2) / 2;
  g.children.forEach((c) => {
    c.position.x -= cx;
    c.position.y -= cy;
  });
  const hs = Hs / 2 + mm(3);
  const hole: [number, number][] = [
    [-hs, hs],
    [end - mm(1), hs],
    [end - mm(1), -hs],
    [hs, -hs],
    [hs, -end + mm(1)],
    [-hs, -end + mm(1)],
  ].map(([x, y]) => [x - cx, y - cy]);
  return { group: g, dims: { width: L, height: L, nomW: L, nomH: L, labelW: `L ${spec.length}`, labelH: `${spec.length}`, holeW: 0, holeH: 1, holePath: hole } };
}

function panel(spec: Of<"panel">, mats: Materials, g: THREE.Group): Built {
  // стельова панель (касета Armstrong): лист 1 мм з відбортовкою 20 мм, візерунок отворів
  const W = mm(spec.w);
  const H = mm(spec.h);
  const S = Math.min(W, H);
  const t = mm(1.5);
  const holes: THREE.Path[] = [];
  const blades: THREE.BufferGeometry[] = [];
  const scoops: THREE.BufferGeometry[] = [];
  const bladeIn = (cx: number, cy: number, len: number, w: number, ang: number) => blades.push(slat(len * 0.86, w * 0.6, mm(1.2), 1.0, 0, 0, 0, ang).translate(cx, cy, t - mm(7)));
  const ring = (n: number, r: number, f: (cx: number, cy: number, th: number) => void, phase = 0) => {
    for (let i = 0; i < n; i++) {
      const th = phase + (i / n) * Math.PI * 2;
      f(r * Math.cos(th), r * Math.sin(th), th);
    }
  };
  const dimple = (cx: number, cy: number, r: number, ang: number) => {
    holes.push(circlePath(cx, cy, r));
    // напівкупол над половиною отвору: повітря виходить по дотичній (закручування)
    const s = new THREE.SphereGeometry(r, 28, 10, 0, Math.PI, 0, Math.PI / 2);
    s.rotateX(Math.PI / 2);
    s.scale(1, 1, 0.75);
    s.rotateZ(ang);
    s.translate(cx, cy, t);
    scoops.push(s);
  };
  switch (spec.pattern) {
    case "radial": {
      // DCC: концентричні кільця коротких щілин, повернутих до радіуса (закручений струмінь)
      for (let k = 0; k < 6; k++) {
        const r = S * (0.1 + k * 0.064);
        const len = mm(9 + k * 1.6);
        const n = Math.floor((2 * Math.PI * r) / mm(14 + k));
        ring(n, r, (x, y, th) => holes.push(slotPath(x, y, len, mm(3.6), th + 0.5)), k * 0.13);
      }
      break;
    }
    case "square": {
      // DCS: щілини рядами; у лівому/правому секторі — вертикальні, у верхньому/нижньому — горизонтальні, по діагоналях — проміжок
      const pch = mm(17);
      const lim = S * 0.43;
      for (let x = -lim; x <= lim + 1e-6; x += pch)
        for (let y = -lim; y <= lim + 1e-6; y += pch) {
          if (Math.max(Math.abs(x), Math.abs(y)) < S * 0.08 || Math.abs(Math.abs(x) - Math.abs(y)) < pch * 0.6) continue;
          holes.push(slotPath(x, y, mm(11), mm(3.8), Math.abs(x) > Math.abs(y) ? Math.PI / 2 : 0));
        }
      break;
    }
    case "dimple-grid": {
      const k = Math.max(3, Math.round(Math.sqrt(spec.count || 16)));
      const pch = (S * 0.88) / k;
      for (let i = 0; i < k; i++)
        for (let j = 0; j < k; j++) {
          const x = -((k - 1) * pch) / 2 + i * pch;
          const y = -((k - 1) * pch) / 2 + j * pch;
          dimple(x, y, pch * 0.36, Math.atan2(y, x) + Math.PI / 2);
        }
      break;
    }
    case "dimple-ring": {
      const r = S * 0.072;
      ring(11, S * 0.35, (x, y, th) => dimple(x, y, r, th + Math.PI / 2));
      ring(5, S * 0.17, (x, y, th) => dimple(x, y, r, th + Math.PI / 2), 0.3);
      break;
    }
    case "swirl": {
      // RDA-S: щілини з поворотними лопатками, одне або два кільця
      const n = spec.count || 8;
      const rings = n <= 16 ? [[n, 0.27]] : [[Math.round(n / 3), 0.19], [n - Math.round(n / 3), 0.36]];
      for (const [cnt, rr] of rings) {
        const len = S * (n <= 16 ? 0.2 : 0.12);
        const w = Math.min(mm(14), ((2 * Math.PI * rr * S) / cnt) * 0.45);
        ring(cnt, rr * S, (x, y, th) => {
          holes.push(slotPath(x, y, len, w, th + 0.65));
          bladeIn(x, y, len, w, th + 0.65);
        });
      }
      break;
    }
    case "star": {
      // RDC-S: радіальні щілини від центру
      const n = spec.count || 16;
      const r0 = S * 0.09;
      const r1 = S * 0.43;
      const w = Math.min(mm(13), ((2 * Math.PI * S * 0.16) / n) * 0.55);
      ring(n, (r0 + r1) / 2, (x, y, th) => {
        holes.push(slotPath(x, y, r1 - r0, w, th + 0.18));
        bladeIn(x, y, r1 - r0, w, th + 0.18);
      });
      break;
    }
  }
  g.add(mesh(holedPlate(W, H, holes, t), mats.paint));
  // відбортовка по периметру
  const th = mm(0.9);
  g.add(mesh(rectSweep([...sharp([0, t]), ...sharp([0, t - mm(20)]), ...sharp([th, t - mm(20)]), ...sharp([th, t - mm(1)])], W / 2, H / 2), mats.paint));
  if (blades.length) g.add(merged(blades, mats.dark));
  if (scoops.length) g.add(merged(scoops, mats.paint));
  g.add(backPlate(W - mm(2), H - mm(2), -mm(45), mats));
  g.add(sleeve(W - mm(2), H - mm(2), mm(26), mats.inner, t - mm(20)));
  const lh = mm(8);
  return {
    group: g,
    dims: { width: W, height: H, nomW: W, nomH: H, labelW: `${spec.w}`, labelH: `${spec.h}`, holeW: W - mm(1), holeH: H - mm(1), logo: { x: W / 2 - lh * 2.6, y: -H / 2 + lh * 1.3, z: t, h: lh } },
  };
}

function quad(spec: Of<"quad">, mats: Materials, g: THREE.Group): Built {
  // RD: рамка L+40, чотири сектори нерухомих ламелей у різних напрямках (подача на 4 сторони)
  const W = mm(spec.w);
  const H = mm(spec.h);
  const f = mm(20);
  const t = mm(8);
  g.add(mesh(rectSweep(frameProfile(f + mm(2), t, mm(3)), W / 2 + f, H / 2 + f), mats.paint));
  g.add(sleeve(W, H, mm(32), mats.paint, t - mm(1), mm(1)));
  const parts: THREE.BufferGeometry[] = [slat(W, mm(5), mm(26), 0, 0, 0, t - mm(13)), slat(mm(5), H, mm(26), 0, 0, 0, t - mm(13))];
  const qw = W / 2 - mm(4);
  const qh = H / 2 - mm(4);
  const p = mm(20);
  const c = mm(18);
  for (const [sx, sy, horiz] of [[-1, 1, true], [1, 1, false], [-1, -1, false], [1, -1, true]] as [number, number, boolean][]) {
    const cx = (sx * W) / 4;
    const cy = (sy * H) / 4;
    const n = Math.max(2, Math.floor((horiz ? qh : qw) / p));
    for (let i = 0; i < n; i++) {
      const o = -((n - 1) * p) / 2 + i * p;
      const a = Math.PI / 2 - 0.6 * (horiz ? sy : sx);
      parts.push(horiz ? slat(qw, c, mm(1.2), a, cx, cy + o, t - c / 2) : slat(qh, c, mm(1.2), a, 0, 0, 0, Math.PI / 2).translate(cx + o, cy, t - c / 2));
    }
  }
  g.add(merged(parts, mats.paint));
  g.add(backPlate(W, H, t - mm(33), mats));
  return { group: g, dims: { width: W + 2 * f, height: H + 2 * f, nomW: W, nomH: H, labelW: `${spec.w}`, labelH: `${spec.h}`, holeW: W + mm(6), holeH: H + mm(6), logo: frameLogo(W, H, f, t) } };
}

function swirlRound(spec: Of<"swirl-round">, mats: Materials, g: THREE.Group): Built {
  // DRP / VDL: фланець D1 товщиною 7 мм, у горловині D — закручувальні лопатки навколо маточини
  const R = mm(spec.d) / 2;
  const Rf = mm(spec.flange) / 2;
  const T = mm(7);
  const neck = mm(spec.d >= 400 ? 90 : 60);
  const prof: P[] = [[R, T], ...sharp([R + mm(1), T]), [R + (Rf - R) * 0.35, T - mm(1.5)], [Rf - mm(4), mm(3)], ...arc(Rf - mm(4), mm(1.5), mm(1.5), Math.PI / 2, -Math.PI / 2, 5), [R + mm(1), 0], [R + mm(1), -neck], [R, -neck], [R, T]];
  g.add(mesh(lathe(prof), mats.paint));
  const vdl = spec.blades <= 8;
  const rh = R * (vdl ? 0.14 : 0.24);
  const r1 = R * 0.97;
  const rm = (rh + r1) / 2;
  const tilt = vdl ? 0.28 : 0.62;
  const chord = ((2 * Math.PI * rm) / spec.blades) * (vdl ? 1.12 : 0.95);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < spec.blades; i++) parts.push(slat(r1 - rh, chord, mm(1.2), tilt, rm, 0, vdl ? T - mm(5) : T - mm(16), 0).rotateZ((i / spec.blades) * Math.PI * 2));
  g.add(merged(parts, mats.paint));
  // маточина з кришкою
  const zc = vdl ? T - mm(3) : T - mm(6);
  g.add(mesh(lathe([[0, zc + mm(2)], [rh * 0.8, zc + mm(1)], ...arc(rh * 0.8, zc - mm(1), mm(2), Math.PI / 2, 0, 4), [rh, -mm(35)], [0, -mm(35)]]), mats.paint));
  if (!vdl) g.add(mesh(lathe([[0, zc + mm(2.2)], [rh * 0.35, zc + mm(2.2)], [rh * 0.35, zc + mm(0.5)], [0, zc + mm(0.5)]]), mats.dark));
  g.add(backPlate(2 * R, 2 * R, -neck, mats, true));
  return { group: g, dims: { width: 2 * Rf, height: 2 * Rf, nomW: 2 * R, nomH: 2 * R, labelW: `Ø${spec.d}`, round: true, holeW: 2 * R + mm(8), holeH: 0 } };
}

function bell(spec: Of<"bell">, mats: Materials, g: THREE.Group): Built {
  // DVA: розтруб D1 ≈ 1.5·D заввишки до горловини, великі закручувальні лопатки, корпус H = 320 мм
  const R = mm(spec.d) / 2;
  const Rf = (mm(spec.d) * (spec.d <= 500 ? 1.59 : 1.46)) / 2;
  const Hb = mm(320);
  const rho = Rf - R;
  const wall = (z: number) => Rf - rho * Math.sin(Math.acos(Math.min(1, 1 + z / rho)));
  const curve: P[] = [[Rf + mm(14), mm(1)], [Rf + mm(14), mm(3)], [Rf + mm(2), mm(4)]];
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * (Math.PI / 2);
    curve.push([Rf - rho * Math.sin(a), -rho * (1 - Math.cos(a))]);
  }
  curve.push([R, -Hb]);
  g.add(mesh(lathe(curve), mats.paint));
  // лопатки: повторюють контур розтруба, нахилені для закручування
  const parts: THREE.BufferGeometry[] = [];
  const r0 = R * 0.22;
  for (let i = 0; i < 8; i++) {
    const s = new THREE.Shape();
    const z0 = -rho * 0.98;
    const z1 = -rho * 0.12;
    s.moveTo(r0, z0);
    for (let k = 0; k <= 10; k++) {
      const z = z0 + ((z1 - z0) * k) / 10;
      s.lineTo(wall(z) - mm(4), z);
    }
    s.lineTo(r0, z1 * 0.6);
    const geo = new THREE.ExtrudeGeometry(s, { depth: mm(1.5), bevelEnabled: false });
    geo.rotateX(Math.PI / 2);
    // закрут навколо радіальної осі через середину лопатки
    const zm = (z0 + z1) / 2;
    geo.translate(0, 0, -zm);
    geo.rotateX(0.5);
    geo.translate(0, 0, zm);
    geo.rotateZ((i / 8) * Math.PI * 2);
    parts.push(geo);
  }
  g.add(merged(parts, mats.paint));
  g.add(mesh(lathe([[0, -rho * 0.1], [r0 * 0.6, -rho * 0.16], [r0, -rho * 0.4], [r0, -Hb * 0.8], [0, -Hb * 0.8]]), mats.paint));
  g.add(backPlate(2 * R, 2 * R, -Hb, mats, true));
  return { group: g, dims: { width: 2 * (Rf + mm(14)), height: 2 * (Rf + mm(14)), nomW: 2 * R, nomH: 2 * R, labelW: `Ø${spec.d}`, round: true, holeW: 2 * Rf, holeH: 0 } };
}

/** Таблиця CDE-R: ØC, ØE, ØD, H, h */
const CDE: Record<number, [number, number, number, number, number]> = { 160: [157, 367, 308, 68, 22], 200: [198, 398, 346, 72, 22], 250: [248, 514, 462, 94, 22], 315: [313, 582, 518, 97, 25] };

function cde(spec: Of<"cde">, mats: Materials, g: THREE.Group): Built {
  const row = CDE[spec.d] ?? [spec.d - 2, spec.d * 2.1, spec.d * 1.85, spec.d * 0.35, 22];
  const [C, E, D, Hh] = row.map(mm);
  const Rc = C / 2;
  const Re = E / 2;
  const Rd = D / 2;
  // лицьовий фланець E і зовнішній конус до горловини C
  g.add(mesh(lathe([[Rd, mm(3)], [Re - mm(4), mm(2)], ...arc(Re - mm(4), mm(0.5), mm(1.5), Math.PI / 2, -Math.PI / 2, 4), [Rd, mm(0.5)], [Rc, -Hh * 0.45], [Rc, -Hh - mm(40)], [Rc - mm(1), -Hh - mm(40)], [Rc - mm(1), -Hh * 0.45], [Rd - mm(1), mm(3)], [Rd, mm(3)]]), mats.paint));
  // середнє кільце-дефлектор (опукле) і центральний диск
  const ringProf: P[] = [];
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * Math.PI;
    ringProf.push([Rd * 0.82 - (Rd * 0.36 * i) / 12, mm(5) + Math.sin(a) * mm(9) - (Hh * 0.25 * i) / 12]);
  }
  g.add(mesh(lathe([...ringProf, ...ringProf.slice().reverse().map(([r, z]) => [r, z - mm(1.2)] as P)]), mats.paint));
  const disc: P[] = [[0, mm(16)]];
  for (let i = 1; i <= 10; i++) disc.push([(Rd * 0.4 * i) / 10, mm(16) - mm(6) * (i / 10) ** 2]);
  disc.push(...arc(Rd * 0.4 - mm(1.5), mm(10) - mm(1.5), mm(1.5), Math.PI / 2, -Math.PI / 2, 4), [0, mm(7)]);
  g.add(mesh(lathe(disc), mats.paint));
  g.add(backPlate(C, C, -Hh - mm(40), mats, true));
  return { group: g, dims: { width: E, height: E, nomW: C, nomH: C, labelW: `Ø${spec.d}`, round: true, holeW: D + mm(10), holeH: 0 } };
}

function plaster(spec: Of<"plaster">, mats: Materials, g: THREE.Group): Built {
  // CRL / PCR / SQR: гіпсовий корпус урівень зі стелею, кільцева щілина і лицьовий диск з ефектом Коанда
  const R = mm(spec.d) / 2;
  const Ro = R + mm(44);
  const Rd = R + mm(8);
  const gap = mm(9);
  const zd = mm(4);
  if (!spec.square) {
    g.add(mesh(lathe([[Ro, 0], [Rd + gap + mm(2), 0], ...arc(Rd + gap + mm(2), -mm(2), mm(2), Math.PI / 2, Math.PI, 4), [Rd + gap, -mm(18)], [Rd + gap - mm(1), -mm(18)], [Rd + gap - mm(1), -mm(1)]]), mats.paint));
    g.add(mesh(lathe([[R + mm(2), -mm(16)], [Rd + gap, -mm(16)], [Rd + gap, -mm(17)], [R + mm(2), -mm(17)]]), mats.inner));
    g.add(mesh(lathe([[0, zd], [Rd - mm(3), zd], ...arc(Rd - mm(3), zd - mm(3), mm(3), Math.PI / 2, 0, 5), [Rd, -mm(2)], [Rd - mm(2), -mm(4)], [0, -mm(4)]]), mats.paint));
  } else {
    const band = (a: number, b: number, z0: number, z1: number) => mesh(rectSweep([...sharp([0, z1]), ...sharp([a - b, z1]), ...sharp([a - b, z0]), ...sharp([0, z0])], a, a), mats.paint);
    g.add(band(Ro, Rd + gap, -mm(1.5), 0));
    g.add(mesh(rectSweep([...sharp([0, 0]), ...sharp([0, -mm(18)]), ...sharp([mm(1), -mm(18)]), ...sharp([mm(1), 0])], Rd + gap, Rd + gap), mats.paint));
    g.add(mesh(new THREE.PlaneGeometry(2 * (Rd + gap), 2 * (Rd + gap)).translate(0, 0, -mm(17)), mats.inner));
    g.add(mesh(rectSweep([[0, -mm(2)], ...arc(mm(3), zd - mm(3), mm(3), Math.PI, Math.PI / 2, 5), [Rd, zd], [Rd, -mm(4)]], Rd, Rd), mats.paint));
  }
  g.add(backPlate(2 * R, 2 * R, -mm(140), mats, true));
  g.add(mesh(lathe([[R, -mm(17)], [R, -mm(140)], [R - mm(0.8), -mm(140)], [R - mm(0.8), -mm(17)]]), mats.zinc));
  return { group: g, dims: { width: 2 * Ro, height: 2 * Ro, nomW: 2 * R, nomH: 2 * R, labelW: `Ø${spec.d}`, round: !spec.square, holeW: 2 * Ro, holeH: spec.square ? 2 * Ro : 0 } };
}

function nozzle(spec: Of<"nozzle">, mats: Materials, g: THREE.Group): Built {
  // JN: фланець D3, поворотна куля D4 з соплом D2, корпус D1 довжиною L1
  const R = mm(spec.d) / 2;
  const Rf = (mm(spec.d) * 1.13 + mm(20)) / 2;
  const Rs = mm(spec.d) * 0.49;
  const rb = mm(spec.d) * 0.26;
  const zc = -Rs * 0.4;
  g.add(mesh(lathe([[Rs * 0.93, mm(6)], [Rf - mm(4), mm(4)], ...arc(Rf - mm(4), mm(1), mm(3), Math.PI / 2, -Math.PI / 2, 5), [R, -mm(2)], [R, -mm(spec.d * 0.8)], [R - mm(1), -mm(spec.d * 0.8)], [R - mm(1), 0], [Rs * 0.93, mm(4)], [Rs * 0.93, mm(6)]]), mats.paint));
  const ball = new THREE.Group();
  const a0 = Math.asin(rb / Rs);
  const cap: P[] = [[rb, -Rs * 0.9]];
  cap.push(...sharp([rb, Rs * Math.cos(a0) + mm(3)]));
  cap.push([rb + mm(3), Rs * Math.cos(a0) + mm(3)]);
  for (let i = 0; i <= 18; i++) {
    const a = a0 + ((Math.PI * 0.62 - a0) * i) / 18;
    cap.push([Rs * Math.sin(a), Rs * Math.cos(a)]);
  }
  ball.add(mesh(lathe(cap), mats.paint));
  ball.add(mesh(lathe([[rb - mm(0.5), Rs * Math.cos(a0) + mm(2)], [rb - mm(0.5), -Rs * 0.9], [0, -Rs * 0.9]]), mats.inner));
  ball.position.z = zc;
  ball.rotation.x = 0.2;
  ball.rotation.y = -0.12;
  g.add(ball);
  return { group: g, dims: { width: 2 * Rf, height: 2 * Rf, nomW: 2 * R, nomH: 2 * R, labelW: `Ø${spec.d}`, round: true, holeW: 2 * R + mm(4), holeH: 0 } };
}

function roundGrille(spec: Of<"round-grille">, mats: Materials, g: THREE.Group): Built {
  // ELC: кругла рамка із заокругленим бортом і нерухомими жалюзі, комір у трубу
  const R = mm(spec.d) / 2;
  const Ro = R + mm(spec.d > 200 ? 22 : 16);
  g.add(mesh(lathe([[R - mm(3), mm(6)], ...arc(R + (Ro - R) * 0.4, mm(2), (Ro - R) * 0.55, Math.PI * 0.85, Math.PI * 0.1, 8), [Ro, 0], [R - mm(1), 0], [R - mm(1), -mm(45)], [R - mm(2), -mm(45)], [R - mm(2), mm(1)], [R - mm(3), mm(6)]]), mats.paint));
  const p = mm(10);
  const parts: THREE.BufferGeometry[] = [];
  for (let y = -R + mm(6); y <= R - mm(6); y += p) {
    const half = Math.sqrt((R - mm(2)) ** 2 - y * y);
    parts.push(slat(2 * half, mm(12), mm(1.2), Math.PI / 2 - 0.75, 0, y, mm(1)));
  }
  g.add(merged(parts, mats.paint));
  g.add(backPlate(2 * R, 2 * R, -mm(45), mats, true));
  return { group: g, dims: { width: 2 * Ro, height: 2 * Ro, nomW: 2 * R, nomH: 2 * R, labelW: `Ø${spec.d}`, round: true, holeW: 2 * R, holeH: 0 } };
}

function box(spec: Of<"box">, mats: Materials, g: THREE.Group): Built {
  const th = mm(1);
  const rc = mm(spec.connD) / 2;
  const add = (geo: THREE.BufferGeometry, x: number, y: number, z: number, mat: THREE.Material = mats.paint) => {
    const m = mesh(geo, mat);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  if (spec.holes) {
    // AF / FLX: фасад з отворами під гнучкі труби (до камери), кришка на гвинтах зверху, вушка для кріплення
    const X = mm(spec.a);
    const Y = mm(spec.h);
    const Z = mm(spec.b);
    const { n, rows } = spec.holes;
    const hr = mm(spec.holes.d) / 2;
    const cols = Math.ceil(n / rows);
    const pch = mm(spec.holes.d + 25);
    const hp: THREE.Path[] = [];
    for (let i = 0; i < n; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      hp.push(circlePath(-((cols - 1) * pch) / 2 + c * pch, ((rows - 1) * pch) / 2 - r * pch, hr));
    }
    g.add(mesh(holedPlate(X, Y, hp, 0, th), mats.paint));
    add(new THREE.PlaneGeometry(X - mm(4), Y - mm(4)), 0, 0, -mm(40), mats.inner);
    add(new THREE.BoxGeometry(X, Y, th), 0, 0, -Z);
    for (const s of [-1, 1]) {
      add(new THREE.BoxGeometry(th, Y, Z), (s * X) / 2, 0, -Z / 2);
      add(new THREE.BoxGeometry(X, th, Z), 0, (s * Y) / 2, -Z / 2);
      // вушка
      const ear = add(new THREE.BoxGeometry(mm(40), mm(2), mm(25)), s * (X / 2 + mm(20)), -Y / 2 + mm(1), -Z * 0.3);
      ear.castShadow = true;
    }
    add(new THREE.BoxGeometry(X * 0.55, mm(2), Z * 0.55), 0, Y / 2 + mm(1), -Z / 2);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(new THREE.CylinderGeometry(mm(3), mm(3), mm(3), 12), sx * X * 0.24, Y / 2 + mm(2.5), -Z / 2 + sz * Z * 0.24, mats.zinc);
    const sp = spigot(rc, mm(50), mats);
    sp.position.set(0, 0, -Z);
    sp.rotation.y = Math.PI;
    g.add(sp);
    return { group: g, dims: { width: X, height: Y, nomW: X, nomH: Y, labelW: `${spec.a}`, labelH: `${spec.h}`, holeW: X, holeH: Y, mount: false } };
  }
  // пленум: вихід (знизу, до приміщення) — у площині z = 0, корпус угору на висоту H
  const X = mm(spec.a);
  const Y = mm(spec.b);
  const Z = mm(spec.h);
  const lip = mm(20);
  if (spec.top) {
    const rt = mm(spec.top) / 2;
    g.add(mesh(holedPlate(X, Y, [circlePath(0, 0, rt)], 0, th), mats.paint));
    const sp = spigot(rt, mm(50), mats);
    g.add(sp);
  } else if (spec.neck) {
    const nw = mm(spec.neck);
    const s = new THREE.Path([new THREE.Vector2(-nw / 2, -Y / 2 + mm(15)), new THREE.Vector2(nw / 2, -Y / 2 + mm(15)), new THREE.Vector2(nw / 2, Y / 2 - mm(15)), new THREE.Vector2(-nw / 2, Y / 2 - mm(15))]);
    g.add(mesh(holedPlate(X, Y, [s], 0, th), mats.paint));
    g.add(sleeve(nw, Y - mm(30), mm(45), mats.paint, mm(45), th));
  } else {
    g.add(mesh(rectSweep([...sharp([0, 0]), ...sharp([lip, 0]), ...sharp([lip, th]), ...sharp([0, th])], X / 2, Y / 2), mats.paint));
  }
  add(new THREE.PlaneGeometry(X - mm(2), Y - mm(2)), 0, 0, -Z + mm(2), mats.inner);
  add(new THREE.BoxGeometry(X, Y, th), 0, 0, -Z);
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(th, Y, Z), (s * X) / 2, 0, -Z / 2);
    add(new THREE.BoxGeometry(X, th, Z), 0, (s * Y) / 2, -Z / 2);
  }
  // підключення: PS — на довгій боковій стінці, інші — на торці
  const n = spec.conns;
  for (let i = 0; i < n; i++) {
    const sp = spigot(rc, mm(70), mats);
    if (spec.neck) {
      sp.rotation.y = Math.PI / 2;
      sp.position.set(X / 2, -((n - 1) * Y) / (2 * n) + (i * Y) / n, -Z / 2);
    } else {
      sp.rotation.x = Math.PI / 2;
      sp.position.set(-((n - 1) * X) / (2 * n) + (i * X) / n, -Y / 2, -Z / 2);
    }
    g.add(sp);
  }
  return { group: g, dims: { width: X, height: Y, nomW: X, nomH: Y, labelW: `${spec.a}`, labelH: `${spec.b}`, holeW: X, holeH: Y, mount: false } };
}
