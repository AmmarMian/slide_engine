/* eslint-disable */
// Additional slides + the artistic flourishes:
//   - TokenGrid: the deck's signature motif. Letters as cells in a
//     categorical grid that flicker through K random states then lock.
//     Used by the title, section dividers, and the closing slide.
//   - ProgressBar: top-of-page progress, segmented at section boundaries.
//   - TocSlide: chapter index with active highlight.
//   - SectionDivider: full-bleed inverted slide; giant numeral built from a
//     TokenGrid; reveals the section name underneath.
//   - InteractiveArchSlide: ArchDiagram with click-to-zoom into a block,
//     revealing its transformer internals.
//   - FilmstripSlide: data-as-typography. A giant 12×N glyph grid where
//     each cell is a column value; animates from [MASK] to clean rows.
//   - EndSlide: re-mask the title back to noise. Mirrors slide 1.
//
// All components consume current --ink / --bg / --accent / --rule-soft tokens
// so palette tweaks propagate.

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ── helpers ──────────────────────────────────────────────────────────────

const GLYPHS = '01ABCDEFGHIJKLMNOPQRSTUVWXYZ▌▐■□◧◨◢◣◤◥▲▼◆●○';
const randGlyph = (seed) => GLYPHS[(seed * 2654435761) >>> 0 & 0xff % GLYPHS.length] || '0';

// Deterministic pseudo-random in [0,1) from int seed.
function rng(seed) { let s = (seed | 0) || 1; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

// ── TokenGrid ────────────────────────────────────────────────────────────
// The signature visual: a fixed grid of monospace cells. On mount, every cell
// flickers through random glyphs (categorical noise) for a brief schedule,
// then locks to its target glyph one column at a time (left → right) to
// suggest the reverse-diffusion mask schedule. Cells with target=null stay
// empty (gutter) so we can shape arbitrary letterforms.
//
// Pass a 2D array of strings/null (rows × cols).
function TokenGrid({
  pattern,                 // string[][] — null/'' means empty cell
  cell = 28,               // px per cell
  gap = 2,                 // px gap
  duration = 1200,         // total ms for noise → resolved
  delay = 0,               // ms before animation starts
  flickerHz = 18,          // glyph flips per second during noise
  ink = 'currentColor',    // resolved-cell color
  noiseInk,                // noise-cell color (defaults to ink at low alpha)
  accent,                  // override accent for highlighted cells
  highlightChar = null,    // cells matching this char render in accent
  loop = false,            // re-noise/reveal forever (used for end slide)
  reverse = false,         // animate target → noise instead of noise → target
  onDone,
  style,
}) {
  const rows = pattern.length;
  const cols = Math.max(...pattern.map(r => r.length));
  const ref = useRef(null);
  const [tick, setTick] = useState(0);

  // Per-cell unlock time (ms from start). Columns reveal left→right; jitter
  // adds organic variation. reverse=true inverts the schedule.
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
      if (elapsed < duration + 200) {
        rafId = requestAnimationFrame(step);
      } else if (loop) {
        setTimeout(() => {
          // restart
          const s2 = performance.now();
          const tick2 = (n2) => {
            const e = n2 - s2;
            setTick(e);
            if (e < duration + 200) rafId = requestAnimationFrame(tick2);
            else step(performance.now());
          };
          rafId = requestAnimationFrame(tick2);
        }, 600);
      } else if (onDone) {
        onDone();
      }
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [delay, duration, loop, onDone]);

  return (
    <div ref={ref} style={{
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
        if (target == null || target === '') {
          return <div key={`${ri}-${ci}`} />;
        }
        const t = schedule[ri][ci];
        let resolved;
        if (reverse) {
          // resolved at start, noise after t
          resolved = tick < t;
        } else {
          resolved = tick >= t;
        }
        const glyph = resolved ? target : GLYPHS[Math.floor((tick * flickerHz / 1000 + ri * 7 + ci * 13) % GLYPHS.length)];
        const isHl = highlightChar && target === highlightChar;
        return (
          <div key={`${ri}-${ci}`} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: resolved
              ? (isHl && accent ? accent : ink)
              : (noiseInk || `color-mix(in oklab, ${ink} 38%, transparent)`),
            fontWeight: resolved ? 600 : 400,
            transition: 'color 80ms linear',
          }}>{glyph}</div>
        );
      }))}
    </div>
  );
}

// 5×7 bitmap font for digits (used by SectionDivider's giant numerals).
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

// Build a TokenGrid pattern that spells `text` in 5x7 bitmap digits.
// Filled cells become a random glyph from `fill`; empty cells stay null.
function digitPattern(text, fill = '█') {
  const rows = 7;
  const out = Array.from({ length: rows }, () => []);
  text.split('').forEach((ch, i) => {
    const glyph = DIGITS_5x7[ch];
    if (!glyph) return;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < 5; c++) {
        out[r].push(glyph[r][c] === '1' ? fill : null);
      }
      // 1-cell gutter between digits
      if (i < text.length - 1) out[r].push(null);
    }
  });
  return out;
}

// ── ProgressBar ──────────────────────────────────────────────────────────
// Listens to deck-stage 'slidechange' and renders a progress strip per slide,
// segmented at section boundaries.
function ProgressBar({ sections }) {
  // sections: [{ start: idx, end: idx, label, color }]
  const [idx, setIdx] = useState(0);
  const [total, setTotal] = useState(sections[sections.length - 1].end + 1);

  useEffect(() => {
    const stage = document.querySelector('deck-stage');
    if (!stage) return;
    const handler = (e) => {
      setIdx(e.detail.index);
      setTotal(e.detail.total);
    };
    stage.addEventListener('slidechange', handler);
    return () => stage.removeEventListener('slidechange', handler);
  }, []);

  const activeSection = sections.find(s => idx >= s.start && idx <= s.end);

  return (
    <div className="progress-bar" data-progress="true">
      <div className="progress-track">
        {sections.map((s, i) => {
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

// ── TocSlide ─────────────────────────────────────────────────────────────
function TocSlide({ sections }) {
  return (
    <section data-label="02 Contents" data-om-validate>
      <div className="page-header">
        <div className="label">Contents</div>
        <div className="label">02 / 18</div>
      </div>
      <h2 className="h1" style={{ marginBottom: 56 }}>What we will cover.</h2>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px 96px', alignContent: 'start' }}>
        {sections.map((s, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 80px', alignItems: 'baseline', gap: 24, paddingBottom: 22, borderBottom: '1px solid var(--rule-soft)' }}>
            <div className="mono" style={{ color: 'var(--accent)', fontSize: 32, fontWeight: 600 }}>
              {String(i + 1).padStart(2, '0')}
            </div>
            <div>
              <div style={{ fontSize: 36, fontWeight: 600, lineHeight: 1.1, color: 'var(--ink)', letterSpacing: '-0.02em' }}>{s.label}</div>
              <div className="small" style={{ marginTop: 8, fontSize: 22 }}>{s.blurb}</div>
            </div>
            <div className="mono" style={{ textAlign: 'right', color: 'var(--ink-3)', fontSize: 24 }}>
              {String(s.start + 1).padStart(2, '0')}–{String(s.end + 1).padStart(2, '0')}
            </div>
          </div>
        ))}
      </div>
      <div className="page-footer">
        <div>Discrete Diffusion · Tabular</div>
        <div>NeurIPS 2026 · Generative Models Workshop</div>
      </div>
    </section>
  );
}

// ── SectionDivider ───────────────────────────────────────────────────────
// Inverted full-bleed slide. Big bitmap numeral made of TokenGrid cells.
// Reveals as token-flicker → solid. Section name appears next to it.
function SectionDivider({ num, label, kicker, dataLabel, slideNum, totalSlides }) {
  const pattern = useMemo(() => digitPattern(String(num).padStart(2, '0'), '█'), [num]);
  return (
    <section data-label={dataLabel} data-om-validate className="section-divider">
      <div className="page-header" style={{ borderBottomColor: 'var(--inv-rule)' }}>
        <div className="label" style={{ color: 'var(--inv-ink-3)' }}>{kicker}</div>
        <div className="label" style={{ color: 'var(--inv-ink-3)' }}>{String(slideNum).padStart(2,'0')} / {String(totalSlides).padStart(2,'0')}</div>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 100, alignItems: 'center', minHeight: 0 }}>
        <TokenGrid
          pattern={pattern}
          cell={64}
          gap={3}
          duration={1400}
          flickerHz={22}
          ink="var(--inv-ink)"
          noiseInk="var(--inv-noise)"
        />
        <div>
          <div className="label" style={{ color: 'var(--accent)', marginBottom: 18, fontSize: 28 }}>
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
    </section>
  );
}

// ── Title slide w/ token-flicker entrance ────────────────────────────────
// Title text is laid out as ordinary characters but covered by a TokenGrid
// underneath — for now we keep the original handsome typography and add the
// signature motif in the upper-left as a "[mask]…[paper]" reveal strip.
function MaskedReveal({ word, cell = 22, duration = 1400, ink = 'var(--ink)' }) {
  const pattern = useMemo(() => [word.toUpperCase().split('').map(c => c === ' ' ? null : c)], [word]);
  return <TokenGrid pattern={pattern} cell={cell} gap={2} duration={duration} ink={ink} flickerHz={20} />;
}

// ── InteractiveArchSlide ─────────────────────────────────────────────────
// Click any encoder block in the diagram to zoom in and reveal its internals
// (multi-head attention + MLP + residual). Click again to zoom out.
function InteractiveArchSlide() {
  const [zoomed, setZoomed] = useState(null); // null | 0..3
  const blocks = [
    { id: 0, label: 'Block 1', detail: 'Self-attention · 8 heads' },
    { id: 1, label: 'Block 2', detail: 'Self-attention · 8 heads' },
    { id: 2, label: 'Block 3', detail: 'Self-attention · 8 heads' },
    { id: 3, label: 'Block 4', detail: 'Self-attention · 8 heads' },
  ];

  return (
    <section data-label="11 Architecture" data-om-validate>
      <div className="page-header">
        <div className="label">06 · Architecture</div>
        <div className="label">11 / 18</div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 24 }}>
        <h2 className="h1">Architecture — click a block.</h2>
        <div className="small" style={{ fontSize: 22, color: 'var(--ink-3)' }}>
          {zoomed != null ? '↩ click to collapse' : 'interactive · click any encoder block'}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0, paddingBottom: 60 }}>
        <div style={{ position: 'relative', width: '100%', height: 600 }}>
          {/* High-level diagram */}
          <svg viewBox="0 0 1760 600" width="100%" height="100%" style={{ display: 'block', opacity: zoomed != null ? 0.16 : 1, transition: 'opacity 320ms ease' }}>
            {/* Input tokens */}
            <g transform="translate(40, 220)">
              <text x={0} y={-24} fontFamily="var(--mono)" fontSize={20} fill="var(--ink-3)" letterSpacing="0.04em">INPUT · x_t</text>
              {[0,1,2,3,4].map(i => (
                <g key={i} transform={`translate(0, ${i * 32})`}>
                  <rect width={120} height={26} fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.4} />
                  <text x={60} y={18} fontFamily="var(--mono)" fontSize={16} fill="var(--ink)" textAnchor="middle">[MASK]</text>
                </g>
              ))}
            </g>

            {/* Embedding */}
            <g transform="translate(220, 220)">
              <rect width={140} height={160} fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.6} />
              <text x={70} y={88} fontFamily="var(--sans)" fontSize={22} fontWeight={600} fill="var(--ink)" textAnchor="middle">Embed</text>
              <text x={70} y={114} fontFamily="var(--mono)" fontSize={16} fill="var(--ink-3)" textAnchor="middle">+ time t</text>
            </g>

            {/* Encoder stack — clickable */}
            {blocks.map((b, i) => (
              <g key={b.id} transform={`translate(${420 + i * 200}, 200)`} style={{ cursor: 'pointer' }} onClick={() => setZoomed(zoomed === b.id ? null : b.id)}>
                <rect width={170} height={200} fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.8} />
                <rect width={170} height={6} y={-6} fill="var(--accent)" />
                <text x={85} y={92} fontFamily="var(--sans)" fontSize={22} fontWeight={600} fill="var(--ink)" textAnchor="middle">{b.label}</text>
                <text x={85} y={118} fontFamily="var(--mono)" fontSize={14} fill="var(--ink-3)" textAnchor="middle">attention + mlp</text>
                <text x={85} y={186} fontFamily="var(--mono)" fontSize={14} fill="var(--accent)" textAnchor="middle" letterSpacing="0.04em">↗ ZOOM</text>
              </g>
            ))}

            {/* Per-column heads */}
            <g transform="translate(1300, 130)">
              <text x={0} y={-12} fontFamily="var(--mono)" fontSize={20} fill="var(--ink-3)" letterSpacing="0.04em">PER-COLUMN HEADS</text>
              {[0,1,2,3,4].map(i => (
                <g key={i} transform={`translate(0, ${i * 64})`}>
                  <rect width={200} height={48} fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.4} />
                  <text x={20} y={30} fontFamily="var(--mono)" fontSize={16} fill="var(--ink)">col_{i}: K_{i}-way</text>
                </g>
              ))}
            </g>

            {/* Output */}
            <g transform="translate(1560, 220)">
              <text x={0} y={-24} fontFamily="var(--mono)" fontSize={20} fill="var(--ink-3)" letterSpacing="0.04em">OUTPUT · x̂_0</text>
              {[0,1,2,3,4].map(i => (
                <g key={i} transform={`translate(0, ${i * 32})`}>
                  <rect width={140} height={26} fill="var(--bg-2)" stroke="var(--accent)" strokeWidth={1.6} />
                  <text x={70} y={18} fontFamily="var(--mono)" fontSize={16} fill="var(--ink)" textAnchor="middle">cat({['F','25k','M','PhD','42'][i]})</text>
                </g>
              ))}
            </g>

            {/* Connecting lines */}
            <g stroke="var(--ink)" strokeWidth={1.2} fill="none" opacity={0.5}>
              <path d="M 160 308 H 220" /> <path d="M 360 300 H 420" />
              <path d="M 590 300 H 620" /> <path d="M 790 300 H 820" /> <path d="M 990 300 H 1020" /> <path d="M 1190 300 H 1300" />
              <path d="M 1500 250 H 1560" />
            </g>
          </svg>

          {/* Zoom overlay — block internals */}
          {zoomed != null && (
            <div onClick={() => setZoomed(null)} style={{
              position: 'absolute', inset: 0,
              background: 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'zoom-out',
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
    </section>
  );
}

function BlockInternals({ blockNum }) {
  return (
    <div style={{
      width: '100%', maxWidth: 1500, height: 540,
      background: 'var(--bg)',
      border: '2px solid var(--ink)',
      padding: '32px 48px', boxSizing: 'border-box',
      display: 'flex', flexDirection: 'column', gap: 20,
      animation: 'zoomIn 280ms cubic-bezier(.2,.8,.2,1)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ fontFamily: 'var(--sans)', fontSize: 44, fontWeight: 600, letterSpacing: '-0.02em' }}>
          Encoder Block {blockNum}
        </div>
        <div className="mono" style={{ color: 'var(--accent)', fontSize: 24 }}>↩ click to collapse</div>
      </div>
      <svg viewBox="0 0 1400 380" width="100%" height="380" style={{ display: 'block' }}>
        <defs>
          <marker id="ar" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={7} markerHeight={7} orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--ink)" />
          </marker>
        </defs>

        {/* Input arrow */}
        <text x={20} y={210} fontFamily="var(--mono)" fontSize={20} fill="var(--ink-3)">x ∈ ℝ^(d×L)</text>
        <path d="M 160 200 H 240" stroke="var(--ink)" strokeWidth={1.6} markerEnd="url(#ar)" />

        {/* LayerNorm */}
        <g transform="translate(240, 150)">
          <rect width={130} height={100} fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.4} />
          <text x={65} y={48} fontFamily="var(--sans)" fontSize={20} fontWeight={600} fill="var(--ink)" textAnchor="middle">LayerNorm</text>
          <text x={65} y={72} fontFamily="var(--mono)" fontSize={14} fill="var(--ink-3)" textAnchor="middle">γ, β</text>
        </g>
        <path d="M 370 200 H 430" stroke="var(--ink)" strokeWidth={1.4} markerEnd="url(#ar)" />

        {/* Multi-head attention */}
        <g transform="translate(430, 80)">
          <rect width={260} height={240} fill="var(--bg-2)" stroke="var(--accent)" strokeWidth={2} />
          <text x={130} y={32} fontFamily="var(--sans)" fontSize={22} fontWeight={600} fill="var(--ink)" textAnchor="middle">Multi-Head Attention</text>
          <text x={130} y={56} fontFamily="var(--mono)" fontSize={14} fill="var(--accent)" textAnchor="middle" letterSpacing="0.04em">8 HEADS · d_k = 64</text>
          {/* Mini Q/K/V */}
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

        {/* Add */}
        <g transform="translate(750, 175)">
          <circle cx={25} cy={25} r={25} fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.4} />
          <text x={25} y={32} fontFamily="var(--sans)" fontSize={26} fontWeight={600} fill="var(--ink)" textAnchor="middle">+</text>
        </g>
        {/* Residual */}
        <path d="M 220 200 V 80 H 770 V 175" stroke="var(--ink)" strokeWidth={1.2} fill="none" strokeDasharray="4 4" />
        <text x={490} y={70} fontFamily="var(--mono)" fontSize={14} fill="var(--ink-3)" textAnchor="middle">residual</text>

        <path d="M 800 200 H 860" stroke="var(--ink)" strokeWidth={1.4} markerEnd="url(#ar)" />

        {/* MLP */}
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

        {/* Add */}
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

// ── FilmstripSlide ───────────────────────────────────────────────────────
// "Data-as-typography": a 6-column × 8-row grid where each cell holds a value
// from the synthetic table. Animates left→right through the reverse process:
// columns start as [MASK] tokens, get unmasked one-by-one, ending as a clean
// generated row. Plays once on mount (and replays on slide enter).
function FilmstripSlide() {
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
  const ROWS = VALUES.length;

  const [t, setT] = useState(0); // 0..1 progress through reverse process
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
        // pause then loop
        setTimeout(() => {
          start = performance.now();
          raf = requestAnimationFrame(step);
        }, 1200);
      }
    };
    raf = requestAnimationFrame(step);
    return () => { playingRef.current = false; cancelAnimationFrame(raf); };
  }, []);

  // unmask schedule per (row, col) — earlier columns unmask first
  const unmaskTime = (r, c) => {
    const base = c / COLS.length;        // 0..1 by column
    const jit = (((r * 13 + c * 7) % 7) - 3) * 0.012;
    return Math.max(0, Math.min(1, base + jit));
  };

  return (
    <section data-label="14 Filmstrip" data-om-validate>
      <div className="page-header">
        <div className="label">08 · Results</div>
        <div className="label">14 / 18</div>
      </div>
      <h2 className="h1" style={{ marginBottom: 24 }}>Reverse process, in data.</h2>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 80, alignItems: 'center', minHeight: 0, paddingBottom: 60 }}>
        <div>
          <div className="label" style={{ marginBottom: 18 }}>
            t = {Math.round((1 - t) * 1000)}  →  t = 0  ·  unmasking schedule
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${COLS.length}, 1fr)`,
            gap: 6,
            border: '1.5px solid var(--ink)',
            background: 'var(--ink)',
            padding: 1.5,
            fontFamily: 'var(--mono)',
            fontSize: 28, fontWeight: 500,
          }}>
            {COLS.map((c, ci) => (
              <div key={'h-' + ci} style={{
                background: 'var(--bg)', padding: '10px 14px',
                fontSize: 20, color: 'var(--ink-3)',
                letterSpacing: '0.04em', textTransform: 'uppercase',
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
                  background: bg, color: fg,
                  padding: '12px 14px',
                  textAlign: ci === 0 || ci === 5 ? 'right' : 'left',
                  transition: 'background 200ms, color 200ms',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {unmasked ? val : '[MASK]'}
                </div>
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
    </section>
  );
}

// ── EndSlide ─────────────────────────────────────────────────────────────
// Mirrors the title — same big text, but reverse=true so it dissolves into
// noise. Acts as the deck's bookend.
function EndSlide() {
  return (
    <section data-label="18 End" data-om-validate className="section-divider">
      <div className="page-header" style={{ borderBottomColor: 'var(--inv-rule)' }}>
        <div className="label" style={{ color: 'var(--inv-ink-3)' }}>End · Q&A</div>
        <div className="label" style={{ color: 'var(--inv-ink-3)' }}>18 / 18</div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 64 }}>
        <div>
          <div className="label" style={{ color: 'var(--accent)', marginBottom: 22, fontSize: 28 }}>
            x_0 → x_T · the deck returns to noise
          </div>
          <TokenGrid
            pattern={[ 'THANK YOU'.split('').map(c => c === ' ' ? null : c) ]}
            cell={140}
            gap={14}
            duration={2400}
            flickerHz={16}
            reverse={true}
            loop={true}
            ink="var(--inv-ink)"
            noiseInk="var(--inv-noise)"
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
    </section>
  );
}

// ── exports ──────────────────────────────────────────────────────────────
Object.assign(window, {
  TokenGrid, MaskedReveal, ProgressBar, TocSlide, SectionDivider,
  InteractiveArchSlide, FilmstripSlide, EndSlide, BlockInternals,
});
