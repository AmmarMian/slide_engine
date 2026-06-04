// spd-domains.jsx — three-panel motivational island for "where SPD matrices appear":
// EEG (BCI), hyperspectral imagery, SAR SITS. Each panel: stylised data on top,
// resulting covariance heatmap below. Pure SVG, no external dependencies.

import React, { useMemo } from 'react';

// ── Deterministic PRNG (mulberry32) so renders are stable ─────────────────
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Synthetic dataset generators ──────────────────────────────────────────
// Each returns an n×d matrix of observations from which we compute the d×d covariance.

function eegSignals(d = 8, n = 220, seed = 7) {
  // Multivariate "alpha + noise" — a couple of latent oscillations shared across channels
  const r = rng(seed);
  const phases = Array.from({ length: 3 }, () => r() * Math.PI * 2);
  const mix = Array.from({ length: d }, () => Array.from({ length: 3 }, () => r() * 2 - 1));
  const X = [];
  for (let t = 0; t < n; t++) {
    const lat = [
      Math.sin(2 * Math.PI * 0.05 * t + phases[0]),
      Math.sin(2 * Math.PI * 0.12 * t + phases[1]),
      Math.sin(2 * Math.PI * 0.20 * t + phases[2]),
    ];
    const row = new Array(d);
    for (let c = 0; c < d; c++) {
      row[c] = mix[c][0] * lat[0] + mix[c][1] * lat[1] + mix[c][2] * lat[2] + (r() - 0.5) * 0.4;
    }
    X.push(row);
  }
  return X;
}

function hsiPixels(d = 8, n = 220, seed = 19) {
  // Hyperspectral — neighbouring bands strongly correlated, with two material clusters
  const r = rng(seed);
  const X = [];
  for (let i = 0; i < n; i++) {
    const cluster = r() > 0.5 ? 1 : -1;
    const smooth = Array.from({ length: d }, (_, k) => cluster * (1 - Math.abs(k - d / 2) / d) + (r() - 0.5) * 0.5);
    // smooth across bands (moving average)
    for (let k = 1; k < d; k++) smooth[k] = 0.6 * smooth[k] + 0.4 * smooth[k - 1];
    X.push(smooth);
  }
  return X;
}

function sarSits(d = 8, n = 220, seed = 31) {
  // SAR Satellite Image Time Series — d temporal acquisitions, n pixels in a spatial window.
  // Pixels have seasonal backscatter modulation; some pixels undergo a change event.
  const r = rng(seed);
  const X = [];
  for (let i = 0; i < n; i++) {
    const isVegetation = r() > 0.4;
    const base    = isVegetation ? 0.25 + r() * 0.2 : 0.55 + r() * 0.25;
    const season  = isVegetation ? 0.22 : 0.06;
    const phase   = r() * Math.PI * 2;
    const hasChange = r() > 0.72;
    const changeAt  = hasChange ? Math.floor(r() * (d - 1)) + 1 : -1;
    const changeMag = (r() > 0.5 ? 1 : -1) * (0.2 + r() * 0.25);
    const row = Array.from({ length: d }, (_, t) => {
      const s = season * Math.sin(2 * Math.PI * t / d + phase);
      const c = hasChange && t >= changeAt ? changeMag : 0;
      return base + s + c + (r() - 0.5) * 0.1;
    });
    X.push(row);
  }
  return X;
}

// ── Covariance estimator ──────────────────────────────────────────────────
function covariance(X) {
  const n = X.length, d = X[0].length;
  const mean = new Array(d).fill(0);
  for (const row of X) for (let k = 0; k < d; k++) mean[k] += row[k];
  for (let k = 0; k < d; k++) mean[k] /= n;
  const C = Array.from({ length: d }, () => new Array(d).fill(0));
  for (const row of X) {
    for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) {
      C[i][j] += (row[i] - mean[i]) * (row[j] - mean[j]);
    }
  }
  for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) C[i][j] /= n - 1;
  return C;
}

// ── Signal plot (stacked traces) ──────────────────────────────────────────
function SignalPlot({ X, width, height, color }) {
  const n = X.length;
  const d = X[0].length;
  const traces = useMemo(() => {
    return Array.from({ length: d }, (_, c) => {
      const col = X.map(r => r[c]);
      const yMin = Math.min(...col), yMax = Math.max(...col);
      const range = yMax - yMin || 1;
      const trackH = height / d;
      const yBase = c * trackH + trackH / 2;
      const amp = trackH * 0.35;
      const path = col.map((v, i) => {
        const x = (i / (n - 1)) * width;
        const y = yBase - ((v - (yMin + yMax) / 2) / range) * 2 * amp;
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      }).join(' ');
      return path;
    });
  }, [X, width, height]);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none"
         style={{ display: 'block', width: '100%', height: '100%' }}>
      {traces.map((p, i) => (
        <path key={i} d={p} stroke={color} strokeWidth="1.5" fill="none" opacity={0.55 + (i / traces.length) * 0.4} />
      ))}
    </svg>
  );
}

// ── HSI cube panel (false-color band slices) ──────────────────────────────
function HsiCube({ X, width, height, color }) {
  const d = X[0].length;
  const bandW = width / d;
  const stripeH = height;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none"
         style={{ display: 'block', width: '100%', height: '100%' }}>
      {Array.from({ length: d }, (_, k) => {
        const intensity = X.reduce((s, r) => s + Math.abs(r[k]), 0) / X.length;
        const norm = Math.min(1, intensity / 1.5);
        return (
          <rect key={k}
            x={k * bandW} y={0} width={bandW - 1} height={stripeH}
            fill={color}
            opacity={0.18 + norm * 0.7}
          />
        );
      })}
    </svg>
  );
}

// ── SAR SITS space-time raster (pixels × time acquisitions) ──────────────
function SarPanel({ X, width, height, color }) {
  const T = X[0].length;
  const showN = Math.min(X.length, 36);
  const axisH = 22;
  const plotH = height - axisH;
  const colW = width / T;
  const rowH = plotH / showN;

  let vMin = Infinity, vMax = -Infinity;
  for (let i = 0; i < showN; i++)
    for (let t = 0; t < T; t++) {
      if (X[i][t] < vMin) vMin = X[i][t];
      if (X[i][t] > vMax) vMax = X[i][t];
    }
  const range = vMax - vMin || 1;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none"
         style={{ display: 'block', width: '100%', height: '100%' }}>
      {Array.from({ length: showN }, (_, i) =>
        Array.from({ length: T }, (_, t) => {
          const norm = (X[i][t] - vMin) / range;
          return (
            <rect key={`${i}-${t}`}
              x={t * colW} y={i * rowH}
              width={colW - 0.4} height={rowH - 0.2}
              fill={color} opacity={0.07 + norm * 0.88}
            />
          );
        })
      )}
      {/* Time axis labels */}
      {Array.from({ length: T }, (_, t) => (
        <text key={t}
          x={(t + 0.5) * colW} y={plotH + axisH - 4}
          textAnchor="middle" fontSize="11" fill="var(--ink-3)"
          fontFamily="var(--mono)">t{t + 1}</text>
      ))}
      {/* Divider line */}
      <line x1={0} y1={plotH} x2={width} y2={plotH} stroke="var(--rule-soft)" strokeWidth="0.8" />
    </svg>
  );
}

// ── Covariance heatmap ────────────────────────────────────────────────────
function CovHeatmap({ C, width, height, color }) {
  const d = C.length;
  const cw = width / d;
  const ch = height / d;
  let absMax = 0;
  for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) absMax = Math.max(absMax, Math.abs(C[i][j]));
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      {C.flatMap((row, i) => row.map((v, j) => {
        const norm = absMax > 0 ? v / absMax : 0; // -1..1
        const op = Math.min(1, Math.abs(norm));
        const fill = norm >= 0 ? color : 'rgba(40,40,40,0.55)';
        return (
          <rect key={`${i}-${j}`} x={j * cw} y={i * ch} width={cw - 0.4} height={ch - 0.4} fill={fill} opacity={op} />
        );
      }))}
      {/* Outer frame */}
      <rect x={0} y={0} width={width} height={height} fill="none" stroke="var(--rule-soft, rgba(0,0,0,0.15))" />
    </svg>
  );
}

// ── Single domain panel ───────────────────────────────────────────────────
function DomainPanel({ title, kicker, covLabel, X, Visual }) {
  const C = useMemo(() => covariance(X), [X]);
  const accent = 'var(--accent)';
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      padding: 20,
      gap: 14,
      background: 'var(--bg-2)',
      border: '1px solid var(--rule-soft)',
      borderRadius: 8,
      minHeight: 0,
    }}>
      {/* Header — compact */}
      <div>
        <div className="eyebrow" style={{ color: accent, fontSize: 13, marginBottom: 2, letterSpacing: '0.06em' }}>{kicker}</div>
        <div style={{ fontFamily: 'var(--sans)', fontSize: 30, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.025em', lineHeight: 1 }}>{title}</div>
      </div>

      {/* Signal viz — takes major flex share */}
      <div style={{
        flex: 2.2, minHeight: 0,
        background: 'var(--bg)', borderRadius: 4, overflow: 'hidden',
        border: '1px solid var(--rule-soft)',
        display: 'flex',
      }}>
        <Visual X={X} width={500} height={300} color={accent} />
      </div>

      {/* Arrow — small */}
      <div style={{ textAlign: 'center', color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '-4px 0' }}>
        ↓ &nbsp; covariance &nbsp; ↓
      </div>

      {/* Cov heatmap — also flex, label inline above */}
      <div style={{ flex: 1.4, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="label" style={{ fontSize: 12, lineHeight: 1.2 }}>{covLabel}</div>
        <div style={{
          flex: 1, minHeight: 0,
          background: 'var(--bg)', borderRadius: 4, overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ height: '100%', aspectRatio: '1/1' }}>
            <CovHeatmap C={C} width={200} height={200} color={accent} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main island ────────────────────────────────────────────────────────────
export function SpdDomains() {
  const eeg = useMemo(() => eegSignals(8, 200, 7), []);
  const hsi = useMemo(() => hsiPixels(8, 200, 19), []);
  const sar = useMemo(() => sarSits(8, 200, 31), []);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 32,
      height: '100%',
      alignItems: 'stretch',
    }}>
      <DomainPanel
        kicker="Interfaces cerveau-machine"
        title="EEG"
        dataLabel="Signaux multi-canaux"
        covLabel="Covariance spatiale entre canaux"
        X={eeg}
        Visual={SignalPlot}
      />
      <DomainPanel
        kicker="Imagerie hyperspectrale"
        title="Hyperspectral"
        dataLabel="Cube de bandes spectrales"
        covLabel="Covariance entre bandes"
        X={hsi}
        Visual={({ X, width, height, color }) => <HsiCube X={X} width={width} height={height} color={color} />}
      />
      <DomainPanel
        kicker="Séries temporelles SAR"
        title="SAR SITS"
        dataLabel="Rétrodiffusion par acquisition"
        covLabel="Covariance temporelle T×T"
        X={sar}
        Visual={({ X, width, height, color }) => <SarPanel X={X} width={width} height={height} color={color} />}
      />
    </div>
  );
}
