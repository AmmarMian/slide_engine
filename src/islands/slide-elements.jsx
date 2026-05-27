// slide-elements.jsx — custom slide element components.
// Ported from legacy/slide-elements.jsx: ES imports instead of window globals.

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import katex from 'katex';
import { NLLChart, DistChart, ArchDiagram } from './charts.jsx';
import foxSpriteUrl from '../assets/fox-sprite.png';

// Inline KaTeX renderer for React islands that re-render frequently.
// Uses katex.render() (DOM API) so KaTeX manages the DOM directly — no innerHTML
// in our code, and the output stays in sync with every React render cycle.
function KatexSpan({ children, display = false, style }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) {
      katex.render(children, ref.current, { throwOnError: false, displayMode: display, output: 'html' });
    }
  }, [children, display]);
  return <span ref={ref} className={display ? 'math-display' : 'math'} style={style} />;
}

// ─── helpers ─────────────────────────────────────────────────────────────────
const GLYPHS = '01ABCDEFGHIJKLMNOPQRSTUVWXYZ▌▐■□◧◨◢◣◤◥▲▼◆●○';
function rng(seed) { let s = (seed | 0) || 1; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

// Given a ref inside a custom element, compute 1-based slide index and total
// (excluding the end-slide from the total so the count matches header labels).
function getSlidePosition(refEl, hostSelector) {
  const host = refEl?.closest(hostSelector);
  const stage = document.querySelector('deck-stage');
  if (!host || !stage) return { idx: 0, total: 0 };
  // Walk up to the direct child of deck-stage (host may be nested inside a <section>).
  let stageChild = host;
  while (stageChild.parentElement && stageChild.parentElement !== stage) {
    stageChild = stageChild.parentElement;
  }
  const children = [...stage.children];
  const idx = children.indexOf(stageChild) + 1;
  const total = children.filter(c => c.tagName.toLowerCase() !== 'end-slide').length;
  return { idx, total };
}

function fmt(n) { return String(n).padStart(2, '0'); }

// ─── TokenGrid ────────────────────────────────────────────────────────────────
export function TokenGrid({
  pattern, cell = 28, gap = 2, duration = 1200, delay = 0,
  flickerHz = 18, ink = 'currentColor', noiseInk,
  loop = false, reverse = false, onDone, style,
}) {
  const rows = pattern.length;
  const cols = Math.max(...pattern.map(r => r.length));
  const [tick, setTick] = useState(0);

  const schedule = useMemo(() => {
    const r = rng(rows * 31 + cols);
    return pattern.map(row => row.map((_, ci) => {
      const base = (ci / Math.max(1, cols - 1)) * (duration * 0.7);
      return base + r() * (duration * 0.3);
    }));
  }, [pattern, rows, cols, duration]);

  useEffect(() => {
    const start = performance.now() + delay;
    let rafId;
    const step = (now) => {
      const elapsed = now - start;
      setTick(elapsed);
      if (elapsed < duration + 200) { rafId = requestAnimationFrame(step); return; }
      if (loop) {
        setTimeout(() => {
          const s2 = performance.now();
          const t2 = (n2) => { const e = n2 - s2; setTick(e); if (e < duration + 200) rafId = requestAnimationFrame(t2); else step(performance.now()); };
          rafId = requestAnimationFrame(t2);
        }, 600);
      } else if (onDone) onDone();
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [delay, duration, loop]);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, ${cell}px)`,
      gridAutoRows: `${cell}px`,
      gap: `${gap}px`,
      fontFamily: 'var(--mono)',
      fontSize: cell * 0.78,
      lineHeight: 1,
      color: ink,
      ...style,
    }}>
      {pattern.map((row, ri) => row.map((target, ci) => {
        if (target == null || target === '') return <div key={`${ri}-${ci}`} />;
        const t = schedule[ri]?.[ci] ?? 0;
        const resolved = reverse ? tick < t : tick >= t;
        const glyph = resolved
          ? target
          : GLYPHS[Math.floor((tick * flickerHz / 1000 + ri * 7 + ci * 13) % GLYPHS.length)];
        return (
          <div key={`${ri}-${ci}`} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: resolved ? ink : (noiseInk || `color-mix(in oklab, ${ink} 38%, transparent)`),
            fontWeight: resolved ? 600 : 400,
            transition: 'color 80ms linear',
          }}>{glyph}</div>
        );
      }))}
    </div>
  );
}

// 5×7 bitmap digits for SectionDivider big numerals
const DIGITS_5x7 = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['01110', '10001', '00001', '00110', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
};
function digitPattern(text, fill = '█') {
  const rows = 7;
  const out = Array.from({ length: rows }, () => []);
  text.split('').forEach((ch, i) => {
    const glyph = DIGITS_5x7[ch];
    if (!glyph) return;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < 5; c++) out[r].push(glyph[r][c] === '1' ? fill : null);
      if (i < text.length - 1) out[r].push(null);
    }
  });
  return out;
}

// ─── MaskedReveal ─────────────────────────────────────────────────────────────
export function MaskedReveal({ word, cell, duration, ink }) {
  const pattern = useMemo(
    () => [word.toUpperCase().split('').map(c => c === ' ' ? null : c)],
    [word]
  );
  return <TokenGrid pattern={pattern} cell={cell} gap={2} duration={duration} ink={ink || 'var(--ink)'} flickerHz={20} />;
}

// ─── SectionDivider ───────────────────────────────────────────────────────────
export function SectionDividerContent({ num, label, kicker }) {
  const pattern = useMemo(() => digitPattern(String(num).padStart(2, '0'), '█'), [num]);
  const [animKey, setAnimKey] = useState(null);
  const [pos, setPos] = useState({ idx: 0, total: 0 });
  const elRef = useRef(null);

  useEffect(() => {
    setPos(getSlidePosition(elRef.current, 'section-divider'));
    const stage = document.querySelector('deck-stage');
    if (!stage) return;
    const onSlideChange = (e) => {
      const host = elRef.current?.closest('section-divider');
      if (host && e.detail.slide?.contains(host)) {
        setAnimKey(k => (k ?? 0) + 1);
      }
    };
    stage.addEventListener('slidechange', onSlideChange);
    return () => stage.removeEventListener('slidechange', onSlideChange);
  }, []);

  return (
    <>
      <div ref={elRef} className="page-header" style={{ borderBottomColor: 'var(--inv-rule)' }}>
        <div className="label" style={{ color: 'var(--inv-ink-3)' }}>{kicker}</div>
        <div className="label" style={{ color: 'var(--inv-ink-3)' }}>
          {fmt(pos.idx)} / {fmt(pos.total)}
        </div>
      </div>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 100, alignItems: 'center', minHeight: 0 }}>
        {animKey !== null && (
          <TokenGrid
            key={animKey}
            pattern={pattern} cell={64} gap={3} duration={1400} flickerHz={22}
            ink="var(--inv-ink)" noiseInk="var(--inv-noise)"
          />
        )}
        <div>
          <div className="label" style={{ color: 'var(--inv-ink-3)', marginBottom: 18, fontSize: 28 }}>
            Part {String(num).padStart(2, '0')}
          </div>
          <div style={{ fontFamily: 'var(--sans)', fontSize: 132, fontWeight: 600, lineHeight: 0.95, letterSpacing: '-0.04em', color: 'var(--inv-ink)' }}>
            {label}
          </div>
        </div>
      </div>
      <div className="page-footer" style={{ color: 'var(--inv-ink-3)', borderTopColor: 'var(--inv-rule)' }}>
        <div>Slide Deck</div>
        <div>Venue · Year</div>
      </div>
    </>
  );
}

// ─── BlockInternals (for InteractiveArch) ─────────────────────────────────────
function BlockInternals({ blockNum }) {
  return (
    <div style={{
      width: '100%', maxWidth: 1500, height: 540,
      background: 'var(--bg)', border: '2px solid var(--ink)',
      padding: '32px 48px', boxSizing: 'border-box',
      display: 'flex', flexDirection: 'column', gap: 20,
      animation: 'zoomIn 280ms cubic-bezier(.2,.8,.2,1)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ fontFamily: 'var(--sans)', fontSize: 44, fontWeight: 600, letterSpacing: '-0.02em' }}>
          Encoder Block {blockNum}
        </div>
        <div className="mono" style={{ color: 'var(--ink-3)', fontSize: 24 }}>↩ click to collapse</div>
      </div>
      <svg viewBox="0 0 1400 380" width="100%" height="380" style={{ display: 'block' }}>
        <defs>
          <marker id={`ar${blockNum}`} viewBox="0 0 10 10" refX={9} refY={5} markerWidth={7} markerHeight={7} orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--ink)" />
          </marker>
        </defs>
        <text x={20} y={210} fontFamily="var(--mono)" fontSize={20} fill="var(--ink-3)">x ∈ ℝ^(d×L)</text>
        <path d="M 160 200 H 240" stroke="var(--ink)" strokeWidth={1.6} markerEnd={`url(#ar${blockNum})`} />
        <g transform="translate(240, 150)">
          <rect width={130} height={100} fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.4} />
          <text x={65} y={48} fontFamily="var(--sans)" fontSize={20} fontWeight={600} fill="var(--ink)" textAnchor="middle">LayerNorm</text>
          <text x={65} y={72} fontFamily="var(--mono)" fontSize={14} fill="var(--ink-3)" textAnchor="middle">γ, β</text>
        </g>
        <path d="M 370 200 H 430" stroke="var(--ink)" strokeWidth={1.4} markerEnd={`url(#ar${blockNum})`} />
        <g transform="translate(430, 80)">
          <rect width={260} height={240} fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={2} />
          <text x={130} y={32} fontFamily="var(--sans)" fontSize={22} fontWeight={600} fill="var(--ink)" textAnchor="middle">Multi-Head Attention</text>
          <text x={130} y={56} fontFamily="var(--mono)" fontSize={14} fill="var(--ink-3)" textAnchor="middle" letterSpacing="0.04em">8 HEADS · d_k = 64</text>
          {['Q', 'K', 'V'].map((lbl, i) => (
            <g key={lbl} transform={`translate(${20 + i * 80}, 80)`}>
              <rect width={60} height={50} fill="var(--bg)" stroke="var(--ink)" strokeWidth={1.2} />
              <text x={30} y={31} fontFamily="var(--mono)" fontSize={20} fontWeight={600} fill="var(--ink)" textAnchor="middle">{lbl}</text>
            </g>
          ))}
          <text x={130} y={170} fontFamily="var(--mono)" fontSize={16} fill="var(--ink-3)" textAnchor="middle">softmax(QKᵀ/√d)V</text>
          <rect x={20} y={186} width={220} height={32} fill="var(--bg)" stroke="var(--ink)" strokeWidth={1.2} />
          <text x={130} y={208} fontFamily="var(--sans)" fontSize={16} fill="var(--ink)" textAnchor="middle">concat + W_O</text>
        </g>
        <path d="M 690 200 H 750" stroke="var(--ink)" strokeWidth={1.4} markerEnd={`url(#ar${blockNum})`} />
        <g transform="translate(750, 175)">
          <circle cx={25} cy={25} r={25} fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.4} />
          <text x={25} y={32} fontFamily="var(--sans)" fontSize={26} fontWeight={600} fill="var(--ink)" textAnchor="middle">+</text>
        </g>
        <path d="M 220 200 V 80 H 770 V 175" stroke="var(--ink)" strokeWidth={1.2} fill="none" strokeDasharray="4 4" />
        <path d="M 800 200 H 860" stroke="var(--ink)" strokeWidth={1.4} markerEnd={`url(#ar${blockNum})`} />
        <g transform="translate(860, 130)">
          <rect width={240} height={140} fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.4} />
          <text x={120} y={36} fontFamily="var(--sans)" fontSize={22} fontWeight={600} fill="var(--ink)" textAnchor="middle">MLP</text>
          <text x={120} y={64} fontFamily="var(--mono)" fontSize={14} fill="var(--ink-3)" textAnchor="middle">d → 4d → d</text>
          <rect x={20} y={84} width={50} height={30} fill="var(--bg)" stroke="var(--ink)" strokeWidth={1} />
          <rect x={95} y={78} width={50} height={42} fill="var(--bg)" stroke="var(--ink)" strokeWidth={1} />
          <rect x={160} y={84} width={50} height={30} fill="var(--bg)" stroke="var(--ink)" strokeWidth={1} />
          <text x={120} y={105} fontFamily="var(--mono)" fontSize={14} fill="var(--ink)" textAnchor="middle">GELU</text>
        </g>
        <path d="M 1100 200 H 1160" stroke="var(--ink)" strokeWidth={1.4} markerEnd={`url(#ar${blockNum})`} />
        <g transform="translate(1160, 175)">
          <circle cx={25} cy={25} r={25} fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.4} />
          <text x={25} y={32} fontFamily="var(--sans)" fontSize={26} fontWeight={600} fill="var(--ink)" textAnchor="middle">+</text>
        </g>
        <path d="M 820 200 V 60 H 1180 V 175" stroke="var(--ink)" strokeWidth={1.2} fill="none" strokeDasharray="4 4" />
        <path d="M 1210 200 H 1280" stroke="var(--ink)" strokeWidth={1.6} markerEnd={`url(#ar${blockNum})`} />
        <text x={1300} y={205} fontFamily="var(--mono)" fontSize={20} fill="var(--ink-3)">x'</text>
      </svg>
      <div className="small" style={{ fontFamily: 'var(--mono)', color: 'var(--ink-3)', fontSize: 22, marginTop: 4 }}>
        d_model = 512 · 8 heads · MLP ratio 4 · pre-norm · ~3.2M params per block
      </div>
    </div>
  );
}

// ─── InteractiveArch ──────────────────────────────────────────────────────────
export function InteractiveArchContent({ slideNum, totalSlides }) {
  const [zoomed, setZoomed] = useState(null);
  const blocks = [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }];
  return (
    <>
      <div className="page-header">
        <div className="label">Architecture</div>
        <div className="label">{String(slideNum).padStart(2, '0')} / {String(totalSlides).padStart(2, '0')}</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 24 }}>
        <h2 className="h1">Architecture — click a block.</h2>
        <div className="small" style={{ fontSize: 22, color: 'var(--ink-3)' }}>
          {zoomed != null ? '↩ click to collapse' : 'interactive · click any encoder block'}
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0, paddingBottom: 60 }}>
        <div style={{ position: 'relative', width: '100%', height: 600 }}>
          <svg viewBox="0 0 1760 600" width="100%" height="100%" style={{ display: 'block', opacity: zoomed != null ? 0.16 : 1, transition: 'opacity 320ms ease' }}>
            <g transform="translate(40, 220)">
              <text x={0} y={-24} fontFamily="var(--mono)" fontSize={20} fill="var(--ink-3)" letterSpacing="0.04em">INPUT · x_t</text>
              {[0, 1, 2, 3, 4].map(i => (
                <g key={i} transform={`translate(0, ${i * 32})`}>
                  <rect width={120} height={26} fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.4} />
                  <text x={60} y={18} fontFamily="var(--mono)" fontSize={16} fill="var(--ink)" textAnchor="middle">[MASK]</text>
                </g>
              ))}
            </g>
            <g transform="translate(220, 220)">
              <rect width={140} height={160} fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.6} />
              <text x={70} y={88} fontFamily="var(--sans)" fontSize={22} fontWeight={600} fill="var(--ink)" textAnchor="middle">Embed</text>
              <text x={70} y={114} fontFamily="var(--mono)" fontSize={16} fill="var(--ink-3)" textAnchor="middle">+ time t</text>
            </g>
            {blocks.map((b, i) => (
              <g key={b.id} transform={`translate(${420 + i * 200}, 200)`} style={{ cursor: 'pointer' }}
                onClick={() => setZoomed(zoomed === b.id ? null : b.id)}>
                <rect width={170} height={200} fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.8} />
                <rect width={170} height={6} y={-6} fill="var(--ink)" />
                <text x={85} y={92} fontFamily="var(--sans)" fontSize={22} fontWeight={600} fill="var(--ink)" textAnchor="middle">Block {i + 1}</text>
                <text x={85} y={118} fontFamily="var(--mono)" fontSize={14} fill="var(--ink-3)" textAnchor="middle">attention + mlp</text>
                <text x={85} y={186} fontFamily="var(--mono)" fontSize={14} fill="var(--ink-3)" textAnchor="middle" letterSpacing="0.04em">↗ ZOOM</text>
              </g>
            ))}
            <g transform="translate(1300, 130)">
              <text x={0} y={-12} fontFamily="var(--mono)" fontSize={20} fill="var(--ink-3)" letterSpacing="0.04em">PER-COLUMN HEADS</text>
              {[0, 1, 2, 3, 4].map(i => (
                <g key={i} transform={`translate(0, ${i * 64})`}>
                  <rect width={200} height={48} fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.4} />
                  <text x={20} y={30} fontFamily="var(--mono)" fontSize={16} fill="var(--ink)">{`col_${i}: K${i}-way`}</text>
                </g>
              ))}
            </g>
            <g transform="translate(1560, 220)">
              <text x={0} y={-24} fontFamily="var(--mono)" fontSize={20} fill="var(--ink-3)" letterSpacing="0.04em">OUTPUT · x̂_0</text>
              {[0, 1, 2, 3, 4].map(i => (
                <g key={i} transform={`translate(0, ${i * 32})`}>
                  <rect width={140} height={26} fill="var(--bg-2)" stroke="var(--accent)" strokeWidth={1.6} />
                </g>
              ))}
            </g>
            <g stroke="var(--ink)" strokeWidth={1.2} fill="none" opacity={0.5}>
              <path d="M 160 308 H 220" /><path d="M 360 300 H 420" />
              <path d="M 590 300 H 620" /><path d="M 790 300 H 820" />
              <path d="M 990 300 H 1020" /><path d="M 1190 300 H 1300" />
              <path d="M 1500 250 H 1560" />
            </g>
          </svg>
          {zoomed != null && (
            <div onClick={() => setZoomed(null)} style={{
              position: 'absolute', inset: 0, background: 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out',
            }}>
              <BlockInternals blockNum={zoomed + 1} />
            </div>
          )}
        </div>
        <div className="figcaption" style={{ marginTop: 18 }}>
          <span className="num">Figure 1</span>
          <span>Token-level architecture. Shared encoder; per-column heads. {zoomed != null ? `Block ${zoomed + 1} internals.` : 'Click any block to inspect.'}</span>
        </div>
      </div>
      <div className="page-footer">
        <div>Slide Deck</div>
        <div>Venue · Year</div>
      </div>
    </>
  );
}

// ─── Filmstrip ────────────────────────────────────────────────────────────────
export function FilmstripContent({ slideNum, totalSlides }) {
  const COLS = ['age', 'sex', 'edu', 'work', 'race', 'income'];
  const VALUES = [
    [38, 'M', 'BS', 'Priv', 'White', '<=50K'], [41, 'F', 'MS', 'Gov', 'Black', '>50K'],
    [29, 'F', 'BS', 'Priv', 'Asian', '<=50K'], [55, 'M', 'PhD', 'Acad', 'White', '>50K'],
    [22, 'M', 'HS', 'Priv', 'Hisp', '<=50K'], [47, 'F', 'BS', 'Priv', 'White', '>50K'],
    [34, 'M', 'MS', 'Tech', 'Black', '>50K'], [26, 'F', 'BS', 'Priv', 'Asian', '<=50K'],
  ];
  const [t, setT] = useState(0);
  const playingRef = useRef(true);
  useEffect(() => {
    let raf, start = performance.now();
    const dur = 5400;
    const step = (now) => {
      const v = Math.min(1, (now - start) / dur);
      setT(v);
      if (v < 1) raf = requestAnimationFrame(step);
      else if (playingRef.current) {
        setTimeout(() => { start = performance.now(); raf = requestAnimationFrame(step); }, 1200);
      }
    };
    raf = requestAnimationFrame(step);
    return () => { playingRef.current = false; cancelAnimationFrame(raf); };
  }, []);
  const unmaskTime = (r, c) => Math.max(0, Math.min(1, c / COLS.length + (((r * 13 + c * 7) % 7) - 3) * 0.012));
  return (
    <>
      <div className="page-header">
        <div className="label">Results</div>
        <div className="label">{String(slideNum).padStart(2, '0')} / {String(totalSlides).padStart(2, '0')}</div>
      </div>
      <h2 className="h1" style={{ marginBottom: 24 }}>Reverse process, in data.</h2>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 80, alignItems: 'center', minHeight: 0, paddingBottom: 80 }}>
        <div>
          <div className="label" style={{ marginBottom: 18 }}>t = {Math.round((1 - t) * 1000)} → t = 0 · unmasking schedule</div>
          <div style={{
            display: 'grid', gridTemplateColumns: `repeat(${COLS.length}, 1fr)`, gap: 6,
            border: '1.5px solid var(--ink)', background: 'var(--ink)', padding: 1.5,
            fontFamily: 'var(--mono)', fontSize: 28, fontWeight: 500,
          }}>
            {COLS.map((c, ci) => (
              <div key={'h' + ci} style={{ background: 'var(--bg)', padding: '10px 14px', fontSize: 20, color: 'var(--ink-3)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{c}</div>
            ))}
            {VALUES.flatMap((row, ri) => row.map((val, ci) => {
              const ut = unmaskTime(ri, ci);
              const unmasked = t >= ut, active = !unmasked && Math.abs(t - ut) < 0.06;
              return (
                <div key={`${ri}-${ci}`} style={{
                  background: active ? 'var(--accent)' : unmasked ? 'var(--bg)' : 'var(--bg-2)',
                  color: active ? '#fff' : unmasked ? 'var(--ink)' : 'var(--ink-3)',
                  padding: '12px 14px', textAlign: ci === 0 || ci === 5 ? 'right' : 'left',
                  transition: 'background 200ms, color 200ms', fontVariantNumeric: 'tabular-nums',
                }}>{unmasked ? val : '[MASK]'}</div>
              );
            }))}
          </div>
          <div className="figcaption" style={{ marginTop: 22 }}>
            <span className="num">Figure</span>
            <span>Eight rows generated by ancestral sampling. Columns unmask left → right.</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {[
            ['Per-row time', '38 ms / row, T=200, A100'],
            ['Throughput', '5.3k rows / second batched'],
            ['Memory', '6.1 GB · single GPU sufficient'],
            ['Determinism', 'Fixed RNG seed for reproducibility'],
          ].map(([k, v]) => (
            <div key={k} style={{ borderTop: '1px solid var(--rule-soft)', paddingTop: 16 }}>
              <div className="label" style={{ marginBottom: 8 }}>{k}</div>
              <div className="body" style={{ fontSize: 26 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="page-footer">
        <div>Slide Deck</div>
        <div>Venue · Year</div>
      </div>
    </>
  );
}

// ─── EndSlide ─────────────────────────────────────────────────────────────────
export function EndSlideContent() {
  const ref = useRef(null);
  const [pos, setPos] = useState({ idx: 0, total: 0 });
  useEffect(() => { setPos(getSlidePosition(ref.current, 'end-slide')); }, []);

  return (
    <>
      <div ref={ref} className="page-header" style={{ borderBottomColor: 'var(--inv-rule)' }}>
        <div className="label" style={{ color: 'var(--inv-ink-3)' }}>End · Q&A</div>
        <div className="label" style={{ color: 'var(--inv-ink-3)' }}>{fmt(pos.idx)} / {fmt(pos.total)}</div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 64 }}>
        <div>
          <div className="label" style={{ color: 'var(--inv-ink-3)', marginBottom: 22, fontSize: 28 }}>
            the deck returns to noise
          </div>
          <TokenGrid
            pattern={['THANK YOU'.split('').map(c => c === ' ' ? null : c)]}
            cell={140} gap={14} duration={2400} flickerHz={16}
            reverse={true} loop={true}
            ink="var(--inv-ink)" noiseInk="var(--inv-noise)"
          />
        </div>
        <div style={{ fontFamily: 'var(--sans)', fontSize: 36, color: 'var(--inv-ink-2)', maxWidth: 1300, lineHeight: 1.3 }}>
          Slides made with <span style={{ color: 'var(--accent)', fontFamily: 'var(--mono)', fontSize: 32 }}>github.com/anon/slide-deck</span>.
        </div>
      </div>
      <div className="page-footer" style={{ color: 'var(--inv-ink-3)', borderTopColor: 'var(--inv-rule)' }}>
        <div>Slide Deck</div>
        <div>Venue · Year</div>
      </div>
    </>
  );
}

// ─── DiffusionStrip ───────────────────────────────────────────────────────────
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
            <div style={{ position: 'absolute', bottom: 8, left: 10, fontFamily: 'var(--mono)', fontSize: 24, color: 'var(--ink-3)' }}>
              t = {Math.round(noise * 1000)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── HeroRow ─────────────────────────────────────────────────────────────────
const HERO_COLS = ['age', 'sex', 'edu', 'work', 'race', 'income'];
const HERO_VALUES = [38, 'M', 'BS', 'Priv', 'White', '<=50K'];

export function HeroRow({ state = HERO_COLS.length, highlight = -1, compact = false, headers = true, label }) {
  const sz = compact
    ? { val: 24, pad: '8px 12px', hdr: 18, gap: 4 }
    : { val: 28, pad: '12px 14px', hdr: 24, gap: 6 };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: 'var(--mono)' }}>
      {label && <div className="label" style={{ fontSize: 24, color: 'var(--ink-3)' }}>{label}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${HERO_COLS.length}, 1fr)`, gap: sz.gap, border: '1.5px solid var(--ink)', background: 'var(--ink)', padding: 1.5 }}>
        {headers && HERO_COLS.map((c, ci) => (
          <div key={'h' + ci} style={{ background: 'var(--bg)', padding: sz.pad, fontSize: sz.hdr, color: 'var(--ink-3)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{c}</div>
        ))}
        {HERO_VALUES.map((v, ci) => {
          const resolved = ci < state, isHl = ci === highlight && resolved;
          return (
            <div key={'v' + ci} style={{
              background: isHl ? 'var(--accent)' : resolved ? 'var(--bg)' : 'var(--bg-2)',
              color: isHl ? '#fff' : resolved ? 'var(--ink)' : 'var(--ink-3)',
              padding: sz.pad, fontSize: sz.val,
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

// ─── DiffusionScrubber ────────────────────────────────────────────────────────
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
          <div className="mono" style={{ fontSize: 24, color: 'var(--ink-3)' }}>
            x_t = √(α̅_t) · x_0 + √(1 − α̅_t) · ε,&nbsp; ε ~ 𝒩(0, I)
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="label">Discrete · Categorical kernel</div>
          <div style={{ height: 240, display: 'flex', alignItems: 'center' }}>
            <div style={{ width: '100%' }}><HeroRow state={discreteState} headers={true} /></div>
          </div>
          <div className="mono" style={{ fontSize: 24, color: 'var(--ink-3)' }}>
            x_t ~ Cat(x_t; Q&#773;_t · e<sub>x_0</sub>),&nbsp; absorbing [MASK]
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, paddingTop: 6 }}>
        <div className="mono" style={{ color: 'var(--ink)', minWidth: 130, fontSize: 22 }}>t = {String(tRaw).padStart(4, ' ')}</div>
        <div style={{ flex: 1, position: 'relative', height: 28, display: 'flex', alignItems: 'center' }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 2, background: 'var(--rule-soft)', transform: 'translateY(-50%)' }} />
          <input type="range" min="0" max="1000" value={tRaw} onChange={e => setT(+e.target.value)}
            style={{ position: 'relative', zIndex: 1, width: '100%', accentColor: 'var(--ink)', cursor: 'ew-resize' }} />
        </div>
        <div className="mono" style={{ color: 'var(--ink-3)', minWidth: 130, fontSize: 22, textAlign: 'right' }}>x_0 ⟶ x_T</div>
      </div>
    </div>
  );
}

// ─── AlgorithmStepper ─────────────────────────────────────────────────────────
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
      fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 600,
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
        <div className="label" style={{ fontSize: 16 }}>Live trace</div>
        <HeroRow state={step} highlight={highlight} headers={true} />
        <div className="mono" style={{ fontSize: 20, color: 'var(--ink-2)', minHeight: 24 }}>{status}</div>
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

// ─── Fox mascot ──────────────────────────────────────────────────────────────
const FOX_W = 48, FOX_H = 32, FOX_SCALE = 1.5;
// Row indices (0-based): 0=idle2, 1=walk_a, 2=walk_b, 3=idle
const WALK_FRAMES = [
  { col: 0, row: 1 }, { col: 1, row: 1 }, { col: 2, row: 1 }, { col: 3, row: 1 },
  { col: 0, row: 2 }, { col: 1, row: 2 }, { col: 2, row: 2 }, { col: 3, row: 2 },
];
const IDLE_FRAMES = [
  { col: 0, row: 3 }, { col: 1, row: 3 }, { col: 2, row: 3 }, { col: 3, row: 3 },
];
const WALK_INTERVAL = 80;   // ms per walk frame
const IDLE_INTERVAL = 200;  // ms per idle frame
const WALK_SPEED = 2.5;     // px per animation tick (~60fps)

function FoxMascot({ trackRef, idx, sections }) {
  const [pos, setPos] = useState(null);   // current rendered x (left edge of sprite)
  const [facingLeft, setFacingLeft] = useState(false);
  const [frame, setFrame] = useState(0);
  const [walking, setWalking] = useState(false);
  const stateRef = useRef({ pos: null, target: null, walking: false, frame: 0, lastFrameT: 0 });
  const rafRef = useRef(null);

  // Compute target x: right edge of the current section's progress fill.
  const computeTarget = useCallback(() => {
    const track = trackRef.current;
    if (!track) return null;
    const segs = track.querySelectorAll('.progress-seg');
    if (!segs.length) return null;
    // Find which section contains idx.
    let secIdx = sections.length - 1;
    for (let i = 0; i < sections.length; i++) {
      if (idx <= sections[i].end) { secIdx = i; break; }
    }
    const sec = sections[secIdx];
    const seg = segs[secIdx];
    if (!seg) return null;
    const fill = idx > sec.end ? 1 : idx >= sec.start ? (idx - sec.start + 1) / (sec.end - sec.start + 1) : 0;
    const segRect = seg.getBoundingClientRect();
    const fillRight = segRect.left + segRect.width * fill;
    const sprW = FOX_W * FOX_SCALE;
    // Place left edge 8px to the right of the fill end (fox as a "you are here" marker).
    return Math.min(fillRight - 40, window.innerWidth - sprW - 30);
  }, [trackRef, idx, sections]);

  // Kick off animation loop once we have an initial position.
  useEffect(() => {
    const s = stateRef.current;

    const tick = (t) => {
      rafRef.current = requestAnimationFrame(tick);
      const frames = s.walking ? WALK_FRAMES : IDLE_FRAMES;
      const interval = s.walking ? WALK_INTERVAL : IDLE_INTERVAL;
      if (t - s.lastFrameT >= interval) {
        s.frame = (s.frame + 1) % frames.length;
        s.lastFrameT = t;
        setFrame(s.frame);
      }
      if (s.walking && s.target !== null && s.pos !== null) {
        const diff = s.target - s.pos;
        if (Math.abs(diff) < 1) {
          s.pos = s.target;
          s.walking = false;
          setWalking(false);
          setPos(s.pos);
        } else {
          s.pos += Math.sign(diff) * Math.min(WALK_SPEED, Math.abs(diff));
          setFacingLeft(diff < 0);
          setPos(s.pos);
        }
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  // On slide change: compute new target and start walking.
  useEffect(() => {
    // Small delay so the DOM progress-seg-fg has updated its width.
    const timer = setTimeout(() => {
      const target = computeTarget();
      if (target === null) return;
      const s = stateRef.current;
      if (s.pos === null) {
        // First render: jump immediately.
        s.pos = target;
        s.target = target;
        s.walking = false;
        setPos(target);
        return;
      }
      s.target = target;
      if (Math.abs(target - s.pos) > 2) {
        s.walking = true;
        s.frame = 0;
        s.lastFrameT = 0;
        setWalking(true);
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [idx, computeTarget]);

  if (pos === null) return null;

  const frames = walking ? WALK_FRAMES : IDLE_FRAMES;
  const { col, row } = frames[frame] || frames[0];
  const bpX = -(col * FOX_W * FOX_SCALE);
  const bpY = -(row * FOX_H * FOX_SCALE);
  const sprW = FOX_W * FOX_SCALE;
  const sprH = FOX_H * FOX_SCALE;

  // Bar sits 8–11px from viewport bottom (8px padding + 3px track).
  // Position fox 3px above bar top so it hovers just over the line with no viewport clipping.
  const barBottom = 1;

  return (
    <div style={{
      position: 'fixed',
      bottom: barBottom,
      left: pos,
      width: sprW,
      height: sprH,
      zIndex: 2147483641,
      pointerEvents: 'none',
      imageRendering: 'pixelated',
      filter: 'grayscale(1)',
      transform: facingLeft ? 'scaleX(-1)' : 'none',
      backgroundImage: `url(${foxSpriteUrl})`,
      backgroundSize: `${FOX_W * FOX_SCALE * 4}px ${FOX_H * FOX_SCALE * 4}px`,
      backgroundPosition: `${bpX}px ${bpY}px`,
      backgroundRepeat: 'no-repeat',
    }} />
  );
}

// ─── SlideFooter ─────────────────────────────────────────────────────────────
// Drop-in replacement for the manual <div class="page-footer">...</div>.
// Reads deck title from <title> and date from <meta name="deck-date">.
export function SlideFooterContent() {
  const title = document.title || '';
  const date  = document.querySelector('meta[name="deck-date"]')?.getAttribute('content') || '';
  return (
    <div className="page-footer">
      <span className="label">{title}</span>
      {date && <span className="label">{date}</span>}
    </div>
  );
}

// ─── SlideHeader ──────────────────────────────────────────────────────────────
// Replaces the manual page-header div + h2 in every <section> slide.
// Reads its own slide index from the DOM so no slide-num attribute is needed.
export function SlideHeaderContent({ title }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ idx: 0, total: 0 });

  useEffect(() => {
    setPos(getSlidePosition(ref.current, 'slide-header'));
  }, []);

  return (
    <div ref={ref} className="page-header">
      <div style={{
        fontFamily: 'var(--sans)',
        fontSize: 'calc(52px * var(--type-scale, 1))',
        fontWeight: 600,
        lineHeight: 1.0,
        letterSpacing: '-0.03em',
        color: 'var(--ink)',
      }}>{title}</div>
      <div className="label">{fmt(pos.idx)} / {fmt(pos.total)}</div>
    </div>
  );
}

// ─── TocSlide ─────────────────────────────────────────────────────────────────
// Auto-populates from <section-divider> elements in deck-stage.
// Each divider may carry a `blurb` attribute for the description line.
// Page ranges are derived from consecutive slide-num attributes.
export function TocSlideContent() {
  const ref = useRef(null);
  const [entries, setEntries] = useState([]);
  const [pos, setPos] = useState({ idx: 0, total: 0 });

  useEffect(() => {
    const t = setTimeout(() => {
      const stage = document.querySelector('deck-stage');
      if (!stage) return;

      setPos(getSlidePosition(ref.current, 'toc-slide'));

      const dividers = [...stage.querySelectorAll('section-divider')];
      const parsed = dividers
        .map(d => ({
          num: parseInt(d.getAttribute('num'), 10) || 0,
          label: d.getAttribute('label') || '',
          blurb: d.getAttribute('blurb') || '',
          slideNum: [...stage.children].indexOf(d) + 1,
        }))
        .sort((a, b) => a.slideNum - b.slideNum);

      const total = [...stage.children].filter(c => c.tagName.toLowerCase() !== 'end-slide').length;
      setEntries(parsed.map((d, i) => ({
        ...d,
        start: d.slideNum + 1,
        end: i < parsed.length - 1 ? parsed[i + 1].slideNum - 1 : total,
      })));
    }, 0);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <div ref={ref} className="page-header">
        <div className="label">Outline</div>
        <div className="label">{fmt(pos.idx)} / {fmt(pos.total)}</div>
      </div>
      <h2 className="h1" style={{ marginBottom: 52 }}>What we cover.</h2>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px 96px', alignContent: 'start' }}>
        {entries.map(e => (
          <div key={e.num} className="toc-entry">
            <div className="toc-num">{String(e.num).padStart(2, '0')}</div>
            <div>
              <div className="toc-label">{e.label.replace(/\.$/, '')}</div>
              {e.blurb && <div className="toc-blurb">{e.blurb}</div>}
            </div>
            <div className="toc-pages">{String(e.start).padStart(2, '0')}–{String(e.end).padStart(2, '0')}</div>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── theme.css needs toc-slide in the slide-frame selector ───────────────────

// ─── ProgressBar ─────────────────────────────────────────────────────────────
// Sections are auto-derived from <section-divider> elements in the DOM.
// Pass a `sections` JSON attribute to override (0-based indices).
function computeSectionsFromDOM() {
  const stage = document.querySelector('deck-stage');
  if (!stage) return null;
  const children = [...stage.children];
  const dividers = children
    .map((el, i) => ({ el, i }))
    .filter(({ el }) => el.tagName.toLowerCase() === 'section-divider');
  if (!dividers.length) return null;
  return dividers.map(({ el, i }, d) => ({
    label: el.getAttribute('label') || `Section ${d + 1}`,
    start: i,
    end: d + 1 < dividers.length ? dividers[d + 1].i - 1 : children.length - 1,
  }));
}

export function ProgressBarContent({ sections }) {
  const SECTIONS = sections || computeSectionsFromDOM() || [
    { label: 'Content', start: 0, end: 10 },
  ];
  const [idx, setIdx] = useState(0);
  const [foxEnabled, setFoxEnabled] = useState(
    () => getComputedStyle(document.documentElement).getPropertyValue('--fx-fox').trim() === '1'
  );
  const trackRef = useRef(null);

  useEffect(() => {
    const stage = document.querySelector('deck-stage');
    if (!stage) return;
    const handler = (e) => setIdx(e.detail.index);
    stage.addEventListener('slidechange', handler);
    return () => stage.removeEventListener('slidechange', handler);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.foxProgress != null) setFoxEnabled(e.detail.foxProgress);
    };
    document.documentElement.addEventListener('deck-theme-change', handler);
    return () => document.documentElement.removeEventListener('deck-theme-change', handler);
  }, []);

  return (
    <>
    <div className="progress-bar" data-progress="true">
      <div ref={trackRef} className="progress-track">
        {SECTIONS.map((s, i) => {
          const span = s.end - s.start + 1;
          const fill = idx > s.end ? 1 : idx >= s.start ? (idx - s.start + 1) / span : 0;
          return (
            <div key={i} className="progress-seg" style={{ flex: span }}>
              <div className="progress-seg-bg" />
              <div className="progress-seg-fg" style={{ width: `${fill * 100}%` }} />
            </div>
          );
        })}
      </div>
      {foxEnabled && <FoxMascot trackRef={trackRef} idx={idx} sections={SECTIONS} />}
    </div>
    {/* Labels in a separate stacking context above the fox */}
    <div className="progress-labels" data-progress="true">
      <div className="progress-track">
        {SECTIONS.map((s, i) => (
          <div key={i} className="progress-seg" style={{ flex: s.end - s.start + 1 }}>
            <div className="progress-seg-label">{String(i + 1).padStart(2, '0')} {s.label}</div>
          </div>
        ))}
      </div>
    </div>
    </>
  );
}
