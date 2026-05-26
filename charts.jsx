// Charts.jsx — small SVG chart kit, theme-aware via CSS vars
// Each chart reads --ink, --accent, --accent-2, --rule-soft from its container.

const ChartFrame = ({ width = 1100, height = 480, padding = { t: 30, r: 40, b: 60, l: 70 }, children, style }) => (
  <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ display: 'block', ...style }}>
    {children}
  </svg>
);

// Sample-quality line chart: NLL vs diffusion steps, with annotation
function NLLChart({ variant = 'editorial' }) {
  const W = 1100, H = 460;
  const PAD = { t: 28, r: 280, b: 80, l: 100 };
  const innerW = W - PAD.l - PAD.r, innerH = H - PAD.t - PAD.b;

  // synthetic data — three methods over diffusion timesteps T
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
      {/* axes */}
      <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke="var(--ink)" strokeWidth="1.2" />
      <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} stroke="var(--ink)" strokeWidth="1.2" />

      {/* horizontal gridlines */}
      {yTicks.map((t) => (
        <line key={t} x1={PAD.l} y1={sy(t)} x2={W - PAD.r} y2={sy(t)} stroke="var(--rule-soft)" strokeWidth="1" />
      ))}

      {/* y-tick labels */}
      {yTicks.map((t) => (
        <text key={t} x={PAD.l - 14} y={sy(t) + 6} textAnchor="end"
          style={{ fontFamily: 'var(--mono, monospace)', fontSize: 24, fill: 'var(--ink-3)' }}>
          {t.toFixed(1)}
        </text>
      ))}

      {/* x-tick labels */}
      {xs.map((x) => (
        <g key={x}>
          <line x1={sx(x)} y1={H - PAD.b} x2={sx(x)} y2={H - PAD.b + 6} stroke="var(--ink)" strokeWidth="1.2" />
          <text x={sx(x)} y={H - PAD.b + 32} textAnchor="middle"
            style={{ fontFamily: 'var(--mono, monospace)', fontSize: 24, fill: 'var(--ink-3)' }}>
            {x}
          </text>
        </g>
      ))}

      {/* series */}
      {series.map((s, i) => (
        <g key={s.name}>
          <path d={path(s.vals)} fill="none" stroke={s.color}
            strokeWidth={i === 0 ? 3.5 : 2}
            strokeDasharray={i === 0 ? 'none' : i === 1 ? '6 6' : '2 5'}
            strokeLinecap="round" strokeLinejoin="round" />
          {s.vals.map((v, j) => (
            <circle key={j} cx={sx(xs[j])} cy={sy(v)} r={i === 0 ? 5 : 3.5}
              fill={i === 0 ? s.color : 'var(--bg)'}
              stroke={s.color} strokeWidth="2" />
          ))}
          {/* end-of-line label */}
          <text x={sx(xs[xs.length - 1]) + 14} y={sy(s.vals[s.vals.length - 1]) + 6}
            style={{ fontFamily: 'var(--sans, sans-serif)', fontSize: 24, fontWeight: i === 0 ? 600 : 500, fill: s.color }}>
            {s.name}
          </text>
        </g>
      ))}

      {/* axis titles */}
      <text x={W / 2} y={H - 8} textAnchor="middle"
        style={{ fontFamily: 'var(--sans, sans-serif)', fontSize: 24, fill: 'var(--ink-2)', fontStyle: variant === 'classic' ? 'italic' : 'normal' }}>
        diffusion steps  T
      </text>
      <text transform={`rotate(-90, ${22}, ${H / 2})`} x={22} y={H / 2} textAnchor="middle"
        style={{ fontFamily: 'var(--sans, sans-serif)', fontSize: 24, fill: 'var(--ink-2)', fontStyle: variant === 'classic' ? 'italic' : 'normal' }}>
        test NLL  (nats)
      </text>

      {/* annotation callout for ours */}
      {variant !== 'classic' && (
        <g>
          <line x1={sx(800) + 8} y1={sy(3.62) - 8} x2={sx(800) + 90} y2={sy(3.62) - 60}
            stroke="var(--accent)" strokeWidth="1.2" />
          <circle cx={sx(800) + 90} cy={sy(3.62) - 60} r="3" fill="var(--accent)" />
          <text x={sx(800) + 100} y={sy(3.62) - 56}
            style={{ fontFamily: 'var(--mono, monospace)', fontSize: 24, fill: 'var(--accent)', fontWeight: 600 }}>
            −1.06 nats vs TVAE
          </text>
        </g>
      )}
    </ChartFrame>
  );
}

// Distribution comparison: real vs generated histograms (3 features)
function DistChart({ variant }) {
  const features = [
    { name: 'age',       real: [4, 12, 22, 28, 24, 18, 11, 6, 3], gen: [5, 13, 21, 27, 25, 17, 12, 7, 3] },
    { name: 'income',    real: [18, 28, 22, 14, 8, 4, 3, 2, 1],   gen: [16, 26, 24, 15, 9, 4, 3, 2, 1] },
    { name: 'education', real: [6, 8, 14, 30, 24, 12, 4, 2, 0],   gen: [7, 9, 15, 28, 23, 13, 4, 1, 0] },
  ];
  const W = 1140, H = 360;
  const cellW = (W - 60) / 3;
  const padT = 36, padB = 60;

  return (
    <ChartFrame width={W} height={H}>
      {features.map((f, i) => {
        const x0 = 30 + i * cellW;
        const innerW = cellW - 30;
        const innerH = H - padT - padB;
        const max = Math.max(...f.real, ...f.gen);
        const bw = innerW / f.real.length;
        return (
          <g key={f.name}>
            <text x={x0 + 8} y={padT - 12}
              style={{ fontFamily: 'var(--mono, monospace)', fontSize: 24, fill: 'var(--ink-3)' }}>
              {f.name}
            </text>
            <line x1={x0 + 8} y1={H - padB} x2={x0 + innerW + 8} y2={H - padB} stroke="var(--ink)" strokeWidth="1" />
            {f.real.map((v, j) => {
              const h = (v / max) * innerH;
              const xb = x0 + 8 + j * bw;
              return (
                <g key={j}>
                  <rect x={xb + 2} y={H - padB - h} width={bw - 4} height={h}
                    fill="var(--ink)" opacity="0.18" />
                  {/* generated overlay outline */}
                  {(() => {
                    const gh = (f.gen[j] / max) * innerH;
                    return <rect x={xb + 2} y={H - padB - gh} width={bw - 4} height={gh}
                      fill="none" stroke="var(--accent)" strokeWidth="2" />;
                  })()}
                </g>
              );
            })}
          </g>
        );
      })}
      {/* legend */}
      <g transform={`translate(${W - 340}, ${H - 26})`}>
        <rect x="0" y="-12" width="16" height="14" fill="var(--ink)" opacity="0.18" />
        <text x="22" y="0" style={{ fontFamily: 'var(--sans, sans-serif)', fontSize: 24, fill: 'var(--ink-2)' }}>real</text>
        <rect x="100" y="-12" width="16" height="14" fill="none" stroke="var(--accent)" strokeWidth="2" />
        <text x="122" y="0" style={{ fontFamily: 'var(--sans, sans-serif)', fontSize: 24, fill: 'var(--ink-2)' }}>generated  (ours)</text>
      </g>
    </ChartFrame>
  );
}

// Architecture diagram — encoder-style boxes with arrows
function ArchDiagram() {
  const W = 1240, H = 460;
  const box = (x, y, w, h, label, sub, fill = 'var(--bg-2)') => (
    <g key={label}>
      <rect x={x} y={y} width={w} height={h} fill={fill} stroke="var(--ink)" strokeWidth="1.4" />
      <text x={x + w / 2} y={y + h / 2 - (sub ? 4 : -8)} textAnchor="middle"
        style={{ fontFamily: 'var(--sans, sans-serif)', fontSize: 26, fontWeight: 600, fill: 'var(--ink)' }}>
        {label}
      </text>
      {sub && (
        <text x={x + w / 2} y={y + h / 2 + 24} textAnchor="middle"
          style={{ fontFamily: 'var(--mono, monospace)', fontSize: 24, fill: 'var(--ink-3)' }}>
          {sub}
        </text>
      )}
    </g>
  );
  const arrow = (x1, y1, x2, y2, k) => (
    <g key={k}>
      <line x1={x1} y1={y1} x2={x2 - 8} y2={y2} stroke="var(--ink)" strokeWidth="1.4" />
      <polygon points={`${x2},${y2} ${x2 - 10},${y2 - 5} ${x2 - 10},${y2 + 5}`} fill="var(--ink)" />
    </g>
  );
  return (
    <ChartFrame width={W} height={H}>
      {/* discrete tokens (top row) */}
      <text x={70} y={50} style={{ fontFamily: 'var(--mono, monospace)', fontSize: 24, fill: 'var(--ink-3)' }}>x_t  ∈  {`{1, … , K}^d`}</text>
      {[0,1,2,3,4,5,6,7].map((i) => (
        <g key={i}>
          <rect x={70 + i * 56} y={70} width={50} height={50} fill="var(--tint)" stroke="var(--ink)" strokeWidth="1.2" />
          <text x={95 + i * 56} y={102} textAnchor="middle"
            style={{ fontFamily: 'var(--mono, monospace)', fontSize: 22, fill: 'var(--ink)' }}>
            {['3','7','1','2','5','4','6','0'][i]}
          </text>
        </g>
      ))}
      <text x={580} y={102} style={{ fontFamily: 'var(--mono, monospace)', fontSize: 22, fill: 'var(--ink-3)' }}>+  t</text>

      {arrow(380, 145, 380, 175, 'a1')}

      {box(140, 180, 480, 76, 'Token + Time Embedding', 'd → 256', 'var(--bg-2)')}
      {arrow(380, 256, 380, 286, 'a2')}

      {box(100, 290, 560, 90, 'Transformer Encoder × 6', 'd_model = 512,  heads = 8')}
      {arrow(380, 380, 380, 410, 'a3')}

      {box(180, 414, 400, 36, 'softmax over K classes', null)}

      {/* loss path on right */}
      {box(720, 180, 460, 76, 'Cross-entropy Loss  L_t', 'against x_0', 'var(--bg-2)')}
      {arrow(660, 218, 720, 218, 'a4')}

      {box(720, 290, 460, 90, 'Categorical Reverse Step', 'p_θ(x_{t-1} | x_t)')}
      {arrow(660, 335, 720, 335, 'a5')}

      <text x={950} y={420} textAnchor="middle"
        style={{ fontFamily: 'var(--sans, sans-serif)', fontSize: 24, fill: 'var(--accent)', fontWeight: 600 }}>
        absorbing-state transition matrix  Q_t
      </text>
    </ChartFrame>
  );
}

Object.assign(window, { NLLChart, DistChart, ArchDiagram });
