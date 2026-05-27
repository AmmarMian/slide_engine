// particle-flow.jsx — accent-tinted particle traces on a curl-noise flow field.
//
// Uses a scalar stream-function (curl of a potential) so the field is divergence-free —
// particles follow smooth, organic streamlines like real fluid rather than a wavy grid.
// Lifecycle mirrors scatter-flow.jsx: only animates when the containing slide is active.
// Toggle: listens for the 'deck-theme-change' event emitted by apply-theme.js.
//
// Usage: <particle-flow count="700" speed="1" seed="7"></particle-flow>

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

export function ParticleFlow({ count = 180, speed = 1, seed = 7 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const host = canvas.closest('particle-flow');
    if (!host) return;

    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Seeded field parameters (frequencies, phases, drift rates, amplitudes)
    const rng = seededRng(seed);
    // Lower frequencies → larger, more sweeping curves with fewer vortices
    const F  = Array.from({ length: 9 }, () => rng() * 0.8 + 0.2);
    const Ph = Array.from({ length: 9 }, () => rng() * Math.PI * 2);
    const Dr = Array.from({ length: 3 }, () => (rng() * 2 - 1) * 0.00006); // very slow drift
    const A  = [1.0, 0.45, 0.18]; // octave amplitudes

    // Flat particle arrays
    const px    = new Float32Array(count);
    const py    = new Float32Array(count);
    const ppx   = new Float32Array(count);
    const ppy   = new Float32Array(count);
    const age   = new Float32Array(count);
    const maxAge = new Float32Array(count);
    const valid = new Uint8Array(count);

    let W = 1920, H = 1080;
    let t = 0;
    let rafId = null;
    let isActive = false;
    let isEnabled = true;

    function resizeCanvas(w, h) {
      W = w; H = h;
      canvas.width = W; canvas.height = H;
    }

    const rng2 = seededRng(seed + 99);
    function initParticles() {
      for (let i = 0; i < count; i++) {
        px[i] = rng2() * W; py[i] = rng2() * H;
        ppx[i] = px[i]; ppy[i] = py[i];
        maxAge[i] = 220 + rng2() * 260; // longer lifetimes so sparse traces build up
        age[i] = rng2() * maxAge[i]; // stagger so they don't all expire at once
        valid[i] = 1;
      }
    }
    initParticles();

    const css = () => getComputedStyle(document.documentElement);

    // Scalar stream function psi(nx, ny, t).
    // The curl of this potential gives a divergence-free velocity field —
    // vx = dpsi/dy, vy = -dpsi/dx — so particles trace smooth streamlines.
    function psi(nx, ny) {
      const x = nx * 2.8, y = ny * 2.8; // smaller scale = larger, more sweeping curves
      return (
        Math.sin(x * F[0] + y * F[1] + Ph[0] + t * Dr[0]) * A[0] +
        Math.cos(x * F[3] + y * F[4] + Ph[3] + t * Dr[1]) * A[1] +
        Math.sin(x * F[6] - y * F[7] + Ph[6] + t * Dr[2]) * A[2]
      );
    }

    // Central-difference gradient of psi → velocity direction.
    const H_FD = 0.004;
    function flowVelocity(nx, ny) {
      const vx =  (psi(nx, ny + H_FD) - psi(nx, ny - H_FD)) / (2 * H_FD);
      const vy = -(psi(nx + H_FD, ny) - psi(nx - H_FD, ny)) / (2 * H_FD);
      // Normalise so speed stays constant regardless of gradient magnitude
      const len = Math.sqrt(vx * vx + vy * vy) || 1;
      return [vx / len, vy / len];
    }

    function simStep() {
      const spd = speed * 0.9; // slow drift
      const style = css();
      const bg = style.getPropertyValue('--bg').trim() || '#f4f3ef';
      const accentHex = style.getPropertyValue('--accent').trim() || '#d23b1c';
      const [ar, ag, ab] = hexToRgb(accentHex);

      // Fade old trails — very low alpha so sparse traces persist
      ctx.globalAlpha = 0.025;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;

      // Advance every particle one step
      for (let i = 0; i < count; i++) {
        ppx[i] = px[i]; ppy[i] = py[i];
        const [vx, vy] = flowVelocity(px[i] / W, py[i] / H);
        px[i] += vx * spd;
        py[i] += vy * spd;
        age[i]++;

        if (age[i] > maxAge[i] || px[i] < -10 || px[i] > W + 10 || py[i] < -10 || py[i] > H + 10) {
          px[i] = Math.random() * W;
          py[i] = Math.random() * H;
          ppx[i] = px[i]; ppy[i] = py[i];
          age[i] = 0;
          valid[i] = 0; // skip drawing this frame to avoid a streak on respawn
          continue;
        }
        valid[i] = 1;
      }

      ctx.save();
      ctx.lineCap = 'round';

      // Glow pass — wide, soft halo in accent colour
      ctx.lineWidth = 4.5;
      ctx.strokeStyle = `rgba(${ar},${ag},${ab},0.18)`;
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        if (!valid[i]) continue;
        ctx.moveTo(ppx[i], ppy[i]);
        ctx.lineTo(px[i], py[i]);
      }
      ctx.stroke();

      // Core pass — thin, crisp trace
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = `rgba(${ar},${ag},${ab},0.48)`;
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        if (!valid[i]) continue;
        ctx.moveTo(ppx[i], ppy[i]);
        ctx.lineTo(px[i], py[i]);
      }
      ctx.stroke();

      ctx.restore();
      t++;
    }

    function frame() {
      simStep();
      rafId = requestAnimationFrame(frame);
    }

    function start() {
      if (rafId !== null || reducedMotion) return;
      rafId = requestAnimationFrame(frame);
    }

    function stop() {
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    }

    function clearCanvas() {
      ctx.globalAlpha = 1;
      ctx.fillStyle = css().getPropertyValue('--bg').trim() || '#f4f3ef';
      ctx.fillRect(0, 0, W, H);
    }

    // Check initial enabled state from CSS var written by apply-theme.js
    if (css().getPropertyValue('--fx-particles').trim() === '0') isEnabled = false;

    // Start immediately if the slide is already active at mount time
    if (host.closest('[data-deck-active]')) {
      isActive = true;
      if (isEnabled) start();
    }

    // Canvas sizing via ResizeObserver on the host element
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        resizeCanvas(width | 0, height | 0);
        clearCanvas();
        initParticles();
      }
    });
    ro.observe(host);

    // Animate only while our slide is active
    const stage = document.querySelector('deck-stage');
    const onSlideChange = ({ detail: { slide, previousSlide } }) => {
      if (slide?.contains(host)) {
        isActive = true;
        if (isEnabled) start();
      } else if (previousSlide?.contains(host)) {
        isActive = false;
        stop();
      }
    };
    if (stage) stage.addEventListener('slidechange', onSlideChange);

    // Respond to the tweaks-panel toggle live
    const onThemeChange = ({ detail }) => {
      isEnabled = (detail?.particles) !== false;
      if (!isEnabled) { stop(); clearCanvas(); }
      else if (isActive) start();
    };
    document.documentElement.addEventListener('deck-theme-change', onThemeChange);

    return () => {
      stop();
      ro.disconnect();
      if (stage) stage.removeEventListener('slidechange', onSlideChange);
      document.documentElement.removeEventListener('deck-theme-change', onThemeChange);
    };
  }, [count, speed, seed]);

  return <canvas ref={canvasRef} style={{ display: 'block' }} />;
}
