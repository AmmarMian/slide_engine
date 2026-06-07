import React, { useRef, useEffect, useState } from 'react';
import katex from 'katex';

// ─── SVG pipeline constants ───────────────────────────────────────────────────
const W = 1760, H = 990;

// Architecture: BiMap → ReEig (× k), then LogEig → vec → FC → Softmax
// BN layer moved to ARMAGNAC section of the deck.
const BLOCKS = [
  { label: 'BiMap', eq: 'Xₖ = Wₖ Xₖ₋₁ Wₖᵀ' },
  { label: 'ReEig', eq: 'Xₖ = U max(εI,Σ) Uᵀ' },
  { label: 'LogEig', eq: 'Xₖ = U log(Σ) Uᵀ' },
];

// Block layout
const BX = [170, 480, 790]; // x positions (3 blocks)
const BY = 110, BW = 260, BH = 320, MID_Y = BY + BH / 2; // center y = 270
const DY = 210; // vertical offset applied by the Pipeline translate

// Zoom window: 600 × ~338 (16:9), centred on each block — moderate zoom
const ZW = 600, ZH = ZW * H / W;

const STATES = [
  [0, 0, W, H],                                                          // 0 overview
  [BX[0] + BW / 2 - ZW / 2, MID_Y + DY - ZH / 2, ZW, ZH],             // 1 BiMap
  [BX[1] + BW / 2 - ZW / 2, MID_Y + DY - ZH / 2, ZW, ZH],             // 2 ReEig
  [BX[2] + BW / 2 - ZW / 2, MID_Y + DY - ZH / 2, ZW, ZH],             // 3 LogEig
  [0, 0, W, H],                                                          // 4 recap
];

function ease(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

// ─── SVG pipeline (overview only, minimal monochrome) ────────────────────────

function Defs() {
  return (
    <defs>
      <marker id="spa" viewBox="0 0 10 10" refX={9} refY={5}
        markerWidth={6} markerHeight={6} orient="auto">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--ink)" />
      </marker>
    </defs>
  );
}

function Pipeline({ activeIdx }) {
  const ay = MID_Y;
  return (
    <g transform={`translate(0,${DY})`}>
      <text x={W / 2} y={46}
        fontFamily="var(--sans)" fontSize={44} fontWeight={700}
        fill="var(--ink)" textAnchor="middle" letterSpacing="-0.02em">
        SPDNet
      </text>
      <text x={W / 2} y={84}
        fontFamily="var(--mono)" fontSize={20} fill="var(--ink-3)" textAnchor="middle">
        Huang, Makur &amp; Van Gool (2017)  ·  Brooks et al. (2019)
      </text>

      {/* Input covariance matrix (stacked squares) */}
      {[2, 1, 0].map(i => (
        <rect key={i}
          x={20 + i * 13} y={BY + 85 + i * 13}
          width={115} height={115}
          fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.5} />
      ))}
      <text x={88} y={BY + 16}
        fontFamily="var(--mono)" fontSize={16} fill="var(--ink-3)" textAnchor="middle">Input</text>
      <text x={88} y={BY + BH + 32}
        fontFamily="var(--mono)" fontSize={16} fill="var(--ink-3)" textAnchor="middle">X ∈ Sym⁺</text>

      {/* Input → BiMap */}
      <path d={`M 158 ${ay} H ${BX[0]}`}
        stroke="var(--ink)" strokeWidth={1.8} fill="none" markerEnd="url(#spa)" />

      {/* 4 pipeline blocks */}
      {BLOCKS.map((b, i) => (
        <g key={i} transform={`translate(${BX[i]},${BY})`}>
          {/* Active accent bar */}
          {activeIdx === i + 1 &&
            <rect width={BW} height={10} rx={2} fill="var(--ink)" />}
          <rect y={10} width={BW} height={BH - 10} rx={3}
            fill="var(--bg-2)" stroke="var(--ink)"
            strokeWidth={activeIdx === i + 1 ? 2.5 : 1.6} />
          <text x={BW / 2} y={BH / 2 + 2}
            fontFamily="var(--sans)" fontSize={26} fontWeight={700}
            fill="var(--ink)" textAnchor="middle">{b.label}</text>
          <text x={BW / 2} y={BH / 2 + 34}
            fontFamily="var(--mono)" fontSize={12.5}
            fill="var(--ink-3)" textAnchor="middle">{b.eq}</text>
        </g>
      ))}

      {/* Arrows between core blocks */}
      {[0, 1].map(i => (
        <path key={i}
          d={`M ${BX[i] + BW} ${ay} H ${BX[i + 1]}`}
          stroke="var(--ink)" strokeWidth={1.8} fill="none" markerEnd="url(#spa)" />
      ))}

      {/* ×k repeat brace under first 2 blocks (BiMap + ReEig) */}
      <path d={`M ${BX[0] - 6} ${BY + BH + 46} H ${BX[1] + BW + 6}`}
        stroke="var(--ink-3)" strokeWidth={1} strokeDasharray="5 3" fill="none" />
      <text x={(BX[0] + BX[1] + BW) / 2} y={BY + BH + 70}
        fontFamily="var(--mono)" fontSize={18} fill="var(--ink-3)" textAnchor="middle">× k</text>

      {/* LogEig → vec → FC → Softmax → ŷ */}
      <path d={`M ${BX[2] + BW} ${ay} H ${1388}`}
        stroke="var(--ink)" strokeWidth={1.8} fill="none" markerEnd="url(#spa)" />

      <circle cx={1415} cy={ay} r={34}
        fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.6} />
      <text x={1415} y={ay - 4}
        fontFamily="var(--sans)" fontSize={15} fontWeight={600}
        fill="var(--ink)" textAnchor="middle">vec</text>
      <text x={1415} y={ay + 14}
        fontFamily="var(--mono)" fontSize={12} fill="var(--ink-3)" textAnchor="middle">▲</text>

      <path d={`M 1449 ${ay} H 1470`}
        stroke="var(--ink)" strokeWidth={1.8} fill="none" markerEnd="url(#spa)" />

      {[{ x: 1470, w: 106, label: 'FC' }, { x: 1600, w: 130, label: 'Softmax' }].map(b => (
        <React.Fragment key={b.x}>
          <rect x={b.x} y={ay - 40} width={b.w} height={80} rx={3}
            fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.6} />
          <text x={b.x + b.w / 2} y={ay + 8}
            fontFamily="var(--sans)" fontSize={19} fontWeight={600}
            fill="var(--ink)" textAnchor="middle">{b.label}</text>
          <path d={`M ${b.x + b.w} ${ay} H ${b.x + b.w + 20}`}
            stroke="var(--ink)" strokeWidth={1.8} fill="none" markerEnd="url(#spa)" />
        </React.Fragment>
      ))}
      <text x={1760} y={ay + 10}
        fontFamily="var(--mono)" fontSize={36} fill="var(--ink)">ŷ</text>

      <text x={W / 2} y={H - 52}
        fontFamily="var(--mono)" fontSize={19} fill="var(--ink-3)" textAnchor="middle">
        {activeIdx === 0 ? 'appuyer → pour explorer chaque couche' : ''}
      </text>
    </g>
  );
}

// ─── Detail slide diagrams ────────────────────────────────────────────────────
// Each is a self-contained SVG diagram at viewBox "0 0 400 300"

function DiagramBiMap() {
  // Input (big stacked squares) → W → Output (smaller stacked squares)
  const big = 100, sml = 72, off = 12;
  return (
    <svg viewBox="0 0 400 300" width="100%" height="100%" style={{ display: 'block' }}>
      <defs>
        <marker id="sbm" viewBox="0 0 10 10" refX={9} refY={5}
          markerWidth={5} markerHeight={5} orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--ink)" />
        </marker>
      </defs>
      {/* Input matrix */}
      {[2, 1, 0].map(i => (
        <React.Fragment key={i}>
          <rect x={18 + i * off} y={60 + i * off} width={big} height={big}
            fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.5} />
          {/* inner grid */}
          {[1, 2].map(j => (
            <React.Fragment key={j}>
              <line x1={18 + i * off + j * (big / 3)} y1={60 + i * off}
                x2={18 + i * off + j * (big / 3)} y2={60 + i * off + big}
                stroke="var(--ink-3)" strokeWidth={0.5} />
              <line x1={18 + i * off} y1={60 + i * off + j * (big / 3)}
                x2={18 + i * off + big} y2={60 + i * off + j * (big / 3)}
                stroke="var(--ink-3)" strokeWidth={0.5} />
            </React.Fragment>
          ))}
        </React.Fragment>
      ))}
      <text x={86} y={200} fontFamily="var(--mono)" fontSize={13}
        fill="var(--ink-3)" textAnchor="middle">d₀ × d₀</text>

      {/* W label + arrows: input → W → output */}
      <rect x={168} y={88} width={60} height={36} rx={3}
        fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.4} />
      <text x={198} y={112} fontFamily="var(--mono)" fontSize={15} fontWeight={700}
        fill="var(--ink)" textAnchor="middle">Wₖ</text>
      <path d="M 122 110 H 162" stroke="var(--ink)" strokeWidth={1.4}
        fill="none" markerEnd="url(#sbm)" />
      <path d="M 228 110 H 278" stroke="var(--ink)" strokeWidth={1.4}
        fill="none" markerEnd="url(#sbm)" />

      {/* Output matrix (smaller) */}
      {[1, 0].map(i => (
        <React.Fragment key={i}>
          <rect x={278 + i * off} y={74 + i * off} width={sml} height={sml}
            fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.5} />
          {[1].map(j => (
            <React.Fragment key={j}>
              <line x1={278 + i * off + sml / 2} y1={74 + i * off}
                x2={278 + i * off + sml / 2} y2={74 + i * off + sml}
                stroke="var(--ink-3)" strokeWidth={0.5} />
              <line x1={278 + i * off} y1={74 + i * off + sml / 2}
                x2={278 + i * off + sml} y2={74 + i * off + sml / 2}
                stroke="var(--ink-3)" strokeWidth={0.5} />
            </React.Fragment>
          ))}
        </React.Fragment>
      ))}
      <text x={328} y={200} fontFamily="var(--mono)" fontSize={13}
        fill="var(--ink-3)" textAnchor="middle">d₁ × d₁</text>

      <text x={200} y={240} fontFamily="var(--sans)" fontSize={13}
        fill="var(--ink-3)" textAnchor="middle">d₁ &lt; d₀  —  dimension réduite</text>
      <text x={200} y={260} fontFamily="var(--mono)" fontSize={12}
        fill="var(--ink-3)" textAnchor="middle">Wₖ ∈ variété de Stiefel St(d₁, d₀)</text>
    </svg>
  );
}

function DiagramReEig() {
  // Bar chart of eigenvalues, ε threshold line, tiny bars clearly shown
  const eigenvals = [1.8, 1.3, 0.85, 0.04, 0.007];
  const maxH = 180, base = 230;
  const scale = maxH / 2.0;
  const bw = 46, gap = 14;
  const totalW = eigenvals.length * bw + (eigenvals.length - 1) * gap; // 274
  const ox = (400 - totalW) / 2; // center in viewBox
  const epsilon = 0.10;
  const epY = base - epsilon * scale; // y of ε line

  return (
    <svg viewBox="0 0 400 300" width="100%" height="100%" style={{ display: 'block' }}>
      {eigenvals.map((λ, i) => {
        const bx = ox + i * (bw + gap);
        const barH = Math.max(λ * scale, 1);
        const isTiny = λ < epsilon;
        return (
          <g key={i}>
            <rect x={bx} y={base - barH} width={bw} height={barH}
              fill={isTiny ? 'var(--ink-3)' : 'var(--bg-2)'}
              stroke="var(--ink)" strokeWidth={1.4} rx={2}
              opacity={isTiny ? 0.35 : 0.9} />
            <text x={bx + bw / 2} y={base + 16}
              fontFamily="var(--mono)" fontSize={12}
              fill="var(--ink-3)" textAnchor="middle">λ{i + 1}</text>
          </g>
        );
      })}

      {/* Baseline */}
      <line x1={ox - 6} y1={base} x2={ox + totalW + 6} y2={base}
        stroke="var(--ink-3)" strokeWidth={1} />

      {/* ε threshold */}
      <line x1={ox - 6} y1={epY} x2={ox + totalW + 6} y2={epY}
        stroke="var(--ink)" strokeWidth={1.4} strokeDasharray="6 3" />
      <text x={ox + totalW + 12} y={epY + 4}
        fontFamily="var(--mono)" fontSize={13} fontWeight={700} fill="var(--ink)">ε</text>

      {/* Callout for tiny bars */}
      <text x={200} y={265} fontFamily="var(--sans)" fontSize={13}
        fill="var(--ink-3)" textAnchor="middle">
        λ₄, λ₅ raised to ε by max(ε, λᵢ)  —  matrix stays well-conditioned
      </text>

      {/* Upward arrow from last bar to ε line */}
      <path d={`M ${ox + 4 * (bw + gap) + bw / 2} ${base - 8}
                V ${epY + 4}`}
        stroke="var(--ink)" strokeWidth={1.2} fill="none"
        markerEnd="url(#spa)" />
    </svg>
  );
}

export function BnDiagram() {
  // from/to track the two phases being interpolated; t is linear 0→1.
  const [from, setFrom] = useState(0);
  const [to,   setTo]   = useState(0);
  const [t,    setT]    = useState(1);
  const toRef  = useRef(0);
  const rafRef = useRef(null);

  function ease(x) { return x < 0.5 ? 2*x*x : -1+(4-2*x)*x; }
  function lerpE(a, b, x) { const e = ease(x); return a.map((v,i) => v+(b[i]-v)*e); }

  // [cx, cy, rx, ry, deg]
  // Phase 0 & 1: same raw scatter — mean appears as a separate overlay in phase 1
  // Phase 2: whitened.  Avg position ≈ (230,175) = identity centre.
  //          Avg rx≈16, avg ry≈16  →  geometric mean ≈ I (circle)
  // Phase 3: rebiased.  Avg position ≈ (228,172) = Γ centre.
  //          Avg rx≈11, avg ry≈24, avg deg≈32  →  geometric mean ≈ Γ
  const RAW = [[138,175,33,16,28],[188,145,20,13,-18],[255,158,28,19,46],[162,202,17,11,5],[235,195,24,15,-30],[290,170,19,15,12]];
  const CFGS = [
    RAW, // phase 0: raw batch
    RAW, // phase 1: same positions; mean overlay appears separately
    // phase 2: whitened — avg cx≈230, cy≈175, rx≈16, ry≈16  →  geom. mean ≈ I
    [[185,160,22,12,15],[225,148,13,22,-8],[265,163,20,15,42],[192,192,11,20,2],[244,196,18,11,-28],[270,175,10,16,8]],
    // phase 3: rebiased — avg cx≈228, cy≈172, rx≈11, ry≈24, deg≈32  →  geom. mean ≈ Γ
    [[188,158,16,30,28],[225,145,9,25,30],[262,160,13,22,42],[195,192,7,26,24],[242,196,11,20,38],[268,172,9,21,32]],
  ];

  const MEAN  = [211, 176, 24, 15,  7]; // approx geometric mean of raw batch
  const IDENT = [230, 175, 16, 16,  0]; // identity = circle
  const GAMMA = [228, 172, 11, 24, 34]; // learned Γ

  function startTransition(curr, next) {
    cancelAnimationFrame(rafRef.current);
    toRef.current = next;
    setFrom(curr);
    setTo(next);
    setT(0);
    const t0 = performance.now(), DUR = 820;
    function tick(now) {
      const raw = Math.min((now - t0) / DUR, 1);
      setT(raw);
      if (raw < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  const svgRef = useRef(null);

  useEffect(() => {
    function onKey(e) {
      if (!svgRef.current?.closest('[data-deck-active]')) return;
      const curr = toRef.current;
      const fwd = e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown';
      const bwd = e.key === 'ArrowLeft'  || e.key === 'PageUp';
      if (fwd && curr < 3) { e.stopPropagation(); startTransition(curr, curr + 1); }
      if (bwd && curr > 0) { e.stopPropagation(); startTransition(curr, curr - 1); }
    }
    // capture phase so we intercept before deck-stage's bubble-phase listener
    window.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('keydown', onKey, true); cancelAnimationFrame(rafRef.current); };
  }, []);

  function handleClick(e) {
    e.stopPropagation();
    const curr = toRef.current;
    if (curr < 3) startTransition(curr, curr + 1);
  }

  const ellipses = CFGS[from].map((e, i) => lerpE(e, CFGS[to][i], t));

  // markerOp: 1 when stable at targetPhase; fades in/out during transitions
  function markerOp(target) {
    if (to === target) return ease(t);            // fading in (or stable when t=1)
    if (from === target && from !== to) return 1 - ease(t); // fading out
    return 0;
  }
  const meanOp  = markerOp(1);
  const identOp = markerOp(2);
  const gammaOp = markerOp(3);
  const geodOp  = meanOp;

  const STEPS = [
    { label: 'Batch',       sub: 'Σᵢ brut'    },
    { label: 'Moy. géom.',  sub: 'M_B'         },
    { label: 'Blanchiment', sub: 'M⁻½ΣᵢM⁻½'   },
    { label: 'Re-biais',    sub: 'Γ½Σ̂ᵢΓ½'      },
  ];
  const BW = 96, GAP = 22, X0 = 10;
  const boxX = STEPS.map((_, i) => X0 + i * (BW + GAP));

  const CAPTIONS = [
    'Batch brut — Σᵢ dispersées sur 𝒮₊ᵈ',
    'Moyenne géométrique M_B (Fréchet)',
    'Blanchiment : Σ̂ᵢ = M_B⁻½ Σᵢ M_B⁻½  →  centrées autour de I',
    'Re-biais : Yᵢ = Γ½ Σ̂ᵢ Γ½  →  centrées autour de Γ',
  ];

  return (
    <svg ref={svgRef} viewBox="0 0 480 308" width="100%" height="100%"
      style={{ display:'block', cursor: to < 3 ? 'pointer' : 'default' }}
      onClick={handleClick}>
      <defs>
        <marker id="bnarr0" viewBox="0 0 8 8" refX={7} refY={4}
          markerWidth={4} markerHeight={4} orient="auto">
          <path d="M 0 1 L 7 4 L 0 7 z" fill="var(--rule)" />
        </marker>
        <marker id="bnarr1" viewBox="0 0 8 8" refX={7} refY={4}
          markerWidth={4} markerHeight={4} orient="auto">
          <path d="M 0 1 L 7 4 L 0 7 z" fill="var(--accent)" />
        </marker>
      </defs>

      {/* ── Flowchart ── */}
      {STEPS.map((s, i) => {
        const x     = boxX[i];
        const active = i === to;
        const done   = i < to;
        return (
          <React.Fragment key={i}>
            {i > 0 && (
              <line x1={boxX[i-1]+BW} y1={30} x2={x-1} y2={30}
                stroke={done ? 'var(--accent)' : 'var(--rule)'}
                strokeWidth={1.5}
                markerEnd={`url(#${done ? 'bnarr1' : 'bnarr0'})`} />
            )}
            <rect x={x} y={8} width={BW} height={44} rx={6}
              fill={active ? 'var(--accent)' : 'var(--bg-2)'}
              stroke={active ? 'none' : done ? 'var(--accent)' : 'var(--rule)'}
              strokeWidth={1} />
            <text x={x+BW/2} y={27}
              fontFamily="var(--sans)" fontSize={11} fontWeight={active ? 700 : 500}
              fill={active ? 'var(--bg)' : done ? 'var(--accent)' : 'var(--ink)'}
              textAnchor="middle">{s.label}</text>
            <text x={x+BW/2} y={41}
              fontFamily="var(--mono)" fontSize={9}
              fill={active ? 'rgba(255,255,255,0.72)' : 'var(--ink-3)'}
              textAnchor="middle">{s.sub}</text>
          </React.Fragment>
        );
      })}

      {/* ── Manifold surface hint ── */}
      <path d="M 32 240 Q 240 195 448 236 L 448 270 Q 240 278 32 274 Z"
        fill="var(--bg-2)" stroke="none" opacity={0.5} />
      <path d="M 32 240 Q 240 195 448 236"
        fill="none" stroke="var(--rule-soft)" strokeWidth={1} />
      <text x={240} y={262} fontFamily="var(--mono)" fontSize={9}
        fill="var(--ink-3)" textAnchor="middle" opacity={0.55}>𝒮₊ᵈ</text>

      {/* ── Geodesic lines → M_B (visible in phase 1) ── */}
      {geodOp > 0.01 && ellipses.map(([cx,cy], i) => (
        <line key={i} x1={cx} y1={cy} x2={MEAN[0]} y2={MEAN[1]}
          stroke="var(--accent)" strokeWidth={0.9} strokeDasharray="4 3"
          opacity={geodOp * 0.55} />
      ))}

      {/* ── Ellipses ── */}
      {ellipses.map(([cx,cy,rx,ry,deg], i) => (
        <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry}
          transform={`rotate(${deg},${cx},${cy})`}
          fill="var(--bg)" stroke="var(--ink)" strokeWidth={1.7} />
      ))}

      {/* ── Mean M_B overlay ── */}
      {meanOp > 0.01 && <>
        <ellipse cx={MEAN[0]} cy={MEAN[1]} rx={MEAN[2]} ry={MEAN[3]}
          transform={`rotate(${MEAN[4]},${MEAN[0]},${MEAN[1]})`}
          fill="var(--accent)" stroke="none" opacity={0.18 * meanOp} />
        <ellipse cx={MEAN[0]} cy={MEAN[1]} rx={MEAN[2]} ry={MEAN[3]}
          transform={`rotate(${MEAN[4]},${MEAN[0]},${MEAN[1]})`}
          fill="none" stroke="var(--accent)" strokeWidth={2.2} opacity={meanOp} />
        <text x={MEAN[0]+MEAN[2]+7} y={MEAN[1]+4}
          fontFamily="var(--mono)" fontSize={11} fill="var(--accent)"
          opacity={meanOp}>M_B</text>
      </>}

      {/* ── Identity circle I ── */}
      {identOp > 0.01 && <>
        <circle cx={IDENT[0]} cy={IDENT[1]} r={IDENT[2]}
          fill="none" stroke="var(--ink-2)" strokeWidth={2}
          strokeDasharray="5 3" opacity={identOp} />
        <text x={IDENT[0]+IDENT[2]+7} y={IDENT[1]+4}
          fontFamily="var(--mono)" fontSize={11} fill="var(--ink-2)"
          opacity={identOp}>I</text>
      </>}

      {/* ── Learned bias Γ ── */}
      {gammaOp > 0.01 && <>
        <ellipse cx={GAMMA[0]} cy={GAMMA[1]} rx={GAMMA[2]} ry={GAMMA[3]}
          transform={`rotate(${GAMMA[4]},${GAMMA[0]},${GAMMA[1]})`}
          fill="var(--accent)" stroke="none" opacity={0.18 * gammaOp} />
        <ellipse cx={GAMMA[0]} cy={GAMMA[1]} rx={GAMMA[2]} ry={GAMMA[3]}
          transform={`rotate(${GAMMA[4]},${GAMMA[0]},${GAMMA[1]})`}
          fill="none" stroke="var(--accent)" strokeWidth={2.2}
          strokeDasharray="6 3" opacity={gammaOp} />
        <text x={GAMMA[0]+GAMMA[3]+7} y={GAMMA[1]+4}
          fontFamily="var(--mono)" fontSize={11} fill="var(--accent)"
          opacity={gammaOp}>Γ</text>
      </>}

      {/* ── Caption ── */}
      <text x={228} y={299} fontFamily="var(--mono)" fontSize={9.5}
        fill="var(--ink-3)" textAnchor="middle">{CAPTIONS[to]}</text>

      {/* ── Key hint ── */}
      {to < 3 && <text x={468} y={299} fontFamily="var(--mono)" fontSize={9}
        fill="var(--ink-3)" textAnchor="end" opacity={0.4}>→ suite</text>}
    </svg>
  );
}

function DiagramLogEig() {
  // Layout: flat Euclidean plane (T_I Sym⁺) on TOP, SPD cone on BOTTOM.
  // Arrow goes from X on the cone UP to log(X) on the plane.

  const cx = 200;

  // ── Flat plane (top) ──────────────────────────────────────────────────────
  // Perspectival trapezoid: wider at near (bottom of trapezoid = y=100), narrower far (y=22)
  const pT = { x1: 62, x2: 338, y: 22 };   // far edge (top of screen)
  const pB = { x1: 30, x2: 370, y: 100 };  // near edge

  // Projected point on plane
  const logX = 154, logY = 72;

  // ── Cone (bottom, SPD manifold) ───────────────────────────────────────────
  // Cone rim (top, opening) at y=148; apex at y=282
  const rimY = 148, rimRx = 138, rimRy = 20, apexY = 282;

  // Point X on the cone surface — on the left side, mid-height
  const Xx = 128, Xy = 198;

  // Ribs: from rim down to apex
  const ribAngles = [-75, -40, -5, 32, 68, 105];
  const ribs = ribAngles.map(deg => {
    const r = deg * Math.PI / 180;
    const bx = cx + rimRx * Math.sin(r);
    const by = rimY + rimRy * Math.cos(r);
    return { bx, by, cpx: cx + (bx - cx) * 0.2, cpy: (by + apexY) * 0.5 };
  });

  // Latitude rings — keep well within cone outline to avoid "outside manifold" artifact
  const lats = [
    { s: 0.60, dy: 44 },   // ~1/3 down from rim
    { s: 0.30, dy: 88 },   // ~2/3 down
  ].map(({ s, dy }) => ({
    lx: cx - rimRx * s, rx: cx + rimRx * s,
    cy: rimY + dy, ry: rimRy * s,
  }));

  return (
    <svg viewBox="0 0 400 300" width="100%" height="100%" style={{ display: 'block' }}>
      <defs>
        <marker id="slg" viewBox="0 0 10 10" refX={9} refY={5}
          markerWidth={5} markerHeight={5} orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--ink)" />
        </marker>
      </defs>

      {/* ── Flat Euclidean plane (top) ── */}
      <path
        d={`M ${pT.x1} ${pT.y} L ${pT.x2} ${pT.y} L ${pB.x2} ${pB.y} L ${pB.x1} ${pB.y} Z`}
        fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.6} />
      {[0.33, 0.66].map(h => {
        const lx = pT.x1 + h * (pB.x1 - pT.x1);
        const rx = pT.x2 + h * (pB.x2 - pT.x2);
        const y = pT.y + h * (pB.y - pT.y);
        return <line key={h} x1={lx} y1={y} x2={rx} y2={y}
          stroke="var(--ink-3)" strokeWidth={0.5} />;
      })}
      {[0.2, 0.4, 0.6, 0.8].map(u => {
        const tx = pT.x1 + u * (pT.x2 - pT.x1);
        const bx = pB.x1 + u * (pB.x2 - pB.x1);
        return <line key={u} x1={tx} y1={pT.y} x2={bx} y2={pB.y}
          stroke="var(--ink-3)" strokeWidth={0.5} />;
      })}
      <text x={308} y={90}
        fontFamily="var(--mono)" fontSize={10} fill="var(--ink-3)" textAnchor="middle">
        T_I Sym⁺
      </text>
      <text x={308} y={101}
        fontFamily="var(--mono)" fontSize={10} fill="var(--ink-3)" textAnchor="middle">
        ≅ Sym_d
      </text>

      {/* log(X) point on plane */}
      <circle cx={logX} cy={logY} r={7} fill="var(--ink)" />
      <text x={logX - 14} y={logY - 10}
        fontFamily="var(--mono)" fontSize={12} fontWeight={700}
        fill="var(--ink)" textAnchor="middle">log(X)</text>

      {/* ── Arrow X → log(X) (upward) ── */}
      <path d={`M ${Xx} ${Xy - 8} L ${logX} ${logY + 10}`}
        stroke="var(--ink)" strokeWidth={1.8} fill="none" markerEnd="url(#slg)" />
      <text x={Xx - 36} y={(Xy + logY) / 2}
        fontFamily="var(--mono)" fontSize={11} fill="var(--ink)" textAnchor="middle">Log_I</text>

      {/* ── Cone (SPD manifold, bottom) ── */}
      {/* Fill */}
      <path
        d={`M ${cx - rimRx} ${rimY} A ${rimRx} ${rimRy} 0 0 1 ${cx + rimRx} ${rimY}
            L ${cx} ${apexY} Z`}
        fill="var(--bg-2)" stroke="none" />

      {/* Longitude ribs */}
      {ribs.map((r, i) => (
        <path key={i}
          d={`M ${r.bx} ${r.by} Q ${r.cpx} ${r.cpy} ${cx} ${apexY}`}
          fill="none" stroke="var(--ink-3)" strokeWidth={0.7} opacity={0.65} />
      ))}

      {/* Latitude rings — constrained to stay inside cone */}
      {lats.map((l, i) => (
        <path key={i}
          d={`M ${l.lx} ${l.cy} A ${(l.rx - l.lx) / 2} ${l.ry} 0 0 1 ${l.rx} ${l.cy}`}
          fill="none" stroke="var(--ink-3)" strokeWidth={0.7} opacity={0.65} />
      ))}

      {/* Cone outline */}
      <line x1={cx - rimRx} y1={rimY} x2={cx} y2={apexY}
        stroke="var(--ink)" strokeWidth={1.6} />
      <line x1={cx + rimRx} y1={rimY} x2={cx} y2={apexY}
        stroke="var(--ink)" strokeWidth={1.6} />
      {/* Front rim ellipse */}
      <path d={`M ${cx - rimRx} ${rimY} A ${rimRx} ${rimRy} 0 0 1 ${cx + rimRx} ${rimY}`}
        fill="none" stroke="var(--ink)" strokeWidth={1.6} />
      {/* Back rim (dashed) */}
      <path d={`M ${cx - rimRx} ${rimY} A ${rimRx} ${rimRy} 0 0 0 ${cx + rimRx} ${rimY}`}
        fill="none" stroke="var(--ink-3)" strokeWidth={0.9} strokeDasharray="4 3" />

      {/* Manifold label */}
      <text x={308} y={168}
        fontFamily="var(--mono)" fontSize={10} fill="var(--ink-3)" textAnchor="middle">Sym⁺_d</text>
      <text x={308} y={179}
        fontFamily="var(--mono)" fontSize={10} fill="var(--ink-3)" textAnchor="middle">(variété)</text>

      {/* Point X on cone */}
      <circle cx={Xx} cy={Xy} r={8} fill="var(--ink)" />
      <text x={Xx - 14} y={Xy + 4}
        fontFamily="var(--mono)" fontSize={14} fontWeight={700}
        fill="var(--ink)" textAnchor="end">X</text>
    </svg>
  );
}

// ─── Citation label — reads the number citations.js already wrote into the DOM ─
function CiteLabel({ refKey }) {
  const [num, setNum] = useState('');
  useEffect(() => {
    const el = document.querySelector(`cite-ref[key="${refKey}"]`);
    if (el) setNum(el.textContent);
  }, [refKey]);
  if (!num) return null;
  return (
    <div style={{ fontFamily: 'var(--sans)', fontSize: '18px', color: 'var(--ink-3)', marginTop: '8px' }}>
      <sup style={{ fontFamily: 'var(--mono)', color: 'var(--accent)', fontWeight: 700, fontSize: '14px' }}>{num}</sup>
      {' '}Huang, Makur &amp; Van Gool (AAAI 2017)
    </div>
  );
}

// ─── Detail slide layout (HTML, covers the full slide body) ──────────────────

const DETAILS = [
  {
    title: 'BiMap — projection bilinéaire',
    formula: String.raw`X_k = W_k\, X_{k-1}\, W_k^\top`,
    formulaSub: String.raw`W_k \in \mathbb{R}^{d_1 \times d_0},\quad d_1 < d_0`,
    diagram: <DiagramBiMap />,
    text: [
      'Chaque couche BiMap prend une matrice de covariance d₀×d₀ et la projette vers une matrice d₁×d₁ plus petite.',
      'La matrice de poids Wₖ est de rang plein en lignes, ce qui suffit à garantir que la sortie reste symétrique définie positive — la structure de variété est préservée à chaque couche.',
      'W est contraint de vivre sur la variété de Stiefel St(d₁, d₀) des matrices semi-orthogonales. La rétropropagation utilise les gradients riemanniens sur cette variété.',
    ],
    refKey: 'huang2017',
  },
  {
    title: 'ReEig — rectification spectrale',
    formula: String.raw`X_k = U\,\max(\varepsilon I,\,\Sigma)\,U^\top`,
    formulaSub: String.raw`X_{k-1} = U\Sigma U^\top\;\text{(décomposition propre)}`,
    diagram: <DiagramReEig />,
    text: [
      "À l'entraînement, certaines valeurs propres dérivent inévitablement vers zéro — la matrice frôle la perte de rang et les gradients à travers la décomposition propre deviennent instables.",
      'ReEig est le remède : toute valeur propre en dessous du seuil ε est remontée à exactement ε. Rien de plus.',
      "La décomposition propre reste différentiable, les gradients continuent de circuler. C'est un plancher sur le spectre — l'analogue SPD du ReLU.",
    ],
    refKey: 'huang2017',
  },
  {
    title: "LogEig — passage vers l'espace euclidien",
    formula: String.raw`X_k = U\,\log(\Sigma)\,U^\top`,
    formulaSub: String.raw`\log \text{ appliqué élément par élément aux valeurs propres}`,
    diagram: <DiagramLogEig />,
    text: [
      "Le logarithme matriciel déplie la variété SPD courbée sur un plan tangent plat en l'identité. La sortie est une matrice symétrique, et les matrices symétriques forment un espace euclidien.",
      'Vectoriser le triangle supérieur donne un vecteur de caractéristiques ordinaire. De là, une couche dense standard et un softmax assurent la classification.',
      "Tout ce qui était géométrique est désormais algébrique. Le classifieur n'a plus besoin de connaître la variété.",
    ],
    refKey: 'huang2017',
  },
];

function DetailSlide({ d }) {
  const formulaRef = useRef(null);
  const formulaSubRef = useRef(null);

  useEffect(() => {
    if (formulaRef.current && d.formula) {
      try { katex.render(d.formula, formulaRef.current, { throwOnError: false, displayMode: false }); }
      catch { formulaRef.current.textContent = d.formula; }
    }
    if (formulaSubRef.current && d.formulaSub) {
      try { katex.render(d.formulaSub, formulaSubRef.current, { throwOnError: false, displayMode: false }); }
      catch { formulaSubRef.current.textContent = d.formulaSub; }
    }
  });

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      padding: '36px 52px 28px',
      boxSizing: 'border-box',
      background: 'var(--bg)',
    }}>
      {/* Title */}
      <div style={{
        fontFamily: 'var(--sans)',
        fontSize: '52px',
        fontWeight: 700,
        color: 'var(--ink)',
        letterSpacing: '-0.02em',
        marginBottom: '24px',
        flex: '0 0 auto',
      }}>{d.title}</div>

      {/* Two columns */}
      <div style={{ display: 'flex', flex: 1, gap: '44px', minHeight: 0 }}>

        {/* Left: diagram */}
        <div style={{
          flex: '0 0 40%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 0,
        }}>
          {d.diagram}
        </div>

        {/* Divider */}
        <div style={{ width: '1px', background: 'var(--ink-3)', opacity: 0.3, flexShrink: 0 }} />

        {/* Right: formula + prose */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '20px',
          minHeight: 0,
          overflowY: 'auto',
        }}>
          {/* Formula box */}
          <div style={{
            padding: '20px 28px',
            border: '1.5px solid var(--ink)',
            borderRadius: '4px',
            background: 'var(--bg-2)',
            lineHeight: 1.5,
          }}>
            <div ref={formulaRef} style={{ fontSize: '28px' }} />
            {d.formulaSub && (
              <div ref={formulaSubRef} style={{ fontSize: '22px', color: 'var(--ink-3)', marginTop: '8px' }} />
            )}
          </div>

          {/* Explanation */}
          <div style={{
            fontFamily: 'var(--sans)',
            fontSize: '26px',
            lineHeight: 1.65,
            color: 'var(--ink)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}>
            {d.text.map((para, i) => (
              <p key={i} style={{ margin: 0 }}>{para}</p>
            ))}
          </div>

          {/* Citation — number read from the already-processed cite-ref in the slide HTML */}
          {d.refKey && <CiteLabel refKey={d.refKey} />}
        </div>
      </div>
    </div>
  );
}

// ─── Main island ──────────────────────────────────────────────────────────────

export function SpdNetArch() {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const rafRef = useRef(null);
  const timerRef = useRef(null);

  // state: which block is highlighted in the overview (immediate)
  // detailIdx: which detail slide is visible, -1 = none (delayed)
  const [state, setState] = useState(0);
  const [detailIdx, setDetailIdx] = useState(-1);

  useEffect(() => {
    const svg = svgRef.current;
    const container = containerRef.current;
    if (!svg || !container) return;

    const noMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    svg.setAttribute('viewBox', STATES[0].join(' '));

    function tween(from, to, dur, onDone) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (noMotion) {
        svg.setAttribute('viewBox', to.join(' '));
        onDone?.();
        return;
      }
      const t0 = performance.now();
      const tick = (now) => {
        const t = Math.min((now - t0) / dur, 1);
        const e = ease(t);
        svg.setAttribute('viewBox',
          from.map((v, i) => v + (to[i] - v) * e).join(' '));
        if (t < 1) rafRef.current = requestAnimationFrame(tick);
        else onDone?.();
      };
      rafRef.current = requestAnimationFrame(tick);
    }

    function readState() {
      const markers = [...container.querySelectorAll('i[data-step]')];
      const n = markers.filter(m => m.hasAttribute('data-step-visible')).length;

      clearTimeout(timerRef.current);
      setState(n);
      setDetailIdx(-1); // hide current detail immediately

      const from = (svg.getAttribute('viewBox') || STATES[0].join(' '))
        .split(' ').map(Number);
      const to = STATES[Math.max(0, Math.min(STATES.length - 1, n))];

      tween(from, to, 560, () => {
        // Fade detail in only for zoom states 1-3
        if (n >= 1 && n <= 3) {
          timerRef.current = setTimeout(() => setDetailIdx(n), 40);
        }
      });
    }

    readState();

    const obs = new MutationObserver(readState);
    obs.observe(container, {
      subtree: true, attributes: true, attributeFilter: ['data-step-visible'],
    });
    return () => {
      obs.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div ref={containerRef}
      style={{ position: 'relative', width: '100%', height: '100%' }}>

      {/* Deck-stage step markers */}
      {STATES.slice(1).map((_, i) => (
        <i key={i} data-step style={{ display: 'none' }} />
      ))}

      {/* SVG overview pipeline */}
      <svg ref={svgRef}
        width="100%" height="100%"
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block' }}>
        <Defs />
        <Pipeline activeIdx={state} />
      </svg>

      {/* HTML detail overlays — solid background, no pipeline visible through */}
      {DETAILS.map((d, i) => (
        <div key={i} style={{
          position: 'absolute', inset: 0,
          opacity: detailIdx === i + 1 ? 1 : 0,
          transition: 'opacity 380ms ease',
          pointerEvents: 'none',
        }}>
          <DetailSlide d={d} />
        </div>
      ))}
    </div>
  );
}
