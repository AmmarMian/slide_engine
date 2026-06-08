// misc-islands.jsx — InteractiveArchContent and FilmstripContent.
import React, { useState, useEffect, useRef } from 'react';

// ─── BlockInternals (internal to InteractiveArch) ─────────────────────────────
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
        <div style={{ fontFamily: 'var(--sans)', fontSize: 'calc(44px * var(--type-scale, 1))', fontWeight: 600, letterSpacing: '-0.02em' }}>
          Encoder Block {blockNum}
        </div>
        <div className="mono" style={{ color: 'var(--ink-3)', fontSize: 'calc(24px * var(--type-scale, 1))' }}>↩ click to collapse</div>
      </div>
      <svg viewBox="0 0 1400 380" width="100%" height="380" style={{ display: 'block' }}>
        <defs>
          <marker id={`ar${blockNum}`} viewBox="0 0 10 10" refX={9} refY={5} markerWidth={7} markerHeight={7} orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--ink)" />
          </marker>
        </defs>
        <text x={20} y={210} fontFamily="var(--mono)" style={{ fontSize: 'calc(20px * var(--type-scale, 1))' }} fill="var(--ink-3)">x ∈ ℝ^(d×L)</text>
        <path d="M 160 200 H 240" stroke="var(--ink)" strokeWidth={1.6} markerEnd={`url(#ar${blockNum})`} />
        <g transform="translate(240, 150)">
          <rect width={130} height={100} fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.4} />
          <text x={65} y={48} fontFamily="var(--sans)" style={{ fontSize: 'calc(20px * var(--type-scale, 1))' }} fontWeight={600} fill="var(--ink)" textAnchor="middle">LayerNorm</text>
          <text x={65} y={72} fontFamily="var(--mono)" style={{ fontSize: 'calc(14px * var(--type-scale, 1))' }} fill="var(--ink-3)" textAnchor="middle">γ, β</text>
        </g>
        <path d="M 370 200 H 430" stroke="var(--ink)" strokeWidth={1.4} markerEnd={`url(#ar${blockNum})`} />
        <g transform="translate(430, 80)">
          <rect width={260} height={240} fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={2} />
          <text x={130} y={32} fontFamily="var(--sans)" style={{ fontSize: 'calc(22px * var(--type-scale, 1))' }} fontWeight={600} fill="var(--ink)" textAnchor="middle">Multi-Head Attention</text>
          <text x={130} y={56} fontFamily="var(--mono)" style={{ fontSize: 'calc(14px * var(--type-scale, 1))' }} fill="var(--ink-3)" textAnchor="middle" letterSpacing="0.04em">8 HEADS · d_k = 64</text>
          {['Q', 'K', 'V'].map((lbl, i) => (
            <g key={lbl} transform={`translate(${20 + i * 80}, 80)`}>
              <rect width={60} height={50} fill="var(--bg)" stroke="var(--ink)" strokeWidth={1.2} />
              <text x={30} y={31} fontFamily="var(--mono)" style={{ fontSize: 'calc(20px * var(--type-scale, 1))' }} fontWeight={600} fill="var(--ink)" textAnchor="middle">{lbl}</text>
            </g>
          ))}
          <text x={130} y={170} fontFamily="var(--mono)" style={{ fontSize: 'calc(16px * var(--type-scale, 1))' }} fill="var(--ink-3)" textAnchor="middle">softmax(QKᵀ/√d)V</text>
          <rect x={20} y={186} width={220} height={32} fill="var(--bg)" stroke="var(--ink)" strokeWidth={1.2} />
          <text x={130} y={208} fontFamily="var(--sans)" style={{ fontSize: 'calc(16px * var(--type-scale, 1))' }} fill="var(--ink)" textAnchor="middle">concat + W_O</text>
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
      <div className="small" style={{ fontFamily: 'var(--mono)', color: 'var(--ink-3)', fontSize: 'calc(22px * var(--type-scale, 1))', marginTop: 4 }}>
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
        <div className="small" style={{ fontSize: 'calc(22px * var(--type-scale, 1))', color: 'var(--ink-3)' }}>
          {zoomed != null ? '↩ click to collapse' : 'interactive · click any encoder block'}
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0, paddingBottom: 60 }}>
        <div style={{ position: 'relative', width: '100%', height: 600 }}>
          <svg viewBox="0 0 1760 600" width="100%" height="100%" style={{ display: 'block', opacity: zoomed != null ? 0.16 : 1, transition: 'opacity 320ms ease' }}>
            <g transform="translate(40, 220)">
              <text x={0} y={-24} fontFamily="var(--mono)" style={{ fontSize: 'calc(20px * var(--type-scale, 1))' }} fill="var(--ink-3)" letterSpacing="0.04em">INPUT · x_t</text>
              {[0, 1, 2, 3, 4].map(i => (
                <g key={i} transform={`translate(0, ${i * 32})`}>
                  <rect width={120} height={26} fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.4} />
                  <text x={60} y={18} fontFamily="var(--mono)" style={{ fontSize: 'calc(16px * var(--type-scale, 1))' }} fill="var(--ink)" textAnchor="middle">[MASK]</text>
                </g>
              ))}
            </g>
            <g transform="translate(220, 220)">
              <rect width={140} height={160} fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.6} />
              <text x={70} y={88} fontFamily="var(--sans)" style={{ fontSize: 'calc(22px * var(--type-scale, 1))' }} fontWeight={600} fill="var(--ink)" textAnchor="middle">Embed</text>
              <text x={70} y={114} fontFamily="var(--mono)" style={{ fontSize: 'calc(16px * var(--type-scale, 1))' }} fill="var(--ink-3)" textAnchor="middle">+ time t</text>
            </g>
            {blocks.map((b, i) => (
              <g key={b.id} transform={`translate(${420 + i * 200}, 200)`} style={{ cursor: 'pointer' }}
                onClick={() => setZoomed(zoomed === b.id ? null : b.id)}>
                <rect width={170} height={200} fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.8} />
                <rect width={170} height={6} y={-6} fill="var(--ink)" />
                <text x={85} y={92} fontFamily="var(--sans)" style={{ fontSize: 'calc(22px * var(--type-scale, 1))' }} fontWeight={600} fill="var(--ink)" textAnchor="middle">Block {i + 1}</text>
                <text x={85} y={118} fontFamily="var(--mono)" style={{ fontSize: 'calc(14px * var(--type-scale, 1))' }} fill="var(--ink-3)" textAnchor="middle">attention + mlp</text>
                <text x={85} y={186} fontFamily="var(--mono)" style={{ fontSize: 'calc(14px * var(--type-scale, 1))' }} fill="var(--ink-3)" textAnchor="middle" letterSpacing="0.04em">↗ ZOOM</text>
              </g>
            ))}
            <g transform="translate(1300, 130)">
              <text x={0} y={-12} fontFamily="var(--mono)" style={{ fontSize: 'calc(20px * var(--type-scale, 1))' }} fill="var(--ink-3)" letterSpacing="0.04em">PER-COLUMN HEADS</text>
              {[0, 1, 2, 3, 4].map(i => (
                <g key={i} transform={`translate(0, ${i * 64})`}>
                  <rect width={200} height={48} fill="var(--bg-2)" stroke="var(--ink)" strokeWidth={1.4} />
                  <text x={20} y={30} fontFamily="var(--mono)" style={{ fontSize: 'calc(16px * var(--type-scale, 1))' }} fill="var(--ink)">{`col_${i}: K${i}-way`}</text>
                </g>
              ))}
            </g>
            <g transform="translate(1560, 220)">
              <text x={0} y={-24} fontFamily="var(--mono)" style={{ fontSize: 'calc(20px * var(--type-scale, 1))' }} fill="var(--ink-3)" letterSpacing="0.04em">OUTPUT · x̂_0</text>
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
            fontFamily: 'var(--mono)', fontSize: 'calc(28px * var(--type-scale, 1))', fontWeight: 500,
          }}>
            {COLS.map((c, ci) => (
              <div key={'h' + ci} style={{ background: 'var(--bg)', padding: '10px 14px', fontSize: 'calc(20px * var(--type-scale, 1))', color: 'var(--ink-3)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{c}</div>
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
