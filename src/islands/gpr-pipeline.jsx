import React, { useRef, useEffect, useState } from 'react';

// ════════════════════════════════════════════════════════════════════════════
// GPR pipeline architecture — ResNet + CovPool + SPDNet.
//
// Mirrors the interaction grammar of spdnet-arch.jsx: an overview "ribbon" SVG
// that pans/zooms into each of the 3 pipeline stages as data-step reveals fire,
// with an HTML detail overlay fading in over each zoom. Monochrome ink-on-paper
// with sparing accent, matching the deck's established aesthetic.
// ════════════════════════════════════════════════════════════════════════════

const W = 1760, H = 990;
const FY = 495; // vertical centre of the main flow

// Zoom windows (16:9) centred on each stage; the detail overlay covers them.
const ZW = 600, ZH = ZW * H / W;
const frame = (cx, cy = FY) => [cx - ZW / 2, cy - ZH / 2, ZW, ZH];

const STATES = [
  [0, 0, W, H],     // 0 overview
  frame(300),       // 1 ResNet
  frame(700),       // 2 CovPool
  frame(1180),      // 3 SPDNet
  [0, 0, W, H],     // 4 recap
];

function ease(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

// ─── Shared SVG primitives ──────────────────────────────────────────────────

function Cube({ x, y, w, h, depth, dx = 13, dy = 13, fill = 'var(--bg-2)', accent = false, fs = 19 }) {
  const s = accent ? 'var(--accent)' : 'var(--ink)';
  return (
    <g>
      <path d={`M ${x} ${y} L ${x + dx} ${y - dy} L ${x + w + dx} ${y - dy} L ${x + w} ${y} Z`}
        fill="var(--bg)" stroke={s} strokeWidth={1.4} />
      <path d={`M ${x + w} ${y} L ${x + w + dx} ${y - dy} L ${x + w + dx} ${y + h - dy} L ${x + w} ${y + h} Z`}
        fill="var(--bg-2)" stroke={s} strokeWidth={1.4} />
      <rect x={x} y={y} width={w} height={h} fill={fill} stroke={s} strokeWidth={accent ? 2.4 : 1.4} />
      {depth != null && (
        <text x={x + w / 2} y={y + h / 2 + fs * 0.34} fontFamily="var(--mono)"
          style={{ fontSize: `calc(${fs}px * var(--type-scale, 1))` }} fontWeight={700} fill={s} textAnchor="middle">{depth}</text>
      )}
    </g>
  );
}

function Box({ x, y, w, h, label, sub, marker, accent = false, fs = 22 }) {
  const s = accent ? 'var(--accent)' : 'var(--ink)';
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={6}
        fill="var(--bg-2)" stroke={s} strokeWidth={accent ? 2.4 : 1.6} />
      <text x={x + w / 2} y={y + h / 2 + (sub ? -4 : fs * 0.34)} fontFamily="var(--sans)"
        style={{ fontSize: `calc(${fs}px * var(--type-scale, 1))` }} fontWeight={700} fill="var(--ink)" textAnchor="middle">{label}</text>
      {sub && (
        <text x={x + w / 2} y={y + h / 2 + 22} fontFamily="var(--mono)"
          style={{ fontSize: 'calc(14px * var(--type-scale, 1))' }} fill="var(--ink-3)" textAnchor="middle">{sub}</text>
      )}
    </g>
  );
}

const Arrow = ({ x1, x2, y, m, sw = 1.8 }) => (
  <path d={`M ${x1} ${y} H ${x2}`} stroke="var(--ink)" strokeWidth={sw}
    fill="none" markerEnd={`url(#${m})`} />
);

function ArrowMarker({ id, size = 6 }) {
  return (
    <marker id={id} viewBox="0 0 10 10" refX={9} refY={5}
      markerWidth={size} markerHeight={size} orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--ink)" />
    </marker>
  );
}

// Small covariance-matrix heatmap: strong diagonal, decaying off-diagonal.
function CovGrid({ x, y, size, n = 9, m }) {
  const c = size / n;
  const cells = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const d = Math.abs(i - j);
      const op = Math.max(0.06, 0.92 * Math.exp(-d * d / 3.2));
      cells.push(
        <rect key={`${i}-${j}`} x={x + j * c} y={y + i * c} width={c} height={c}
          fill="var(--accent)" opacity={op} />
      );
    }
  }
  return (
    <g>
      {cells}
      <rect x={x} y={y} width={size} height={size}
        fill="none" stroke="var(--ink)" strokeWidth={1.6} />
    </g>
  );
}

// ─── Overview ribbon ────────────────────────────────────────────────────────

function StageBand({ x, w, num, name, active }) {
  return (
    <g>
      <rect x={x} y={330} width={w} height={330} rx={12}
        fill={active ? 'var(--tint)' : 'none'}
        stroke={active ? 'var(--accent)' : 'var(--rule-soft)'}
        strokeWidth={active ? 2.4 : 1.2}
        strokeDasharray={active ? 'none' : '2 6'} opacity={active ? 1 : 0.8} />
      <circle cx={x + 30} cy={312} r={17}
        fill={active ? 'var(--accent)' : 'var(--bg-2)'}
        stroke={active ? 'var(--accent)' : 'var(--ink)'} strokeWidth={1.6} />
      <text x={x + 30} y={318} fontFamily="var(--sans)" style={{ fontSize: 'calc(18px * var(--type-scale, 1))' }} fontWeight={800}
        fill={active ? 'var(--bg)' : 'var(--ink)'} textAnchor="middle">{num}</text>
      <text x={x + 56} y={318} fontFamily="var(--sans)" style={{ fontSize: 'calc(20px * var(--type-scale, 1))' }} fontWeight={700}
        fill="var(--ink)">{name}</text>
    </g>
  );
}

function Pipeline({ state }) {
  return (
    <g>
      {/* Stage bands (behind) */}
      <StageBand x={160} w={360} num="1" name="ResNet-34" active={state === 1} />
      <StageBand x={585} w={375} num="2" name="Covariance pooling" active={state === 2} />
      <StageBand x={985} w={763} num="3" name="SPDNet → classes" active={state === 3} />

      {/* Input B-scan */}
      <rect x={30} y={FY - 55} width={80} height={110} fill="var(--bg-2)"
        stroke="var(--ink)" strokeWidth={1.6} />
      {[0, 1, 2, 3, 4].map(i => (
        <line key={i} x1={30} y1={FY - 40 + i * 22} x2={110} y2={FY - 40 + i * 22}
          stroke="var(--ink-3)" strokeWidth={0.7} opacity={0.6} />
      ))}
      <text x={70} y={FY + 80} fontFamily="var(--sans)" style={{ fontSize: 'calc(16px * var(--type-scale, 1))' }}
        fill="var(--ink-3)" textAnchor="middle">B-scan</text>
      <text x={70} y={FY + 100} fontFamily="var(--mono)" style={{ fontSize: 'calc(14px * var(--type-scale, 1))' }}
        fill="var(--ink-3)" textAnchor="middle">60×112</text>

      <Arrow x1={112} x2={170} y={FY} m="gpa" />

      {/* Stage 1 — ResNet */}
      <Box x={172} y={FY - 58} w={210} h={116} label="ResNet-34" sub="34 couches" />
      <Arrow x1={384} x2={438} y={FY} m="gpa" />
      <Cube x={444} y={FY - 30} w={64} h={64} depth="d" fs={20} />
      <text x={490} y={FY + 70} fontFamily="var(--mono)" style={{ fontSize: 'calc(20px * var(--type-scale, 1))' }}
        fill="var(--ink)" textAnchor="middle">𝒯</text>
      <text x={490} y={FY + 90} fontFamily="var(--mono)" style={{ fontSize: 'calc(13px * var(--type-scale, 1))' }}
        fill="var(--ink-3)" textAnchor="middle">d×h×w</text>

      <Arrow x1={524} x2={598} y={FY} m="gpa" />

      {/* Stage 2 — CovPool */}
      <Box x={600} y={FY - 58} w={206} h={116} label="CovPool" sub="C = T Ĩ Tᵀ" />
      <Arrow x1={808} x2={858} y={FY} m="gpa" />
      <CovGrid x={862} y={FY - 45} size={90} m="gpa" />
      <text x={907} y={FY + 70} fontFamily="var(--mono)" style={{ fontSize: 'calc(20px * var(--type-scale, 1))' }}
        fill="var(--ink)" textAnchor="middle">X₀</text>
      <text x={907} y={FY + 90} fontFamily="var(--mono)" style={{ fontSize: 'calc(13px * var(--type-scale, 1))' }}
        fill="var(--ink-3)" textAnchor="middle">d×d</text>

      <Arrow x1={954} x2={1000} y={FY} m="gpa" />

      {/* Stage 3 — SPDNet: shrinking SPD layers */}
      {[
        { x: 1004, s: 100, d: 'd₁' },
        { x: 1124, s: 88, d: 'd₂' },
        { x: 1232, s: 78, d: 'd₃' },
        { x: 1326, s: 70, d: 'd₄' },
      ].map((sq, i, arr) => (
        <g key={i}>
          <rect x={sq.x} y={FY - sq.s / 2} width={sq.s} height={sq.s} rx={3}
            fill="var(--tint)" stroke="var(--ink)" strokeWidth={1.6} />
          <text x={sq.x + sq.s / 2} y={FY + sq.s / 2 + 26} fontFamily="var(--mono)"
            style={{ fontSize: 'calc(15px * var(--type-scale, 1))' }} fill="var(--ink-3)" textAnchor="middle">{sq.d}</text>
          {i < arr.length - 1 && (
            <Arrow x1={sq.x + sq.s} x2={arr[i + 1].x} y={FY} m="gpa" sw={1.4} />
          )}
        </g>
      ))}
      {/* repeat brace under SPD layers */}
      <path d={`M 1004 ${FY + 78} H 1396`} stroke="var(--ink-3)" strokeWidth={1}
        strokeDasharray="5 3" fill="none" />
      <text x={1200} y={FY + 98} fontFamily="var(--mono)" style={{ fontSize: 'calc(15px * var(--type-scale, 1))' }}
        fill="var(--ink-3)" textAnchor="middle">BiMap + ReEig, empilés</text>

      <Arrow x1={1396} x2={1432} y={FY} m="gpa" />

      {/* LVD + FC + classes */}
      <Box x={1434} y={FY - 50} w={92} h={100} label="LVD" fs={20} />
      <text x={1480} y={FY + 70} fontFamily="var(--mono)" style={{ fontSize: 'calc(12px * var(--type-scale, 1))' }}
        fill="var(--ink-3)" textAnchor="middle">LogEig·vec·drop</text>
      <Arrow x1={1526} x2={1560} y={FY} m="gpa" />
      <Box x={1562} y={FY - 50} w={84} h={100} label="FC" fs={20} />
      <Arrow x1={1646} x2={1678} y={FY} m="gpa" />
      {[0, 1, 2, 3].map(i => (
        <rect key={i} x={1684} y={FY - 44 + i * 24} width={56} height={16} rx={2}
          fill={i === 0 ? 'var(--accent)' : 'var(--bg-2)'}
          stroke="var(--ink)" strokeWidth={1.3} opacity={i === 0 ? 0.85 : 1} />
      ))}
      <text x={1712} y={FY + 72} fontFamily="var(--sans)" style={{ fontSize: 'calc(15px * var(--type-scale, 1))' }}
        fill="var(--ink-3)" textAnchor="middle">C classes</text>

      {/* hint */}
      {state === 0 && (
        <text x={W / 2} y={H - 46} fontFamily="var(--mono)" style={{ fontSize: 'calc(19px * var(--type-scale, 1))' }}
          fill="var(--ink-3)" textAnchor="middle">
          appuyer → pour détailler chaque étage
        </text>
      )}
    </g>
  );
}

// ─── Detail diagrams (full-width SVG) ────────────────────────────────────────

function DiagResNet() {
  const blocks = (depth, dims, x0, y, accentLast) => {
    const cw = 66, step = 142;
    return dims.map((dm, i) => {
      const gap = dm.gap ? 56 : 0;
      const x = x0 + i * step + gap;
      const acc = accentLast && i === dims.length - 1;
      return (
        <g key={i}>
          {dm.gap && (
            <text x={x - 38} y={y + 38} fontFamily="var(--mono)" style={{ fontSize: 'calc(28px * var(--type-scale, 1))' }}
              fill="var(--ink-3)" textAnchor="middle">⋯</text>
          )}
          <Cube x={x} y={y} w={cw} h={cw} depth={depth} accent={acc} fs={18} />
          <text x={x + cw / 2} y={y + cw + 26} fontFamily="var(--mono)" style={{ fontSize: 'calc(15px * var(--type-scale, 1))' }}
            fill="var(--ink)" textAnchor="middle">{dm.t}</text>
          <text x={x + cw / 2} y={y + cw + 46} fontFamily="var(--mono)" style={{ fontSize: 'calc(13px * var(--type-scale, 1))' }}
            fill="var(--ink-3)" textAnchor="middle">{dm.d}</text>
          {i < dims.length - 1 && !dims[i + 1].gap && (
            <Arrow x1={x + cw + 13} x2={x + step} y={y + cw / 2} m="gpr1" sw={1.4} />
          )}
        </g>
      );
    });
  };
  const dimsRC = [
    { t: '𝒯₁', d: '56×30' }, { t: '𝒯₂', d: '56×30' }, { t: '𝒯₃', d: '56×30' },
    { t: '𝒯₄', d: '28×15' }, { t: '𝒯ₗ = 𝒯', d: '28×15', gap: true },
  ];
  const dimsSR = [
    { t: '𝒯₁', d: '38×20' }, { t: '𝒯₂', d: '38×20' }, { t: '𝒯₃', d: '38×20' },
    { t: '𝒯₄', d: '38×20' }, { t: '𝒯ₗ', d: '38×20', gap: true },
  ];
  return (
    <svg viewBox="0 0 1680 720" width="100%" height="100%" style={{ display: 'block' }}>
      <defs><ArrowMarker id="gpr1" size={5} /></defs>

      {/* ── RCNet row ── */}
      <text x={20} y={70} fontFamily="var(--sans)" style={{ fontSize: 'calc(24px * var(--type-scale, 1))' }} fontWeight={800}
        fill="var(--accent)">RCNet</text>
      <text x={120} y={70} fontFamily="var(--mono)" style={{ fontSize: 'calc(19px * var(--type-scale, 1))' }}
        fill="var(--ink-3)">d = 64 · dernière carte</text>
      <rect x={20} y={110} width={64} height={110} fill="var(--bg-2)"
        stroke="var(--ink)" strokeWidth={1.6} />
      {[0, 1, 2, 3].map(i => (
        <line key={i} x1={20} y1={126 + i * 22} x2={84} y2={126 + i * 22}
          stroke="var(--ink-3)" strokeWidth={0.7} opacity={0.6} />
      ))}
      <Arrow x1={86} x2={132} y={165} m="gpr1" />
      <Box x={134} y={130} w={130} h={70} label="ResNet-34" fs={18} />
      <Arrow x1={264} x2={310} y={165} m="gpr1" />
      {blocks('64', dimsRC, 320, 138, true)}
      <path d="M 320 250 H 1180" stroke="var(--ink-3)" strokeWidth={1}
        strokeDasharray="5 3" fill="none" />
      <text x={750} y={272} fontFamily="var(--mono)" style={{ fontSize: 'calc(16px * var(--type-scale, 1))' }}
        fill="var(--ink-3)" textAnchor="middle">l couches</text>

      {/* divider */}
      <line x1={20} y1={360} x2={1660} y2={360} stroke="var(--rule-soft)" strokeWidth={1} />

      {/* ── SRCNet row ── */}
      <text x={20} y={430} fontFamily="var(--sans)" style={{ fontSize: 'calc(24px * var(--type-scale, 1))' }} fontWeight={800}
        fill="var(--accent)">SRCNet</text>
      <text x={140} y={430} fontFamily="var(--mono)" style={{ fontSize: 'calc(19px * var(--type-scale, 1))' }}
        fill="var(--ink-3)">d = l × 32 · 32 canaux empilés</text>
      <rect x={20} y={470} width={64} height={110} fill="var(--bg-2)"
        stroke="var(--ink)" strokeWidth={1.6} />
      {[0, 1, 2, 3].map(i => (
        <line key={i} x1={20} y1={486 + i * 22} x2={84} y2={486 + i * 22}
          stroke="var(--ink-3)" strokeWidth={0.7} opacity={0.6} />
      ))}
      <Arrow x1={86} x2={132} y={525} m="gpr1" />
      <Box x={134} y={490} w={130} h={70} label="ResNet-34" fs={18} />
      <Arrow x1={264} x2={310} y={525} m="gpr1" />
      {blocks('32', dimsSR, 320, 498, false)}
      <text x={1080} y={478} fontFamily="var(--mono)" style={{ fontSize: 'calc(15px * var(--type-scale, 1))' }}
        fill="var(--ink-3)" textAnchor="middle">interp. bilinéaire → même taille</text>

      {/* ⇒ stacked block */}
      <path d="M 1148 525 H 1196" stroke="var(--ink)" strokeWidth={2}
        fill="none" markerEnd="url(#gpr1)" />
      {[3, 2, 1, 0].map(i => (
        <Cube key={i} x={1210 + i * 9} y={498 + i * 9} w={64} h={64}
          depth={i === 0 ? 'l×32' : null} accent={i === 0} fs={15} />
      ))}
      <text x={1262} y={616} fontFamily="var(--mono)" fontSize={16}
        fill="var(--ink)" textAnchor="middle">𝒯</text>
    </svg>
  );
}

function DiagCovPool() {
  return (
    <svg viewBox="0 0 1680 700" width="100%" height="100%" style={{ display: 'block' }}>
      <defs><ArrowMarker id="gpr2" size={5} /></defs>

      {/* big formula */}
      <text x={840} y={90} fontFamily="var(--mono)" fontSize={42} fontWeight={700}
        fill="var(--ink)" textAnchor="middle">C = T Ĩ Tᵀ = X₀</text>

      {/* tensor 𝒯 */}
      <Cube x={70} y={300} w={120} h={120} depth="d" fs={26} />
      <text x={143} y={470} fontFamily="var(--mono)" fontSize={20}
        fill="var(--ink)" textAnchor="middle">𝒯</text>
      <text x={143} y={494} fontFamily="var(--mono)" fontSize={15}
        fill="var(--ink-3)" textAnchor="middle">d × h × w</text>

      <Arrow x1={210} x2={360} y={350} m="gpr2" sw={2} />
      <text x={285} y={335} fontFamily="var(--sans)" fontSize={17}
        fill="var(--ink-3)" textAnchor="middle">reshape</text>

      {/* matrix T (d × hw) */}
      <rect x={380} y={250} width={140} height={300} fill="var(--bg-2)"
        stroke="var(--ink)" strokeWidth={1.6} />
      {[1, 2, 3, 4].map(i => (
        <line key={`r${i}`} x1={380} y1={250 + i * 60} x2={520} y2={250 + i * 60}
          stroke="var(--ink-3)" strokeWidth={0.6} opacity={0.6} />
      ))}
      {[1, 2].map(i => (
        <line key={`c${i}`} x1={380 + i * 47} y1={250} x2={380 + i * 47} y2={550}
          stroke="var(--ink-3)" strokeWidth={0.6} opacity={0.6} />
      ))}
      <text x={450} y={580} fontFamily="var(--mono)" fontSize={18}
        fill="var(--ink)" textAnchor="middle">T</text>
      <text x={450} y={604} fontFamily="var(--mono)" fontSize={15}
        fill="var(--ink-3)" textAnchor="middle">d × hw</text>

      <Arrow x1={540} x2={700} y={400} m="gpr2" sw={2} />

      {/* SPD matrix heatmap X₀ */}
      <CovGrid x={720} y={270} size={260} n={11} m="gpr2" />
      <text x={850} y={566} fontFamily="var(--mono)" fontSize={20}
        fill="var(--ink)" textAnchor="middle">X₀  (d × d)</text>
      <text x={850} y={596} fontFamily="var(--mono)" fontSize={17}
        fill="var(--ink-3)" textAnchor="middle">X₀ ∈ Sym⁺_d — symétrique définie positive</text>

      {/* note panel */}
      <g transform="translate(1080, 280)">
        <rect x={0} y={0} width={540} height={250} rx={8} fill="var(--bg-2)"
          stroke="var(--rule-soft)" strokeWidth={1.4} />
        <text x={28} y={56} fontFamily="var(--sans)" fontSize={22} fontWeight={700}
          fill="var(--ink)">Représentation d'ordre deux</text>
        <text x={28} y={104} fontFamily="var(--sans)" fontSize={19} fill="var(--ink-2)">
          La covariance entre canaux convolutionnels</text>
        <text x={28} y={134} fontFamily="var(--sans)" fontSize={19} fill="var(--ink-2)">
          résume les corrélations inter-canaux en une</text>
        <text x={28} y={164} fontFamily="var(--sans)" fontSize={19} fill="var(--ink-2)">
          matrice SPD compacte d × d.</text>
        <text x={28} y={212} fontFamily="var(--mono)" fontSize={17} fill="var(--ink-3)">
          Ĩ : centrage (matrice idempotente)</text>
      </g>
    </svg>
  );
}

function DiagSPDNet() {
  return (
    <svg viewBox="0 0 1680 700" width="100%" height="100%" style={{ display: 'block' }}>
      <defs><ArrowMarker id="gpr3" size={5} /></defs>

      {/* input X₀ */}
      <CovGrid x={28} y={250} size={92} n={7} m="gpr3" />
      <text x={74} y={372} fontFamily="var(--mono)" fontSize={15}
        fill="var(--ink-3)" textAnchor="middle">X₀ ∈ Sym⁺_d</text>
      <Arrow x1={124} x2={168} y={296} m="gpr3" />

      {/* opened SPD-dᵢ block */}
      <rect x={172} y={170} width={540} height={250} rx={14}
        fill="var(--tint)" stroke="var(--accent)" strokeWidth={2} />
      <text x={196} y={208} fontFamily="var(--sans)" fontSize={20} fontWeight={800}
        fill="var(--accent)">Bloc SPD-dᵢ</text>
      <Box x={210} y={250} w={150} h={110} label="BiMap" sub="Wₖ X Wₖᵀ" fs={22} />
      <Arrow x1={362} x2={414} y={305} m="gpr3" />
      <Box x={416} y={250} w={172} h={110} label="ReEig" sub="U max(εI,Λ) Uᵀ" fs={22} />
      <text x={650} y={300} fontFamily="var(--mono)" fontSize={16}
        fill="var(--ink)" textAnchor="middle">Y ∈</text>
      <text x={650} y={322} fontFamily="var(--mono)" fontSize={16}
        fill="var(--ink)" textAnchor="middle">Sym⁺</text>
      <path d="M 172 446 H 712" stroke="var(--ink-3)" strokeWidth={1}
        strokeDasharray="5 3" fill="none" />
      <text x={442} y={470} fontFamily="var(--mono)" fontSize={16}
        fill="var(--ink-3)" textAnchor="middle">empilé — réduction de dimension</text>

      <Arrow x1={716} x2={760} y={296} m="gpr3" />

      {/* shrinking dimension squares */}
      {[
        { x: 764, s: 92, d: 'd₁' },
        { x: 872, s: 80, d: 'd₂' },
        { x: 968, s: 70, d: 'd₃' },
        { x: 1050, s: 62, d: 'd₄' },
      ].map((sq, i, arr) => (
        <g key={i}>
          <rect x={sq.x} y={296 - sq.s / 2} width={sq.s} height={sq.s} rx={3}
            fill="var(--tint)" stroke="var(--ink)" strokeWidth={1.6} />
          <text x={sq.x + sq.s / 2} y={296 + sq.s / 2 + 24} fontFamily="var(--mono)"
            fontSize={15} fill="var(--ink-3)" textAnchor="middle">{sq.d}</text>
          {i < arr.length - 1 && (
            <Arrow x1={sq.x + sq.s} x2={arr[i + 1].x} y={296} m="gpr3" sw={1.3} />
          )}
        </g>
      ))}

      <Arrow x1={1116} x2={1162} y={296} m="gpr3" />

      {/* LVD → FC → classes */}
      <Box x={1164} y={246} w={128} h={100} label="LVD" fs={20} />
      <text x={1228} y={372} fontFamily="var(--mono)" fontSize={13}
        fill="var(--ink-3)" textAnchor="middle">LogEig · vec · dropout 0.1</text>
      <Arrow x1={1292} x2={1330} y={296} m="gpr3" />
      <Box x={1332} y={246} w={96} h={100} label="FC" fs={20} />
      <Arrow x1={1428} x2={1466} y={296} m="gpr3" />
      {[0, 1, 2, 3].map(i => (
        <rect key={i} x={1472} y={252 + i * 24} width={60} height={16} rx={2}
          fill={i === 0 ? 'var(--accent)' : 'var(--bg-2)'}
          stroke="var(--ink)" strokeWidth={1.3} opacity={i === 0 ? 0.85 : 1} />
      ))}
      <text x={1502} y={372} fontFamily="var(--sans)" fontSize={15}
        fill="var(--ink-3)" textAnchor="middle">C classes</text>
    </svg>
  );
}

// ─── Detail overlay layout ──────────────────────────────────────────────────

const DETAILS = [
  {
    num: '1',
    title: 'ResNet-34 — extracteur de caractéristiques',
    diagram: <DiagResNet />,
    caption: 'RCNet conserve la dernière carte (d = 64). SRCNet ré-échantillonne les 32 premiers canaux de chaque bloc à une taille commune et les empile (d = l × 32).',
  },
  {
    num: '2',
    title: 'Covariance pooling',
    diagram: <DiagCovPool />,
    caption: "Le tenseur est remis à plat en T (d × hw) ; sa covariance C = T Ĩ Tᵀ devient la matrice SPD d'entrée X₀ — une représentation d'ordre deux, compacte et géométriquement structurée.",
  },
  {
    num: '3',
    title: 'SPDNet — couches sur la variété SPD',
    diagram: <DiagSPDNet />,
    caption: "Chaque bloc enchaîne BiMap (Wₖ X Wₖᵀ, Wₖ sur la variété de Stiefel) et ReEig (plancher spectral ε). Empilés, ils réduisent la dimension ; LVD aplatit vers l'euclidien, FC classe.",
  },
];

function Detail({ d }) {
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      padding: '28px 48px 24px',
      boxSizing: 'border-box',
      background: 'var(--bg)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '18px',
        flex: '0 0 auto', marginBottom: '14px',
      }}>
        <span style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '46px', height: '46px', borderRadius: '50%',
          background: 'var(--accent)', color: 'var(--bg)',
          fontFamily: 'var(--sans)', fontSize: '26px', fontWeight: 800,
        }}>{d.num}</span>
        <span style={{
          fontFamily: 'var(--sans)', fontSize: '46px', fontWeight: 700,
          color: 'var(--ink)', letterSpacing: '-0.02em',
        }}>{d.title}</span>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {d.diagram}
      </div>

      <div style={{
        flex: '0 0 auto', marginTop: '12px', paddingTop: '14px',
        borderTop: '1px solid var(--rule-soft)',
        fontFamily: 'var(--sans)', fontSize: '23px', lineHeight: 1.5,
        color: 'var(--ink-2)',
      }}>{d.caption}</div>
    </div>
  );
}

// ─── Main island ────────────────────────────────────────────────────────────

export function GprPipeline() {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const rafRef = useRef(null);
  const timerRef = useRef(null);

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
      if (noMotion) { svg.setAttribute('viewBox', to.join(' ')); onDone?.(); return; }
      const t0 = performance.now();
      const tick = (now) => {
        const t = Math.min((now - t0) / dur, 1);
        const e = ease(t);
        svg.setAttribute('viewBox', from.map((v, i) => v + (to[i] - v) * e).join(' '));
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
      setDetailIdx(-1);

      const from = (svg.getAttribute('viewBox') || STATES[0].join(' ')).split(' ').map(Number);
      const to = STATES[Math.max(0, Math.min(STATES.length - 1, n))];

      tween(from, to, 560, () => {
        if (n >= 1 && n <= 3) timerRef.current = setTimeout(() => setDetailIdx(n), 40);
      });
    }

    readState();
    const obs = new MutationObserver(readState);
    obs.observe(container, { subtree: true, attributes: true, attributeFilter: ['data-step-visible'] });
    return () => {
      obs.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      {STATES.slice(1).map((_, i) => (
        <i key={i} data-step style={{ display: 'none' }} />
      ))}

      <svg ref={svgRef} width="100%" height="100%"
        preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
        <defs><ArrowMarker id="gpa" /></defs>
        <Pipeline state={state} />
      </svg>

      {DETAILS.map((d, i) => (
        <div key={i} style={{
          position: 'absolute', inset: 0,
          opacity: detailIdx === i + 1 ? 1 : 0,
          transition: 'opacity 380ms ease',
          pointerEvents: 'none',
        }}>
          <Detail d={d} />
        </div>
      ))}
    </div>
  );
}
