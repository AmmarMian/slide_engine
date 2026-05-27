// riemann-primer.jsx — Riemannian geometry primer on S².
// Full-bleed Three.js scene stepped by the deck's [data-step] mechanism.
// Arrow presses cycle through 8 chapters with camera tweens.

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import katex from 'katex';

import { getPalette, setupRenderer, setupLights, buildSphere, pickSphere } from './three/scene.js';
import { CHAPTERS, DEFAULTS } from './three/primer-chapters.js';

// Mount developer-authored HTML into a DOM element without using innerHTML.
function mountHTML(el, html) {
  if (!el) return;
  el.replaceChildren(document.createRange().createContextualFragment(html));
}

// ── Chapter panel overlay ─────────────────────────────────────────────────────

function PrimerPanel({ idx, chapter, handleRef }) {
  const titleRef   = useRef(null);
  const bodyRef    = useRef(null);
  const formulaRef = useRef(null);

  useEffect(() => {
    mountHTML(titleRef.current, chapter.title);
    mountHTML(bodyRef.current, chapter.body);
    if (formulaRef.current) {
      formulaRef.current.replaceChildren();
      if (chapter.formula) {
        try {
          katex.render(chapter.formula, formulaRef.current, { throwOnError: false, displayMode: true });
        } catch {
          if (formulaRef.current) formulaRef.current.textContent = chapter.formula;
        }
      }
    }
  });

  return (
    <div style={{
      position: 'absolute', right: 0, top: 0, bottom: 0, width: '580px',
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
        style={{ fontFamily: 'var(--sans)', fontSize: '56px', lineHeight: 1.0, letterSpacing: '-0.025em', fontWeight: 600, margin: 0, color: 'var(--ink)' }} />

      <hr style={{ height: '1px', background: 'var(--rule-soft)', border: 0, margin: 0 }} />

      <div ref={bodyRef}
        style={{ fontFamily: 'var(--sans)', fontSize: '26px', lineHeight: 1.55, color: 'var(--ink-2)', letterSpacing: '-0.005em' }} />

      {chapter.formula && (
        <div style={{
          background: 'var(--bg-2)', border: '1px solid var(--rule)', borderLeft: '3px solid var(--accent)',
          padding: '18px 20px', fontSize: '22px', color: 'var(--ink)',
        }}>
          <div ref={formulaRef} />
        </div>
      )}

      {chapter.controlSchema && Object.entries(chapter.controlSchema).map(([name, sch]) => (
        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <label style={{ fontFamily: 'var(--mono)', fontSize: '18px', letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--ink-3)', minWidth: '96px', flexShrink: 0 }}>
            {sch.label || name}
          </label>
          <input type="range" min={sch.min} max={sch.max} step={sch.step} defaultValue={sch.value}
            style={{ flex: 1, accentColor: 'var(--accent)' }}
            onChange={e => handleRef.current?.onControl?.(name, Number(e.target.value))} />
        </div>
      ))}

      {chapter.pickable && (
        <div style={{ fontFamily: 'var(--mono)', fontSize: '18px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-3)', lineHeight: 1.6 }}>
          {'↳ click sphere to move '}
          <span style={{ color: 'var(--accent)' }}>{chapter.pickable === 'q' ? 'q' : 'p'}</span>
        </div>
      )}
    </div>
  );
}

// ── Main island ───────────────────────────────────────────────────────────────

const PANEL_W = 580;

export function RiemannPrimer() {
  const hostRef   = useRef(null);
  const handleRef = useRef(null);
  const [panel, setPanel] = useState({ idx: 0, chapter: CHAPTERS[0] });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const canvas     = host.querySelector('.r-canvas');
    const labelLayer = host.querySelector('.r-labels');
    const noMotion   = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let W = host.clientWidth  || 1920;
    let H = host.clientHeight || 900;
    let canvasW = Math.max(100, W - PANEL_W);

    const renderer      = setupRenderer(canvas);
    const labelRenderer = new CSS2DRenderer({ element: labelLayer });
    renderer.setSize(canvasW, H);
    labelRenderer.setSize(canvasW, H);

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, canvasW / H, 0.05, 50);
    camera.position.set(0, 0.55, 3.4);

    let palette = getPalette();
    setupLights(scene, palette);
    let sphere = buildSphere({ style: 'translucent', palette });
    scene.add(sphere);

    const chapGroup = new THREE.Group();
    chapGroup.name = 'chapter';
    scene.add(chapGroup);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping  = true;
    controls.dampingFactor  = 0.08;
    controls.rotateSpeed    = 0.65;
    controls.minDistance    = 1.6;
    controls.maxDistance    = 6;
    controls.enablePan      = true;
    controls.panSpeed       = 0.8;
    controls.target.set(0, 0, 0);

    // CSS2D labels
    const activeLabels = [];
    function makeLabel(text, position, opts = {}) {
      const div = document.createElement('div');
      div.className = 'world-label';
      if (opts.italic)    div.classList.add('italic');
      if (opts.small)     div.classList.add('small');
      if (opts.dim)       div.classList.add('dim');
      if (opts.accent)    div.classList.add('accent');
      if (opts.q)         div.classList.add('q-col');
      if (opts.tangent)   div.classList.add('tangent-col');
      if (opts.geo)       div.classList.add('geo-col');
      if (opts.transport) div.classList.add('transport-col');
      if (opts.retract)   div.classList.add('retract-col');
      mountHTML(div, text);
      const obj = new CSS2DObject(div);
      obj.position.copy(position);
      scene.add(obj);
      const l = {
        obj,
        update(p)  { obj.position.copy(p); },
        setText(t) { mountHTML(div, t); },
        remove()   { scene.remove(obj); div.remove(); },
      };
      activeLabels.push(l);
      return l;
    }

    function clearChapter() {
      while (chapGroup.children.length) {
        const c = chapGroup.children.pop();
        c.traverse(o => {
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

    // Camera tween (smoothstep5)
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

    const pState = DEFAULTS.P0.clone();
    const qState = DEFAULTS.Q0.clone();
    let currentIdx = 0;

    function loadChapter(idx, snap) {
      currentIdx = idx;
      clearChapter();
      const chap = CHAPTERS[idx];
      const ctx = {
        scene, group: chapGroup, palette,
        p: pState, q: qState,
        addLabel: makeLabel,
        requestRebuild() { loadChapter(currentIdx, true); },
      };
      const handle = chap.enter(ctx) || {};
      handleRef.current = handle;

      if (chap.camera) {
        cameraTo(
          new THREE.Vector3(...chap.camera.pos),
          new THREE.Vector3(...chap.camera.target),
          snap ?? noMotion,
        );
      }
      controls.autoRotate      = !!handle.autoRotate;
      controls.autoRotateSpeed = handle.autoRotate ? handle.autoRotate * 12 : 0;
      setPanel({ idx, chapter: chap });
    }

    // RAF loop
    const clock = new THREE.Clock();
    let elapsed = 0;
    let rafId   = null;

    function frame() {
      const dt = clock.getDelta();
      elapsed += dt;
      if (camAnim.active) {
        camAnim.t = Math.min(1, camAnim.t + dt / camAnim.dur);
        const x = camAnim.t;
        const k = x*x*x*(x*(x*6 - 15) + 10);
        camera.position.lerpVectors(camAnim.fromPos, camAnim.toPos, k);
        controls.target.lerpVectors(camAnim.fromTgt, camAnim.toTgt, k);
        if (camAnim.t >= 1) camAnim.active = false;
      }
      controls.update();
      handleRef.current?.tick?.(elapsed, dt);
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
      rafId = requestAnimationFrame(frame);
    }

    const start = () => { if (!rafId) { clock.start(); rafId = requestAnimationFrame(frame); } };
    const stop  = () => { if (rafId)  { cancelAnimationFrame(rafId); rafId = null; } };

    const stage = document.querySelector('deck-stage');
    const onSlideChange = ({ detail: { slide, previousSlide } }) => {
      if (slide?.contains(host))              start();
      else if (previousSlide?.contains(host)) stop();
    };
    if (stage) stage.addEventListener('slidechange', onSlideChange);
    if (host.closest('[data-deck-active]')) start();

    // Step pacing
    function readStep() {
      const markers = [...host.querySelectorAll('i[data-step]')];
      const n = markers.filter(m => m.hasAttribute('data-step-visible')).length;
      const idx = Math.min(n, CHAPTERS.length - 1);
      if (idx !== currentIdx) loadChapter(idx, noMotion);
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
      loadChapter(currentIdx, true);
    };
    document.documentElement.addEventListener('deck-theme-change', onTheme);

    let pdown = null;
    canvas.addEventListener('pointerdown', e => {
      pdown = { x: e.clientX, y: e.clientY, t: performance.now() };
    });
    canvas.addEventListener('pointerup', e => {
      if (!pdown) return;
      const dx = e.clientX - pdown.x, dy = e.clientY - pdown.y;
      const dt = performance.now() - pdown.t;
      pdown = null;
      if (Math.hypot(dx, dy) > 6 || dt > 350) return;
      if (!CHAPTERS[currentIdx]?.pickable) return;
      const hit = pickSphere(e, canvas, camera, 1.0);
      if (hit) handleRef.current?.onPick?.(hit.clone().normalize());
    });

    readStep();

    return () => {
      stop();
      stepObs.disconnect();
      ro.disconnect();
      if (stage) stage.removeEventListener('slidechange', onSlideChange);
      document.documentElement.removeEventListener('deck-theme-change', onTheme);
      clearChapter();
      sphere.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
          else o.material.dispose();
        }
      });
      renderer.dispose();
      controls.dispose();
    };
  }, []);

  return (
    <div ref={hostRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      {CHAPTERS.slice(1).map((_, i) => (
        <i key={i} data-step style={{ display: 'none' }} />
      ))}
      <canvas className="r-canvas"
        style={{ display: 'block', position: 'absolute', top: 0, bottom: 0, left: 0, right: PANEL_W + 'px', width: 'auto', height: 'auto' }} />
      <div className="r-labels"
        style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: PANEL_W + 'px', pointerEvents: 'none', zIndex: 2 }} />
      <PrimerPanel
        key={panel.idx}
        idx={panel.idx}
        chapter={panel.chapter}
        handleRef={handleRef}
      />
    </div>
  );
}
