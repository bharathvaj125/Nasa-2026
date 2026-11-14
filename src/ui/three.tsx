import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { getInstrument } from '../data/instruments';
import { STATIONS } from '../data/stations';
import { BODIES } from '../engine/physics';
import type { BodyId, Design, Evaluation } from '../engine/types';

const EARTH_TEX = 'https://unpkg.com/three-globe@2.31.0/example/img/earth-blue-marble.jpg';

function rng(seed: number) {
  let a = seed;
  return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
}

/** Procedural planetary surface so the app works offline and needs no third-party images. */
function proceduralTexture(kind: 'moon' | 'mars' | 'earth'): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const g = c.getContext('2d')!;
  const r = rng(kind === 'moon' ? 7 : kind === 'mars' ? 11 : 3);
  const base = kind === 'moon' ? '#8d8d92' : kind === 'mars' ? '#b3562f' : '#1b4f8f';
  g.fillStyle = base; g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 420; i++) {
    const x = r() * 1024, y = r() * 512, rad = 8 + r() * 60;
    const light = r() < 0.5;
    g.fillStyle = kind === 'earth' ? (light ? 'rgba(60,140,80,0.35)' : 'rgba(10,40,90,0.3)') : light ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)';
    g.beginPath(); g.arc(x, y, rad, 0, 6.283); g.fill();
  }
  if (kind !== 'earth') {
    for (let i = 0; i < (kind === 'moon' ? 900 : 260); i++) {
      const x = r() * 1024, y = r() * 512, rad = 1.5 + r() * (kind === 'moon' ? 12 : 8);
      g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 1.2; g.beginPath(); g.arc(x, y, rad, 0, 6.283); g.stroke();
      g.fillStyle = 'rgba(0,0,0,0.08)'; g.fill();
    }
  }
  if (kind === 'mars') { g.fillStyle = 'rgba(245,245,255,0.8)'; g.fillRect(0, 0, 1024, 14); g.fillRect(0, 498, 1024, 14); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function latLon(latDeg: number, lonDeg: number, r: number) {
  const la = (latDeg * Math.PI) / 180, lo = (lonDeg * Math.PI) / 180;
  return new THREE.Vector3(r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo));
}

function starfield(n = 1400, radius = 80) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  const r = rng(99);
  for (let i = 0; i < n; i++) {
    const u = r() * 2 - 1, th = r() * 6.283, s = Math.sqrt(1 - u * u);
    pos[i * 3] = radius * s * Math.cos(th); pos[i * 3 + 1] = radius * u; pos[i * 3 + 2] = radius * s * Math.sin(th);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xcfd8ff, size: 0.18, sizeAttenuation: true, transparent: true, opacity: 0.85 }));
}

function disposeGroup(o: THREE.Object3D) {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else if (mat) mat.dispose();
  });
}

function makeSat(scale = 0.07) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(scale, scale, scale * 1.4), new THREE.MeshStandardMaterial({ color: 0xffd27a, metalness: 0.7, roughness: 0.4, emissive: 0x332200 }));
  const pm = new THREE.MeshStandardMaterial({ color: 0x1b3d8f, metalness: 0.4, roughness: 0.3, emissive: 0x081028 });
  const p1 = new THREE.Mesh(new THREE.BoxGeometry(scale * 2.4, scale * 0.04, scale * 0.9), pm); p1.position.x = scale * 1.7;
  const p2 = p1.clone(); p2.position.x = -scale * 1.7;
  const glow = new THREE.Mesh(new THREE.SphereGeometry(scale * 0.35, 12, 12), new THREE.MeshBasicMaterial({ color: 0x5ee7ff, transparent: true, opacity: 0.9 }));
  g.add(body, p1, p2, glow);
  (g as any).glow = glow;
  return g;
}

export interface OrbitSceneProps {
  body: BodyId;
  altKm: number;
  incDeg: number;
  showStations?: string[];
  /** orbits per real second (visual) */
  speed?: number;
  className?: string;
  label?: string;
  paused?: boolean;
  onEclipse?: (inShadow: boolean) => void;
}

export function OrbitScene({ body, altKm, incDeg, showStations = [], speed = 0.08, className, label, paused, onEclipse }: OrbitSceneProps) {
  const host = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const cb = useRef(onEclipse);
  cb.current = onEclipse;

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const w = () => el.clientWidth || 600, h = () => el.clientHeight || 360;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      el.innerHTML = '<div style="padding:20px;color:#94a0c9">3D view needs WebGL, which this browser has disabled. All game features still work.</div>';
      return;
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(w(), h());
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, w() / h(), 0.05, 400);
    scene.add(starfield());
    scene.add(new THREE.AmbientLight(0x6b7bb0, 0.45));
    const sun = new THREE.DirectionalLight(0xfff2dd, 2.6);
    sun.position.set(-6, 2, 4);
    scene.add(sun);

    const l2 = body === 'l2';
    const planetKind = body === 'moon' ? 'moon' : body === 'mars' ? 'mars' : 'earth';
    const planetR = l2 ? 0.7 : 1;
    const planetMat = new THREE.MeshStandardMaterial({ map: proceduralTexture(planetKind), roughness: 0.95, metalness: 0 });
    const planet = new THREE.Mesh(new THREE.SphereGeometry(planetR, 64, 48), planetMat);
    scene.add(planet);
    if (planetKind === 'earth') {
      new THREE.TextureLoader().setCrossOrigin('anonymous').load(EARTH_TEX, (t) => { t.colorSpace = THREE.SRGBColorSpace; planetMat.map = t; planetMat.needsUpdate = true; }, undefined, () => { /* keep procedural */ });
    }
    if (planetKind !== 'moon') {
      const atmo = new THREE.Mesh(new THREE.SphereGeometry(planetR * 1.04, 48, 32), new THREE.MeshBasicMaterial({ color: planetKind === 'mars' ? 0xff9a6a : 0x6fb4ff, transparent: true, opacity: 0.13, side: THREE.BackSide }));
      scene.add(atmo);
    }
    if (planetKind === 'earth' && !l2) {
      for (const id of showStations) {
        const s = STATIONS.find((x) => x.id === id);
        if (!s) continue;
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffb454 }));
        m.position.copy(latLon(s.latDeg, s.lonDeg, 1.01));
        planet.add(m);
      }
    }

    // orbit geometry (height is visually exaggerated so it is readable)
    const bodyR = BODIES[body].radiusKm;
    const orbitR = l2 ? 1 : 1 + 0.2 + 1.15 * Math.pow(Math.max(0, altKm) / bodyR, 0.6);
    const orbitGroup = new THREE.Group();
    orbitGroup.rotation.x = (incDeg * Math.PI) / 180;
    scene.add(orbitGroup);
    let ringPts: THREE.Vector3[] = [];
    let l2Center = new THREE.Vector3();
    if (l2) {
      l2Center = new THREE.Vector3(6, 0, 0);
      for (let i = 0; i <= 128; i++) { const a = (i / 128) * Math.PI * 2; ringPts.push(new THREE.Vector3(l2Center.x + 0.35 * Math.sin(a), 1.0 * Math.cos(a), 1.4 * Math.sin(a + 1.2))); }
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ringPts), new THREE.LineBasicMaterial({ color: 0x5ee7ff, transparent: true, opacity: 0.8 }));
      scene.add(line);
      const mark = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffb454 }));
      mark.position.copy(l2Center); scene.add(mark);
      const sunDot = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 24), new THREE.MeshBasicMaterial({ color: 0xffd36b }));
      sunDot.position.set(-24, 3, 6); scene.add(sunDot);
      sun.position.set(-24, 3, 6);
      const lineToL2 = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), l2Center]), new THREE.LineDashedMaterial({ color: 0x66739e, dashSize: 0.2, gapSize: 0.15 }));
      lineToL2.computeLineDistances(); scene.add(lineToL2);
    } else {
      for (let i = 0; i <= 160; i++) { const a = (i / 160) * Math.PI * 2; ringPts.push(new THREE.Vector3(orbitR * Math.cos(a), 0, orbitR * Math.sin(a))); }
      orbitGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ringPts), new THREE.LineBasicMaterial({ color: 0x5ee7ff, transparent: true, opacity: 0.85 })));
    }
    const sat = makeSat(l2 ? 0.16 : 0.075);
    if (l2) scene.add(sat); else orbitGroup.add(sat);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.08; controls.enablePan = false;
    controls.minDistance = l2 ? 4 : 1.8; controls.maxDistance = 30;
    const camDist = l2 ? 12 : Math.max(3.6, orbitR * 2.9);
    camera.position.set(camDist * 0.75, camDist * 0.45, camDist * 0.8);
    if (l2) controls.target.set(3, 0, 0);
    controls.update();

    let t = 0, last = performance.now(), raf = 0, lastShadow = false, frame = 0;
    const tmp = new THREE.Vector3();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!pausedRef.current) t += dt * speedRef.current;
      planet.rotation.y += dt * 0.02;
      const a = t * Math.PI * 2;
      if (l2) {
        const k = ringPts.length - 1; const f = ((t % 1) + 1) % 1 * k;
        const i0 = Math.floor(f), i1 = Math.min(k, i0 + 1);
        sat.position.lerpVectors(ringPts[i0], ringPts[i1], f - i0);
      } else {
        sat.position.set(orbitR * Math.cos(a), 0, orbitR * Math.sin(a));
        sat.getWorldPosition(tmp);
        const sd = sun.position.clone().normalize();
        const behind = tmp.dot(sd) < 0 && Math.sqrt(tmp.lengthSq() - Math.pow(tmp.dot(sd), 2)) < 1;
        if (behind !== lastShadow && ++frame > 3) { lastShadow = behind; cb.current?.(behind); }
        const gl = (sat as any).glow as THREE.Mesh;
        (gl.material as THREE.MeshBasicMaterial).color.set(behind ? 0x8a6bff : 0x5ee7ff);
      }
      controls.update();
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);
    const onResize = () => { renderer.setSize(w(), h()); camera.aspect = w() / h(); camera.updateProjectionMatrix(); };
    const ro = new ResizeObserver(onResize);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); controls.dispose();
      disposeGroup(scene); renderer.dispose();
      if (renderer.domElement.parentElement === el) el.removeChild(renderer.domElement);
    };
  }, [body, Math.round(altKm / 5), Math.round(incDeg), showStations.join(',')]);

  return (
    <div className={`viewport ${className ?? ''}`} ref={host} style={{ height: '100%', minHeight: 280 }}>
      {label && <div className="overlay"><span className="pill cyan">{label}</span></div>}
      <div className="br">Drag to rotate · scroll to zoom · orbit height exaggerated</div>
    </div>
  );
}

// ------------------------------------------------------------------------------- spacecraft model
const BUS_DIMS = { cubesat: [0.2, 0.2, 0.34], smallsat: [0.8, 0.8, 1.0], standard: [1.6, 1.6, 2.4], flagship: [2.8, 2.8, 3.8] } as const;
const INST_COL: Record<string, number> = { optical: 0x4aa8ff, radar: 0x6be39a, thermal: 0xff8a5b, spec: 0xc9a7ff };

export function buildCraft(design: Design): { group: THREE.Group; radius: number } {
  const group = new THREE.Group();
  const b = design.bus;
  const [bw, bh, bd] = BUS_DIMS[b.busClass];
  const gold = new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: 0.85, roughness: 0.35 });
  const bus = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), gold);
  group.add(bus);
  let radius = Math.max(bw, bh, bd);
  // solar wings
  const wingArea = b.arrayM2 / 2;
  const wl = Math.sqrt(wingArea * 2.2), wh = wingArea / wl;
  const panelMat = new THREE.MeshStandardMaterial({ color: b.solarCell === 'triple' ? 0x23307a : b.solarCell === 'gaas' ? 0x1b3d8f : 0x2a4fa8, metalness: 0.5, roughness: 0.25, emissive: 0x08102a });
  for (const s of [-1, 1]) {
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.01 * Math.max(1, bw), 0.01 * Math.max(1, bw), bw * 0.4 + 0.1, 8), new THREE.MeshStandardMaterial({ color: 0x999999 }));
    boom.rotation.z = Math.PI / 2; boom.position.x = s * (bw / 2 + 0.05);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(wl, 0.02 * Math.max(1, bw), wh), panelMat);
    wing.position.x = s * (bw / 2 + 0.1 + wl / 2);
    group.add(boom, wing);
    radius = Math.max(radius, bw / 2 + 0.1 + wl);
  }
  // dish / patch antenna on +y
  if (b.dishM > 0) {
    const D = b.dishM, depth = D * 0.14;
    const Rs = (D * D / 4 + depth * depth) / (2 * depth);
    const th = Math.asin(Math.min(1, D / 2 / Rs));
    const dish = new THREE.Mesh(new THREE.SphereGeometry(Rs, 40, 10, 0, Math.PI * 2, 0, th), new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.4, metalness: 0.3, side: THREE.DoubleSide }));
    dish.rotation.x = -Math.PI / 2 + 0; dish.position.set(0, bh / 2 + D * 0.25, 0); dish.rotation.x = 0; dish.rotation.z = Math.PI;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.015 * Math.max(1, D), 0.015 * Math.max(1, D), D * 0.3 + 0.05, 8), new THREE.MeshStandardMaterial({ color: 0xaaaaaa }));
    mast.position.set(0, bh / 2 + D * 0.12, 0);
    dish.position.y = bh / 2 + D * 0.25 + depth;
    group.add(dish, mast);
    radius = Math.max(radius, D);
  } else {
    const patch = new THREE.Mesh(new THREE.BoxGeometry(bw * 0.4, 0.01, bw * 0.4), new THREE.MeshStandardMaterial({ color: 0xdddddd }));
    patch.position.set(0, bh / 2 + 0.01, 0);
    group.add(patch);
  }
  // instruments on the nadir (+z)
  const insts = design.instrumentIds.map(getInstrument).filter(Boolean) as NonNullable<ReturnType<typeof getInstrument>>[];
  insts.forEach((ins, i) => {
    const sz = Math.max(0.06, Math.cbrt(ins.massKg / 400) * (b.busClass === 'cubesat' ? 0.5 : 1.1) * Math.max(0.9, bw));
    const col = ins.optical ? INST_COL.optical : ins.dayNight && ins.resPerKm > 0 && ins.cooling === undefined ? INST_COL.radar : ins.cooling ? INST_COL.thermal : INST_COL.spec;
    const m = new THREE.Mesh(new THREE.BoxGeometry(sz, sz, sz * 1.2), new THREE.MeshStandardMaterial({ color: col, metalness: 0.4, roughness: 0.4, emissive: col, emissiveIntensity: 0.12 }));
    const cols = Math.max(1, Math.ceil(Math.sqrt(insts.length)));
    m.position.set((i % cols - (cols - 1) / 2) * sz * 1.25, ((Math.floor(i / cols)) - 0.4) * sz * 1.25 - bh * 0.15, bd / 2 + sz * 0.6);
    group.add(m);
  });
  // telescope for L2
  if (b.telescopeM > 0) {
    const D = b.telescopeM;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(D * 0.55, D * 0.55, D * 0.9, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0x555a66, side: THREE.DoubleSide, metalness: 0.5, roughness: 0.6 }));
    barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0, bd / 2 + D * 0.5);
    group.add(barrel);
    const hexMat = new THREE.MeshStandardMaterial({ color: 0xf0c04a, metalness: 1, roughness: 0.15 });
    if (D >= 2.5) {
      const cell = D / 5;
      const coords: [number, number][] = [];
      for (let q = -2; q <= 2; q++) for (let r = -2; r <= 2; r++) if (Math.abs(q + r) <= 2 && !(q === 0 && r === 0)) coords.push([q, r]);
      for (const [q, r] of coords) {
        const hx = new THREE.Mesh(new THREE.CylinderGeometry(cell * 0.56, cell * 0.56, 0.03 * D, 6), hexMat);
        hx.rotation.x = Math.PI / 2;
        hx.position.set(cell * 0.9 * (q + r / 2) * 1.0, cell * 0.78 * r, bd / 2 + D * 0.95);
        group.add(hx);
      }
    } else {
      const mir = new THREE.Mesh(new THREE.CylinderGeometry(D / 2, D / 2, 0.04 * D, 32), hexMat);
      mir.rotation.x = Math.PI / 2; mir.position.set(0, 0, bd / 2 + D * 0.95);
      group.add(mir);
    }
    radius = Math.max(radius, D * 1.4);
  }
  if (b.thermal !== 'none' && b.telescopeM > 0) {
    const S = b.telescopeM * 3;
    for (let i = 0; i < 5; i++) {
      const sh = new THREE.Mesh(new THREE.BoxGeometry(S * (1 + i * 0.04), 0.01, S * 0.55), new THREE.MeshStandardMaterial({ color: 0xc8a8ff, metalness: 0.7, roughness: 0.3, transparent: true, opacity: 0.85 }));
      sh.position.set(0, -bh / 2 - 0.05 - i * 0.05 * b.telescopeM, 0);
      group.add(sh);
    }
    radius = Math.max(radius, S * 0.6);
  } else if (b.thermal === 'passive') {
    const rad = new THREE.Mesh(new THREE.BoxGeometry(bw * 0.9, 0.02, bd * 0.5), new THREE.MeshStandardMaterial({ color: 0xeaeaea }));
    rad.position.set(0, -bh / 2 - 0.02, 0);
    group.add(rad);
  }
  // propulsion (rear -z)
  if (b.propulsion !== 'none') {
    const col = { coldgas: 0x9fd3ff, monoprop: 0xffc27a, biprop: 0xff7a5b, electric: 0x7be0ff }[b.propulsion];
    const nozzle = new THREE.Mesh(new THREE.ConeGeometry(bw * 0.18, bw * 0.3, 20, 1, true), new THREE.MeshStandardMaterial({ color: col, metalness: 0.7, roughness: 0.3, side: THREE.DoubleSide }));
    nozzle.rotation.x = -Math.PI / 2; nozzle.position.set(0, 0, -bd / 2 - bw * 0.15);
    group.add(nozzle);
  }
  return { group, radius };
}

export function CraftScene({ design, ev, className }: { design: Design; ev: Evaluation; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const key = JSON.stringify([design.bus, design.instrumentIds]);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch { el.innerHTML = '<div style="padding:20px;color:#94a0c9">3D view needs WebGL.</div>'; return; }
    const w = () => el.clientWidth || 500, h = () => el.clientHeight || 320;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(w(), h());
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.add(starfield(900, 60));
    scene.add(new THREE.AmbientLight(0x8090c0, 0.7));
    const d1 = new THREE.DirectionalLight(0xffffff, 2.4); d1.position.set(4, 5, 6); scene.add(d1);
    const d2 = new THREE.DirectionalLight(0x6fa0ff, 0.8); d2.position.set(-5, -2, -4); scene.add(d2);
    const { group, radius } = buildCraft(design);
    scene.add(group);
    const camera = new THREE.PerspectiveCamera(40, w() / h(), 0.01, 500);
    const dist = radius * 2.1 + 0.3;
    camera.position.set(dist * 0.8, dist * 0.55, dist * 0.9);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.autoRotate = true; controls.autoRotateSpeed = 1.1; controls.enablePan = false;
    controls.minDistance = radius * 0.6; controls.maxDistance = radius * 6;
    let raf = 0;
    const loop = () => { raf = requestAnimationFrame(loop); controls.update(); renderer.render(scene, camera); };
    loop();
    const ro = new ResizeObserver(() => { renderer.setSize(w(), h()); camera.aspect = w() / h(); camera.updateProjectionMatrix(); });
    ro.observe(el);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); disposeGroup(scene); renderer.dispose(); if (renderer.domElement.parentElement === el) el.removeChild(renderer.domElement); };
  }, [key]);
  return (
    <div className={`viewport ${className ?? ''}`} ref={host} style={{ height: '100%', minHeight: 280 }}>
      <div className="overlay">
        <span className="pill amber">{Math.round(ev.mass.cbeDryKg)} kg dry</span>
        <span className="pill cyan">{Math.round(ev.power.bolW)} W array</span>
      </div>
      <div className="br">Live model of your design · drag to rotate</div>
    </div>
  );
}
