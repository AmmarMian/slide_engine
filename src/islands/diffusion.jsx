// diffusion.jsx — diffusion demo islands: HeroRow, DiffusionStrip,
// DiffusionScrubber, AlgorithmStepper.
import React, { useState, useEffect } from 'react';
import { KatexSpan } from './token-grid.jsx';

const HERO_COLS = ['age', 'sex', 'edu', 'work', 'race', 'income'];
const HERO_VALUES = [38, 'M', 'BS', 'Priv', 'White', '<=50K'];

export function HeroRow({ state = HERO_COLS.length, highlight = -1, compact = false, headers = true, label }) {
  const sz = compact
    ? { val: 24, pad: '8px 12px', hdr: 18, gap: 4 }
    : { val: 28, pad: '12px 14px', hdr: 24, gap: 6 };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: 'var(--mono)' }}>
      {label && <div className="label" style={{ fontSize: 'calc(24px * var(--type-scale, 1))', color: 'var(--ink-3)' }}>{label}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${HERO_COLS.length}, 1fr)`, gap: sz.gap, border: '1.5px solid var(--ink)', background: 'var(--ink)', padding: 1.5 }}>
        {headers && HERO_COLS.map((c, ci) => (
          <div key={'h' + ci} style={{ background: 'var(--bg)', padding: sz.pad, fontSize: `calc(${sz.hdr}px * var(--type-scale, 1))`, color: 'var(--ink-3)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{c}</div>
        ))}
        {HERO_VALUES.map((v, ci) => {
          const resolved = ci < state, isHl = ci === highlight && resolved;
          return (
            <div key={'v' + ci} style={{
              background: isHl ? 'var(--accent)' : resolved ? 'var(--bg)' : 'var(--bg-2)',
              color: isHl ? '#fff' : resolved ? 'var(--ink)' : 'var(--ink-3)',
              padding: sz.pad, fontSize: `calc(${sz.val}px * var(--type-scale, 1))`,
              textAlign: ci === 0 || ci === HERO_COLS.length - 1 ? 'right' : 'left',
              fontVariantNumeric: 'tabular-nums', transition: 'background 220ms, color 220ms',
              fontWeight: isHl ? 600 : 500,
            }}>{resolved ? v : '[MASK]'}</div>
          );
        })}
      </div>
    </div>
  );
}

export function DiffusionStripContent({ steps }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${steps}, 1fr)`, gap: 18 }}>
      {Array.from({ length: steps }).map((_, i) => {
        const noise = i / (steps - 1);
        return (
          <div key={i} style={{ aspectRatio: '1 / 1', position: 'relative', background: 'var(--bg-2)', border: '1px solid var(--rule-soft)' }}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
              {Array.from({ length: 60 }).map((_, k) => {
                const seed = (k * 7 + i * 13) % 97;
                const x = (seed * 31) % 100, y = (seed * 53) % 100;
                return <circle key={k} cx={x} cy={y} r={1.4 + ((seed * 11) % 7) * 0.18} fill="var(--ink)" opacity={(1 - noise * 0.7) * 0.55} />;
              })}
              <ellipse cx={50} cy={50} rx={Math.max(0, 36 - i * 6)} ry={Math.max(0, 26 - i * 4)}
                fill="var(--accent)" opacity={Math.max(0, 0.45 - noise * 0.5)} />
            </svg>
            <div style={{ position: 'absolute', bottom: 8, left: 10, fontFamily: 'var(--mono)', fontSize: 'calc(24px * var(--type-scale, 1))', color: 'var(--ink-3)' }}>
              t = {Math.round(noise * 1000)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DiffusionScrubberContent() {
  const [tRaw, setT] = useState(0);
  const t = tRaw / 1000;
  const discreteState = Math.max(0, Math.round((1 - t) * HERO_COLS.length));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'stretch' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="label">Continuous · Gaussian kernel</div>
          <div style={{ height: 240, background: 'var(--bg-2)', border: '1px solid var(--rule-soft)', position: 'relative' }}>
            <svg viewBox="0 0 200 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
              {Array.from({ length: 140 }).map((_, k) => {
                const seed = (k * 7) % 197;
                return <circle key={k} cx={(seed * 31) % 200} cy={(seed * 53) % 100} r={0.7 + ((seed * 11) % 7) * 0.18} fill="var(--ink)" opacity={t * 0.55} />;
              })}
              <ellipse cx={100} cy={50} rx={Math.max(0, 60 * (1 - t * 0.95))} ry={Math.max(0, 32 * (1 - t * 0.9))}
                fill="var(--ink)" opacity={Math.max(0, 0.65 - t * 0.55)} />
            </svg>
          </div>
          <div className="mono" style={{ fontSize: 'calc(24px * var(--type-scale, 1))', color: 'var(--ink-3)' }}>
            x_t = √(α̅_t) · x_0 + √(1 − α̅_t) · ε,&nbsp; ε ~ 𝒩(0, I)
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="label">Discrete · Categorical kernel</div>
          <div style={{ height: 240, display: 'flex', alignItems: 'center' }}>
            <div style={{ width: '100%' }}><HeroRow state={discreteState} headers={true} /></div>
          </div>
          <div className="mono" style={{ fontSize: 'calc(24px * var(--type-scale, 1))', color: 'var(--ink-3)' }}>
            x_t ~ Cat(x_t; Q&#773;_t · e<sub>x_0</sub>),&nbsp; absorbing [MASK]
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, paddingTop: 6 }}>
        <div className="mono" style={{ color: 'var(--ink)', minWidth: 130, fontSize: 'calc(22px * var(--type-scale, 1))' }}>t = {String(tRaw).padStart(4, ' ')}</div>
        <div style={{ flex: 1, position: 'relative', height: 28, display: 'flex', alignItems: 'center' }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 2, background: 'var(--rule-soft)', transform: 'translateY(-50%)' }} />
          <input type="range" min="0" max="1000" value={tRaw} onChange={e => setT(+e.target.value)}
            style={{ position: 'relative', zIndex: 1, width: '100%', accentColor: 'var(--ink)', cursor: 'ew-resize' }} />
        </div>
        <div className="mono" style={{ color: 'var(--ink-3)', minWidth: 130, fontSize: 'calc(22px * var(--type-scale, 1))', textAlign: 'right' }}>x_0 ⟶ x_T</div>
      </div>
    </div>
  );
}

export function AlgorithmStepperContent() {
  const N = HERO_COLS.length;
  const [step, setStep] = useState(0);
  const [autoplay, setAutoplay] = useState(false);
  useEffect(() => {
    if (!autoplay) return;
    if (step >= N) { setAutoplay(false); return; }
    const id = setTimeout(() => setStep(s => s + 1), 700);
    return () => clearTimeout(id);
  }, [autoplay, step]);
  const activeLines = step === 0 ? [2] : step >= N ? [7] : [4, 5];
  const Line = ({ n, children }) => (
    <div style={{ background: activeLines.includes(n) ? 'var(--tint)' : 'transparent', margin: '0 -8px', padding: '2px 8px', transition: 'background 200ms' }}>
      <span className="ln">{n}:</span>{children}
    </div>
  );
  const Btn = ({ onClick, disabled, children, primary }) => (
    <button onClick={onClick} disabled={disabled} style={{
      appearance: 'none', border: '1.5px solid var(--ink)',
      background: primary ? 'var(--ink)' : 'transparent',
      color: primary ? 'var(--bg)' : 'var(--ink)',
      fontFamily: 'var(--mono)', fontSize: 'calc(18px * var(--type-scale, 1))', fontWeight: 600,
      letterSpacing: '0.04em', textTransform: 'uppercase',
      padding: '10px 16px', cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.35 : 1, transition: 'opacity 140ms',
    }}>{children}</button>
  );
  const t = N - step;
  const highlight = step > 0 && step < N ? step - 1 : -1;
  const status = step === 0 ? 'Initialized — every column starts in [MASK].'
    : step >= N ? 'Done — clean sample x_0 emitted.'
      : `Step ${step} / ${N} — column "${HERO_COLS[step - 1]}" resolves to "${HERO_VALUES[step - 1]}".`;
  return (
    <div className="algorithm" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="algorithm-header">
        <span>Algorithm 1 &nbsp;·&nbsp; Ancestral sampling</span>
        <span style={{ opacity: 0.6 }}>t = {t}</span>
      </div>
      <div className="algorithm-body" style={{ paddingBottom: 12 }}>
        <Line n={1}><b>input:</b> trained <KatexSpan>{`\\hat x_0`}</KatexSpan>, schedule <KatexSpan>{`\\{Q_t\\}`}</KatexSpan></Line>
        <Line n={2}><KatexSpan>{`x_T \\leftarrow [\\mathsf{mask}]^d`}</KatexSpan></Line>
        <Line n={3}><b>for</b>&nbsp; <KatexSpan>{`t = T, T{-}1, \\dots, 1`}</KatexSpan> &nbsp;<b>do</b></Line>
        <Line n={4}>&nbsp;&nbsp;&nbsp;&nbsp; <KatexSpan>{`\\tilde x_0 \\sim p_\\theta(\\,\\cdot \\mid x_t, t\\,)`}</KatexSpan></Line>
        <Line n={5}>&nbsp;&nbsp;&nbsp;&nbsp; <KatexSpan>{`x_{t-1} \\sim q(x_{t-1} \\mid x_t,\\, \\tilde x_0)`}</KatexSpan></Line>
        <Line n={6}><b>end for</b></Line>
        <Line n={7}><b>return</b>&nbsp; <KatexSpan>x_0</KatexSpan></Line>
      </div>
      <div style={{ borderTop: '1px solid var(--rule)', padding: '14px 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="label" style={{ fontSize: 'calc(16px * var(--type-scale, 1))' }}>Live trace</div>
        <HeroRow state={step} highlight={highlight} headers={true} />
        <div className="mono" style={{ fontSize: 'calc(20px * var(--type-scale, 1))', color: 'var(--ink-2)', minHeight: 24 }}>{status}</div>
        <div style={{ display: 'flex', gap: 10, marginTop: 2, flexWrap: 'wrap' }}>
          <Btn onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}>← Back</Btn>
          <Btn primary onClick={() => setStep(s => Math.min(N, s + 1))} disabled={step >= N}>Step →</Btn>
          <Btn onClick={() => { setStep(0); setAutoplay(true); }} disabled={autoplay}>▶ Auto</Btn>
          <Btn onClick={() => { setStep(0); setAutoplay(false); }}>↻ Reset</Btn>
        </div>
      </div>
    </div>
  );
}
