"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { buildModel, makeMaterials, type Dims } from "@/lib/model3d/build";
import type { ModelSpec } from "@/lib/model3d/spec";

export interface Viewer3DProps {
  spec: ModelSpec;
  hex: string;
  finish: "gloss" | "matt" | "metallic";
  labels: { mm: string; drag: string; reset: string; dims: string };
}

/** Розмірна лінія з засічками й підписом у площині фасаду */
function dimLine(a: THREE.Vector3, b: THREE.Vector3, tick: THREE.Vector3, text: string) {
  const g = new THREE.Group();
  const mat = new THREE.LineBasicMaterial({ color: 0x465c70 });
  const pts = [a, b, a.clone().add(tick), a.clone().sub(tick), b.clone().add(tick), b.clone().sub(tick)];
  const geo = new THREE.BufferGeometry().setFromPoints([pts[0], pts[1], pts[2], pts[3], pts[4], pts[5]]);
  g.add(new THREE.LineSegments(geo, mat));
  const el = document.createElement("div");
  el.className = "rounded-md bg-white/95 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-ink shadow-sm ring-1 ring-black/5";
  el.textContent = text;
  const label = new CSS2DObject(el);
  label.position.copy(a.clone().add(b).multiplyScalar(0.5));
  g.add(label);
  return g;
}

function dimensions(d: Dims, mmLabel: string) {
  const g = new THREE.Group();
  const off = Math.max(d.width, d.height) * 0.09;
  const t = off * 0.25;
  const z = 0.002;
  // лінії — на номінальний (посадковий) розмір, винесені за габарит лицьової панелі
  const w = d.nomW / 2;
  const h = d.nomH / 2;
  const ow = d.width / 2;
  const oh = d.height / 2;
  g.add(dimLine(new THREE.Vector3(-w, -oh - off, z), new THREE.Vector3(w, -oh - off, z), new THREE.Vector3(0, t, 0), `${d.labelW} ${mmLabel}`));
  if (d.labelH && !d.round) g.add(dimLine(new THREE.Vector3(-ow - off, -h, z), new THREE.Vector3(-ow - off, h, z), new THREE.Vector3(t, 0, 0), `${d.labelH} ${mmLabel}`));
  return g;
}

export default function Viewer3D({ spec, hex, finish, labels }: Viewer3DProps) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{ setLook: (hex: string, finish: Viewer3DProps["finish"]) => void; reset: () => void; showDims: (v: boolean) => void } | null>(null);
  const [dimsOn, setDimsOn] = useState(true);

  // сцена перебудовується лише при зміні геометрії; колір — без перебудови
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);
    const labelR = new CSS2DRenderer();
    labelR.domElement.style.position = "absolute";
    labelR.domElement.style.inset = "0";
    labelR.domElement.style.pointerEvents = "none";
    el.appendChild(labelR.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.5;

    const mats = makeMaterials(hex, finish);
    const { group, dims } = buildModel(spec, mats);
    scene.add(group);
    const dimGroup = dimensions(dims, labels.mm);
    scene.add(dimGroup);

    // ключове світло з м'якою тінню — підкреслює глибину конусів і ламелей
    const size = Math.max(dims.width, dims.height);
    // ключове світло збоку-зверху під гострим кутом: похилі конуси й ламелі отримують різні відтінки
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(-size * 1.3, size * 1.6, size * 1.1);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.002;
    const sc = key.shadow.camera;
    sc.left = sc.bottom = -size;
    sc.right = sc.top = size;
    sc.near = 0.01;
    sc.far = size * 6;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xdfe8ff, 0.5);
    fill.position.set(size * 1.5, -size * 0.6, size * 1.2);
    scene.add(fill);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xc9ced4, 0.25));

    const camera = new THREE.PerspectiveCamera(30, 1, 0.005, 100);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.9;
    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    const radius = box.getBoundingSphere(new THREE.Sphere()).radius * 1.18;
    controls.target.copy(center);
    const home = () => {
      const fov = (camera.fov * Math.PI) / 180;
      const dist = radius / Math.sin(fov / 2) / Math.min(1, camera.aspect);
      camera.position.copy(center).add(new THREE.Vector3(0.55, -0.42, 1).normalize().multiplyScalar(dist));
      controls.minDistance = dist * 0.35;
      controls.maxDistance = dist * 2.2;
      controls.update();
    };
    const stop = () => (controls.autoRotate = false);
    controls.addEventListener("start", stop);

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      labelR.setSize(w, h);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
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
      controls.update();
      renderer.render(scene, camera);
      labelR.render(scene, camera);
    });

    api.current = {
      setLook: (h, f) => {
        const next = makeMaterials(h, f).paint;
        mats.paint.color.copy(next.color);
        mats.paint.roughness = next.roughness;
        mats.paint.metalness = next.metalness;
        mats.paint.clearcoat = next.clearcoat;
        next.dispose();
      },
      reset: () => {
        controls.autoRotate = true;
        home();
      },
      showDims: (v) => (dimGroup.visible = v),
    };

    return () => {
      api.current = null;
      renderer.setAnimationLoop(null);
      ro.disconnect();
      io.disconnect();
      controls.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) o.geometry.dispose();
      });
      Object.values(mats).forEach((m) => m.dispose());
      env.dispose();
      pmrem.dispose();
      renderer.dispose();
      el.innerHTML = "";
    };
  }, [JSON.stringify(spec), labels.mm]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => api.current?.setLook(hex, finish), [hex, finish]);
  useEffect(() => api.current?.showDims(dimsOn), [dimsOn]);

  return (
    <div className="relative h-full w-full bg-[radial-gradient(ellipse_at_40%_35%,#f7f8f9_0%,#e3e7eb_55%,#c9d0d6_100%)]">
      <div ref={host} className="absolute inset-0 cursor-grab active:cursor-grabbing" />
      <div className="pointer-events-none absolute inset-x-0 bottom-2 flex items-center justify-between gap-2 px-3">
        <span className="hidden rounded-md bg-white/80 px-2 py-1 text-[11px] text-muted sm:inline">{labels.drag}</span>
        <span className="pointer-events-auto ml-auto flex gap-1.5 whitespace-nowrap">
          <button type="button" aria-pressed={dimsOn} onClick={() => setDimsOn((v) => !v)} className={`rounded-md px-2 py-1 text-[11px] font-semibold shadow-sm ${dimsOn ? "bg-ink text-white" : "bg-white text-ink-2"}`}>
            {labels.dims}
          </button>
          <button type="button" onClick={() => api.current?.reset()} className="rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-ink-2 shadow-sm">
            {labels.reset}
          </button>
        </span>
      </div>
    </div>
  );
}
