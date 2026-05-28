// token-grid.jsx — flickering character reveal animation + KaTeX inline renderer.
import React, { useState, useEffect, useRef, useMemo } from 'react';
import katex from 'katex';
import { GLYPHS, rng } from './shared.js';

// Inline KaTeX renderer for React islands that re-render frequently.
// Uses katex.render() (DOM API) so KaTeX manages the DOM directly — no innerHTML.
export function KatexSpan({ children, display = false, style }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) {
      katex.render(children, ref.current, { throwOnError: false, displayMode: display, output: 'html' });
    }
  }, [children, display]);
  return <span ref={ref} className={display ? 'math-display' : 'math'} style={style} />;
}

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

export function MaskedReveal({ word, cell, duration, ink }) {
  const pattern = useMemo(
    () => [word.toUpperCase().split('').map(c => c === ' ' ? null : c)],
    [word]
  );
  return <TokenGrid pattern={pattern} cell={cell} gap={2} duration={duration} ink={ink || 'var(--ink)'} flickerHz={20} />;
}
