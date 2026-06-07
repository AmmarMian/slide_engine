import React, { useState, useEffect, useRef } from 'react';

const C = {
  core: '#6366f1',
  bn: '#f59e0b',
  attention: '#10b981',
  cnn: '#3b82f6',
  encoder: '#8b5cf6',
  structural: '#ef4444',
  local: '#14b8a6',
  thiswork: '#d23b1c',
};

const YEAR_ORDER = [2015, 2017, 2019, 2022, 2023, 2025];

const NODES = [
  { id: 'Ionescu', short: 'Ionescu\n2015', year: 2015, cluster: 'core', type: 'found', x: 160, y: 420, title: 'Matrix Backpropagation for Deep Networks with Structured Layers', venue: 'ICCV 2015', key: 'Gradients through eigendecompositions → end-to-end training' },
  { id: 'SPDNet', short: 'SPDNet\n2017', year: 2017, cluster: 'core', type: 'found', x: 390, y: 420, title: 'A Riemannian Network for SPD Matrix Learning', venue: 'AAAI 2017', key: 'BiMap + ReEig + LogEig — the baseline architecture' },
  { id: 'MPN-Cov', short: 'MPN-Cov\n2017', year: 2017, cluster: 'cnn', type: 'layer', x: 390, y: 650, title: 'Is Second-order Information Helpful for Large-scale Visual Recognition?', venue: 'ICCV 2017', key: 'Matrix Power Normalized Covariance pooling in CNNs' },
  { id: 'SPDNet-BN', short: 'SPDNet-BN\n2019', year: 2019, cluster: 'bn', type: 'layer', x: 640, y: 270, title: 'Riemannian Batch Normalization for SPD Neural Networks', venue: 'NeurIPS 2019', key: 'Riemannian BN: Fréchet barycenter + parallel transport (mean only)' },
  { id: 'MAtt', short: 'MAtt\n2022', year: 2022, cluster: 'attention', type: 'layer', x: 900, y: 150, title: 'MAtt: A Manifold Attention Network for EEG Decoding', venue: 'NeurIPS 2022', key: 'Manifold-aware self-attention on SPD manifold' },
  { id: 'Kobler2022', short: 'Kobler\n2022', year: 2022, cluster: 'bn', type: 'layer', x: 900, y: 300, title: 'SPD domain-specific batch normalization', venue: '2022', key: 'Extends Brooks 2019: adds variance control (mean + variance)' },
  { id: 'DiscSPD', short: 'DiscSPD\n2022', year: 2022, cluster: 'attention', type: 'layer', x: 900, y: 450, title: 'Discriminative SPD-MNN', venue: '2022', key: 'Riemannian pooling for hierarchical feature aggregation' },
  { id: 'DreamNet', short: 'DreamNet\n2022', year: 2022, cluster: 'encoder', type: 'arch', x: 900, y: 620, title: 'DreamNet: A Deep Riemannian Manifold Network', venue: 'ACCV 2022', key: 'Encoder-decoder autoencoder on SPD manifold' },
  { id: 'RResNet', short: 'RResNet\n2023', year: 2023, cluster: 'local', type: 'arch', x: 1160, y: 170, title: 'Riemannian Residual Neural Networks', venue: 'NeurIPS 2023', key: 'ResNet skip connections generalized to Riemannian manifolds' },
  { id: 'MSNet', short: 'MSNet\n2023', year: 2023, cluster: 'local', type: 'arch', x: 1160, y: 360, title: 'Riemannian Local Mechanism for SPD Neural Networks', venue: 'AAAI 2023', key: 'Multi-scale submanifold block: local SPD geometry' },
  { id: 'U-SPDNet', short: 'U-SPDNet\n2023', year: 2023, cluster: 'encoder', type: 'arch', x: 1160, y: 570, title: 'U-SPDNet: An SPD manifold learning-based neural network', venue: 'Neural Networks 2023', key: 'U-shaped encoder-decoder with skip connections' },
  { id: 'SpodNet', short: 'SpodNet\n2025', year: 2025, cluster: 'structural', type: 'arch', x: 1400, y: 410, title: "Schur's Positive-Definite Network", venue: 'ICLR 2025', key: 'Enforces both SPDness and sparsity simultaneously' },
  { id: 'Jafuno', short: 'Jafuno\n2025', year: 2025, cluster: 'cnn', type: 'layer', x: 1400, y: 660, title: 'SPDNet + MPN-Cov for PolSAR / remote sensing', venue: '2025', key: 'MPN-Cov second-order features integrated into SPDNet' },
  { id: 'ThisWork', short: '★ Ce travail', year: 2025, cluster: 'thiswork', type: 'found', x: 1400, y: 160, title: 'BN SPD — rétropropagation en forme fermée', venue: 'Ce travail', key: 'Gradient fermé pour la BN riemannienne — efficace et exact' },
];

const EDGES = [
  { s: 'Ionescu', t: 'SPDNet', type: 'enables' },
  { s: 'Ionescu', t: 'MPN-Cov', type: 'enables' },
  { s: 'SPDNet', t: 'SPDNet-BN', type: 'extends' },
  { s: 'SPDNet', t: 'MAtt', type: 'extends' },
  { s: 'SPDNet', t: 'DiscSPD', type: 'extends' },
  { s: 'SPDNet', t: 'DreamNet', type: 'extends' },
  { s: 'SPDNet', t: 'U-SPDNet', type: 'extends' },
  { s: 'SPDNet', t: 'MSNet', type: 'extends' },
  { s: 'SPDNet', t: 'RResNet', type: 'extends' },
  { s: 'SPDNet-BN', t: 'Kobler2022', type: 'extends' },
  { s: 'SPDNet-BN', t: 'RResNet', type: 'builds-on' },
  { s: 'SPDNet-BN', t: 'MAtt', type: 'used-in' },
  { s: 'MPN-Cov', t: 'Jafuno', type: 'extends' },
  { s: 'DreamNet', t: 'U-SPDNet', type: 'extends' },
  { s: 'MSNet', t: 'RResNet', type: 'parallel' },
  { s: 'SPDNet-BN', t: 'ThisWork', type: 'extends' },
  { s: 'Kobler2022', t: 'ThisWork', type: 'builds-on' },
];

const BN_SET = new Set(['SPDNet-BN', 'Kobler2022', 'ThisWork']);
const NODE_MAP = Object.fromEntries(NODES.map(n => [n.id, n]));

const EDGE_STYLE = {
  'extends': { dash: undefined, color: 'var(--ink)', width: 1.6 },
  'enables': { dash: '7 4', color: 'var(--ink-2)', width: 1.4 },
  'builds-on': { dash: '4 4', color: 'var(--ink-2)', width: 1.4 },
  'used-in': { dash: undefined, color: 'var(--ink-3)', width: 1.2 },
  'parallel': { dash: '8 4', color: 'var(--ink-3)', width: 1.2 },
};

const CLUSTER_LABELS = {
  core: 'Pipeline SPD fondateur',
  bn: 'Normalisation (lot)',
  attention: 'Attention / pooling',
  cnn: 'Pont CNN↔SPD',
  encoder: 'Encodeur-décodeur',
  structural: 'Contraintes structurelles',
  local: 'Géométrie locale',
  thiswork: 'Ce travail',
};

function edgePath(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  return `M ${a.x} ${a.y} Q ${a.x + dx * 0.55} ${a.y + dy * 0.1} ${b.x} ${b.y}`;
}

function diamondPath(cx, cy, s) {
  return `M ${cx} ${cy - s} L ${cx + s * 0.78} ${cy} L ${cx} ${cy + s} L ${cx - s * 0.78} ${cy} Z`;
}

function NodeShape({ n, bnActive, hovered, visible, onClick, onMouseEnter, onMouseLeave }) {
  const col = C[n.cluster];
  const isBn = BN_SET.has(n.id);
  const highlighted = bnActive && isBn;
  const dimmed = bnActive && !isBn;

  const fillOpacity = highlighted ? 0.88 : hovered ? 0.45 : 0.28;
  const strokeOpacity = dimmed ? 0.2 : 1;
  const strokeW = highlighted ? 3 : hovered ? 2.2 : 1.6;
  const textCol = highlighted ? '#fff' : dimmed ? 'var(--ink-3)' : 'var(--ink)';

  const shapeProps = {
    fill: col, fillOpacity, stroke: col, strokeWidth: strokeW, strokeOpacity,
    style: { cursor: 'pointer', filter: highlighted ? `drop-shadow(0 0 7px ${col})` : 'none' },
    onClick, onMouseEnter, onMouseLeave,
  };

  const lines = n.short.split('\n');

  // Opaque bg mask — hides the year axis line passing through the node
  let bgMask, shape;
  if (n.type === 'found') {
    bgMask = <circle cx={n.x} cy={n.y} r={36} fill="var(--bg)" stroke="none" />;
    shape  = <circle {...shapeProps} cx={n.x} cy={n.y} r={36} />;
  } else if (n.type === 'layer') {
    bgMask = <path d={diamondPath(n.x, n.y, 40)} fill="var(--bg)" stroke="none" />;
    shape  = <path {...shapeProps} d={diamondPath(n.x, n.y, 40)} />;
  } else {
    bgMask = <rect x={n.x - 54} y={n.y - 28} width={108} height={56} rx={14} fill="var(--bg)" stroke="none" />;
    shape  = <rect {...shapeProps} x={n.x - 54} y={n.y - 28} width={108} height={56} rx={14} />;
  }

  return (
    <g style={{
        opacity: visible ? (dimmed ? 0.25 : 1) : 0,
        transform: visible ? 'none' : `translateY(12px)`,
        transition: 'opacity 350ms ease, transform 350ms ease',
      }}>
      {bgMask}
      {shape}
      {lines.map((ln, i) => (
        <text key={i} x={n.x} y={n.y + (lines.length === 1 ? 5 : i === 0 ? -5 : 11)}
          fontFamily="var(--sans)"
          fontSize={n.id === 'ThisWork' ? 13.5 : 12.5}
          fontWeight={n.type === 'found' || n.id === 'ThisWork' ? 700 : 500}
          fill={textCol} textAnchor="middle"
          style={{ pointerEvents: 'none', userSelect: 'none' }}>
          {ln}
        </text>
      ))}
    </g>
  );
}

const YEAR_COLS = [
  { year: 2015, x: 160 }, { year: 2017, x: 390 }, { year: 2019, x: 640 },
  { year: 2022, x: 900 }, { year: 2023, x: 1160 }, { year: 2025, x: 1400 },
];

export function SpdPaperGraph() {
  const [bnActive, setBnActive] = useState(false);
  const [tooltip, setTooltip] = useState(null);
  // revealedCount: how many year columns have been revealed (0 = none)
  const [revealedCount, setRevealedCount] = useState(0);
  const svgRef = useRef(null);
  const timersRef = useRef([]);

  function startReveal() {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setRevealedCount(0);
    YEAR_ORDER.forEach((_, i) => {
      timersRef.current.push(setTimeout(() => setRevealedCount(i + 1), 120 + i * 260));
    });
  }

  useEffect(() => {
    // Watch for slide becoming active
    const el = svgRef.current;
    if (!el) return;
    const slide = el.closest('section') || el.closest('[data-deck-active]');
    if (!slide) return;

    const obs = new MutationObserver(() => {
      if (slide.hasAttribute('data-deck-active')) startReveal();
      else {
        timersRef.current.forEach(clearTimeout);
        setRevealedCount(0);
      }
    });
    obs.observe(slide, { attributes: true, attributeFilter: ['data-deck-active'] });

    // Trigger immediately if already active
    if (slide.hasAttribute('data-deck-active')) startReveal();

    return () => {
      obs.disconnect();
      timersRef.current.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (!svgRef.current?.closest('[data-deck-active]')) return;
      if (e.key === 'b' || e.key === 'B') { e.stopPropagation(); setBnActive(v => !v); }
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const revealedYears = new Set(YEAR_ORDER.slice(0, revealedCount));

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <svg ref={svgRef} viewBox="0 0 1540 780" width="100%" height="100%"
        preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
        <defs>
          <marker id="pgArr" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={5} markerHeight={5} orient="auto">
            <path d="M 0 1 L 9 5 L 0 9 z" fill="var(--ink-3)" />
          </marker>
          <marker id="pgArrBn" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={5} markerHeight={5} orient="auto">
            <path d="M 0 1 L 9 5 L 0 9 z" fill={C.bn} />
          </marker>
        </defs>

        {/* Year axis */}
        {YEAR_COLS.map(({ year, x }) => {
          const vis = revealedYears.has(year);
          return (
            <g key={year} style={{ opacity: vis ? 1 : 0, transition: 'opacity 300ms ease' }}>
              <line x1={x} y1={34} x2={x} y2={730} stroke="var(--rule-soft)" strokeWidth={1} strokeDasharray="4 4" opacity={0.35} />
              <text x={x} y={24} fontFamily="var(--mono)" fontSize={12} fill="var(--ink-3)" textAnchor="middle" opacity={0.55}>{year}</text>
            </g>
          );
        })}

        {/* Edges — visible when both endpoints are revealed */}
        {EDGES.map((e, i) => {
          const a = NODE_MAP[e.s], b = NODE_MAP[e.t];
          if (!a || !b) return null;
          const st = EDGE_STYLE[e.type] || EDGE_STYLE['extends'];
          const isBnEdge = BN_SET.has(e.s) && BN_SET.has(e.t);
          const brightened = bnActive && isBnEdge;
          const dimmed = bnActive && !isBnEdge;
          const vis = revealedYears.has(a.year) && revealedYears.has(b.year);
          return (
            <path key={i} d={edgePath(a, b)} fill="none"
              stroke={brightened ? C.bn : st.color}
              strokeWidth={brightened ? 2.4 : st.width}
              strokeDasharray={st.dash}
              markerEnd={brightened ? 'url(#pgArrBn)' : 'url(#pgArr)'}
              style={{
                opacity: vis ? (dimmed ? 0.07 : brightened ? 1 : 0.5) : 0,
                transition: 'opacity 400ms ease',
              }} />
          );
        })}

        {/* Nodes */}
        {NODES.map(n => (
          <NodeShape key={n.id} n={n} bnActive={bnActive}
            hovered={tooltip?.node.id === n.id}
            visible={revealedYears.has(n.year)}
            onClick={() => setTooltip(t => t?.node.id === n.id ? null : { node: n })}
            onMouseEnter={() => setTooltip({ node: n })}
            onMouseLeave={() => setTooltip(null)} />
        ))}

        {/* ── Legend panel (left side) ── */}
        <rect x={8} y={38} width={188} height={342} rx={8}
          fill="var(--bg)" fillOpacity={0.85} stroke="var(--rule-soft)" strokeWidth={1} />

        <text x={18} y={58} fontFamily="var(--mono)" fontSize={10} fill="var(--ink-3)" fontWeight={600} opacity={0.7}>FORME</text>
        {[
          { type: 'found', label: 'Fondateur' },
          { type: 'layer', label: 'Amélioration de couche' },
          { type: 'arch', label: 'Architecture' },
        ].map(({ type, label }, i) => {
          const cx = 32, cy = 80 + i * 34;
          return (
            <g key={type} opacity={0.75}>
              {type === 'found' && <circle cx={cx} cy={cy} r={11} fill="var(--ink-3)" fillOpacity={0.25} stroke="var(--ink-3)" strokeWidth={1.4} />}
              {type === 'layer' && <path d={diamondPath(cx, cy, 13)} fill="var(--ink-3)" fillOpacity={0.25} stroke="var(--ink-3)" strokeWidth={1.4} />}
              {type === 'arch' && <rect x={cx - 17} y={cy - 11} width={34} height={22} rx={7} fill="var(--ink-3)" fillOpacity={0.25} stroke="var(--ink-3)" strokeWidth={1.4} />}
              <text x={52} y={cy + 5} fontFamily="var(--mono)" fontSize={10.5} fill="var(--ink-3)">{label}</text>
            </g>
          );
        })}

        <line x1={16} y1={188} x2={188} y2={188} stroke="var(--rule-soft)" strokeWidth={1} opacity={0.5} />

        <text x={18} y={204} fontFamily="var(--mono)" fontSize={10} fill="var(--ink-3)" fontWeight={600} opacity={0.7}>CLUSTER</text>
        {Object.entries(CLUSTER_LABELS).map(([k, label], i) => (
          <g key={k} opacity={k === 'thiswork' ? 1 : 0.8}>
            <circle cx={28} cy={222 + i * 22} r={6} fill={C[k]} />
            <text x={42} y={227 + i * 22} fontFamily="var(--mono)" fontSize={10}
              fill={k === 'thiswork' ? C[k] : 'var(--ink-3)'}
              fontWeight={k === 'thiswork' ? 700 : 400}>{label}</text>
          </g>
        ))}

        {/* Key hint */}
        <text x={760} y={768} fontFamily="var(--mono)" fontSize={11}
          fill="var(--ink-3)" textAnchor="middle" opacity={0.4}>
          {bnActive ? 'B — désactiver le focus BN' : 'B — mettre en évidence la normalisation par batch'}
        </text>
      </svg>

      {/* Tooltip */}
      {tooltip?.node && (() => {
        const n = tooltip.node;
        const pctX = n.x / 1540;
        const left = pctX > 0.6 ? undefined : (pctX * 100 + 2) + '%';
        const right = pctX > 0.6 ? ((1 - pctX) * 100 + 2) + '%' : undefined;
        return (
          <div style={{
            position: 'absolute', left, right,
            top: Math.min(n.y / 780 * 100, 68) + '%',
            background: 'var(--bg-2)',
            border: '1.5px solid var(--rule)',
            borderLeft: `4px solid ${C[n.cluster]}`,
            borderRadius: '6px',
            padding: '12px 16px',
            maxWidth: '300px',
            zIndex: 10,
            pointerEvents: 'none',
            boxShadow: '0 4px 24px rgba(0,0,0,0.14)',
          }}>
            <div style={{ fontFamily: 'var(--sans)', fontSize: '15px', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3, marginBottom: '5px' }}>{n.title}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ink-3)', marginBottom: '7px' }}>{n.venue}</div>
            <div style={{ fontFamily: 'var(--sans)', fontSize: '13px', color: 'var(--ink-2)', lineHeight: 1.5 }}>{n.key}</div>
          </div>
        );
      })()}
    </div>
  );
}
