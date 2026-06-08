// spdnet-backprop.jsx — generic backprop diagram (matching the textbook
// dual-row pattern) animated step by step. Forward row on top (f_k, X_k,
// parameters θ_k, prediction ŷ, loss ℒ), gradient row on bottom (∇f_k
// with ∂ℒ/∂X arrows going left and ∂ℒ/∂θ arrows going down). Cached
// activations from each f_k feed into the corresponding ∇f_k.
//
// Steps:
//   0  architecture overview (everything subtle)
//   1  forward pass — orange particle flows X → ŷ
//   2  loss reached — ℒ flashes, ∂ℒ/∂ŷ appears
//   3  backward pass — red particles + arrows propagate right→left
//   4  parameter gradients — ∂ℒ/∂θ_k arrows drop from each ∇f_k
//   5  Riemannian step on Stiefel-constrained θ_k (project + retract)

import React, { useEffect, useRef, useState } from 'react';
import { renderMath } from '../math.js';

const ACCENT = 'var(--accent)';
const INK    = 'var(--ink)';
const INK2   = 'var(--ink-2)';
const INK3   = 'var(--ink-3)';
const RULE   = 'var(--rule)';
const RULE_S = 'var(--rule-soft)';
const BG2    = 'var(--bg-2)';
const RED    = '#d23b1c';

// ── Diagram geometry ─────────────────────────────────────────────────────
const VB_W = 1920;
const VB_H = 900;
const FWD_Y = 260;   // forward boxes vertical center
const BWD_Y = 680;   // backward boxes vertical center
const BOX_W = 130;
const BOX_H = 96;

const FWD = [
  { id: 'f1',   x: 340,  short: 'f',  sub: '1',     skipDots: false },
  { id: 'fl-1', x: 900,  short: 'f',  sub: 'ℓ−1',   skipDots: true  },
  { id: 'fl',   x: 1260, short: 'f',  sub: 'ℓ',     skipDots: false },
];
const LOSS_X = 1620;

// X-coordinates of "between-box" labels on the forward row
const FWD_LABELS = [
  { mid: 220, label: 'X' },                  // entering f1 (the input X)
  { mid: 480, label: 'X', sub: '1' },        // f1 → ...
  { mid: 760, label: 'X', sub: 'ℓ−2' },      // ... → f_{ℓ-1}
  { mid: 1080, label: 'X', sub: 'ℓ−1' },     // f_{ℓ-1} → f_ℓ
  { mid: 1400, label: 'ŷ' },                 // f_ℓ → ℒ
];

// ── Explanation panel HTML (static, author-controlled) ───────────────────
const STEP_HTML = [
  // 0 — Architecture overview
  `<div class="eyebrow" style="color:var(--accent);margin-bottom:6px;">Étape 0 / 5 — Architecture</div>
   <h2 style="margin:0 0 14px;font-size:40px;font-family:var(--sans);font-weight:600;letter-spacing:-0.02em;">Réseau profond générique</h2>
   <p style="margin:0;font-size:25px;color:var(--ink-2);line-height:1.5;">
     Une chaîne de couches paramétrées : chaque <span class="math">f_k</span> prend l'activation précédente <span class="math">\\mathbf{X}_{k-1}</span> et un paramètre <span class="math">\\boldsymbol{\\theta}_k</span>, et produit <span class="math">\\mathbf{X}_k = f_k(\\mathbf{X}_{k-1}; \\boldsymbol{\\theta}_k)</span>. Le réseau termine en sortie <span class="math">\\hat{\\mathbf{y}}</span> puis en perte scalaire <span class="math">\\mathcal{L}(\\hat{\\mathbf{y}}, \\mathbf{y})</span>.
   </p>`,

  // 1 — Forward pass
  `<div class="eyebrow" style="color:var(--accent);margin-bottom:6px;">Étape 1 / 5 — Passe avant</div>
   <h2 style="margin:0 0 14px;font-size:40px;font-family:var(--sans);font-weight:600;letter-spacing:-0.02em;">Propagation des activations</h2>
   <div style="display:grid;grid-template-columns:1fr 1fr;gap:28px;align-items:start;">
     <div>
       <div class="math-display" style="margin:0;font-size:28px;">\\mathbf{X}_k = f_k(\\mathbf{X}_{k-1}; \\boldsymbol{\\theta}_k)</div>
       <p style="font-size:22px;color:var(--ink-3);margin:10px 0 0;">On <strong>met en cache</strong> chaque <span class="math">\\mathbf{X}_k</span> : il sera nécessaire pour la passe arrière.</p>
     </div>
     <div>
       <div class="math-display" style="margin:0;font-size:28px;">\\hat{\\mathbf{y}} = f_\\ell(\\mathbf{X}_{\\ell-1}; \\boldsymbol{\\theta}_\\ell), \\quad \\mathcal{L} = \\mathcal{L}(\\hat{\\mathbf{y}}, \\mathbf{y})</div>
     </div>
   </div>`,

  // 2 — Loss reached, dL/dŷ
  `<div class="eyebrow" style="color:${RED};margin-bottom:6px;">Étape 2 / 5 — Perte</div>
   <h2 style="margin:0 0 14px;font-size:40px;font-family:var(--sans);font-weight:600;letter-spacing:-0.02em;">Point de départ du gradient</h2>
   <p style="margin:0;font-size:25px;color:var(--ink-2);line-height:1.6;">
     La perte est scalaire, sa dérivée vis-à-vis de la prédiction est explicite :
   </p>
   <div class="math-display" style="margin:14px 0 0;font-size:28px;">\\frac{\\partial \\mathcal{L}}{\\partial \\hat{\\mathbf{y}}} \\quad\\longrightarrow\\quad \\nabla f_\\ell</div>
   <p style="margin:14px 0 0;font-size:22px;color:var(--ink-3);">Ce gradient amorce la <strong style="color:${RED};">remontée</strong> par la règle de la chaîne.</p>`,

  // 3 — Backward pass (chain rule)
  `<div class="eyebrow" style="color:${RED};margin-bottom:6px;">Étape 3 / 5 — Rétropropagation</div>
   <h2 style="margin:0 0 14px;font-size:40px;font-family:var(--sans);font-weight:600;letter-spacing:-0.02em;">Règle de la chaîne, couche par couche</h2>
   <p style="margin:0 0 12px;font-size:24px;color:var(--ink-2);line-height:1.5;">
     Chaque bloc <span class="math">\\nabla f_k</span> combine le gradient entrant et l'activation cachée :
   </p>
   <div class="math-display" style="margin:0;font-size:28px;">\\frac{\\partial \\mathcal{L}}{\\partial \\mathbf{X}_{k-1}} = \\frac{\\partial \\mathcal{L}}{\\partial \\mathbf{X}_k} \\cdot \\frac{\\partial f_k}{\\partial \\mathbf{X}_{k-1}}\\bigg|_{\\mathbf{X}_{k-1},\\,\\boldsymbol{\\theta}_k}</div>
   <p style="margin:14px 0 0;font-size:22px;color:var(--ink-3);">Spécifique SPDNet : eig &amp; log nécessitent la <strong>rétropropagation matricielle</strong> (Ionescu / Brooks).</p>`,

  // 4 — Parameter gradients
  `<div class="eyebrow" style="color:${RED};margin-bottom:6px;">Étape 4 / 5 — Gradients de paramètres</div>
   <h2 style="margin:0 0 14px;font-size:40px;font-family:var(--sans);font-weight:600;letter-spacing:-0.02em;">Vers chaque <span class="math">\\boldsymbol{\\theta}_k</span></h2>
   <div style="display:grid;grid-template-columns:1fr 1fr;gap:28px;align-items:start;">
     <div>
       <div class="math-display" style="margin:0;font-size:28px;">\\frac{\\partial \\mathcal{L}}{\\partial \\boldsymbol{\\theta}_k} = \\frac{\\partial \\mathcal{L}}{\\partial \\mathbf{X}_k} \\cdot \\frac{\\partial f_k}{\\partial \\boldsymbol{\\theta}_k}</div>
     </div>
     <div style="padding:14px 18px;background:var(--bg-2);border-left:3px solid ${RED};border-radius:0 6px 6px 0;font-size:22px;color:var(--ink-2);line-height:1.5;">
       Mais pour SPDNet, certains <span class="math">\\boldsymbol{\\theta}_k = W_k</span> vivent sur <span class="math">\\mathrm{St}(d_{k-1}, d_k)</span> : le gradient ainsi obtenu est <strong>euclidien</strong>, ignorant la contrainte.
     </div>
   </div>`,

  // 5 — Riemannian step
  `<div class="eyebrow" style="color:var(--accent);margin-bottom:6px;">Étape 5 / 5 — Mise à jour riemannienne</div>
   <h2 style="margin:0 0 14px;font-size:40px;font-family:var(--sans);font-weight:600;letter-spacing:-0.02em;">Projection + rétraction sur Stiefel</h2>
   <div style="display:grid;grid-template-columns:1fr 1fr;gap:28px;align-items:center;">
     <div>
       <div style="font-size:18px;color:var(--ink-3);letter-spacing:0.06em;text-transform:uppercase;font-family:var(--mono);margin-bottom:6px;">1. Projection tangente</div>
       <div class="math-display" style="margin:0 0 14px;font-size:26px;">\\xi = \\nabla_{W_k}\\mathcal{L} - W_k\\,\\mathrm{sym}(W_k^\\top \\nabla_{W_k}\\mathcal{L})</div>
       <div style="font-size:18px;color:var(--ink-3);letter-spacing:0.06em;text-transform:uppercase;font-family:var(--mono);margin-bottom:6px;">2. Rétraction polaire</div>
       <div class="math-display" style="margin:0;font-size:26px;">W_k^+ = \\mathrm{uf}(W_k - \\eta\\,\\xi)</div>
     </div>
     <div style="padding:16px 20px;background:var(--bg-2);border-left:3px solid var(--accent);border-radius:0 6px 6px 0;font-size:22px;color:var(--ink-2);line-height:1.55;">
       Coût dominant : une <strong>SVD réduite</strong> par couche BiMap.
       <br/><br/>
       Pas d'exp, pas de log — c'est ce qui rendra possible le passage au cadre distribué.
     </div>
   </div>`,
];

// ── Subscript text helper ────────────────────────────────────────────────
function MathLabel({ x, y, base, sub, fill, fontSize = 32, fontWeight = 500, italic = true, anchor = 'middle' }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fill={fill}
          fontFamily="var(--serif), Georgia, serif"
          style={{ fontSize: `calc(${fontSize}px * var(--type-scale, 1))`, transition: 'fill 280ms' }}
          fontWeight={fontWeight}
          fontStyle={italic ? 'italic' : 'normal'}>
      {base}
      {sub != null && (
        <tspan dy="6" dx="1" style={{ fontSize: `calc(${fontSize * 0.62}px * var(--type-scale, 1))` }} fontStyle="italic">{sub}</tspan>
      )}
    </text>
  );
}

// Bold mathematical label (for X_k, ŷ, y) — uses tspan for subscript.
function BoldMathLabel({ x, y, base, sub, fill, fontSize = 34, anchor = 'middle' }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fill={fill}
          fontFamily="var(--serif), Georgia, serif"
          style={{ fontSize: `calc(${fontSize}px * var(--type-scale, 1))`, transition: 'fill 280ms' }} fontWeight={700} fontStyle="normal">
      {base}
      {sub != null && (
        <tspan dy="6" dx="1" style={{ fontSize: `calc(${fontSize * 0.62}px * var(--type-scale, 1))` }} fontStyle="italic" fontWeight={500}>{sub}</tspan>
      )}
    </text>
  );
}

// ── Arrow markers ────────────────────────────────────────────────────────
function ArrowDefs() {
  return (
    <defs>
      <marker id="arrow-ink" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill={INK2} />
      </marker>
      <marker id="arrow-accent" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill={ACCENT} />
      </marker>
      <marker id="arrow-red" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill={RED} />
      </marker>
      <marker id="arrow-dim" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill={INK3} />
      </marker>
    </defs>
  );
}

// ── Animated particle along a horizontal segment ─────────────────────────
function ParticleAlong({ from, to, active, color, duration = 1400, onDone }) {
  const [t, setT] = useState(0);
  const startRef = useRef(null);
  useEffect(() => {
    if (!active) { setT(0); return; }
    let raf;
    startRef.current = null;
    const step = (ts) => {
      if (startRef.current == null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const k = Math.min(1, elapsed / duration);
      const eased = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      setT(eased);
      if (k < 1) raf = requestAnimationFrame(step);
      else onDone?.();
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [active, duration, onDone]);
  if (!active && t === 0) return null;
  const x = from.x + (to.x - from.x) * t;
  const y = from.y + (to.y - from.y) * t;
  return (
    <g>
      <circle cx={x} cy={y} r="22" fill={color} opacity="0.18" />
      <circle cx={x} cy={y} r="10" fill={color} />
    </g>
  );
}

// ── Forward-row box ──────────────────────────────────────────────────────
function FwdBox({ x, y, sub, active, reached, isLoss }) {
  const borderColor = isLoss && active ? RED : (active ? ACCENT : INK2);
  const fill = isLoss && reached ? 'rgba(210,59,28,0.06)' : (reached ? 'rgba(0,0,0,0.02)' : BG2);
  return (
    <g>
      <rect x={x - BOX_W / 2} y={y - BOX_H / 2} width={BOX_W} height={BOX_H}
            rx="6" ry="6" fill={fill} stroke={borderColor} strokeWidth={active ? 3 : 2}
            style={{ transition: 'fill 280ms, stroke 280ms, stroke-width 280ms' }} />
      {isLoss ? (
        <text x={x} y={y + 14} textAnchor="middle"
              fontFamily="var(--serif), Georgia, serif"
              fontStyle="italic" style={{ fontSize: 'calc(56px * var(--type-scale, 1))', transition: 'fill 280ms' }} fontWeight={500}
              fill={active ? RED : INK}>
          ℒ
        </text>
      ) : (
        <MathLabel x={x} y={y + 12} base="f" sub={sub} fill={active ? ACCENT : INK} fontSize={48} />
      )}
    </g>
  );
}

// ── Backward-row box (dashed) ────────────────────────────────────────────
function BwdBox({ x, y, sub, active }) {
  // Combined ∇f_sub label rendered as a single text element so spacing stays clean
  const color = active ? RED : INK2;
  return (
    <g>
      <rect x={x - BOX_W / 2} y={y - BOX_H / 2} width={BOX_W} height={BOX_H}
            rx="6" ry="6" fill={BG2}
            stroke={active ? RED : INK3}
            strokeWidth={active ? 3 : 1.5}
            strokeDasharray="6 4"
            style={{ transition: 'stroke 280ms, stroke-width 280ms' }} />
      <text x={x} y={y + 14} textAnchor="middle"
            fontFamily="var(--serif), Georgia, serif"
            style={{ fontSize: 'calc(46px * var(--type-scale, 1))', transition: 'fill 280ms' }} fill={color}>
        <tspan fontStyle="normal">∇</tspan>
        <tspan dx="2" fontStyle="italic">f</tspan>
        <tspan dy="8" dx="1" style={{ fontSize: 'calc(30px * var(--type-scale, 1))' }} fontStyle="italic">{sub}</tspan>
      </text>
    </g>
  );
}

// ── Animated horizontal arrow with optional draw-on ──────────────────────
function HArrow({ x1, x2, y, color, width = 2, dashed = false, drawn = true, label, labelDy = -10, labelColor, labelSub, labelBold, labelBase, opacity = 1 }) {
  // Path goes from (x1, y) to (x2, y). For backward we want x2 < x1 visually, with marker at x2.
  const len = Math.abs(x2 - x1);
  return (
    <g style={{ opacity, transition: 'opacity 280ms' }}>
      <line
        x1={x1} y1={y} x2={x2} y2={y}
        stroke={color} strokeWidth={width}
        strokeDasharray={dashed ? '5 4' : (drawn ? 'none' : `${len}`)}
        strokeDashoffset={drawn ? 0 : len}
        markerEnd={color === RED ? 'url(#arrow-red)' : (color === ACCENT ? 'url(#arrow-accent)' : (color === INK3 ? 'url(#arrow-dim)' : 'url(#arrow-ink)'))}
        style={{ transition: 'stroke-dashoffset 600ms ease-out, stroke 280ms' }}
      />
      {label && (
        labelBold
          ? <BoldMathLabel x={(x1 + x2) / 2} y={y + labelDy} base={labelBase || label} sub={labelSub} fill={labelColor || color} fontSize={30} />
          : <text x={(x1 + x2) / 2} y={y + labelDy} textAnchor="middle"
                  fontFamily="var(--serif), Georgia, serif" fontSize="28"
                  fontStyle="italic" fill={labelColor || color}>
              {label}
            </text>
      )}
    </g>
  );
}

// ── Vertical arrow (for θ inputs and ∂ℒ/∂θ outputs) ──────────────────────
function VArrow({ x, y1, y2, color, drawn = true, label, labelOffset = 0, opacity = 1 }) {
  const len = Math.abs(y2 - y1);
  return (
    <g style={{ opacity, transition: 'opacity 280ms' }}>
      <line
        x1={x} y1={y1} x2={x} y2={y2}
        stroke={color} strokeWidth="2"
        strokeDasharray={drawn ? 'none' : `${len}`}
        strokeDashoffset={drawn ? 0 : len}
        markerEnd={color === RED ? 'url(#arrow-red)' : (color === ACCENT ? 'url(#arrow-accent)' : 'url(#arrow-ink)')}
        style={{ transition: 'stroke-dashoffset 600ms ease-out' }}
      />
      {label && (
        <foreignObject x={x - 90} y={(y1 + y2) / 2 - 16 + labelOffset} width="180" height="32">
          <div xmlns="http://www.w3.org/1999/xhtml" style={{
            fontFamily: 'var(--serif), Georgia, serif',
            fontStyle: 'italic',
            fontSize: '26px',
            textAlign: 'center',
            color: color,
            whiteSpace: 'nowrap',
          }} dangerouslySetInnerHTML={{ __html: label }} />
        </foreignObject>
      )}
    </g>
  );
}

// ── Explanation panel ────────────────────────────────────────────────────
function ExplainPanel({ step }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = STEP_HTML[step];
    renderMath();
  }, [step]);
  return (
    <div ref={ref} style={{
      padding: '28px 56px 24px',
      background: 'var(--bg)',
      borderTop: `1px solid ${RULE_S}`,
      height: 290,
      flexShrink: 0,
      overflow: 'hidden',
    }} />
  );
}

function StepPips({ step, total }) {
  return (
    <div style={{ display: 'flex', gap: 6, padding: '10px 56px 0', background: 'var(--bg)', flexShrink: 0 }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{ flex: 1, height: 3, background: i <= step ? ACCENT : RULE_S, transition: 'background 200ms' }} />
      ))}
    </div>
  );
}

// ── Main island ──────────────────────────────────────────────────────────
export function SpdNetBackprop() {
  const containerRef = useRef(null);
  const [step, setStep] = useState(0);
  const MAX_STEP = STEP_HTML.length - 1;

  // Forward-pass particle progression: 0 → 4 (one per arrow segment)
  // We just animate one particle that crosses the whole length when step becomes 1
  const [fwdActive, setFwdActive] = useState(false);
  // Backward propagation: animate each gradient arrow drawing right→left
  // We use a single timer that advances `bwdProgress` 0..1 driving stroke-dashoffsets
  const [bwdProgress, setBwdProgress] = useState(0);

  // Trigger animations when step changes
  useEffect(() => {
    if (step === 1) {
      setFwdActive(false);
      requestAnimationFrame(() => setFwdActive(true));
    } else {
      setFwdActive(false);
    }
    if (step >= 3) {
      setBwdProgress(0);
      // After a tiny delay, set to 1 so the draw-on animation triggers via CSS transition
      const t = setTimeout(() => setBwdProgress(1), 60);
      return () => clearTimeout(t);
    } else {
      setBwdProgress(0);
    }
  }, [step]);

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

  // Derived
  const showBwd     = step >= 3;
  const showThetaG  = step >= 4;
  const showRiem    = step === 5;

  // The forward particle goes from x=170 (after input "X") to x=1500 (before ℒ box)
  const fwdFrom = { x: 170, y: FWD_Y };
  const fwdTo   = { x: 1500, y: FWD_Y };

  return (
    <div ref={containerRef} style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg)',
    }}>
      {/* Diagram */}
      <div style={{ flex: 1, minHeight: 0, padding: '20px 32px 0', display: 'flex' }}>
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} style={{ width: '100%', height: '100%', display: 'block' }}>
          <ArrowDefs />

          {/* ── Forward row: arrows + boxes + labels ──────────────────────────── */}
          {/* X (input) label */}
          <BoldMathLabel x={110} y={FWD_Y + 9} base="X" fill={INK} fontSize={44} />

          {/* Arrow X → f1 */}
          <HArrow x1={150} x2={320 - BOX_W / 2 - 6} y={FWD_Y} color={step >= 1 ? ACCENT : INK2} />

          {/* f1 box */}
          <FwdBox x={FWD[0].x} y={FWD_Y} sub={FWD[0].sub} active={step >= 1} reached={step >= 1} />

          {/* Arrow f1 → X1 label → ... */}
          <BoldMathLabel x={460} y={FWD_Y - 14} base="X" sub="1" fill={step >= 1 ? ACCENT : INK} fontSize={30} />
          <HArrow x1={FWD[0].x + BOX_W / 2 + 6} x2={560} y={FWD_Y} color={step >= 1 ? ACCENT : INK2} />

          {/* ... (dots between f1 and f_{ℓ-1}) */}
          <text x={620} y={FWD_Y + 8} textAnchor="middle" fontFamily="var(--serif), Georgia, serif" fontSize="32" fill={INK2}>···</text>

          {/* Arrow ... → f_{ℓ-1} */}
          <BoldMathLabel x={760} y={FWD_Y - 14} base="X" sub="ℓ−2" fill={step >= 1 ? ACCENT : INK} fontSize={30} />
          <HArrow x1={680} x2={FWD[1].x - BOX_W / 2 - 6} y={FWD_Y} color={step >= 1 ? ACCENT : INK2} />

          {/* f_{ℓ-1} box */}
          <FwdBox x={FWD[1].x} y={FWD_Y} sub={FWD[1].sub} active={step >= 1} reached={step >= 1} />

          {/* Arrow f_{ℓ-1} → f_ℓ */}
          <BoldMathLabel x={1050} y={FWD_Y - 14} base="X" sub="ℓ−1" fill={step >= 1 ? ACCENT : INK} fontSize={30} />
          <HArrow x1={FWD[1].x + BOX_W / 2 + 6} x2={FWD[2].x - BOX_W / 2 - 6} y={FWD_Y} color={step >= 1 ? ACCENT : INK2} />

          {/* f_ℓ box */}
          <FwdBox x={FWD[2].x} y={FWD_Y} sub={FWD[2].sub} active={step >= 1} reached={step >= 1} />

          {/* Arrow f_ℓ → ŷ */}
          <BoldMathLabel x={1400} y={FWD_Y - 14} base={'ŷ'} fill={step >= 1 ? ACCENT : INK} fontSize={30} />
          <HArrow x1={FWD[2].x + BOX_W / 2 + 6} x2={LOSS_X - BOX_W / 2 - 6} y={FWD_Y} color={step >= 1 ? ACCENT : INK2} />

          {/* ℒ box */}
          <FwdBox x={LOSS_X} y={FWD_Y} isLoss active={step >= 2} reached={step >= 2} />

          {/* y label feeding into ℒ from above */}
          <BoldMathLabel x={LOSS_X + 90} y={FWD_Y - 80} base="y" fill={INK} fontSize={38} />
          <VArrow x={LOSS_X + 90} y1={FWD_Y - 70} y2={FWD_Y - BOX_H / 2 - 4} color={INK2} />

          {/* ── θ inputs (vertical arrows up to each f box) ──────────────────── */}
          {FWD.map(F => (
            <g key={`theta-${F.id}`}>
              <VArrow
                x={F.x}
                y1={FWD_Y + BOX_H / 2 + 90}
                y2={FWD_Y + BOX_H / 2 + 4}
                color={step >= 1 ? ACCENT : INK2}
              />
              <BoldMathLabel x={F.x} y={FWD_Y + BOX_H / 2 + 116}
                             base="θ" sub={F.sub} fill={step >= 1 ? ACCENT : INK} fontSize={32} />
            </g>
          ))}

          {/* ── Cached activation connectors (dashed lines from f_k down to ∇f_k) */}
          {FWD.map(F => (
            <line
              key={`cache-${F.id}`}
              x1={F.x} y1={FWD_Y + BOX_H / 2 + 4}
              x2={F.x} y2={BWD_Y - BOX_H / 2 - 4}
              stroke={INK3} strokeWidth="1.2" strokeDasharray="4 4"
              opacity={step >= 3 ? 0.55 : 0.25}
              style={{ transition: 'opacity 280ms' }}
            />
          ))}

          {/* ── Backward row: ∇f boxes ─────────────────────────────────────── */}
          {showBwd && FWD.map(F => (
            <BwdBox key={`bwd-${F.id}`} x={F.x} y={BWD_Y} sub={F.sub} active />
          ))}
          {/* When step < 3, show backward boxes as faint placeholders */}
          {!showBwd && step === 0 && FWD.map(F => (
            <BwdBox key={`bwd-ph-${F.id}`} x={F.x} y={BWD_Y} sub={F.sub} active={false} />
          ))}

          {/* ── ∂ℒ/∂ŷ arrow from ℒ down to ∇f_ℓ ──────────────────────────── */}
          {step >= 2 && (
            <g>
              {/* Path: from below ℒ box, then curving left to ∇f_ℓ top */}
              <path
                d={`M ${LOSS_X} ${FWD_Y + BOX_H / 2 + 4} L ${LOSS_X} ${BWD_Y - 30} Q ${LOSS_X} ${BWD_Y} ${LOSS_X - 60} ${BWD_Y} L ${FWD[2].x + BOX_W / 2 + 8} ${BWD_Y}`}
                fill="none"
                stroke={RED} strokeWidth="2.5"
                strokeDasharray={bwdProgress >= 1 ? 'none' : '400'}
                strokeDashoffset={bwdProgress >= 1 ? 0 : 400}
                markerEnd="url(#arrow-red)"
                style={{ transition: 'stroke-dashoffset 700ms ease-out' }}
              />
              {/* Label */}
              <foreignObject x={LOSS_X - 90} y={(FWD_Y + BWD_Y) / 2 - 40} width="200" height="48">
                <div xmlns="http://www.w3.org/1999/xhtml" style={{
                  fontFamily: 'var(--serif), Georgia, serif',
                  fontStyle: 'italic', fontSize: '28px',
                  color: RED, textAlign: 'center', whiteSpace: 'nowrap',
                }}>
                  ∂ℒ / ∂<span style={{ fontWeight: 700, fontStyle: 'normal' }}>ŷ</span>
                </div>
              </foreignObject>
            </g>
          )}

          {/* ── Backward arrows between ∇f boxes (right → left) ──────────── */}
          {showBwd && (
            <>
              {/* ∇f_ℓ → ∇f_{ℓ-1} */}
              <HArrow
                x1={FWD[2].x - BOX_W / 2 - 6}
                x2={FWD[1].x + BOX_W / 2 + 8}
                y={BWD_Y}
                color={RED}
                drawn={bwdProgress >= 1}
              />
              <foreignObject x={(FWD[1].x + FWD[2].x) / 2 - 110} y={BWD_Y - 50} width="220" height="36">
                <div xmlns="http://www.w3.org/1999/xhtml" style={{
                  fontFamily: 'var(--serif), Georgia, serif',
                  fontStyle: 'italic', fontSize: '28px',
                  color: RED, textAlign: 'center', whiteSpace: 'nowrap',
                  opacity: bwdProgress,
                  transition: 'opacity 600ms ease-out 200ms',
                }}>
                  ∂ℒ<sup style={{ fontSize: '0.7em' }}>ℓ</sup>&nbsp;/&nbsp;∂<span style={{ fontWeight: 700, fontStyle: 'normal' }}>X</span><sub style={{ fontSize: '0.7em' }}>ℓ−1</sub>
                </div>
              </foreignObject>

              {/* ∇f_{ℓ-1} → ... (between dots) */}
              <HArrow
                x1={FWD[1].x - BOX_W / 2 - 6}
                x2={680}
                y={BWD_Y}
                color={RED}
                drawn={bwdProgress >= 1}
              />
              <text x={620} y={BWD_Y + 8} textAnchor="middle" fontFamily="var(--serif), Georgia, serif" fontSize="32" fill={RED}
                    opacity={bwdProgress} style={{ transition: 'opacity 600ms ease-out 250ms' }}>···</text>
              <foreignObject x={680} y={BWD_Y - 50} width="220" height="36">
                <div xmlns="http://www.w3.org/1999/xhtml" style={{
                  fontFamily: 'var(--serif), Georgia, serif',
                  fontStyle: 'italic', fontSize: '28px',
                  color: RED, textAlign: 'center', whiteSpace: 'nowrap',
                  opacity: bwdProgress,
                  transition: 'opacity 600ms ease-out 350ms',
                }}>
                  ∂ℒ<sup style={{ fontSize: '0.7em' }}>ℓ−1</sup>&nbsp;/&nbsp;∂<span style={{ fontWeight: 700, fontStyle: 'normal' }}>X</span><sub style={{ fontSize: '0.7em' }}>ℓ−2</sub>
                </div>
              </foreignObject>

              {/* ... → ∇f₁ */}
              <HArrow
                x1={560}
                x2={FWD[0].x + BOX_W / 2 + 8}
                y={BWD_Y}
                color={RED}
                drawn={bwdProgress >= 1}
              />

              {/* ∇f₁ → exits left (∂ℒ²/∂X) */}
              <HArrow
                x1={FWD[0].x - BOX_W / 2 - 6}
                x2={150}
                y={BWD_Y}
                color={RED}
                drawn={bwdProgress >= 1}
              />
              <foreignObject x={130} y={BWD_Y - 50} width="200" height="36">
                <div xmlns="http://www.w3.org/1999/xhtml" style={{
                  fontFamily: 'var(--serif), Georgia, serif',
                  fontStyle: 'italic', fontSize: '28px',
                  color: RED, textAlign: 'center', whiteSpace: 'nowrap',
                  opacity: bwdProgress,
                  transition: 'opacity 600ms ease-out 450ms',
                }}>
                  ∂ℒ<sup style={{ fontSize: '0.7em' }}>2</sup>&nbsp;/&nbsp;∂<span style={{ fontWeight: 700, fontStyle: 'normal' }}>X</span>
                </div>
              </foreignObject>
            </>
          )}

          {/* ── ∂ℒ/∂θ_k arrows (downward from each ∇f_k) ────────────────── */}
          {showThetaG && FWD.map((F, i) => (
            <g key={`gtheta-${F.id}`}>
              <VArrow
                x={F.x}
                y1={BWD_Y + BOX_H / 2 + 4}
                y2={BWD_Y + BOX_H / 2 + 80}
                color={RED}
                drawn={bwdProgress >= 1}
              />
              <foreignObject x={F.x - 90} y={BWD_Y + BOX_H / 2 + 90} width="180" height="34">
                <div xmlns="http://www.w3.org/1999/xhtml" style={{
                  fontFamily: 'var(--serif), Georgia, serif',
                  fontStyle: 'italic', fontSize: '28px',
                  color: RED, textAlign: 'center', whiteSpace: 'nowrap',
                  opacity: bwdProgress,
                  transition: 'opacity 600ms ease-out 350ms',
                }}>
                  ∂ℒ<sup style={{ fontSize: '0.7em' }}>{F.sub}</sup>&nbsp;/&nbsp;∂<span style={{ fontWeight: 700, fontStyle: 'normal' }}>θ</span><sub style={{ fontSize: '0.7em' }}>{F.sub}</sub>
                </div>
              </foreignObject>
            </g>
          ))}

          {/* ── Stiefel-constraint highlight on θ inputs when step >= 5 ─── */}
          {showRiem && FWD.map(F => (
            <rect
              key={`stiefel-${F.id}`}
              x={F.x - 26} y={FWD_Y + BOX_H / 2 + 92}
              width={52} height={42} rx="8" ry="8"
              fill="none" stroke={ACCENT} strokeWidth="2.5" strokeDasharray="5 4"
              opacity="0.85"
            >
              <animate attributeName="stroke-dashoffset" from="0" to="9" dur="0.7s" repeatCount="indefinite" />
            </rect>
          ))}

          {/* Forward particle */}
          {fwdActive && <ParticleAlong from={fwdFrom} to={fwdTo} active color={ACCENT} duration={1500} />}
        </svg>
      </div>

      <StepPips step={step} total={STEP_HTML.length} />
      <ExplainPanel step={step} />
    </div>
  );
}
