// fed-aggregation.jsx — 3D visualisation of projection-based federated
// aggregation on a manifold (S² as visualisable proxy for Stiefel).
//
// Five client points start coinciding with the global model on the sphere,
// drift to their own local optima via geodesics, then:
//   - the Euclidean (arithmetic) mean lands INSIDE the sphere (off-manifold)
//   - RFedProj projects this mean back onto the surface — the new global model
//
// Stepped by the deck's [data-step] mechanism (one chapter per step), same
// pattern as riemann-primer / riemann-descent.

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import katex from 'katex';

import {
  getPalette, setupRenderer, setupLights, buildSphere,
  buildDot, buildArrow, buildPolyline,
} from './three/scene.js';

// ── Helpers ──────────────────────────────────────────────────────────────
function mountHTML(el, html) {
  if (!el) return;
  el.replaceChildren(document.createRange().createContextualFragment(html));
}

// Spherical linear interpolation between unit vectors a and b
function slerp(a, b, t) {
  const d = THREE.MathUtils.clamp(a.dot(b), -1, 1);
  const omega = Math.acos(d);
  if (omega < 1e-6) return a.clone().lerp(b, t).normalize();
  const sinO = Math.sin(omega);
  const k1 = Math.sin((1 - t) * omega) / sinO;
  const k2 = Math.sin(t * omega) / sinO;
  return a.clone().multiplyScalar(k1).add(b.clone().multiplyScalar(k2));
}

const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

// ── Chapter definitions ─────────────────────────────────────────────────
const CHAPTERS = [
  {
    eyebrow: 'Modèle global initial',
    title: 'Avant le round',
    body: `Le modèle global <span class="lex">\\mathbf{x}_t</span> vit sur la variété <span class="lex">\\mathcal{M}</span>. Les <strong>k</strong> clients partent tous du même point.`,
    formula: '\\mathbf{x}_t \\in \\mathcal{M}',
    camera: { pos: [1.6, 1.0, 2.2], target: [0, 0, 0] },
    state: 'initial',
  },
  {
    eyebrow: 'Entraînement local',
    title: 'Les clients dérivent',
    body: `Chaque client effectue <span class="lex">\\tau</span> époques locales sur ses propres données. Les <strong>k</strong> trajectoires divergent — chaque client arrive à son propre <span class="lex">\\mathbf{x}^{(i)}_{t,\\tau}</span>.`,
    formula: '\\mathbf{x}^{(i)}_{t,\\tau} = \\mathrm{LocalTrain}\\!\\left(\\mathbf{x}_t,\\ \\mathcal{D}_i\\right)',
    camera: { pos: [1.6, 1.0, 2.2], target: [0, 0, 0] },
    state: 'drifted',
  },
  {
    eyebrow: 'Moyenne arithmétique',
    title: 'Le piège euclidien',
    body: `Si on moyenne les <span class="lex">\\mathbf{x}^{(i)}</span> comme FedAvg le ferait, on obtient un point <strong>à l'intérieur</strong> de la sphère — <em>hors variété</em>.`,
    formula: '\\bar{\\mathbf{x}} = \\tfrac{1}{k}\\sum_i \\mathbf{x}^{(i)}_{t,\\tau} \\notin \\mathcal{M}',
    camera: { pos: [1.2, 0.5, 2.5], target: [0, 0, 0] },
    state: 'mean',
  },
  {
    eyebrow: 'RFedProj',
    title: 'Projection sur la variété',
    body: `La règle RFedProj projette ce point sur la surface, donnant le nouveau modèle global <span class="lex">\\mathbf{x}_{t+1}</span>. Sur Stiefel, c'est un <strong>facteur polaire</strong> — une SVD réduite.`,
    formula: '\\mathbf{x}_{t+1} = P_\\mathcal{M}\\!\\left(\\bar{\\mathbf{x}}\\right)',
    camera: { pos: [1.2, 0.5, 2.5], target: [0, 0, 0] },
    state: 'projected',
  },
  {
    eyebrow: 'Round suivant',
    title: 'Le cycle reprend',
    body: `<span class="lex">\\mathbf{x}_{t+1}</span> est de retour sur <span class="lex">\\mathcal{M}</span>, prêt à être diffusé aux clients sélectionnés du prochain round.`,
    formula: '\\mathbf{x}_{t+1} \\in \\mathcal{M}',
    camera: { pos: [1.6, 1.0, 2.2], target: [0, 0, 0] },
    state: 'next',
  },
];

const PANEL_W = 580;

// ── Side panel ───────────────────────────────────────────────────────────
function FedPanel({ idx, chapter }) {
  const titleRef = useRef(null);
  const bodyRef = useRef(null);
  const formulaRef = useRef(null);

  useEffect(() => {
    mountHTML(titleRef.current, chapter.title);
    mountHTML(bodyRef.current, chapter.body.replace(/<span class="lex">([^<]+)<\/span>/g, (_, tex) => {
      const span = document.createElement('span');
      try { katex.render(tex, span, { throwOnError: false }); }
      catch { span.textContent = tex; }
      return span.outerHTML;
    }));
    if (formulaRef.current) {
      formulaRef.current.replaceChildren();
      try { katex.render(chapter.formula, formulaRef.current, { throwOnError: false, displayMode: true }); }
      catch { formulaRef.current.textContent = chapter.formula; }
    }
  });

  return (
    <div style={{
      position: 'absolute', right: 0, top: 0, bottom: 0, width: PANEL_W + 'px',
      padding: '72px 44px 48px 44px', boxSizing: 'border-box',
      display: 'flex', flexDirection: 'column', gap: '24px',
      background: 'linear-gradient(270deg, var(--bg) 0%, color-mix(in srgb, var(--bg) 92%, transparent) 65%, color-mix(in srgb, var(--bg) 40%, transparent) 100%)',
      borderLeft: '1px solid var(--rule-soft)',
      overflowY: 'auto', zIndex: 5, pointerEvents: 'auto',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: '20px', fontWeight: 500, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--accent)' }}>
          {chapter.eyebrow}
        </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: '20px', letterSpacing: '0.10em' }}>
          <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{String(idx + 1).padStart(2, '0')}</span>
          <span style={{ color: 'var(--ink-3)' }}>{' / ' + String(CHAPTERS.length).padStart(2, '0')}</span>
        </span>
      </div>

      <h2 ref={titleRef}
        style={{ fontFamily: 'var(--sans)', fontSize: '52px', lineHeight: 1.0, letterSpacing: '-0.025em', fontWeight: 600, margin: 0, color: 'var(--ink)' }} />

      <hr style={{ height: '1px', background: 'var(--rule-soft)', border: 0, margin: 0 }} />

      <div ref={bodyRef}
        style={{ fontFamily: 'var(--sans)', fontSize: '24px', lineHeight: 1.55, color: 'var(--ink-2)', letterSpacing: '-0.005em' }} />

      <div style={{
        background: 'var(--bg-2)', border: '1px solid var(--rule)', borderLeft: '3px solid var(--accent)',
        padding: '18px 20px', fontSize: '22px', color: 'var(--ink)', marginTop: 'auto',
      }}>
        <div ref={formulaRef} />
      </div>
    </div>
  );
}

// ── Main island ─────────────────────────────────────────────────────────
export function FedAggregation() {
  const hostRef = useRef(null);
  const [panel, setPanel] = useState({ idx: 0, chapter: CHAPTERS[0] });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let W = host.clientWidth  || 1920;
    let H = host.clientHeight || 900;
    let canvasW = Math.max(100, W - PANEL_W);

    const canvas = document.createElement('canvas');
    canvas.className = 'r-canvas';
    canvas.style.cssText = `display:block;position:absolute;top:0;bottom:0;left:0;right:${PANEL_W}px;width:auto;height:auto;`;
    host.appendChild(canvas);

    const labelLayer = document.createElement('div');
    labelLayer.style.cssText = `position:absolute;top:0;bottom:0;left:0;right:${PANEL_W}px;pointer-events:none;z-index:2;`;
    host.appendChild(labelLayer);

    const renderer = setupRenderer(canvas);
    const labelRenderer = new CSS2DRenderer({ element: labelLayer });
    renderer.setSize(canvasW, H);
    labelRenderer.setSize(canvasW, H);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, canvasW / H, 0.05, 50);
    camera.position.set(1.6, 1.0, 2.2);

    let palette = getPalette();
    setupLights(scene, palette);
    let sphere = buildSphere({ style: 'translucent', palette });
    scene.add(sphere);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.65;
    controls.minDistance = 1.6;
    controls.maxDistance = 6;
    controls.target.set(0, 0, 0);

    // ── Federated state ───────────────────────────────────────────────
    const K = 5; // clients
    // Initial global model (a slightly off-axis point so the geometry is clear)
    const globalStart = new THREE.Vector3(0.25, 0.55, 0.8).normalize();

    // Orthonormal tangent basis at globalStart, so clients can be placed at a
    // controlled angular distance around it.
    const _ref = Math.abs(globalStart.y) < 0.9
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(1, 0, 0);
    const e1 = _ref.clone().sub(globalStart.clone().multiplyScalar(_ref.dot(globalStart))).normalize();
    const e2 = new THREE.Vector3().crossVectors(globalStart, e1).normalize();

    // Spread the k clients across a WIDE cone (polar angle ≈ 60°) around the
    // global model. Far-apart unit vectors have a short average, so their
    // arithmetic (Euclidean) mean sits clearly INSIDE the sphere — the whole
    // point of the visualisation.
    const clientTargets = Array.from({ length: K }, (_, i) => {
      const phi   = i * (2 * Math.PI / K) + 0.6 * Math.sin(i * 2.3); // azimuth, slightly irregular
      const theta = 1.05 + 0.22 * Math.sin(i * 1.7);                  // angle from globalStart (~47°–73°)
      const tangent = e1.clone().multiplyScalar(Math.cos(phi))
        .add(e2.clone().multiplyScalar(Math.sin(phi)));
      return globalStart.clone().multiplyScalar(Math.cos(theta))
        .add(tangent.multiplyScalar(Math.sin(theta)))
        .normalize();
    });

    // ── Three.js objects ──────────────────────────────────────────────
    const fedGroup = new THREE.Group();
    scene.add(fedGroup);

    // Build a label
    const activeLabels = [];
    function makeLabel(text, position, color) {
      const div = document.createElement('div');
      div.className = 'world-label';
      div.style.cssText = `font-family:var(--mono);font-size:14px;letter-spacing:0.03em;color:${color || 'var(--ink)'};background:color-mix(in srgb, var(--bg) 80%, transparent);padding:2px 7px;border-radius:3px;white-space:nowrap;border:1px solid var(--rule-soft);`;
      div.textContent = text;
      const obj = new CSS2DObject(div);
      obj.position.copy(position);
      scene.add(obj);
      activeLabels.push({ obj, div });
      return {
        update(p) { obj.position.copy(p); },
        setText(t) { div.textContent = t; },
        setColor(c) { div.style.color = c; },
        setVisible(v) { div.style.display = v ? '' : 'none'; },
        remove() { scene.remove(obj); div.remove(); },
      };
    }

    // Client dots — distinct hues
    const CLIENT_COLORS = [0xd23b1c, 0xe89441, 0x4f9da6, 0x6f4e7c, 0x2a8c5a];
    const clientDots = Array.from({ length: K }, (_, i) => {
      const dot = buildDot({ position: globalStart, color: CLIENT_COLORS[i], radius: 0.034 });
      fedGroup.add(dot);
      return dot;
    });
    // Client trail (polyline from start to current position)
    const clientTrails = Array.from({ length: K }, (_, i) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(60 * 3), 3));
      geo.setDrawRange(0, 0);
      const mat = new THREE.LineBasicMaterial({
        color: CLIENT_COLORS[i], transparent: true, opacity: 0.55,
      });
      const line = new THREE.Line(geo, mat);
      fedGroup.add(line);
      return line;
    });

    // Global model marker (gold star — bigger)
    const globalMat = new THREE.MeshStandardMaterial({
      color: 0xfac738, emissive: 0xfac738, emissiveIntensity: 0.6, roughness: 0.3,
    });
    const globalDot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 24, 16), globalMat);
    globalDot.position.copy(globalStart);
    fedGroup.add(globalDot);

    // Centroid marker (gray — sits inside)
    const centroidMat = new THREE.MeshStandardMaterial({
      color: 0x888888, emissive: 0x888888, emissiveIntensity: 0.4, roughness: 0.4,
    });
    const centroidDot = new THREE.Mesh(new THREE.SphereGeometry(0.045, 24, 16), centroidMat);
    centroidDot.visible = false;
    fedGroup.add(centroidDot);

    // Spokes from clients to centroid (dashed lines)
    const spokeMat = new THREE.LineDashedMaterial({
      color: 0xaaaaaa, transparent: true, opacity: 0.5, dashSize: 0.04, gapSize: 0.03,
    });
    const spokes = Array.from({ length: K }, () => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const line = new THREE.Line(geo, spokeMat.clone());
      line.visible = false;
      fedGroup.add(line);
      return line;
    });

    // Projection arrow (centroid → new global on the sphere)
    let projectionArrow = null;
    function buildProjArrow(from, to) {
      if (projectionArrow) {
        fedGroup.remove(projectionArrow);
        projectionArrow.traverse(o => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) o.material.dispose();
        });
      }
      const dir = to.clone().sub(from);
      const len = dir.length();
      if (len < 1e-4) { projectionArrow = null; return; }
      projectionArrow = buildArrow({
        from, dir: dir.normalize(), length: len,
        color: getPalette().accentNum ?? 0xd23b1c,
        headLength: 0.05, headWidth: 0.035, radius: 0.006,
      });
      fedGroup.add(projectionArrow);
    }

    // Labels (created once, repositioned per state)
    const globalLabel = makeLabel('x_t (global)', globalStart.clone().multiplyScalar(1.15), '#fac738');
    const centroidLabel = makeLabel('arithmetic mean', new THREE.Vector3(0, 0, 0));
    centroidLabel.setVisible(false);
    const projectedLabel = makeLabel('x_{t+1}', new THREE.Vector3(0, 0, 0), '#d23b1c');
    projectedLabel.setVisible(false);

    // ── State / animation transitions ──────────────────────────────────
    // We animate per-state morph: 0..1 progress between current "pose" and target.
    const poses = {
      initial: () => clientDots.map(() => globalStart.clone()),
      drifted: () => clientTargets.map(t => t.clone()),
      mean:    () => clientTargets.map(t => t.clone()),
      projected: () => clientTargets.map(t => t.clone()),
      next:    () => clientTargets.map(t => t.clone()),
    };

    let currentPositions = poses.initial();
    let targetPositions = poses.initial();
    let morph = 1;
    let currentState = 'initial';

    // Trails: stored points per client (in world coords)
    const trailPoints = Array.from({ length: K }, () => [globalStart.clone()]);

    function setState(state, snap = false) {
      const prevPositions = currentPositions.map(p => p.clone());
      const newTargets = poses[state]();

      if (snap) {
        currentPositions = newTargets.map(p => p.clone());
        targetPositions = newTargets;
        morph = 1;
      } else {
        // Set up morph
        currentPositions = prevPositions;
        targetPositions = newTargets;
        morph = 0;
      }
      currentState = state;

      // Reset trails on transitions back to initial
      if (state === 'initial' || state === 'next') {
        for (let i = 0; i < K; i++) trailPoints[i] = [(state === 'next' ? targetPositions[i] : globalStart).clone()];
      }

      // Centroid + spokes visibility
      const showCentroid = state === 'mean' || state === 'projected';
      const showSpokes = showCentroid;
      const showProjection = state === 'projected';

      centroidDot.visible = showCentroid;
      centroidLabel.setVisible(showCentroid);
      spokes.forEach(s => { s.visible = showSpokes; });
      projectedLabel.setVisible(showProjection);

      // Update global model position for "next" state
      if (state === 'next') {
        const mean = newTargets.reduce((acc, p) => acc.add(p), new THREE.Vector3()).divideScalar(K);
        const projected = mean.clone().normalize();
        globalDot.position.copy(projected);
        globalLabel.update(projected.clone().multiplyScalar(1.18));
        // Move client dots to also coincide with new global
        for (let i = 0; i < K; i++) targetPositions[i] = projected.clone();
        if (snap) currentPositions = targetPositions.map(p => p.clone());
      }
    }

    function updateScene() {
      // Lerp client positions
      for (let i = 0; i < K; i++) {
        const a = currentPositions[i], b = targetPositions[i];
        // Use slerp if both are unit-length (they should be), else lerp
        let p;
        const aLen = a.length(), bLen = b.length();
        if (Math.abs(aLen - 1) < 0.05 && Math.abs(bLen - 1) < 0.05) {
          p = slerp(a, b, easeInOut(morph));
        } else {
          p = a.clone().lerp(b, easeInOut(morph));
        }
        clientDots[i].position.copy(p);

        // Trail update — only during the "drift" transition (to drifted state)
        if (currentState === 'drifted' && morph < 1) {
          const last = trailPoints[i][trailPoints[i].length - 1];
          if (last.distanceTo(p) > 0.012) trailPoints[i].push(p.clone());
        }
        const arr = clientTrails[i].geometry.attributes.position.array;
        const n = Math.min(trailPoints[i].length, 60);
        for (let j = 0; j < n; j++) {
          arr[j * 3]     = trailPoints[i][j].x;
          arr[j * 3 + 1] = trailPoints[i][j].y;
          arr[j * 3 + 2] = trailPoints[i][j].z;
        }
        clientTrails[i].geometry.setDrawRange(0, n);
        clientTrails[i].geometry.attributes.position.needsUpdate = true;
        clientTrails[i].computeLineDistances?.();
      }

      // Centroid (arithmetic mean) of CURRENT client positions
      const centroid = new THREE.Vector3();
      for (const p of clientDots.map(d => d.position)) centroid.add(p);
      centroid.divideScalar(K);
      centroidDot.position.copy(centroid);
      centroidLabel.update(centroid.clone().add(new THREE.Vector3(0.0, -0.07, 0)));

      // Spokes (clients → centroid)
      for (let i = 0; i < K; i++) {
        const pos = clientDots[i].position;
        const arr = spokes[i].geometry.attributes.position.array;
        arr[0] = pos.x; arr[1] = pos.y; arr[2] = pos.z;
        arr[3] = centroid.x; arr[4] = centroid.y; arr[5] = centroid.z;
        spokes[i].geometry.attributes.position.needsUpdate = true;
        spokes[i].computeLineDistances?.();
      }

      // Projection arrow + projected point
      if (currentState === 'projected') {
        const proj = centroid.clone().normalize();
        buildProjArrow(centroid, proj);
        projectedLabel.update(proj.clone().multiplyScalar(1.15));
      } else if (projectionArrow) {
        fedGroup.remove(projectionArrow);
        projectionArrow.traverse(o => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) o.material.dispose();
        });
        projectionArrow = null;
      }

      // Global label: pin to global dot
      globalLabel.update(globalDot.position.clone().multiplyScalar(1.18));
    }

    // ── Camera tween ───────────────────────────────────────────────────
    const camAnim = {
      active: false,
      fromPos: new THREE.Vector3(), toPos: new THREE.Vector3(),
      fromTgt: new THREE.Vector3(), toTgt: new THREE.Vector3(),
      t: 0, dur: 1.2,
    };
    function cameraTo(toPos, toTgt, snap) {
      if (snap) {
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

    let currentIdx = 0;
    function loadChapter(idx, snap) {
      currentIdx = idx;
      const chap = CHAPTERS[idx];
      setState(chap.state, snap);
      cameraTo(
        new THREE.Vector3(...chap.camera.pos),
        new THREE.Vector3(...chap.camera.target),
        snap,
      );
      setPanel({ idx, chapter: chap });
    }

    // ── RAF loop ───────────────────────────────────────────────────────
    const clock = new THREE.Clock();
    let rafId = null;
    function frame() {
      const dt = clock.getDelta();
      if (camAnim.active) {
        camAnim.t = Math.min(1, camAnim.t + dt / camAnim.dur);
        const k = easeInOut(camAnim.t);
        camera.position.lerpVectors(camAnim.fromPos, camAnim.toPos, k);
        controls.target.lerpVectors(camAnim.fromTgt, camAnim.toTgt, k);
        if (camAnim.t >= 1) camAnim.active = false;
      }
      // Morph
      if (morph < 1) {
        morph = Math.min(1, morph + dt / 1.0); // 1s transitions
      }
      controls.update();
      updateScene();
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
      rafId = requestAnimationFrame(frame);
    }

    const start = () => { if (!rafId) { clock.start(); rafId = requestAnimationFrame(frame); } };
    const stop  = () => { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } };

    const stage = document.querySelector('deck-stage');
    const onSlideChange = ({ detail: { slide, previousSlide } }) => {
      if (slide?.contains(host)) start();
      else if (previousSlide?.contains(host)) stop();
    };
    if (stage) stage.addEventListener('slidechange', onSlideChange);
    if (host.closest('[data-deck-active]')) start();

    // Step pacing via [data-step] markers
    function readStep() {
      const markers = [...host.querySelectorAll('i[data-step]')];
      const n = markers.filter(m => m.hasAttribute('data-step-visible')).length;
      const idx = Math.min(n, CHAPTERS.length - 1);
      if (idx !== currentIdx) loadChapter(idx, false);
    }
    const stepObs = new MutationObserver(readStep);
    stepObs.observe(host, {
      subtree: true, attributes: true, attributeFilter: ['data-step-visible'],
    });

    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        W = width | 0; H = height | 0;
        canvasW = Math.max(100, W - PANEL_W);
        renderer.setSize(canvasW, H);
        labelRenderer.setSize(canvasW, H);
        camera.aspect = canvasW / H;
        camera.updateProjectionMatrix();
      }
    });
    ro.observe(host);

    const onTheme = () => {
      palette = getPalette();
      scene.remove(sphere);
      sphere.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
          else o.material.dispose();
        }
      });
      sphere = buildSphere({ style: 'translucent', palette });
      scene.add(sphere);
    };
    document.documentElement.addEventListener('deck-theme-change', onTheme);

    // Initial chapter
    loadChapter(0, true);
    readStep();

    return () => {
      stop();
      stepObs.disconnect();
      ro.disconnect();
      if (stage) stage.removeEventListener('slidechange', onSlideChange);
      document.documentElement.removeEventListener('deck-theme-change', onTheme);
      for (const { obj, div } of activeLabels) { scene.remove(obj); div.remove(); }
      sphere.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
          else o.material.dispose();
        }
      });
      renderer.dispose();
      controls.dispose();
      host.removeChild(canvas);
      host.removeChild(labelLayer);
    };
  }, []);

  return (
    <div ref={hostRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      {CHAPTERS.slice(1).map((_, i) => (
        <i key={i} data-step style={{ display: 'none' }} />
      ))}
      <FedPanel key={panel.idx} idx={panel.idx} chapter={panel.chapter} />
    </div>
  );
}
