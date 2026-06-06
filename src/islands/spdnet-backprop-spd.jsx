// spdnet-backprop-spd.jsx — SPDNet-specific eigenvalue-sensitive backpropagation
// animation. Shows the K-matrix correction that distinguishes SPDNet from naive
// Euclidean backprop through spectral layers (ReEig, LogEig).
//
// Phases: overview → fwd BiMap → fwd ReEig → fwd LogEig → loss →
//         bwd LogEig (KEY: K matrix) → bwd ReEig → bwd BiMap

import React, { useState, useEffect, useRef } from 'react';
import katex from 'katex';

// ── KaTeX helpers ──────────────────────────────────────────────────────────────
const tex = (s, d = false) => katex.renderToString(s, { throwOnError: false, displayMode: d });
const Tex  = ({ s }) => <span dangerouslySetInnerHTML={{ __html: tex(s) }} />;
const TexD = ({ s }) => <div  dangerouslySetInnerHTML={{ __html: tex(s, true) }} style={{ fontSize: 13 }} />;

// ── Precomputed data (3→2 dimensional SPDNet) ──────────────────────────────────
// Σ₀ ∈ S++(3), W ∈ St(2,3), Σ₁ = WΣ₀Wᵀ ∈ S++(2)
// ReEig with ε=0.1 is a no-op here (both λ > ε)
// LogEig: S = U log(Λ) Uᵀ
const D = {
  Σ0:    [[2.00, 0.60, 0.20], [0.60, 1.80, 0.40], [0.20, 0.40, 1.20]],
  W:     [[0.87, 0.50, 0.00], [-0.50, 0.87, 0.00]],
  Σ1:    [[2.47, 0.21], [0.21, 1.33]],
  U:     [[0.98, -0.18], [0.18,  0.98]],
  Λ:     [[2.51, 0.00], [0.00,  1.29]],
  Σ2:    [[2.47, 0.21], [0.21,  1.33]],   // = Σ₁ (ReEig no-op)
  logΛ:  [[0.92, 0.00], [0.00,  0.26]],
  S:     [[0.90, 0.12], [0.12,  0.28]],
  // Backward
  Klog:  [[0.40, 0.55], [0.55,  0.77]],   // K for LogEig
  Kre:   [[0.40, 0.00], [0.00,  0.77]],   // K for ReEig (diagonal: both λ > ε)
  dS:    [[ 0.52,  0.18], [ 0.18, -0.31]], // ∂L/∂S from FC
  G:     [[ 0.51,  0.13], [ 0.13, -0.28]], // G = Uᵀ (∂L/∂S) U
  KlogG: [[ 0.20,  0.07], [ 0.07, -0.22]], // Klog ⊙ G
  dΣ2:   [[ 0.19,  0.08], [ 0.08, -0.21]], // U (Klog ⊙ G) Uᵀ = ∂L/∂Σ₂
  dΣ1:   [[ 0.19,  0.08], [ 0.08, -0.21]], // ∂L/∂Σ₁ (same here)
  dW:    [[ 0.65,  0.40,  0.08], [-0.29,  0.18, -0.04]],
  dΣ0:   [[ 0.18,  0.13,  0.03], [ 0.13,  0.08, -0.02], [ 0.03, -0.02, -0.11]],
};

// ── Color scales ───────────────────────────────────────────────────────────────
const cl = (a, b, t) => Math.round(a + (b - a) * Math.max(0, Math.min(1, t)));
const spdC  = (v, vm = 2.55) => { const t = Math.abs(v) / vm; return `rgb(${cl(248,31,t)},${cl(244,119,t)},${cl(240,180,t)})`; };
const gradC = (v, vm = 0.55) => { const t = v / vm; return t >= 0 ? `rgb(${cl(248,31,t)},${cl(244,119,t)},${cl(240,180,t)})` : `rgb(${cl(248,214,-t)},${cl(244,39,-t)},${cl(240,40,-t)})`; };
const kC    = (v, vm = 0.8)  => { const t = v / vm; return `rgb(${cl(248,148,t)},${cl(244,103,t)},${cl(240,189,t)})`; };
const eigC  = (v, vm = 2.55) => { const t = Math.abs(v) / vm; return `rgb(${cl(248,200,t)},${cl(244,120,t)},${cl(240,20,t)})`; };
const orthoC= (v, vm = 1.0)  => { const t = v / vm; return t >= 0 ? `rgb(${cl(248,70,t)},${cl(244,130,t)},${cl(240,200,t)})` : `rgb(${cl(248,200,-t)},${cl(244,230,-t)},${cl(240,250,-t)})`; };

// ── MatGrid ────────────────────────────────────────────────────────────────────
function MatGrid({ mat, colorFn = spdC, cell = 46, vmax, glow = false, glowColor = 'var(--accent)', showVals = true }) {
  const vm = vmax ?? Math.max(...mat.flat().map(Math.abs), 0.01);
  const n = mat.length, m = mat[0].length;
  return (
    <div style={{
      display: 'inline-grid',
      gridTemplateColumns: `repeat(${m}, ${cell}px)`,
      gridTemplateRows: `repeat(${n}, ${cell}px)`,
      borderRadius: 4, overflow: 'hidden',
      outline: glow ? `2px solid ${glowColor}` : '1px solid var(--rule)',
      boxShadow: glow ? `0 0 0 5px ${glowColor}26` : 'none',
      flexShrink: 0,
    }}>
      {mat.map((row, i) => row.map((v, j) => {
        const bg = colorFn(v, vm);
        const [r, g, b] = (bg.match(/\d+/g) || []).map(Number);
        const lum = 0.3 * r + 0.59 * g + 0.11 * b;
        return (
          <div key={`${i}${j}`} style={{
            width: cell, height: cell, background: bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--mono)', fontSize: Math.round(cell * 0.27),
            color: lum < 148 ? 'rgba(255,255,255,0.92)' : 'rgba(15,15,15,0.78)',
            borderRight: j < m - 1 ? '0.5px solid rgba(0,0,0,0.07)' : 'none',
            borderBottom: i < n - 1 ? '0.5px solid rgba(0,0,0,0.07)' : 'none',
          }}>
            {showVals ? (v === 0 ? '0' : (v > 0 ? ' ' : '') + v.toFixed(2)) : null}
          </div>
        );
      }))}
    </div>
  );
}

function LM({ label, mat, colorFn, cell = 48, vmax, glow = false, glowColor }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, flexShrink: 0 }}>
      {label && <div style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--ink-2)' }}><Tex s={label} /></div>}
      <MatGrid mat={mat} colorFn={colorFn} cell={cell} vmax={vmax} glow={glow} glowColor={glowColor} />
    </div>
  );
}

// ── Operator ───────────────────────────────────────────────────────────────────
function Op({ label, sub, color = 'var(--ink-3)', big = false }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      width: big ? 100 : 72, flexShrink: 0,
      fontFamily: 'var(--mono)', color, gap: 2,
    }}>
      <div style={{ fontSize: big ? 22 : 18, fontWeight: 700 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, opacity: 0.7 }}><Tex s={sub} /></div>}
    </div>
  );
}

// ── Mini pipeline matrix (thumbnail) ──────────────────────────────────────────
function PipeMat({ mat, colorFn = spdC, active = false, fwd = true }) {
  const cell = mat.length === 3 ? 20 : 24;
  const col = fwd ? '#1f77b4' : 'var(--accent)';
  return (
    <div style={{
      display: 'inline-grid',
      gridTemplateColumns: `repeat(${mat[0].length}, ${cell}px)`,
      gridTemplateRows: `repeat(${mat.length}, ${cell}px)`,
      borderRadius: 3, overflow: 'hidden',
      outline: active ? `2px solid ${col}` : '1px solid var(--rule)',
      boxShadow: active ? `0 0 0 4px ${col}22` : 'none',
      opacity: active ? 1 : 0.55,
      transition: 'all 0.35s ease',
    }}>
      {mat.map((row, i) => row.map((v, j) => (
        <div key={`${i}${j}`} style={{ width: cell, height: cell, background: colorFn(v) }} />
      )))}
    </div>
  );
}

function PipeArrow({ active = false, bwd = false }) {
  const col = active ? (bwd ? 'var(--accent)' : '#1f77b4') : 'var(--rule)';
  const id = `ar${bwd ? 'b' : 'f'}${active ? '1' : '0'}`;
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '0 2px', flexShrink: 0, opacity: active ? 1 : 0.4, transition: 'all 0.35s ease' }}>
      <svg width={44} height={20} viewBox="0 0 44 20" overflow="visible">
        <defs>
          <marker id={id} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill={col} />
          </marker>
        </defs>
        <line x1={bwd ? 42 : 2} y1={10} x2={bwd ? 4 : 40} y2={10}
          stroke={col} strokeWidth={2} markerEnd={`url(#${id})`} />
        {active && (
          <circle r={2.5} fill={col} opacity={0.85}>
            <animateMotion dur="0.75s" repeatCount="indefinite"
              path={bwd ? 'M42,10 L6,10' : 'M2,10 L40,10'} />
          </circle>
        )}
      </svg>
    </div>
  );
}

function PipeBox({ label, sub, active = false, fwd = true }) {
  const col = fwd ? '#1f77b4' : 'var(--accent)';
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      width: 96, height: 52, borderRadius: 8,
      border: `${active ? 2 : 1}px solid ${active ? col : 'var(--rule)'}`,
      background: active ? `${col}14` : 'var(--bg-2)',
      flexShrink: 0, transition: 'all 0.35s ease',
    }}>
      <div style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 16, color: active ? col : 'var(--ink)', lineHeight: 1.2 }}>{label}</div>
      {sub && <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

// ── Phase definitions ──────────────────────────────────────────────────────────
const PHASES = [
  { id: 'overview',    label: 'Vue d\'ensemble',          dir: null,  layer: null },
  { id: 'fwd-bimap',   label: 'Avant  · BiMap',           dir: 'fwd', layer: 'bimap' },
  { id: 'fwd-reig',    label: 'Avant  · ReEig',           dir: 'fwd', layer: 'reig' },
  { id: 'fwd-logeig',  label: 'Avant  · LogEig',          dir: 'fwd', layer: 'logeig' },
  { id: 'loss',        label: 'Perte',                    dir: 'fwd', layer: 'loss' },
  { id: 'bwd-logeig',  label: 'Arrière · LogEig  ★',     dir: 'bwd', layer: 'logeig' },
  { id: 'bwd-reig',    label: 'Arrière · ReEig',          dir: 'bwd', layer: 'reig' },
  { id: 'bwd-bimap',   label: 'Arrière · BiMap',          dir: 'bwd', layer: 'bimap' },
];
const DURS = [3200, 2800, 3000, 2800, 2200, 4500, 3500, 3200];

// ── Detail panels ──────────────────────────────────────────────────────────────
const ACCENT_COL  = 'var(--accent)';
const BLUE        = '#1f77b4';
const PURPLE      = '#9467bd';

function PanelOverview() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, paddingTop: 24 }}>
      <div style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 22, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
        Propagation dans SPDNet — clé : la couche spectrale
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 1500, width: '100%', padding: '0 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 28px', background: `${BLUE}12`, borderRadius: 10, border: `1px solid ${BLUE}44` }}>
          <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: BLUE, fontSize: 14, flexShrink: 0, width: 80 }}>AVANT</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 15, color: 'var(--ink-2)' }}>
            <Tex s="\Sigma_0 \;\xrightarrow{W\,\cdot\,W^\top}\; \Sigma_1 \;\xrightarrow{\max(\varepsilon,\lambda)}\; \Sigma_2 \;\xrightarrow{\log\lambda}\; S \;\to\; \mathrm{FC} \;\to\; \mathcal{L}" />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 28px', background: `${ACCENT_COL}0f`, borderRadius: 10, border: `1px solid ${ACCENT_COL}44` }}>
          <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: ACCENT_COL, fontSize: 14, flexShrink: 0, width: 80 }}>ARRIÈRE</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 15, color: 'var(--ink-2)' }}>
            <Tex s="\partial_{\Sigma_0} \;\xleftarrow{W^\top\cdot W}\; \partial_{\Sigma_1} \;\xleftarrow{U(K_{\mathrm{re}}\odot G)U^\top}\; \partial_{\Sigma_2} \;\xleftarrow{U(K_{\mathrm{log}}\odot G)U^\top}\; \partial_S \;\leftarrow\; \cdots" />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 28px', background: `${PURPLE}10`, borderRadius: 10, border: `1px solid ${PURPLE}44` }}>
          <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: PURPLE, fontSize: 14, flexShrink: 0, width: 80 }}>CLÉ</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.6 }}>
            <Tex s="K_{ij} = \dfrac{f(\lambda_i) - f(\lambda_j)}{\lambda_i - \lambda_j}" /> &nbsp;(sensibilité des valeurs propres) — maintient le gradient sur la variété <Tex s="\mathcal{S}_{++}^d" />
          </div>
        </div>
      </div>
    </div>
  );
}

function PanelFwdBiMap() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, paddingTop: 12 }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--ink-3)' }}>
        <Tex s="W \in \mathrm{St}(p, n),\quad W W^\top = I_p" />
      </div>
      <TexD s="\Sigma_1 = W\,\Sigma_0\,W^\top \;\in\; \mathcal{S}_{++}^p" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 4 }}>
        <LM label="W \in \mathbb{R}^{2 \times 3}" mat={D.W} colorFn={orthoC} cell={52} vmax={1} />
        <Op label="·" color={BLUE} big />
        <LM label="\Sigma_0 \in \mathcal{S}_{++}^3" mat={D.Σ0} colorFn={spdC} cell={52} />
        <Op label="·" color={BLUE} big />
        <LM label="W^\top" mat={D.W[0].map((_, j) => D.W.map(r => r[j]))} colorFn={orthoC} cell={52} vmax={1} />
        <Op label="=" color="var(--ink-3)" big />
        <LM label="\Sigma_1 \in \mathcal{S}_{++}^2" mat={D.Σ1} colorFn={spdC} cell={52} glow glowColor={BLUE} />
      </div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>
        La dimension passe de <Tex s="n=3" /> à <Tex s="p=2" /> — <Tex s="\Sigma_1" /> reste SPD définie positive
      </div>
    </div>
  );
}

function PanelFwdReEig() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, paddingTop: 12 }}>
      <TexD s="\Sigma_2 = U\,\max(\varepsilon, \Lambda)\,U^\top,\quad \Sigma_1 = U\Lambda U^\top" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        <LM label="\Sigma_1" mat={D.Σ1} colorFn={spdC} cell={52} />
        <Op label="=" color="var(--ink-3)" />
        <LM label="U" mat={D.U} colorFn={orthoC} cell={52} vmax={1} />
        <Op label="·" color={BLUE} />
        <LM label="\Lambda" mat={D.Λ} colorFn={eigC} cell={52} />
        <Op label="·" color={BLUE} />
        <LM label="U^\top" mat={D.U[0].map((_, j) => D.U.map(r => r[j]))} colorFn={orthoC} cell={52} vmax={1} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 4 }}>
        <Op label="→" color={BLUE} big />
        <LM label="\max(\varepsilon,\Lambda)\;(\varepsilon=0.1)" mat={D.Λ} colorFn={eigC} cell={52} />
        <Op label="→" color={BLUE} big />
        <LM label="\Sigma_2 \;(\text{ici } {=}\,\Sigma_1)" mat={D.Σ2} colorFn={spdC} cell={52} glow glowColor={BLUE} />
      </div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-3)' }}>
        Ici <Tex s="\lambda_{\min} = 1.29 > \varepsilon" /> — les deux valeurs propres sont déjà positives, pas de rectification
      </div>
    </div>
  );
}

function PanelFwdLogEig() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, paddingTop: 12 }}>
      <TexD s="S = U\,\log(\Lambda)\,U^\top \;\in\; \mathrm{Sym}(p)" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        <LM label="U" mat={D.U} colorFn={orthoC} cell={52} vmax={1} />
        <Op label="·" color={BLUE} big />
        <LM label="\log(\Lambda)" mat={D.logΛ} colorFn={eigC} cell={52} />
        <Op label="·" color={BLUE} big />
        <LM label="U^\top" mat={D.U[0].map((_, j) => D.U.map(r => r[j]))} colorFn={orthoC} cell={52} vmax={1} />
        <Op label="=" color="var(--ink-3)" big />
        <LM label="S \in \mathrm{Sym}(2)" mat={D.S} colorFn={spdC} cell={52} glow glowColor={BLUE} />
      </div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-3)' }}>
        <Tex s="\log(2.51) \approx 0.92,\quad \log(1.29) \approx 0.26" /> — passage de <Tex s="\mathcal{S}_{++}^p" /> vers l'espace euclidien <Tex s="\mathrm{Sym}(p)" />
      </div>
    </div>
  );
}

function PanelLoss() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, paddingTop: 16 }}>
      <TexD s="\mathcal{L} = \ell\!\left(\mathrm{FC}(\mathrm{vec}(S)),\, y\right)" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 4 }}>
        <LM label="S" mat={D.S} colorFn={spdC} cell={52} />
        <Op label="→ vec →" color="var(--ink-3)" />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-3)' }}><Tex s="s \in \mathbb{R}^3" /></div>
          <div style={{
            width: 52, height: 52 * 3,
            background: 'linear-gradient(180deg, #1f77b4 0%, #6db8e8 50%, #b3d9f5 100%)',
            borderRadius: 4, border: '1px solid var(--rule)',
            display: 'flex', flexDirection: 'column',
          }}>
            {[0.90, 0.12, 0.28].map((v, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: 12, color: 'white', borderBottom: i < 2 ? '0.5px solid rgba(255,255,255,0.2)' : 'none' }}>
                {v.toFixed(2)}
              </div>
            ))}
          </div>
        </div>
        <Op label="→ FC →" color="var(--ink-3)" />
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: `${ACCENT_COL}22`, border: `2px solid ${ACCENT_COL}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: 20, color: ACCENT_COL, fontWeight: 700 }}>
          ℒ
        </div>
        <Op label="→" color={ACCENT_COL} />
        <LM label="\partial\mathcal{L}/\partial S" mat={D.dS} colorFn={gradC} cell={52} glow glowColor={ACCENT_COL} />
      </div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-3)' }}>
        Le gradient <Tex s="\partial\mathcal{L}/\partial S" /> arrive de FC — la rétropropagation commence
      </div>
    </div>
  );
}

function PanelBwdLogEig() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, paddingTop: 4 }}>
      {/* Main formula */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 28, width: '100%', padding: '0 20px' }}>
        <div style={{ flex: 1 }}>
          <TexD s="\frac{\partial\mathcal{L}}{\partial\Sigma_2} = U\!\left(K_{\log}\odot G\right)U^\top,\quad G = U^\top\frac{\partial\mathcal{L}}{\partial S}\,U" />
        </div>
        <div style={{ flexShrink: 0, padding: '10px 20px', background: `${PURPLE}12`, border: `1px solid ${PURPLE}44`, borderRadius: 8, fontFamily: 'var(--mono)', fontSize: 13, color: PURPLE, lineHeight: 1.7 }}>
          <Tex s="K_{ij} = \begin{cases}\dfrac{\log\lambda_i - \log\lambda_j}{\lambda_i - \lambda_j} & i\neq j\\[6pt] \dfrac{1}{\lambda_i} & i=j\end{cases}" />
        </div>
      </div>

      {/* 4-step computation flow */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 2 }}>
        <LM label="\partial\mathcal{L}/\partial S" mat={D.dS} colorFn={gradC} cell={48} glow glowColor={ACCENT_COL} />
        <Op label="U^\top\!\cdot\!\cdot\, U" sub="\text{rot. propre}" color={PURPLE} />
        <LM label="G = U^\top\Delta U" mat={D.G} colorFn={gradC} cell={48} />
        <Op label="\odot" sub="K_{\log}" color={PURPLE} big />
        <LM label="K_{\log}\odot G" mat={D.KlogG} colorFn={gradC} cell={48} />
        <Op label="U\!\cdot\!\cdot\, U^\top" sub="\text{ret. propre}" color={PURPLE} />
        <LM label="\partial\mathcal{L}/\partial\Sigma_2" mat={D.dΣ2} colorFn={gradC} cell={48} glow glowColor={PURPLE} />
      </div>

      {/* K matrix visualization */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 36, marginTop: 4, padding: '12px 28px', background: `${PURPLE}0c`, borderRadius: 10, border: `1px solid ${PURPLE}30` }}>
        <LM label="K_{\log}" mat={D.Klog} colorFn={kC} cell={54} vmax={0.8} glow glowColor={PURPLE} />
        <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.9 }}>
          <div><Tex s="K_{11} = 1/\lambda_1 = 1/2.51 \approx 0.40" /></div>
          <div><Tex s="K_{22} = 1/\lambda_2 = 1/1.29 \approx 0.77" /></div>
          <div style={{ marginTop: 4 }}><Tex s="K_{12} = \frac{\ln 2.51 - \ln 1.29}{2.51 - 1.29} = \frac{0.92 - 0.26}{1.22} \approx 0.55" /></div>
          <div style={{ marginTop: 6, color: PURPLE, fontWeight: 600 }}>
            K couple les valeurs propres — le gradient reste sur <Tex s="\mathcal{S}_{++}^d" />
          </div>
        </div>
      </div>
    </div>
  );
}

function PanelBwdReEig() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, paddingTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 28, width: '100%', padding: '0 20px' }}>
        <div style={{ flex: 1 }}>
          <TexD s="\frac{\partial\mathcal{L}}{\partial\Sigma_1} = U\!\left(K_{\mathrm{re}}\odot G_2\right)U^\top" />
        </div>
        <div style={{ flexShrink: 0, padding: '10px 20px', background: `${PURPLE}12`, border: `1px solid ${PURPLE}44`, borderRadius: 8, fontFamily: 'var(--mono)', fontSize: 13, color: PURPLE, lineHeight: 1.7 }}>
          <Tex s="K_{ij}^{\mathrm{re}} = \begin{cases}\frac{\mathbf{1}[\lambda_i{>}\varepsilon]-\mathbf{1}[\lambda_j{>}\varepsilon]}{\lambda_i-\lambda_j} & i\neq j\\[6pt]\mathbf{1}[\lambda_i{>}\varepsilon]/\lambda_i & i=j\end{cases}" />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 4 }}>
        <LM label="\partial\mathcal{L}/\partial\Sigma_2" mat={D.dΣ2} colorFn={gradC} cell={48} glow glowColor={ACCENT_COL} />
        <Op label="\odot" sub="K_{\mathrm{re}}" color={PURPLE} big />
        <LM label="K_{\mathrm{re}}\odot G_2" mat={D.KlogG} colorFn={gradC} cell={48} />
        <Op label="U\cdot\cdot U^\top" color={PURPLE} />
        <LM label="\partial\mathcal{L}/\partial\Sigma_1" mat={D.dΣ1} colorFn={gradC} cell={48} glow glowColor={PURPLE} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 36, marginTop: 4, padding: '12px 28px', background: `${PURPLE}0c`, borderRadius: 10, border: `1px solid ${PURPLE}30` }}>
        <LM label="K_{\mathrm{re}}" mat={D.Kre} colorFn={kC} cell={54} vmax={0.8} glow glowColor={PURPLE} />
        <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.9 }}>
          <div><Tex s="K_{\mathrm{re}}" /> est <strong>diagonale</strong> ici (<Tex s="\lambda_1, \lambda_2 > \varepsilon" />)</div>
          <div><Tex s="K_{11}^{\mathrm{re}} = 1/\lambda_1 \approx 0.40,\quad K_{22}^{\mathrm{re}} = 1/\lambda_2 \approx 0.77" /></div>
          <div style={{ marginTop: 4, color: 'var(--ink-3)' }}>
            Si <Tex s="\lambda_k \leq \varepsilon" /> : ligne/colonne nulle → gradient bloqué sur cet axe
          </div>
        </div>
      </div>
    </div>
  );
}

function PanelBwdBiMap() {
  const Wt = D.W[0].map((_, j) => D.W.map(r => r[j]));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, paddingTop: 8 }}>
      <div style={{ display: 'flex', gap: 48, width: '100%', padding: '0 20px' }}>
        <div style={{ flex: 1 }}>
          <TexD s="\frac{\partial\mathcal{L}}{\partial W} = 2\,\frac{\partial\mathcal{L}}{\partial\Sigma_1}\cdot W\cdot\Sigma_0 \quad (\in T_W\,\mathrm{St})" />
        </div>
        <div style={{ flex: 1 }}>
          <TexD s="\frac{\partial\mathcal{L}}{\partial\Sigma_0} = W^\top\frac{\partial\mathcal{L}}{\partial\Sigma_1}W" />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 4 }}>
        <LM label="\partial\mathcal{L}/\partial\Sigma_1" mat={D.dΣ1} colorFn={gradC} cell={48} glow glowColor={ACCENT_COL} />
        <Op label="·" color={ACCENT_COL} big />
        <LM label="W" mat={D.W} colorFn={orthoC} cell={48} vmax={1} />
        <Op label="·" color={ACCENT_COL} big />
        <LM label="\Sigma_0" mat={D.Σ0} colorFn={spdC} cell={36} />
        <Op label="=" color="var(--ink-3)" big />
        <LM label="\partial\mathcal{L}/\partial W" mat={D.dW} colorFn={gradC} cell={48} glow glowColor={PURPLE} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 6 }}>
        <LM label="W^\top" mat={Wt} colorFn={orthoC} cell={40} vmax={1} />
        <Op label="·" color={ACCENT_COL} />
        <LM label="\partial\mathcal{L}/\partial\Sigma_1" mat={D.dΣ1} colorFn={gradC} cell={40} />
        <Op label="·" color={ACCENT_COL} />
        <LM label="W" mat={D.W} colorFn={orthoC} cell={40} vmax={1} />
        <Op label="=" color="var(--ink-3)" />
        <LM label="\partial\mathcal{L}/\partial\Sigma_0 \in \mathcal{S}_{++}^3" mat={D.dΣ0} colorFn={gradC} cell={40} glow glowColor={ACCENT_COL} />
      </div>
    </div>
  );
}

const PANELS = [PanelOverview, PanelFwdBiMap, PanelFwdReEig, PanelFwdLogEig, PanelLoss, PanelBwdLogEig, PanelBwdReEig, PanelBwdBiMap];

// ── Pipeline ───────────────────────────────────────────────────────────────────
function Pipeline({ phase }) {
  const P = PHASES[phase];
  const { layer, dir } = P;
  const bwd = dir === 'bwd';

  const isActive = (l) => layer === l;
  const isActiveFwd = (l) => layer === l && !bwd;
  const isActiveBwd = (l) => layer === l && bwd;

  const arrowActive = (from, to) => {
    if (dir === null) return false;
    const order = ['bimap', 'reig', 'logeig', 'loss'];
    const fi = order.indexOf(from);
    const ti = order.indexOf(to);
    const li = order.indexOf(layer);
    if (!bwd) return li >= fi && li >= ti;
    return li <= fi;
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 0, padding: '14px 24px 10px',
      borderBottom: '1px solid var(--rule-soft)',
      flexShrink: 0,
    }}>
      {/* Σ₀ */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <PipeMat mat={D.Σ0} colorFn={spdC} active={isActiveFwd('bimap') || (bwd && layer === 'bimap')} fwd={!bwd} />
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}><Tex s="\Sigma_0" /></div>
      </div>

      <PipeArrow active={dir !== null} bwd={bwd && layer === 'bimap'} />

      <PipeBox label="BiMap" sub="W·○·Wᵀ" active={isActive('bimap')} fwd={!bwd} />

      <PipeArrow active={dir !== null && layer !== 'bimap'} bwd={bwd} />

      {/* Σ₁ */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <PipeMat mat={D.Σ1} colorFn={spdC} active={!bwd && (layer === 'reig' || layer === 'logeig' || layer === 'loss') || (bwd && layer === 'reig')} fwd={!bwd} />
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}><Tex s="\Sigma_1" /></div>
      </div>

      <PipeArrow active={dir !== null && !(bwd && layer === 'bimap')} bwd={bwd && layer === 'reig'} />

      <PipeBox label="ReEig" sub="max(ε,λ)" active={isActive('reig')} fwd={!bwd} />

      <PipeArrow active={dir !== null && !(bwd && ['bimap','reig'].includes(layer))} bwd={bwd && layer === 'logeig'} />

      {/* Σ₂ */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <PipeMat mat={D.Σ2} colorFn={spdC} active={!bwd && (layer === 'logeig' || layer === 'loss') || (bwd && layer === 'logeig')} fwd={!bwd} />
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}><Tex s="\Sigma_2" /></div>
      </div>

      <PipeArrow active={dir !== null && !(bwd && ['bimap','reig'].includes(layer))} bwd={bwd && layer === 'logeig'} />

      <PipeBox label="LogEig" sub="log λ" active={isActive('logeig')} fwd={!bwd} />

      <PipeArrow active={dir !== null && (layer === 'loss' || bwd)} bwd={bwd} />

      {/* S */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <PipeMat mat={D.S} colorFn={spdC} active={layer === 'loss' || (bwd && layer === 'logeig')} fwd={!bwd} />
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}><Tex s="S" /></div>
      </div>

      <PipeArrow active={layer === 'loss' || bwd} bwd={bwd} />

      {/* FC + L */}
      <PipeBox label="FC" active={layer === 'loss'} fwd={!bwd} />
      <PipeArrow active={layer === 'loss'} bwd={false} />
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        background: layer === 'loss' ? `${ACCENT_COL}22` : 'var(--bg-2)',
        border: `${layer === 'loss' ? 2 : 1}px solid ${layer === 'loss' ? ACCENT_COL : 'var(--rule)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 700,
        color: layer === 'loss' ? ACCENT_COL : 'var(--ink-3)',
        flexShrink: 0, transition: 'all 0.35s ease',
      }}>ℒ</div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
const btnStyle = {
  padding: '7px 22px', borderRadius: 6, border: '1px solid var(--rule)',
  background: 'var(--bg-2)', color: 'var(--ink)', fontFamily: 'var(--mono)',
  fontSize: 14, cursor: 'pointer', transition: 'all 0.2s',
};

export function SpdNetBackpropSpd() {
  const [phase, setPhase] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (playing) {
      timerRef.current = setTimeout(() => {
        setPhase(p => (p + 1) % PHASES.length);
      }, DURS[phase] || 3000);
    }
    return () => clearTimeout(timerRef.current);
  }, [phase, playing]);

  const P = PHASES[phase];
  const Panel = PANELS[phase];
  const bwd = P.dir === 'bwd';
  const phaseCol = bwd ? ACCENT_COL : (P.dir === 'fwd' ? BLUE : 'var(--ink-3)');

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>

      {/* Pipeline strip */}
      <Pipeline phase={phase} />

      {/* Phase label + detail panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '6px 0 0' }}>
        {/* Phase label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '0 28px 6px' }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            color: phaseCol, padding: '3px 10px',
            border: `1px solid ${phaseCol}44`,
            borderRadius: 4, background: `${phaseCol}10`,
          }}>
            {P.dir === 'fwd' ? 'Avant' : P.dir === 'bwd' ? 'Arrière' : 'Vue'}
          </div>
          <div style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 18, color: 'var(--ink)' }}>
            {P.label}
          </div>
          {P.id === 'bwd-logeig' && (
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: PURPLE, padding: '3px 10px', border: `1px solid ${PURPLE}44`, borderRadius: 4, background: `${PURPLE}10` }}>
              matrice K — spécificité SPDNet
            </div>
          )}
        </div>

        {/* Detail content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 8px' }}>
          <Panel />
        </div>
      </div>

      {/* Controls */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 10, padding: '8px 0 10px',
        borderTop: '1px solid var(--rule-soft)', flexShrink: 0,
      }}>
        <button onClick={() => { setPhase(p => Math.max(0, p - 1)); setPlaying(false); }}
          disabled={phase === 0} style={{ ...btnStyle, opacity: phase === 0 ? 0.4 : 1 }}>◀</button>

        <button onClick={() => setPlaying(p => !p)}
          style={{ ...btnStyle, minWidth: 96, borderColor: playing ? ACCENT_COL : 'var(--rule)', color: playing ? ACCENT_COL : 'var(--ink)' }}>
          {playing ? 'Pause' : 'Lancer'}
        </button>

        <button onClick={() => { setPhase(p => Math.min(PHASES.length - 1, p + 1)); setPlaying(false); }}
          disabled={phase === PHASES.length - 1} style={{ ...btnStyle, opacity: phase === PHASES.length - 1 ? 0.4 : 1 }}>▶</button>

        {/* Phase dots */}
        <div style={{ display: 'flex', gap: 7, marginLeft: 16 }}>
          {PHASES.map((ph, i) => (
            <div key={i} onClick={() => { setPhase(i); setPlaying(false); }} style={{
              width: i === phase ? 22 : 8, height: 8, borderRadius: 4,
              background: i === phase ? phaseCol : 'var(--rule)',
              cursor: 'pointer', transition: 'all 0.25s ease',
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}
