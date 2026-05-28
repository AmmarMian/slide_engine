// riemann-terrain.jsx — Riemannian geometry generalisation on a curved terrain.
// Stepped island using the same [data-step] mechanism as riemann-primer.
// Demonstrates that all S² concepts hold on any Riemannian manifold (ℳ, g).

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import katex from 'katex';

import { getPalette, setupRenderer, setupLights } from './three/scene.js';
import { buildTerrain, buildIsoGrid, buildGround, pickTerrain } from './three/terrain-scene.js';
import { CHAPTERS, DEFAULTS } from './three/terrain-chapters.js';

function mountHTML(el, html) {
  if (!el) return;
  el.replaceChildren(document.createRange().createContextualFragment(html));
}

function augmentPalette(p) {
  p.tWarm    = '#d97706';
  p.tCool    = '#3b6ea8';
  p.tNeutral = p.isDark ? '#3a3a3a' : '#dad5cc';
}

// ── Chapter panel overlay ─────────────────────────────────────────────────────

function TerrainPanel({ idx, chapter, handleRef }) {
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
        style={{ fontFamily: 'var(--sans)', fontSize: '52px', lineHeight: 1.0, letterSpacing: '-0.025em', fontWeight: 600, margin: 0, color: 'var(--ink)' }} />

      <hr style={{ height: '1px', background: 'var(--rule-soft)', border: 0, margin: 0 }} />

      <div ref={bodyRef}
        style={{ fontFamily: 'var(--sans)', fontSize: '24px', lineHeight: 1.55, color: 'var(--ink-2)', letterSpacing: '-0.005em' }} />

      {chapter.formula && (
        <div style={{
          background: 'var(--bg-2)', border: '1px solid var(--rule)', borderLeft: '3px solid var(--accent)',
          padding: '16px 18px', fontSize: '20px', color: 'var(--ink)',
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
          {'↳ click terrain to move '}
          <span style={{ color: 'var(--accent)' }}>{chapter.pickable === 'q' ? 'q' : 'p'}</span>
        </div>
      )}
    </div>
  );
}

// ── Main island ───────────────────────────────────────────────────────────────

const PANEL_W = 580;

export function RiemannTerrain() {
  const hostRef   = useRef(null);
  const handleRef = useRef(null);
  const [panel, setPanel] = useState({ idx: 0, chapter: CHAPTERS[0] });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const canvas     = host.querySelector('.rt-canvas');
    const labelLayer = host.querySelector('.rt-labels');
    const noMotion   = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let W = host.clientWidth  || 1920;
    let H = host.clientHeight || 900;
    let canvasW = Math.max(100, W - PANEL_W);

    const renderer      = setupRenderer(canvas);
    const labelRenderer = new CSS2DRenderer({ element: labelLayer });
    renderer.setSize(canvasW, H);
    labelRenderer.setSize(canvasW, H);

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, canvasW / H, 0.05, 80);
    camera.position.set(3.6, 2.8, 4.2);

    let palette = getPalette();
    augmentPalette(palette);
    setupLights(scene, palette);

    let surfaceStyle = 'translucent';
    let terrain  = buildTerrain({ style: surfaceStyle, palette });
    let isoGrid  = buildIsoGrid({ palette });
    const ground = buildGround({ palette });
    scene.add(terrain); scene.add(isoGrid); scene.add(ground);

    const chapGroup = new THREE.Group();
    chapGroup.name = 'chapter';
    scene.add(chapGroup);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping  = true;
    controls.dampingFactor  = 0.08;
    controls.rotateSpeed    = 0.65;
    controls.minDistance    = 2.0;
    controls.maxDistance    = 9.0;
    controls.enablePan      = false;
    controls.target.set(0, 0.15, 0);

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

    function rebuildTerrain(newStyle) {
      surfaceStyle = newStyle;
      scene.remove(terrain);
      terrain.userData.body.geometry.dispose();
      if (terrain.userData.body.material.dispose) terrain.userData.body.material.dispose();
      terrain = buildTerrain({ style: surfaceStyle, palette });
      scene.add(terrain);
      isoGrid.material.opacity = (surfaceStyle === 'curvature')
        ? palette.gridAlpha * 0.4
        : palette.gridAlpha * 0.9;
    }

    const camAnim = {
      active: false,
      fromPos: new THREE.Vector3(), toPos: new THREE.Vector3(),
      fromTgt: new THREE.Vector3(), toTgt: new THREE.Vector3(),
      t: 0, dur: 1.1,
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
      const chap = CHAPTERS[idx];

      // handle curvature surface switch
      const desiredStyle = chap.wantCurvatureSurface
        ? 'curvature'
        : (surfaceStyle === 'curvature' ? 'translucent' : surfaceStyle);
      if (terrain.userData.style !== desiredStyle) rebuildTerrain(desiredStyle);

      clearChapter();
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
      augmentPalette(palette);
      scene.remove(isoGrid);
      isoGrid.geometry.dispose(); isoGrid.material.dispose();
      isoGrid = buildIsoGrid({ palette });
      scene.add(isoGrid);
      rebuildTerrain(surfaceStyle);
      loadChapter(currentIdx, true);
    };
    document.documentElement.addEventListener('deck-theme-change', onTheme);

    // Click-to-pick
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
      const hit = pickTerrain(e, canvas, camera, terrain);
      if (!hit) return;
      // clamp to domain
      const L = 1.8 - 0.05;
      hit.x = Math.max(-L, Math.min(L, hit.x));
      hit.y = Math.max(-L, Math.min(L, hit.y));
      handleRef.current?.onPick?.(hit);
    });

    readStep();

    return () => {
      stop();
      stepObs.disconnect();
      ro.disconnect();
      if (stage) stage.removeEventListener('slidechange', onSlideChange);
      document.documentElement.removeEventListener('deck-theme-change', onTheme);
      clearChapter();
      scene.remove(terrain); scene.remove(isoGrid); scene.remove(ground);
      [terrain, isoGrid, ground].forEach(obj => obj.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
          else o.material.dispose();
        }
      }));
      renderer.dispose();
      controls.dispose();
    };
  }, []);

  return (
    <div ref={hostRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      {CHAPTERS.slice(1).map((_, i) => (
        <i key={i} data-step style={{ display: 'none' }} />
      ))}
      <canvas className="rt-canvas"
        style={{ display: 'block', position: 'absolute', top: 0, bottom: 0, left: 0, right: PANEL_W + 'px', width: 'auto', height: 'auto' }} />
      <div className="rt-labels"
        style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: PANEL_W + 'px', pointerEvents: 'none', zIndex: 2 }} />
      <TerrainPanel
        key={panel.idx}
        idx={panel.idx}
        chapter={panel.chapter}
        handleRef={handleRef}
      />
    </div>
  );
}
