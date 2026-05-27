// charts.jsx — SVG chart components, theme-aware via CSS vars.
// Ported from legacy/charts.jsx: dropped window globals, added ES imports.

import React from 'react';

const ChartFrame = ({ width = 1100, height = 480, padding = { t: 30, r: 40, b: 60, l: 70 }, children, style }) => (
  <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ display: 'block', ...style }}>
    {children}
  </svg>
);

// NLL vs diffusion steps — line chart with annotation
export function NLLChart({ variant = 'swiss' }) {
  const W = 1100, H = 460;
  const PAD = { t: 28, r: 280, b: 80, l: 100 };
  const innerW = W - PAD.l - PAD.r, innerH = H - PAD.t - PAD.b;

  const xs = [50, 100, 200, 400, 800, 1600];
  const series = [
    { name: 'TabDDPM (ours)', vals: [4.62, 4.18, 3.89, 3.71, 3.62, 3.59], color: 'var(--accent)' },
    { name: 'CTGAN',           vals: [5.41, 5.21, 5.10, 5.04, 5.02, 5.02], color: 'var(--ink-3)' },
    { name: 'TVAE',            vals: [5.18, 4.94, 4.79, 4.71, 4.66, 4.65], color: 'var(--ink)' },
  ];
  const xMin = Math.log2(xs[0]), xMax = Math.log2(xs[xs.length - 1]);
  const yMin = 3.4, yMax = 5.6;
  const sx = (v) => PAD.l + ((Math.log2(v) - xMin) / (xMax - xMin)) * innerW;
  const sy = (v) => PAD.t + (1 - (v - yMin) / (yMax - yMin)) * innerH;
  const path = (vals) => vals.map((v, i) => `${i ? 'L' : 'M'} ${sx(xs[i]).toFixed(1)} ${sy(v).toFixed(1)}`).join(' ');

  const yTicks = [3.5, 4.0, 4.5, 5.0, 5.5];

  return (
    <ChartFrame width={W} height={H}>
      <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke="var(--ink)" strokeWidth="1.2" />
      <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} stroke="var(--ink)" strokeWidth="1.2" />
      {yTicks.map((t) => (
        <line key={t} x1={PAD.l} y1={sy(t)} x2={W - PAD.r} y2={sy(t)} stroke="var(--rule-soft)" strokeWidth="1" />
      ))}
      {yTicks.map((t) => (
        <text key={t} x={PAD.l - 12} y={sy(t) + 5} textAnchor="end" fontFamily="var(--mono)" fontSize="20" fill="var(--ink-3)">{t.toFixed(1)}</text>
      ))}
      {xs.map((x) => (
        <text key={x} x={sx(x)} y={H - PAD.b + 28} textAnchor="middle" fontFamily="var(--mono)" fontSize="20" fill="var(--ink-3)">{x}</text>
      ))}
      <text x={PAD.l + innerW / 2} y={H - 8} textAnchor="middle" fontFamily="var(--mono)" fontSize="22" fill="var(--ink-3)" letterSpacing="0.04em">DIFFUSION STEPS T</text>
      <text x={24} y={PAD.t + innerH / 2} textAnchor="middle" fontFamily="var(--mono)" fontSize="22" fill="var(--ink-3)" letterSpacing="0.04em"
            transform={`rotate(-90, 24, ${PAD.t + innerH / 2})`}>TEST NLL</text>
      {series.map((s, si) => (
        <g key={si}>
          <path d={path(s.vals)} fill="none" stroke={s.color}
                strokeWidth={si === 0 ? 2.4 : 1.8}
                strokeDasharray={si === 1 ? '6 4' : si === 2 ? '2 4' : 'none'} />
          {xs.map((x, i) => (
            <circle key={i} cx={sx(x)} cy={sy(s.vals[i])} r={si === 0 ? 5 : 3.5}
                    fill={si === 0 ? s.color : 'var(--bg)'} stroke={s.color} strokeWidth={si === 0 ? 0 : 1.6} />
          ))}
          <text x={sx(xs[xs.length - 1]) + 14} y={sy(s.vals[s.vals.length - 1]) + 5}
                fontFamily="var(--mono)" fontSize="20" fill={s.color}>{s.name}</text>
        </g>
      ))}
      <line x1={sx(200)} y1={PAD.t} x2={sx(200)} y2={H - PAD.b}
            stroke="var(--ink)" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
      <text x={sx(200)} y={PAD.t - 8} textAnchor="middle" fontFamily="var(--mono)" fontSize="18"
            fill="var(--ink-3)">T* = 200</text>
    </ChartFrame>
  );
}

// Per-column marginal distributions
export function DistChart({ variant = 'swiss' }) {
  const W = 1720, H = 340;
  const cols = [
    {
      name: 'age', type: 'continuous',
      real:  [2, 4, 9, 14, 18, 16, 13, 10, 7, 4, 2, 1],
      synth: [2, 5, 10, 13, 17, 17, 14, 9, 7, 4, 2, 0],
    },
    {
      name: 'education', type: 'categorical',
      labels: ['HS', 'Some', 'Assoc', 'BS', 'MS', 'PhD'],
      real:  [32, 18, 11, 22, 12, 5],
      synth: [30, 19, 12, 23, 11, 5],
    },
    {
      name: 'income', type: 'categorical',
      labels: ['<=50K', '>50K'],
      real:  [76, 24],
      synth: [75, 25],
    },
  ];
  const colW = W / cols.length;
  const PAD = { t: 40, r: 20, b: 60, l: 60 };
  const innerH = H - PAD.t - PAD.b;
  return (
    <ChartFrame width={W} height={H}>
      {cols.map((col, ci) => {
        const ox = ci * colW;
        const maxVal = Math.max(...col.real, ...col.synth);
        const sy = (v) => PAD.t + (1 - v / maxVal) * innerH;
        const innerW = colW - PAD.l - PAD.r;
        const n = col.real.length;
        const bw = innerW / n - 4;
        const bx = (i) => PAD.l + i * (innerW / n) + 2;
        return (
          <g key={ci} transform={`translate(${ox}, 0)`}>
            <text x={PAD.l + innerW / 2} y={16} textAnchor="middle"
                  fontFamily="var(--mono)" fontSize="22" fill="var(--ink-3)" letterSpacing="0.04em">{col.name.toUpperCase()}</text>
            <line x1={PAD.l} y1={H - PAD.b} x2={PAD.l + innerW} y2={H - PAD.b} stroke="var(--ink)" strokeWidth="1.2" />
            <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} stroke="var(--ink)" strokeWidth="1.2" />
            {col.real.map((v, i) => (
              <rect key={'r' + i} x={bx(i)} y={sy(v)} width={bw} height={H - PAD.b - sy(v)}
                    fill="var(--ink)" opacity="0.18" />
            ))}
            {col.synth.map((v, i) => (
              <rect key={'s' + i} x={bx(i) + 1} y={sy(v)} width={bw - 2} height={H - PAD.b - sy(v)}
                    fill="none" stroke="var(--accent)" strokeWidth="2" />
            ))}
            {col.type === 'categorical' && col.labels?.map((l, i) => (
              <text key={'l' + i} x={bx(i) + bw / 2} y={H - PAD.b + 22}
                    textAnchor="middle" fontFamily="var(--mono)" fontSize="16" fill="var(--ink-3)">{l}</text>
            ))}
            {ci === 0 && (
              <g>
                <rect x={PAD.l} y={PAD.t - 4} width={14} height={12} fill="var(--ink)" opacity="0.25" />
                <text x={PAD.l + 20} y={PAD.t + 6} fontFamily="var(--mono)" fontSize="18" fill="var(--ink-3)">real</text>
                <rect x={PAD.l + 72} y={PAD.t - 4} width={14} height={12} fill="none" stroke="var(--accent)" strokeWidth="2" />
                <text x={PAD.l + 92} y={PAD.t + 6} fontFamily="var(--mono)" fontSize="18" fill="var(--ink-3)">synth</text>
              </g>
            )}
          </g>
        );
      })}
    </ChartFrame>
  );
}

// Architecture overview (static SVG)
export function ArchDiagram() {
  return (
    <svg viewBox="0 0 1600 480" width="100%" height="100%" style={{ display: 'block' }}>
      <g transform="translate(40, 180)">
        <text x={0} y={-22} fontFamily="var(--mono)" fontSize={20} fill="var(--ink-3)" letterSpacing="0.04em">INPUT</text>
        {[0,1,2,3,4].map(i => (
          <g key={i} transform={`translate(0, ${i * 30})`}>
            <rect width={110} height={24} fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.2} />
            <text x={55} y={16} fontFamily="var(--mono)" fontSize={14} fill="var(--ink)" textAnchor="middle">[MASK]</text>
          </g>
        ))}
      </g>
      <path d="M 170 292 H 230" stroke="var(--ink)" strokeWidth={1.4} />
      <g transform="translate(230, 232)">
        <rect width={120} height={120} fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.5} />
        <text x={60} y={58} fontFamily="var(--sans)" fontSize={20} fontWeight={600} fill="var(--ink)" textAnchor="middle">Embed</text>
        <text x={60} y={82} fontFamily="var(--mono)" fontSize={13} fill="var(--ink-3)" textAnchor="middle">+ time t</text>
      </g>
      {[0,1,2,3].map(i => (
        <g key={i}>
          <path d={`M ${350 + i * 170} 292 H ${390 + i * 170}`} stroke="var(--ink)" strokeWidth={1.2} />
          <g transform={`translate(${390 + i * 170}, 202)`}>
            <rect width={150} height={180} fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.6} />
            <rect width={150} height={5} y={-5} fill="var(--ink)" />
            <text x={75} y={82} fontFamily="var(--sans)" fontSize={19} fontWeight={600} fill="var(--ink)" textAnchor="middle">Block {i+1}</text>
            <text x={75} y={106} fontFamily="var(--mono)" fontSize={12} fill="var(--ink-3)" textAnchor="middle">attn + mlp</text>
          </g>
        </g>
      ))}
      <path d="M 1070 292 H 1130" stroke="var(--ink)" strokeWidth={1.4} />
      <g transform="translate(1130, 120)">
        <text x={0} y={-14} fontFamily="var(--mono)" fontSize={18} fill="var(--ink-3)" letterSpacing="0.04em">HEADS</text>
        {[0,1,2,3,4].map(i => (
          <g key={i} transform={`translate(0, ${i * 58})`}>
            <rect width={180} height={44} fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.2} />
            <text x={16} y={27} fontFamily="var(--mono)" fontSize={14} fill="var(--ink)">{`col_${i}: K-way`}</text>
          </g>
        ))}
      </g>
      <path d="M 1310 292 H 1370" stroke="var(--ink)" strokeWidth={1.4} />
      <g transform="translate(1370, 182)">
        <text x={0} y={-22} fontFamily="var(--mono)" fontSize={18} fill="var(--ink-3)" letterSpacing="0.04em">x̂₀</text>
        {[0,1,2,3,4].map(i => (
          <g key={i} transform={`translate(0, ${i * 30})`}>
            <rect width={130} height={24} fill="var(--bg-2)" stroke="var(--accent)" strokeWidth={1.4} />
          </g>
        ))}
      </g>
    </svg>
  );
}
