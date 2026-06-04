// hsi-cov.jsx — Hyperspectral sliding-window covariance computation.
// A 16×16 false-color image with a 4×4 patch window that slides across.
// Five stages: image+window → signatures → centering → outer products → final cov.
// Designed for a tutorial feel — formulas appear at the bottom and the heatmap
// builds element-by-element through the outer-product sum.

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { renderMath } from '../math.js';

const ACCENT = 'var(--accent)';
const INK = 'var(--ink)';
const INK2 = 'var(--ink-2)';
const INK3 = 'var(--ink-3)';
const RULE_S = 'var(--rule-soft)';
const BG2 = 'var(--bg-2)';
const BG = 'var(--bg)';

// ── Synthetic hyperspectral image generator ──────────────────────────────
// 16×16 spatial grid, D = 8 spectral bands. Each pixel has a signature
// drawn from a small number of latent "materials".
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

function generateImage(W = 16, H = 16, D = 8, seed = 42) {
  const r = rng(seed);
  // Three latent material signatures
  const mats = [
    Array.from({ length: D }, (_, k) => 0.6 + 0.35 * Math.sin(0.4 * k + 0.5)),
    Array.from({ length: D }, (_, k) => 0.4 + 0.5 * Math.cos(0.6 * k)),
    Array.from({ length: D }, (_, k) => 0.55 + 0.25 * Math.sin(0.9 * k - 1.0)),
  ];
  // Spatial mixture weights — give the image visible "regions"
  const img = [];
  for (let y = 0; y < H; y++) {
    const row = [];
    for (let x = 0; x < W; x++) {
      // Region masks (smooth blobs)
      const w1 = Math.max(0, 1 - Math.hypot((x - 4) / 6, (y - 5) / 5));
      const w2 = Math.max(0, 1 - Math.hypot((x - 11) / 5, (y - 4) / 6));
      const w3 = Math.max(0, 1 - Math.hypot((x - 8) / 7, (y - 12) / 5));
      const ws = w1 + w2 + w3 + 0.05;
      const w = [w1 / ws, w2 / ws, w3 / ws];
      const sig = new Array(D);
      for (let k = 0; k < D; k++) {
        sig[k] = w[0] * mats[0][k] + w[1] * mats[1][k] + w[2] * mats[2][k] + (r() - 0.5) * 0.08;
      }
      row.push(sig);
    }
    img.push(row);
  }
  return img; // H × W × D
}

// ── Covariance helpers ───────────────────────────────────────────────────
// Each "pixel" is a D-vector; the window collects N = winSize² vectors.
// We compute mean, centered, outer-product accumulator, and final cov.

function patchVectors(img, x0, y0, winSize) {
  const vecs = [];
  for (let dy = 0; dy < winSize; dy++)
    for (let dx = 0; dx < winSize; dx++)
      vecs.push(img[y0 + dy][x0 + dx]);
  return vecs;
}

function mean(vecs) {
  const D = vecs[0].length;
  const m = new Array(D).fill(0);
  for (const v of vecs) for (let k = 0; k < D; k++) m[k] += v[k];
  for (let k = 0; k < D; k++) m[k] /= vecs.length;
  return m;
}

function centered(vecs, m) {
  return vecs.map(v => v.map((vi, k) => vi - m[k]));
}

function outerProduct(v) {
  const D = v.length;
  const M = Array.from({ length: D }, () => new Array(D).fill(0));
  for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) M[i][j] = v[i] * v[j];
  return M;
}

function addInto(M, A) {
  const D = M.length;
  for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) M[i][j] += A[i][j];
}

function divideBy(M, k) {
  const D = M.length;
  const out = Array.from({ length: D }, () => new Array(D).fill(0));
  for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) out[i][j] = M[i][j] / k;
  return out;
}

function covariance(vecs) {
  const m = mean(vecs);
  const c = centered(vecs, m);
  const acc = Array.from({ length: vecs[0].length }, () => new Array(vecs[0].length).fill(0));
  for (const cv of c) addInto(acc, outerProduct(cv));
  return divideBy(acc, vecs.length - 1);
}

// ── False-color rendering of pixel signature ─────────────────────────────
// Map bands 0,3,6 to R,G,B for visualisation.
function pixelToRGB(sig) {
  const r = Math.max(0, Math.min(255, Math.round(sig[1] * 255)));
  const g = Math.max(0, Math.min(255, Math.round(sig[4] * 255)));
  const b = Math.max(0, Math.min(255, Math.round(sig[6] * 230)));
  return `rgb(${r},${g},${b})`;
}

// ── Step content ─────────────────────────────────────────────────────────
const STEP_HTML = [
  // 0 — Image + fenêtre
  `<div class="eyebrow" style="color:var(--accent);margin-bottom:6px;">Étape 0 / 5</div>
   <h2 style="margin:0 0 14px;font-size:30px;font-family:var(--sans);font-weight:600;letter-spacing:-0.02em;">Une image, des signatures</h2>
   <p style="margin:0;font-size:18px;color:var(--ink-2);line-height:1.55;">
     Chaque pixel porte une <strong>signature spectrale</strong> de dimension D. Une <strong>fenêtre glissante</strong> de taille n × n collecte un voisinage de pixels — on va calculer la covariance de leurs signatures.
   </p>`,

  // 1 — Collecte les signatures
  `<div class="eyebrow" style="color:var(--accent);margin-bottom:6px;">Étape 1 / 5</div>
   <h2 style="margin:0 0 14px;font-size:30px;font-family:var(--sans);font-weight:600;letter-spacing:-0.02em;">Collecter les vecteurs</h2>
   <div class="math-display" style="margin:0 0 12px;font-size:22px;">\\{ \\mathbf{x}_1, \\ldots, \\mathbf{x}_N\\} \\;\\subset\\; \\mathbb{R}^D, \\quad N = n^2</div>
   <p style="margin:0;font-size:17px;color:var(--ink-3);">Les courbes en haut à droite — une signature par pixel de la fenêtre.</p>`,

  // 2 — Mean (centrage)
  `<div class="eyebrow" style="color:var(--accent);margin-bottom:6px;">Étape 2 / 5</div>
   <h2 style="margin:0 0 14px;font-size:30px;font-family:var(--sans);font-weight:600;letter-spacing:-0.02em;">Centrer autour de la moyenne</h2>
   <div class="math-display" style="margin:0 0 12px;font-size:22px;">\\bar{\\mathbf{x}} = \\tfrac{1}{N} \\sum_{i=1}^N \\mathbf{x}_i, \\qquad \\tilde{\\mathbf{x}}_i = \\mathbf{x}_i - \\bar{\\mathbf{x}}</div>
   <p style="margin:0;font-size:17px;color:var(--ink-3);">La moyenne (trait épais accent) sert de centre — chaque signature devient un <em>écart</em>.</p>`,

  // 3 — Outer products
  `<div class="eyebrow" style="color:var(--accent);margin-bottom:6px;">Étape 3 / 5</div>
   <h2 style="margin:0 0 14px;font-size:30px;font-family:var(--sans);font-weight:600;letter-spacing:-0.02em;">Produits extérieurs</h2>
   <div class="math-display" style="margin:0 0 12px;font-size:22px;">\\tilde{\\mathbf{x}}_i \\, \\tilde{\\mathbf{x}}_i^{\\!\\top} \\;\\in\\; \\mathbb{R}^{D \\times D}</div>
   <p style="margin:0;font-size:17px;color:var(--ink-3);">Chaque écart vectoriel produit une matrice de rang 1 — la heatmap s'accumule.</p>`,

  // 4 — Final covariance
  `<div class="eyebrow" style="color:var(--accent);margin-bottom:6px;">Étape 4 / 5</div>
   <h2 style="margin:0 0 14px;font-size:30px;font-family:var(--sans);font-weight:600;letter-spacing:-0.02em;">Moyenner — covariance</h2>
   <div class="math-display" style="margin:0 0 12px;font-size:22px;">\\hat{\\boldsymbol{\\Sigma}} \\;=\\; \\tfrac{1}{N-1} \\sum_{i=1}^N \\tilde{\\mathbf{x}}_i \\tilde{\\mathbf{x}}_i^{\\!\\top}</div>
   <p style="margin:0;font-size:17px;color:var(--ink-3);">Une matrice SPD de taille D × D, capturant les co-variations entre bandes spectrales.</p>`,

  // 5 — Sliding
  `<div class="eyebrow" style="color:var(--accent);margin-bottom:6px;">Étape 5 / 5</div>
   <h2 style="margin:0 0 14px;font-size:30px;font-family:var(--sans);font-weight:600;letter-spacing:-0.02em;">Glisser sur toute l'image</h2>
   <p style="margin:0;font-size:18px;color:var(--ink-2);line-height:1.55;">
     La fenêtre balaye l'image : on obtient <strong>une matrice SPD par position</strong>. C'est l'entrée typique d'un SPDNet en imagerie hyperspectrale.
   </p>`,
];

// ── KaTeX renderer ───────────────────────────────────────────────────────
function ExplainPanel({ step }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = STEP_HTML[step];
    renderMath();
  }, [step]);
  return <div ref={ref} style={{ padding: '24px 36px 18px', borderTop: `1px solid ${RULE_S}`, background: BG, height: 220, flexShrink: 0, overflow: 'hidden' }} />;
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

// ── Image viewer with sliding window ─────────────────────────────────────
function ImageView({ img, winX, winY, winSize, highlight }) {
  const H = img.length, W = img[0].length;
  const cell = 36;
  const padding = 8;
  const totalW = W * cell + padding * 2;
  const totalH = H * cell + padding * 2;
  return (
    <svg viewBox={`0 0 ${totalW} ${totalH}`} style={{ display: 'block', width: '100%', height: '100%' }}>
      {img.flatMap((row, y) => row.map((sig, x) => (
        <rect key={`${y}-${x}`} x={padding + x * cell} y={padding + y * cell} width={cell - 1} height={cell - 1}
          fill={pixelToRGB(sig)} stroke="rgba(0,0,0,0.05)" strokeWidth="0.5" />
      )))}
      {/* Sliding window — accent overlay */}
      <g style={{ transition: 'transform 600ms cubic-bezier(0.4, 0, 0.2, 1)', transform: `translate(${padding + winX * cell}px, ${padding + winY * cell}px)` }}>
        <rect x={-2} y={-2} width={winSize * cell + 4} height={winSize * cell + 4}
          fill="none" stroke={ACCENT} strokeWidth="3" rx="3" />
        {highlight && (
          <rect x={-2} y={-2} width={winSize * cell + 4} height={winSize * cell + 4}
            fill={ACCENT} fillOpacity="0.08" stroke="none" rx="3" />
        )}
        {/* corner ticks */}
        {[[0, 0], [winSize * cell, 0], [0, winSize * cell], [winSize * cell, winSize * cell]].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="3" fill={ACCENT} />
        ))}
      </g>
    </svg>
  );
}

// ── Signature plot ───────────────────────────────────────────────────────
function SignaturePlot({ vecs, meanVec, showMean, centered: showCentered }) {
  if (!vecs?.length) return null;
  const D = vecs[0].length;
  const W = 480, H = 220;
  const pad = { l: 36, r: 16, t: 16, b: 28 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  // y range: cover all data
  let yMin = Infinity, yMax = -Infinity;
  const dataSet = showCentered
    ? vecs.map(v => v.map((vi, k) => vi - (meanVec?.[k] ?? 0)))
    : vecs;
  for (const v of dataSet) for (const vi of v) { if (vi < yMin) yMin = vi; if (vi > yMax) yMax = vi; }
  if (showMean && !showCentered) for (const vi of meanVec) { if (vi < yMin) yMin = vi; if (vi > yMax) yMax = vi; }
  const range = yMax - yMin || 1;
  const xOf = k => pad.l + (k / (D - 1)) * iw;
  const yOf = v => pad.t + ih - ((v - yMin) / range) * ih;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%', height: '100%' }}>
      {/* zero line if centered */}
      {showCentered && (
        <line x1={pad.l} y1={yOf(0)} x2={W - pad.r} y2={yOf(0)}
          stroke={INK3} strokeWidth="1" strokeDasharray="3 4" opacity="0.5" />
      )}
      {/* axes */}
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={pad.t + ih} stroke={RULE_S} strokeWidth="1" />
      <line x1={pad.l} y1={pad.t + ih} x2={W - pad.r} y2={pad.t + ih} stroke={RULE_S} strokeWidth="1" />
      <text x={pad.l + iw / 2} y={H - 6} textAnchor="middle" fontFamily="var(--mono)" fontSize="11" fill={INK3}>bande spectrale</text>
      {/* lines */}
      {dataSet.map((v, i) => {
        const path = v.map((vi, k) => `${k === 0 ? 'M' : 'L'} ${xOf(k).toFixed(1)} ${yOf(vi).toFixed(1)}`).join(' ');
        return <path key={i} d={path} stroke={showCentered ? ACCENT : INK2} strokeWidth="1.5"
          opacity={showCentered ? 0.55 : 0.4} fill="none" />;
      })}
      {/* mean */}
      {showMean && !showCentered && meanVec && (
        <path d={meanVec.map((vi, k) => `${k === 0 ? 'M' : 'L'} ${xOf(k).toFixed(1)} ${yOf(vi).toFixed(1)}`).join(' ')}
          stroke={ACCENT} strokeWidth="3" fill="none" strokeLinejoin="round" />
      )}
    </svg>
  );
}

// ── Covariance heatmap (with progressive build) ──────────────────────────
function CovHeatmap({ M, label }) {
  if (!M?.length) return null;
  const D = M.length;
  const cell = 30;
  const pad = 8;
  const totalW = D * cell + pad * 2 + 30;
  const totalH = D * cell + pad * 2 + 30;
  let absMax = 1e-8;
  for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) absMax = Math.max(absMax, Math.abs(M[i][j]));
  return (
    <svg viewBox={`0 0 ${totalW} ${totalH}`} style={{ display: 'block', width: '100%', height: '100%' }}>
      {label && <text x={totalW / 2} y={14} textAnchor="middle" fontFamily="var(--mono)" fontSize="11" fill={INK3} letterSpacing="0.05em">{label}</text>}
      {M.flatMap((row, i) => row.map((v, j) => {
        const n = v / absMax;
        const op = Math.min(1, Math.abs(n));
        const fill = n >= 0 ? ACCENT : '#264052';
        return (
          <rect key={`${i}-${j}`} x={pad + 30 + j * cell} y={pad + 20 + i * cell} width={cell - 1} height={cell - 1}
            fill={fill} opacity={op}
            style={{ transition: 'opacity 280ms, fill 280ms' }} />
        );
      }))}
      {/* outer frame */}
      <rect x={pad + 30} y={pad + 20} width={D * cell} height={D * cell}
        fill="none" stroke={INK3} strokeWidth="1" opacity="0.4" />
    </svg>
  );
}

// ── Main island ──────────────────────────────────────────────────────────
export function HsiCov() {
  const containerRef = useRef(null);
  const [step, setStep] = useState(0);
  const [winX, setWinX] = useState(3);
  const [winY, setWinY] = useState(4);
  const [sliding, setSliding] = useState(false);
  // Outer-product accumulator (progressive build)
  const [accIdx, setAccIdx] = useState(0);
  const MAX_STEP = STEP_HTML.length - 1;

  const WIN = 4;
  const D = 8;
  const img = useMemo(() => generateImage(16, 16, D, 42), []);

  const vecs = useMemo(() => patchVectors(img, winX, winY, WIN), [img, winX, winY]);
  const m = useMemo(() => mean(vecs), [vecs]);
  const c = useMemo(() => centered(vecs, m), [vecs, m]);
  const fullCov = useMemo(() => covariance(vecs), [vecs]);

  // Progressive cov build during step 3 (outer products)
  const partialCov = useMemo(() => {
    if (step < 3) return null;
    if (step >= 4) return fullCov;
    const acc = Array.from({ length: D }, () => new Array(D).fill(0));
    const k = Math.min(accIdx, c.length);
    for (let i = 0; i < k; i++) addInto(acc, outerProduct(c[i]));
    return divideBy(acc, Math.max(1, vecs.length - 1));
  }, [step, accIdx, c, fullCov, vecs.length, D]);

  // Drive outer-product accumulation when step === 3
  useEffect(() => {
    if (step !== 3) return;
    setAccIdx(0);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setAccIdx(i);
      if (i >= c.length) clearInterval(interval);
    }, 80);
    return () => clearInterval(interval);
  }, [step, c.length]);

  // Sliding animation during step 5
  useEffect(() => {
    if (step !== 5) { setSliding(false); return; }
    setSliding(true);
    let x = 0, y = 0, dir = 1;
    const interval = setInterval(() => {
      x += dir;
      if (x >= 16 - WIN) { x = 16 - WIN; y += 1; dir = -1; }
      if (x <= 0 && dir === -1) { x = 0; y += 1; dir = 1; }
      if (y > 16 - WIN) { y = 0; }
      setWinX(x);
      setWinY(y);
    }, 700);
    return () => { clearInterval(interval); setSliding(false); };
  }, [step]);

  // Reset window position when leaving step 5
  useEffect(() => {
    if (step !== 5 && step >= 1) { setWinX(3); setWinY(4); }
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

  const showSignatures = step >= 1;
  const showMean = step >= 2 && step < 3;
  const showCentered = step >= 3;
  const showCov = step >= 3;
  const fullCovOnly = step >= 4;

  return (
    <div ref={containerRef} style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      background: BG,
    }}>
      {/* Main visual area */}
      <div style={{
        flex: 1, minHeight: 0,
        display: 'grid',
        gridTemplateColumns: '1.1fr 1fr',
        gap: 0,
      }}>
        {/* Left: image + sliding window */}
        <div style={{
          padding: 28, display: 'flex', flexDirection: 'column', gap: 16,
          borderRight: `1px solid ${RULE_S}`,
          minHeight: 0,
        }}>
          <div className="eyebrow" style={{ color: ACCENT }}>
            Image hyperspectrale — {16}×{16} pixels, D = {D} bandes {sliding}
          </div>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ImageView img={img} winX={winX} winY={winY} winSize={WIN} highlight={showSignatures} />
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '10px 14px', background: BG2, borderRadius: 6,
            fontFamily: 'var(--mono)', fontSize: 13, color: INK3,
          }}>
            <span style={{ display: 'inline-block', width: 12, height: 12, background: ACCENT, borderRadius: 2 }} />
            <span>Fenêtre {WIN}×{WIN} → N = {WIN * WIN} vecteurs · position ({winX},{winY})</span>
          </div>
        </div>

        {/* Right: signatures + cov */}
        <div style={{
          padding: 28, display: 'flex', flexDirection: 'column', gap: 14,
          background: BG2, minHeight: 0,
        }}>
          {/* Signatures */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1.0, minHeight: 0 }}>
            <div className="eyebrow" style={{ color: INK3 }}>
              {showCentered ? 'Signatures centrées' : 'Signatures de la fenêtre'}
            </div>
            <div style={{ flex: 1, minHeight: 0, background: BG, borderRadius: 4, border: `1px solid ${RULE_S}`, overflow: 'hidden' }}>
              {showSignatures && (
                <SignaturePlot vecs={vecs} meanVec={m} showMean={showMean || step === 2} centered={showCentered} />
              )}
            </div>
          </div>
          {/* Cov matrix */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1.0, minHeight: 0 }}>
            <div className="eyebrow" style={{ color: INK3 }}>
              {step < 3 ? 'Covariance Σ ∈ ℝ^{D×D}' : (fullCovOnly ? 'Σ — finale' : `Σ — accumulation (${accIdx}/${c.length})`)}
            </div>
            <div style={{ flex: 1, minHeight: 0, background: BG, borderRadius: 4, border: `1px solid ${RULE_S}`, overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 8 }}>
              {showCov ? <CovHeatmap M={partialCov} /> : (
                <div style={{ color: INK3, fontFamily: 'var(--mono)', fontSize: 13, padding: 18, textAlign: 'center' }}>en attente — étapes à venir</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <StepPips step={step} total={STEP_HTML.length} />
      <ExplainPanel step={step} />
    </div>
  );
}
