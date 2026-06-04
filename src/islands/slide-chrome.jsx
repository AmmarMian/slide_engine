// slide-chrome.jsx — slide frame components: header, footer, TOC slide,
// section divider, and end slide.
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { fmt, getSlidePosition, digitPattern } from './shared.js';
import { TokenGrid } from './token-grid.jsx';

// ─── SlideFooter ──────────────────────────────────────────────────────────────
export function SlideFooterContent() {
  const title = document.title || '';
  const date = document.querySelector('meta[name="deck-date"]')?.getAttribute('content') || '';
  return (
    <div className="page-footer">
      <span className="label">{title}</span>
      {date && <span className="label">{date}</span>}
    </div>
  );
}

// ─── SlideHeader ──────────────────────────────────────────────────────────────
export function SlideHeaderContent({ title }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ idx: 0, total: 0 });
  const [steps, setSteps] = useState({ visible: 0, total: 0 });

  useEffect(() => {
    setPos(getSlidePosition(ref.current, 'slide-header'));

    const section = ref.current?.closest('section');
    if (!section) return;

    const readSteps = () => {
      const all = section.querySelectorAll('[data-step]');
      const visible = [...all].filter(el => el.hasAttribute('data-step-visible')).length;
      setSteps({ visible, total: all.length });
    };

    readSteps();
    const obs = new MutationObserver(readSteps);
    obs.observe(section, { subtree: true, attributes: true, attributeFilter: ['data-step-visible'] });
    return () => obs.disconnect();
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
      <div className="label">
        {fmt(pos.idx)}
        {steps.total > 0 && (
          <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>
            {' · '}{steps.visible}/{steps.total}
          </span>
        )}
        {' / '}{fmt(pos.total)}
      </div>
    </div>
  );
}

// ─── TocSlide ─────────────────────────────────────────────────────────────────
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
        .map((d, i) => ({
          num: parseInt(d.getAttribute('num'), 10) || (i + 1),
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
      <h2 className="h1" style={{ marginBottom: 52 }}>Contenu.</h2>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px 96px', alignContent: 'start' }}>
        {entries.map(e => (
          <div key={e.num} className="toc-entry" style={{ cursor: 'pointer' }}
            onClick={() => document.querySelector('deck-stage')?.goTo(e.slideNum - 1)}>
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

  const title = document.title || '';
  const date = document.querySelector('meta[name="deck-date"]')?.getAttribute('content') || '';

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
        {title && <div>{title}</div>}
        {date && <div>{date}</div>}
      </div>
    </>
  );
}

// ─── EndSlide ─────────────────────────────────────────────────────────────────
export function EndSlideContent({ heading, kicker, contact }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ idx: 0, total: 0 });
  useEffect(() => { setPos(getSlidePosition(ref.current, 'end-slide')); }, []);

  const title = document.title || '';
  const date = document.querySelector('meta[name="deck-date"]')?.getAttribute('content') || '';

  return (
    <>
      <div ref={ref} className="page-header" style={{ borderBottomColor: 'var(--inv-rule)' }}>
        <div className="label" style={{ color: 'var(--inv-ink-3)' }}>End · Q&A</div>
        <div className="label" style={{ color: 'var(--inv-ink-3)' }}>{fmt(pos.idx)} / {fmt(pos.total)}</div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 64 }}>
        <div>
          <div className="label" style={{ color: 'var(--inv-ink-3)', marginBottom: 22, fontSize: 28 }}>
            {kicker}
          </div>
          <TokenGrid
            pattern={[heading.split('').map(c => c === ' ' ? null : c)]}
            cell={140} gap={14} duration={2400} flickerHz={16}
            reverse={true} loop={true}
            ink="var(--inv-ink)" noiseInk="var(--inv-noise)"
          />
        </div>
        {contact && (
          <div style={{ fontFamily: 'var(--sans)', fontSize: 36, color: 'var(--inv-ink-2)', maxWidth: 1300, lineHeight: 1.3 }}>
            {contact}
          </div>
        )}
      </div>
      <div className="page-footer" style={{ color: 'var(--inv-ink-3)', borderTopColor: 'var(--inv-rule)' }}>
        {title && <div>{title}</div>}
        {date && <div>{date}</div>}
      </div>
    </>
  );
}
