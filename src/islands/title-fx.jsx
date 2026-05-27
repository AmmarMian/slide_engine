// title-fx.jsx — switchable background animation for title slides.
// Mode is set by the titleFx theme preset and switches live via the tweaks panel.
//
// Modes: off | flow | constellation | dust | aurora | halftone
//
// Single canvas island; only the per-frame step() differs per mode.
// Lifecycle mirrors scatter-flow.jsx: only animates when the slide is active.
//
// Usage: <title-fx></title-fx>

import React, { useEffect, useRef } from 'react';

function seededRng(seed) {
  let s = (seed | 0) || 1;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

function hexToRgb(hex) {
  const h = (hex || '').trim().replace('#', '');
  if (h.length < 6) return [210, 59, 28];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// ── Renderers ─────────────────────────────────────────────────────────────────

function buildFlowRenderer(ctx, getDims, getColors) {
  const SEED = 7, COUNT = 180;
  const rng = seededRng(SEED);
  const F  = Array.from({ length: 9 }, () => rng() * 0.8 + 0.2);
  const Ph = Array.from({ length: 9 }, () => rng() * Math.PI * 2);
  const Dr = Array.from({ length: 3 }, () => (rng() * 2 - 1) * 0.00006);
  const A  = [1.0, 0.45, 0.18];

  const px = new Float32Array(COUNT), py = new Float32Array(COUNT);
  const ppx = new Float32Array(COUNT), ppy = new Float32Array(COUNT);
  const age = new Float32Array(COUNT), maxAge = new Float32Array(COUNT);
  const valid = new Uint8Array(COUNT);
  let t = 0;

  function init() {
    const [W, H] = getDims();
    const r = seededRng(SEED + 99);
    for (let i = 0; i < COUNT; i++) {
      px[i] = r() * W; py[i] = r() * H;
      ppx[i] = px[i]; ppy[i] = py[i];
      maxAge[i] = 220 + r() * 260;
      age[i] = r() * maxAge[i];
      valid[i] = 1;
    }
  }
  init();

  function psi(nx, ny) {
    const x = nx * 2.8, y = ny * 2.8;
    return (
      Math.sin(x * F[0] + y * F[1] + Ph[0] + t * Dr[0]) * A[0] +
      Math.cos(x * F[3] + y * F[4] + Ph[3] + t * Dr[1]) * A[1] +
      Math.sin(x * F[6] - y * F[7] + Ph[6] + t * Dr[2]) * A[2]
    );
  }
  const H_FD = 0.004;
  function vel(nx, ny) {
    const vx = (psi(nx, ny + H_FD) - psi(nx, ny - H_FD)) / (2 * H_FD);
    const vy = -(psi(nx + H_FD, ny) - psi(nx - H_FD, ny)) / (2 * H_FD);
    const l = Math.sqrt(vx * vx + vy * vy) || 1;
    return [vx / l, vy / l];
  }

  return {
    init,
    step() {
      const [W, H] = getDims();
      const { bg, accent: [ar, ag, ab] } = getColors();
      ctx.globalAlpha = 0.025; ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
      for (let i = 0; i < COUNT; i++) {
        ppx[i] = px[i]; ppy[i] = py[i];
        const [vx, vy] = vel(px[i] / W, py[i] / H);
        px[i] += vx * 0.9; py[i] += vy * 0.9;
        age[i]++;
        if (age[i] > maxAge[i] || px[i] < -10 || px[i] > W+10 || py[i] < -10 || py[i] > H+10) {
          px[i] = Math.random() * W; py[i] = Math.random() * H;
          ppx[i] = px[i]; ppy[i] = py[i]; age[i] = 0; valid[i] = 0; continue;
        }
        valid[i] = 1;
      }
      ctx.save(); ctx.lineCap = 'round';
      ctx.lineWidth = 4.5; ctx.strokeStyle = `rgba(${ar},${ag},${ab},0.18)`;
      ctx.beginPath();
      for (let i = 0; i < COUNT; i++) { if (!valid[i]) continue; ctx.moveTo(ppx[i], ppy[i]); ctx.lineTo(px[i], py[i]); }
      ctx.stroke();
      ctx.lineWidth = 1.3; ctx.strokeStyle = `rgba(${ar},${ag},${ab},0.48)`;
      ctx.beginPath();
      for (let i = 0; i < COUNT; i++) { if (!valid[i]) continue; ctx.moveTo(ppx[i], ppy[i]); ctx.lineTo(px[i], py[i]); }
      ctx.stroke();
      ctx.restore();
      t++;
    },
  };
}

function buildConstellationRenderer(ctx, getDims, getColors) {
  const COUNT = 90, LINK_DIST = 260, SPD = 0.4;
  const px = new Float32Array(COUNT), py = new Float32Array(COUNT);
  const vx = new Float32Array(COUNT), vy = new Float32Array(COUNT);

  function init() {
    const [W, H] = getDims();
    const r = seededRng(42);
    for (let i = 0; i < COUNT; i++) {
      px[i] = r() * W; py[i] = r() * H;
      const ang = r() * Math.PI * 2;
      vx[i] = Math.cos(ang) * SPD; vy[i] = Math.sin(ang) * SPD;
    }
  }
  init();

  return {
    init,
    step() {
      const [W, H] = getDims();
      const { bg, accent: [ar, ag, ab] } = getColors();
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < COUNT; i++) {
        px[i] = ((px[i] + vx[i]) % W + W) % W;
        py[i] = ((py[i] + vy[i]) % H + H) % H;
      }
      ctx.save();
      ctx.lineWidth = 0.9;
      // Links — per-pair stroke so alpha can vary with distance
      for (let i = 0; i < COUNT; i++) {
        for (let j = i + 1; j < COUNT; j++) {
          const dx = px[j] - px[i], dy = py[j] - py[i];
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < LINK_DIST) {
            ctx.strokeStyle = `rgba(${ar},${ag},${ab},${(1 - d / LINK_DIST) * 0.30})`;
            ctx.beginPath(); ctx.moveTo(px[i], py[i]); ctx.lineTo(px[j], py[j]); ctx.stroke();
          }
        }
      }
      // Dots
      ctx.fillStyle = `rgba(${ar},${ag},${ab},0.65)`;
      for (let i = 0; i < COUNT; i++) {
        ctx.beginPath(); ctx.arc(px[i], py[i], 2.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    },
  };
}

function buildDustRenderer(ctx, getDims, getColors) {
  const COUNT = 120;
  const px = new Float32Array(COUNT), py = new Float32Array(COUNT);
  const sz = new Float32Array(COUNT), spd = new Float32Array(COUNT);
  const phase = new Float32Array(COUNT);
  let t = 0;

  function init() {
    const [W, H] = getDims();
    const r = seededRng(13);
    for (let i = 0; i < COUNT; i++) {
      px[i] = r() * W; py[i] = r() * H;
      sz[i] = 1.5 + r() * 2.5;
      spd[i] = 0.12 + r() * 0.22;
      phase[i] = r() * Math.PI * 2;
    }
  }
  init();

  return {
    init,
    step() {
      const [W, H] = getDims();
      const { bg, accent: [ar, ag, ab], ink3: [ir, ig, ib] } = getColors();
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      ctx.save();
      for (let i = 0; i < COUNT; i++) {
        py[i] -= spd[i];
        px[i] += Math.sin(t * 0.008 + phase[i]) * 0.28;
        if (py[i] < -10) { py[i] = H + 5; px[i] = Math.random() * W; }
        const useAccent = i % 5 === 0;
        const alpha = 0.10 + 0.07 * Math.sin(t * 0.018 + phase[i]);
        ctx.beginPath();
        ctx.arc(px[i], py[i], sz[i], 0, Math.PI * 2);
        ctx.fillStyle = useAccent
          ? `rgba(${ar},${ag},${ab},${alpha})`
          : `rgba(${ir},${ig},${ib},${alpha * 1.5})`;
        ctx.fill();
      }
      ctx.restore();
      t++;
    },
  };
}

function buildAuroraRenderer(ctx, getDims, getColors) {
  const BLOBS = 6;
  const cx = new Float32Array(BLOBS), cy = new Float32Array(BLOBS);
  const tx = new Float32Array(BLOBS), ty = new Float32Array(BLOBS);
  const radii = new Float32Array(BLOBS);
  const alphas = new Float32Array(BLOBS);
  const speeds = new Float32Array(BLOBS);

  function init() {
    const [W, H] = getDims();
    const r = seededRng(55);
    const minR = Math.min(W, H) * 0.30;
    const maxR = Math.min(W, H) * 0.55;
    for (let i = 0; i < BLOBS; i++) {
      cx[i] = r() * W; cy[i] = r() * H;
      tx[i] = r() * W; ty[i] = r() * H;
      radii[i] = minR + r() * (maxR - minR);
      alphas[i] = 0.07 + r() * 0.08;
      speeds[i] = 0.003 + r() * 0.005;
    }
  }
  init();

  const rng = seededRng(55 + 7); // separate rng for target renewal
  // Advance past init calls so targets are fresh
  for (let i = 0; i < BLOBS * 5; i++) rng();

  return {
    init,
    step() {
      const [W, H] = getDims();
      const { bg, accent: [ar, ag, ab] } = getColors();
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      ctx.save();
      for (let i = 0; i < BLOBS; i++) {
        cx[i] += (tx[i] - cx[i]) * speeds[i];
        cy[i] += (ty[i] - cy[i]) * speeds[i];
        if (Math.hypot(tx[i] - cx[i], ty[i] - cy[i]) < 8) {
          tx[i] = rng() * W; ty[i] = rng() * H;
        }
        const grad = ctx.createRadialGradient(cx[i], cy[i], 0, cx[i], cy[i], radii[i]);
        grad.addColorStop(0,   `rgba(${ar},${ag},${ab},${alphas[i]})`);
        grad.addColorStop(0.5, `rgba(${ar},${ag},${ab},${alphas[i] * 0.4})`);
        grad.addColorStop(1,   `rgba(${ar},${ag},${ab},0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      }
      ctx.restore();
    },
  };
}

function buildHalftoneRenderer(ctx, getDims, getColors) {
  const GRID = 68;
  let t = 0;
  return {
    init() {},
    step() {
      const [W, H] = getDims();
      const { bg, accent: [ar, ag, ab] } = getColors();
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      ctx.save();
      const maxR = GRID * 0.40;
      const cx = W / 2, cy = H / 2;
      const cols = Math.ceil(W / GRID) + 2;
      const rows = Math.ceil(H / GRID) + 2;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = (col - 0.5) * GRID;
          const y = (row - 0.5) * GRID;
          const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
          const wave = Math.sin(dist * 0.0065 - t * 0.022) * 0.5 + 0.5;
          const r = maxR * wave;
          if (r < 0.6) continue;
          const alpha = 0.05 + wave * 0.20;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${ar},${ag},${ab},${alpha})`;
          ctx.fill();
        }
      }
      ctx.restore();
      t++;
    },
  };
}

function buildRenderer(mode, ctx, getDims, getColors) {
  switch (mode) {
    case 'flow':          return buildFlowRenderer(ctx, getDims, getColors);
    case 'constellation': return buildConstellationRenderer(ctx, getDims, getColors);
    case 'dust':          return buildDustRenderer(ctx, getDims, getColors);
    case 'aurora':        return buildAuroraRenderer(ctx, getDims, getColors);
    case 'halftone':      return buildHalftoneRenderer(ctx, getDims, getColors);
    default:              return null;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TitleFx() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const host = canvas.closest('title-fx');
    if (!host) return;

    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

    let W = 1920, H = 1080;
    const getDims   = () => [W, H];
    const getColors = () => {
      const s = getComputedStyle(document.documentElement);
      return {
        bg:     s.getPropertyValue('--bg').trim()     || '#f4f3ef',
        accent: hexToRgb(s.getPropertyValue('--accent').trim() || '#d23b1c'),
        ink3:   hexToRgb(s.getPropertyValue('--ink-3').trim()  || '#6e6e6e'),
        tint:   s.getPropertyValue('--tint').trim()   || '#ebe9e0',
      };
    };

    let rafId = null;
    let isActive = false;
    let currentMode = getComputedStyle(document.documentElement)
      .getPropertyValue('--fx-title').trim() || 'dust';
    let renderer = currentMode !== 'off' ? buildRenderer(currentMode, ctx, getDims, getColors) : null;

    const clearCanvas = () => {
      ctx.globalAlpha = 1;
      ctx.fillStyle = getColors().bg;
      ctx.fillRect(0, 0, W, H);
    };

    const frame = () => {
      if (renderer) renderer.step();
      rafId = requestAnimationFrame(frame);
    };

    const start = () => {
      if (rafId !== null || reducedMotion || !renderer) return;
      rafId = requestAnimationFrame(frame);
    };

    const stop = () => {
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    };

    const switchMode = (newMode) => {
      if (newMode === currentMode) return;
      stop();
      clearCanvas();
      currentMode = newMode;
      renderer = newMode !== 'off' ? buildRenderer(newMode, ctx, getDims, getColors) : null;
      if (isActive) start();
    };

    // Start immediately if the slide is already active at mount time
    if (host.closest('[data-deck-active]')) {
      isActive = true;
      start();
    }

    // Resize: rebuild the renderer so particles re-initialise for the new dimensions
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        W = width | 0; H = height | 0;
        canvas.width = W; canvas.height = H;
        clearCanvas();
        if (currentMode !== 'off') {
          renderer = buildRenderer(currentMode, ctx, getDims, getColors);
        }
      }
    });
    ro.observe(host);

    // Animate only while the slide is active (no wasted CPU on other slides)
    const stage = document.querySelector('deck-stage');
    const onSlideChange = ({ detail: { slide, previousSlide } }) => {
      if (slide?.contains(host))         { isActive = true;  start(); }
      else if (previousSlide?.contains(host)) { isActive = false; stop();  }
    };
    if (stage) stage.addEventListener('slidechange', onSlideChange);

    // Live mode switching from tweaks panel
    const onThemeChange = ({ detail }) => {
      if (detail?.titleFx !== undefined) switchMode(detail.titleFx);
    };
    document.documentElement.addEventListener('deck-theme-change', onThemeChange);

    return () => {
      stop();
      ro.disconnect();
      if (stage) stage.removeEventListener('slidechange', onSlideChange);
      document.documentElement.removeEventListener('deck-theme-change', onThemeChange);
    };
  }, []);

  return <canvas ref={canvasRef} style={{ display: 'block' }} />;
}
