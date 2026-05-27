// Riemannian Gradient Descent on S².
// Sphere on the left painted with cost heatmap; the right rail carries
// the cost-vs-iteration plot, step formulas, and run controls.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

import * as M from './math.js';
import {
  getPalette, setupRenderer, setupLights, buildLatLonGrid,
  buildArrow, buildPolyline, buildDot, buildTangentPlane, pickSphere,
} from './scene.js';
import { applyTheme } from './apply-theme.js';
import { PALETTES as THEME_PALETTES } from './presets.js';

// ---------------------------------------------------------------------------
// state
// ---------------------------------------------------------------------------
const state = {
  paletteKey: 'slate',
  accent: '#d23b1c',
  sphereStyle: 'translucent',
  cost: 'rayleigh',
  alpha: 0.18,
  useExp: false,
  showFullStep: true,
  playing: false,
  iter: 0,
  maxIter: 80,
  x: null,
  history: [],
};

// Rayleigh quotient matrix — symmetric, with distinct eigenvalues
// so f has 6 critical points (±eigenvectors).
const RAYLEIGH_A = [
  [1.8, 0.4, 0.3],
  [0.4, 0.2, -0.2],
  [0.3, -0.2, -1.4],
];

// Distance target & Fréchet targets
const DIST_T = M.fromLatLon(THREE.MathUtils.degToRad(-25), THREE.MathUtils.degToRad(155));

const FRECHET_TS = [
  M.fromLatLon(THREE.MathUtils.degToRad(35), THREE.MathUtils.degToRad(40)),
  M.fromLatLon(THREE.MathUtils.degToRad(-15), THREE.MathUtils.degToRad(160)),
  M.fromLatLon(THREE.MathUtils.degToRad(0), THREE.MathUtils.degToRad(-90)),
  M.fromLatLon(THREE.MathUtils.degToRad(55), THREE.MathUtils.degToRad(-30)),
];

// Sample many random starting points so the cost surface is interestingly placed.
const X0 = M.fromLatLon(THREE.MathUtils.degToRad(45), THREE.MathUtils.degToRad(-80));

// ---------------------------------------------------------------------------
// scene setup
// ---------------------------------------------------------------------------
const canvas = document.getElementById('stage');
const labelLayer = document.getElementById('label-layer');
const renderer = setupRenderer(canvas);
const labelRenderer = new CSS2DRenderer({ element: labelLayer });

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 50);
camera.position.set(2.0, 1.2, 2.0);

// apply theme BEFORE reading palette
applyTheme({ palette: state.paletteKey, accent: state.accent });
let palette = getPalette();
setupLights(scene, palette);

const sphereGroup = new THREE.Group();
sphereGroup.name = 'sphere';
scene.add(sphereGroup);

const runtimeGroup = new THREE.Group();
runtimeGroup.name = 'runtime';
scene.add(runtimeGroup);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.rotateSpeed = 0.65;
controls.minDistance = 1.6;
controls.maxDistance = 6;
controls.enablePan = true;

// ---------------------------------------------------------------------------
// heatmap sphere material (custom shader)
// The colormap interpolates between accent (at the MIN of cost = attractor)
// and the theme background (at the MAX). Iterates descend toward the most
// saturated region of the heatmap.
// ---------------------------------------------------------------------------
const cssCol = (cssVar, fallback) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
  return new THREE.Color(v || fallback);
};

const heatmapMat = new THREE.ShaderMaterial({
  uniforms: {
    uCostMode: { value: 0 },
    uA: {
      value: new THREE.Matrix3().set(
        RAYLEIGH_A[0][0], RAYLEIGH_A[0][1], RAYLEIGH_A[0][2],
        RAYLEIGH_A[1][0], RAYLEIGH_A[1][1], RAYLEIGH_A[1][2],
        RAYLEIGH_A[2][0], RAYLEIGH_A[2][1], RAYLEIGH_A[2][2],
      )
    },
    uTarget: { value: DIST_T.clone() },
    uTargets: {
      value: (() => {
        const arr = FRECHET_TS.map(v => v.clone());
        while (arr.length < 8) arr.push(new THREE.Vector3(1, 0, 0));
        return arr;
      })()
    },
    uNumTargets: { value: FRECHET_TS.length },
    uCMin: { value: -1.4 },
    uCMax: { value: 1.8 },
    uOpacity: { value: 1.0 },
    uAccent: { value: cssCol('--accent', '#d23b1c') },
    uBg: { value: cssCol('--bg', '#f0f0f2') },
    uTint: { value: cssCol('--tint', '#dddde8') },
    uInk3: { value: cssCol('--ink-3', '#666880') },
    uLightDir: { value: new THREE.Vector3(3.5, 4.5, 5.5).normalize() },
    uAmbient: { value: 0.55 },
    uIsDark: { value: 0.0 },
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
    uniform int uCostMode;
    uniform mat3 uA;
    uniform vec3 uTarget;
    uniform vec3 uTargets[8];
    uniform int  uNumTargets;
    uniform float uCMin;
    uniform float uCMax;
    uniform float uOpacity;
    uniform vec3  uAccent;
    uniform vec3  uBg;
    uniform vec3  uTint;
    uniform vec3  uInk3;
    uniform vec3  uLightDir;
    uniform float uAmbient;
    uniform float uIsDark;

    // ---------------- color ramp: accent (low cost) → bg (high cost) ---
    // 3-stop interpolation through tint for a richer gradient.
    vec3 ramp(float t) {
      t = clamp(t, 0.0, 1.0);
      // ease the start so the bright accent dominates the optimum
      float k = pow(t, 0.85);
      vec3 c0 = uAccent;
      vec3 c1 = mix(uAccent, uTint, 0.55);
      vec3 c2 = uBg;
      if (k < 0.5) return mix(c0, c1, k * 2.0);
      return mix(c1, c2, (k - 0.5) * 2.0);
    }

    // ---------------- cost ----------------------
    float cost(vec3 x) {
      if (uCostMode == 0) {
        vec3 Ax = uA * x;
        return dot(x, Ax);
      } else if (uCostMode == 1) {
        float c = clamp(dot(x, uTarget), -1.0, 1.0);
        float th = acos(c);
        return 0.5 * th * th;
      } else {
        float s = 0.0;
        for (int i = 0; i < 8; i++) {
          if (i >= uNumTargets) break;
          float c = clamp(dot(x, uTargets[i]), -1.0, 1.0);
          float th = acos(c);
          s += 0.5 * th * th;
        }
        return s / float(uNumTargets);
      }
    }

    void main() {
      vec3 x = normalize(vWorld);
      float c = cost(x);
      float t = (c - uCMin) / max(1e-6, (uCMax - uCMin));
      vec3 col = ramp(t);

      // soft lighting on top of the heat color
      vec3 N = normalize(vNormal);
      vec3 L = normalize(uLightDir);
      vec3 V = normalize(cameraPosition - vWorld);
      float ndl = max(dot(N, L), 0.0);
      float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
      vec3 lit = col * (uAmbient + (1.0 - uAmbient) * ndl);
      // subtle fresnel: warmer on dark theme, darker line on paper
      vec3 rimC = mix(uInk3, uAccent, 0.4);
      lit += rimC * fres * (uIsDark > 0.5 ? 0.20 : 0.10);

      gl_FragColor = vec4(lit, uOpacity);
    }
  `,
  transparent: false,
});

const sphereGeom = new THREE.SphereGeometry(1, 192, 144);
const sphereBody = new THREE.Mesh(sphereGeom, heatmapMat);
sphereGroup.add(sphereBody);

let sphereGrid = buildLatLonGrid({ radius: 1.0005, palette });
sphereGroup.add(sphereGrid);

// equator emphasis
const eqMat = new THREE.LineBasicMaterial({
  color: palette.ink, transparent: true, opacity: palette.equatorAlpha,
});
const eqPts = [];
for (let i = 0; i <= 256; i++) {
  const t = (i / 256) * Math.PI * 2;
  eqPts.push(new THREE.Vector3(Math.cos(t) * 1.002, 0, Math.sin(t) * 1.002));
}
const eqLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(eqPts), eqMat);
sphereGroup.add(eqLine);

// ---------------------------------------------------------------------------
// labels
// ---------------------------------------------------------------------------
const labelObjs = [];
function makeLabel(text, position, opts = {}) {
  const div = document.createElement('div');
  div.className = 'world-label';
  if (opts.italic) div.classList.add('italic');
  if (opts.small) div.classList.add('small');
  if (opts.accent) div.classList.add('accent');
  if (opts.tangent) div.classList.add('tangent-col');
  if (opts.geo) div.classList.add('geo-col');
  if (opts.target) div.classList.add('q-col');
  div.innerHTML = text;
  const obj = new CSS2DObject(div);
  obj.position.copy(position);
  scene.add(obj);
  const lab = {
    obj, update(p) { obj.position.copy(p); },
    setText(t) { div.innerHTML = t; },
    setVisible(v) { div.style.display = v ? '' : 'none'; },
    remove() { scene.remove(obj); div.remove(); },
  };
  labelObjs.push(lab);
  return lab;
}

// ---------------------------------------------------------------------------
// step visualization (current x, gradient arrows, retraction preview)
// ---------------------------------------------------------------------------
const live = {
  xDot: null,
  euclidArrow: null,
  riemArrow: null,
  stepArrow: null,
  plane: null,
  retractLine: null,
  nextDot: null,
  trail: null,
  trailDots: new THREE.Group(),
  targetDots: new THREE.Group(),
  xLabel: null,
  nextLabel: null,
  euclidLabel: null,
  riemLabel: null,
};

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

  // target markers
  if (state.cost === 'distance') {
    const d = buildDot({ position: DIST_T, color: palette.q, radius: 0.026 });
    live.targetDots.add(d);
    makeLabel('t', DIST_T.clone().multiplyScalar(1.07), { target: true });
  } else if (state.cost === 'frechet') {
    for (let i = 0; i < FRECHET_TS.length; i++) {
      const t = FRECHET_TS[i];
      live.targetDots.add(buildDot({ position: t, color: palette.q, radius: 0.022 }));
      makeLabel(`t<sub>${i + 1}</sub>`, t.clone().multiplyScalar(1.07), { target: true, small: true });
    }
  }

  // tangent plane at current x
  live.plane = buildTangentPlane({
    p: state.x, radius: 0.75, color: palette.tangent, opacity: 0.10,
  });
  runtimeGroup.add(live.plane);

  // current x dot
  live.xDot = buildDot({ position: state.x, color: palette.p, radius: 0.028 });
  runtimeGroup.add(live.xDot);
  live.xLabel = makeLabel(`x<sub>k</sub>`, state.x.clone().multiplyScalar(1.08), { accent: true });

  // arrows (length zero until updated)
  live.euclidArrow = buildArrow({
    origin: state.x, direction: new THREE.Vector3(0, 1, 0), length: 0,
    color: palette.euclid, shaft: 0.010, head: 0.038, headLen: 0.08,
  });
  runtimeGroup.add(live.euclidArrow);

  live.riemArrow = buildArrow({
    origin: state.x, direction: new THREE.Vector3(0, 1, 0), length: 0,
    color: palette.tangent, shaft: 0.010, head: 0.040, headLen: 0.08,
  });
  runtimeGroup.add(live.riemArrow);

  live.stepArrow = buildArrow({
    origin: state.x, direction: new THREE.Vector3(0, 1, 0), length: 0,
    color: palette.retraction, shaft: 0.010, head: 0.040, headLen: 0.08,
  });
  runtimeGroup.add(live.stepArrow);

  // retraction dashed connector
  live.retractLine = buildPolyline({
    points: [state.x.clone(), state.x.clone()],
    color: palette.textDim, opacity: 0.5, dashed: true,
  });
  runtimeGroup.add(live.retractLine);

  // next-point preview dot
  live.nextDot = buildDot({ position: state.x.clone(), color: palette.retraction, radius: 0.022 });
  runtimeGroup.add(live.nextDot);

  // trajectory line (will be updated each iteration)
  live.trail = buildPolyline({
    points: [state.x.clone()], color: palette.trail, opacity: 0.9,
  });
  runtimeGroup.add(live.trail);
}

// ---------------------------------------------------------------------------
// cost / gradient evaluation
// ---------------------------------------------------------------------------
function evalCost(x) {
  if (state.cost === 'rayleigh') return M.rayleighValue(x, RAYLEIGH_A);
  if (state.cost === 'distance') return M.distSqValue(x, DIST_T);
  return M.frechetValue(x, FRECHET_TS);
}

function evalEucGrad(x) {
  if (state.cost === 'rayleigh') return M.rayleighGrad(x, RAYLEIGH_A);
  if (state.cost === 'distance') {
    // for the distance² function, we use the Riem grad directly; the
    // "ambient" gradient still makes sense as 2*(x-t) for ½|x−t|², which we
    // can show as a related ambient quantity. We'll instead expose the
    // unprojected manifold gradient (−log_x(t) shown in tangent space + its
    // normal-extension as zero) — visually represent this as the Riem grad
    // itself with an explanatory note; in the panel we say "for the geodesic
    // cost we work directly with grad_R = −log_x(t)".
    return new THREE.Vector3();
  }
  return new THREE.Vector3();
}

function evalRiemGrad(x) {
  if (state.cost === 'rayleigh') {
    return M.projectTangent(x, M.rayleighGrad(x, RAYLEIGH_A));
  }
  if (state.cost === 'distance') return M.distSqGradRiem(x, DIST_T);
  return M.frechetGradRiem(x, FRECHET_TS);
}

function step() {
  const x = state.x.clone();
  const gE = evalEucGrad(x);
  const gR = evalRiemGrad(x);
  const v = gR.clone().multiplyScalar(-state.alpha);
  const xNext = state.useExp ? M.expMap(x, v) : M.retract(x, v);
  const fNow = evalCost(x);
  state.history.push({ x: x.clone(), f: fNow, gE: gE.clone(), gR: gR.clone(), step: v.clone() });
  state.x.copy(xNext);
  state.iter += 1;
  updateLive();
  updatePanel();
}

function resetRun() {
  state.iter = 0;
  state.history = [];
  state.x.copy(X0);
  // reset cost-specific defaults
  if (state.cost === 'rayleigh') {
    state.x.copy(M.fromLatLon(THREE.MathUtils.degToRad(45), THREE.MathUtils.degToRad(-80)));
  } else if (state.cost === 'distance') {
    state.x.copy(M.fromLatLon(THREE.MathUtils.degToRad(45), THREE.MathUtils.degToRad(-15)));
  } else {
    state.x.copy(M.fromLatLon(THREE.MathUtils.degToRad(-60), THREE.MathUtils.degToRad(50)));
  }
  buildLive();
  updateLive();
  updatePanel();
}

// ---------------------------------------------------------------------------
// live visualization update
// ---------------------------------------------------------------------------
function updateLive() {
  const x = state.x;
  live.xDot.position.copy(x);
  live.plane.userData.update(x);
  live.xLabel.update(x.clone().multiplyScalar(1.08));

  const gE = evalEucGrad(x);
  const gR = evalRiemGrad(x);
  const v = gR.clone().multiplyScalar(-state.alpha);
  const xNext = state.useExp ? M.expMap(x, v) : M.retract(x, v);

  // arrows
  const hideEuc = (state.cost !== 'rayleigh');
  if (hideEuc) {
    live.euclidArrow.visible = false;
  } else {
    live.euclidArrow.visible = state.showFullStep;
    const eLen = Math.min(0.85, gE.length() * 0.25);
    live.euclidArrow.userData.update(x, gE, eLen);
  }

  // Riemannian gradient (scaled for visibility)
  const showR = state.showFullStep;
  live.riemArrow.visible = showR;
  const rLen = Math.min(0.85, gR.length() * 0.45);
  live.riemArrow.userData.update(x, gR, rLen);

  // step arrow = -α gR
  live.stepArrow.visible = state.showFullStep;
  const sLen = Math.min(0.95, v.length());
  live.stepArrow.userData.update(x, v, sLen);

  // retraction connector: from (x + v) to xNext
  live.retractLine.userData.update([
    x.clone().add(v),
    xNext.clone(),
  ]);
  live.nextDot.position.copy(xNext);

  // trail = all history points + current x
  const pts = state.history.map(h => h.x.clone());
  pts.push(x.clone());
  if (pts.length >= 2) {
    // densify with geodesic interpolation between successive iterates
    const dense = [pts[0].clone()];
    for (let i = 1; i < pts.length; i++) {
      const arc = M.geodesicArc(pts[i - 1], pts[i], 24);
      for (let j = 1; j < arc.length; j++) dense.push(arc[j]);
    }
    live.trail.userData.update(dense);
  } else {
    live.trail.userData.update([pts[0], pts[0]]);
  }

  // trail dots
  while (live.trailDots.children.length) {
    const c = live.trailDots.children.pop();
    if (c.geometry) c.geometry.dispose();
    if (c.material) c.material.dispose();
  }
  for (let i = 0; i < state.history.length; i++) {
    const d = buildDot({
      position: state.history[i].x,
      color: palette.trail,
      radius: 0.014,
    });
    d.material.transparent = true;
    d.material.opacity = 0.55;
    live.trailDots.add(d);
  }
}

// ---------------------------------------------------------------------------
// Panel: iteration counter, formula, plot, controls
// ---------------------------------------------------------------------------
const elIter = document.getElementById('iter-num');
const elIterTotal = document.getElementById('iter-total');
const elFNow = document.getElementById('f-now');
const elFGap = document.getElementById('f-gap');
const elFormulaA = document.getElementById('formula-update');
const elFormulaB = document.getElementById('formula-grad');
const elCostName = document.getElementById('cost-name');
const elCostExpr = document.getElementById('cost-expr');
const plotCanvas = document.getElementById('plot');
const plotCtx = plotCanvas.getContext('2d');

const elAlpha = document.getElementById('alpha');
const elAlphaVal = document.getElementById('alpha-val');
const elPlay = document.getElementById('btn-play');
const elStep = document.getElementById('btn-step');
const elReset = document.getElementById('btn-reset');

function updatePanel() {
  elIter.textContent = String(state.iter).padStart(3, '0');
  elIterTotal.textContent = String(state.maxIter).padStart(3, '0');
  const f = evalCost(state.x);
  elFNow.textContent = f.toFixed(4);
  if (state.history.length > 0) {
    const f0 = state.history[0].f;
    elFGap.textContent = `Δ = ${(f - f0).toFixed(4)}`;
  } else {
    elFGap.textContent = '';
  }
  drawPlot();
}

function renderFormulas() {
  const ret = state.useExp
    ? String.raw`x_{k+1} = \exp_{x_k}\!\bigl(-\alpha\,\nabla_{R}\!f(x_k)\bigr)`
    : String.raw`x_{k+1} = R_{x_k}\!\bigl(-\alpha\,\nabla_{R}\!f(x_k)\bigr)`;
  const proj = String.raw`\nabla_{R}\!f(x) = \Pi_{x}\!\bigl(\nabla\! f(x)\bigr) = \nabla\!f(x) - \langle \nabla\!f(x),\, x\rangle\, x`;
  if (window.katex) {
    window.katex.render(ret, elFormulaA, { throwOnError: false, displayMode: true });
    window.katex.render(proj, elFormulaB, { throwOnError: false, displayMode: true });
  }

  let exprL;
  if (state.cost === 'rayleigh') {
    exprL = String.raw`f(x) = x^{\!\top}\! A\, x, \quad A = A^{\!\top}`;
    elCostName.textContent = 'Rayleigh quotient';
  } else if (state.cost === 'distance') {
    exprL = String.raw`f(x) = \tfrac{1}{2}\, d_{S^{2}}(x, t)^{2} = \tfrac{1}{2}\,\arccos\langle x, t\rangle^{2}`;
    elCostName.textContent = 'Distance² to target';
  } else {
    exprL = String.raw`f(x) = \tfrac{1}{2N}\sum_{i=1}^{N} d_{S^{2}}(x, t_{i})^{2}`;
    elCostName.textContent = 'Fréchet mean';
  }
  if (window.katex) {
    window.katex.render(exprL, elCostExpr, { throwOnError: false, displayMode: true });
  }
}

// ---------------------------------------------------------------------------
// 1D cost-vs-iteration plot
// ---------------------------------------------------------------------------
function resizePlot() {
  const cssW = plotCanvas.clientWidth;
  const cssH = plotCanvas.clientHeight;
  const dpr = Math.min(window.devicePixelRatio, 2);
  plotCanvas.width = cssW * dpr;
  plotCanvas.height = cssH * dpr;
  plotCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', () => { resizePlot(); drawPlot(); });
new ResizeObserver(() => { drawPlot(); }).observe(plotCanvas);

function drawPlot() {
  resizePlot();
  const W = plotCanvas.clientWidth;
  const H = plotCanvas.clientHeight;
  const ctx = plotCtx;
  ctx.clearRect(0, 0, W, H);

  const padL = 38, padR = 14, padT = 12, padB = 24;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // axes
  const cssStyle = (k) => getComputedStyle(document.documentElement).getPropertyValue(k);
  const axisColor = cssStyle('--ink-3').trim() || '#666880';
  const textColor = cssStyle('--ink-2').trim() || '#2e3040';
  const accent = cssStyle('--accent').trim() || '#d23b1c';
  const rule = cssStyle('--rule-soft').trim() || 'rgba(0,0,0,0.14)';

  // collect points
  const series = state.history.map((h, i) => ({ k: i, f: h.f }));
  // append current
  series.push({ k: state.iter, f: evalCost(state.x) });

  // y range
  let yMin = Infinity, yMax = -Infinity;
  for (const s of series) { yMin = Math.min(yMin, s.f); yMax = Math.max(yMax, s.f); }
  if (!isFinite(yMin)) { yMin = 0; yMax = 1; }
  if (yMax - yMin < 1e-6) { yMax = yMin + 1; }
  const yPad = (yMax - yMin) * 0.10;
  yMin -= yPad; yMax += yPad;

  const xMax = Math.max(state.maxIter, state.iter + 4);

  const X = (k) => padL + (k / xMax) * plotW;
  const Y = (f) => padT + (1 - (f - yMin) / (yMax - yMin)) * plotH;

  // grid
  ctx.strokeStyle = rule;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 4; i++) {
    const y = padT + (i / 4) * plotH;
    ctx.moveTo(padL, y); ctx.lineTo(padL + plotW, y);
  }
  ctx.stroke();

  // axes
  ctx.strokeStyle = axisColor;
  ctx.beginPath();
  ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + plotH);
  ctx.lineTo(padL + plotW, padT + plotH);
  ctx.stroke();

  // y labels
  ctx.fillStyle = textColor;
  ctx.font = '10px "JetBrains Mono", monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 4; i++) {
    const v = yMax - (i / 4) * (yMax - yMin);
    ctx.fillText(v.toFixed(2), padL - 6, padT + (i / 4) * plotH);
  }
  // x labels
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let i = 0; i <= 4; i++) {
    const k = Math.round((i / 4) * xMax);
    ctx.fillText(String(k), padL + (i / 4) * plotW, padT + plotH + 4);
  }
  // axis names
  ctx.save();
  ctx.translate(12, padT + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = textColor;
  ctx.font = 'italic 12px "Newsreader", serif';
  ctx.fillText('f(xₖ)', 0, 0);
  ctx.restore();
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.font = 'italic 12px "Newsreader", serif';
  ctx.fillText('k', padL + plotW / 2, padT + plotH + 14);

  // curve
  if (series.length > 1) {
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < series.length; i++) {
      const x = X(series[i].k), y = Y(series[i].f);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // dots
    for (const s of series) {
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(X(s.k), Y(s.f), 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // current point highlight
  if (series.length > 0) {
    const last = series[series.length - 1];
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(X(last.k), Y(last.f), 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(X(last.k), padT); ctx.lineTo(X(last.k), padT + plotH);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

// ---------------------------------------------------------------------------
// colorbar — vertical strip mirroring the heatmap ramp
// ---------------------------------------------------------------------------
const cbCanvas = document.getElementById('cb');
const cbCtx = cbCanvas.getContext('2d');
const cbMinEl = document.getElementById('cb-min');
const cbMaxEl = document.getElementById('cb-max');
const cbExprEl = document.getElementById('cb-expr');

function resizeColorbar() {
  const cssW = cbCanvas.clientWidth;
  const cssH = cbCanvas.clientHeight;
  const dpr = Math.min(window.devicePixelRatio, 2);
  cbCanvas.width = cssW * dpr;
  cbCanvas.height = cssH * dpr;
  cbCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
new ResizeObserver(() => { drawColorbar(); }).observe(cbCanvas);

function rampCss(t) {
  // mirror the GLSL ramp: accent → tint → bg
  t = Math.max(0, Math.min(1, Math.pow(t, 0.85)));
  const cs = getComputedStyle(document.documentElement);
  const accent = parseHex(cs.getPropertyValue('--accent').trim() || '#d23b1c');
  const tint = parseHex(cs.getPropertyValue('--tint').trim() || '#dddde8');
  const bg = parseHex(cs.getPropertyValue('--bg').trim() || '#f0f0f2');
  const c1 = mixRgb(accent, tint, 0.55);
  const c = t < 0.5 ? mixRgb(accent, c1, t * 2) : mixRgb(c1, bg, (t - 0.5) * 2);
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}
function parseHex(s) {
  s = (s || '').trim().replace('#', '');
  if (s.length === 3) s = s.split('').map(x => x + x).join('');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
function mixRgb(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function drawColorbar() {
  resizeColorbar();
  const W = cbCanvas.clientWidth;
  const H = cbCanvas.clientHeight;
  cbCtx.clearRect(0, 0, W, H);
  // sample
  const N = 96;
  for (let i = 0; i < N; i++) {
    // top is min (t=0 = accent), bottom is max (t=1 = bg)
    const t = i / (N - 1);
    cbCtx.fillStyle = rampCss(t);
    cbCtx.fillRect(0, t * H - 1, W, H / N + 2);
  }
  // labels
  const cMin = heatmapMat.uniforms.uCMin.value;
  const cMax = heatmapMat.uniforms.uCMax.value;
  if (cbMinEl) cbMinEl.textContent = cMin.toFixed(2);
  if (cbMaxEl) cbMaxEl.textContent = cMax.toFixed(2);
  if (cbExprEl) {
    cbExprEl.textContent =
      state.cost === 'rayleigh' ? 'xᵀAx'
        : state.cost === 'distance' ? '½ d(x,t)²'
          : '½N⁻¹ Σ d(x,tᵢ)²';
  }
}

// ---------------------------------------------------------------------------
// controls
// ---------------------------------------------------------------------------
elAlpha.value = String(state.alpha);
elAlphaVal.textContent = state.alpha.toFixed(2);
elAlpha.addEventListener('input', (e) => {
  state.alpha = Number(e.target.value);
  elAlphaVal.textContent = state.alpha.toFixed(2);
  updateLive();
});

elStep.addEventListener('click', () => {
  if (state.iter < state.maxIter) step();
});
elReset.addEventListener('click', () => { state.playing = false; updatePlayButton(); resetRun(); });

function updatePlayButton() {
  elPlay.querySelector('.lbl').textContent = state.playing ? 'Pause' : 'Play';
  elPlay.classList.toggle('active', state.playing);
}
elPlay.addEventListener('click', () => { state.playing = !state.playing; updatePlayButton(); });

document.querySelectorAll('[data-cost]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-cost]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.cost = btn.dataset.cost;
    heatmapMat.uniforms.uCostMode.value =
      state.cost === 'rayleigh' ? 0 : state.cost === 'distance' ? 1 : 2;
    // adapt color range to each cost function
    if (state.cost === 'rayleigh') {
      heatmapMat.uniforms.uCMin.value = -1.7;
      heatmapMat.uniforms.uCMax.value = 2.0;
    } else if (state.cost === 'distance') {
      heatmapMat.uniforms.uCMin.value = 0;
      heatmapMat.uniforms.uCMax.value = 0.5 * Math.PI * Math.PI;
    } else {
      heatmapMat.uniforms.uCMin.value = 0.0;
      heatmapMat.uniforms.uCMax.value = 1.4;
    }
    resetRun();
    renderFormulas();
    drawColorbar();
  });
});

function applyPaletteChange(key) {
  state.paletteKey = key;
  applyTheme({ palette: key, accent: state.accent });
  palette = getPalette();
  // refresh shader uniforms from CSS vars
  heatmapMat.uniforms.uAccent.value.set(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#d23b1c');
  heatmapMat.uniforms.uBg.value.set(getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#f0f0f2');
  heatmapMat.uniforms.uTint.value.set(getComputedStyle(document.documentElement).getPropertyValue('--tint').trim() || '#dddde8');
  heatmapMat.uniforms.uInk3.value.set(getComputedStyle(document.documentElement).getPropertyValue('--ink-3').trim() || '#666880');
  heatmapMat.uniforms.uIsDark.value = palette.isDark ? 1.0 : 0.0;
  // sphere grid
  sphereGroup.remove(sphereGrid);
  sphereGrid = buildLatLonGrid({ radius: 1.0005, palette });
  sphereGroup.add(sphereGrid);
  eqLine.material.color.set(palette.ink);
  eqLine.material.opacity = palette.equatorAlpha;
  buildLive();
  updateLive();
  drawPlot();
  drawColorbar();
  renderPaletteSwatches();
}

function renderPaletteSwatches() {
  const grid = document.getElementById('palette-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (const [key, p] of Object.entries(THEME_PALETTES)) {
    const btn = document.createElement('button');
    btn.className = 'palette-swatch';
    btn.title = key;
    btn.dataset.palette = key;
    if (key === state.paletteKey) btn.dataset.active = 'true';
    btn.innerHTML =
      `<span class="a" style="background:${p.bg};"></span>` +
      `<span class="b" style="background:${p.ink};"></span>`;
    btn.addEventListener('click', () => applyPaletteChange(key));
    grid.appendChild(btn);
  }
}
renderPaletteSwatches();

document.querySelectorAll('[data-tw-style]').forEach((b) => {
  b.addEventListener('click', () => {
    document.querySelectorAll('[data-tw-style]').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    state.sphereStyle = b.dataset.twStyle;
    heatmapMat.uniforms.uOpacity.value = state.sphereStyle === 'translucent' ? 0.78 : 1.0;
    sphereBody.material.transparent = state.sphereStyle === 'translucent';
    sphereBody.material.needsUpdate = true;
  });
});

function rebuildGrid() {
  sphereGroup.remove(sphereGrid);
  sphereGrid = buildLatLonGrid({ radius: 1.0005, palette });
  sphereGroup.add(sphereGrid);
}

// ---------------------------------------------------------------------------
// click on sphere to set base point
// ---------------------------------------------------------------------------
let pdown = null;
canvas.addEventListener('pointerdown', (e) => {
  pdown = { x: e.clientX, y: e.clientY, t: performance.now() };
});
canvas.addEventListener('pointerup', (e) => {
  if (!pdown) return;
  const dx = e.clientX - pdown.x, dy = e.clientY - pdown.y;
  const dt = performance.now() - pdown.t;
  pdown = null;
  if (Math.hypot(dx, dy) > 6 || dt > 350) return;
  const hit = pickSphere(e, canvas, camera, 1.0);
  if (!hit) return;
  state.x.copy(hit.normalize());
  state.iter = 0;
  state.history = [];
  updateLive();
  updatePanel();
});

// ---------------------------------------------------------------------------
// resize
// ---------------------------------------------------------------------------
function resize() {
  const wrap = canvas.getBoundingClientRect();
  renderer.setSize(wrap.width, wrap.height, false);
  labelRenderer.setSize(wrap.width, wrap.height);
  labelLayer.style.width = wrap.width + 'px';
  labelLayer.style.height = wrap.height + 'px';
  labelLayer.style.left = wrap.left + 'px';
  labelLayer.style.top = wrap.top + 'px';
  camera.aspect = wrap.width / wrap.height;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

// ---------------------------------------------------------------------------
// main loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
let stepAccum = 0;
function loop() {
  const dt = clock.getDelta();
  controls.update();
  if (state.playing) {
    stepAccum += dt;
    const interval = 0.18;
    while (stepAccum >= interval && state.iter < state.maxIter) {
      step();
      stepAccum -= interval;
    }
    if (state.iter >= state.maxIter) { state.playing = false; updatePlayButton(); }
  }
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------------------
// boot
// ---------------------------------------------------------------------------
state.x = X0.clone();
heatmapMat.uniforms.uIsDark.value = palette.isDark ? 1.0 : 0.0;
// set initial color range for default rayleigh cost
heatmapMat.uniforms.uCMin.value = -1.7;
heatmapMat.uniforms.uCMax.value = 2.0;
resize();
buildLive();
resetRun();
renderFormulas();
drawColorbar();
loop();

window.__descent = { state, scene, camera, renderer, get palette() { return palette; } };
