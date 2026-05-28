// stiefel-update.jsx — pedagogical Stiefel update step on St(2,1) = unit circle.
// Walks through: Euclidean gradient → tangent projection → retraction (polar factor).
// Arrow keys (deck-stage) advance the step; the island listens to slidechange and
// the slide's own step state so the deck's standard Beamer-style flow drives it.

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { renderMath } from '../math.js';

const ACCENT = 'var(--accent)';
const INK    = 'var(--ink)';
const INK2   = 'var(--ink-2)';
const INK3   = 'var(--ink-3)';
const RULE   = 'var(--rule-soft)';

// Static, author-controlled HTML — embedded raw so KaTeX picks up the math
// without JSX text-node escape / brace conflicts.
const STEP_HTML = [
  // 0 — Euclidean gradient
  `<p>On part d'un poids <span class="math">W \\in \\mathrm{St}(d,p)</span>. Le calcul d'erreur fournit son gradient euclidien <span class="math">\\nabla_W \\mathcal{L}</span>, ignorant la contrainte d'orthogonalité.</p>
   <p style="margin-top:18px;color:var(--ink-3);">Pour <span class="math">p=1</span>, <span class="math">\\mathrm{St}(d,1)</span> est la sphère unité : ici nous montrons <span class="math">\\mathrm{St}(2,1) = S^1</span>.</p>`,
  // 1 — Tangent projection
  `<p>On projette le gradient sur l'espace tangent <span class="math">\\mathcal{T}_W \\mathcal{M}</span> :</p>
   <div class="math-display" style="margin:14px 0;">\\xi = P_W(\\nabla_W \\mathcal{L}) = \\nabla_W \\mathcal{L} - W\\,\\mathrm{sym}(W^\\top \\nabla_W \\mathcal{L})</div>
   <p style="color:var(--ink-3);margin-top:12px;">La composante normale (en pointillé) est rejetée — elle ne ferait que sortir de la variété.</p>`,
  // 2 — Ambient step
  `<p>On fait un pas <span class="math">-\\eta\\,\\xi</span> dans l'espace ambiant <span class="math">\\mathbb{R}^{d\\times p}</span> :</p>
   <div class="math-display" style="margin:14px 0;">\\tilde{W} = W - \\eta\\,\\xi</div>
   <p style="color:var(--ink-3);margin-top:12px;">Mais <span class="math">\\tilde{W}</span> est <em>hors variété</em> : <span class="math">\\tilde{W}^\\top \\tilde{W} \\neq I</span>.</p>`,
  // 3 — Retraction
  `<p>On <strong>rétracte</strong> via le facteur polaire — équivalent à la projection au point le plus proche :</p>
   <div class="math-display" style="margin:14px 0;">W^+ = R_W(-\\eta\\,\\xi) = \\mathrm{uf}(\\tilde{W}) = \\tilde{W}(\\tilde{W}^\\top \\tilde{W})^{-1/2}</div>
   <p style="color:var(--ink-3);margin-top:12px;">Une SVD réduite suffit : pas d'exponentielle matricielle, pas de logarithme — coût quasi linéaire en <span class="math">d</span>.</p>`,
  // 4 — Summary
  `<p>Le poids mis à jour <span class="math">W^+</span> est de retour sur <span class="math">\\mathrm{St}(d,p)</span>. La même mécanique se répète à chaque étape :</p>
   <div style="margin-top:16px;display:flex;flex-direction:column;gap:6px;font-family:var(--mono);font-size:18px;color:var(--ink-2);">
     <span>1. backprop matriciel (Ionescu / Brooks) → <span class="math">\\nabla_W \\mathcal{L}</span></span>
     <span>2. projection tangentielle → <span class="math">\\xi</span></span>
     <span>3. pas euclidien → <span class="math">\\tilde{W}</span></span>
     <span>4. rétraction polaire → <span class="math">W^+</span></span>
   </div>
   <p style="color:var(--ink-3);margin-top:16px;">Aucune opération coûteuse spécifique à la géométrie — c'est précisément ce que la deuxième partie du talk va exploiter en distribué.</p>`,
];

// ── Geometry helpers ──────────────────────────────────────────────────────
const TAU = Math.PI * 2;
const ang = (x, y) => Math.atan2(y, x);
const proj = (x, ux, uy) => {
  // Tangent projection at unit vector x (angle), for vector (ux, uy).
  // T_x M = { v : <x, v> = 0 }, so v_tan = v - <x, v> x
  const dot = x.x * ux + x.y * uy;
  return { x: ux - dot * x.x, y: uy - dot * x.y };
};
const retract = (x, vx, vy) => {
  // Polar-factor retraction: x' = (x + v) / ||x + v||
  const px = x.x + vx, py = x.y + vy;
  const n = Math.hypot(px, py) || 1;
  return { x: px / n, y: py / n };
};

// ── Arrow primitive ───────────────────────────────────────────────────────
function Arrow({ x1, y1, x2, y2, color, width = 2.4, dash, opacity = 1, label, labelOffset = [12, -6], labelColor }) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const head = 12;
  const baseX = x2 - ux * head, baseY = y2 - uy * head;
  const nx = -uy, ny = ux;
  const tipL = `${baseX + nx * head * 0.4},${baseY + ny * head * 0.4}`;
  const tipR = `${baseX - nx * head * 0.4},${baseY - ny * head * 0.4}`;
  return (
    <g style={{ opacity }}>
      <line x1={x1} y1={y1} x2={baseX} y2={baseY} stroke={color} strokeWidth={width} strokeDasharray={dash} strokeLinecap="round" />
      <polygon points={`${x2},${y2} ${tipL} ${tipR}`} fill={color} />
      {label && (
        <text x={x2 + labelOffset[0]} y={y2 + labelOffset[1]}
              fontFamily="var(--mono)" fontSize="20" fontWeight="500"
              fill={labelColor || color}>
          {label}
        </text>
      )}
    </g>
  );
}

// ── Explanation panel — sets static HTML + triggers KaTeX render after each step
function ExplainPanel({ step }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = STEP_HTML[step];
    // KaTeX is idempotent (data-rendered guard); re-running is cheap.
    renderMath();
  }, [step]);
  return <div ref={ref} style={{ fontSize: 22, lineHeight: 1.6, color: INK2, flex: 1 }} />;
}

// ── Main island ───────────────────────────────────────────────────────────
export function StiefelUpdate() {
  const containerRef = useRef(null);
  const [step, setStep] = useState(0); // 0..4

  // Listen to the deck's keyboard navigation and to step changes inside our slide.
  useEffect(() => {
    const MAX_STEP = 4;
    const handler = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Skip if user is typing
      const t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      // Only react if our section is the active slide
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

  // Reset to step 0 when slide becomes active (so re-entry starts fresh)
  useEffect(() => {
    const section = containerRef.current?.closest('section, section-divider');
    if (!section) return;
    const stage = section.closest('deck-stage');
    const onChange = () => {
      if (section.hasAttribute('data-deck-active')) {
        setStep(0);
      }
    };
    stage?.addEventListener('slidechange', onChange);
    return () => stage?.removeEventListener('slidechange', onChange);
  }, []);

  // ── Geometry of the demo ────────────────────────────────────────────────
  // SVG coordinate system: 720x720, center at (360, 360), radius 240
  const cx = 360, cy = 360, R = 240;
  // Current point on St(2,1): angle = 130°
  const theta = (130 * Math.PI) / 180;
  const x = { x: Math.cos(theta), y: -Math.sin(theta) }; // y inverted for SVG
  const xPx = { x: cx + R * x.x, y: cy + R * x.y };

  // Euclidean gradient — points into the manifold (not tangent)
  const grad = useMemo(() => {
    // Choose so projection is informative: mostly tangent with some radial
    const gx = -0.55, gy = -0.85;
    return { x: gx, y: gy };
  }, []);
  const gradLen = 0.85; // relative to R
  const gradTip = { x: xPx.x + R * grad.x * gradLen, y: xPx.y + R * grad.y * gradLen };

  // Tangent projection of grad
  const gradTan = proj(x, grad.x, grad.y);
  const tanLen = Math.hypot(gradTan.x, gradTan.y) * gradLen;
  const tanTip = { x: xPx.x + R * gradTan.x * gradLen, y: xPx.y + R * gradTan.y * gradLen };

  // Radial residual (visualises the "killed" component)
  const radial = { x: grad.x - gradTan.x, y: grad.y - gradTan.y };
  const radialTip = { x: xPx.x + R * radial.x * gradLen, y: xPx.y + R * radial.y * gradLen };

  // Retraction: step along tangent with learning rate, then project back
  const eta = 0.85;
  const candidate = { x: x.x + gradTan.x * eta * gradLen, y: x.y + gradTan.y * eta * gradLen };
  const candPx = { x: cx + R * candidate.x, y: cy + R * candidate.y };
  const next = retract(x, gradTan.x * eta * gradLen, gradTan.y * eta * gradLen);
  const nextPx = { x: cx + R * next.x, y: cy + R * next.y };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} style={{
      width: '100%', height: '100%',
      display: 'grid',
      gridTemplateColumns: '1.05fr 0.95fr',
      gap: 0,
      alignItems: 'stretch',
      background: 'var(--bg)',
    }}>
      {/* Left: visualisation */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px 12px',
        borderRight: `1px solid ${RULE}`,
      }}>
        <svg viewBox="0 0 720 720" style={{ width: '100%', maxWidth: 760, height: 'auto', display: 'block' }}>
          {/* Coordinate axes (very subtle) */}
          <line x1={cx - R - 40} y1={cy} x2={cx + R + 40} y2={cy} stroke={RULE} strokeWidth="1" strokeDasharray="3 6" />
          <line x1={cx} y1={cy - R - 40} x2={cx} y2={cy + R + 40} stroke={RULE} strokeWidth="1" strokeDasharray="3 6" />

          {/* Manifold: unit circle = St(2,1) */}
          <circle cx={cx} cy={cy} r={R} fill="none" stroke={INK} strokeWidth="2.5" />
          <text x={cx + R + 20} y={cy - 12} fontFamily="var(--mono)" fontSize="22" fill={INK3}>
            St(2,1) = S¹
          </text>

          {/* Tangent line at x (drawn beyond x both ways) */}
          {step >= 1 && (() => {
            const tx = -x.y, ty = x.x; // tangent direction in (cos, -sin) → (sin, cos)
            const tlen = R * 1.05;
            return (
              <g style={{ transition: 'opacity 220ms' }}>
                <line
                  x1={xPx.x - R * tx * 0.55} y1={xPx.y - R * ty * 0.55}
                  x2={xPx.x + R * tx * 1.05} y2={xPx.y + R * ty * 1.05}
                  stroke={ACCENT} strokeWidth="1.8" strokeDasharray="2 5" opacity="0.65"
                />
                <text
                  x={xPx.x + R * tx * 1.05 + 10}
                  y={xPx.y + R * ty * 1.05 + 4}
                  fontFamily="var(--mono)" fontSize="22" fill={ACCENT}
                  style={{ fontStyle: 'italic' }}
                >
                  T<tspan dy="6" fontSize="16">x</tspan><tspan dy="-6"> M</tspan>
                </text>
              </g>
            );
          })()}

          {/* Euclidean gradient (step 0+) */}
          {step >= 0 && (
            <Arrow
              x1={xPx.x} y1={xPx.y}
              x2={gradTip.x} y2={gradTip.y}
              color={INK2} width="3"
              label={step === 0 ? '∇L' : null}
              labelColor={INK}
              labelOffset={[14, 2]}
            />
          )}

          {/* Tangent projection arrow (step 1+) */}
          {step >= 1 && (
            <Arrow
              x1={xPx.x} y1={xPx.y}
              x2={tanTip.x} y2={tanTip.y}
              color={ACCENT} width="3.5"
              opacity={step >= 1 ? 1 : 0}
              label={step >= 1 && step < 3 ? 'ξ = P_x(∇L)' : null}
              labelOffset={[18, 26]}
            />
          )}

          {/* Killed radial component (faded, step 1 only) */}
          {step >= 1 && step < 3 && (
            <g opacity="0.4">
              <Arrow
                x1={xPx.x} y1={xPx.y}
                x2={radialTip.x} y2={radialTip.y}
                color={INK3} width="2" dash="4 5"
              />
              <text x={(xPx.x + radialTip.x) / 2 + 8} y={(xPx.y + radialTip.y) / 2 + 4}
                    fontFamily="var(--mono)" fontSize="16" fill={INK3} fontStyle="italic">
                composante normale
              </text>
            </g>
          )}

          {/* Candidate point (off-manifold) at step 2 */}
          {step >= 2 && step < 4 && (
            <g style={{ transition: 'opacity 220ms' }}>
              <line x1={xPx.x} y1={xPx.y} x2={candPx.x} y2={candPx.y}
                    stroke={ACCENT} strokeWidth="2" strokeDasharray="3 4" opacity="0.6" />
              <circle cx={candPx.x} cy={candPx.y} r="7" fill={INK} stroke={ACCENT} strokeWidth="2.5" />
              <text x={candPx.x + 14} y={candPx.y - 6}
                    fontFamily="var(--mono)" fontSize="18" fill={INK2}>
                x − η·ξ
              </text>
            </g>
          )}

          {/* Retraction arrow (step 3+): from candidate to manifold */}
          {step >= 3 && (
            <Arrow
              x1={candPx.x} y1={candPx.y}
              x2={nextPx.x} y2={nextPx.y}
              color={ACCENT} width="2" dash="6 4"
            />
          )}
          {step >= 3 && step < 4 && (
            <text x={(candPx.x + nextPx.x) / 2 + 14} y={(candPx.y + nextPx.y) / 2 + 18}
                  fontFamily="var(--mono)" fontSize="18" fill={ACCENT} fontStyle="italic">
              R_x = uf(·)
            </text>
          )}

          {/* New point (step 3+) */}
          {step >= 3 && (
            <circle cx={nextPx.x} cy={nextPx.y} r="9" fill={ACCENT} stroke="var(--bg)" strokeWidth="3" />
          )}

          {/* Current point — always */}
          <circle cx={xPx.x} cy={xPx.y} r="9" fill={INK} />
          <text x={xPx.x - 30} y={xPx.y - 18} fontFamily="var(--mono)" fontSize="22" fill={INK} fontWeight="600">x</text>

          {step >= 3 && (
            <text x={nextPx.x + 16} y={nextPx.y + 6}
                  fontFamily="var(--mono)" fontSize="22" fontWeight="600" fill={ACCENT}>
              x⁺
            </text>
          )}

          {/* Origin tick */}
          <circle cx={cx} cy={cy} r="3" fill={INK3} />
        </svg>
      </div>

      {/* Right: step-by-step explanation */}
      <div style={{
        padding: '50px 56px',
        display: 'flex', flexDirection: 'column',
        background: 'var(--bg-2)',
        overflow: 'hidden',
      }}>
        <div className="eyebrow" style={{ color: ACCENT, marginBottom: 10 }}>
          Mise à jour riemannienne — pas {step + 1} / 5
        </div>
        <h2 className="h2" style={{ margin: '0 0 30px', fontSize: 36 }}>
          {[
            'Gradient euclidien',
            'Projection sur le tangent',
            'Pas dans l\'ambiant',
            'Rétraction sur la variété',
            'Itération suivante',
          ][step]}
        </h2>

        {/* Math content: backslashes & braces would clash with JSX text/expression
            parsing — we hand the literal LaTeX through dangerouslySetInnerHTML so
            the existing math.js / KaTeX rendering on slidechange picks it up. */}
        <ExplainPanel step={step} />

        {/* Step pips */}
        <div style={{ display: 'flex', gap: 8, marginTop: 28 }}>
          {[0,1,2,3,4].map(i => (
            <div key={i} style={{
              flex: 1, height: 3,
              background: i <= step ? ACCENT : RULE,
              transition: 'background 200ms',
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}
