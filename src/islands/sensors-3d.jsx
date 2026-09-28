// sensors-3d.jsx — Three.js illustrations of other sensors (SAR, hyperspectral, EEG).
//   <sar-3d>  satellite pass over terrain, date 1 vs date 2, new building detected
//   <hsi-3d>  hyperspectral cube: slices spread apart, a pixel becomes a spectrum
//   <eeg-3d>  head with electrodes; live traces follow local brain activity

import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { setupRenderer, getPalette } from './three/scene.js';
import { useSlideActive } from './ai-talk.jsx';
import { tr } from '../runtime/i18n.js';

const ease = t => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = t => Math.max(0, Math.min(1, t));
const mixC = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t);

function Scene3D({ build }) {
  const ref = useRef(null);
  const canvasRef = useRef(null);
  const labelRef = useRef(null);
  const { active, n } = useSlideActive(ref);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    const W = canvas.parentElement.clientWidth || 1100, H = canvas.parentElement.clientHeight || 760;
    const pal = getPalette();
    const renderer = setupRenderer(canvas);
    renderer.setSize(W, H, false);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, W / H, 0.1, 60);
    scene.add(new THREE.AmbientLight(0xffffff, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(3, 6, 5); scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.5); fill.position.set(-4, 2, -3); scene.add(fill);

    const labels = [];
    const addLabel = (pos, text, { accent = false, color, fixed, big = false } = {}) => {
      const el = document.createElement('div');
      el.textContent = text;
      const c = color || (accent ? 'var(--accent)' : 'var(--ink-2)');
      el.style.cssText = `position:absolute;left:0;top:0;font-family:var(--mono);font-size:${big ? 30 : 22}px;font-weight:600;white-space:nowrap;padding:3px 10px;background:var(--bg);border:1px solid ${accent || color ? c : 'var(--rule)'};color:${c};transition:opacity 400ms;`;
      labelRef.current.appendChild(el);
      const item = { pos, el, show: true, fixed };
      labels.push(item);
      return item;
    };
    const v = new THREE.Vector3();
    const updateLabels = () => {
      for (const l of labels) {
        l.el.style.opacity = l.show ? '1' : '0';
        if (l.fixed) { l.el.style.transform = `translate(${l.fixed[0]}px,${l.fixed[1]}px)`; continue; }
        v.copy(l.pos).project(camera);
        l.el.style.transform = `translate(-50%,-50%) translate(${(v.x + 1) / 2 * W}px,${(-v.y + 1) / 2 * H}px)`;
      }
    };

    const api = build({ scene, camera, pal, addLabel });
    let raf; const t0 = performance.now();
    const loop = (now) => {
      api.update((now - t0) / 1000);
      renderer.render(scene, camera);
      updateLabels();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      labels.forEach(l => l.el.remove());
      scene.traverse(o => { o.geometry?.dispose?.(); if (o.material) { o.material.map?.dispose?.(); o.material.dispose?.(); } });
      renderer.dispose();
    };
  }, [active, n]);

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      <div ref={labelRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }} />
    </div>
  );
}

// ── SAR ──────────────────────────────────────────────────────────────────────
function buildSar({ scene, camera, pal, addLabel }) {
  const hAt = (x, z) => 0.2 * Math.sin(x * 1.1) + 0.14 * Math.cos(z * 1.6 + x * 0.5) + 0.05 * Math.sin(x * 3.1 + z * 2.3);
  const geo = new THREE.PlaneGeometry(7, 4.4, 140, 88);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, hAt(p.getX(i), p.getZ(i)));
  geo.computeVertexNormals();
  scene.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: mixC(pal.bgNum, pal.ink2Num, 0.25), roughness: 1, flatShading: true })));
  scene.add(new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.PlaneGeometry(7, 4.4, 28, 18).rotateX(-Math.PI / 2)),
    new THREE.LineBasicMaterial({ color: pal.ink3Num, transparent: true, opacity: 0 })));

  const houseMat = new THREE.MeshStandardMaterial({ color: mixC(pal.bgNum, pal.inkNum, 0.5), roughness: 0.8 });
  [[-1.6, 0.5], [-1.2, 0.9], [-0.7, 0.35], [-1.9, -0.2], [0.4, 1.2], [2.3, -0.6]].forEach(([x, z]) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.28), houseMat);
    b.position.set(x, hAt(x, z) + 0.11, z); scene.add(b);
  });
  const NB = { x: 1.3, z: 0.35 };
  const newB = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.36, 0.42), houseMat);
  newB.position.set(NB.x, hAt(NB.x, NB.z) + 0.18, NB.z); scene.add(newB);
  const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.72, 0.56, 0.64)),
    new THREE.LineBasicMaterial({ color: pal.accentNum, transparent: true }));
  outline.position.copy(newB.position); scene.add(outline);

  const sat = new THREE.Group();
  sat.add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.5), new THREE.MeshStandardMaterial({ color: pal.inkNum, roughness: 0.4, metalness: 0.4 })));
  const panelMat = new THREE.MeshStandardMaterial({ color: pal.tangent, roughness: 0.3, metalness: 0.5 });
  [-0.75, 0.75].forEach(x => { const pn = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.02, 0.34), panelMat); pn.position.x = x; sat.add(pn); });
  const dish = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.2), new THREE.MeshStandardMaterial({ color: pal.ink2Num }));
  dish.position.set(0, -0.2, 0.2); dish.rotation.x = -0.6; sat.add(dish);
  scene.add(sat);

  const beamGeo = new THREE.CylinderGeometry(0.02, 0.5, 1, 40, 1, true); beamGeo.translate(0, -0.5, 0);
  const beamMat = new THREE.MeshBasicMaterial({ color: pal.accentNum, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
  const beam = new THREE.Mesh(beamGeo, beamMat); scene.add(beam);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.52, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: pal.accentNum, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
  scene.add(ring);

  const lDate = addLabel(null, '', { big: true, fixed: [24, 20] });
  addLabel(new THREE.Vector3(-2.2, 3.9, -2.2), tr({ en: 'radar satellite', fr: 'satellite radar' }));
  const lChange = addLabel(new THREE.Vector3(NB.x, newB.position.y + 0.65, NB.z), tr({ en: 'change detected', fr: 'changement détecté' }), { accent: true });

  const down = new THREE.Vector3(0, -1, 0), d = new THREE.Vector3(), g = new THREE.Vector3();
  const PASS = 5, GAP = 1.2, CYCLE = 2 * (PASS + GAP) + 2.5;
  return {
    update(t) {
      const c = t % CYCLE;
      const second = c >= PASS + GAP;
      const local = second ? c - (PASS + GAP) : c;
      const pr = clamp01(local / PASS);
      const sx = -3.6 + pr * 7.2;
      sat.position.set(sx, 3.5, -2.4);
      sat.rotation.z = Math.sin(t * 0.8) * 0.04;
      const passing = local < PASS;
      beam.visible = ring.visible = passing;
      g.set(sx + 0.2, hAt(sx + 0.2, 0.35) + 0.02, 0.35);
      d.subVectors(g, sat.position);
      beam.position.copy(sat.position); beam.scale.set(1, d.length(), 1);
      beam.quaternion.setFromUnitVectors(down, d.clone().normalize());
      ring.position.copy(g);
      newB.visible = second;
      const detected = second && (local >= PASS || g.x > NB.x + 0.1);
      outline.visible = detected;
      outline.material.opacity = 0.6 + 0.4 * Math.sin(t * 6);
      lChange.show = detected;
      lDate.el.textContent = second ? tr({ en: 'Date 2', fr: 'Date 2' }) : tr({ en: 'Date 1', fr: 'Date 1' });
      lDate.el.style.color = second ? 'var(--accent)' : 'var(--ink-2)';
      const o = Math.sin(t / 7) * 0.25;
      camera.position.set(Math.sin(o) * 7.4, 4.2, Math.cos(o) * 7.4);
      camera.lookAt(0, 0.9, 0);
    },
  };
}
export const Sar3d = () => <Scene3D build={buildSar} />;

// ── Hyperspectral ────────────────────────────────────────────────────────────
const gauss = (x, m, s) => Math.exp(-((x - m) ** 2) / (2 * s * s));
const SPECTRA = {
  soil: b => 0.18 + 0.38 * b,
  veg: b => 0.07 + 0.1 * gauss(b, 0.28, 0.05) + 0.72 / (1 + Math.exp(-(b - 0.5) * 28)),
  plastic: b => 0.5 + 0.3 * gauss(b, 0.3, 0.1) - 0.32 * gauss(b, 0.78, 0.06),
};
function regionAt(u, v) {
  if (u > 0.12 && u < 0.46 && v > 0.16 && v < 0.5) return 'plastic';
  if ((u - 0.68) ** 2 + (v - 0.64) ** 2 < 0.055) return 'veg';
  if (Math.abs(u - v * 0.35 - 0.05) < 0.04) return 'plastic';
  return 'soil';
}
function bandColor(b, val) {
  const l = 12 + val * 66;
  if (b < 0.55) return `hsl(${270 - (b / 0.55) * 270},${55}%,${l}%)`;
  return `hsl(0,${Math.round(30 * (1 - (b - 0.55) / 0.45))}%,${l}%)`;
}
function buildHsi({ scene, camera, pal, addLabel }) {
  const NB = 18, S = 40, SIZE = 2.4;
  const A = { u: 0.3, v: 0.32, key: 'plastic', color: pal.accentNum, css: 'var(--accent)' };
  const B = { u: 0.7, v: 0.66, key: 'veg', color: pal.q, css: '#' + pal.q.toString(16).padStart(6, '0') };
  const slices = [];
  for (let i = 0; i < NB; i++) {
    const b = i / (NB - 1);
    const cv = document.createElement('canvas'); cv.width = cv.height = S;
    const ctx = cv.getContext('2d');
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = x / S, vv = y / S;
      const val = SPECTRA[regionAt(u, vv)](b) + 0.04 * Math.sin(x * 1.7 + y * 2.3 + i);
      ctx.fillStyle = bandColor(b, Math.max(0, Math.min(1, val)));
      ctx.fillRect(x, y, 1, 1);
    }
    const tex = new THREE.CanvasTexture(cv); tex.magFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.93, side: THREE.DoubleSide, depthWrite: false }));
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(SIZE, SIZE).rotateX(-Math.PI / 2)),
      new THREE.LineBasicMaterial({ color: pal.ink3Num, transparent: true, opacity: 0.5 }));
    m.renderOrder = i; scene.add(m); scene.add(e);
    slices.push({ m, e, b });
  }
  const toXZ = (P) => [(P.u - 0.5) * SIZE, (P.v - 0.5) * SIZE];
  const mkCol = (P) => {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1, 0.07), new THREE.MeshBasicMaterial({ color: P.color, transparent: true }));
    col.geometry.translate(0, 0.5, 0); const [x, z] = toXZ(P); col.position.set(x, 0, z); col.renderOrder = 100; scene.add(col);
    const curve = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: P.color, transparent: true }));
    curve.renderOrder = 101; scene.add(curve);
    return { P, col, curve };
  };
  const cols = [mkCol(A), mkCol(B)];
  const CX = SIZE / 2 + 0.5;
  const axis = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: pal.ink3Num }));
  scene.add(axis);
  const lWave = addLabel(new THREE.Vector3(), tr({ en: 'wavelength', fr: 'longueur d’onde' }));
  const lA = addLabel(new THREE.Vector3(), tr({ en: 'plastic roof', fr: 'toit en plastique' }), { color: A.css });
  const lB = addLabel(new THREE.Vector3(), tr({ en: 'vegetation', fr: 'végétation' }), { color: B.css });
  const lTop = addLabel(new THREE.Vector3(), tr({ en: 'one pixel = a full spectrum', fr: 'un pixel = un spectre complet' }), { accent: true });

  const CYCLE = 13;
  return {
    update(t) {
      const c = t % CYCLE;
      const ex = c < 1.5 ? 0 : c < 3.5 ? ease((c - 1.5) / 2) : c < 11 ? 1 : 1 - ease((c - 11) / 1.8);
      const gap = 0.04 + 0.1 * ex;
      slices.forEach((s, i) => { s.m.position.y = s.e.position.y = i * gap; });
      const top = (NB - 1) * gap;
      axis.geometry.setFromPoints([new THREE.Vector3(CX, 0, SIZE / 2), new THREE.Vector3(CX, top + 0.2, SIZE / 2)]);
      lWave.pos.set(CX, top + 0.45, SIZE / 2);
      cols.forEach((k, j) => {
        const p = clamp01((c - 4 - j * 1.8) / 1.8) * ex;
        k.col.scale.y = Math.max(0.001, top * ex + 0.02);
        k.col.material.opacity = ex;
        const pts = [];
        const nPts = Math.max(2, Math.round(p * 60));
        for (let q = 0; q < nPts; q++) {
          const b = (q / 59);
          pts.push(new THREE.Vector3(CX + 0.1 + SPECTRA[k.P.key](b) * 1.5, b * top, SIZE / 2));
        }
        k.curve.geometry.dispose(); k.curve.geometry = new THREE.BufferGeometry().setFromPoints(pts);
        k.curve.visible = p > 0.01; k.curve.material.opacity = ex;
        const end = pts[pts.length - 1];
        (j === 0 ? lA : lB).pos.set(end.x + 0.55, end.y + 0.12, end.z);
        (j === 0 ? lA : lB).show = p > 0.95;
      });
      lTop.pos.set(-0.2, top + 0.55, 0); lTop.show = ex > 0.9 && c > 4;
      const o = Math.sin(t / 8) * 0.2;
      camera.position.set(3.3 + Math.sin(o) * 2, 3.8, 6.4);
      camera.lookAt(0.8, 0.8, 0);
    },
  };
}
export const Hsi3d = () => <Scene3D build={buildHsi} />;

// ── EEG ──────────────────────────────────────────────────────────────────────
const ELECTRODES = [
  ['Fp1', -20, 80], ['Fp2', 20, 80], ['F7', -55, 78], ['F3', -35, 50], ['Fz', 0, 42], ['F4', 35, 50], ['F8', 55, 78],
  ['T7', -90, 82], ['C3', -90, 42], ['Cz', 0, 0], ['C4', 90, 42], ['T8', 90, 82],
  ['P7', -125, 78], ['P3', -145, 50], ['Pz', 180, 42], ['P4', 145, 50], ['P8', 125, 78], ['O1', -160, 80], ['O2', 160, 80],
];
const HEAD = new THREE.Vector3(0.95, 1.05, 1.15);
function scalp(az, polar, k = 1) {
  const a = az * Math.PI / 180, p = polar * Math.PI / 180;
  return new THREE.Vector3(Math.sin(p) * Math.sin(a) * HEAD.x * k, Math.cos(p) * HEAD.y * k, Math.sin(p) * Math.cos(a) * HEAD.z * k);
}
function buildEeg({ scene, camera, pal, addLabel }) {
  const head = new THREE.Group(); head.position.set(-1.4, 0, 0); scene.add(head);
  const skin = new THREE.MeshStandardMaterial({ color: mixC(pal.bgNum, pal.ink2Num, 0.18), roughness: 0.85 });
  const skull = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), skin); skull.scale.copy(HEAD); head.add(skull);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.32, 24), skin); nose.rotation.x = Math.PI / 2; nose.position.set(0, 0.05, 1.2); head.add(nose);
  [-1, 1].forEach(s => { const ear = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 16), skin); ear.scale.set(0.4, 1, 0.7); ear.position.set(s * 0.95, 0, 0); head.add(ear); });

  const up = new THREE.Vector3(0, 1, 0);
  const inkC = new THREE.Color(pal.ink3Num), accC = new THREE.Color(pal.accentNum);
  const els = ELECTRODES.map(([name, az, polar]) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 20), new THREE.MeshStandardMaterial({ color: inkC.clone(), roughness: 0.5 }));
    const pos = scalp(az, polar, 1.01);
    m.position.copy(pos); m.quaternion.setFromUnitVectors(up, pos.clone().normalize()); head.add(m);
    return { name, m, pos, act: 0 };
  });
  const byName = Object.fromEntries(els.map(e => [e.name, e]));
  const SOURCES = [scalp(-90, 42), scalp(90, 42)];

  const CH = ['Fz', 'C3', 'C4', 'Pz'];
  const TX0 = 0.6, TX1 = 3.8, NP = 160;
  const traces = CH.map((name, i) => {
    const y = 1.1 - i * 0.72;
    const line = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: pal.inkNum }));
    const link = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: pal.ink3Num, dashSize: 0.05, gapSize: 0.05, transparent: true, opacity: 0.6 }));
    scene.add(line); scene.add(link);
    const lab = addLabel(new THREE.Vector3(TX0 - 0.05, y + 0.28, 0), name);
    return { name, y, line, link, lab, i };
  });
  const lScalp = addLabel(new THREE.Vector3(-1.4, 1.55, 0), tr({ en: 'electrodes on the scalp', fr: 'électrodes sur le cuir chevelu' }));
  const lSide = addLabel(null, '', { accent: true, fixed: [24, 20] });
  const w = new THREE.Vector3();

  return {
    update(t) {
      const side = Math.floor(t / 4) % 2;
      const src = SOURCES[side];
      lSide.el.textContent = side === 0
        ? tr({ en: 'activity: left motor area', fr: 'activité : zone motrice gauche' })
        : tr({ en: 'activity: right motor area', fr: 'activité : zone motrice droite' });
      head.rotation.y = Math.sin(t / 5) * 0.5 + 0.35;
      for (const e of els) {
        const target = Math.exp(-e.pos.distanceToSquared(src) / 0.28);
        e.act += (target - e.act) * 0.08;
        const pulse = e.act * (0.7 + 0.3 * Math.sin(t * 9));
        e.m.material.color.copy(inkC).lerp(accC, pulse);
      }
      for (const tr_ of traces) {
        const a = byName[tr_.name].act;
        const pts = [];
        for (let k = 0; k < NP; k++) {
          const x = TX0 + (k / (NP - 1)) * (TX1 - TX0);
          const s = t * 2.2 - k * 0.045;
          const base = 0.05 * Math.sin(s * 7 + tr_.i) + 0.035 * Math.sin(s * 17.3 + tr_.i * 2) + 0.02 * Math.sin(s * 31.1);
          const burst = a * 0.24 * Math.sin(s * 11) * (0.6 + 0.4 * Math.sin(s * 1.3));
          pts.push(new THREE.Vector3(x, tr_.y + base + burst, 0));
        }
        tr_.line.geometry.dispose(); tr_.line.geometry = new THREE.BufferGeometry().setFromPoints(pts);
        tr_.line.material.color.copy(new THREE.Color(pal.inkNum)).lerp(accC, Math.min(1, a * 1.3));
        byName[tr_.name].m.getWorldPosition(w);
        tr_.link.geometry.dispose(); tr_.link.geometry = new THREE.BufferGeometry().setFromPoints([w.clone(), new THREE.Vector3(TX0 - 0.05, tr_.y, 0)]);
        tr_.link.computeLineDistances();
      }
      camera.position.set(0.8, 1.5, 8.2);
      camera.lookAt(0.8, 0.1, 0);
    },
  };
}
export const Eeg3d = () => <Scene3D build={buildEeg} />;
