import React, { useRef, useEffect, useState } from 'react';

// ─── Layout constants ─────────────────────────────────────────────────────────
const W = 1760, H = 990;

// All four blocks live in one coordinate space.
// The camera zooms into a 500×281 (16:9) window centered on each block.
const BW = 260, BH = 300;
const BY = 130;
const MID_Y = BY + BH / 2; // = 280

const BX = [155, 465, 775, 1075]; // BiMap, BN, ReEig, LogEig

const ZW = 500, ZH = ZW * H / W; // 500 × 281.25, 16:9

// Camera state viewBoxes: [x, y, w, h]
const STATES = [
  [0, 0, W, H],                                                          // 0 overview
  [BX[0] + BW / 2 - ZW / 2, MID_Y - ZH / 2, ZW, ZH],                  // 1 BiMap
  [BX[1] + BW / 2 - ZW / 2, MID_Y - ZH / 2, ZW, ZH],                  // 2 BN
  [BX[2] + BW / 2 - ZW / 2, MID_Y - ZH / 2, ZW, ZH],                  // 3 ReEig
  [BX[3] + BW / 2 - ZW / 2, MID_Y - ZH / 2, ZW, ZH],                  // 4 LogEig
  [0, 0, W, H],                                                          // 5 recap
];

function easeInOut(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

// ─── Arrow marker ─────────────────────────────────────────────────────────────
function Defs() {
  return (
    <defs>
      <marker id="sa-arr" viewBox="0 0 10 10" refX={9} refY={5}
        markerWidth={6} markerHeight={6} orient="auto">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--ink)" />
      </marker>
    </defs>
  );
}

function Arr({ x1, y, x2 }) {
  return (
    <path d={`M ${x1} ${y} H ${x2}`}
      stroke="var(--ink)" strokeWidth={1.8} fill="none"
      markerEnd="url(#sa-arr)" />
  );
}

// ─── Rich pipeline block ──────────────────────────────────────────────────────
// Embeds full detail inside the block at small scale.
// At overview (1760 wide) → compact readable label.
// At zoom (500 wide) → detail fills the screen.

function RichBlock({ idx, title, formula, bullets, citation, active }) {
  const x = BX[idx], w = BW, h = BH;
  return (
    <g transform={`translate(${x},${BY})`}>
      {/* Accent header bar */}
      <rect width={w} height={20} rx={3}
        fill={active ? 'var(--accent)' : 'var(--ink-3)'} />
      {/* Background */}
      <rect y={20} width={w} height={h - 20} rx={3}
        fill="var(--bg-2)"
        stroke={active ? 'var(--accent)' : 'var(--ink)'}
        strokeWidth={active ? 2.5 : 1.6} />

      {/* Title — readable at both scales */}
      <text x={w / 2} y={52}
        fontFamily="var(--sans)" fontSize={26} fontWeight={700}
        fill="var(--ink)" textAnchor="middle">{title}</text>

      {/* Main formula */}
      <text x={w / 2} y={76}
        fontFamily="var(--mono)" fontSize={13} fontWeight={600}
        fill="var(--accent)" textAnchor="middle">{formula}</text>

      {/* Separator */}
      <line x1={18} y1={88} x2={w - 18} y2={88}
        stroke="var(--ink-3)" strokeWidth={0.7} />

      {/* Bullet list — tiny in overview, reads at ~35px in zoom */}
      {bullets.map((line, i) => (
        <text key={i} x={14} y={103 + i * 19}
          fontFamily="var(--sans)" fontSize={9.5}
          fill="var(--ink)">{'· ' + line}</text>
      ))}

      {/* Citation */}
      <text x={w / 2} y={h - 10}
        fontFamily="var(--mono)" fontSize={7}
        fill="var(--ink-3)" textAnchor="middle">{citation}</text>
    </g>
  );
}

// ─── Overview diagram ─────────────────────────────────────────────────────────

function Pipeline({ state }) {
  const arrowY = MID_Y;

  const BLOCKS = [
    {
      title: 'BiMap',
      formula: 'Xₖ = Wₖ · Xₖ₋₁ · Wₖᵀ',
      bullets: [
        'Wₖ ∈ ℝ^{d₁×d₀},  d₁ < d₀  (dimension reduction)',
        'Wₖ row full-rank  →  Xₖ remains SPD',
        'Wₖ on Stiefel manifold  St(d₁, d₀)',
        'Riemannian gradient on Stiefel in backprop',
        'Analogous to a linear layer for SPD matrices',
        'Stacks k times for progressive dim reduction',
      ],
      citation: 'Huang & Van Gool, AAAI 2017',
    },
    {
      title: 'Riem. BN',
      formula: 'Fréchet mean + parallel transport',
      bullets: [
        '① M = argmin_{M∈Sym⁺} Σᵢ d²_R(Xᵢ, M)',
        '② Center:  X̃ᵢ = M^{-½} · Xᵢ · M^{-½}',
        '③ Bias:  Xₒᵤₜ = G^{½} · X̃ᵢ · G^{½}',
        'G ∈ Sym⁺ is a trainable SPD bias parameter',
        'Running Fréchet mean at inference',
        'Riemannian analogue of standard BatchNorm',
      ],
      citation: 'Brooks et al., NeurIPS 2019',
    },
    {
      title: 'ReEig',
      formula: 'Xₖ = U · max(εI, Σ) · Uᵀ',
      bullets: [
        'Eigendecomp:  Xₖ₋₁ = U Σ Uᵀ',
        'Rectify:  λᵢ ← max(ε, λᵢ)',
        'ε ≈ 10⁻⁴  prevents near-singular output',
        'Differentiable: gradient via matrix chain rule',
        'Maintains SPD (eigenvalues stay positive)',
        'Analogue of ReLU nonlinearity for SPDNet',
      ],
      citation: 'Huang & Van Gool, AAAI 2017',
    },
    {
      title: 'LogEig',
      formula: 'Xₖ = U · log(Σ) · Uᵀ',
      bullets: [
        'Eigendecomp:  Xₖ₋₁ = U Σ Uᵀ',
        'log applied element-wise to diagonal Σ',
        'Maps Sym⁺ manifold → tangent space at I',
        'Output lies in Sym_d  (symmetric, Euclidean)',
        'Vectorize upper-triangular  →  FC  →  Softmax',
        'Bridges Riemannian geometry and Euclidean nets',
      ],
      citation: 'Huang & Van Gool, AAAI 2017',
    },
  ];

  return (
    <g>
      {/* Background label */}
      <text x={W / 2} y={50}
        fontFamily="var(--sans)" fontSize={46} fontWeight={700}
        fill="var(--ink)" textAnchor="middle">SPDNet Architecture</text>
      <text x={W / 2} y={90}
        fontFamily="var(--mono)" fontSize={22} fill="var(--ink-3)" textAnchor="middle">
        Huang &amp; Van Gool, AAAI 2017  ·  Brooks et al., NeurIPS 2019
      </text>

      {/* Input SPD matrix (stacked rects) */}
      {[2, 1, 0].map(i => (
        <rect key={i}
          x={18 + i * 14} y={BY + 75 + i * 14}
          width={110} height={110}
          fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.4} />
      ))}
      <text x={73} y={BY + 20}
        fontFamily="var(--mono)" fontSize={16} fill="var(--ink-3)" textAnchor="middle">
        Input
      </text>
      <text x={73} y={BY + BH + 28}
        fontFamily="var(--mono)" fontSize={16} fill="var(--ink-3)" textAnchor="middle">
        X ∈ Sym⁺
      </text>

      {/* Input → BiMap */}
      <Arr x1={152} y={arrowY} x2={BX[0]} />

      {/* Four rich blocks */}
      {BLOCKS.map((b, i) => (
        <RichBlock key={i} idx={i}
          title={b.title} formula={b.formula}
          bullets={b.bullets} citation={b.citation}
          active={state === i + 1} />
      ))}

      {/* Arrows between blocks */}
      <Arr x1={BX[0] + BW} y={arrowY} x2={BX[1]} />
      <Arr x1={BX[1] + BW} y={arrowY} x2={BX[2]} />
      <Arr x1={BX[2] + BW} y={arrowY} x2={BX[3]} />

      {/* ×k repeat bracket under first three blocks */}
      <path d={`M ${BX[0] - 5} ${BY + BH + 42} H ${BX[2] + BW + 5}`}
        stroke="var(--ink-3)" strokeWidth={1.2} strokeDasharray="5 3" fill="none" />
      <text x={(BX[0] + BX[2] + BW) / 2} y={BY + BH + 66}
        fontFamily="var(--mono)" fontSize={18} fill="var(--ink-3)" textAnchor="middle">
        × k layers
      </text>

      {/* LogEig → vec → FC → Softmax → ŷ */}
      <Arr x1={BX[3] + BW} y={arrowY} x2={1383} />

      {/* Vec */}
      <circle cx={1408} cy={arrowY} r={36}
        fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.6} />
      <text x={1408} y={arrowY - 5}
        fontFamily="var(--sans)" fontSize={16} fontWeight={600}
        fill="var(--ink)" textAnchor="middle">vec</text>
      <text x={1408} y={arrowY + 13}
        fontFamily="var(--mono)" fontSize={12}
        fill="var(--ink-3)" textAnchor="middle">▲</text>

      <Arr x1={1444} y={arrowY} x2={1470} />

      {/* FC */}
      <g transform={`translate(1470,${arrowY - 44})`}>
        <rect width={108} height={88} rx={3}
          fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.6} />
        <text x={54} y={40} fontFamily="var(--sans)" fontSize={20} fontWeight={600}
          fill="var(--ink)" textAnchor="middle">FC</text>
        <text x={54} y={64} fontFamily="var(--mono)" fontSize={13}
          fill="var(--ink-3)" textAnchor="middle">linear</text>
      </g>

      <Arr x1={1578} y={arrowY} x2={1604} />

      {/* Softmax */}
      <g transform={`translate(1604,${arrowY - 44})`}>
        <rect width={130} height={88} rx={3}
          fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.6} />
        <text x={65} y={40} fontFamily="var(--sans)" fontSize={20} fontWeight={600}
          fill="var(--ink)" textAnchor="middle">Softmax</text>
        <text x={65} y={64} fontFamily="var(--mono)" fontSize={13}
          fill="var(--ink-3)" textAnchor="middle">classes</text>
      </g>

      <Arr x1={1734} y={arrowY} x2={1752} />
      <text x={1758} y={arrowY + 12}
        fontFamily="var(--mono)" fontSize={38} fill="var(--accent)">ŷ</text>

      {/* State hint */}
      {state === 0 && (
        <text x={W / 2} y={H - 55}
          fontFamily="var(--mono)" fontSize={20} fill="var(--ink-3)" textAnchor="middle">
          press → to zoom into each layer
        </text>
      )}
      {state === 5 && (
        <text x={W / 2} y={H - 55}
          fontFamily="var(--mono)" fontSize={20} fill="var(--accent)" textAnchor="middle">
          end of SPDNet walkthrough
        </text>
      )}
    </g>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SpdNetArch() {
  const svgRef       = useRef(null);
  const containerRef = useRef(null);
  const [state, setState] = useState(0);

  useEffect(() => {
    const svg       = svgRef.current;
    const container = containerRef.current;
    if (!svg || !container) return;

    svg.setAttribute('viewBox', STATES[0].join(' '));

    const reducedMotion =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let rafId = null;

    function lerp4(a, b, e) {
      return a.map((v, i) => v + (b[i] - v) * e);
    }

    function animateDirect(from, to, duration) {
      if (rafId) cancelAnimationFrame(rafId);
      const t0 = performance.now();
      const tick = (now) => {
        const t = Math.min((now - t0) / duration, 1);
        const e = easeInOut(t);
        svg.setAttribute('viewBox', lerp4(from, to, e).join(' '));
        if (t < 1) rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    }

    function animateThrough(from, mid, to, duration) {
      // Two equal phases: from→mid then mid→to
      if (rafId) cancelAnimationFrame(rafId);
      const t0 = performance.now();
      const tick = (now) => {
        const rawT = Math.min((now - t0) / duration, 1);
        let vb;
        if (rawT < 0.5) {
          const e = easeInOut(rawT * 2);
          vb = lerp4(from, mid, e);
        } else {
          const e = easeInOut((rawT - 0.5) * 2);
          vb = lerp4(mid, to, e);
        }
        svg.setAttribute('viewBox', vb.join(' '));
        if (rawT < 1) rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    }

    function tweenTo(targetIdx) {
      const curStr = svg.getAttribute('viewBox') || STATES[0].join(' ');
      const from   = curStr.split(' ').map(Number);
      const to     = STATES[Math.max(0, Math.min(STATES.length - 1, targetIdx))];

      if (reducedMotion) {
        svg.setAttribute('viewBox', to.join(' '));
        return;
      }

      // If currently zoomed AND target is also zoomed → zoom out through overview,
      // then zoom into target. This gives the "zoom out + zoom into next" effect.
      const isZoomed = (vb) => vb[2] < W - 10;
      if (isZoomed(from) && isZoomed(to)) {
        animateThrough(from, STATES[0], to, 1100);
      } else {
        animateDirect(from, to, 560);
      }
    }

    function readState() {
      const markers = [...container.querySelectorAll('i[data-step]')];
      const visible = markers.filter(m => m.hasAttribute('data-step-visible')).length;
      setState(visible);
      tweenTo(visible);
    }

    readState();

    const obs = new MutationObserver(readState);
    obs.observe(container, {
      subtree: true, attributes: true, attributeFilter: ['data-step-visible'],
    });

    return () => {
      obs.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      {/* Deck-stage step markers — one per camera state beyond overview */}
      {STATES.slice(1).map((_, i) => (
        <i key={i} data-step style={{ display: 'none' }} />
      ))}

      <svg ref={svgRef}
        width="100%" height="100%"
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block' }}>
        <Defs />
        <Pipeline state={state} />
      </svg>
    </div>
  );
}
