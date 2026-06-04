// riemann-descent.jsx — Riemannian gradient descent on S² (interactive island).
// Heatmap sphere on the left, control rail on the right.
// Ported from decks/popills_2026/riemannian/scripts/descent.js.

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import katex from 'katex';

import * as M from './three/math.js';
import {
  getPalette, setupRenderer, setupLights, buildLatLonGrid,
  buildArrow, buildPolyline, buildDot, buildTangentPlane, pickSphere,
} from './three/scene.js';

const RAIL_W = 560;

// ── Cost function data ────────────────────────────────────────────────────────

const RAYLEIGH_A = [
  [1.8, 0.4, 0.3],
  [0.4, 0.2, -0.2],
  [0.3, -0.2, -1.4],
];

const DIST_T = M.fromLatLon(THREE.MathUtils.degToRad(-25), THREE.MathUtils.degToRad(155));

const FRECHET_TS = [
  M.fromLatLon(THREE.MathUtils.degToRad(35), THREE.MathUtils.degToRad(40)),
  M.fromLatLon(THREE.MathUtils.degToRad(-15), THREE.MathUtils.degToRad(160)),
  M.fromLatLon(THREE.MathUtils.degToRad(0), THREE.MathUtils.degToRad(-90)),
  M.fromLatLon(THREE.MathUtils.degToRad(55), THREE.MathUtils.degToRad(-30)),
];

const COST_RANGES = {
  rayleigh: { min: -1.7, max: 2.0 },
  distance: { min: 0, max: 0.5 * Math.PI * Math.PI },
  frechet: { min: 0.0, max: 1.4 },
};

const X0_BY_COST = {
  rayleigh: M.fromLatLon(THREE.MathUtils.degToRad(45), THREE.MathUtils.degToRad(-80)),
  distance: M.fromLatLon(THREE.MathUtils.degToRad(45), THREE.MathUtils.degToRad(-15)),
  frechet: M.fromLatLon(THREE.MathUtils.degToRad(-60), THREE.MathUtils.degToRad(50)),
};

// ── Helper: mount developer-authored HTML without innerHTML ───────────────────

function mountHTML(el, html) {
  if (el) el.replaceChildren(document.createRange().createContextualFragment(html));
}

// ── Main island ───────────────────────────────────────────────────────────────

export function RiemannDescent() {
  const hostRef = useRef(null);
  const engineRef = useRef(null);

  // React state drives button active-classes
  const [ui, setUi] = useState({ cost: 'rayleigh', playing: false, alpha: 0.18 });

  // DOM refs for imperatively-updated elements
  const iterRef = useRef(null);
  const fNowRef = useRef(null);
  const fGapRef = useRef(null);
  const plotRef = useRef(null);
  const costNameRef = useRef(null);
  const costExprRef = useRef(null);
  const updateFormulaRef = useRef(null);

  useEffect(() => {
    if (!updateFormulaRef.current) return;
    try {
      katex.render(
        String.raw`x_{k+1} = \operatorname{Retr}_{x_k}\!\bigl(-\,\alpha\operatorname{grad}_{x_k}\!f\bigr)`,
        updateFormulaRef.current,
        { throwOnError: false, displayMode: true },
      );
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const canvas = host.querySelector('.rd-canvas');
    const labelLayer = host.querySelector('.rd-labels');
    const noMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let W = host.clientWidth || 1920;
    let H = host.clientHeight || 900;
    let canvasW = Math.max(100, W - RAIL_W);
    let canvasH = H;

    // ── Three.js setup ─────────────────────────────────────────────────────
    const renderer = setupRenderer(canvas);
    const labelRenderer = new CSS2DRenderer({ element: labelLayer });
    renderer.setSize(canvasW, canvasH);
    labelRenderer.setSize(canvasW, canvasH);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, canvasW / canvasH, 0.05, 50);
    camera.position.set(3.5, 2.1, 3.5);

    let palette = getPalette();
    setupLights(scene, palette);

    // Heatmap shader sphere
    const cssColor = (v, fb) => new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue(v).trim() || fb);

    const heatMat = new THREE.ShaderMaterial({
      uniforms: {
        uCostMode: { value: 0 },
        uA: { value: new THREE.Matrix3().set(...RAYLEIGH_A.flat()) },
        uTarget: { value: DIST_T.clone() },
        uTargets: { value: [...FRECHET_TS.map(v => v.clone()), ...Array(4).fill(new THREE.Vector3(1, 0, 0))] },
        uNumTargets: { value: FRECHET_TS.length },
        uCMin: { value: COST_RANGES.rayleigh.min },
        uCMax: { value: COST_RANGES.rayleigh.max },
        uOpacity: { value: 1.0 },
        uAccent: { value: cssColor('--accent', '#d23b1c') },
        uBg: { value: cssColor('--bg', '#f0f0f2') },
        uTint: { value: cssColor('--tint', '#dddde8') },
        uInk3: { value: cssColor('--ink-3', '#666880') },
        uLightDir: { value: new THREE.Vector3(3.5, 4.5, 5.5).normalize() },
        uAmbient: { value: 0.55 },
        uIsDark: { value: palette.isDark ? 1.0 : 0.0 },
      },
      vertexShader: /* glsl */`
        varying vec3 vWorld;
        varying vec3 vNormal;
        void main() {
          vec4 mw = modelMatrix * vec4(position, 1.0);
          vWorld = mw.xyz;
          vNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * mw;
        }
      `,
      fragmentShader: /* glsl */`
        precision highp float;
        varying vec3 vWorld;
        varying vec3 vNormal;
        uniform int   uCostMode;
        uniform mat3  uA;
        uniform vec3  uTarget;
        uniform vec3  uTargets[8];
        uniform int   uNumTargets;
        uniform float uCMin, uCMax, uOpacity;
        uniform vec3  uAccent, uBg, uTint, uInk3, uLightDir;
        uniform float uAmbient, uIsDark;

        vec3 ramp(float t) {
          t = clamp(pow(t, 0.85), 0.0, 1.0);
          vec3 c1 = mix(uAccent, uTint, 0.55);
          if (t < 0.5) return mix(uAccent, c1, t * 2.0);
          return mix(c1, uBg, (t - 0.5) * 2.0);
        }
        float cost(vec3 x) {
          if (uCostMode == 0) { vec3 Ax = uA * x; return dot(x, Ax); }
          if (uCostMode == 1) { float c = clamp(dot(x, uTarget),-1.,1.); float th=acos(c); return 0.5*th*th; }
          float s=0.; for(int i=0;i<8;i++){if(i>=uNumTargets)break; float c=clamp(dot(x,uTargets[i]),-1.,1.); float th=acos(c); s+=0.5*th*th;} return s/float(uNumTargets);
        }
        void main() {
          vec3 x = normalize(vWorld);
          float t = (cost(x) - uCMin) / max(1e-6, uCMax - uCMin);
          vec3 col = ramp(t);
          vec3 N = normalize(vNormal);
          float ndl = max(dot(N, normalize(uLightDir)), 0.0);
          float fres = pow(1.0 - max(dot(N, normalize(cameraPosition - vWorld)), 0.0), 3.0);
          vec3 lit = col * (uAmbient + (1.0 - uAmbient) * ndl);
          lit += mix(uInk3, uAccent, 0.4) * fres * (uIsDark > 0.5 ? 0.20 : 0.10);
          gl_FragColor = vec4(lit, uOpacity);
        }
      `,
      transparent: false,
    });

    const sphereBody = new THREE.Mesh(new THREE.SphereGeometry(1, 192, 144), heatMat);
    scene.add(sphereBody);

    let sphereGrid = buildLatLonGrid({ radius: 1.0005, palette });
    scene.add(sphereGrid);

    const eqMat = new THREE.LineBasicMaterial({ color: palette.inkNum, transparent: true, opacity: palette.equatorAlpha });
    const eqPts = [];
    for (let i = 0; i <= 256; i++) {
      const t = (i / 256) * Math.PI * 2;
      eqPts.push(new THREE.Vector3(Math.cos(t) * 1.002, 0, Math.sin(t) * 1.002));
    }
    const eqLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(eqPts), eqMat);
    scene.add(eqLine);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.65;
    controls.minDistance = 1.6;
    controls.maxDistance = 6;
    controls.enablePan = true;
    controls.panSpeed = 0.8;

    // CSS2D labels
    const labelObjs = [];
    const runtimeGroup = new THREE.Group();
    scene.add(runtimeGroup);

    function makeLabel(text, position, opts = {}) {
      const div = document.createElement('div');
      div.className = 'world-label';
      if (opts.accent) div.classList.add('accent');
      if (opts.tangent) div.classList.add('tangent-col');
      if (opts.geo) div.classList.add('geo-col');
      if (opts.target) div.classList.add('q-col');
      if (opts.small) div.classList.add('small');
      mountHTML(div, text);
      const obj = new CSS2DObject(div);
      obj.position.copy(position);
      scene.add(obj);
      const l = {
        obj,
        update(p) { obj.position.copy(p); },
        setVisible(v) { div.style.display = v ? '' : 'none'; },
        remove() { scene.remove(obj); div.remove(); },
      };
      labelObjs.push(l);
      return l;
    }

    // ── Gradient descent state ─────────────────────────────────────────────
    const state = {
      cost: 'rayleigh', alpha: 0.18, playing: false,
      iter: 0, maxIter: 80, history: [],
      x: X0_BY_COST.rayleigh.clone(),
    };

    const live = {
      xDot: null, euclidArrow: null, riemArrow: null, stepArrow: null,
      plane: null, retractLine: null, nextDot: null, trail: null,
      trailDots: new THREE.Group(), targetDots: new THREE.Group(),
      xLabel: null, nextLabel: null
    };

    runtimeGroup.add(live.trailDots);
    runtimeGroup.add(live.targetDots);

    function clearLive() {
      for (const k of ['xDot', 'euclidArrow', 'riemArrow', 'stepArrow', 'plane', 'retractLine', 'nextDot', 'trail']) {
        if (live[k]) { runtimeGroup.remove(live[k]); live[k] = null; }
      }
      runtimeGroup.remove(live.trailDots);
      runtimeGroup.remove(live.targetDots);
      live.trailDots = new THREE.Group();
      live.targetDots = new THREE.Group();
      runtimeGroup.add(live.trailDots);
      runtimeGroup.add(live.targetDots);
      for (const l of labelObjs.splice(0)) l.remove();
    }

    function buildLive() {
      clearLive();
      if (state.cost === 'distance') {
        live.targetDots.add(buildDot({ position: DIST_T, color: palette.q, radius: 0.026 }));
        makeLabel('t', DIST_T.clone().multiplyScalar(1.10), { target: true });
      } else if (state.cost === 'frechet') {
        for (let i = 0; i < FRECHET_TS.length; i++) {
          live.targetDots.add(buildDot({ position: FRECHET_TS[i], color: palette.q, radius: 0.022 }));
          makeLabel('t<sub>' + (i + 1) + '</sub>', FRECHET_TS[i].clone().multiplyScalar(1.10), { target: true, small: true });
        }
      }
      live.plane = buildTangentPlane({ p: state.x, radius: 0.75, color: palette.tangent, opacity: 0.10 });
      runtimeGroup.add(live.plane);

      live.xDot = buildDot({ position: state.x, color: palette.p, radius: 0.028 });
      runtimeGroup.add(live.xDot);
      live.xLabel = makeLabel('x<sub>k</sub>', state.x.clone().multiplyScalar(1.10), { accent: true });

      const arrowOpts = { origin: state.x, direction: new THREE.Vector3(0, 1, 0), length: 0, shaft: 0.010, head: 0.038, headLen: 0.08 };
      live.euclidArrow = buildArrow({ ...arrowOpts, color: palette.euclid });
      runtimeGroup.add(live.euclidArrow);
      live.riemArrow = buildArrow({ ...arrowOpts, color: palette.tangent });
      runtimeGroup.add(live.riemArrow);
      live.stepArrow = buildArrow({ ...arrowOpts, color: palette.retraction });
      runtimeGroup.add(live.stepArrow);

      live.retractLine = buildPolyline({ points: [state.x.clone(), state.x.clone()], color: palette.ink3Num, opacity: 0.5, dashed: true });
      runtimeGroup.add(live.retractLine);

      live.nextDot = buildDot({ position: state.x.clone(), color: palette.retraction, radius: 0.022 });
      runtimeGroup.add(live.nextDot);

      live.trail = buildPolyline({ points: [state.x.clone()], color: palette.trail, opacity: 0.9 });
      runtimeGroup.add(live.trail);
    }

    function evalCost(x) {
      if (state.cost === 'rayleigh') return M.rayleighValue(x, RAYLEIGH_A);
      if (state.cost === 'distance') return M.distSqValue(x, DIST_T);
      return M.frechetValue(x, FRECHET_TS);
    }
    function evalRiemGrad(x) {
      if (state.cost === 'rayleigh') return M.projectTangent(x, M.rayleighGrad(x, RAYLEIGH_A));
      if (state.cost === 'distance') return M.distSqGradRiem(x, DIST_T);
      return M.frechetGradRiem(x, FRECHET_TS);
    }
    function evalEucGrad(x) {
      if (state.cost === 'rayleigh') return M.rayleighGrad(x, RAYLEIGH_A);
      return new THREE.Vector3();
    }

    function updateLive() {
      const x = state.x;
      live.xDot.position.copy(x);
      live.plane.userData.update(x);
      live.xLabel.update(x.clone().multiplyScalar(1.10));

      const gE = evalEucGrad(x);
      const gR = evalRiemGrad(x);
      const v = gR.clone().multiplyScalar(-state.alpha);
      const xNext = M.retract(x, v);

      live.euclidArrow.visible = state.cost === 'rayleigh';
      if (state.cost === 'rayleigh') {
        live.euclidArrow.userData.update(x, gE, Math.min(0.85, gE.length() * 0.25));
      }
      const rLen = Math.min(0.85, gR.length() * 0.45);
      live.riemArrow.userData.update(x, gR, rLen);
      const sLen = Math.min(0.95, v.length());
      live.stepArrow.userData.update(x, v, sLen);
      live.retractLine.userData.update([x.clone().add(v), xNext.clone()]);
      live.nextDot.position.copy(xNext);

      const pts = state.history.map(h => h.x.clone());
      pts.push(x.clone());
      if (pts.length >= 2) {
        const dense = [pts[0].clone()];
        for (let i = 1; i < pts.length; i++) {
          const arc = M.geodesicArc(pts[i - 1], pts[i], 24);
          for (let j = 1; j < arc.length; j++) dense.push(arc[j]);
        }
        live.trail.userData.update(dense);
      }

      // refresh trail dots
      while (live.trailDots.children.length) {
        const c = live.trailDots.children.pop();
        c.geometry?.dispose(); c.material?.dispose();
      }
      for (const h of state.history) {
        const d = buildDot({ position: h.x, color: palette.trail, radius: 0.014 });
        d.material.transparent = true; d.material.opacity = 0.55;
        live.trailDots.add(d);
      }
    }

    function doStep() {
      if (state.iter >= state.maxIter) return;
      const x = state.x.clone();
      state.history.push({ x: x.clone(), f: evalCost(x) });
      const gR = evalRiemGrad(x);
      state.x.copy(M.retract(x, gR.clone().multiplyScalar(-state.alpha)));
      state.iter++;
      updateLive();
      updatePanel();
    }

    function resetRun() {
      state.iter = 0;
      state.history = [];
      state.x.copy(X0_BY_COST[state.cost]);
      buildLive();
      updateLive();
      updatePanel();
    }

    // ── Panel DOM updates ──────────────────────────────────────────────────
    function updatePanel() {
      if (iterRef.current) iterRef.current.textContent = String(state.iter).padStart(3, '0');
      if (fNowRef.current) fNowRef.current.textContent = evalCost(state.x).toFixed(4);
      if (fGapRef.current) fGapRef.current.textContent = state.history.length > 0
        ? `Δ = ${(evalCost(state.x) - state.history[0].f).toFixed(4)}` : '';
      drawPlot();
    }

    function renderFormulas() {
      let costForm;
      if (state.cost === 'rayleigh') {
        if (costNameRef.current) costNameRef.current.textContent = 'Quotient de Rayleigh';
        costForm = String.raw`f(x) = x^{\!\top}\! A\, x, \quad A = A^{\!\top}`;
      } else if (state.cost === 'distance') {
        if (costNameRef.current) costNameRef.current.textContent = 'Distance² à la cible';
        costForm = String.raw`f(x) = \tfrac{1}{2}\, d_{S^{2}}(x, t)^{2} = \tfrac{1}{2}\,\arccos\langle x, t\rangle^{2}`;
      } else {
        if (costNameRef.current) costNameRef.current.textContent = 'Moyenne de Fréchet';
        costForm = String.raw`f(x) = \tfrac{1}{2N}\sum_{i=1}^{N} d_{S^{2}}(x, t_{i})^{2}`;
      }
      try {
        if (costExprRef.current) katex.render(costForm, costExprRef.current, { throwOnError: false, displayMode: true });
      } catch { }
    }

    // ── 2D cost plot ───────────────────────────────────────────────────────
    function drawPlot() {
      const cvs = plotRef.current;
      if (!cvs) return;
      const cssW = cvs.clientWidth, cssH = cvs.clientHeight;
      const dpr = Math.min(window.devicePixelRatio, 2);
      cvs.width = cssW * dpr; cvs.height = cssH * dpr;
      const ctx = cvs.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const cs = getComputedStyle(document.documentElement);
      const axis = cs.getPropertyValue('--ink-3').trim() || '#666';
      const ink2 = cs.getPropertyValue('--ink-2').trim() || '#333';
      const acc = cs.getPropertyValue('--accent').trim() || '#d23b1c';
      const rule = cs.getPropertyValue('--rule-soft').trim() || 'rgba(0,0,0,.14)';

      const series = state.history.map((h, i) => ({ k: i, f: h.f }));
      series.push({ k: state.iter, f: evalCost(state.x) });
      let yMin = Infinity, yMax = -Infinity;
      for (const s of series) { yMin = Math.min(yMin, s.f); yMax = Math.max(yMax, s.f); }
      if (!isFinite(yMin)) { yMin = 0; yMax = 1; }
      if (yMax - yMin < 1e-6) yMax = yMin + 1;
      const yPad = (yMax - yMin) * 0.10; yMin -= yPad; yMax += yPad;
      const xMax = Math.max(state.maxIter, state.iter + 4);
      const pL = 38, pR = 14, pT = 12, pB = 24;
      const pW = cssW - pL - pR, pH = cssH - pT - pB;
      const X = k => pL + (k / xMax) * pW;
      const Y = f => pT + (1 - (f - yMin) / (yMax - yMin)) * pH;

      ctx.clearRect(0, 0, cssW, cssH);
      ctx.strokeStyle = rule; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= 4; i++) { const y = pT + i / 4 * pH; ctx.moveTo(pL, y); ctx.lineTo(pL + pW, y); }
      ctx.stroke();
      ctx.strokeStyle = axis;
      ctx.beginPath(); ctx.moveTo(pL, pT); ctx.lineTo(pL, pT + pH); ctx.lineTo(pL + pW, pT + pH); ctx.stroke();

      ctx.fillStyle = ink2; ctx.font = '10px var(--mono, monospace)';
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (let i = 0; i <= 4; i++) {
        const v = yMax - i / 4 * (yMax - yMin);
        ctx.fillText(v.toFixed(2), pL - 6, pT + i / 4 * pH);
      }
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (let i = 0; i <= 4; i++) {
        ctx.fillText(String(Math.round(i / 4 * xMax)), pL + i / 4 * pW, pT + pH + 4);
      }
      ctx.save();
      ctx.translate(12, pT + pH / 2); ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = ink2; ctx.font = 'italic 12px var(--serif, serif)';
      ctx.fillText('f(xₖ)', 0, 0);
      ctx.restore();

      if (series.length > 1) {
        ctx.strokeStyle = acc; ctx.lineWidth = 1.4;
        ctx.beginPath();
        series.forEach((s, i) => { const x = X(s.k), y = Y(s.f); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
        ctx.stroke();
        ctx.fillStyle = acc;
        for (const s of series) { ctx.beginPath(); ctx.arc(X(s.k), Y(s.f), 2.5, 0, Math.PI * 2); ctx.fill(); }
      }
      if (series.length > 0) {
        const last = series[series.length - 1];
        ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(X(last.k), Y(last.f), 4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = acc; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
        ctx.beginPath(); ctx.moveTo(X(last.k), pT); ctx.lineTo(X(last.k), pT + pH); ctx.stroke();
        ctx.setLineDash([]);
      }
    }


    // ── RAF loop ───────────────────────────────────────────────────────────
    const clock = new THREE.Clock();
    let stepAccum = 0;
    let rafId = null;

    function frame() {
      const dt = clock.getDelta();
      controls.update();
      if (state.playing) {
        stepAccum += dt;
        const interval = 0.18;
        while (stepAccum >= interval && state.iter < state.maxIter) {
          doStep(); stepAccum -= interval;
        }
        if (state.iter >= state.maxIter) {
          state.playing = false;
          setUi(u => ({ ...u, playing: false }));
        }
      }
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
      rafId = requestAnimationFrame(frame);
    }

    const start = () => { if (!rafId) { clock.start(); rafId = requestAnimationFrame(frame); } };
    const stop = () => { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } };

    const stage = document.querySelector('deck-stage');
    const onSlideChange = ({ detail: { slide, previousSlide } }) => {
      if (slide?.contains(host)) start();
      else if (previousSlide?.contains(host)) stop();
    };
    if (stage) stage.addEventListener('slidechange', onSlideChange);
    if (host.closest('[data-deck-active]')) start();

    // ── Resize ────────────────────────────────────────────────────────────
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        W = width | 0; H = height | 0;
        canvasW = Math.max(100, W - RAIL_W); canvasH = H;
        renderer.setSize(canvasW, canvasH);
        labelRenderer.setSize(canvasW, canvasH);
        camera.aspect = canvasW / canvasH;
        camera.updateProjectionMatrix();
        drawPlot();
      }
    });
    ro.observe(host);

    // ── Theme change ───────────────────────────────────────────────────────
    const onTheme = () => {
      palette = getPalette();
      heatMat.uniforms.uAccent.value.set(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#d23b1c');
      heatMat.uniforms.uBg.value.set(getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#f0f0f2');
      heatMat.uniforms.uTint.value.set(getComputedStyle(document.documentElement).getPropertyValue('--tint').trim() || '#dddde8');
      heatMat.uniforms.uInk3.value.set(getComputedStyle(document.documentElement).getPropertyValue('--ink-3').trim() || '#666880');
      heatMat.uniforms.uIsDark.value = palette.isDark ? 1.0 : 0.0;
      scene.remove(sphereGrid);
      sphereGrid = buildLatLonGrid({ radius: 1.0005, palette });
      scene.add(sphereGrid);
      eqLine.material.color.set(palette.inkNum);
      eqLine.material.opacity = palette.equatorAlpha;
      buildLive(); updateLive(); drawPlot();
    };
    document.documentElement.addEventListener('deck-theme-change', onTheme);

    // ── Pointer pick (reset x₀) ────────────────────────────────────────────
    let pdown = null;
    canvas.addEventListener('pointerdown', e => { pdown = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    canvas.addEventListener('pointerup', e => {
      if (!pdown) return;
      const dx = e.clientX - pdown.x, dy = e.clientY - pdown.y;
      const dt = performance.now() - pdown.t;
      pdown = null;
      if (Math.hypot(dx, dy) > 6 || dt > 350) return;
      const hit = pickSphere(e, canvas, camera, 1.0);
      if (!hit) return;
      state.x.copy(hit.normalize()); state.iter = 0; state.history = [];
      updateLive(); updatePanel();
    });

    // ── Expose engine to React handlers ───────────────────────────────────
    engineRef.current = {
      step() { doStep(); },
      reset() { state.playing = false; setUi(u => ({ ...u, playing: false })); resetRun(); },
      togglePlay() {
        state.playing = !state.playing;
        setUi(u => ({ ...u, playing: state.playing }));
      },
      setAlpha(v) { state.alpha = v; setUi(u => ({ ...u, alpha: v })); updateLive(); },
      setCost(c) {
        state.cost = c;
        heatMat.uniforms.uCostMode.value = c === 'rayleigh' ? 0 : c === 'distance' ? 1 : 2;
        const r = COST_RANGES[c];
        heatMat.uniforms.uCMin.value = r.min;
        heatMat.uniforms.uCMax.value = r.max;
        setUi(u => ({ ...u, cost: c, playing: false }));
        state.playing = false;
        resetRun(); renderFormulas();
      },
    };

    // Boot
    resetRun();
    renderFormulas();

    return () => {
      stop();
      ro.disconnect();
      if (stage) stage.removeEventListener('slidechange', onSlideChange);
      document.documentElement.removeEventListener('deck-theme-change', onTheme);
      clearLive();
      sphereBody.geometry.dispose(); sphereBody.material.dispose();
      sphereGrid.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
      eqLine.geometry.dispose(); eqLine.material.dispose();
      renderer.dispose(); controls.dispose();
    };
  }, []);

  // ── React UI ──────────────────────────────────────────────────────────────

  const eng = () => engineRef.current;
  const mono = { fontFamily: 'var(--mono)', letterSpacing: '0.10em', textTransform: 'uppercase' };
  const btnBase = {
    padding: '14px 12px', background: 'var(--bg-2)', border: '1px solid var(--rule)',
    color: 'var(--ink)', cursor: 'pointer', fontFamily: 'var(--mono)',
    fontSize: '18px', letterSpacing: '0.08em', textTransform: 'uppercase', flex: 1,
  };
  const btnActive = { ...btnBase, background: 'var(--accent)', borderColor: 'var(--accent)', color: 'var(--bg-2)' };
  const costBtn = (c) => ({
    flex: 1, background: ui.cost === c ? 'var(--accent)' : 'transparent',
    border: 0, borderRight: '1px solid var(--rule)',
    padding: '14px 8px', fontFamily: 'var(--mono)', fontSize: '18px', fontWeight: 500,
    letterSpacing: '0.10em', textTransform: 'uppercase',
    color: ui.cost === c ? 'var(--bg-2)' : 'var(--ink-3)', cursor: 'pointer',
  });

  return (
    <div ref={hostRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Three.js canvas — occupies left portion */}
      <canvas className="rd-canvas"
        style={{ display: 'block', position: 'absolute', top: 0, bottom: 0, left: 0, right: RAIL_W + 'px', width: 'auto', height: 'auto' }} />

      {/* CSS2D label layer — same region as canvas */}
      <div className="rd-labels"
        style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: RAIL_W + 'px', pointerEvents: 'none', zIndex: 2 }} />

      {/* Control rail — right side */}
      <div style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width: RAIL_W + 'px',
        background: 'var(--bg)', borderLeft: '1px solid var(--rule)',
        display: 'flex', flexDirection: 'column', padding: '72px 36px 32px 36px',
        gap: '24px', overflowY: 'auto', zIndex: 5, boxSizing: 'border-box',
      }}>

        {/* Iter counter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ ...mono, fontSize: '20px', fontWeight: 500, color: 'var(--ink-3)' }}>Itération</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: '48px', fontWeight: 500, letterSpacing: '-0.01em', color: 'var(--ink)' }}>
              <span ref={iterRef}>000</span>
              <span style={{ color: 'var(--ink-3)', fontSize: '32px' }}> / 080</span>
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: '6px', borderTop: '1px solid var(--rule-soft)' }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: '22px', color: 'var(--accent)' }}>
              f = <span ref={fNowRef}>-</span>
            </span>
            <span ref={fGapRef} style={{ fontFamily: 'var(--mono)', fontSize: '20px', color: 'var(--ink-3)' }} />
          </div>
        </div>

        {/* Plot */}
        <div style={{ height: '200px', border: '1px solid var(--rule)', background: 'var(--bg-2)', padding: '6px', flexShrink: 0 }}>
          <canvas ref={plotRef} style={{ display: 'block', width: '100%', height: '100%' }} />
        </div>

        {/* Update rule */}
        <div style={{ padding: '20px 18px', minHeight: '80px', background: 'var(--bg-2)', border: '1px solid var(--rule)', borderLeft: '3px solid var(--accent)', fontSize: '20px', color: 'var(--ink)', overflowX: 'auto', display: 'flex', alignItems: 'center' }}>
          <div ref={updateFormulaRef} style={{ width: '100%' }} />
        </div>

        {/* Cost selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span ref={costNameRef} style={{ ...mono, fontSize: '20px', fontWeight: 600, color: 'var(--accent)' }}>Quotient de Rayleigh</span>
          <div style={{ display: 'flex', border: '1px solid var(--rule)' }}>
            {[['rayleigh', 'Rayleigh'], ['distance', 'Distance²'], ['frechet', 'Fréchet']].map(([c, lbl]) => (
              <button key={c} style={{ ...costBtn(c), ...(c === 'frechet' ? { borderRight: 0 } : {}) }}
                onClick={() => eng()?.setCost(c)}>{lbl}</button>
            ))}
          </div>
          <div style={{ padding: '14px 16px', background: 'var(--bg-2)', border: '1px solid var(--rule)', borderLeft: '3px solid var(--accent)', fontSize: '20px', color: 'var(--ink)', overflowX: 'auto' }}>
            <div ref={costExprRef} />
          </div>
        </div>

        {/* Alpha slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ ...mono, fontSize: '20px', color: 'var(--ink-3)', minWidth: '32px' }}>α</label>
          <input type="range" min={0.02} max={0.60} step={0.01} defaultValue={0.18}
            style={{ flex: 1, accentColor: 'var(--accent)' }}
            onChange={e => eng()?.setAlpha(Number(e.target.value))} />
          <span style={{ fontFamily: 'var(--mono)', fontSize: '20px', color: 'var(--ink)', minWidth: '52px', textAlign: 'right' }}>
            {ui.alpha.toFixed(2)}
          </span>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button style={btnBase} onClick={() => eng()?.step()}>Pas</button>
          <button style={ui.playing ? btnActive : btnBase} onClick={() => eng()?.togglePlay()}>
            {ui.playing ? 'Pause' : 'Lancer'}
          </button>
          <button style={btnBase} onClick={() => eng()?.reset()}>Réinit.</button>
        </div>
      </div>
    </div>
  );
}
