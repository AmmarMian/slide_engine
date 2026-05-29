// eeg-cov.jsx — EEG spatial covariance computation tutorial.
// 8-channel time series with a 10-20-style head schematic. The covariance
// is computed across the FULL time window (spatial covariance between
// channels) and built progressively through five animated stages.

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { renderMath } from '../math.js';

const ACCENT = 'var(--accent)';
const INK    = 'var(--ink)';
const INK2   = 'var(--ink-2)';
const INK3   = 'var(--ink-3)';
const RULE_S = 'var(--rule-soft)';
const BG2    = 'var(--bg-2)';
const BG     = 'var(--bg)';

// ── PRNG ─────────────────────────────────────────────────────────────────
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── EEG channel layout (8 channels, ~10–20 positions on a unit circle) ──
// Coords in head-space (unit circle, head outline radius 1).
const CHANNEL_LAYOUT = [
  { name: 'Fp1', x: -0.30, y: -0.78 },
  { name: 'Fp2', x:  0.30, y: -0.78 },
  { name: 'C3',  x: -0.50, y: -0.05 },
  { name: 'Cz',  x:  0.00, y:  0.00 },
  { name: 'C4',  x:  0.50, y: -0.05 },
  { name: 'P3',  x: -0.50, y:  0.55 },
  { name: 'P4',  x:  0.50, y:  0.55 },
  { name: 'Oz',  x:  0.00, y:  0.80 },
];
const D = CHANNEL_LAYOUT.length;

// ── Generate synthetic multi-channel EEG ─────────────────────────────────
function generateEeg(T = 240, seed = 11) {
  const r = rng(seed);
  // Two latent rhythms shared across channels (alpha-band-ish + a beta-ish)
  const a1 = Array.from({ length: T }, (_, t) => Math.sin(2 * Math.PI * 0.06 * t + 0.7));
  const a2 = Array.from({ length: T }, (_, t) => Math.sin(2 * Math.PI * 0.16 * t - 1.2) * 0.7);
  // Spatial mixing — front vs back vs lateralised
  const mix = [
    [ 0.9,  0.3], //  Fp1
    [ 0.9, -0.3], //  Fp2
    [-0.2,  0.8], //  C3
    [ 0.0,  1.0], //  Cz
    [-0.2, -0.8], //  C4
    [ 0.6, -0.5], //  P3
    [-0.6,  0.5], //  P4
    [ 0.3,  0.0], //  Oz
  ];
  const signal = [];
  for (let c = 0; c < D; c++) {
    const m = mix[c];
    const ch = new Array(T);
    let drift = 0;
    for (let t = 0; t < T; t++) {
      drift += (r() - 0.5) * 0.05;
      drift *= 0.96;
      ch[t] = m[0] * a1[t] + m[1] * a2[t] + (r() - 0.5) * 0.18 + drift;
    }
    signal.push(ch);
  }
  return signal; // D × T
}

// ── Covariance helpers ───────────────────────────────────────────────────
function rowMean(row) {
  let s = 0;
  for (const v of row) s += v;
  return s / row.length;
}
function spatialCov(signal) {
  // signal is D × T. Cov_ij = (1/(T-1)) Σ_t (x_it - x̄_i)(x_jt - x̄_j)
  const T = signal[0].length;
  const means = signal.map(rowMean);
  const C = Array.from({ length: D }, () => new Array(D).fill(0));
  for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) {
    let s = 0;
    for (let t = 0; t < T; t++) s += (signal[i][t] - means[i]) * (signal[j][t] - means[j]);
    C[i][j] = s / (T - 1);
  }
  return C;
}

// ── Step content ─────────────────────────────────────────────────────────
const STEP_HTML = [
  // 0 — Intro
  `<div class="eyebrow" style="color:var(--accent);margin-bottom:6px;">Étape 0 / 4</div>
   <h2 style="margin:0 0 14px;font-size:30px;font-family:var(--sans);font-weight:600;letter-spacing:-0.02em;">D canaux, T instants</h2>
   <p style="margin:0;font-size:18px;color:var(--ink-2);line-height:1.55;">
     L'EEG fournit D = ${D} signaux corrélés. La covariance <strong>spatiale</strong> capture comment chaque paire de canaux co-varie au cours du temps.
   </p>`,
  // 1 — Center
  `<div class="eyebrow" style="color:var(--accent);margin-bottom:6px;">Étape 1 / 4</div>
   <h2 style="margin:0 0 14px;font-size:30px;font-family:var(--sans);font-weight:600;letter-spacing:-0.02em;">Centrer chaque canal</h2>
   <div class="math-display" style="margin:0 0 12px;font-size:22px;">\\tilde{x}_i(t) = x_i(t) - \\bar{x}_i, \\quad \\bar{x}_i = \\tfrac{1}{T} \\sum_t x_i(t)</div>
   <p style="margin:0;font-size:17px;color:var(--ink-3);">Une ligne de référence pour chaque canal — son niveau moyen.</p>`,
  // 2 — Pair products
  `<div class="eyebrow" style="color:var(--accent);margin-bottom:6px;">Étape 2 / 4</div>
   <h2 style="margin:0 0 14px;font-size:30px;font-family:var(--sans);font-weight:600;letter-spacing:-0.02em;">Co-variation par paire</h2>
   <div class="math-display" style="margin:0 0 12px;font-size:22px;">\\hat{\\Sigma}_{ij} \\;=\\; \\tfrac{1}{T-1} \\sum_{t=1}^T \\tilde{x}_i(t)\\, \\tilde{x}_j(t)</div>
   <p style="margin:0;font-size:17px;color:var(--ink-3);">Pour chaque paire (i, j), on intègre le produit des écarts — l'animation accumule un point à la fois.</p>`,
  // 3 — Full SPD matrix
  `<div class="eyebrow" style="color:var(--accent);margin-bottom:6px;">Étape 3 / 4</div>
   <h2 style="margin:0 0 14px;font-size:30px;font-family:var(--sans);font-weight:600;letter-spacing:-0.02em;">La matrice complète</h2>
   <div class="math-display" style="margin:0 0 12px;font-size:22px;">\\hat{\\boldsymbol{\\Sigma}} = \\tfrac{1}{T-1} \\tilde{X}\\tilde{X}^{\\!\\top} \\;\\in\\; \\mathcal{S}^{++}_D</div>
   <p style="margin:0;font-size:17px;color:var(--ink-3);">Symétrique, définie positive — l'entrée canonique d'un SPDNet pour BCI.</p>`,
  // 4 — Spatial topography
  `<div class="eyebrow" style="color:var(--accent);margin-bottom:6px;">Étape 4 / 4</div>
   <h2 style="margin:0 0 14px;font-size:30px;font-family:var(--sans);font-weight:600;letter-spacing:-0.02em;">Géométrie des connexions</h2>
   <p style="margin:0;font-size:18px;color:var(--ink-2);line-height:1.55;">
     Chaque entrée <span class="math">\\hat{\\Sigma}_{ij}</span> = une connexion topographique entre électrodes. La matrice porte la structure spatiale qu'un SPDNet apprend à exploiter.
   </p>`,
];

function ExplainPanel({ step }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = STEP_HTML[step];
    renderMath();
  }, [step]);
  return <div ref={ref} style={{ padding: '24px 36px 18px', borderTop: `1px solid ${RULE_S}`, background: BG, minHeight: 180 }} />;
}

function StepPips({ step, total }) {
  return (
    <div style={{ display: 'flex', gap: 6, padding: '10px 36px 0', background: BG }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{ flex: 1, height: 3, background: i <= step ? ACCENT : RULE_S, transition: 'background 200ms' }} />
      ))}
    </div>
  );
}

// ── EEG signal display ───────────────────────────────────────────────────
function SignalView({ signal, centered, highlightI, highlightJ, timeCursor }) {
  const T = signal[0].length;
  const W = 700, H = 380;
  const pad = { l: 60, r: 14, t: 12, b: 24 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const trackH = ih / D;
  const means = useMemo(() => signal.map(rowMean), [signal]);

  // Per-channel y range (so all traces fit nicely without overlap)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%', height: '100%' }}>
      {/* Track separators */}
      {signal.map((_, c) => (
        <line key={`sep-${c}`}
              x1={pad.l} y1={pad.t + c * trackH}
              x2={W - pad.r} y2={pad.t + c * trackH}
              stroke={RULE_S} strokeWidth="0.5" />
      ))}
      {/* Channel labels */}
      {CHANNEL_LAYOUT.map((ch, c) => {
        const isHl = c === highlightI || c === highlightJ;
        return (
          <text key={`lbl-${c}`} x={pad.l - 10} y={pad.t + c * trackH + trackH / 2 + 4}
                textAnchor="end" fontFamily="var(--mono)" fontSize="14"
                fill={isHl ? ACCENT : INK2} fontWeight={isHl ? 700 : 500}>{ch.name}</text>
        );
      })}
      {/* Mean lines (only when centering shown) */}
      {centered && signal.map((row, c) => {
        const y = pad.t + c * trackH + trackH / 2;
        return <line key={`mean-${c}`} x1={pad.l} y1={y} x2={W - pad.r} y2={y}
                     stroke={ACCENT} strokeWidth="0.8" strokeDasharray="2 4" opacity="0.4" />;
      })}
      {/* Channel signals */}
      {signal.map((row, c) => {
        const mu = means[c];
        const mn = Math.min(...row), mx = Math.max(...row);
        const range = Math.max(mx - mn, 1e-4);
        const yBase = pad.t + c * trackH + trackH / 2;
        const amp = trackH * 0.42;
        const center = (mn + mx) / 2;
        const path = row.map((v, t) => {
          const vAdj = centered ? (v - mu) : v;
          const refCenter = centered ? 0 : center;
          const refRange = centered ? Math.max(2 * Math.max(Math.abs(mx - mu), Math.abs(mu - mn)), 1e-4) : range;
          const x = pad.l + (t / (T - 1)) * iw;
          const y = yBase - ((vAdj - refCenter) / refRange) * 2 * amp;
          return `${t === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
        }).join(' ');
        const isHl = c === highlightI || c === highlightJ;
        return (
          <path key={`sig-${c}`} d={path}
                stroke={isHl ? ACCENT : INK2} strokeWidth={isHl ? 1.8 : 1}
                fill="none" opacity={isHl ? 1 : (highlightI != null ? 0.25 : 0.7)}
                style={{ transition: 'opacity 280ms, stroke 280ms, stroke-width 280ms' }} />
        );
      })}
      {/* Time cursor */}
      {timeCursor != null && (
        <line x1={pad.l + (timeCursor / (T - 1)) * iw} y1={pad.t}
              x2={pad.l + (timeCursor / (T - 1)) * iw} y2={pad.t + ih}
              stroke={ACCENT} strokeWidth="2" opacity="0.5" />
      )}
      <text x={pad.l + iw / 2} y={H - 6} textAnchor="middle"
            fontFamily="var(--mono)" fontSize="11" fill={INK3}>temps · T = {T} échantillons</text>
    </svg>
  );
}

// ── Head schematic with electrodes ───────────────────────────────────────
function HeadDiagram({ highlightI, highlightJ, sigmaIJ, absMax }) {
  const W = 280, H = 280;
  const cx = W / 2, cy = H / 2;
  const radius = 110;
  // Head outline + nose triangle
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%', height: '100%' }}>
      {/* Head outline */}
      <circle cx={cx} cy={cy} r={radius} fill={BG} stroke={INK2} strokeWidth="2" />
      {/* Nose */}
      <path d={`M ${cx - 14} ${cy - radius + 4} L ${cx} ${cy - radius - 14} L ${cx + 14} ${cy - radius + 4} Z`}
            fill={BG} stroke={INK2} strokeWidth="2" />
      {/* Ears */}
      <ellipse cx={cx - radius - 4} cy={cy} rx="8" ry="14" fill={BG} stroke={INK2} strokeWidth="2" />
      <ellipse cx={cx + radius + 4} cy={cy} rx="8" ry="14" fill={BG} stroke={INK2} strokeWidth="2" />

      {/* Connection line for highlighted pair */}
      {highlightI != null && highlightJ != null && highlightI !== highlightJ && (() => {
        const a = CHANNEL_LAYOUT[highlightI];
        const b = CHANNEL_LAYOUT[highlightJ];
        const ax = cx + a.x * radius * 0.92, ay = cy + a.y * radius * 0.92;
        const bx = cx + b.x * radius * 0.92, by = cy + b.y * radius * 0.92;
        const op = sigmaIJ != null && absMax > 0 ? Math.min(1, Math.abs(sigmaIJ) / absMax) : 0.6;
        const color = sigmaIJ != null && sigmaIJ < 0 ? '#264052' : ACCENT;
        return <line x1={ax} y1={ay} x2={bx} y2={by} stroke={color} strokeWidth="3" opacity={op} />;
      })()}

      {/* Electrodes */}
      {CHANNEL_LAYOUT.map((ch, i) => {
        const px = cx + ch.x * radius * 0.92;
        const py = cy + ch.y * radius * 0.92;
        const isHl = i === highlightI || i === highlightJ;
        return (
          <g key={ch.name}>
            <circle cx={px} cy={py} r={isHl ? 16 : 12}
                    fill={isHl ? ACCENT : BG2}
                    stroke={isHl ? ACCENT : INK2}
                    strokeWidth={isHl ? 2.5 : 1.5}
                    style={{ transition: 'r 200ms, fill 200ms, stroke 200ms' }} />
            <text x={px} y={py + 4} textAnchor="middle"
                  fontFamily="var(--mono)" fontSize="9"
                  fontWeight={isHl ? 700 : 500}
                  fill={isHl ? BG : INK2}>{ch.name}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Covariance heatmap (with progressive cell-by-cell build) ─────────────
function CovHeatmap({ M, highlightI, highlightJ, absMax }) {
  if (!M?.length) return null;
  const cell = 36;
  const labelPad = 30;
  const W = D * cell + labelPad + 10;
  const H = D * cell + labelPad + 10;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%', height: '100%' }}>
      {/* Column labels */}
      {CHANNEL_LAYOUT.map((ch, j) => (
        <text key={`cj-${j}`} x={labelPad + j * cell + cell / 2} y={labelPad - 8}
              textAnchor="middle" fontFamily="var(--mono)" fontSize="10"
              fill={j === highlightJ ? ACCENT : INK3}
              fontWeight={j === highlightJ ? 700 : 500}>{ch.name}</text>
      ))}
      {/* Row labels */}
      {CHANNEL_LAYOUT.map((ch, i) => (
        <text key={`ri-${i}`} x={labelPad - 8} y={labelPad + i * cell + cell / 2 + 4}
              textAnchor="end" fontFamily="var(--mono)" fontSize="10"
              fill={i === highlightI ? ACCENT : INK3}
              fontWeight={i === highlightI ? 700 : 500}>{ch.name}</text>
      ))}
      {/* Cells */}
      {M.flatMap((row, i) => row.map((v, j) => {
        const n = absMax > 0 ? v / absMax : 0;
        const op = Math.min(1, Math.abs(n));
        const fill = n >= 0 ? ACCENT : '#264052';
        const isHl = (i === highlightI && j === highlightJ) || (i === highlightJ && j === highlightI);
        return (
          <rect key={`${i}-${j}`}
                x={labelPad + j * cell} y={labelPad + i * cell}
                width={cell - 1.5} height={cell - 1.5}
                fill={fill} opacity={op}
                stroke={isHl ? ACCENT : 'none'}
                strokeWidth={isHl ? 2.5 : 0}
                style={{ transition: 'opacity 200ms' }} />
        );
      }))}
      <rect x={labelPad} y={labelPad} width={D * cell} height={D * cell}
            fill="none" stroke={INK3} strokeWidth="1" opacity="0.4" />
    </svg>
  );
}

// ── Main island ──────────────────────────────────────────────────────────
export function EegCov() {
  const containerRef = useRef(null);
  const [step, setStep] = useState(0);
  const [pairIdx, setPairIdx] = useState(0); // 0..D*D-1, advancing through (i,j) pairs at step 2
  const MAX_STEP = STEP_HTML.length - 1;

  const signal = useMemo(() => generateEeg(240, 11), []);
  const fullCov = useMemo(() => spatialCov(signal), [signal]);
  const absMax = useMemo(() => {
    let m = 1e-8;
    for (const r of fullCov) for (const v of r) m = Math.max(m, Math.abs(v));
    return m;
  }, [fullCov]);

  // Build a partial matrix during step 2 (pair-by-pair sweep)
  const partial = useMemo(() => {
    if (step < 2) return null;
    if (step >= 3) return fullCov;
    const M = Array.from({ length: D }, () => new Array(D).fill(0));
    const n = Math.min(pairIdx, D * D);
    for (let k = 0; k < n; k++) {
      const i = Math.floor(k / D), j = k % D;
      M[i][j] = fullCov[i][j];
    }
    return M;
  }, [step, pairIdx, fullCov]);

  const hlI = step >= 2 && step < 3 ? Math.floor(pairIdx / D) : null;
  const hlJ = step >= 2 && step < 3 ? pairIdx % D : null;
  const hlSigma = hlI != null && hlJ != null ? fullCov[hlI][hlJ] : null;

  // Sweep through (i,j) pairs during step 2
  useEffect(() => {
    if (step !== 2) return;
    setPairIdx(0);
    let k = 0;
    const interval = setInterval(() => {
      k++;
      setPairIdx(k);
      if (k >= D * D) clearInterval(interval);
    }, 120);
    return () => clearInterval(interval);
  }, [step]);

  // Keyboard control
  useEffect(() => {
    const handler = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const section = containerRef.current?.closest('section, section-divider');
      if (!section?.hasAttribute('data-deck-active')) return;
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        setStep(s => { if (s < MAX_STEP) { e.stopPropagation(); e.preventDefault(); return s + 1; } return s; });
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        setStep(s => { if (s > 0) { e.stopPropagation(); e.preventDefault(); return s - 1; } return s; });
      } else if (e.key === 'Home') setStep(0);
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []);

  useEffect(() => {
    const section = containerRef.current?.closest('section, section-divider');
    if (!section) return;
    const stage = section.closest('deck-stage');
    const onChange = () => { if (section.hasAttribute('data-deck-active')) setStep(0); };
    stage?.addEventListener('slidechange', onChange);
    return () => stage?.removeEventListener('slidechange', onChange);
  }, []);

  const centered = step >= 1;
  const showCov = step >= 2;

  return (
    <div ref={containerRef} style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      background: BG,
    }}>
      <div style={{
        flex: 1, minHeight: 0,
        display: 'grid',
        gridTemplateColumns: '1.3fr 0.7fr',
        gridTemplateRows: '1.2fr 1fr',
        gap: 0,
      }}>
        {/* Signals (spans 2 cols on top row) */}
        <div style={{
          gridColumn: '1 / span 2',
          padding: 24, display: 'flex', flexDirection: 'column', gap: 10,
          borderBottom: `1px solid ${RULE_S}`,
          minHeight: 0,
        }}>
          <div className="eyebrow" style={{ color: ACCENT }}>
            EEG multi-canal · {centered ? 'signaux centrés autour de leur moyenne' : 'signaux bruts'}
            {hlI != null && hlJ != null && (
              <span style={{ color: INK3, marginLeft: 12 }}>
                · paire en cours ({CHANNEL_LAYOUT[hlI].name}, {CHANNEL_LAYOUT[hlJ].name})
              </span>
            )}
          </div>
          <div style={{ flex: 1, minHeight: 0, background: BG2, borderRadius: 6, border: `1px solid ${RULE_S}`, overflow: 'hidden' }}>
            <SignalView signal={signal} centered={centered} highlightI={hlI} highlightJ={hlJ} timeCursor={null} />
          </div>
        </div>

        {/* Head diagram (left of bottom row) */}
        <div style={{
          padding: 24, display: 'flex', flexDirection: 'column', gap: 8,
          borderRight: `1px solid ${RULE_S}`,
          minHeight: 0,
        }}>
          <div className="eyebrow" style={{ color: INK3 }}>Topographie</div>
          <div style={{ flex: 1, minHeight: 0, background: BG2, borderRadius: 6, border: `1px solid ${RULE_S}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <HeadDiagram highlightI={hlI} highlightJ={hlJ} sigmaIJ={hlSigma} absMax={absMax} />
          </div>
        </div>

        {/* Cov matrix (right of bottom row) */}
        <div style={{
          padding: 24, display: 'flex', flexDirection: 'column', gap: 8,
          minHeight: 0, background: BG2,
        }}>
          <div className="eyebrow" style={{ color: INK3 }}>
            Covariance Σ ∈ ℝ^{D}×{D}
            {step === 2 && <span style={{ marginLeft: 10, color: ACCENT }}> · {Math.min(pairIdx, D * D)} / {D * D}</span>}
          </div>
          <div style={{ flex: 1, minHeight: 0, background: BG, borderRadius: 6, border: `1px solid ${RULE_S}`, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10 }}>
            {showCov ? <CovHeatmap M={partial} highlightI={hlI} highlightJ={hlJ} absMax={absMax} /> : (
              <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: INK3 }}>à venir</span>
            )}
          </div>
        </div>
      </div>

      <StepPips step={step} total={STEP_HTML.length} />
      <ExplainPanel step={step} />
    </div>
  );
}
