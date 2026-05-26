/* eslint-disable */
// slide-elements.jsx
// ──────────────────────────────────────────────────────────────────────
// Defines the deck's custom HTML tags. The Scientific Deck is mostly
// plain <section> markup; the fancy 20% lives behind these tags so the
// HTML stays readable while the visuals stay rich.
//
//   Full-slide custom tags (direct children of <deck-stage>):
//     <section-divider num label kicker slide-num total-slides>
//     <interactive-arch slide-num total-slides>
//     <filmstrip-slide slide-num total-slides>
//     <end-slide slide-num total-slides>
//
//   Inline custom tags (used inside static <section> slides):
//     <masked-reveal word cell duration>
//     <diffusion-strip steps>
//     <nll-chart>
//     <dist-chart>
//     <arch-diagram>
//
//   Overlay:
//     <progress-bar>   — placed once, outside deck-stage
//
// Math:
//   <span class="math">x_0</span>           — inline
//   <div class="math-display">\mathcal{L}…</div>  — block
//
// The math source lives as the element's textContent; on first render
// we copy it to data-tex so engine swaps re-render from the same source.
// ──────────────────────────────────────────────────────────────────────

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ─── helpers ─────────────────────────────────────────────────────────────
const GLYPHS = '01ABCDEFGHIJKLMNOPQRSTUVWXYZ▌▐■□◧◨◢◣◤◥▲▼◆●○';
function rng(seed) { let s = (seed | 0) || 1; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

// ─── TokenGrid ────────────────────────────────────────────────────────────
function TokenGrid({
  pattern, cell = 28, gap = 2, duration = 1200, delay = 0,
  flickerHz = 18, ink = 'currentColor', noiseInk,
  loop = false, reverse = false, onDone, style,
}) {
  const rows = pattern.length;
  const cols = Math.max(...pattern.map(r => r.length));
  const [tick, setTick] = useState(0);

  const schedule = useMemo(() => {
    const r = rng(rows * 31 + cols);
    return pattern.map((row) => row.map((_, ci) => {
      const base = (ci / Math.max(1, cols - 1)) * (duration * 0.7);
      const jitter = r() * (duration * 0.3);
      return base + jitter;
    }));
  }, [pattern, rows, cols, duration]);

  useEffect(() => {
    const start = performance.now() + delay;
    let rafId;
    const step = (now) => {
      const elapsed = now - start;
      setTick(elapsed);
      if (elapsed < duration + 200) rafId = requestAnimationFrame(step);
      else if (loop) {
        setTimeout(() => {
          const s2 = performance.now();
          const t2 = (n2) => {
            const e = n2 - s2; setTick(e);
            if (e < duration + 200) rafId = requestAnimationFrame(t2);
            else step(performance.now());
          };
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
        const t = schedule[ri][ci];
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

// 5×7 bitmap digits for SectionDivider's big numerals.
const DIGITS_5x7 = {
  '0': ['01110','10001','10011','10101','11001','10001','01110'],
  '1': ['00100','01100','00100','00100','00100','00100','01110'],
  '2': ['01110','10001','00001','00010','00100','01000','11111'],
  '3': ['01110','10001','00001','00110','00001','10001','01110'],
  '4': ['00010','00110','01010','10010','11111','00010','00010'],
  '5': ['11111','10000','11110','00001','00001','10001','01110'],
  '6': ['00110','01000','10000','11110','10001','10001','01110'],
  '7': ['11111','00001','00010','00100','01000','01000','01000'],
  '8': ['01110','10001','10001','01110','10001','10001','01110'],
  '9': ['01110','10001','10001','01111','00001','00010','01100'],
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

// ─── MaskedReveal (inline, for title) ────────────────────────────────────
function MaskedReveal({ word, cell, duration, ink }) {
  const pattern = useMemo(
    () => [word.toUpperCase().split('').map(c => c === ' ' ? null : c)],
    [word]
  );
  return <TokenGrid pattern={pattern} cell={cell} gap={2} duration={duration} ink={ink || 'var(--ink)'} flickerHz={20} />;
}

// ─── SectionDivider content ─────────────────────────────────────────────
function SectionDividerContent({ num, label, kicker, slideNum, totalSlides }) {
  const pattern = useMemo(() => digitPattern(String(num).padStart(2, '0'), '█'), [num]);
  return (
    <>
      <div className="page-header" style={{ borderBottomColor: 'var(--inv-rule)' }}>
        <div className="label" style={{ color: 'var(--inv-ink-3)' }}>{kicker}</div>
        <div className="label" style={{ color: 'var(--inv-ink-3)' }}>
          {String(slideNum).padStart(2,'0')} / {String(totalSlides).padStart(2,'0')}
        </div>
      </div>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 100, alignItems: 'center', minHeight: 0 }}>
        <TokenGrid
          pattern={pattern} cell={64} gap={3} duration={1400} flickerHz={22}
          ink="var(--inv-ink)" noiseInk="var(--inv-noise)"
        />
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
        <div>Discrete Diffusion · Tabular</div>
        <div>NeurIPS 2026 · Generative Models Workshop</div>
      </div>
    </>
  );
}

// ─── Interactive Architecture ───────────────────────────────────────────
function InteractiveArchContent({ slideNum, totalSlides }) {
  const [zoomed, setZoomed] = useState(null);
  const blocks = [
    { id: 0, label: 'Block 1' },
    { id: 1, label: 'Block 2' },
    { id: 2, label: 'Block 3' },
    { id: 3, label: 'Block 4' },
  ];
  return (
    <>
      <div className="page-header">
        <div className="label">06 · Architecture</div>
        <div className="label">
          {String(slideNum).padStart(2,'0')} / {String(totalSlides).padStart(2,'0')}
        </div>
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
              {[0,1,2,3,4].map(i => (
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
              <g key={b.id} transform={`translate(${420 + i * 200}, 200)`} style={{ cursor: 'pointer' }} onClick={() => setZoomed(zoomed === b.id ? null : b.id)}>
                <rect width={170} height={200} fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.8} />
                <rect width={170} height={6} y={-6} fill="var(--ink)" />
                <text x={85} y={92} fontFamily="var(--sans)" fontSize={22} fontWeight={600} fill="var(--ink)" textAnchor="middle">{b.label}</text>
                <text x={85} y={118} fontFamily="var(--mono)" fontSize={14} fill="var(--ink-3)" textAnchor="middle">attention + mlp</text>
                <text x={85} y={186} fontFamily="var(--mono)" fontSize={14} fill="var(--ink-3)" textAnchor="middle" letterSpacing="0.04em">↗ ZOOM</text>
              </g>
            ))}
            <g transform="translate(1300, 130)">
              <text x={0} y={-12} fontFamily="var(--mono)" fontSize={20} fill="var(--ink-3)" letterSpacing="0.04em">PER-COLUMN HEADS</text>
              {[0,1,2,3,4].map(i => (
                <g key={i} transform={`translate(0, ${i * 64})`}>
                  <rect width={200} height={48} fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.4} />
                  <text x={20} y={30} fontFamily="var(--mono)" fontSize={16} fill="var(--ink)">col_{i}: K_{i}-way</text>
                </g>
              ))}
            </g>
            <g transform="translate(1560, 220)">
              <text x={0} y={-24} fontFamily="var(--mono)" fontSize={20} fill="var(--ink-3)" letterSpacing="0.04em">OUTPUT · x̂_0</text>
              {[0,1,2,3,4].map(i => (
                <g key={i} transform={`translate(0, ${i * 32})`}>
                  <rect width={140} height={26} fill="var(--bg-2)" stroke="var(--accent)" strokeWidth={1.6} />
                  <text x={70} y={18} fontFamily="var(--mono)" fontSize={16} fill="var(--ink)" textAnchor="middle">cat({['F','25k','M','PhD','42'][i]})</text>
                </g>
              ))}
            </g>
            <g stroke="var(--ink)" strokeWidth={1.2} fill="none" opacity={0.5}>
              <path d="M 160 308 H 220" /><path d="M 360 300 H 420" />
              <path d="M 590 300 H 620" /><path d="M 790 300 H 820" /><path d="M 990 300 H 1020" /><path d="M 1190 300 H 1300" />
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
          <span>Token-level architecture. Shared encoder across columns; per-column heads produce categorical distributions. {zoomed != null ? 'Showing internals of Block ' + (zoomed + 1) + '.' : 'Click any block to inspect.'}</span>
        </div>
      </div>
      <div className="page-footer">
        <div>Discrete Diffusion · Tabular</div>
        <div>NeurIPS 2026 · Generative Models Workshop</div>
      </div>
    </>
  );
}

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
          <marker id="ar" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={7} markerHeight={7} orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--ink)" />
          </marker>
        </defs>
        <text x={20} y={210} fontFamily="var(--mono)" fontSize={20} fill="var(--ink-3)">x ∈ ℝ^(d×L)</text>
        <path d="M 160 200 H 240" stroke="var(--ink)" strokeWidth={1.6} markerEnd="url(#ar)" />
        <g transform="translate(240, 150)">
          <rect width={130} height={100} fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.4} />
          <text x={65} y={48} fontFamily="var(--sans)" fontSize={20} fontWeight={600} fill="var(--ink)" textAnchor="middle">LayerNorm</text>
          <text x={65} y={72} fontFamily="var(--mono)" fontSize={14} fill="var(--ink-3)" textAnchor="middle">γ, β</text>
        </g>
        <path d="M 370 200 H 430" stroke="var(--ink)" strokeWidth={1.4} markerEnd="url(#ar)" />
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
        <path d="M 690 200 H 750" stroke="var(--ink)" strokeWidth={1.4} markerEnd="url(#ar)" />
        <g transform="translate(750, 175)">
          <circle cx={25} cy={25} r={25} fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.4} />
          <text x={25} y={32} fontFamily="var(--sans)" fontSize={26} fontWeight={600} fill="var(--ink)" textAnchor="middle">+</text>
        </g>
        <path d="M 220 200 V 80 H 770 V 175" stroke="var(--ink)" strokeWidth={1.2} fill="none" strokeDasharray="4 4" />
        <text x={490} y={70} fontFamily="var(--mono)" fontSize={14} fill="var(--ink-3)" textAnchor="middle">residual</text>
        <path d="M 800 200 H 860" stroke="var(--ink)" strokeWidth={1.4} markerEnd="url(#ar)" />
        <g transform="translate(860, 130)">
          <rect width={240} height={140} fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.4} />
          <text x={120} y={36} fontFamily="var(--sans)" fontSize={22} fontWeight={600} fill="var(--ink)" textAnchor="middle">MLP</text>
          <text x={120} y={64} fontFamily="var(--mono)" fontSize={14} fill="var(--ink-3)" textAnchor="middle">d → 4d → d</text>
          <rect x={30} y={84} width={50} height={30} fill="var(--bg)" stroke="var(--ink)" strokeWidth={1} />
          <rect x={95} y={78} width={50} height={42} fill="var(--bg)" stroke="var(--ink)" strokeWidth={1} />
          <rect x={160} y={84} width={50} height={30} fill="var(--bg)" stroke="var(--ink)" strokeWidth={1} />
          <text x={120} y={105} fontFamily="var(--mono)" fontSize={14} fill="var(--ink)" textAnchor="middle">GELU</text>
        </g>
        <path d="M 1100 200 H 1160" stroke="var(--ink)" strokeWidth={1.4} markerEnd="url(#ar)" />
        <g transform="translate(1160, 175)">
          <circle cx={25} cy={25} r={25} fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.4} />
          <text x={25} y={32} fontFamily="var(--sans)" fontSize={26} fontWeight={600} fill="var(--ink)" textAnchor="middle">+</text>
        </g>
        <path d="M 820 200 V 60 H 1180 V 175" stroke="var(--ink)" strokeWidth={1.2} fill="none" strokeDasharray="4 4" />
        <path d="M 1210 200 H 1280" stroke="var(--ink)" strokeWidth={1.6} markerEnd="url(#ar)" />
        <text x={1300} y={205} fontFamily="var(--mono)" fontSize={20} fill="var(--ink-3)">x'</text>
      </svg>
      <div className="small" style={{ fontFamily: 'var(--mono)', color: 'var(--ink-3)', fontSize: 22, marginTop: 4 }}>
        d_model = 512 · 8 heads · MLP ratio 4 · pre-norm · ~3.2M params per block
      </div>
    </div>
  );
}

// ─── Filmstrip ────────────────────────────────────────────────────────
function FilmstripContent({ slideNum, totalSlides }) {
  const COLS = ['age', 'sex', 'edu', 'work', 'race', 'income'];
  const VALUES = [
    [38, 'M', 'BS', 'Priv', 'White', '<=50K'],
    [41, 'F', 'MS', 'Gov',  'Black', '>50K'],
    [29, 'F', 'BS', 'Priv', 'Asian', '<=50K'],
    [55, 'M', 'PhD','Acad', 'White', '>50K'],
    [22, 'M', 'HS', 'Priv', 'Hisp',  '<=50K'],
    [47, 'F', 'BS', 'Priv', 'White', '>50K'],
    [34, 'M', 'MS', 'Tech', 'Black', '>50K'],
    [26, 'F', 'BS', 'Priv', 'Asian', '<=50K'],
  ];
  const [t, setT] = useState(0);
  const playingRef = useRef(true);
  useEffect(() => {
    let raf, start = performance.now();
    const dur = 5400;
    const step = (now) => {
      const e = (now - start) / dur;
      const v = Math.min(1, e);
      setT(v);
      if (v < 1) raf = requestAnimationFrame(step);
      else if (playingRef.current) {
        setTimeout(() => { start = performance.now(); raf = requestAnimationFrame(step); }, 1200);
      }
    };
    raf = requestAnimationFrame(step);
    return () => { playingRef.current = false; cancelAnimationFrame(raf); };
  }, []);
  const unmaskTime = (r, c) => {
    const base = c / COLS.length;
    const jit = (((r * 13 + c * 7) % 7) - 3) * 0.012;
    return Math.max(0, Math.min(1, base + jit));
  };
  return (
    <>
      <div className="page-header">
        <div className="label">08 · Results</div>
        <div className="label">{String(slideNum).padStart(2,'0')} / {String(totalSlides).padStart(2,'0')}</div>
      </div>
      <h2 className="h1" style={{ marginBottom: 24 }}>Reverse process, in data.</h2>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 80, alignItems: 'center', minHeight: 0, paddingBottom: 80 }}>
        <div>
          <div className="label" style={{ marginBottom: 18 }}>
            t = {Math.round((1 - t) * 1000)}  →  t = 0  ·  unmasking schedule
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: `repeat(${COLS.length}, 1fr)`, gap: 6,
            border: '1.5px solid var(--ink)', background: 'var(--ink)', padding: 1.5,
            fontFamily: 'var(--mono)', fontSize: 28, fontWeight: 500,
          }}>
            {COLS.map((c, ci) => (
              <div key={'h-' + ci} style={{
                background: 'var(--bg)', padding: '10px 14px',
                fontSize: 20, color: 'var(--ink-3)', letterSpacing: '0.04em', textTransform: 'uppercase',
              }}>{c}</div>
            ))}
            {VALUES.flatMap((row, ri) => row.map((val, ci) => {
              const ut = unmaskTime(ri, ci);
              const unmasked = t >= ut;
              const active = !unmasked && Math.abs(t - ut) < 0.06;
              const bg = active ? 'var(--accent)' : unmasked ? 'var(--bg)' : 'var(--bg-2)';
              const fg = active ? '#fff' : unmasked ? 'var(--ink)' : 'var(--ink-3)';
              return (
                <div key={`${ri}-${ci}`} style={{
                  background: bg, color: fg, padding: '12px 14px',
                  textAlign: ci === 0 || ci === 5 ? 'right' : 'left',
                  transition: 'background 200ms, color 200ms', fontVariantNumeric: 'tabular-nums',
                }}>{unmasked ? val : '[MASK]'}</div>
              );
            }))}
          </div>
          <div className="figcaption" style={{ marginTop: 22 }}>
            <span className="num">Figure 4</span>
            <span>Eight rows generated by ancestral sampling. Columns unmask left → right; each cell flips from [MASK] to a categorical sample of x̂₀.</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {[
            ['Per-row time', '38 ms / row, T=200, A100'],
            ['Throughput', '5.3k rows / second batched'],
            ['Memory', '6.1 GB · single GPU sufficient'],
            ['Determinism', 'Sample with fixed RNG seed for reproducibility'],
          ].map(([k, v]) => (
            <div key={k} style={{ borderTop: '1px solid var(--rule-soft)', paddingTop: 16 }}>
              <div className="label" style={{ marginBottom: 8 }}>{k}</div>
              <div className="body" style={{ fontSize: 26 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="page-footer">
        <div>Discrete Diffusion · Tabular</div>
        <div>NeurIPS 2026 · Generative Models Workshop</div>
      </div>
    </>
  );
}

// ─── End slide ────────────────────────────────────────────────────────
function EndSlideContent({ slideNum, totalSlides }) {
  return (
    <>
      <div className="page-header" style={{ borderBottomColor: 'var(--inv-rule)' }}>
        <div className="label" style={{ color: 'var(--inv-ink-3)' }}>End · Q&A</div>
        <div className="label" style={{ color: 'var(--inv-ink-3)' }}>{String(slideNum).padStart(2,'0')} / {String(totalSlides).padStart(2,'0')}</div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 64 }}>
        <div>
          <div className="label" style={{ color: 'var(--inv-ink-3)', marginBottom: 22, fontSize: 28 }}>
            x_0 → x_T · the deck returns to noise
          </div>
          <TokenGrid
            pattern={[ 'THANK YOU'.split('').map(c => c === ' ' ? null : c) ]}
            cell={140} gap={14} duration={2400} flickerHz={16}
            reverse={true} loop={true}
            ink="var(--inv-ink)" noiseInk="var(--inv-noise)"
          />
        </div>
        <div style={{ fontFamily: 'var(--sans)', fontSize: 36, color: 'var(--inv-ink-2)', maxWidth: 1300, lineHeight: 1.3 }}>
          Code, weights, and samples at <span style={{ color: 'var(--accent)', fontFamily: 'var(--mono)', fontSize: 32 }}>github.com/anon/tab-ddpm</span>.
        </div>
      </div>
      <div className="page-footer" style={{ color: 'var(--inv-ink-3)', borderTopColor: 'var(--inv-rule)' }}>
        <div>Discrete Diffusion · Tabular</div>
        <div>NeurIPS 2026 · Generative Models Workshop</div>
      </div>
    </>
  );
}

// ─── Diffusion strip (inline viz, used inside background slide) ────────
function DiffusionStripContent({ steps }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${steps}, 1fr)`, gap: 18 }}>
      {Array.from({ length: steps }).map((_, i) => {
        const noise = i / (steps - 1);
        return (
          <div key={i} style={{ aspectRatio: '1 / 1', position: 'relative', background: 'var(--bg-2)', border: '1px solid var(--rule-soft)' }}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
              {Array.from({length: 60}).map((_, k) => {
                const seed = (k * 7 + i * 13) % 97;
                const x = (seed * 31) % 100;
                const y = (seed * 53) % 100;
                const r = 1.4 + ((seed * 11) % 7) * 0.18;
                const op = 1 - noise * 0.7;
                return <circle key={k} cx={x} cy={y} r={r} fill="var(--ink)" opacity={op * 0.55} />;
              })}
              <ellipse cx={50} cy={50} rx={36 - i * 6} ry={26 - i * 4}
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

// ─── HeroRow — the canonical sample row that threads through the deck ──
// Same data, different states. Shown on title, in the background scrubber,
// inside the algorithm stepper, and (animated) on the end slide. Seeing
// one row resolve across the talk is the deck's narrative spine.
const HERO_COLS = ['age', 'sex', 'edu', 'work', 'race', 'income'];
const HERO_VALUES = [38, 'M', 'BS', 'Priv', 'White', '<=50K'];

function HeroRow({ state = HERO_COLS.length, highlight = -1, compact = false, headers = true, label }) {
  // state: how many cells are resolved (left-to-right). 0 = all [MASK], N = clean.
  // highlight: idx of the cell painted in accent (the "currently producing" col).
  const COLS = HERO_COLS;
  const VALS = HERO_VALUES;
  const sz = compact
    ? { val: 24, pad: '8px 12px', hdr: 18, gap: 4 }
    : { val: 28, pad: '12px 14px', hdr: 24, gap: 6 };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: 'var(--mono)' }}>
      {label && <div className="label" style={{ fontSize: 24, color: 'var(--ink-3)' }}>{label}</div>}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${COLS.length}, 1fr)`,
        gap: sz.gap,
        border: '1.5px solid var(--ink)',
        background: 'var(--ink)',
        padding: 1.5,
      }}>
        {headers && COLS.map((c, ci) => (
          <div key={'h' + ci} style={{
            background: 'var(--bg)', padding: sz.pad,
            fontSize: sz.hdr, color: 'var(--ink-3)',
            letterSpacing: '0.04em', textTransform: 'uppercase',
          }}>{c}</div>
        ))}
        {VALS.map((v, ci) => {
          const resolved = ci < state;
          const isHl = ci === highlight && resolved;
          return (
            <div key={'v' + ci} style={{
              background: isHl ? 'var(--accent)' : resolved ? 'var(--bg)' : 'var(--bg-2)',
              color: isHl ? '#fff' : resolved ? 'var(--ink)' : 'var(--ink-3)',
              padding: sz.pad, fontSize: sz.val,
              textAlign: ci === 0 || ci === COLS.length - 1 ? 'right' : 'left',
              fontVariantNumeric: 'tabular-nums',
              transition: 'background 220ms, color 220ms',
              fontWeight: isHl ? 600 : 500,
            }}>{resolved ? v : '[MASK]'}</div>
          );
        })}
      </div>
    </div>
  );
}

// ─── DiffusionScrubber — interactive continuous vs categorical comparison ──
// Replaces the background slide's static 6-panel strip. Drag the slider:
// continuous Gaussian noise on the left builds up; the hero row on the
// right loses cells to [MASK] left→right. The whole point of the paper
// in one interactive widget.
function DiffusionScrubberContent() {
  const [tRaw, setT] = useState(0);
  const t = tRaw / 1000;
  const discreteState = Math.max(0, Math.round((1 - t) * HERO_COLS.length));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'stretch' }}>

        {/* Continuous side */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="label">Continuous · Gaussian kernel</div>
          <div style={{ height: 240, background: 'var(--bg-2)', border: '1px solid var(--rule-soft)', position: 'relative' }}>
            <svg viewBox="0 0 200 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
              {Array.from({length: 140}).map((_, k) => {
                const seed = (k * 7) % 197;
                const x = ((seed * 31) % 200);
                const y = ((seed * 53) % 100);
                const r = 0.7 + ((seed * 11) % 7) * 0.18;
                return <circle key={k} cx={x} cy={y} r={r} fill="var(--ink)" opacity={t * 0.55} />;
              })}
              <ellipse cx={100} cy={50}
                rx={Math.max(0, 60 * (1 - t * 0.95))}
                ry={Math.max(0, 32 * (1 - t * 0.9))}
                fill="var(--ink)" opacity={Math.max(0, 0.65 - t * 0.55)} />
            </svg>
          </div>
          <div className="mono" style={{ fontSize: 24, color: 'var(--ink-3)' }}>
            x_t = √(α̅_t) · x_0 + √(1 − α̅_t) · ε,&nbsp; ε ~ 𝒩(0, I)
          </div>
        </div>

        {/* Discrete side */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="label">Discrete · Categorical kernel</div>
          <div style={{ height: 240, display: 'flex', alignItems: 'center' }}>
            <div style={{ width: '100%' }}>
              <HeroRow state={discreteState} headers={true} />
            </div>
          </div>
          <div className="mono" style={{ fontSize: 24, color: 'var(--ink-3)' }}>
            x_t ~ Cat(x_t; Q&#773;_t · e<sub>x_0</sub>),&nbsp; absorbing state [MASK]
          </div>
        </div>

      </div>

      {/* Slider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, paddingTop: 6 }}>
        <div className="mono" style={{ color: 'var(--ink)', minWidth: 130, fontSize: 22 }}>
          t = {String(tRaw).padStart(4, '\u00A0')}
        </div>
        <div style={{ flex: 1, position: 'relative', height: 28, display: 'flex', alignItems: 'center' }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 2, background: 'var(--rule-soft)', transform: 'translateY(-50%)' }} />
          <input type="range" min="0" max="1000" value={tRaw}
            onChange={(e) => setT(+e.target.value)}
            style={{
              position: 'relative', zIndex: 1, width: '100%',
              accentColor: 'var(--ink)',
              cursor: 'ew-resize',
            }} />
        </div>
        <div className="mono" style={{ color: 'var(--ink-3)', minWidth: 130, fontSize: 22, textAlign: 'right' }}>
          x_0&nbsp;⟶&nbsp;x_T
        </div>
      </div>
    </div>
  );
}

// ─── AlgorithmStepper — live trace of the reverse process ─────────────
// Replaces the static pseudocode block. Step through with the buttons and
// watch the hero row resolve. The active pseudocode line highlights with
// the current step. The right column of the slide stays static prose.
function AlgorithmStepperContent() {
  const N = HERO_COLS.length;       // 6 unmask steps
  const [step, setStep] = useState(0);
  const [autoplay, setAutoplay] = useState(false);

  useEffect(() => {
    if (!autoplay) return;
    if (step >= N) { setAutoplay(false); return; }
    const id = setTimeout(() => setStep(s => s + 1), 700);
    return () => clearTimeout(id);
  }, [autoplay, step]);

  // Map step → which pseudocode line to highlight.
  // step 0 → line 2 (init); step 1..N-1 → lines 4-5 (loop body); step N → line 7 (return)
  const activeLines = step === 0 ? [2] : step >= N ? [7] : [4, 5];

  const Line = ({ n, children }) => {
    const active = activeLines.includes(n);
    return (
      <div style={{
        background: active ? 'var(--tint)' : 'transparent',
        margin: '0 -8px', padding: '2px 8px',
        transition: 'background 200ms',
      }}>
        <span className="ln">{n}:</span>{children}
      </div>
    );
  };

  const Btn = ({ onClick, disabled, children, primary }) => (
    <button onClick={onClick} disabled={disabled} style={{
      appearance: 'none', border: '1.5px solid var(--ink)',
      background: primary ? 'var(--ink)' : 'transparent',
      color: primary ? 'var(--bg)' : 'var(--ink)',
      fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 600,
      letterSpacing: '0.04em', textTransform: 'uppercase',
      padding: '10px 16px', cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.35 : 1,
      transition: 'opacity 140ms',
    }}>{children}</button>
  );

  const t = N - step;
  const highlight = step > 0 && step < N ? step - 1 : -1;
  const status =
    step === 0 ? 'Initialized — every column starts in [MASK].' :
    step >= N  ? `Done — clean sample x_0 emitted.` :
                 `Step ${step} / ${N} — column "${HERO_COLS[step - 1]}" resolves to "${HERO_VALUES[step - 1]}".`;

  return (
    <div className="algorithm" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="algorithm-header">
        <span>Algorithm 1 &nbsp;·&nbsp; Ancestral sampling</span>
        <span style={{ opacity: 0.6 }}>t = {t}</span>
      </div>
      <div className="algorithm-body" style={{ paddingBottom: 20 }}>
        <Line n={1}> <b>input:</b> trained <span className="math">\hat x_0</span>, schedule <span className="math">{'\\{Q_t\\}'}</span>, length <span className="math">d</span></Line>
        <Line n={2}> <span className="math">{'x_T \\leftarrow [\\mathsf{mask}]^d'}</span></Line>
        <Line n={3}> <b>for</b>&nbsp; <span className="math">t = T, T{'{'}-{'}'}1, \dots, 1</span> &nbsp;<b>do</b></Line>
        <Line n={4}> &nbsp;&nbsp;&nbsp;&nbsp; <span className="math">\tilde x_0 \sim p_\theta(\,\cdot \mid x_t, t\,)</span></Line>
        <Line n={5}> &nbsp;&nbsp;&nbsp;&nbsp; <span className="math">x_{'{t-1}'} \sim q(x_{'{t-1}'} \mid x_t,\, \tilde x_0)</span></Line>
        <Line n={6}> <b>end for</b></Line>
        <Line n={7}> <b>return</b>&nbsp; <span className="math">x_0</span></Line>
      </div>
      <div style={{ borderTop: '1px solid var(--rule)', padding: '20px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="label" style={{ fontSize: 16 }}>Live trace</div>
        <HeroRow state={step} highlight={highlight} headers={true} />
        <div className="mono" style={{ fontSize: 20, color: 'var(--ink-2)', minHeight: 28 }}>{status}</div>
        <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
          <Btn onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}>← Back</Btn>
          <Btn primary onClick={() => setStep(s => Math.min(N, s + 1))} disabled={step >= N}>Step →</Btn>
          <Btn onClick={() => { setStep(0); setAutoplay(true); }} disabled={autoplay}>▶ Auto</Btn>
          <Btn onClick={() => { setStep(0); setAutoplay(false); }}>↻ Reset</Btn>
        </div>
      </div>
    </div>
  );
}


function ProgressBarContent() {
  // Section structure mirrors the deck's slide ordering. Each section's
  // start/end are 0-indexed slide indices.
  const SECTIONS = [
    { label: 'Title',        start: 0,  end: 1  },
    { label: 'Motivation',   start: 2,  end: 3  },
    { label: 'Method',       start: 4,  end: 8  },
    { label: 'Architecture', start: 9,  end: 10 },
    { label: 'Results',      start: 11, end: 15 },
    { label: 'Discussion',   start: 16, end: 18 },
  ];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const stage = document.querySelector('deck-stage');
    if (!stage) return;
    const handler = (e) => setIdx(e.detail.index);
    stage.addEventListener('slidechange', handler);
    return () => stage.removeEventListener('slidechange', handler);
  }, []);
  return (
    <div className="progress-bar" data-progress="true">
      <div className="progress-track">
        {SECTIONS.map((s, i) => {
          const span = s.end - s.start + 1;
          const isPast = idx > s.end;
          const isActive = idx >= s.start && idx <= s.end;
          const fill = isPast ? 1 : isActive ? (idx - s.start + 1) / span : 0;
          return (
            <div key={i} className="progress-seg" style={{ flex: span }}>
              <div className="progress-seg-bg" />
              <div className="progress-seg-fg" style={{ width: `${fill * 100}%` }} />
              <div className="progress-seg-label">{String(i + 1).padStart(2, '0')} {s.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Chart wrappers (delegate to charts.jsx components) ────────────────
function NLLChartWrap()  { return window.NLLChart  ? <window.NLLChart  variant="swiss" /> : null; }
function DistChartWrap() { return window.DistChart ? <window.DistChart variant="swiss" /> : null; }
function ArchDiagramWrap() { return window.ArchDiagram ? <window.ArchDiagram /> : null; }

// ─── Custom-element definer ─────────────────────────────────────────
function defineReactElement(tag, Component, opts = {}) {
  if (customElements.get(tag)) return;
  class El extends HTMLElement {
    connectedCallback() {
      if (this._mounted) return;
      if (!window.ReactDOM || !window.ReactDOM.createRoot) {
        // React not ready yet; poll.
        const tick = () => {
          if (!this.isConnected) return;
          if (window.ReactDOM && window.ReactDOM.createRoot) this.connectedCallback();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        return;
      }
      this._mounted = true;
      if (opts.classes) opts.classes.forEach(c => this.classList.add(c));
      this._root = ReactDOM.createRoot(this);
      const propsFromAttrs = opts.props || (() => ({}));
      const render = () => this._root.render(React.createElement(Component, propsFromAttrs(this)));
      this._render = render;
      render();
    }
    static get observedAttributes() { return opts.observed || []; }
    attributeChangedCallback() { if (this._render) this._render(); }
    disconnectedCallback() {
      if (this._root) {
        const r = this._root; this._root = null; this._mounted = false;
        Promise.resolve().then(() => r.unmount());
      }
    }
  }
  customElements.define(tag, El);
}

// Attribute readers
const readInt  = (el, name, fallback) => { const v = parseInt(el.getAttribute(name), 10); return Number.isFinite(v) ? v : fallback; };
const readStr  = (el, name, fallback) => el.getAttribute(name) ?? fallback;

// ─── Register all custom elements ─────────────────────────────────────
defineReactElement('masked-reveal', MaskedReveal, {
  observed: ['word', 'cell', 'duration'],
  props: (el) => ({
    word: readStr(el, 'word', ''),
    cell: readInt(el, 'cell', 22),
    duration: readInt(el, 'duration', 1400),
  }),
});

defineReactElement('section-divider', SectionDividerContent, {
  classes: ['section-divider'],
  observed: ['num', 'label', 'kicker', 'slide-num', 'total-slides'],
  props: (el) => ({
    num: readInt(el, 'num', 1),
    label: readStr(el, 'label', ''),
    kicker: readStr(el, 'kicker', ''),
    slideNum: readInt(el, 'slide-num', 0),
    totalSlides: readInt(el, 'total-slides', 19),
  }),
});

defineReactElement('interactive-arch', InteractiveArchContent, {
  observed: ['slide-num', 'total-slides'],
  props: (el) => ({
    slideNum: readInt(el, 'slide-num', 11),
    totalSlides: readInt(el, 'total-slides', 19),
  }),
});

defineReactElement('filmstrip-slide', FilmstripContent, {
  observed: ['slide-num', 'total-slides'],
  props: (el) => ({
    slideNum: readInt(el, 'slide-num', 15),
    totalSlides: readInt(el, 'total-slides', 19),
  }),
});

defineReactElement('end-slide', EndSlideContent, {
  classes: ['section-divider'],
  observed: ['slide-num', 'total-slides'],
  props: (el) => ({
    slideNum: readInt(el, 'slide-num', 19),
    totalSlides: readInt(el, 'total-slides', 19),
  }),
});

defineReactElement('diffusion-strip', DiffusionStripContent, {
  observed: ['steps'],
  props: (el) => ({ steps: readInt(el, 'steps', 6) }),
});

defineReactElement('hero-row', HeroRow, {
  observed: ['state', 'highlight', 'compact', 'headers', 'label'],
  props: (el) => ({
    state: readInt(el, 'state', HERO_COLS.length),
    highlight: readInt(el, 'highlight', -1),
    compact: el.hasAttribute('compact'),
    headers: el.getAttribute('headers') !== 'false',
    label: readStr(el, 'label', null) || undefined,
  }),
});

defineReactElement('diffusion-scrubber', DiffusionScrubberContent);
defineReactElement('algorithm-stepper',  AlgorithmStepperContent);

defineReactElement('nll-chart',  NLLChartWrap);
defineReactElement('dist-chart', DistChartWrap);
defineReactElement('arch-diagram', ArchDiagramWrap);

defineReactElement('progress-bar', ProgressBarContent);

// ─── Math rendering ─────────────────────────────────────────────────
// Source TeX is the element's textContent; on first encounter we
// stash it in data-tex so engine swaps can re-render from the same source.
function ensureMathJax() {
  if (window.MathJax && window.MathJax.tex2svg) return Promise.resolve();
  return new Promise((res) => {
    window.MathJax = {
      tex: { inlineMath: [['$','$'],['\\(','\\)']] },
      svg: { fontCache: 'global' },
      startup: { typeset: false, ready: () => { window.MathJax.startup.defaultReady(); res(); } },
    };
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js';
    s.async = true;
    document.head.appendChild(s);
  });
}

async function renderMath(engine) {
  const els = document.querySelectorAll('.math, .math-display');
  if (!els.length) return;

  // Snapshot source TeX once.
  els.forEach(el => {
    if (!el.hasAttribute('data-tex')) {
      el.setAttribute('data-tex', el.textContent.trim());
    }
  });

  if (engine === 'mathjax') {
    await ensureMathJax();
    els.forEach(el => {
      if (el.dataset.rendered === 'mathjax') return;
      const tex = el.getAttribute('data-tex');
      const display = el.classList.contains('math-display');
      try {
        const node = window.MathJax.tex2svg(tex, { display });
        el.innerHTML = '';
        el.appendChild(node);
        el.querySelectorAll('svg').forEach(s => { s.style.color = 'currentColor'; });
        el.dataset.rendered = 'mathjax';
      } catch (e) {
        el.textContent = tex;
      }
    });
  } else {
    if (!window.katex) {
      await new Promise(res => {
        const tick = () => window.katex ? res() : setTimeout(tick, 40);
        tick();
      });
    }
    els.forEach(el => {
      if (el.dataset.rendered === 'katex') return;
      const tex = el.getAttribute('data-tex');
      const display = el.classList.contains('math-display');
      try {
        el.innerHTML = window.katex.renderToString(tex, {
          throwOnError: false, displayMode: display, output: 'html',
        });
        el.dataset.rendered = 'katex';
      } catch (e) {
        el.textContent = tex;
      }
    });
  }
}

// ─── exports ────────────────────────────────────────────────────────
Object.assign(window, {
  TokenGrid, MaskedReveal,
  SectionDividerContent, InteractiveArchContent, FilmstripContent, EndSlideContent,
  DiffusionStripContent, DiffusionScrubberContent, AlgorithmStepperContent,
  HeroRow, ProgressBarContent,
  renderMath,
});
