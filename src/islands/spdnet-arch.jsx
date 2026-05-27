import React, { useRef, useEffect, useState } from 'react';

// ─── Geometry constants ───────────────────────────────────────────────────────
const W = 1760, H = 990;
const BX = [155, 465, 775, 1075]; // block x positions (BiMap, BN, ReEig, LogEig)
const BY = 130, BW = 260, BH = 300;
const MID_Y = BY + BH / 2; // 280

// Zoom camera: 500×281 (16:9) centred on each block
const ZW = 500, ZH = ZW * H / W; // ≈ 281.25

const STATES = [
  [0, 0, W, H],
  [BX[0] + BW / 2 - ZW / 2, MID_Y - ZH / 2, ZW, ZH],
  [BX[1] + BW / 2 - ZW / 2, MID_Y - ZH / 2, ZW, ZH],
  [BX[2] + BW / 2 - ZW / 2, MID_Y - ZH / 2, ZW, ZH],
  [BX[3] + BW / 2 - ZW / 2, MID_Y - ZH / 2, ZW, ZH],
  [0, 0, W, H],
];

function easeInOut(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

// ─── Shared SVG primitives ────────────────────────────────────────────────────

function Defs() {
  return (
    <defs>
      <marker id="sa-arr" viewBox="0 0 10 10" refX={9} refY={5}
        markerWidth={6} markerHeight={6} orient="auto">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--ink)" />
      </marker>
      <marker id="sa-arr-acc" viewBox="0 0 10 10" refX={9} refY={5}
        markerWidth={6} markerHeight={6} orient="auto">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent)" />
      </marker>
    </defs>
  );
}

function Arr({ x1, y, x2, acc }) {
  return (
    <path d={`M ${x1} ${y} H ${x2}`}
      stroke={acc ? 'var(--accent)' : 'var(--ink)'}
      strokeWidth={1.8} fill="none"
      markerEnd={acc ? 'url(#sa-arr-acc)' : 'url(#sa-arr)'} />
  );
}

// ─── Overview block — minimal, just label + forward equation ─────────────────

function OverviewBlock({ idx, title, eq, active }) {
  const x = BX[idx];
  return (
    <g transform={`translate(${x},${BY})`}>
      <rect width={BW} height={18} rx={3}
        fill={active ? 'var(--accent)' : 'var(--ink-3)'} />
      <rect y={18} width={BW} height={BH - 18} rx={3}
        fill="var(--bg-2)"
        stroke={active ? 'var(--accent)' : 'var(--ink)'}
        strokeWidth={active ? 2.5 : 1.6} />
      <text x={BW / 2} y={58}
        fontFamily="var(--sans)" fontSize={26} fontWeight={700}
        fill="var(--ink)" textAnchor="middle">{title}</text>
      <text x={BW / 2} y={84}
        fontFamily="var(--mono)" fontSize={12.5} fontWeight={600}
        fill="var(--accent)" textAnchor="middle">{eq}</text>
    </g>
  );
}

// ─── Detail overlay helpers ───────────────────────────────────────────────────
// Each overlay is 500×281 (the zoom window), positioned at the block's zoom origin.
// opacity 0 at overview, 1 when detailShown matches.

function OverlayShell({ idx, detailShown, children }) {
  const [vbx, vby] = STATES[idx + 1];
  const visible = detailShown === idx + 1;
  return (
    <g transform={`translate(${vbx},${vby})`}
      style={{ opacity: visible ? 1 : 0, transition: 'opacity 360ms ease', pointerEvents: 'none' }}>
      <rect width={ZW} height={ZH} fill="var(--bg)" />
      {children}
    </g>
  );
}

// Two-column layout helper used by all detail overlays
// left: diagram area (w≈196), right: equation + prose (w≈280)
function TwoCol({ title, accent, left, eq, eqSub, lines }) {
  const PX = 14;        // horizontal padding
  const TH = 30;        // top strip height
  const DW = 194;       // diagram column width
  const RX = DW + PX * 2 + 8; // right col x
  const RW = ZW - RX - PX;    // right col width ≈ 274

  return (
    <>
      {/* Top title strip */}
      <rect width={ZW} height={TH} fill={accent || 'var(--ink)'} />
      <text x={PX} y={TH - 8}
        fontFamily="var(--sans)" fontSize={15} fontWeight={700}
        fill="var(--bg)">{title}</text>

      {/* Vertical divider */}
      <line x1={DW + PX * 2} y1={TH} x2={DW + PX * 2} y2={ZH}
        stroke="var(--ink-3)" strokeWidth={0.6} />

      {/* Left: diagram (caller supplies) */}
      <g transform={`translate(${PX},${TH + 6})`}>
        {left}
      </g>

      {/* Right: equation box */}
      <g transform={`translate(${RX},${TH + 10})`}>
        <rect width={RW} height={56} rx={4}
          fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1} />
        <text x={RW / 2} y={28}
          fontFamily="var(--mono)" fontSize={13} fontWeight={700}
          fill="var(--ink)" textAnchor="middle">{eq}</text>
        {eqSub && (
          <text x={RW / 2} y={46}
            fontFamily="var(--mono)" fontSize={10.5}
            fill="var(--ink-3)" textAnchor="middle">{eqSub}</text>
        )}
      </g>

      {/* Right: prose */}
      <g transform={`translate(${RX},${TH + 78})`}>
        {lines.map((line, i) => (
          <text key={i} x={0} y={i * 20}
            fontFamily="var(--sans)" fontSize={10}
            fill="var(--ink)">{line}</text>
        ))}
      </g>
    </>
  );
}

// ─── BiMap detail ─────────────────────────────────────────────────────────────
// Diagram: large SPD matrix → W projection → smaller SPD matrix

function BiMapDetail() {
  const DH = ZH - 36; // usable diagram height ≈ 245

  // Draw stacked overlapping rects representing a matrix
  function MatrixGlyph({ ox, oy, n, side, col }) {
    return (
      <g>
        {Array.from({ length: n }, (_, i) => (
          <rect key={i}
            x={ox + i * 10} y={oy + i * 10}
            width={side} height={side}
            fill="var(--bg-2)" stroke={col || 'var(--ink)'} strokeWidth={1.4} />
        ))}
      </g>
    );
  }

  return (
    <TwoCol
      title="BiMap  —  bilinear mapping on the SPD manifold"
      accent="var(--ink)"
      eq="Xₖ = Wₖ · Xₖ₋₁ · Wₖᵀ"
      eqSub="Wₖ ∈ ℝ^{d₁×d₀},  d₁ < d₀"
      lines={[
        'Each BiMap layer projects a big covariance matrix down',
        'to a smaller one. W has full row rank, so the output',
        'stays SPD — the manifold is preserved throughout.',
        '',
        'W lives on the Stiefel manifold St(d₁, d₀): semi-',
        'orthogonal matrices. Riemannian gradients on Stiefel',
        'keep training stable and geometry-respecting.',
        '',
        'Stack k of these and you get a deep hierarchy of',
        'covariance features, progressively compressed.',
      ]}
      left={
        <>
          {/* Input matrix (big, d₀=5 → 3 stacked rects) */}
          <MatrixGlyph ox={6} oy={30} n={3} side={72} />
          <text x={42} y={148} fontFamily="var(--mono)" fontSize={9}
            fill="var(--ink-3)" textAnchor="middle">Xₖ₋₁ ∈ Sym⁺ d₀</text>

          {/* W matrix annotation above arrow */}
          <rect x={88} y={18} width={52} height={32} rx={3}
            fill="var(--bg)" stroke="var(--accent)" strokeWidth={1.6} />
          <text x={114} y={39}
            fontFamily="var(--mono)" fontSize={12} fontWeight={700}
            fill="var(--accent)" textAnchor="middle">Wₖ</text>

          {/* Arrow */}
          <path d={`M 90 78 H 150`}
            stroke="var(--ink)" strokeWidth={1.6} fill="none"
            markerEnd="url(#sa-arr)" />

          {/* Output matrix (smaller, d₁=3 → 2 stacked rects) */}
          <MatrixGlyph ox={155} oy={48} n={2} side={54} col="var(--accent)" />
          <text x={181} y={148} fontFamily="var(--mono)" fontSize={9}
            fill="var(--accent)" textAnchor="middle">Xₖ ∈ Sym⁺ d₁</text>

          {/* Dimension label */}
          <text x={97} y={175} fontFamily="var(--mono)" fontSize={9.5}
            fill="var(--ink-3)" textAnchor="middle">d₀ → d₁,  d₁ &lt; d₀</text>
        </>
      }
    />
  );
}

// ─── BN detail ────────────────────────────────────────────────────────────────
// Diagram: batch of points on manifold → Fréchet mean → transport to I → to G

function BNDetail() {
  // Draw the "batch → mean → I → G" flow
  // Points on a curved arc representing the manifold
  const pts = [
    [24, 60], [52, 42], [80, 55], [38, 90], [68, 88],
  ];
  const meanPt = [52, 66];

  return (
    <TwoCol
      title="Riemannian Batch Normalisation  —  Brooks et al., NeurIPS 2019"
      accent="var(--ink)"
      eq="X̃ᵢ = M^{-½} Xᵢ M^{-½}"
      eqSub="then  Xₒᵤₜ = G^{½} X̃ᵢ G^{½},  G ∈ Sym⁺ learned"
      lines={[
        '"Mean" on a curved space means finding the point',
        'that minimises the sum of squared geodesic distances',
        '— the Fréchet mean M. Not the usual sum ÷ n.',
        '',
        'Parallel transport then slides every matrix to a',
        'common reference at the identity I, removing the mean',
        'while staying on the manifold.',
        '',
        'A learned SPD bias G repositions the normalised',
        'batch wherever training finds it useful.',
      ]}
      left={
        <>
          {/* Manifold arc */}
          <path d="M 5 110 Q 50 10 100 50 Q 140 80 175 40 Q 190 20 195 30"
            fill="none" stroke="var(--ink-3)" strokeWidth={1.2} />
          <text x={100} y={128} fontFamily="var(--mono)" fontSize={8.5}
            fill="var(--ink-3)" textAnchor="middle">(Sym⁺, AIRM)</text>

          {/* Batch points */}
          {pts.map(([px, py], i) => (
            <circle key={i} cx={px + 8} cy={py + 15} r={5}
              fill="var(--bg-2)" stroke="var(--ink-3)" strokeWidth={1.2} />
          ))}

          {/* Geodesic lines to mean */}
          {pts.map(([px, py], i) => (
            <line key={i}
              x1={px + 8} y1={py + 15}
              x2={meanPt[0] + 8} y2={meanPt[1] + 15}
              stroke="var(--ink-3)" strokeWidth={0.7} strokeDasharray="3 2" />
          ))}

          {/* Fréchet mean */}
          <circle cx={meanPt[0] + 8} cy={meanPt[1] + 15} r={8}
            fill="var(--accent)" opacity={0.85} />
          <text x={meanPt[0] + 8} y={meanPt[1] + 6}
            fontFamily="var(--mono)" fontSize={9} fontWeight={700}
            fill="var(--bg)" textAnchor="middle">M</text>

          {/* M → I → G flow below */}
          <g transform="translate(12, 148)">
            {[['M', 'var(--accent)'], ['I', 'var(--ink)'], ['G', 'var(--ink)']].map(([lbl, col], i) => (
              <React.Fragment key={lbl}>
                <circle cx={i * 56 + 14} cy={16} r={13}
                  fill="var(--bg-2)" stroke={col} strokeWidth={1.6} />
                <text x={i * 56 + 14} y={21}
                  fontFamily="var(--mono)" fontSize={12} fontWeight={700}
                  fill={col} textAnchor="middle">{lbl}</text>
                {i < 2 && (
                  <path d={`M ${i * 56 + 28} 16 H ${i * 56 + 42}`}
                    stroke="var(--ink)" strokeWidth={1.2} fill="none"
                    markerEnd="url(#sa-arr)" />
                )}
              </React.Fragment>
            ))}
            <text x={85} y={40} fontFamily="var(--sans)" fontSize={8.5}
              fill="var(--ink-3)" textAnchor="middle">center → bias</text>
          </g>
        </>
      }
    />
  );
}

// ─── ReEig detail ─────────────────────────────────────────────────────────────
// Diagram: eigenvalue spectrum bar chart with ε clamping visualised

function ReEigDetail() {
  const eigenvals = [2.1, 1.6, 0.9, 0.5, 0.06, 0.01];
  const epsilon = 0.12;
  const maxEig = 2.3;
  const DH = 145; // chart height
  const scale = DH / maxEig;
  const baseY = DH + 20;
  const epY = baseY - epsilon * scale;
  const BW2 = 26, GAP = 7;
  const totalW = eigenvals.length * BW2 + (eigenvals.length - 1) * GAP;

  return (
    <TwoCol
      title="ReEig  —  eigenvalue rectification"
      accent="var(--ink)"
      eq="Xₖ = U · max(εI, Σ) · Uᵀ"
      eqSub="Xₖ₋₁ = UΣUᵀ,  eigenvalues λᵢ ← max(ε, λᵢ)"
      lines={[
        'During training, eigenvalues drift toward zero —',
        'the matrix nearly loses rank and gradients blow up.',
        '',
        'ReEig catches them: any λ below ε gets a floor.',
        'The eigendecomposition stays differentiable, so',
        'gradients flow cleanly through the eigenvectors.',
        '',
        'Clamped eigenvalues are shown in orange below.',
        'Think of it as the ReLU of SPD space.',
      ]}
      left={
        <>
          {/* Bars */}
          {eigenvals.map((λ, i) => {
            const bx = i * (BW2 + GAP);
            const clamped = λ < epsilon;
            const rectH = Math.max(epsilon, λ) * scale;
            const origH = λ * scale;
            return (
              <g key={i}>
                {/* Ghost of original near-zero value */}
                {clamped && origH > 1 && (
                  <rect x={bx + 2} y={baseY - origH}
                    width={BW2 - 4} height={origH}
                    fill="var(--ink-3)" opacity={0.2} rx={1} />
                )}
                {/* Rectified bar */}
                <rect x={bx} y={baseY - rectH}
                  width={BW2} height={rectH}
                  fill={clamped ? 'var(--accent)' : 'var(--ink-3)'}
                  opacity={clamped ? 0.85 : 0.55} rx={2} />
                {/* λ index */}
                <text x={bx + BW2 / 2} y={baseY + 14}
                  fontFamily="var(--mono)" fontSize={8}
                  fill="var(--ink-3)" textAnchor="middle">λ{i + 1}</text>
              </g>
            );
          })}

          {/* ε threshold line */}
          <line x1={0} y1={epY} x2={totalW} y2={epY}
            stroke="var(--accent)" strokeWidth={1.4} strokeDasharray="4 2" />
          <text x={totalW + 8} y={epY + 4}
            fontFamily="var(--mono)" fontSize={10} fontWeight={700}
            fill="var(--accent)">ε</text>

          {/* Baseline */}
          <line x1={0} y1={baseY} x2={totalW} y2={baseY}
            stroke="var(--ink-3)" strokeWidth={0.8} />

          {/* Caption */}
          <text x={totalW / 2} y={baseY + 28}
            fontFamily="var(--sans)" fontSize={8.5}
            fill="var(--ink-3)" textAnchor="middle">
            orange bars clamped to ε
          </text>
        </>
      }
    />
  );
}

// ─── LogEig detail ────────────────────────────────────────────────────────────
// Diagram: curved manifold → Log_I → flat tangent plane

function LogEigDetail() {
  return (
    <TwoCol
      title="LogEig  —  mapping to Euclidean tangent space"
      accent="var(--ink)"
      eq="Xₖ = U · log(Σ) · Uᵀ"
      eqSub="log applied element-wise to eigenvalues Σ"
      lines={[
        'The matrix logarithm unrolls the SPD manifold onto',
        'flat ground — the tangent space at the identity I.',
        'Curved geometry gets absorbed into the map itself.',
        '',
        'The output lies in Sym_d (symmetric, Euclidean).',
        'Vectorise the upper triangle and you have a plain',
        'feature vector. Hand it to a standard FC layer.',
        '',
        'Everything geometric is now algebraic.',
        'The classifier never needs to know about the manifold.',
      ]}
      left={
        <>
          {/* SPD manifold: curved dome shape */}
          <path d="M 10 135 Q 40 50 90 70 Q 120 80 160 60 Q 175 52 186 62"
            fill="none" stroke="var(--ink)" strokeWidth={1.6} />
          {/* Fill under curve for depth */}
          <path d="M 10 135 Q 40 50 90 70 Q 120 80 160 60 Q 175 52 186 62 L 186 135 Z"
            fill="var(--bg-2)" stroke="none" />
          <text x={98} y={118} fontFamily="var(--mono)" fontSize={8.5}
            fill="var(--ink-3)" textAnchor="middle">Sym⁺_d manifold</text>

          {/* Point X on manifold */}
          <circle cx={88} cy={72} r={7} fill="var(--accent)" />
          <text x={82} y={62} fontFamily="var(--mono)" fontSize={10}
            fill="var(--accent)" textAnchor="middle">X</text>

          {/* Log_I arrow (downward to flat plane) */}
          <path d="M 88 80 V 158"
            stroke="var(--accent)" strokeWidth={2} fill="none"
            markerEnd="url(#sa-arr-acc)" />
          <text x={104} y={128} fontFamily="var(--mono)" fontSize={9}
            fill="var(--accent)">Log_I</text>

          {/* Flat tangent plane */}
          <rect x={8} y={162} width={180} height={56} rx={4}
            fill="var(--bg-2)" stroke="var(--accent)" strokeWidth={1.8} />
          {/* Grid lines */}
          {[1, 2, 3].map(i => (
            <React.Fragment key={i}>
              <line x1={8 + i * 45} y1={162} x2={8 + i * 45} y2={218}
                stroke="var(--ink-3)" strokeWidth={0.5} />
              <line x1={8} y1={162 + i * 14} x2={188} y2={162 + i * 14}
                stroke="var(--ink-3)" strokeWidth={0.5} />
            </React.Fragment>
          ))}
          <text x={98} y={184} fontFamily="var(--mono)" fontSize={8.5}
            fill="var(--ink-3)" textAnchor="middle">T_I(Sym⁺) ≅ Sym_d</text>
          <text x={98} y={200} fontFamily="var(--mono)" fontSize={8.5}
            fill="var(--ink-3)" textAnchor="middle">Euclidean flat space</text>

          {/* Projected point */}
          <circle cx={88} cy={190} r={6} fill="var(--accent)" />
          <text x={80} y={215} fontFamily="var(--mono)" fontSize={8}
            fill="var(--accent)" textAnchor="middle">log(X)</text>
        </>
      }
    />
  );
}

// ─── Overview pipeline ────────────────────────────────────────────────────────

function Pipeline({ state }) {
  const arrowY = MID_Y;
  const BLOCKS = [
    { title: 'BiMap',     eq: 'Xₖ = Wₖ Xₖ₋₁ Wₖᵀ' },
    { title: 'Riem. BN', eq: 'Fréchet mean + transport' },
    { title: 'ReEig',    eq: 'Xₖ = U·max(εI,Σ)·Uᵀ' },
    { title: 'LogEig',   eq: 'Xₖ = U·log(Σ)·Uᵀ' },
  ];

  return (
    <g>
      <text x={W / 2} y={50}
        fontFamily="var(--sans)" fontSize={46} fontWeight={700}
        fill="var(--ink)" textAnchor="middle">SPDNet Architecture</text>
      <text x={W / 2} y={90}
        fontFamily="var(--mono)" fontSize={22} fill="var(--ink-3)" textAnchor="middle">
        Huang &amp; Van Gool, AAAI 2017  ·  Brooks et al., NeurIPS 2019
      </text>

      {/* Input SPD matrix */}
      {[2, 1, 0].map(i => (
        <rect key={i}
          x={18 + i * 14} y={BY + 75 + i * 14}
          width={110} height={110}
          fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.4} />
      ))}
      <text x={73} y={BY + 22} fontFamily="var(--mono)" fontSize={15}
        fill="var(--ink-3)" textAnchor="middle">Input</text>
      <text x={73} y={BY + BH + 30} fontFamily="var(--mono)" fontSize={15}
        fill="var(--ink-3)" textAnchor="middle">X ∈ Sym⁺</text>

      <Arr x1={152} y={arrowY} x2={BX[0]} />

      {BLOCKS.map((b, i) => (
        <OverviewBlock key={i} idx={i}
          title={b.title} eq={b.eq} active={state === i + 1} />
      ))}

      <Arr x1={BX[0] + BW} y={arrowY} x2={BX[1]} />
      <Arr x1={BX[1] + BW} y={arrowY} x2={BX[2]} />
      <Arr x1={BX[2] + BW} y={arrowY} x2={BX[3]} />

      {/* ×k bracket */}
      <path d={`M ${BX[0] - 5} ${BY + BH + 44} H ${BX[2] + BW + 5}`}
        stroke="var(--ink-3)" strokeWidth={1.2} strokeDasharray="5 3" fill="none" />
      <text x={(BX[0] + BX[2] + BW) / 2} y={BY + BH + 68}
        fontFamily="var(--mono)" fontSize={18} fill="var(--ink-3)" textAnchor="middle">
        × k layers
      </text>

      <Arr x1={BX[3] + BW} y={arrowY} x2={1383} />

      {/* Vec */}
      <circle cx={1408} cy={arrowY} r={36}
        fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.6} />
      <text x={1408} y={arrowY - 5} fontFamily="var(--sans)" fontSize={16}
        fontWeight={600} fill="var(--ink)" textAnchor="middle">vec</text>
      <text x={1408} y={arrowY + 14} fontFamily="var(--mono)" fontSize={11}
        fill="var(--ink-3)" textAnchor="middle">▲</text>

      <Arr x1={1444} y={arrowY} x2={1470} />

      {/* FC */}
      <g transform={`translate(1470,${arrowY - 44})`}>
        <rect width={108} height={88} rx={3}
          fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.6} />
        <text x={54} y={40} fontFamily="var(--sans)" fontSize={20}
          fontWeight={600} fill="var(--ink)" textAnchor="middle">FC</text>
      </g>

      <Arr x1={1578} y={arrowY} x2={1604} />

      {/* Softmax */}
      <g transform={`translate(1604,${arrowY - 44})`}>
        <rect width={130} height={88} rx={3}
          fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.6} />
        <text x={65} y={40} fontFamily="var(--sans)" fontSize={20}
          fontWeight={600} fill="var(--ink)" textAnchor="middle">Softmax</text>
      </g>

      <Arr x1={1734} y={arrowY} x2={1752} />
      <text x={1758} y={arrowY + 12} fontFamily="var(--mono)"
        fontSize={38} fill="var(--accent)">ŷ</text>

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
  const timerRef     = useRef(null);
  const [state,       setState]       = useState(0);  // immediate: block highlight
  const [detailShown, setDetailShown] = useState(-1); // delayed: detail fade-in

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

    function animateDirect(from, to, dur, onDone) {
      if (rafId) cancelAnimationFrame(rafId);
      const t0 = performance.now();
      const tick = (now) => {
        const t = Math.min((now - t0) / dur, 1);
        svg.setAttribute('viewBox', lerp4(from, to, easeInOut(t)).join(' '));
        if (t < 1) { rafId = requestAnimationFrame(tick); }
        else if (onDone) onDone();
      };
      rafId = requestAnimationFrame(tick);
    }

    function animateThrough(from, mid, to, dur, onDone) {
      if (rafId) cancelAnimationFrame(rafId);
      const t0 = performance.now();
      const tick = (now) => {
        const rawT = Math.min((now - t0) / dur, 1);
        if (rawT < 0.5) {
          svg.setAttribute('viewBox',
            lerp4(from, mid, easeInOut(rawT * 2)).join(' '));
        } else {
          const e = easeInOut((rawT - 0.5) * 2);
          svg.setAttribute('viewBox', lerp4(mid, to, e).join(' '));
        }
        if (rawT < 1) { rafId = requestAnimationFrame(tick); }
        else if (onDone) onDone();
      };
      rafId = requestAnimationFrame(tick);
    }

    function tweenTo(targetIdx) {
      const curStr = svg.getAttribute('viewBox') || STATES[0].join(' ');
      const from   = curStr.split(' ').map(Number);
      const to     = STATES[Math.max(0, Math.min(STATES.length - 1, targetIdx))];
      const isZoomed = (vb) => vb[2] < W - 10;

      // Hide current detail immediately
      clearTimeout(timerRef.current);
      setDetailShown(-1);

      const dur = (isZoomed(from) && isZoomed(to)) ? 1100 : 560;

      if (reducedMotion) {
        svg.setAttribute('viewBox', to.join(' '));
        setDetailShown(targetIdx);
        return;
      }

      const onDone = () => {
        // Fade in the detail for zoom states only (not overview)
        if (targetIdx >= 1 && targetIdx <= 4) {
          timerRef.current = setTimeout(() => setDetailShown(targetIdx), 60);
        }
      };

      if (isZoomed(from) && isZoomed(to)) {
        animateThrough(from, STATES[0], to, dur, onDone);
      } else {
        animateDirect(from, to, dur, onDone);
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
      clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      {STATES.slice(1).map((_, i) => (
        <i key={i} data-step style={{ display: 'none' }} />
      ))}

      <svg ref={svgRef}
        width="100%" height="100%"
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block' }}>
        <Defs />
        <Pipeline state={state} />

        {/* Detail overlays — fade in after camera arrives */}
        <OverlayShell idx={0} detailShown={detailShown}><BiMapDetail /></OverlayShell>
        <OverlayShell idx={1} detailShown={detailShown}><BNDetail /></OverlayShell>
        <OverlayShell idx={2} detailShown={detailShown}><ReEigDetail /></OverlayShell>
        <OverlayShell idx={3} detailShown={detailShown}><LogEigDetail /></OverlayShell>
      </svg>
    </div>
  );
}
