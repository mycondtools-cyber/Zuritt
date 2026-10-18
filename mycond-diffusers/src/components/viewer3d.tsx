"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { applyFinish, buildModel, makeMaterials, type Dims, type Finish } from "@/lib/model3d/build";
import type { ModelSpec } from "@/lib/model3d/spec";

export interface Viewer3DProps {
  spec: ModelSpec;
  hex: string;
  finish: Finish;
  /** Поверхня монтажу: стеля (вигляд знизу) або стіна */
  surface: "ceiling" | "wall";
  labels: { mm: string; drag: string; reset: string; dims: string; mounted: string; alone: string };
}

/** Розмірна лінія з засічками й підписом у площині фасаду */
function dimLine(a: THREE.Vector3, b: THREE.Vector3, tick: THREE.Vector3, text: string) {
  const g = new THREE.Group();
  const mat = new THREE.LineBasicMaterial({ color: 0x465c70 });
  const geo = new THREE.BufferGeometry().setFromPoints([a, b, a.clone().add(tick), a.clone().sub(tick), b.clone().add(tick), b.clone().sub(tick)]);
  g.add(new THREE.LineSegments(geo, mat));
  const el = document.createElement("div");
  el.className = "rounded-md bg-white/95 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-ink shadow-sm ring-1 ring-black/5";
  el.textContent = text;
  const label = new CSS2DObject(el);
  label.position.copy(a.clone().add(b).multiplyScalar(0.5));
  g.add(label);
  return g;
}

function dimensions(d: Dims, mmLabel: string, z: number) {
  const g = new THREE.Group();
  const off = Math.max(d.width, d.height) * 0.09;
  const t = off * 0.25;
  const w = d.nomW / 2;
  const h = d.nomH / 2;
  const ow = d.width / 2;
  const oh = d.height / 2;
  g.add(dimLine(new THREE.Vector3(-w, -oh - off, z), new THREE.Vector3(w, -oh - off, z), new THREE.Vector3(0, t, 0), `${d.labelW} ${mmLabel}`));
  if (d.labelH && !d.round) g.add(dimLine(new THREE.Vector3(-ow - off, -h, z), new THREE.Vector3(-ow - off, h, z), new THREE.Vector3(t, 0, 0), `${d.labelH} ${mmLabel}`));
  return g;
}

/** Фон студії: м'який радіальний градієнт */
function backdrop() {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const ctx = c.getContext("2d")!;
  const gr = ctx.createRadialGradient(205, 180, 20, 256, 256, 420);
  gr.addColorStop(0, "#eef0f2");
  gr.addColorStop(0.55, "#d9dee3");
  gr.addColorStop(1, "#b8c0c8");
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, 512, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Стеля / стіна навколо виробу: матова поверхня з отвором, м'яко зникає до країв */
function mountingSurface(d: Dims) {
  const R = Math.max(d.width, d.height) * 2.6;
  const shape = new THREE.Shape();
  shape.absarc(0, 0, R, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  if (d.holeH) {
    hole.moveTo(-d.holeW / 2, -d.holeH / 2);
    hole.lineTo(-d.holeW / 2, d.holeH / 2);
    hole.lineTo(d.holeW / 2, d.holeH / 2);
    hole.lineTo(d.holeW / 2, -d.holeH / 2);
  } else hole.absarc(0, 0, d.holeW / 2, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geo = new THREE.ShapeGeometry(shape, 64);
  // радіальне згасання по краях (UV ShapeGeometry — у метрах; переводимо в 0..1)
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  const gr = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, "#fff");
  gr.addColorStop(0.5, "#fff");
  gr.addColorStop(1, "#000");
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, 256, 256);
  const alpha = new THREE.CanvasTexture(c);
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + R) / (2 * R), (uv.getY(i) + R) / (2 * R));
  const mat = new THREE.MeshStandardMaterial({ color: 0xf6f5f1, roughness: 0.95, metalness: 0, alphaMap: alpha, transparent: true });
  const m = new THREE.Mesh(geo, mat);
  m.receiveShadow = true;
  m.position.z = -0.0002;
  return m;
}

/** Логотип MYCOND на лицьовій рамці */
function logoDecal(d: Dims, onReady: () => void) {
  if (!d.logo) return null;
  const tex = new THREE.TextureLoader().load("/brand/mycond-logo-horizontal.png", onReady);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const h = d.logo.h;
  const w = h * (1482 / 405);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.position.set(d.logo.x, d.logo.y, d.logo.z + 0.0002);
  return m;
}

export default function Viewer3D({ spec, hex, finish, surface, labels }: Viewer3DProps) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{ setLook: (hex: string, finish: Finish) => void; reset: () => void; showDims: (v: boolean) => void; showMount: (v: boolean) => void } | null>(null);
  const [dimsOn, setDimsOn] = useState(true);
  const [mounted, setMounted] = useState(true);

  // сцена перебудовується лише при зміні геометрії; колір — без перебудови
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    renderer.setPixelRatio(dpr);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);
    const labelR = new CSS2DRenderer();
    labelR.domElement.style.position = "absolute";
    labelR.domElement.style.inset = "0";
    labelR.domElement.style.pointerEvents = "none";
    el.appendChild(labelR.domElement);

    const scene = new THREE.Scene();
    const bg = backdrop();
    scene.background = bg;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.55;

    let dirty = true;
    const mats = makeMaterials(hex, finish);
    const { group, dims } = buildModel(spec, mats);
    scene.add(group);
    const surf = mountingSurface(dims);
    scene.add(surf);
    const logo = logoDecal(dims, () => (dirty = true));
    if (logo) scene.add(logo);
    const front = new THREE.Box3().setFromObject(group).max.z;
    const dimGroup = dimensions(dims, labels.mm, front + 0.002);
    scene.add(dimGroup);

    // ключове світло збоку під гострим кутом: похилі конуси й ламелі отримують різні відтінки й тінь на поверхні
    const size = Math.max(dims.width, dims.height);
    const key = new THREE.DirectionalLight(0xffffff, 2.3);
    key.position.set(-size * 1.2, size * 1.5, size * 1.4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0003;
    key.shadow.normalBias = 0.0015;
    key.shadow.radius = 4;
    const sc = key.shadow.camera;
    sc.left = sc.bottom = -size * 1.3;
    sc.right = sc.top = size * 1.3;
    sc.near = 0.01;
    sc.far = size * 8;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xe4ecff, 0.45);
    fill.position.set(size * 1.5, -size * 0.6, size * 1.2);
    scene.add(fill);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xc9ced4, 0.25));

    const camera = new THREE.PerspectiveCamera(30, 1, 0.005, 100);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.8;
    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    let radius = box.getBoundingSphere(new THREE.Sphere()).radius * 1.15;
    // довгий щілинний: стартовий ракурс — на кінець лінії з торцевою заглушкою, щоб було видно профіль
    if (spec.kind === "slot" && dims.width > 0.8) {
      radius = 0.42;
      center.x = dims.width / 2 - 0.3;
    }
    controls.target.copy(center);
    // поки виріб у стелі — не заглядати за неї
    const limitAngles = (on: boolean) => {
      controls.minAzimuthAngle = on ? -1.05 : -Infinity;
      controls.maxAzimuthAngle = on ? 1.05 : Infinity;
    };
    limitAngles(true);
    const home = () => {
      const fov = (camera.fov * Math.PI) / 180;
      const dist = radius / Math.sin(fov / 2) / Math.min(1, camera.aspect);
      const dir = surface === "ceiling" ? new THREE.Vector3(0.5, -0.5, 1) : new THREE.Vector3(0.55, -0.25, 1);
      camera.position.copy(center).add(dir.normalize().multiplyScalar(dist));
      controls.minDistance = dist * 0.3;
      controls.maxDistance = dist * 2.2;
      controls.update();
    };
    controls.addEventListener("start", () => (controls.autoRotate = false));
    controls.addEventListener("change", () => (dirty = true));

    // постобробка: GTAO (м'які тіні в щілинах і кутах) + тонмапінг
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const gtao = new GTAOPass(scene, camera, 512, 512);
    gtao.updateGtaoMaterial({ radius: size * 0.06, distanceExponent: 1.4, thickness: size * 0.03, scale: 1.1, samples: 16 });
    gtao.blendIntensity = 0.85;
    composer.addPass(gtao);
    composer.addPass(new OutputPass());

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      composer.setPixelRatio(dpr);
      composer.setSize(w, h);
      labelR.setSize(w, h);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
      dirty = true;
    };
    resize();
    home();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(el);
    renderer.setAnimationLoop(() => {
      if (!visible) return;
      const moved = controls.update();
      if (!moved && !dirty && !controls.autoRotate) return;
      dirty = false;
      composer.render();
      labelR.render(scene, camera);
    });

    api.current = {
      setLook: (h, f) => {
        applyFinish(mats.paint, h, f);
        dirty = true;
      },
      reset: () => {
        controls.autoRotate = true;
        home();
      },
      showDims: (v) => {
        dimGroup.visible = v;
        dirty = true;
      },
      showMount: (v) => {
        surf.visible = v;
        limitAngles(v);
        dirty = true;
      },
    };

    return () => {
      api.current = null;
      renderer.setAnimationLoop(null);
      ro.disconnect();
      io.disconnect();
      controls.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
          o.geometry.dispose();
          const m = o.material as THREE.Material & { map?: THREE.Texture | null; alphaMap?: THREE.Texture | null };
          m.map?.dispose();
          m.alphaMap?.dispose();
          m.dispose();
        }
      });
      bg.dispose();
      env.dispose();
      pmrem.dispose();
      composer.dispose();
      renderer.dispose();
      el.innerHTML = "";
    };
  }, [JSON.stringify(spec), labels.mm, surface]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => api.current?.setLook(hex, finish), [hex, finish]);
  useEffect(() => api.current?.showDims(dimsOn), [dimsOn]);
  useEffect(() => api.current?.showMount(mounted), [mounted]);

  const btn = (on: boolean) => `rounded-md px-2 py-1 text-[11px] font-semibold shadow-sm ${on ? "bg-ink text-white" : "bg-white text-ink-2"}`;
  return (
    <div className="relative h-full w-full bg-[#e4e8ec]">
      <div ref={host} className="absolute inset-0 cursor-grab active:cursor-grabbing" />
      <div className="pointer-events-none absolute inset-x-0 bottom-2 flex items-center justify-between gap-2 px-3">
        <span className="hidden rounded-md bg-white/80 px-2 py-1 text-[11px] text-muted sm:inline">{labels.drag}</span>
        <span className="pointer-events-auto ml-auto flex gap-1.5 whitespace-nowrap">
          <button type="button" aria-pressed={!mounted} onClick={() => setMounted((v) => !v)} className={btn(!mounted)}>
            {mounted ? labels.alone : labels.mounted}
          </button>
          <button type="button" aria-pressed={dimsOn} onClick={() => setDimsOn((v) => !v)} className={btn(dimsOn)}>
            {labels.dims}
          </button>
          <button type="button" onClick={() => api.current?.reset()} className={btn(false)}>
            {labels.reset}
          </button>
        </span>
      </div>
    </div>
  );
}
