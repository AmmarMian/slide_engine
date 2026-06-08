// armagnac-t.jsx — ARMAGNAC parametric mean visualisation.
// Shows 2×2 SPD matrices A and H as ellipses, and Φ(t) = H #_t A morphing as
// t slides along [0, 1]. Self-paced animation loops 0 → 1 → 0 with pauses at
// the key values t=0 (harmonique), t=0.5 (GAH), t=1 (arithmétique).

import React, { useEffect, useRef, useState } from 'react';
import { renderMath } from '../math.js';

const ACCENT = 'var(--accent)';
const INK = 'var(--ink)';
const INK2 = 'var(--ink-2)';
const INK3 = 'var(--ink-3)';
const RULE_S = 'var(--rule-soft)';
const BG2 = 'var(--bg-2)';
const COL_A = '#2a6fb0'; // arithmétique  (blue)
const COL_H = '#b03a3a'; // harmonique    (red)
const COL_P = 'var(--accent)'; // Φ      (accent)

// ── 2×2 SPD math ──────────────────────────────────────────────────────────
// Matrix stored as [a, b, c] meaning [[a,b],[b,c]].

function eig2(m) {
  // Closed-form eigendecomposition of a 2×2 symmetric matrix.
  const [a, b, c] = m;
  const tr = a + c;
  const disc = Math.sqrt(Math.max(0, (a - c) * (a - c) + 4 * b * b));
  const l1 = (tr + disc) / 2;
  const l2 = (tr - disc) / 2;
  // Eigenvectors
  let v1x, v1y;
  if (Math.abs(b) > 1e-10) {
    v1x = b;
    v1y = l1 - a;
  } else {
    // Diagonal-ish — pick canonical eigenvector
    if (a >= c) { v1x = 1; v1y = 0; }
    else { v1x = 0; v1y = 1; }
  }
  const n1 = Math.hypot(v1x, v1y) || 1;
  v1x /= n1; v1y /= n1;
  // Second eigenvector is perpendicular
  const v2x = -v1y, v2y = v1x;
  return { l1, l2, v1: [v1x, v1y], v2: [v2x, v2y] };
}

function reconstruct(l1, l2, v1, v2) {
  // M = l1 v1 v1^T + l2 v2 v2^T
  const a = l1 * v1[0] * v1[0] + l2 * v2[0] * v2[0];
  const b = l1 * v1[0] * v1[1] + l2 * v2[0] * v2[1];
  const c = l1 * v1[1] * v1[1] + l2 * v2[1] * v2[1];
  return [a, b, c];
}

function matpow(m, p) {
  const { l1, l2, v1, v2 } = eig2(m);
  return reconstruct(Math.pow(Math.max(l1, 1e-12), p), Math.pow(Math.max(l2, 1e-12), p), v1, v2);
}

function matmul(m1, m2) {
  const [a1, b1, c1] = m1;
  const [a2, b2, c2] = m2;
  // m1 * m2  (2×2 with off-diag b1, b2)
  return [
    a1 * a2 + b1 * b2,
    a1 * b2 + b1 * c2,
    b1 * b2 + c1 * c2,
  ];
}

function symmetrize(m) {
  // Fix tiny numerical asymmetry; m is already [a,b,c]
  return m;
}

function geodesicMean(H, A, t) {
  // Φ = H^(1/2) * (H^(-1/2) A H^(-1/2))^t * H^(1/2)
  const Hhalf = matpow(H, 0.5);
  const Hmhalf = matpow(H, -0.5);
  const Q = matmul(Hmhalf, matmul(A, Hmhalf));
  const Qt = matpow(Q, t);
  return symmetrize(matmul(Hhalf, matmul(Qt, Hhalf)));
}

// ── Ellipse rendering ─────────────────────────────────────────────────────
// Each SPD M defines an ellipse {x : x^T M^(-1) x = 1} — semi-axes √λ along
// the eigenvectors.

function Ellipse({ M, cx, cy, scale, color, fillOpacity = 0.18, strokeOpacity = 0.95, strokeWidth = 2.5, dashed = false }) {
  const { l1, l2, v1 } = eig2(M);
  const rx = Math.sqrt(Math.max(l1, 1e-8)) * scale;
  const ry = Math.sqrt(Math.max(l2, 1e-8)) * scale;
  const angle = Math.atan2(v1[1], v1[0]) * 180 / Math.PI;
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${angle})`}>
      <ellipse rx={rx} ry={ry} fill={color} fillOpacity={fillOpacity}
        stroke={color} strokeWidth={strokeWidth} strokeOpacity={strokeOpacity}
        strokeDasharray={dashed ? '6 4' : 'none'} />
      {/* Axis ticks (semi-major) */}
      <line x1={-rx} y1="0" x2={rx} y2="0"
        stroke={color} strokeWidth="1" strokeOpacity="0.35" />
      <line x1="0" y1={-ry} x2="0" y2={ry}
        stroke={color} strokeWidth="1" strokeOpacity="0.35" />
    </g>
  );
}

// ── Test SPD matrices (intentionally distinct) ───────────────────────────
// A is "wide" (anisotropic, larger eigenvalue along ~30°)
const A_MAT = (() => {
  // Build A with eigenvalues l1=2.2, l2=0.6, rotated by 30°
  const c = Math.cos(Math.PI / 6), s = Math.sin(Math.PI / 6);
  return reconstruct(2.2, 0.6, [c, s], [-s, c]);
})();
// H is also anisotropic but along ~-40°, eigenvalues 1.6, 0.4
const H_MAT = (() => {
  const ang = -Math.PI * 40 / 180;
  const c = Math.cos(ang), s = Math.sin(ang);
  return reconstruct(1.6, 0.4, [c, s], [-s, c]);
})();

// ── Auto-play t controller ────────────────────────────────────────────────
function useTLoop(playing) {
  const [t, setT] = useState(0);
  const rafRef = useRef(null);
  const phaseRef = useRef({ phase: 'hold0', start: 0 });

  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    // Phases: hold0 (1s @ t=0) → ramp01 (3s) → hold1 (1s @ t=1) → ramp10 (3s) → loop
    const PHASES = [
      { name: 'hold0', dur: 1000, start: 0, end: 0 },
      { name: 'ramp01', dur: 3000, start: 0, end: 1 },
      { name: 'hold1', dur: 1000, start: 1, end: 1 },
      { name: 'ramp10', dur: 3000, start: 1, end: 0 },
    ];
    let phaseIdx = 0;
    let phaseStart = performance.now();

    const tick = (now) => {
      const phase = PHASES[phaseIdx];
      const elapsed = now - phaseStart;
      const k = Math.min(1, elapsed / phase.dur);
      const eased = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      setT(phase.start + (phase.end - phase.start) * eased);
      if (k >= 1) {
        phaseIdx = (phaseIdx + 1) % PHASES.length;
        phaseStart = now;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing]);

  return [t, setT];
}

// ── KaTeX rendering helper ───────────────────────────────────────────────
function MathBlock({ tex, display = false, style }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = '';
    const span = document.createElement('span');
    span.className = display ? 'math-display' : 'math';
    span.textContent = tex;
    ref.current.appendChild(span);
    renderMath();
  }, [tex, display]);
  return <div ref={ref} style={style} />;
}

// ── Main island ──────────────────────────────────────────────────────────
export function ArmagnacT() {
  const containerRef = useRef(null);
  const [playing, setPlaying] = useState(true);
  const [t, setT] = useTLoop(playing);

  // Reset when slide becomes active (and start playing)
  useEffect(() => {
    const section = containerRef.current?.closest('section, section-divider');
    if (!section) return;
    const stage = section.closest('deck-stage');
    const onChange = () => {
      if (section.hasAttribute('data-deck-active')) {
        setPlaying(true);
      } else {
        setPlaying(false);
      }
    };
    stage?.addEventListener('slidechange', onChange);
    return () => stage?.removeEventListener('slidechange', onChange);
  }, []);

  // Space toggles play/pause; left/right scrubs t
  useEffect(() => {
    const handler = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tgt = e.target;
      if (tgt && (tgt.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(tgt.tagName))) return;
      const section = containerRef.current?.closest('section, section-divider');
      if (!section?.hasAttribute('data-deck-active')) return;
      if (e.key === 'p' || e.key === 'P') {
        e.stopPropagation(); e.preventDefault();
        setPlaying(p => !p);
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []);

  // Compute current Φ
  const Phi = geodesicMean(H_MAT, A_MAT, t);

  // Determine which "key value" we're nearest to
  const labelKey =
    t < 0.05 ? 'harmonique (H)' :
      Math.abs(t - 0.5) < 0.04 ? 'GAH = H ½ A' :
        t > 0.95 ? 'arithmétique (A)' :
          null;

  return (
    <div ref={containerRef} style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg)',
    }}>
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 0 }}>

        {/* Left: ellipse visualisation */}
        <div style={{
          position: 'relative',
          padding: '32px',
          borderRight: `1px solid ${RULE_S}`,
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18 }}>
            <div className="eyebrow" style={{ color: ACCENT }}>Géodésique entre H et A</div>
            <div style={{ display: 'flex', gap: 22, fontFamily: 'var(--mono)', fontSize: 'calc(14px * var(--type-scale, 1))', color: INK3 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 14, height: 14, background: COL_H, borderRadius: 3, opacity: 0.7 }} /> H
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 14, height: 14, background: COL_A, borderRadius: 3, opacity: 0.7 }} /> A
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 14, height: 14, background: 'var(--accent)', borderRadius: 3 }} /> Φ(t)
              </div>
            </div>
          </div>

          {/* SVG canvas */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 720 540" style={{ width: '100%', height: '100%', maxWidth: 900, display: 'block' }}>
              {/* Subtle grid */}
              <defs>
                <pattern id="grid-arm" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke={RULE_S} strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="720" height="540" fill="url(#grid-arm)" />
              {/* Axes */}
              <line x1="0" y1="270" x2="720" y2="270" stroke={RULE_S} strokeWidth="1" strokeDasharray="3 5" />
              <line x1="360" y1="0" x2="360" y2="540" stroke={RULE_S} strokeWidth="1" strokeDasharray="3 5" />

              {/* H + A drawn at half opacity for context */}
              <Ellipse M={H_MAT} cx={360} cy={270} scale={60} color={COL_H} fillOpacity={0.07} strokeOpacity={0.35} strokeWidth={1.5} dashed />
              <Ellipse M={A_MAT} cx={360} cy={270} scale={60} color={COL_A} fillOpacity={0.07} strokeOpacity={0.35} strokeWidth={1.5} dashed />

              {/* Φ(t) — the morphing ellipse */}
              <Ellipse M={Phi} cx={360} cy={270} scale={60} color={'var(--accent)'} fillOpacity={0.22} strokeOpacity={1} strokeWidth={3} />

              {/* Center dot */}
              <circle cx="360" cy="270" r="3" fill={INK3} />
            </svg>
          </div>

          {/* t slider */}
          <div style={{ marginTop: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 'calc(14px * var(--type-scale, 1))', color: INK3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                t ∈ [0, 1]
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 'calc(32px * var(--type-scale, 1))', fontWeight: 600, color: ACCENT, lineHeight: 1 }}>
                {t.toFixed(2)}
              </div>
            </div>

            {/* Track */}
            <div style={{ position: 'relative', height: 36 }}>
              {/* base */}
              <div style={{ position: 'absolute', left: 0, right: 0, top: 16, height: 4, background: BG2, borderRadius: 2 }} />
              {/* filled */}
              <div style={{ position: 'absolute', left: 0, top: 16, height: 4, background: ACCENT, borderRadius: 2, width: `${t * 100}%`, transition: 'width 60ms linear' }} />
              {/* key markers */}
              {[
                { val: 0, label: 'H', color: COL_H },
                { val: 0.5, label: 'GAH', color: INK },
                { val: 1, label: 'A', color: COL_A },
              ].map(m => (
                <div key={m.val} style={{
                  position: 'absolute', left: `calc(${m.val * 100}% - 1px)`, top: 8,
                  width: 2, height: 20, background: m.color, opacity: 0.55,
                }}>
                  <div style={{
                    position: 'absolute', left: '50%', transform: 'translateX(-50%)',
                    top: 26, fontFamily: 'var(--mono)', fontSize: 'calc(12px * var(--type-scale, 1))', color: m.color,
                    whiteSpace: 'nowrap',
                  }}>{m.label}</div>
                </div>
              ))}
              {/* thumb */}
              <div style={{
                position: 'absolute', left: `calc(${t * 100}% - 9px)`, top: 9,
                width: 18, height: 18, borderRadius: '50%',
                background: ACCENT, border: '3px solid var(--bg)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
                transition: 'left 60ms linear',
              }} />
            </div>

            {labelKey && (
              <div style={{
                marginTop: 26, textAlign: 'center',
                fontFamily: 'var(--mono)', fontSize: 'calc(16px * var(--type-scale, 1))', letterSpacing: '0.04em', color: ACCENT,
              }}>
                Φ = {labelKey}
              </div>
            )}
          </div>
        </div>

        {/* Right: formula + interpretation panel */}
        <div style={{
          padding: '40px 48px',
          background: BG2,
          display: 'flex', flexDirection: 'column', gap: 22,
          overflow: 'hidden',
        }}>
          <div>
            <div className="eyebrow" style={{ color: ACCENT, marginBottom: 8 }}>La moyenne paramétrique</div>
            <h2 style={{ margin: 0, fontSize: 'calc(30px * var(--type-scale, 1))', fontFamily: 'var(--sans)', fontWeight: 600, letterSpacing: '-0.02em', color: INK }}>
              Φ(t) glisse entre H et A
            </h2>
          </div>

          <MathBlock display tex={'\\Phi(t) = H^{1/2} \\big(H^{-1/2} A H^{-1/2}\\big)^t H^{1/2}'} style={{ fontSize: 'calc(22px * var(--type-scale, 1))' }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 'calc(18px * var(--type-scale, 1))', color: INK2 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
              <span style={{ width: 95, flexShrink: 0, fontFamily: 'var(--mono)', color: INK3, whiteSpace: 'nowrap' }}>t = 0</span>
              <span>Φ = H — moyenne harmonique pure</span>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
              <span style={{ width: 95, flexShrink: 0, fontFamily: 'var(--mono)', color: INK3, whiteSpace: 'nowrap' }}>t = 0,5</span>
              <span>Φ = GAH — moyenne géométrique de A et H</span>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
              <span style={{ width: 95, flexShrink: 0, fontFamily: 'var(--mono)', color: INK3, whiteSpace: 'nowrap' }}>t = 1</span>
              <span>Φ = A — moyenne arithmétique pure</span>
            </div>
          </div>

          <div style={{
            marginTop: 'auto',
            padding: '18px 22px',
            background: 'var(--bg)',
            border: `1px solid ${RULE_S}`,
            borderLeft: `3px solid ${ACCENT}`,
            borderRadius: '0 6px 6px 0',
            fontSize: 'calc(17px * var(--type-scale, 1))', color: INK2, lineHeight: 1.55,
          }}>
            <strong>t est appris par descente de gradient</strong> — la passe arrière fournit
            <MathBlock tex={'\\partial \\ell / \\partial t'} style={{ display: 'inline-block', margin: '0 4px' }} />
            via une formule explicite (Daleckiĭ–Kreĭn). Aucune itération supplémentaire ; le réseau découvre <em>où</em> placer Φ entre H et A sur chaque couche.
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--mono)', fontSize: 'calc(12px * var(--type-scale, 1))', color: INK3, letterSpacing: '0.05em' }}>
            <span>{playing ? '▶ lecture' : '⏸ pause'} — touche P pour basculer</span>
          </div>
        </div>
      </div>
    </div>
  );
}
