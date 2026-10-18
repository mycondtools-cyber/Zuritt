/**
 * Параметрична геометрія виробів (three.js). Одиниці — метри; лицьова площина — z = 0, фасад дивиться в +Z.
 * Пропорції деталей (рамки, ламелі, дифузорні конуси) — типові для серії; габарит — з обраного розміру.
 */
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { ModelSpec } from "./spec";

export interface Materials {
  paint: THREE.MeshPhysicalMaterial;
  dark: THREE.MeshStandardMaterial;
  inner: THREE.MeshStandardMaterial;
  zinc: THREE.MeshStandardMaterial;
}

/** Порошкова фарба: глянець / мат / металік (RAL 9006, 9007) */
export function makeMaterials(hex: string, finish: "gloss" | "matt" | "metallic"): Materials {
  const paint = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(hex),
    roughness: finish === "matt" ? 0.68 : finish === "metallic" ? 0.38 : 0.3,
    metalness: finish === "metallic" ? 0.75 : 0,
    clearcoat: finish === "gloss" ? 0.5 : 0,
    clearcoatRoughness: 0.25,
    side: THREE.DoubleSide,
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.55, metalness: 0.1, side: THREE.DoubleSide });
  const inner = new THREE.MeshStandardMaterial({ color: 0x0a0b0c, roughness: 0.9, side: THREE.DoubleSide });
  const zinc = new THREE.MeshStandardMaterial({ color: 0xb9bec4, roughness: 0.42, metalness: 0.85, side: THREE.DoubleSide });
  return { paint, dark, inner, zinc };
}

const mm = (v: number) => v / 1000;

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Прямокутна рамка (кільце) з фаскою: зовнішні W×H, ширина полиці b, товщина t */
function rectRing(W: number, H: number, b: number, t: number, bevel = 0.0012) {
  const s = new THREE.Shape();
  s.moveTo(-W / 2, -H / 2);
  s.lineTo(W / 2, -H / 2);
  s.lineTo(W / 2, H / 2);
  s.lineTo(-W / 2, H / 2);
  s.closePath();
  const hole = new THREE.Path();
  const w = W / 2 - b;
  const h = H / 2 - b;
  hole.moveTo(-w, -h);
  hole.lineTo(-w, h);
  hole.lineTo(w, h);
  hole.lineTo(w, -h);
  hole.closePath();
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 4 });
  g.translate(0, 0, -t);
  return g;
}

/** Прямокутна гільза (стінки повітроводу) W×H, глибина d, від z0 назад */
function sleeve(W: number, H: number, d: number, z0: number, mat: THREE.Material, wall = 0.0008) {
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

/** Похиле квадратне кільце (конус дифузора): зовнішній піврозмір a на глибині za → внутрішній b на zb, товщина t */
function squareCone(a: number, za: number, b: number, zb: number, t = 0.0012) {
  const pos: number[] = [];
  const corners = (r: number, z: number) => [
    [-r, -r, z],
    [r, -r, z],
    [r, r, z],
    [-r, r, z],
  ];
  const layers = [corners(a, za), corners(b, zb), corners(b, zb - t), corners(a, za - t)];
  const quad = (p1: number[], p2: number[], p3: number[], p4: number[]) => pos.push(...p1, ...p2, ...p3, ...p1, ...p3, ...p4);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    for (let l = 0; l < 4; l++) {
      const L = layers[l];
      const N = layers[(l + 1) % 4];
      quad(L[i], L[j], N[j], N[i]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  const m = mergeVertices(g, 1e-6);
  m.computeVertexNormals();
  // гострі ребра конуса — плоске затінення граней
  return m.toNonIndexed();
}

/** Тіло обертання навколо осі Z з замкненого профілю [r, z] (м) */
function lathe(profile: [number, number][], segments = 96) {
  const pts = profile.map(([r, z]) => new THREE.Vector2(Math.max(0, r), z));
  const g = new THREE.LatheGeometry(pts, segments);
  g.rotateX(Math.PI / 2); // вісь обертання Y → Z
  g.computeVertexNormals();
  return g;
}

/** Профіль ламелі (лінза) з хордою c і товщиною t, екструдований на довжину L уздовж X */
function blade(c: number, t: number, L: number) {
  const s = new THREE.Shape();
  s.moveTo(-c / 2, 0);
  s.quadraticCurveTo(0, t, c / 2, 0);
  s.quadraticCurveTo(0, -t, -c / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: L, bevelEnabled: false, curveSegments: 8 });
  g.translate(0, 0, -L / 2);
  g.rotateY(Math.PI / 2); // екструзія вздовж X; хорда — уздовж Z (глибина)
  g.computeVertexNormals();
  return g;
}

export interface Dims {
  /** Габарит лицьової панелі, м */
  width: number;
  height: number;
  /** Номінальний (посадковий) розмір, який показують розмірні лінії, м */
  nomW: number;
  nomH: number;
  /** Підписи розмірів (номінал), мм */
  labelW: string;
  labelH?: string;
  round?: boolean;
}

export function buildModel(spec: ModelSpec, mats: Materials): { group: THREE.Group; dims: Dims } {
  const g = new THREE.Group();
  switch (spec.kind) {
    case "square-ceiling": {
      const N = mm(spec.size);
      const F = N + mm(70); // лицьова панель більша за посадковий розмір
      const half = F / 2;
      // широка пласка рамка на площині стелі (як на фото серії)
      const rim = Math.max(mm(28), F * 0.12);
      g.add(mesh(rectRing(F, F, rim, mm(8)), mats.paint));
      // похилі конуси-жалюзі: широкі смуги під ~25°, кожна наступна сходинкою ближче до приміщення;
      // між ними — тонкі щілини, з яких повітря виходить уздовж стелі
      const a0 = half - rim + mm(2);
      const c = Math.max(mm(16), N * 0.075);
      const step = (a0 - c) / (spec.cones + 0.4);
      const rise = step * 0.45; // виступ смуги від зовнішнього краю до внутрішнього
      const shift = step * 0.28; // сходинка між сусідніми конусами
      for (let i = 0; i < spec.cones; i++) {
        const a = a0 - i * step;
        const b = a - step * 0.94;
        const za = i * shift;
        g.add(mesh(squareCone(a, za, b, za + rise), mats.paint));
        // короткий вертикальний борт по зовнішньому краю — «сходинка», яку видно на фото
        g.add(mesh(squareCone(a, za - mm(6), a, za), mats.paint));
      }
      // центр — невелика піраміда вістрям у приміщення
      const cb = a0 - spec.cones * step;
      const zp = (spec.cones - 1) * shift + rise * 0.6;
      g.add(mesh(squareCone(cb, zp, mm(0.5), zp + cb * 0.75), mats.paint));
      if (spec.adjustable) {
        // регульований: поворотні пластини в отворі
        const n = Math.max(4, Math.round((N * 0.8) / mm(32)));
        for (let k = 0; k < n; k++) {
          const b = mesh(blade(mm(28), mm(2.4), N * 0.86), mats.paint);
          b.rotation.z = Math.PI / 2;
          b.rotation.y = 0.35;
          b.position.set(-N * 0.4 + (k * N * 0.8) / (n - 1), 0, -mm(80));
          g.add(b);
        }
      }
      g.add(sleeve(N, N, mm(120), -mm(20), mats.zinc));
      const back = mesh(new THREE.PlaneGeometry(N, N), mats.inner);
      back.position.z = -mm(140);
      g.add(back);
      return { group: g, dims: { width: F, height: F, nomW: N, nomH: N, labelW: `${spec.size}`, labelH: `${spec.size}` } };
    }
    case "round-ceiling": {
      const R = mm(spec.d) / 2;
      const Rf = R + mm(45);
      // зовнішній фланець і 4 концентричні конуси
      g.add(mesh(lathe([[Rf, 0], [R + mm(4), -mm(3)], [R + mm(4), -mm(14)], [R + mm(2), -mm(14)], [R + mm(2), -mm(4)], [Rf - mm(1), mm(-1.2)]]), mats.paint));
      // концентричні конуси: широкі похилі кільця сходинками вперед, у центрі — купол
      const rings = 4;
      const step = (R * 0.86) / (rings + 0.5);
      const rise = step * 0.45;
      const shift = step * 0.28;
      for (let i = 0; i < rings; i++) {
        const ro = R - i * step;
        const ri = ro - step * 0.94;
        const z = i * shift;
        g.add(mesh(lathe([[ro, z - mm(6)], [ro, z], [ri, z + rise], [ri, z + rise - mm(1.4)], [ro - mm(1.4), z - mm(1)], [ro - mm(1.4), z - mm(6)]]), mats.paint));
      }
      const rc = R - rings * step;
      const zc = (rings - 1) * shift + rise * 0.6;
      g.add(mesh(lathe([[rc, zc], [rc * 0.6, zc + rc * 0.35], [0, zc + rc * 0.45], [0, zc + rc * 0.4], [rc - mm(1.4), zc - mm(1)]]), mats.paint));
      g.add(mesh(lathe([[R, -mm(10)], [R, -mm(110)], [R - mm(0.8), -mm(110)], [R - mm(0.8), -mm(10)]]), mats.zinc));
      const back = mesh(new THREE.CircleGeometry(R, 64), mats.inner);
      back.position.z = -mm(110);
      g.add(back);
      return { group: g, dims: { width: 2 * Rf, height: 2 * Rf, nomW: 2 * R, nomH: 2 * R, labelW: `Ø${spec.d}`, round: true } };
    }
    case "disc": {
      const R = mm(spec.d) / 2;
      const Rf = R + mm(spec.d > 150 ? 32 : 24);
      // фланець з плавним переходом у горловину
      const flange: [number, number][] = [];
      for (let i = 0; i <= 12; i++) {
        const a = (i / 12) * (Math.PI / 2);
        flange.push([R + (Rf - R) * (1 - Math.cos(a)) * 0.35 + (Rf - R) * (i / 12) * 0.65, -mm(16) * (1 - Math.sin(a))]);
      }
      const outer: [number, number][] = [...flange, [Rf + mm(1), -mm(1)], [Rf, -mm(3)], ...flange.slice().reverse().map(([r, z]) => [r - mm(1.4), z - mm(2.2)] as [number, number])];
      g.add(mesh(lathe(outer), mats.paint));
      g.add(mesh(lathe([[R, -mm(16)], [R, -mm(60)], [R - mm(1), -mm(60)], [R - mm(1), -mm(16)]]), mats.paint));
      // центральний диск (тарілка) на штоку, винесений перед фланцем
      const Rd = R * (spec.exhaust ? 0.78 : 0.86);
      const disc: [number, number][] = [[0, mm(spec.exhaust ? 6 : 10)]];
      for (let i = 1; i <= 16; i++) {
        const r = (Rd * i) / 16;
        disc.push([r, mm(spec.exhaust ? 6 : 10) - (r / Rd) ** 2 * mm(spec.exhaust ? 3 : 8)]);
      }
      disc.push([Rd, disc[disc.length - 1][1] - mm(2)], [0, mm(spec.exhaust ? 3 : 5)]);
      g.add(mesh(lathe(disc), mats.paint));
      const stem = mesh(new THREE.CylinderGeometry(mm(3), mm(3), mm(40), 16), mats.zinc);
      stem.rotation.x = Math.PI / 2;
      stem.position.z = -mm(15);
      g.add(stem);
      const back = mesh(new THREE.CircleGeometry(R, 64), mats.inner);
      back.position.z = -mm(60);
      g.add(back);
      return { group: g, dims: { width: 2 * Rf, height: 2 * Rf, nomW: 2 * R, nomH: 2 * R, labelW: `Ø${spec.d}`, round: true } };
    }
    case "grille": {
      const W = mm(spec.w);
      const H = mm(spec.h);
      const f = mm(spec.w > 600 || spec.h > 600 ? 30 : 22);
      g.add(mesh(rectRing(W + 2 * f, H + 2 * f, f + mm(1), mm(8)), mats.paint));
      g.add(sleeve(W, H, mm(60), -mm(1), mats.paint, mm(1)));
      const p = mm(spec.pitch);
      const n = Math.max(2, Math.floor((H - mm(6)) / p));
      const y0 = -((n - 1) * p) / 2;
      for (let i = 0; i < n; i++) {
        const b = mesh(blade(mm(18), mm(2.6), W - mm(2)), mats.paint);
        b.rotation.x = -(spec.angle * Math.PI) / 180;
        // ламелі врівень з лицьовою рамкою
        b.position.set(0, y0 + i * p, -mm(9));
        g.add(b);
      }
      if (spec.double) {
        const pv = mm(22);
        const m = Math.max(2, Math.floor((W - mm(6)) / pv));
        const x0 = -((m - 1) * pv) / 2;
        for (let i = 0; i < m; i++) {
          const b = mesh(blade(mm(16), mm(2.4), H - mm(2)), mats.paint);
          b.rotation.z = Math.PI / 2;
          b.position.set(x0 + i * pv, 0, -mm(28));
          g.add(b);
        }
      }
      const back = mesh(new THREE.PlaneGeometry(W, H), mats.inner);
      back.position.z = -mm(60);
      g.add(back);
      return { group: g, dims: { width: W + 2 * f, height: H + 2 * f, nomW: W, nomH: H, labelW: `${spec.w}`, labelH: `${spec.h}` } };
    }
    case "slot": {
      const L = mm(spec.length);
      const sw = mm(spec.slotW);
      const div = mm(5);
      const rail = mm(spec.hidden ? 40 : 12);
      const Hs = spec.slots * sw + (spec.slots - 1) * div;
      const Ht = Hs + 2 * rail;
      // бокові полиці й перегородки — алюмінієвий профіль уздовж довжини
      const bar = (h: number, y: number, depth = mm(6)) => {
        const m = mesh(new THREE.BoxGeometry(L, h, depth), mats.paint);
        m.position.set(0, y, -depth / 2);
        g.add(m);
      };
      bar(rail, Hs / 2 + rail / 2);
      bar(rail, -Hs / 2 - rail / 2);
      for (let i = 1; i < spec.slots; i++) bar(div, Hs / 2 - i * (sw + div) + div / 2, mm(30));
      // дефлектори в кожній щілині (чорні, як у серійних SD)
      for (let i = 0; i < spec.slots; i++) {
        const yc = Hs / 2 - sw / 2 - i * (sw + div);
        const c = mesh(new THREE.CylinderGeometry(sw * 0.34, sw * 0.34, L - mm(4), 24, 1, false, Math.PI * 0.15, Math.PI * 1.1), mats.dark);
        c.rotation.z = Math.PI / 2;
        // дефлектор — одразу за лицьовою площиною, як у серійному профілі
        c.position.set(0, yc, -mm(1) - sw * 0.34);
        g.add(c);
      }
      // торцеві заглушки
      for (const x of [-L / 2, L / 2]) {
        const e = mesh(new THREE.BoxGeometry(mm(3), Ht, mm(10)), mats.paint);
        e.position.set(x, 0, -mm(5));
        g.add(e);
      }
      g.add(sleeve(L, Hs, mm(60), -mm(6), mats.zinc));
      const back = mesh(new THREE.PlaneGeometry(L, Hs), mats.inner);
      back.position.z = -mm(66);
      g.add(back);
      return { group: g, dims: { width: L, height: Ht, nomW: L, nomH: Ht, labelW: `L ${spec.length}` } };
    }
  }
}
