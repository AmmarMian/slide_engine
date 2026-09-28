// ai-talk.jsx — islands for the "general vs specific / generative vs not" talk.
//   <word-morph from="AI" to="LEARNING">   flicker-resolves one word into another on slide entry
//   <model-zoom>                           wide point cloud (general model) contracting to one cluster (specific model)
//   <ai-quadrant-mini here="tl|tr|bl|br">  small 2×2 "you are here" marker
//   <gpr-3d>                               Three.js soil block, radar sweep, B-scan drawn on the front face

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { TokenGrid } from './token-grid.jsx';
import { rng } from './shared.js';
import { setupRenderer, getPalette } from './three/scene.js';
import { tr } from '../runtime/i18n.js';

// Tracks whether the island's slide is active; `n` increments on each entry.
export function useSlideActive(ref) {
  const [state, setState] = useState({ active: false, n: 0 });
  useEffect(() => {
    const stage = document.querySelector('deck-stage');
    if (!stage) { setState({ active: true, n: 1 }); return; }
    const check = (slide) => {
      const on = !!(slide && ref.current && slide.contains(ref.current));
      setState(s => (on === s.active ? s : { active: on, n: on ? s.n + 1 : s.n }));
    };
    const onChange = (e) => check(e.detail.slide);
    stage.addEventListener('slidechange', onChange);
    check(stage.querySelector('[data-deck-active]'));
    return () => stage.removeEventListener('slidechange', onChange);
  }, []);
  return state;
}

// ── word-morph ───────────────────────────────────────────────────────────────
export function WordMorph({ from = 'AI', to = 'LEARNING', cell = 96, hold = 1400 }) {
  const ref = useRef(null);
  const { active, n } = useSlideActive(ref);
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (!active) return;
    setPhase(0);
    const t = setTimeout(() => setPhase(1), hold);
    return () => clearTimeout(t);
  }, [active, n]);
  const word = phase === 0 ? from : to;
  const pattern = [word.toUpperCase().split('').map(c => (c === ' ' ? null : c))];
  return (
    <div ref={ref} style={{ display: 'flex', alignItems: 'center', minHeight: cell }}>
      <TokenGrid key={`${n}-${phase}`} pattern={pattern} cell={cell} gap={4}
        duration={phase === 0 ? 700 : 1300} flickerHz={20}
        ink={phase === 0 ? 'var(--ink)' : 'var(--accent)'} />
    </div>
  );
}

// ── model-zoom ───────────────────────────────────────────────────────────────
const DOMAINS_EN = ['text', 'code', 'images', 'speech', 'video', 'maps', 'music', 'tables', 'chemistry', 'radar'];
const DOMAINS_FR = ['texte', 'code', 'images', 'parole', 'vidéo', 'cartes', 'musique', 'tableaux', 'chimie', 'radar'];
const TARGET = 9;

export function ModelZoom({ width = 1100, height = 640 }) {
  const ref = useRef(null);
  const canvasRef = useRef(null);
  const { active, n } = useSlideActive(ref);
  const [caption, setCaption] = useState(0);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr; canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const cs = getComputedStyle(document.documentElement);
    const ink = cs.getPropertyValue('--ink-3').trim() || '#777';
    const ink1 = cs.getPropertyValue('--ink').trim() || '#111';
    const accent = cs.getPropertyValue('--accent').trim() || '#d23b1c';
    const mono = cs.getPropertyValue('--mono').trim() || 'monospace';

    const DOMAINS = tr({ en: DOMAINS_EN, fr: DOMAINS_FR });
    const r = rng(7);
    const centers = DOMAINS.map((_, i) => {
      const a = (i / DOMAINS.length) * Math.PI * 2 + 0.3;
      const rad = 0.30 + r() * 0.08;
      return { x: width / 2 + Math.cos(a) * width * rad, y: height / 2 + Math.sin(a) * height * (rad + 0.06) };
    });
    const zoomC = { x: width * 0.5, y: height * 0.5 };
    const pts = [];
    for (let d = 0; d < DOMAINS.length; d++) {
      for (let k = 0; k < 70; k++) {
        const g = () => (r() + r() + r() - 1.5);
        pts.push({ d, x: centers[d].x + g() * 70, y: centers[d].y + g() * 50,
          zx: zoomC.x + g() * 150, zy: zoomC.y + g() * 110, ph: r() * 6.28 });
      }
    }
    const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const CYCLE = 9000;
    let raf; const t0 = performance.now(); let lastCap = -1;
    const draw = (now) => {
      const t = (now - t0) % CYCLE;
      // 0–2.5s general, 2.5–4.5 contract, 4.5–7.5 hold, 7.5–9 expand
      let z = 0;
      if (t > 2500 && t <= 4500) z = ease((t - 2500) / 2000);
      else if (t > 4500 && t <= 7500) z = 1;
      else if (t > 7500) z = 1 - ease((t - 7500) / 1500);
      const cap = z > 0.5 ? 1 : 0;
      if (cap !== lastCap) { lastCap = cap; setCaption(cap); }
      ctx.clearRect(0, 0, width, height);
      for (const p of pts) {
        const on = p.d === TARGET;
        const wob = Math.sin(now / 900 + p.ph) * 3;
        let x, y, a, rad;
        if (on) { x = p.x + (p.zx - p.x) * z; y = p.y + (p.zy - p.y) * z + wob; a = 0.9; rad = 4 + z * 3; }
        else { x = p.x + (zoomC.x - p.x) * z * 0.15; y = p.y + wob; a = 0.55 * (1 - z) + 0.06; rad = 4; }
        ctx.globalAlpha = a;
        ctx.fillStyle = on ? accent : ink;
        ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.font = `500 22px ${mono}`; ctx.textAlign = 'center';
      DOMAINS.forEach((name, i) => {
        const on = i === TARGET;
        const c = on ? { x: centers[i].x + (zoomC.x - centers[i].x) * z, y: centers[i].y + (zoomC.y - 150 - centers[i].y) * z } : centers[i];
        ctx.globalAlpha = on ? 1 : 1 - z * 0.85;
        ctx.fillStyle = on ? accent : ink1;
        ctx.fillText(name, c.x, c.y - 68);
      });
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [active, n, width, height]);

  const caps = tr({ en: ['General model: a little of everything', 'Specific model: one problem, done well'],
    fr: ['Modèle généraliste : un peu de tout', 'Modèle spécialisé : un problème, bien traité'] });
  return (
    <div ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center' }}>
      <canvas ref={canvasRef} style={{ width, height, display: 'block' }} />
      <div className="label" style={{ color: caption ? 'var(--accent)' : 'var(--ink-2)', transition: 'color 300ms' }}>{caps[caption]}</div>
    </div>
  );
}

// ── ai-quadrant-mini ─────────────────────────────────────────────────────────
export function AiQuadrantMini({ here = 'br', size = 92 }) {
  const cells = ['tl', 'tr', 'bl', 'br'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, width: size, height: size * 0.7 }}>
        {cells.map(c => (
          <div key={c} style={{ background: c === here ? 'var(--accent)' : 'transparent', border: `1.5px solid ${c === here ? 'var(--accent)' : 'var(--rule)'}` }} />
        ))}
      </div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 18, lineHeight: 1.3, color: 'var(--ink-3)' }}>
        <div>{here[1] === 'l' ? tr({ en: 'general', fr: 'généraliste' }) : tr({ en: 'specific', fr: 'spécialisé' })}</div>
        <div>{here[0] === 't' ? tr({ en: 'generative', fr: 'génératif' }) : tr({ en: 'non-generative', fr: 'non génératif' })}</div>
      </div>
    </div>
  );
}

// ── gpr-3d ───────────────────────────────────────────────────────────────────
const BW = 4.4, BH = 2.0, BD = 2.6;          // soil block (x, y, z); ground surface at y = 0
const PIPE = { x: 0.5, y: -1.05, r: 0.13 };  // pipe runs along z
const COLS = 120, ROWS = 160;                // B-scan texture resolution
const AX0 = -BW / 2 + 0.3, AX1 = BW / 2 - 0.3;
const MAXD = Math.hypot(Math.max(AX1 - PIPE.x, PIPE.x - AX0), PIPE.y);

export function Gpr3d() {
  const ref = useRef(null);
  const canvasRef = useRef(null);
  const labelRef = useRef(null);
  const { active, n } = useSlideActive(ref);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    const wrap = canvas.parentElement;
    const W = wrap.clientWidth || 1500, H = wrap.clientHeight || 760;
    const pal = getPalette();
    const renderer = setupRenderer(canvas);
    renderer.setSize(W, H, false);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 50);
    const target = new THREE.Vector3(0, -0.75, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(3, 6, 5); scene.add(key);

    const mixHex = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t);
    // Soil layers
    const layers = [0.45, 0.6, 0.95];
    let y = 0;
    layers.forEach((h, i) => {
      const g = new THREE.BoxGeometry(BW, h, BD);
      const m = new THREE.MeshStandardMaterial({ color: mixHex(pal.bgNum, pal.ink2Num, 0.18 + i * 0.12),
        transparent: true, opacity: 0.30, roughness: 0.9, depthWrite: false });
      const mesh = new THREE.Mesh(g, m); mesh.position.set(0, y - h / 2, 0); scene.add(mesh);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(g),
        new THREE.LineBasicMaterial({ color: pal.ink3Num, transparent: true, opacity: 0.45 }));
      edges.position.copy(mesh.position); scene.add(edges);
      y -= h;
    });

    // Pipe
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(PIPE.r, PIPE.r, BD * 0.98, 40),
      new THREE.MeshStandardMaterial({ color: pal.accentNum, roughness: 0.4, metalness: 0.3, emissive: pal.accentNum, emissiveIntensity: 0.15 }));
    pipe.rotation.x = Math.PI / 2; pipe.position.set(PIPE.x, PIPE.y, 0); scene.add(pipe);

    // Antenna (sweeps along x on the front edge)
    const AZ = BD / 2 - 0.35;
    const antenna = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.34),
      new THREE.MeshStandardMaterial({ color: pal.inkNum, roughness: 0.5 }));
    body.position.y = 0.1; antenna.add(body);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 12),
      new THREE.MeshStandardMaterial({ color: pal.ink2Num }));
    handle.position.set(-0.28, 0.42, 0); handle.rotation.z = 0.8; antenna.add(handle);
    scene.add(antenna);

    // Wavefront (lower half-circle in the x-y plane at the antenna's z)
    const semi = [];
    for (let i = 0; i <= 64; i++) { const a = Math.PI + (i / 64) * Math.PI; semi.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0)); }
    const waveMat = new THREE.LineBasicMaterial({ color: pal.accentNum, transparent: true, opacity: 0.8 });
    const wave = new THREE.Line(new THREE.BufferGeometry().setFromPoints(semi), waveMat);
    scene.add(wave);

    // Ray antenna → pipe → antenna
    const rayMat = new THREE.LineDashedMaterial({ color: pal.accentNum, dashSize: 0.06, gapSize: 0.05, transparent: true, opacity: 0.8 });
    const ray = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), rayMat);
    scene.add(ray);

    // B-scan on the front face
    const tex = document.createElement('canvas'); tex.width = COLS; tex.height = ROWS;
    const tctx = tex.getContext('2d');
    const texture = new THREE.CanvasTexture(tex);
    texture.magFilter = THREE.LinearFilter; texture.colorSpace = THREE.SRGBColorSpace;
    const front = new THREE.Mesh(new THREE.PlaneGeometry(BW, BH),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }));
    front.position.set(0, -BH / 2, BD / 2 + 0.002); scene.add(front);
    const accentRGB = new THREE.Color(pal.accentNum), inkRGB = new THREE.Color(pal.inkNum);
    const clearTex = () => { tctx.clearRect(0, 0, COLS, ROWS); texture.needsUpdate = true; };
    const drawCol = (c) => {
      const ax = AX0 + (c / (COLS - 1)) * (AX1 - AX0);
      const row0 = (Math.hypot(ax - PIPE.x, PIPE.y) / MAXD) * ROWS * 0.88;
      const x = Math.round(((ax + BW / 2) / BW) * COLS);
      for (let s = 0; s < ROWS; s++) {
        const surf = Math.exp(-((s - 3) ** 2) / 3) * Math.cos((s - 3) * 1.2);
        const dt = s - row0;
        const v = surf * 0.8 + Math.exp(-(dt * dt) / 6) * Math.cos(dt * 1.1);
        if (Math.abs(v) < 0.05) continue;
        const col = v > 0 ? accentRGB : inkRGB;
        tctx.fillStyle = `rgba(${col.r * 255 | 0},${col.g * 255 | 0},${col.b * 255 | 0},${Math.min(1, Math.abs(v))})`;
        tctx.fillRect(x, s, 2, 1);
      }
      texture.needsUpdate = true;
    };

    // Labels projected from 3D
    const labels = [];
    const addLabel = (pos, text, accent) => {
      const el = document.createElement('div');
      el.textContent = text;
      el.style.cssText = `position:absolute;left:0;top:0;font-family:var(--mono);font-size:22px;font-weight:600;white-space:nowrap;padding:3px 10px;background:var(--bg);border:1px solid ${accent ? 'var(--accent)' : 'var(--rule)'};color:${accent ? 'var(--accent)' : 'var(--ink-2)'};transition:opacity 400ms;`;
      labelRef.current.appendChild(el);
      const item = { pos, el, show: true }; labels.push(item); return item;
    };
    const lAnt = addLabel(new THREE.Vector3(), tr({ en: 'radar antenna', fr: 'antenne radar' }));
    addLabel(new THREE.Vector3(PIPE.x + 0.1, PIPE.y, -BD / 2 + 0.2), tr({ en: 'buried pipe', fr: 'canalisation enfouie' }), true);
    const lHyp = addLabel(new THREE.Vector3(PIPE.x, -BH * 0.62, BD / 2), tr({ en: 'the pipe appears as a hyperbola', fr: 'la canalisation apparaît comme une hyperbole' }), true);
    const v = new THREE.Vector3();
    const updateLabels = () => {
      for (const l of labels) {
        v.copy(l.pos).project(camera);
        l.el.style.transform = `translate(-50%,-50%) translate(${(v.x + 1) / 2 * W}px,${(-v.y + 1) / 2 * H}px)`;
        l.el.style.opacity = l.show ? '1' : '0';
      }
    };

    const SWEEP = 6500, HOLD = 2500;
    let raf, drawn = -1; const t0 = performance.now();
    const loop = (now) => {
      const el = now - t0;
      const cyc = el % (SWEEP + HOLD);
      if (cyc < 30 && drawn > 0) { drawn = -1; clearTex(); }
      const p = Math.min(1, cyc / SWEEP);
      const ax = AX0 + p * (AX1 - AX0);
      const c = Math.floor(p * (COLS - 1));
      while (drawn < c) drawCol(++drawn);
      antenna.position.set(ax, 0, AZ);
      lAnt.pos.set(ax, 0.62, AZ);
      lHyp.show = p >= 1;
      const sweeping = p < 1;
      const wr = ((now / 700) % 1) * 1.5;
      wave.visible = sweeping; wave.position.set(ax, 0, AZ); wave.scale.setScalar(Math.max(0.01, wr));
      waveMat.opacity = 0.8 * (1 - wr / 1.5);
      ray.visible = sweeping;
      ray.geometry.setFromPoints([new THREE.Vector3(ax, 0, AZ), new THREE.Vector3(PIPE.x, PIPE.y + PIPE.r, AZ)]);
      ray.computeLineDistances();
      const orbit = Math.sin(el / 6000) * 0.35;
      camera.position.set(Math.sin(0.55 + orbit) * 8.2, 3.3, Math.cos(0.55 + orbit) * 8.2);
      camera.lookAt(target);
      renderer.render(scene, camera);
      updateLabels();
      raf = requestAnimationFrame(loop);
    };
    clearTex();
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      labels.forEach(l => l.el.remove());
      renderer.dispose();
      scene.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
      texture.dispose();
    };
  }, [active, n]);

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      <div ref={labelRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }} />
    </div>
  );
}
