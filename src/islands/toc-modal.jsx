// toc-modal.jsx — full-screen TOC overlay with slide preview. Press T to open, Esc/T to close.
import React, { useState, useEffect, useRef, useCallback } from 'react';

function buildTocData() {
  const stage = document.querySelector('deck-stage');
  if (!stage) return { sections: [], preSectionSlides: [], totalSlides: 0 };

  const children = [...stage.children];
  const totalSlides = children.length;

  const dividerMeta = children
    .map((el, i) => ({ el, i }))
    .filter(({ el }) => el.tagName.toLowerCase() === 'section-divider');

  function slideTitle(el) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'section') return el.querySelector('slide-header')?.getAttribute('title') || '';
    if (tag === 'toc-slide') return 'Outline';
    if (tag === 'end-slide') return el.getAttribute('heading') || 'End';
    return el.getAttribute('data-label') || '';
  }

  const preSectionSlides = dividerMeta.length
    ? children.slice(0, dividerMeta[0].i).map((el, i) => ({
        idx: i, title: slideTitle(el), tag: el.tagName.toLowerCase(),
      }))
    : [];

  const sections = dividerMeta.map(({ el, i }, d) => {
    const nextI = d + 1 < dividerMeta.length ? dividerMeta[d + 1].i : totalSlides;
    const slides = children.slice(i + 1, nextI).map((sel, offset) => ({
      idx: i + 1 + offset,
      title: slideTitle(sel),
      tag: sel.tagName.toLowerCase(),
    }));
    return {
      num: parseInt(el.getAttribute('num'), 10) || (d + 1),
      label: el.getAttribute('label') || `Section ${d + 1}`,
      kicker: el.getAttribute('kicker') || '',
      idx: i,
      slides,
    };
  });

  return { sections, preSectionSlides, totalSlides };
}

// ── Slide preview (clone approach) ────────────────────────────────────────

function SlidePreview({ idx }) {
  const ref = useRef(null);

  useEffect(() => {
    if (idx == null || !ref.current) return;
    const stage = document.querySelector('deck-stage');
    const slide = stage?.children[idx];
    if (!slide) return;

    const DESIGN_W = parseInt(stage.getAttribute('width') || '1920', 10);
    const DESIGN_H = parseInt(stage.getAttribute('height') || '1080', 10);
    const container = ref.current;
    const PREVIEW_W = container.offsetWidth || 380;
    const scale = PREVIEW_W / DESIGN_W;
    const PREVIEW_H = Math.round(DESIGN_H * scale);

    const clone = slide.cloneNode(true);
    // Prevent cloned custom elements from firing connectedCallback and creating
    // new React roots — _mounted is the guard checked at the top of connectedCallback.
    // IMPORTANT: include the clone root itself (querySelectorAll('*') excludes it),
    // since slide roots like <section-divider>, <toc-slide>, <end-slide> are custom elements.
    const markInert = (el) => { if (customElements.get(el.tagName.toLowerCase())) el._mounted = true; };
    markInert(clone);
    clone.querySelectorAll('*').forEach(markInert);
    // Force all data-step elements visible in the preview
    clone.querySelectorAll('[data-step]').forEach(e => e.setAttribute('data-step-visible', ''));
    clone.style.cssText = [
      'visibility:visible', 'opacity:1', 'position:relative', 'inset:auto',
      `width:${DESIGN_W}px`, `height:${DESIGN_H}px`,
      `transform:scale(${scale})`, 'transform-origin:top left',
      'pointer-events:none', 'flex-shrink:0',
    ].join(';');

    const wrapper = document.createElement('div');
    wrapper.style.cssText = [
      `width:${PREVIEW_W}px`, `height:${PREVIEW_H}px`,
      'overflow:hidden', 'border-radius:6px', 'flex-shrink:0',
    ].join(';');
    wrapper.appendChild(clone);

    container.innerHTML = '';
    container.appendChild(wrapper);
    return () => { if (container) container.innerHTML = ''; };
  }, [idx]);

  return (
    <div style={{
      position: 'relative',
      width: '100%', aspectRatio: '16/9',
      background: 'rgba(255,255,255,0.04)',
      borderRadius: 8, overflow: 'hidden',
    }}>
      {/* Imperative target — React never owns this subtree */}
      <div ref={ref} style={{ position: 'absolute', inset: 0 }} />
      {/* React-managed placeholder, separate sibling */}
      {idx == null && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--mono)', fontSize: 11,
          color: 'rgba(255,255,255,0.18)', letterSpacing: '0.06em',
          pointerEvents: 'none',
        }}>
          Hover a slide to preview
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionRow({ section, isCurrent, onClick, onMouseEnter, onMouseLeave }) {
  const [hovered, setHovered] = useState(false);
  const active = isCurrent || hovered;
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => { setHovered(true); onMouseEnter?.(); }}
      onMouseLeave={() => { setHovered(false); onMouseLeave?.(); }}
      style={{
        display: 'flex', alignItems: 'baseline', gap: 18,
        padding: '13px 16px 13px 18px',
        borderLeft: `2px solid ${active ? 'var(--accent)' : 'rgba(255,255,255,0.13)'}`,
        cursor: 'pointer', transition: 'border-color 100ms', marginLeft: -2,
      }}
    >
      <span style={{
        fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600,
        color: 'var(--accent)', letterSpacing: '0.08em', minWidth: 22, flexShrink: 0,
      }}>
        {String(section.num).padStart(2, '0')}
      </span>
      <span style={{
        fontFamily: 'var(--sans)', fontSize: 22, fontWeight: 600,
        letterSpacing: '-0.025em',
        color: active ? 'rgba(255,255,255,0.97)' : 'rgba(255,255,255,0.65)',
        transition: 'color 100ms', flex: 1,
      }}>
        {section.label}
      </span>
      {section.kicker && (
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 10, color: 'rgba(255,255,255,0.28)',
          letterSpacing: '0.07em', textTransform: 'uppercase', flexShrink: 0,
        }}>
          {section.kicker}
        </span>
      )}
      <span style={{
        fontFamily: 'var(--mono)', fontSize: 10, color: 'rgba(255,255,255,0.22)',
        letterSpacing: '0.04em', flexShrink: 0,
      }}>
        {section.slides.length}
      </span>
    </div>
  );
}

function SlideRow({ slide, isCurrent, onClick, onMouseEnter, onMouseLeave }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => { setHovered(true); onMouseEnter?.(); }}
      onMouseLeave={() => { setHovered(false); onMouseLeave?.(); }}
      style={{
        display: 'flex', alignItems: 'baseline', gap: 14,
        padding: '8px 16px 8px 48px', borderRadius: 3,
        cursor: 'pointer',
        background: isCurrent ? 'rgba(255,255,255,0.07)' : hovered ? 'rgba(255,255,255,0.032)' : 'transparent',
        transition: 'background 90ms',
      }}
    >
      <span style={{
        fontFamily: 'var(--mono)', fontSize: 9,
        color: isCurrent ? 'var(--accent)' : 'rgba(255,255,255,0.18)',
        minWidth: 20, letterSpacing: '0.05em', flexShrink: 0, lineHeight: '1.6',
      }}>
        {String(slide.idx + 1).padStart(2, '0')}
      </span>
      <span style={{
        fontFamily: 'var(--sans)', fontSize: 14,
        fontWeight: isCurrent ? 500 : 400,
        color: isCurrent ? 'rgba(255,255,255,0.95)' : hovered ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.38)',
        transition: 'color 90ms', letterSpacing: '-0.008em',
        flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {slide.title || '—'}
      </span>
      {isCurrent && (
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--accent)',
          letterSpacing: '0.08em', textTransform: 'uppercase', flexShrink: 0, opacity: 0.85,
        }}>● here</span>
      )}
    </div>
  );
}

// ── Main modal ─────────────────────────────────────────────────────────────

export function TocModal() {
  const [open, setOpen] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [tocData, setTocData] = useState({ sections: [], preSectionSlides: [], totalSlides: 0 });
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const overlayRef = useRef(null);
  const scrollRef = useRef(null);

  // Debounced hover to avoid cloning on rapid mouse sweeps
  const hoverTimer = useRef(null);
  const setHoveredDebounced = useCallback((idx) => {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHoveredIdx(idx), 40);
  }, []);
  const clearHovered = useCallback(() => {
    clearTimeout(hoverTimer.current);
    setHoveredIdx(null);
  }, []);

  const openModal = useCallback(() => {
    setTocData(buildTocData());
    setHoveredIdx(null);
    setOpen(true);
  }, []);

  const closeModal = useCallback(() => setOpen(false), []);

  const goToSlide = useCallback((idx) => {
    document.querySelector('deck-stage')?.goTo(idx);
    closeModal();
  }, [closeModal]);

  useEffect(() => {
    const stage = document.querySelector('deck-stage');
    if (!stage) return;
    const handler = (e) => setCurrentIdx(e.detail.index);
    stage.addEventListener('slidechange', handler);
    return () => stage.removeEventListener('slidechange', handler);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      const t = e.target;
      const editable = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if (!editable && (e.key === 't' || e.key === 'T') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.stopPropagation(); e.preventDefault();
        if (open) { closeModal(); return; }
        if (!document.body.dataset.modalOpen) openModal();
      } else if (e.key === 'Escape' && open) {
        e.stopPropagation();
        closeModal();
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [open, openModal, closeModal]);

  useEffect(() => {
    if (open) document.body.dataset.modalOpen = '1';
    else delete document.body.dataset.modalOpen;
  }, [open]);

  useEffect(() => {
    if (!open || !scrollRef.current) return;
    const active = scrollRef.current.querySelector('[data-current="1"]');
    active?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [open]);

  if (!open) return null;

  const { sections, preSectionSlides, totalSlides } = tocData;
  const previewIdx = hoveredIdx;

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 2147483646,
        backdropFilter: 'blur(28px) saturate(0.65)',
        WebkitBackdropFilter: 'blur(28px) saturate(0.65)',
        background: 'rgba(6,6,6,0.8)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'toc-fade-in 150ms ease',
      }}
      onClick={(e) => { if (e.target === overlayRef.current) closeModal(); }}
    >
      {/* Two-column content panel */}
      <div style={{
        width: 'min(88vw, 1280px)',
        maxHeight: '82vh',
        display: 'flex',
        flexDirection: 'row',
        gap: 0,
        animation: 'toc-rise 200ms cubic-bezier(0.16,1,0.3,1)',
        overflow: 'hidden',
      }}>
        {/* Left: slide list */}
        <div
          ref={scrollRef}
          style={{
            width: 400, flexShrink: 0,
            overflowY: 'auto', padding: '44px 0 52px 56px',
            scrollbarWidth: 'none', msOverflowStyle: 'none',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            marginBottom: 36, paddingBottom: 16, paddingRight: 32,
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}>
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: 'rgba(255,255,255,0.32)',
            }}>
              Contents — <kbd style={{
                background: 'rgba(255,255,255,0.09)', borderRadius: 3,
                padding: '2px 5px', fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.04em',
              }}>T</kbd> or <kbd style={{
                background: 'rgba(255,255,255,0.09)', borderRadius: 3,
                padding: '2px 5px', fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.04em',
              }}>ESC</kbd> to close
            </span>
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 10,
              color: 'rgba(255,255,255,0.22)', letterSpacing: '0.06em',
            }}>
              {String(currentIdx + 1).padStart(2, '0')} / {String(totalSlides).padStart(2, '0')}
            </span>
          </div>

          {/* Pre-section slides */}
          {preSectionSlides.length > 0 && (
            <div style={{ marginBottom: 28, paddingRight: 32 }}>
              {preSectionSlides.map(slide => (
                <div key={slide.idx} data-current={slide.idx === currentIdx ? '1' : '0'}>
                  <SlideRow
                    slide={slide} isCurrent={slide.idx === currentIdx}
                    onClick={() => goToSlide(slide.idx)}
                    onMouseEnter={() => setHoveredDebounced(slide.idx)}
                    onMouseLeave={clearHovered}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Sections */}
          {sections.map((section, si) => (
            <div key={si} style={{ marginBottom: 28, paddingRight: 32 }}>
              <div data-current={section.idx === currentIdx ? '1' : '0'}>
                <SectionRow
                  section={section} isCurrent={section.idx === currentIdx}
                  onClick={() => goToSlide(section.idx)}
                  onMouseEnter={() => setHoveredDebounced(section.idx)}
                  onMouseLeave={clearHovered}
                />
              </div>
              <div style={{ marginTop: 4 }}>
                {section.slides.map(slide => (
                  <div key={slide.idx} data-current={slide.idx === currentIdx ? '1' : '0'}>
                    <SlideRow
                      slide={slide} isCurrent={slide.idx === currentIdx}
                      onClick={() => goToSlide(slide.idx)}
                      onMouseEnter={() => setHoveredDebounced(slide.idx)}
                      onMouseLeave={clearHovered}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Right: slide preview */}
        <div style={{
          flex: 1, padding: '44px 56px 52px 32px',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          minWidth: 0,
        }}>
          <SlidePreview idx={previewIdx} />
          {previewIdx != null && (
            <div style={{
              marginTop: 12, fontFamily: 'var(--mono)', fontSize: 10,
              color: 'rgba(255,255,255,0.3)', letterSpacing: '0.06em',
              textAlign: 'center',
            }}>
              Slide {previewIdx + 1}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
