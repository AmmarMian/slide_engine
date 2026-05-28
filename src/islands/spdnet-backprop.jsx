// spdnet-backprop.jsx — full network forward + backward propagation animation
// for SPDNet. Forward pass plays as a glowing particle; backward pass plays as
// red gradients flowing right→left. Each step exposes the relevant local
// formula in the panel below.
//
// Controlled by arrow keys via the deck's normal step mechanism — listens to
// window keydown only when its containing slide is the active slide.

import React, { useEffect, useRef, useState } from 'react';
import { renderMath } from '../math.js';

const ACCENT = 'var(--accent)';
const INK    = 'var(--ink)';
const INK2   = 'var(--ink-2)';
const INK3   = 'var(--ink-3)';
const RULE   = 'var(--rule-soft)';
const BG2    = 'var(--bg-2)';
const RED    = '#d23b1c'; // explicit red for backward gradient — independent of accent

// ── Network specification ─────────────────────────────────────────────────
const LAYERS = [
  { id: 'in',   short: 'X',         kind: 'data',     hasParams: false },
  { id: 'bm1',  short: 'BiMap₁',    kind: 'bimap',    hasParams: true  },
  { id: 're1',  short: 'ReEig',     kind: 'nonparam', hasParams: false },
  { id: 'bm2',  short: 'BiMap₂',    kind: 'bimap',    hasParams: true  },
  { id: 'le',   short: 'LogEig',    kind: 'nonparam', hasParams: false },
  { id: 'fc',   short: 'FC',        kind: 'fc',       hasParams: true  },
  { id: 'loss', short: 'ℒ',         kind: 'loss',     hasParams: false },
];

const STEP_HTML = [
  // 0 — Architecture overview
  `<div class="eyebrow" style="color:var(--accent);margin-bottom:8px;">Étape 0 / 5 — Architecture</div>
   <h2 style="margin:0 0 16px;font-size:32px;font-family:var(--sans);font-weight:600;letter-spacing:-0.02em;">Le réseau SPDNet bout à bout</h2>
   <p style="margin:0;font-size:20px;color:var(--ink-2);line-height:1.5;">
     Données SPD <span class="math">\\mathbf{X}</span> en entrée, perte scalaire <span class="math">\\mathcal{L}</span> en sortie.
     Les couches en <span style="color:var(--accent);font-weight:600;">orange</span> portent des paramètres apprenables.
   </p>`,

  // 1 — Forward pass
  `<div class="eyebrow" style="color:var(--accent);margin-bottom:8px;">Étape 1 / 5 — Passe avant</div>
   <h2 style="margin:0 0 16px;font-size:32px;font-family:var(--sans);font-weight:600;letter-spacing:-0.02em;">Propagation des données</h2>
   <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;align-items:start;">
     <div>
       <div class="math-display" style="margin:0;font-size:22px;">X_k = W_k\\,X_{k-1}\\,W_k^\\top \\quad\\text{(BiMap)}</div>
       <div class="math-display" style="margin:12px 0 0;font-size:22px;">X_k = U\\max(\\varepsilon I,\\Sigma)U^\\top \\quad\\text{(ReEig)}</div>
     </div>
     <div>
       <div class="math-display" style="margin:0;font-size:22px;">X_K = \\log(X_{K-1}) \\quad\\text{(LogEig)}</div>
       <div class="math-display" style="margin:12px 0 0;font-size:22px;">\\mathcal{L} = -\\log p_y</div>
     </div>
   </div>`,

  // 2 — Loss reached
  `<div class="eyebrow" style="color:var(--accent);margin-bottom:8px;">Étape 2 / 5 — Perte</div>
   <h2 style="margin:0 0 16px;font-size:32px;font-family:var(--sans);font-weight:600;letter-spacing:-0.02em;">Erreur calculée</h2>
   <p style="margin:0;font-size:20px;color:var(--ink-2);line-height:1.6;">
     La perte <span class="math">\\mathcal{L}</span> est un scalaire. Sa dérivée par rapport à l'entrée du FC se calcule
     classiquement : <span class="math">\\partial \\mathcal{L} / \\partial \\mathrm{vec}(X_K)</span>.
     Il faut maintenant la <strong style="color:#d23b1c;">rétropropager</strong> à travers les couches SPD.
   </p>`,

  // 3 — Backward pass
  `<div class="eyebrow" style="color:#d23b1c;margin-bottom:8px;">Étape 3 / 5 — Rétropropagation matricielle</div>
   <h2 style="margin:0 0 16px;font-size:32px;font-family:var(--sans);font-weight:600;letter-spacing:-0.02em;">Gradients à travers eig &amp; log</h2>
   <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;align-items:start;">
     <div>
       <div style="font-size:17px;color:var(--ink-3);letter-spacing:0.05em;text-transform:uppercase;font-family:var(--mono);margin-bottom:8px;">LogEig / ReEig</div>
       <div class="math-display" style="margin:0;font-size:19px;">\\tfrac{\\partial \\mathcal{L}}{\\partial X} = U\\!\\left(P \\odot \\left(U^\\top \\tfrac{\\partial \\mathcal{L}}{\\partial U}\\right) + \\mathrm{diag}\\!\\left(\\tfrac{\\partial \\mathcal{L}}{\\partial \\Sigma}\\right)\\right)\\! U^\\top</div>
     </div>
     <div>
       <div style="font-size:17px;color:var(--ink-3);letter-spacing:0.05em;text-transform:uppercase;font-family:var(--mono);margin-bottom:8px;">BiMap</div>
       <div class="math-display" style="margin:0;font-size:19px;">\\nabla_{W_k}\\mathcal{L} = 2\\,\\tfrac{\\partial \\mathcal{L}}{\\partial X_k}\\, W_k\\, X_{k-1}</div>
       <div style="font-size:16px;color:var(--ink-3);margin-top:8px;font-family:var(--mono);">→ gradient <em>euclidien</em>, ignore Stiefel</div>
     </div>
   </div>`,

  // 4 — Gradient localized at BiMap weights, but it's euclidean
  `<div class="eyebrow" style="color:#d23b1c;margin-bottom:8px;">Étape 4 / 5 — Le problème</div>
   <h2 style="margin:0 0 16px;font-size:32px;font-family:var(--sans);font-weight:600;letter-spacing:-0.02em;">Les gradients sont hors variété</h2>
   <p style="margin:0;font-size:20px;color:var(--ink-2);line-height:1.6;">
     On a un <span class="math">\\nabla_{W_k}\\mathcal{L} \\in \\mathbb{R}^{d_{k-1}\\times d_k}</span> par couche BiMap, mais
     <span class="math">W_k</span> est contraint à <span class="math">\\mathrm{St}(d_{k-1}, d_k)</span> : un pas <span class="math">W_k - \\eta\\,\\nabla_{W_k}\\mathcal{L}</span>
     <strong style="color:#d23b1c;">sort de la variété</strong>.
   </p>`,

  // 5 — Riemannian update
  `<div class="eyebrow" style="color:var(--accent);margin-bottom:8px;">Étape 5 / 5 — Mise à jour riemannienne</div>
   <h2 style="margin:0 0 16px;font-size:32px;font-family:var(--sans);font-weight:600;letter-spacing:-0.02em;">Projection + rétraction</h2>
   <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;align-items:center;">
     <div>
       <div style="font-size:17px;color:var(--ink-3);letter-spacing:0.05em;text-transform:uppercase;font-family:var(--mono);margin-bottom:8px;">1. Projection tangente</div>
       <div class="math-display" style="margin:0 0 18px;font-size:21px;">\\xi = \\nabla_{W_k}\\mathcal{L} - W_k\\,\\mathrm{sym}(W_k^\\top \\nabla_{W_k}\\mathcal{L})</div>
       <div style="font-size:17px;color:var(--ink-3);letter-spacing:0.05em;text-transform:uppercase;font-family:var(--mono);margin-bottom:8px;">2. Rétraction polaire</div>
       <div class="math-display" style="margin:0;font-size:21px;">W_k^+ = \\mathrm{uf}(W_k - \\eta\\,\\xi)</div>
     </div>
     <div style="padding:18px 22px;background:var(--bg-2);border-left:3px solid var(--accent);border-radius:0 6px 6px 0;font-size:18px;color:var(--ink-2);line-height:1.55;">
       Coût dominant : une <strong>SVD réduite</strong> par couche BiMap.
       <br/><br/>
       Pas d'exponentielle matricielle, pas de logarithme — ce qui rendra possible le passage au cadre distribué.
     </div>
   </div>`,
];

// ── Box layout (computed once) ────────────────────────────────────────────
function useLayout() {
  // viewBox: 1720 × 380 for the network strip
  const VB_W = 1720;
  const VB_H = 380;
  const BOX_W = 175;
  const BOX_H = 130;
  const GAP   = 40;
  const total = LAYERS.length * BOX_W + (LAYERS.length - 1) * GAP;
  const startX = (VB_W - total) / 2;
  const boxes = LAYERS.map((L, i) => ({
    ...L,
    x: startX + i * (BOX_W + GAP),
    y: (VB_H - BOX_H) / 2,
    w: BOX_W,
    h: BOX_H,
    cx: startX + i * (BOX_W + GAP) + BOX_W / 2,
    cy: (VB_H - BOX_H) / 2 + BOX_H / 2,
  }));
  return { VB_W, VB_H, BOX_W, BOX_H, boxes };
}

// ── Animated "data" particle ──────────────────────────────────────────────
function FlowParticle({ from, to, active, color, durationMs = 1300, glow = true }) {
  // Linear interpolation along the X axis. `active=true` plays the animation.
  const [t, setT] = useState(0); // 0..1
  const startRef = useRef(null);
  useEffect(() => {
    if (!active) { setT(0); return; }
    let raf;
    startRef.current = null;
    const step = (ts) => {
      if (startRef.current == null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const k = Math.min(1, elapsed / durationMs);
      // Ease-in-out
      const eased = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      setT(eased);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [active, durationMs]);

  if (!active && t === 0) return null;
  const x = from.x + (to.x - from.x) * t;
  const y = from.y + (to.y - from.y) * t;
  return (
    <g>
      {glow && (
        <circle cx={x} cy={y} r="20" fill={color} opacity="0.18" />
      )}
      <circle cx={x} cy={y} r="9" fill={color} />
    </g>
  );
}

// ── Box renderer ──────────────────────────────────────────────────────────
function LayerBox({ box, activeForward, activeBackward, reached, step }) {
  const isParam = box.kind === 'bimap' || box.kind === 'fc';
  const isBiMap = box.kind === 'bimap';
  const isLoss  = box.kind === 'loss';
  const isData  = box.kind === 'data';

  // Border color: accent for BiMap (Stiefel), neutral for others
  let borderColor = RULE;
  if (isBiMap) borderColor = ACCENT;
  if (isLoss && step >= 2) borderColor = RED;
  if (activeForward) borderColor = ACCENT;
  if (activeBackward) borderColor = RED;

  // Fill: subtle highlight when reached/active
  let fillColor = BG2;
  if (reached && step >= 1 && step < 3) fillColor = 'rgba(210,59,28,0.06)';
  if (reached && step >= 3) fillColor = 'rgba(210,59,28,0.10)';
  if (isBiMap) fillColor = step >= 4 ? 'rgba(210,59,28,0.16)' : fillColor;

  return (
    <g>
      <rect
        x={box.x} y={box.y} width={box.w} height={box.h}
        rx="10" ry="10"
        fill={fillColor}
        stroke={borderColor}
        strokeWidth={(activeForward || activeBackward || (isBiMap && step >= 4)) ? 3.5 : 2}
        style={{ transition: 'fill 280ms ease, stroke 280ms ease, stroke-width 280ms ease' }}
      />
      {/* Layer name */}
      <text
        x={box.cx} y={box.cy - 6}
        textAnchor="middle"
        fontFamily="var(--sans)"
        fontSize={isLoss ? 36 : 24}
        fontWeight="600"
        fill={INK}
      >
        {box.short}
      </text>
      {/* Sub-label */}
      <text
        x={box.cx} y={box.cy + 24}
        textAnchor="middle"
        fontFamily="var(--mono)"
        fontSize="13"
        fill={INK3}
        style={{ letterSpacing: '0.04em' }}
      >
        {isBiMap ? 'W ∈ St' : box.kind === 'fc' ? 'A, b' : box.kind === 'nonparam' ? 'sans paramètre' : ''}
      </text>
      {/* Highlight ring for active BiMap gradient (step 4+) */}
      {isBiMap && step >= 4 && (
        <rect
          x={box.x - 4} y={box.y - 4}
          width={box.w + 8} height={box.h + 8}
          rx="14" ry="14"
          fill="none"
          stroke={RED}
          strokeWidth="2"
          strokeDasharray="6 4"
          opacity="0.7"
        >
          <animate attributeName="stroke-dashoffset" from="0" to="10" dur="0.7s" repeatCount="indefinite" />
        </rect>
      )}
    </g>
  );
}

// ── Arrow between boxes ───────────────────────────────────────────────────
function ConnArrow({ from, to, color = INK3, width = 2, opacity = 0.6, above = false }) {
  const offset = above ? -22 : 0;
  const x1 = from.x + from.w + 4;
  const x2 = to.x - 4;
  const y  = from.cy + offset;
  const headSize = 7;
  return (
    <g opacity={opacity}>
      <line x1={x1} y1={y} x2={x2 - headSize} y2={y}
            stroke={color} strokeWidth={width} strokeLinecap="round" />
      <polygon points={`${x2},${y} ${x2 - headSize},${y - headSize * 0.55} ${x2 - headSize},${y + headSize * 0.55}`} fill={color} />
    </g>
  );
}

// ── Backward arrow (red, arcs above) ──────────────────────────────────────
function BackArrow({ from, to, color = RED, animate }) {
  // Arc from "to" to "from" going right→left, slightly above the boxes.
  const x1 = from.x + from.w + 4;     // start (right of the LEFT box)
  const x2 = to.x - 4;                // end   (left of the RIGHT box)
  // We want arrow head pointing LEFT (from right box toward left box)
  // So source is right box's left edge, target is left box's right edge.
  const sx = x2;
  const tx = x1;
  const y  = from.cy - 70;
  const mx = (sx + tx) / 2;
  const my = y - 28;
  const path = `M ${sx} ${from.cy - 30} Q ${mx} ${my} ${tx} ${from.cy - 30}`;
  // Approximate path length for dash animation
  const len = Math.hypot(sx - tx, 0) + 60;
  return (
    <g>
      <path d={path} fill="none" stroke={color} strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={animate ? `${len}` : 'none'}
            strokeDashoffset={animate ? `${len}` : 0}
            style={{
              transition: 'stroke-dashoffset 420ms ease-out',
            }}
            ref={(el) => {
              if (el && animate) {
                requestAnimationFrame(() => {
                  el.style.strokeDashoffset = '0';
                });
              }
            }}
      />
      {/* Arrowhead at left end */}
      <polygon
        points={`${tx},${from.cy - 30} ${tx + 11},${from.cy - 30 - 6} ${tx + 11},${from.cy - 30 + 6}`}
        fill={color}
        opacity={animate ? 1 : 0}
        style={{ transition: 'opacity 200ms ease 360ms' }}
      />
    </g>
  );
}

// ── Explanation panel ─────────────────────────────────────────────────────
function ExplainPanel({ step }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = STEP_HTML[step];
    renderMath();
  }, [step]);
  return (
    <div ref={ref} style={{
      padding: '32px 48px 28px',
      background: 'var(--bg)',
      borderTop: `1px solid ${RULE}`,
      minHeight: 260,
    }} />
  );
}

// ── Step pip indicator ────────────────────────────────────────────────────
function StepPips({ step, total }) {
  return (
    <div style={{
      display: 'flex', gap: 6,
      padding: '12px 48px 0',
      background: 'var(--bg)',
    }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          flex: 1, height: 3,
          background: i <= step ? ACCENT : RULE,
          transition: 'background 200ms',
        }} />
      ))}
    </div>
  );
}

// ── Main island ───────────────────────────────────────────────────────────
export function SpdNetBackprop() {
  const containerRef = useRef(null);
  const [step, setStep] = useState(0);
  const MAX_STEP = STEP_HTML.length - 1;

  // Keyboard control — only when our slide is active
  useEffect(() => {
    const handler = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const section = containerRef.current?.closest('section, section-divider');
      if (!section?.hasAttribute('data-deck-active')) return;
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        setStep(s => {
          if (s < MAX_STEP) { e.stopPropagation(); e.preventDefault(); return s + 1; }
          return s;
        });
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        setStep(s => {
          if (s > 0) { e.stopPropagation(); e.preventDefault(); return s - 1; }
          return s;
        });
      } else if (e.key === 'Home') {
        setStep(0);
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []);

  // Reset to step 0 when slide becomes active
  useEffect(() => {
    const section = containerRef.current?.closest('section, section-divider');
    if (!section) return;
    const stage = section.closest('deck-stage');
    const onChange = () => {
      if (section.hasAttribute('data-deck-active')) setStep(0);
    };
    stage?.addEventListener('slidechange', onChange);
    return () => stage?.removeEventListener('slidechange', onChange);
  }, []);

  const { VB_W, VB_H, boxes } = useLayout();

  // Forward animation: particle travels through boxes when entering step 1
  const forwardActive = step === 1;
  const fwdFrom = { x: boxes[0].x + boxes[0].w, y: boxes[0].cy };
  const fwdTo   = { x: boxes[boxes.length - 1].x, y: boxes[boxes.length - 1].cy };

  // Backward: a red particle travels right→left when entering step 3
  const backwardActive = step === 3;
  const bwdFrom = { x: boxes[boxes.length - 1].x, y: boxes[boxes.length - 1].cy - 30 };
  const bwdTo   = { x: boxes[0].x + boxes[0].w, y: boxes[0].cy - 30 };

  return (
    <div ref={containerRef} style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg)',
    }}>
      {/* Network strip */}
      <div style={{
        flex: 1, minHeight: 0,
        padding: '24px 24px 0',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} style={{ width: '100%', height: '100%', display: 'block' }}>
          {/* Forward arrows between boxes (visible at all times, subtle) */}
          {boxes.slice(0, -1).map((b, i) => {
            const next = boxes[i + 1];
            const opacity = step === 0 ? 0.35 : (step === 1 ? 0.55 : 0.25);
            const color = step === 1 ? ACCENT : INK3;
            return (
              <ConnArrow key={`f-${i}`} from={b} to={next} color={color} opacity={opacity} width={2} />
            );
          })}

          {/* Backward red arrows (step 3+) */}
          {step >= 3 && boxes.slice(0, -1).map((b, i) => {
            const next = boxes[i + 1];
            // Show arrows pointing left, drawn above the boxes
            return (
              <BackArrow key={`b-${i}`} from={b} to={next} animate={step === 3} />
            );
          })}

          {/* Boxes */}
          {boxes.map((b, i) => {
            // "reached" = forward pass has covered this box
            const reached = step >= 1 && i <= 6; // always all by end of step 1
            const activeForward = step === 1 && i === Math.min(6, Math.max(0, Math.round(0))); // forward dot handled separately
            const activeBackward = step >= 3 && (b.kind === 'bimap' || b.kind === 'fc' || b.id === 'loss');
            return (
              <LayerBox
                key={b.id}
                box={b}
                activeForward={false}
                activeBackward={activeBackward}
                reached={reached}
                step={step}
              />
            );
          })}

          {/* Forward particle */}
          {forwardActive && <FlowParticle from={fwdFrom} to={fwdTo} active color={ACCENT} durationMs={1400} />}

          {/* Backward particle */}
          {backwardActive && <FlowParticle from={bwdFrom} to={bwdTo} active color={RED} durationMs={1400} />}

          {/* "Forward" / "Backward" axis labels */}
          <text x={VB_W / 2} y={VB_H - 12} textAnchor="middle"
                fontFamily="var(--mono)" fontSize="14"
                fill={step >= 3 ? RED : (step === 1 ? ACCENT : INK3)}
                style={{ letterSpacing: '0.08em', transition: 'fill 280ms' }}>
            {step >= 3 ? '← rétropropagation' : (step >= 1 ? 'propagation avant →' : '←  passe avant · passe arrière  →')}
          </text>
        </svg>
      </div>

      {/* Step pips */}
      <StepPips step={step} total={STEP_HTML.length} />
      {/* Explanation panel */}
      <ExplainPanel step={step} />
    </div>
  );
}
