// Main controller for the Geometry Primer page.
// Wires up scene/camera/lights, chapter lifecycle, UI overlay, and input.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

import * as M from './math.js';
import {
  getPalette, setupRenderer, setupLights, buildSphere, pickSphere,
} from './scene.js';
import { CHAPTERS, DEFAULTS } from './primer-chapters.js';
import { applyTheme } from './apply-theme.js';
import { PALETTES as THEME_PALETTES, ACCENT_SWATCHES } from './presets.js';

// ---------------------------------------------------------------------------
// state
// ---------------------------------------------------------------------------
const state = {
  paletteKey: 'slate',
  accent: '#d23b1c',
  sphereStyle: 'translucent',
  chapterIdx: 0,
  p: DEFAULTS.P0.clone(),
  q: DEFAULTS.Q0.clone(),
  paused: false,
};

// ---------------------------------------------------------------------------
// renderer / scene
// ---------------------------------------------------------------------------
const canvas = document.getElementById('stage');
const labelLayer = document.getElementById('label-layer');
const renderer = setupRenderer(canvas);
const labelRenderer = new CSS2DRenderer({ element: labelLayer });
labelRenderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.05, 50);
camera.position.set(0, 0.55, 3.4);

// theme must be applied to :root BEFORE we read the palette
applyTheme({ palette: state.paletteKey, accent: state.accent });
let palette = getPalette();

const lights = setupLights(scene, palette);
let sphere = buildSphere({ style: state.sphereStyle, palette });
scene.add(sphere);

const chapterGroup = new THREE.Group();
chapterGroup.name = 'chapter';
scene.add(chapterGroup);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.rotateSpeed = 0.65;
controls.minDistance = 1.6;
controls.maxDistance = 6;
controls.enablePan = true;
controls.target.set(0, 0, 0);

// ---------------------------------------------------------------------------
// labels (CSS2D)
// ---------------------------------------------------------------------------
function makeLabel(text, position, opts = {}) {
  const div = document.createElement('div');
  div.className = 'world-label';
  if (opts.italic) div.classList.add('italic');
  if (opts.small) div.classList.add('small');
  if (opts.dim) div.classList.add('dim');
  if (opts.accent) div.classList.add('accent');
  if (opts.q) div.classList.add('q-col');
  if (opts.tangent) div.classList.add('tangent-col');
  if (opts.geo) div.classList.add('geo-col');
  if (opts.transport) div.classList.add('transport-col');
  if (opts.retract) div.classList.add('retract-col');
  div.innerHTML = text;
  const obj = new CSS2DObject(div);
  obj.position.copy(position);
  scene.add(obj);
  return {
    obj,
    update(newPos) { obj.position.copy(newPos); },
    setText(t) { div.innerHTML = t; },
    remove() { scene.remove(obj); div.remove(); },
  };
}
const activeLabels = [];

// ---------------------------------------------------------------------------
// chapter lifecycle
// ---------------------------------------------------------------------------
let currentChapter = null;
let currentHandle = null;

function rebuildSphere() {
  scene.remove(sphere);
  sphere.userData.body.geometry.dispose();
  sphere.userData.body.material.dispose();
  sphere = buildSphere({ style: state.sphereStyle, palette });
  scene.add(sphere);
}

function clearChapter() {
  // dispose chapter group children
  while (chapterGroup.children.length) {
    const c = chapterGroup.children.pop();
    c.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
        else o.material.dispose();
      }
    });
  }
  for (const l of activeLabels) l.remove();
  activeLabels.length = 0;
}

function buildContext() {
  return {
    scene,
    group: chapterGroup,
    palette,
    p: state.p,
    q: state.q,
    addLabel(text, position, opts) {
      const l = makeLabel(text, position, opts);
      activeLabels.push(l);
      return l;
    },
    requestRebuild() { setChapter(state.chapterIdx, /*animate*/ false); },
  };
}

function setChapter(idx, animate = true) {
  state.chapterIdx = idx;
  const chap = CHAPTERS[idx];
  currentChapter = chap;
  clearChapter();

  const ctx = buildContext();
  const handle = chap.enter(ctx) || {};
  currentHandle = handle;

  // update side panel content
  renderPanel(chap, idx);
  // update bottom dots/buttons
  renderBottom(idx);

  // camera animation target
  if (chap.camera) {
    cameraTo(new THREE.Vector3(...chap.camera.pos), new THREE.Vector3(...chap.camera.target), animate);
  }

  controls.autoRotate = !!handle.autoRotate;
  controls.autoRotateSpeed = handle.autoRotate ? handle.autoRotate * 12 : 0;
}

// ---------------------------------------------------------------------------
// camera animation
// ---------------------------------------------------------------------------
const camAnim = {
  active: false,
  fromPos: new THREE.Vector3(),
  toPos: new THREE.Vector3(),
  fromTgt: new THREE.Vector3(),
  toTgt: new THREE.Vector3(),
  t: 0,
  dur: 1.2,
};

function cameraTo(toPos, toTgt, animate) {
  if (!animate) {
    camera.position.copy(toPos);
    controls.target.copy(toTgt);
    controls.update();
    return;
  }
  camAnim.fromPos.copy(camera.position);
  camAnim.fromTgt.copy(controls.target);
  camAnim.toPos.copy(toPos);
  camAnim.toTgt.copy(toTgt);
  camAnim.t = 0;
  camAnim.active = true;
}

function tickCameraAnim(dt) {
  if (!camAnim.active) return;
  camAnim.t = Math.min(1, camAnim.t + dt / camAnim.dur);
  // smoothstep5
  const x = camAnim.t;
  const k = x * x * x * (x * (x * 6 - 15) + 10);
  camera.position.lerpVectors(camAnim.fromPos, camAnim.toPos, k);
  controls.target.lerpVectors(camAnim.fromTgt, camAnim.toTgt, k);
  if (camAnim.t >= 1) camAnim.active = false;
}

// ---------------------------------------------------------------------------
// panel rendering
// ---------------------------------------------------------------------------
const elEyebrow = document.getElementById('chap-eyebrow');
const elNum = document.getElementById('chap-num');
const elTotal = document.getElementById('chap-total');
const elTitle = document.getElementById('chap-title');
const elBody = document.getElementById('chap-body');
const elFormula = document.getElementById('chap-formula');
const elCtrls = document.getElementById('chap-controls');
const elDots = document.getElementById('dots');
const elPrev = document.getElementById('btn-prev');
const elNext = document.getElementById('btn-next');

elTotal.textContent = String(CHAPTERS.length).padStart(2, '0');

function renderPanel(chap, idx) {
  elEyebrow.textContent = chap.eyebrow;
  elNum.textContent = String(idx + 1).padStart(2, '0');
  elTitle.innerHTML = chap.title;
  elBody.innerHTML = chap.body;
  elFormula.innerHTML = '';
  // katex
  if (window.katex && chap.formula) {
    try {
      window.katex.render(chap.formula, elFormula, {
        throwOnError: false, displayMode: true,
      });
    } catch (e) {
      elFormula.textContent = chap.formula;
    }
  }
  // chapter controls (sliders)
  elCtrls.innerHTML = '';
  if (chap.controlSchema) {
    for (const [name, sch] of Object.entries(chap.controlSchema)) {
      const row = document.createElement('div');
      row.className = 'row';
      const lbl = document.createElement('label');
      lbl.textContent = sch.label || name;
      const input = document.createElement('input');
      input.type = 'range';
      input.min = sch.min; input.max = sch.max; input.step = sch.step; input.value = sch.value;
      const val = document.createElement('span');
      val.className = 'value';
      val.textContent = Number(sch.value).toFixed(2);
      input.addEventListener('input', (e) => {
        const v = Number(e.target.value);
        val.textContent = v.toFixed(2);
        currentHandle.onControl && currentHandle.onControl(name, v);
      });
      row.appendChild(lbl);
      row.appendChild(input);
      row.appendChild(val);
      elCtrls.appendChild(row);
    }
  }
  // pickable hint
  if (chap.pickable) {
    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.style.marginTop = '6px';
    hint.innerHTML = chap.pickable === 'q'
      ? '↳ click on the sphere to move <span style="color:var(--accent)">q</span>'
      : '↳ click on the sphere to move <span style="color:var(--accent)">p</span>';
    elCtrls.appendChild(hint);
  }
}

function renderBottom(idx) {
  elDots.innerHTML = '';
  for (let i = 0; i < CHAPTERS.length; i++) {
    const d = document.createElement('button');
    d.className = 'dot' + (i === idx ? ' active' : '');
    d.title = CHAPTERS[i].title.replace(/<[^>]+>/g, '');
    d.addEventListener('click', () => setChapter(i));
    elDots.appendChild(d);
  }
  elPrev.disabled = idx === 0;
  elNext.disabled = idx === CHAPTERS.length - 1;
  // next-button label shows upcoming chapter
  const next = CHAPTERS[idx + 1];
  if (next) elNext.querySelector('.lbl').textContent = next.eyebrow;
  else elNext.querySelector('.lbl').textContent = '·';
  const prev = CHAPTERS[idx - 1];
  if (prev) elPrev.querySelector('.lbl').textContent = prev.eyebrow;
  else elPrev.querySelector('.lbl').textContent = '·';
}

elPrev.addEventListener('click', () => { if (state.chapterIdx > 0) setChapter(state.chapterIdx - 1); });
elNext.addEventListener('click', () => { if (state.chapterIdx < CHAPTERS.length - 1) setChapter(state.chapterIdx + 1); });
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); if (state.chapterIdx < CHAPTERS.length - 1) setChapter(state.chapterIdx + 1); }
  if (e.key === 'ArrowLeft') { if (state.chapterIdx > 0) setChapter(state.chapterIdx - 1); }
});

// ---------------------------------------------------------------------------
// Tweaks (palette, sphere style)
// ---------------------------------------------------------------------------
function applyPalette(key) {
  state.paletteKey = key;
  applyTheme({ palette: key, accent: state.accent });
  palette = getPalette();
  rebuildSphere();
  setChapter(state.chapterIdx, /*animate*/ false);
  renderPaletteSwatches();
}
function applyStyle(style) {
  state.sphereStyle = style;
  rebuildSphere();
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
    btn.innerHTML = `
      <span class="a" style="background:${p.bg};"></span>
      <span class="b" style="background:${p.ink};"></span>`;
    btn.addEventListener('click', () => applyPalette(key));
    grid.appendChild(btn);
  }
}
renderPaletteSwatches();

const segStyle = document.querySelectorAll('[data-tw-style]');
segStyle.forEach((b) => {
  b.addEventListener('click', () => {
    segStyle.forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    applyStyle(b.dataset.twStyle);
  });
});

// ---------------------------------------------------------------------------
// click-to-pick (distinguish from orbit-drag)
// ---------------------------------------------------------------------------
let pdown = null;
canvas.addEventListener('pointerdown', (e) => {
  pdown = { x: e.clientX, y: e.clientY, t: performance.now() };
});
canvas.addEventListener('pointerup', (e) => {
  if (!pdown) return;
  const dx = e.clientX - pdown.x;
  const dy = e.clientY - pdown.y;
  const dt = performance.now() - pdown.t;
  pdown = null;
  if (Math.hypot(dx, dy) > 6 || dt > 350) return;
  const chap = currentChapter;
  if (!chap?.pickable) return;
  const hit = pickSphere(e, canvas, camera, 1.0);
  if (!hit) return;
  const p = hit.clone().normalize();
  if (currentHandle?.onPick) currentHandle.onPick(p);
});

// ---------------------------------------------------------------------------
// resize
// ---------------------------------------------------------------------------
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  labelRenderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------------------
// main loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
let time = 0;
function loop() {
  const dt = clock.getDelta();
  time += dt;
  tickCameraAnim(dt);
  controls.update();
  if (currentHandle?.tick) currentHandle.tick(time, dt);
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------------------
// boot
// ---------------------------------------------------------------------------
setChapter(0, false);
loop();

// debug
window.__primer = { scene, camera, renderer, get sphere() { return sphere; }, get palette() { return palette; }, state };
