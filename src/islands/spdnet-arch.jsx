import React, { useRef, useEffect, useState } from 'react';

// ─── Layout constants ─────────────────────────────────────────────────────────
const W  = 1760;
const SH = 990;   // one section height (16:9 with W=1760)

// Camera states: [x, y, w, h]
const STATES = [
  [0, 0 * SH, W, SH],   // 0 overview
  [0, 1 * SH, W, SH],   // 1 BiMap
  [0, 2 * SH, W, SH],   // 2 Riemannian BN
  [0, 3 * SH, W, SH],   // 3 ReEig
  [0, 4 * SH, W, SH],   // 4 LogEig
  [0, 5 * SH, W, SH],   // 5 Recap
];

// ─── Shared primitives ────────────────────────────────────────────────────────

function ArrowDef() {
  return (
    <defs>
      <marker id="spd-arr" viewBox="0 0 10 10" refX={9} refY={5}
        markerWidth={7} markerHeight={7} orient="auto">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--ink)" />
      </marker>
      <marker id="spd-arr-acc" viewBox="0 0 10 10" refX={9} refY={5}
        markerWidth={7} markerHeight={7} orient="auto">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent)" />
      </marker>
    </defs>
  );
}

function SectionTitle({ y0, title, sub }) {
  return (
    <>
      <text x={W / 2} y={y0 + 75} fontFamily="var(--sans)"
        fontSize={52} fontWeight={700} fill="var(--ink)" textAnchor="middle">{title}</text>
      <text x={W / 2} y={y0 + 122} fontFamily="var(--mono)"
        fontSize={24} fill="var(--accent)" textAnchor="middle">{sub}</text>
      <line x1={80} y1={y0 + 148} x2={W - 80} y2={y0 + 148}
        stroke="var(--ink-3)" strokeWidth={1} />
    </>
  );
}

function PipelineBlock({ x, y, w = 200, h = 240, label, mono, active }) {
  return (
    <g transform={`translate(${x},${y})`}>
      {active && <rect width={w} height={8} y={-8} rx={2} fill="var(--accent)" />}
      <rect width={w} height={h} rx={4}
        fill="var(--bg-2)"
        stroke={active ? 'var(--accent)' : 'var(--ink)'}
        strokeWidth={active ? 3 : 1.8} />
      <text x={w / 2} y={h / 2 - 8}
        fontFamily="var(--sans)" fontSize={30} fontWeight={700}
        fill="var(--ink)" textAnchor="middle">{label}</text>
      {mono && (
        <text x={w / 2} y={h / 2 + 28}
          fontFamily="var(--mono)" fontSize={20}
          fill="var(--ink-3)" textAnchor="middle">{mono}</text>
      )}
    </g>
  );
}

function Arr({ x1, y, x2, accent }) {
  return (
    <path d={`M ${x1} ${y} H ${x2}`}
      stroke={accent ? 'var(--accent)' : 'var(--ink)'}
      strokeWidth={1.8} fill="none"
      markerEnd={accent ? 'url(#spd-arr-acc)' : 'url(#spd-arr)'} />
  );
}

// ─── Section 0: Overview ─────────────────────────────────────────────────────

function Overview({ state }) {
  const y0 = 0;
  const blockY = y0 + 370;
  const midY   = y0 + 490;
  const bw = 185, bh = 240;

  // Block x positions
  const bx = { bimap: 190, bn: 430, reig: 670, logeig: 950 };

  return (
    <g>
      <text x={W / 2} y={y0 + 75} fontFamily="var(--sans)"
        fontSize={56} fontWeight={700} fill="var(--ink)" textAnchor="middle">
        SPDNet Architecture
      </text>
      <text x={W / 2} y={y0 + 125} fontFamily="var(--mono)"
        fontSize={24} fill="var(--ink-3)" textAnchor="middle">
        Huang &amp; Van Gool, AAAI 2017  ·  Brooks et al., NeurIPS 2019
      </text>

      {/* Input SPD matrix (stacked squares) */}
      {[2, 1, 0].map(i => (
        <rect key={i}
          x={22 + i * 14} y={blockY + 28 + i * 14}
          width={130} height={130}
          fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.5} />
      ))}
      <text x={87} y={blockY - 10} fontFamily="var(--mono)" fontSize={19}
        fill="var(--ink-3)" textAnchor="middle">Input</text>
      <text x={87} y={blockY + 220} fontFamily="var(--mono)" fontSize={17}
        fill="var(--ink-3)" textAnchor="middle">X ∈ Sym⁺</text>

      {/* Input → BiMap */}
      <Arr x1={180} y={midY} x2={bx.bimap} />

      {/* Core blocks */}
      <PipelineBlock x={bx.bimap} y={blockY} w={bw} h={bh}
        label="BiMap" mono="WXWᵀ" active={state === 1} />
      <Arr x1={bx.bimap + bw} y={midY} x2={bx.bn} />
      <PipelineBlock x={bx.bn} y={blockY} w={bw} h={bh}
        label="BN" mono="Riem. BN" active={state === 2} />
      <Arr x1={bx.bn + bw} y={midY} x2={bx.reig} />
      <PipelineBlock x={bx.reig} y={blockY} w={bw} h={bh}
        label="ReEig" mono="max(ε,λ)" active={state === 3} />

      {/* ×k repeat bracket */}
      <path d={`M ${bx.bimap - 5} ${blockY + bh + 28} H ${bx.reig + bw + 5}`}
        stroke="var(--ink-3)" strokeWidth={1.2} strokeDasharray="5 3" fill="none" />
      <text x={(bx.bimap + bx.reig + bw) / 2} y={blockY + bh + 58}
        fontFamily="var(--mono)" fontSize={20} fill="var(--ink-3)" textAnchor="middle">
        × k layers
      </text>

      {/* ReEig → LogEig */}
      <Arr x1={bx.reig + bw} y={midY} x2={bx.logeig} />
      <PipelineBlock x={bx.logeig} y={blockY} w={bw} h={bh}
        label="LogEig" mono="U log(Σ)Uᵀ" active={state === 4} />

      {/* LogEig → vec */}
      <Arr x1={bx.logeig + bw} y={midY} x2={1175} />
      <circle cx={1200} cy={midY} r={46}
        fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.8} />
      <text x={1200} y={midY - 6} fontFamily="var(--sans)" fontSize={20} fontWeight={600}
        fill="var(--ink)" textAnchor="middle">vec</text>
      <text x={1200} y={midY + 18} fontFamily="var(--mono)" fontSize={15}
        fill="var(--ink-3)" textAnchor="middle">upper△</text>

      {/* vec → FC → Softmax → ŷ */}
      <Arr x1={1246} y={midY} x2={1290} />
      <g transform={`translate(1290,${blockY + 70})`}>
        <rect width={140} height={110} rx={4}
          fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.8} />
        <text x={70} y={52} fontFamily="var(--sans)" fontSize={26} fontWeight={600}
          fill="var(--ink)" textAnchor="middle">FC</text>
        <text x={70} y={80} fontFamily="var(--mono)" fontSize={17}
          fill="var(--ink-3)" textAnchor="middle">linear</text>
      </g>
      <Arr x1={1430} y={midY} x2={1475} />
      <g transform={`translate(1475,${blockY + 70})`}>
        <rect width={170} height={110} rx={4}
          fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.8} />
        <text x={85} y={52} fontFamily="var(--sans)" fontSize={26} fontWeight={600}
          fill="var(--ink)" textAnchor="middle">Softmax</text>
        <text x={85} y={80} fontFamily="var(--mono)" fontSize={17}
          fill="var(--ink-3)" textAnchor="middle">classes</text>
      </g>
      <Arr x1={1645} y={midY} x2={1685} />
      <text x={1700} y={midY + 12} fontFamily="var(--mono)"
        fontSize={42} fill="var(--accent)">ŷ</text>

      {/* Prompt when on overview */}
      {state === 0 && (
        <text x={W / 2} y={y0 + SH - 55} fontFamily="var(--mono)"
          fontSize={22} fill="var(--ink-3)" textAnchor="middle">
          press → to explore each layer
        </text>
      )}
    </g>
  );
}

// ─── Section 1: BiMap ─────────────────────────────────────────────────────────

function BiMapSection() {
  const y0 = 1 * SH;
  const MY = y0 + 530; // mid y for the diagram

  return (
    <g>
      <SectionTitle y0={y0} title="BiMap Layer" sub="Bilinear mapping · dimension reduction on SPD manifold" />

      {/* Formula */}
      <text x={W / 2} y={y0 + 215}
        fontFamily="var(--mono)" fontSize={52} fontWeight={700}
        fill="var(--ink)" textAnchor="middle">Xₖ = Wₖ · Xₖ₋₁ · Wₖᵀ</text>

      {/* Input matrix */}
      <g transform={`translate(80,${y0 + 295})`}>
        <rect width={230} height={230} rx={4}
          fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={2} />
        {/* Grid lines to suggest matrix */}
        {[1,2,3].map(i => (
          <React.Fragment key={i}>
            <line x1={0} y1={i * 57.5} x2={230} y2={i * 57.5}
              stroke="var(--ink-3)" strokeWidth={0.6} />
            <line x1={i * 57.5} y1={0} x2={i * 57.5} y2={230}
              stroke="var(--ink-3)" strokeWidth={0.6} />
          </React.Fragment>
        ))}
        <text x={115} y={264} fontFamily="var(--mono)" fontSize={22}
          fill="var(--ink-3)" textAnchor="middle">Xₖ₋₁ ∈ Sym⁺ d₀</text>
        <text x={115} y={293} fontFamily="var(--mono)" fontSize={20}
          fill="var(--ink-3)" textAnchor="middle">d₀ × d₀</text>
      </g>

      {/* W_k box (above arrow) */}
      <g transform={`translate(360,${y0 + 330})`}>
        <rect width={160} height={90} rx={4}
          fill="var(--bg)" stroke="var(--accent)" strokeWidth={2.5} />
        <text x={80} y={42} fontFamily="var(--mono)" fontSize={26} fontWeight={700}
          fill="var(--accent)" textAnchor="middle">Wₖ</text>
        <text x={80} y={72} fontFamily="var(--mono)" fontSize={18}
          fill="var(--ink-3)" textAnchor="middle">d₁ × d₀</text>
      </g>

      {/* Arrows */}
      <path d={`M 310 ${MY} H 400`} stroke="var(--ink)" strokeWidth={2}
        fill="none" markerEnd="url(#spd-arr)" />
      <path d={`M 600 ${MY} H 660`} stroke="var(--ink)" strokeWidth={2}
        fill="none" markerEnd="url(#spd-arr)" />

      {/* Output matrix (smaller) */}
      <g transform={`translate(660,${y0 + 355})`}>
        <rect width={180} height={180} rx={4}
          fill="var(--bg-2)" stroke="var(--accent)" strokeWidth={2.5} />
        {[1,2].map(i => (
          <React.Fragment key={i}>
            <line x1={0} y1={i * 60} x2={180} y2={i * 60}
              stroke="var(--ink-3)" strokeWidth={0.6} />
            <line x1={i * 60} y1={0} x2={i * 60} y2={180}
              stroke="var(--ink-3)" strokeWidth={0.6} />
          </React.Fragment>
        ))}
        <text x={90} y={215} fontFamily="var(--mono)" fontSize={22}
          fill="var(--accent)" textAnchor="middle">Xₖ ∈ Sym⁺ d₁</text>
        <text x={90} y={244} fontFamily="var(--mono)" fontSize={20}
          fill="var(--ink-3)" textAnchor="middle">d₁ × d₁, d₁ &lt; d₀</text>
      </g>

      {/* Size comparison label */}
      <text x={490} y={y0 + 460} fontFamily="var(--sans)" fontSize={22}
        fill="var(--ink-3)" textAnchor="middle">dimension</text>
      <text x={490} y={y0 + 488} fontFamily="var(--sans)" fontSize={22}
        fill="var(--ink-3)" textAnchor="middle">reduction</text>

      {/* Properties list */}
      {[
        'Wₖ ∈ ℝ^{d₁×d₀} is full row rank  →  Xₖ stays SPD',
        'Wₖ lies on the compact Stiefel manifold  St(d₁, d₀)',
        'Riemannian gradient on Stiefel in backpropagation',
        'Analogous to a linear projection layer for SPD matrices',
        'Stacks k times: each block reduces dimension further',
      ].map((line, i) => (
        <g key={i} transform={`translate(920, ${y0 + 290 + i * 96})`}>
          <rect width={740} height={76} rx={4}
            fill="var(--bg-2)" stroke="var(--ink-3)" strokeWidth={1} />
          <text x={24} y={46} fontFamily="var(--sans)" fontSize={22}
            fill="var(--ink)">{line}</text>
        </g>
      ))}

      <text x={80} y={y0 + SH - 40} fontFamily="var(--mono)" fontSize={20}
        fill="var(--ink-3)">Huang &amp; Van Gool, AAAI 2017</text>
    </g>
  );
}

// ─── Section 2: Riemannian BatchNorm ─────────────────────────────────────────

function BNSection() {
  const y0 = 2 * SH;
  const steps = [
    {
      num: '①', label: 'Fréchet mean',
      formula: 'M  =  argmin_{M ∈ Sym⁺}  Σᵢ d²_R(Xᵢ, M)',
      desc: 'Karcher mean on (Sym⁺, AIRM) — computed by Riemannian gradient descent',
    },
    {
      num: '②', label: 'Center batch at identity',
      formula: 'X̃ᵢ  =  M^{−½} Xᵢ M^{−½}',
      desc: 'Parallel transport of each matrix to tangent space at I  —  removes mean',
    },
    {
      num: '③', label: 'Apply learned SPD bias',
      formula: 'Xₒᵤₜ  =  G^{½} X̃ᵢ G^{½}',
      desc: 'G ∈ Sym⁺ is a trainable bias; transports batch from I to G  —  analogue of BN shift',
    },
    {
      num: '④', label: 'Running mean at inference',
      formula: 'M_run  ←  geodesic(M_run, M_batch, momentum)',
      desc: 'Exponential moving average on (Sym⁺, AIRM)  —  used in place of M at test time',
    },
  ];

  return (
    <g>
      <SectionTitle y0={y0}
        title="Riemannian Batch Normalization"
        sub="Brooks, Rencker &amp; Holighaus · NeurIPS 2019" />

      {steps.map((s, i) => (
        <g key={i} transform={`translate(80,${y0 + 178 + i * 192})`}>
          <rect width={W - 160} height={172} rx={6}
            fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.4} />
          <text x={28} y={46} fontFamily="var(--sans)" fontSize={20} fontWeight={700}
            fill="var(--ink-3)">{s.num}</text>
          <text x={70} y={46} fontFamily="var(--sans)" fontSize={26} fontWeight={700}
            fill="var(--accent)">{s.label}</text>
          <text x={70} y={94} fontFamily="var(--mono)" fontSize={28} fontWeight={600}
            fill="var(--ink)">{s.formula}</text>
          <text x={70} y={140} fontFamily="var(--sans)" fontSize={22}
            fill="var(--ink-3)">{s.desc}</text>
        </g>
      ))}

      <text x={80} y={y0 + SH - 40} fontFamily="var(--mono)" fontSize={20}
        fill="var(--ink-3)">Brooks et al., NeurIPS 2019</text>
    </g>
  );
}

// ─── Section 3: ReEig ────────────────────────────────────────────────────────

function ReEigSection() {
  const y0 = 3 * SH;

  return (
    <g>
      <SectionTitle y0={y0}
        title="ReEig Layer"
        sub="Eigenvalue rectification  —  SPD analogue of ReLU" />

      {/* Formula */}
      <text x={W / 2} y={y0 + 220}
        fontFamily="var(--mono)" fontSize={50} fontWeight={700}
        fill="var(--ink)" textAnchor="middle">Xₖ  =  U · max(εI, Σ) · Uᵀ</text>
      <text x={W / 2} y={y0 + 274}
        fontFamily="var(--sans)" fontSize={26}
        fill="var(--ink-3)" textAnchor="middle">
        where  Xₖ₋₁ = U Σ Uᵀ  (eigendecomposition)
      </text>

      {/* Flow diagram */}
      {[
        { dx: 60,   label: 'Xₖ₋₁', sub1: 'Sym⁺_d', sub2: 'may have λ ≈ 0', col: 'var(--ink)' },
        { dx: 420,  label: 'U, Σ, Uᵀ', sub1: 'eigendecomp', sub2: 'Σ = diag(λ₁…λ_d)', col: 'var(--ink-3)' },
        { dx: 820,  label: 'max(ε, Σ)', sub1: 'rectify eigenvalues', sub2: 'λᵢ ← max(ε, λᵢ)', col: 'var(--accent)' },
        { dx: 1260, label: 'Xₖ', sub1: 'Sym⁺_d', sub2: 'well-conditioned', col: 'var(--accent)' },
      ].map((b, i, arr) => (
        <g key={i}>
          <g transform={`translate(${b.dx},${y0 + 330})`}>
            <rect width={300} height={210} rx={6}
              fill="var(--bg-2)" stroke={b.col} strokeWidth={2} />
            <text x={150} y={88} fontFamily="var(--mono)" fontSize={28} fontWeight={700}
              fill="var(--ink)" textAnchor="middle">{b.label}</text>
            <text x={150} y={126} fontFamily="var(--sans)" fontSize={20}
              fill="var(--ink-3)" textAnchor="middle">{b.sub1}</text>
            <text x={150} y={158} fontFamily="var(--mono)" fontSize={18}
              fill={b.col} textAnchor="middle">{b.sub2}</text>
          </g>
          {i < arr.length - 1 && (
            <path d={`M ${b.dx + 310} ${y0 + 435} H ${arr[i + 1].dx - 10}`}
              stroke="var(--ink)" strokeWidth={2} fill="none"
              markerEnd="url(#spd-arr)" />
          )}
        </g>
      ))}

      {/* Property bullets */}
      {[
        'ε is a small threshold (e.g. 10⁻⁴)  —  prevents singular / ill-conditioned output',
        'Differentiable: gradient passes through eigendecomposition via matrix chain rule',
        'Maintains SPD structure: all rectified eigenvalues stay strictly positive',
        'Analogous role to ReLU in Euclidean nets  —  the nonlinearity of SPDNet',
      ].map((line, i) => (
        <text key={i} x={80} y={y0 + 620 + i * 60}
          fontFamily="var(--sans)" fontSize={25} fill="var(--ink)">• {line}</text>
      ))}

      <text x={80} y={y0 + SH - 40} fontFamily="var(--mono)" fontSize={20}
        fill="var(--ink-3)">Huang &amp; Van Gool, AAAI 2017</text>
    </g>
  );
}

// ─── Section 4: LogEig ───────────────────────────────────────────────────────

function LogEigSection() {
  const y0 = 4 * SH;

  return (
    <g>
      <SectionTitle y0={y0}
        title="LogEig Layer"
        sub="SPD manifold  →  Euclidean tangent space at I" />

      {/* Formula */}
      <text x={W / 2} y={y0 + 215}
        fontFamily="var(--mono)" fontSize={50} fontWeight={700}
        fill="var(--ink)" textAnchor="middle">Xₖ  =  U · log(Σ) · Uᵀ</text>
      <text x={W / 2} y={y0 + 268}
        fontFamily="var(--sans)" fontSize={26}
        fill="var(--ink-3)" textAnchor="middle">
        log applied element-wise to eigenvalues  ·  maps SPD → Sym_d  (Euclidean)
      </text>

      {/* Manifold diagram */}
      {/* SPD manifold (curved surface) */}
      <ellipse cx={340} cy={y0 + 580} rx={240} ry={150}
        fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={2} />
      <text x={340} y={y0 + 540} fontFamily="var(--sans)" fontSize={24} fontWeight={600}
        fill="var(--ink)" textAnchor="middle">SPD manifold</text>
      <text x={340} y={y0 + 572} fontFamily="var(--mono)" fontSize={20}
        fill="var(--ink-3)" textAnchor="middle">(Sym⁺_d, g_R)</text>
      {/* A curve on manifold */}
      <path d={`M 170 ${y0 + 590} Q 340 ${y0 + 460} 510 ${y0 + 590}`}
        fill="none" stroke="var(--ink-3)" strokeWidth={1.2} strokeDasharray="4 3" />
      <circle cx={340} cy={y0 + 510} r={12} fill="var(--accent)" />
      <text x={360} y={y0 + 505} fontFamily="var(--mono)" fontSize={20}
        fill="var(--accent)">Xₖ₋₁</text>

      {/* Log_I arrow */}
      <path d={`M 610 ${y0 + 575} H 760`}
        stroke="var(--accent)" strokeWidth={3} fill="none"
        markerEnd="url(#spd-arr-acc)" />
      <text x={685} y={y0 + 555} fontFamily="var(--mono)" fontSize={22}
        fill="var(--accent)" textAnchor="middle">Log_I</text>
      <text x={685} y={y0 + 600} fontFamily="var(--mono)" fontSize={18}
        fill="var(--ink-3)" textAnchor="middle">matrix log</text>

      {/* Tangent space (flat plane) */}
      <rect x={770} y={y0 + 430} width={460} height={300} rx={6}
        fill="var(--bg-2)" stroke="var(--accent)" strokeWidth={2.5} />
      {/* Grid lines inside */}
      {[1,2,3,4].map(i => (
        <line key={`h${i}`} x1={770} y1={y0 + 430 + i * 60} x2={1230} y2={y0 + 430 + i * 60}
          stroke="var(--ink-3)" strokeWidth={0.5} />
      ))}
      {[1,2,3,4,5,6].map(i => (
        <line key={`v${i}`} x1={770 + i * 65} y1={y0 + 430} x2={770 + i * 65} y2={y0 + 730}
          stroke="var(--ink-3)" strokeWidth={0.5} />
      ))}
      <text x={1000} y={y0 + 490} fontFamily="var(--sans)" fontSize={24} fontWeight={600}
        fill="var(--ink)" textAnchor="middle">Tangent space  T_I(Sym⁺_d)</text>
      <text x={1000} y={y0 + 524} fontFamily="var(--mono)" fontSize={20}
        fill="var(--ink-3)" textAnchor="middle">≅  Sym_d  (Euclidean!)</text>
      <circle cx={1000} cy={y0 + 615} r={12} fill="var(--accent)" />
      <text x={1020} y={y0 + 620} fontFamily="var(--mono)" fontSize={20}
        fill="var(--accent)">U log(Σ) Uᵀ</text>

      {/* Then → vec → FC → softmax */}
      <path d={`M 1240 ${y0 + 575} H 1310`}
        stroke="var(--ink)" strokeWidth={2} fill="none"
        markerEnd="url(#spd-arr)" />
      <g transform={`translate(1320,${y0 + 490})`}>
        <rect width={360} height={170} rx={6}
          fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.8} />
        <text x={180} y={52} fontFamily="var(--sans)" fontSize={24} fontWeight={700}
          fill="var(--ink)" textAnchor="middle">vec  →  FC  →  softmax</text>
        <text x={180} y={86} fontFamily="var(--mono)" fontSize={19}
          fill="var(--ink-3)" textAnchor="middle">upper-triangular</text>
        <text x={180} y={116} fontFamily="var(--mono)" fontSize={19}
          fill="var(--ink-3)" textAnchor="middle">vectorization</text>
        <text x={180} y={148} fontFamily="var(--mono)" fontSize={19}
          fill="var(--accent)" textAnchor="middle">standard Euclidean layers</text>
      </g>

      <text x={80} y={y0 + SH - 40} fontFamily="var(--mono)" fontSize={20}
        fill="var(--ink-3)">Huang &amp; Van Gool, AAAI 2017</text>
    </g>
  );
}

// ─── Section 5: Recap ────────────────────────────────────────────────────────

function RecapSection() {
  const y0 = 5 * SH;
  const blockY = y0 + 260;
  const midY   = y0 + 400;
  const bw = 220, bh = 280;

  const blocks = [
    { x: 60,   label: 'BiMap',   mono: 'WXWᵀ',       col: 'var(--ink)' },
    { x: 340,  label: 'BN',      mono: 'Riem. BN',   col: 'var(--ink)' },
    { x: 620,  label: 'ReEig',   mono: 'max(ε,λ)',   col: 'var(--ink)' },
    { x: 960,  label: 'LogEig',  mono: 'log(X)',      col: 'var(--accent)' },
    { x: 1250, label: 'vec+FC',  mono: 'Euclidean',   col: 'var(--accent)' },
  ];

  return (
    <g>
      <SectionTitle y0={y0}
        title="Full SPDNet Pipeline"
        sub="End-to-end deep learning on covariance matrices" />

      {blocks.map((b, i) => (
        <g key={i}>
          <g transform={`translate(${b.x},${blockY})`}>
            <rect width={bw} height={bh} rx={6}
              fill="var(--bg-2)" stroke={b.col} strokeWidth={2.5} />
            <rect width={bw} height={8} y={-8} rx={3} fill={b.col} />
            <text x={bw / 2} y={bh / 2 - 12}
              fontFamily="var(--sans)" fontSize={32} fontWeight={700}
              fill="var(--ink)" textAnchor="middle">{b.label}</text>
            <text x={bw / 2} y={bh / 2 + 28}
              fontFamily="var(--mono)" fontSize={22}
              fill="var(--ink-3)" textAnchor="middle">{b.mono}</text>
          </g>
          {i < blocks.length - 1 && (
            <Arr x1={b.x + bw} y={midY} x2={blocks[i + 1].x} />
          )}
        </g>
      ))}

      {/* Input arrow */}
      <text x={22} y={y0 + 180} fontFamily="var(--mono)" fontSize={22}
        fill="var(--ink-3)">X ∈ Sym⁺_d</text>
      <Arr x1={22} y={midY} x2={60} />

      {/* Output */}
      <Arr x1={1470} y={midY} x2={1530} />
      <text x={1545} y={midY + 14} fontFamily="var(--mono)"
        fontSize={44} fill="var(--accent)">ŷ</text>

      {/* ×k brace */}
      <path d={`M 54 ${blockY + bh + 30} H 846`}
        stroke="var(--ink-3)" strokeWidth={1.2} strokeDasharray="5 3" fill="none" />
      <text x={450} y={blockY + bh + 62}
        fontFamily="var(--mono)" fontSize={22}
        fill="var(--ink-3)" textAnchor="middle">× k layers  (BiMap → BN → ReEig)</text>

      {/* Manifold / Euclidean split label */}
      <path d={`M 960 ${y0 + 620} V ${blockY - 20}`}
        stroke="var(--ink-3)" strokeWidth={1} strokeDasharray="4 3" fill="none" />
      <text x={490} y={y0 + 660} fontFamily="var(--sans)" fontSize={22}
        fill="var(--ink-3)" textAnchor="middle">operations on SPD manifold</text>
      <text x={1320} y={y0 + 660} fontFamily="var(--sans)" fontSize={22}
        fill="var(--accent)" textAnchor="middle">Euclidean operations</text>

      <text x={80} y={y0 + SH - 40} fontFamily="var(--mono)" fontSize={20}
        fill="var(--ink-3)">
        Huang &amp; Van Gool (AAAI 2017) · Brooks et al. (NeurIPS 2019)
      </text>
    </g>
  );
}

// ─── Main island component ────────────────────────────────────────────────────

export function SpdNetArch() {
  const svgRef       = useRef(null);
  const containerRef = useRef(null);
  const [state, setState] = useState(0);

  useEffect(() => {
    const svg       = svgRef.current;
    const container = containerRef.current;
    if (!svg || !container) return;

    // Init viewBox imperatively so React doesn't reset it during re-renders
    svg.setAttribute('viewBox', STATES[0].join(' '));

    const reducedMotion =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let rafId = null;

    function tweenTo(targetIdx) {
      const cur = svg.getAttribute('viewBox') || STATES[0].join(' ');
      const from = cur.split(' ').map(Number);
      const to   = STATES[Math.max(0, Math.min(STATES.length - 1, targetIdx))];

      if (reducedMotion) {
        svg.setAttribute('viewBox', to.join(' '));
        return;
      }
      if (rafId) cancelAnimationFrame(rafId);
      const t0 = performance.now();
      const dur = 540;
      const tick = (now) => {
        const t = Math.min((now - t0) / dur, 1);
        const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        const vb = from.map((v, i) => v + (to[i] - v) * e);
        svg.setAttribute('viewBox', vb.join(' '));
        if (t < 1) rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    }

    function readState() {
      const markers = [...container.querySelectorAll('i[data-step]')];
      const visible = markers.filter(m => m.hasAttribute('data-step-visible')).length;
      setState(visible);
      tweenTo(visible);
    }

    // Read initial state (handles backward-entry with steps already applied)
    readState();

    const obs = new MutationObserver(readState);
    obs.observe(container, {
      subtree: true, attributes: true, attributeFilter: ['data-step-visible'],
    });

    return () => {
      obs.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []); // run once

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      {/* Hidden step markers — deck-stage counts these as data-step elements */}
      {STATES.slice(1).map((_, i) => (
        <i key={i} data-step style={{ display: 'none' }} />
      ))}

      <svg ref={svgRef}
        width="100%" height="100%"
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block' }}>
        <ArrowDef />
        <Overview state={state} />
        <BiMapSection />
        <BNSection />
        <ReEigSection />
        <LogEigSection />
        <RecapSection />
      </svg>
    </div>
  );
}
