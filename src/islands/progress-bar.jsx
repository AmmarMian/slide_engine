// progress-bar.jsx — fixed progress bar overlay with optional fox mascot.
import React, { useState, useEffect, useRef } from 'react';
import { FoxMascot } from './fox.jsx';

export function computeSectionsFromDOM() {
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

  const jumpTo = (start) => {
    document.querySelector('deck-stage')?.goTo(start);
  };

  return (
    <>
      <div className="progress-bar" data-progress="true">
        <div ref={trackRef} className="progress-track">
          {SECTIONS.map((s, i) => {
            const span = s.end - s.start + 1;
            const fill = idx > s.end ? 1 : idx >= s.start ? (idx - s.start + 1) / span : 0;
            return (
              <div key={i} className="progress-seg" style={{ flex: span, cursor: 'pointer', pointerEvents: 'auto' }}
                onClick={() => jumpTo(s.start)}>
                <div className="progress-seg-bg" />
                <div className="progress-seg-fg" style={{ width: `${fill * 100}%` }} />
              </div>
            );
          })}
        </div>
        {foxEnabled && <FoxMascot trackRef={trackRef} idx={idx} sections={SECTIONS} />}
      </div>
      <div className="progress-labels" data-progress="true">
        <div className="progress-track">
          {SECTIONS.map((s, i) => (
            <div key={i} className="progress-seg" style={{ flex: s.end - s.start + 1, cursor: 'pointer', pointerEvents: 'auto' }}
              onClick={() => jumpTo(s.start)}>
              <div className="progress-seg-label">{String(i + 1).padStart(2, '0')} {s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
