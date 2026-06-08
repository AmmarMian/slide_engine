// gpr-scan.jsx — GPR A-scan / B-scan formation visualisation.
// Left: antenna sweeping over ground, pulse bouncing off a buried object.
// Right: B-scan assembling column by column; hyperbola annotated at end.

import React, { useRef, useEffect, useState, useCallback } from 'react';

// ── Scene constants ────────────────────────────────────────────────────────────
const SURFACE_Y  = 110;   // y of ground surface in left SVG
const OBJ_X      = 400;   // buried object x (in left SVG coords, W=800)
const OBJ_Y      = 370;   // buried object y
const OBJ_R      = 16;
const SVG_W      = 800;
const SVG_H      = 640;

const N_STEPS    = 38;
const AX_START   = 70;
const AX_END     = SVG_W - 70;
const STEP_DX    = (AX_END - AX_START) / (N_STEPS - 1);

// B-scan image size (pixels)
const BS_W = N_STEPS;     // one pixel column per step
const BS_H = 260;

// Pre-compute two-way travel distances, then normalise so max fits in BS_H.
const DISTS = Array.from({ length: N_STEPS }, (_, i) => {
  const ax = AX_START + i * STEP_DX;
  return Math.sqrt((ax - OBJ_X) ** 2 + (OBJ_Y - SURFACE_Y) ** 2);
});
const MAX_DIST = Math.max(...DISTS);

// Normalised travel-time pixel (0 → BS_H)
function tt(i) { return (DISTS[i] / MAX_DIST) * (BS_H * 0.82); }

// Build full B-scan: Float32Array per column
function buildBscan() {
  return Array.from({ length: N_STEPS }, (_, i) => {
    const col = new Float32Array(BS_H);
    const t0  = tt(i);
    for (let s = 0; s < BS_H; s++) {
      const dt = s - t0;
      col[s] = Math.exp(-(dt * dt) / 10) * Math.cos(dt * 1.1);
    }
    return col;
  });
}
const BSCAN = buildBscan();

// ── Component ──────────────────────────────────────────────────────────────────
export function GprScan() {
  const [step, setStep]   = useState(0);
  const [playing, setPlaying] = useState(true);
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);
  const lastRef   = useRef(null);
  const accRef    = useRef(0);

  // Draw B-scan columns 0..step onto the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cs  = getComputedStyle(document.documentElement);
    const accent = cs.getPropertyValue('--accent').trim()  || '#d23b1c';
    const ink2   = cs.getPropertyValue('--ink-2').trim()   || '#333';

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const cw = canvas.width / N_STEPS;

    for (let i = 0; i <= Math.min(step, N_STEPS - 1); i++) {
      const col = BSCAN[i];
      const x = i * cw;
      for (let s = 0; s < BS_H; s++) {
        const v = col[s];
        if (Math.abs(v) < 0.04) continue;
        ctx.fillStyle  = v > 0 ? accent : ink2;
        ctx.globalAlpha = Math.min(1, Math.abs(v) * 0.92);
        ctx.fillRect(x, s, cw + 0.5, 1);
      }
    }
    ctx.globalAlpha = 1;
  }, [step]);

  // Animation loop — advance one step every 110 ms, loop back to 0
  const tick = useCallback((ts) => {
    if (lastRef.current === null) lastRef.current = ts;
    accRef.current += ts - lastRef.current;
    lastRef.current = ts;
    if (accRef.current >= 110) {
      accRef.current = 0;
      setStep(s => (s >= N_STEPS - 1 ? 0 : s + 1));
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (!playing) return;
    lastRef.current = null;
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, tick]);

  // Reset and start/stop when the slide becomes active/inactive
  useEffect(() => {
    const stage = document.querySelector('deck-stage');
    if (!stage) return;
    const host = canvasRef.current?.closest('gpr-scan');
    const onSlideChange = (e) => {
      const { slide, previousSlide } = e.detail;
      if (host && slide?.contains(host)) {
        setStep(0); setPlaying(true);
      } else if (host && previousSlide?.contains(host)) {
        setPlaying(false);
      }
    };
    stage.addEventListener('slidechange', onSlideChange);
    // Pause immediately — only play when slide is active
    const active = stage.querySelector('[data-deck-active]');
    if (!host || !active?.contains(host)) setPlaying(false);
    return () => stage.removeEventListener('slidechange', onSlideChange);
  }, []);

  const restart = () => { setStep(0); setPlaying(true); };

  // Current antenna x in SVG coords
  const ax = AX_START + step * STEP_DX;

  // Pulse progress within this step (visual: ray depth)
  const rayDepth = OBJ_Y;   // draw full ray always once positioned

  // Canvas display size (CSS pixels — the canvas is scaled via CSS)
  const CANVAS_CSS_W = 460;
  const CANVAS_CSS_H = BS_H * (CANVAS_CSS_W / (N_STEPS * 12)); // aspect-correct

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', background: 'var(--bg)' }}>

      {/* ── Left: cross-section scene ─────────────────────────────── */}
      <div style={{ flex: '0 0 50%', minHeight: 0 }}>
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          style={{ width: '100%', height: '100%', display: 'block' }}>

          {/* Subsurface fill */}
          <rect x={0} y={SURFACE_Y} width={SVG_W} height={SVG_H - SURFACE_Y}
            fill="var(--bg-2)" opacity={0.55} />

          {/* Depth stratification lines */}
          {[60, 130, 200, 270].map(d => (
            <line key={d} x1={0} y1={SURFACE_Y + d} x2={SVG_W} y2={SURFACE_Y + d}
              stroke="var(--rule-soft)" strokeWidth={0.9} strokeDasharray="7 9" />
          ))}

          {/* Surface */}
          <line x1={0} y1={SURFACE_Y} x2={SVG_W} y2={SURFACE_Y}
            stroke="var(--ink-2)" strokeWidth={2.5} />
          <text x={12} y={SURFACE_Y - 12} fontFamily="var(--mono)" fontSize={13}
            fill="var(--ink-3)">surface du sol</text>

          {/* Depth axis */}
          <line x1={18} y1={SURFACE_Y} x2={18} y2={SVG_H - 20}
            stroke="var(--rule)" strokeWidth={1.2} />
          <text x={11} y={SURFACE_Y + (SVG_H - SURFACE_Y) / 2}
            fontFamily="var(--mono)" fontSize={12} fill="var(--ink-3)" textAnchor="middle"
            transform={`rotate(-90,11,${SURFACE_Y + (SVG_H - SURFACE_Y) / 2})`}>profondeur</text>

          {/* Past position ticks */}
          {Array.from({ length: step }, (_, i) => (
            <line key={i}
              x1={AX_START + i * STEP_DX} y1={SURFACE_Y - 8}
              x2={AX_START + i * STEP_DX} y2={SURFACE_Y}
              stroke="var(--ink-3)" strokeWidth={0.9} opacity={0.3} />
          ))}

          {/* Down-ray: antenna → object */}
          <line x1={ax} y1={SURFACE_Y} x2={OBJ_X} y2={OBJ_Y}
            stroke="var(--accent)" strokeWidth={1.8}
            strokeDasharray="7 5" opacity={0.65} />

          {/* Up-ray: object → antenna (symmetric, faded) */}
          <line x1={OBJ_X} y1={OBJ_Y} x2={ax} y2={SURFACE_Y}
            stroke="var(--ink-3)" strokeWidth={1.4}
            strokeDasharray="5 5" opacity={0.35} />

          {/* Expanding wavefront arc */}
          <circle cx={ax} cy={SURFACE_Y}
            r={Math.min(OBJ_Y - SURFACE_Y + OBJ_R, OBJ_Y - SURFACE_Y + 20)}
            fill="none" stroke="var(--accent)" strokeWidth={1.1} opacity={0.18}
            clipPath="url(#below-surface)" />
          <defs>
            <clipPath id="below-surface">
              <rect x={0} y={SURFACE_Y} width={SVG_W} height={SVG_H} />
            </clipPath>
          </defs>

          {/* Buried object */}
          <circle cx={OBJ_X} cy={OBJ_Y} r={OBJ_R + 8}
            fill="var(--bg)" stroke="var(--rule-soft)" strokeWidth={1} />
          <circle cx={OBJ_X} cy={OBJ_Y} r={OBJ_R}
            fill="var(--bg-2)" stroke="var(--accent)" strokeWidth={2.2} />
          <text x={OBJ_X} y={OBJ_Y + 4} fontFamily="var(--mono)" fontSize={11}
            fontWeight={700} fill="var(--accent)" textAnchor="middle">objet</text>

          {/* Antenna body */}
          <rect x={ax - 20} y={SURFACE_Y - 58} width={40} height={26}
            rx={4} fill="var(--bg-2)" stroke="var(--ink-2)" strokeWidth={2} />
          {/* Antenna cone (transmit direction) */}
          <polygon
            points={`${ax - 10},${SURFACE_Y - 32} ${ax + 10},${SURFACE_Y - 32} ${ax},${SURFACE_Y - 14}`}
            fill="var(--accent)" opacity={0.75} />
          <line x1={ax} y1={SURFACE_Y - 32} x2={ax} y2={SURFACE_Y}
            stroke="var(--ink-2)" strokeWidth={1.8} />
          <text x={ax} y={SURFACE_Y - 66} fontFamily="var(--mono)" fontSize={13}
            fontWeight={700} fill="var(--ink-2)" textAnchor="middle">antenne</text>
          {/* Motion arrow */}
          <text x={ax + 30} y={SURFACE_Y - 44}
            fontFamily="var(--sans)" fontSize={22} fill="var(--ink-2)">→</text>

          {/* A-scan dashed drop */}
          <line x1={ax} y1={SURFACE_Y} x2={ax} y2={SVG_H - 20}
            stroke="var(--accent)" strokeWidth={1.2} strokeDasharray="3 5" opacity={0.4} />

          {/* A-scan label */}
          <text x={ax} y={SVG_H - 6} fontFamily="var(--mono)" fontSize={13}
            fill="var(--accent)" textAnchor="middle">A-scan #{step + 1}</text>

        </svg>
      </div>

      {/* ── Right: B-scan panel ────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
        padding: '36px 40px 36px 24px', gap: 14, minHeight: 0 }}>

        <div>
          <div style={{ fontFamily: 'var(--sans)', fontSize: 24, fontWeight: 600,
            color: 'var(--ink)', marginBottom: 4 }}>B-scan</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--ink-3)' }}>
            assemblage des A-scans successifs
          </div>
        </div>

        {/* Canvas B-scan image */}
        <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          {/* Axis labels via SVG overlay */}
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%',
            pointerEvents: 'none', overflow: 'visible' }}>
            {/* Y axis */}
            <line x1={28} y1={0} x2={28} y2="80%" stroke="var(--rule)" strokeWidth={1.2} />
            {/* X axis */}
            <line x1={28} y1="80%" x2="100%" y2="80%" stroke="var(--rule)" strokeWidth={1.2} />
            <text x={14} y="40%" fontFamily="var(--mono)" fontSize={11} fill="var(--ink-3)"
              textAnchor="middle" transform="rotate(-90,14,40%)">temps (ns)</text>
            <text x="60%" y="95%" fontFamily="var(--mono)" fontSize={11} fill="var(--ink-3)"
              textAnchor="middle">position antenne →</text>
          </svg>

          {/* Canvas positioned inside the axis frame */}
          <div style={{ position: 'absolute', top: 0, left: 36, right: 0, bottom: '18%' }}>
            <canvas ref={canvasRef}
              width={N_STEPS * 12}
              height={BS_H}
              style={{ width: '100%', height: '100%', display: 'block',
                imageRendering: 'pixelated' }} />

            {/* Hyperbola SVG overlay (shown when done) */}
            {step === N_STEPS - 1 && (
              <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%',
                overflow: 'visible', pointerEvents: 'none' }}>
                <path
                  d={Array.from({ length: N_STEPS }, (_, i) => {
                    const x = (i / (N_STEPS - 1)) * 100;
                    const y = (tt(i) / BS_H) * 100;
                    return `${i === 0 ? 'M' : 'L'} ${x}% ${y}%`;
                  }).join(' ')}
                  fill="none" stroke="white" strokeWidth={2}
                  strokeDasharray="6 3" opacity={0.85} />
                <text x="50%" y={`${(tt(Math.floor(N_STEPS / 2)) / BS_H) * 100 - 3}%`}
                  fontFamily="var(--mono)" fontSize={12} fill="white"
                  textAnchor="middle" fontWeight={700}>hyperbole</text>
              </svg>
            )}
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
          <button onClick={restart}
            style={{ fontFamily: 'var(--mono)', fontSize: 13, padding: '6px 16px',
              background: 'var(--bg-2)', border: '1px solid var(--rule)',
              borderRadius: 6, color: 'var(--ink-2)', cursor: 'pointer' }}>
            ↺ rejouer
          </button>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-3)' }}>
            {step + 1} / {N_STEPS} positions
          </div>
        </div>
      </div>

    </div>
  );
}
