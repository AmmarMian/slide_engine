// toc-modal.jsx — full-screen TOC overlay. Press T to open, Esc/T/click-outside to close.
import React, { useState, useEffect, useRef, useCallback } from 'react';

function buildTocData() {
  const stage = document.querySelector('deck-stage');
  if (!stage) return { sections: [], preSectionSlides: [], totalSlides: 0 };

  const children = [...stage.children];
  const totalSlides = children.length;

  const dividerMeta = children
    .map((el, i) => ({ el, i }))
    .filter(({ el }) => el.tagName.toLowerCase() === 'section-divider');

  function slideTitle(el, fallbackIdx) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'section') {
      return el.querySelector('slide-header')?.getAttribute('title') || '';
    }
    if (tag === 'toc-slide') return 'Outline';
    if (tag === 'end-slide') return el.getAttribute('heading') || 'End';
    return el.getAttribute('data-label') || '';
  }

  const preSectionSlides = dividerMeta.length
    ? children.slice(0, dividerMeta[0].i).map((el, i) => ({
        idx: i, title: slideTitle(el, i), tag: el.tagName.toLowerCase(),
      }))
    : [];

  const sections = dividerMeta.map(({ el, i }, d) => {
    const nextI = d + 1 < dividerMeta.length ? dividerMeta[d + 1].i : totalSlides;
    const slides = children.slice(i + 1, nextI).map((sel, offset) => ({
      idx: i + 1 + offset,
      title: slideTitle(sel, i + 1 + offset),
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

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionRow({ section, isCurrent, onClick }) {
  const [hovered, setHovered] = useState(false);
  const active = isCurrent || hovered;
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 18,
        padding: '13px 16px 13px 18px',
        borderLeft: `2px solid ${active ? 'var(--accent)' : 'rgba(255,255,255,0.13)'}`,
        cursor: 'pointer',
        transition: 'border-color 100ms',
        marginLeft: -2,
      }}
    >
      <span style={{
        fontFamily: 'var(--mono)',
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--accent)',
        letterSpacing: '0.08em',
        minWidth: 22,
        flexShrink: 0,
      }}>
        {String(section.num).padStart(2, '0')}
      </span>
      <span style={{
        fontFamily: 'var(--sans)',
        fontSize: 22,
        fontWeight: 600,
        letterSpacing: '-0.025em',
        color: active ? 'rgba(255,255,255,0.97)' : 'rgba(255,255,255,0.65)',
        transition: 'color 100ms',
        flex: 1,
      }}>
        {section.label}
      </span>
      {section.kicker && (
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 10,
          color: 'rgba(255,255,255,0.28)',
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          flexShrink: 0,
        }}>
          {section.kicker}
        </span>
      )}
      <span style={{
        fontFamily: 'var(--mono)',
        fontSize: 10,
        color: 'rgba(255,255,255,0.22)',
        letterSpacing: '0.04em',
        flexShrink: 0,
      }}>
        {section.slides.length}
      </span>
    </div>
  );
}

function SlideRow({ slide, isCurrent, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 14,
        padding: '8px 16px 8px 48px',
        borderRadius: 3,
        cursor: 'pointer',
        background: isCurrent
          ? 'rgba(255,255,255,0.07)'
          : hovered
          ? 'rgba(255,255,255,0.032)'
          : 'transparent',
        transition: 'background 90ms',
      }}
    >
      <span style={{
        fontFamily: 'var(--mono)',
        fontSize: 9,
        color: isCurrent ? 'var(--accent)' : 'rgba(255,255,255,0.18)',
        minWidth: 20,
        letterSpacing: '0.05em',
        flexShrink: 0,
        lineHeight: '1.6',
      }}>
        {String(slide.idx + 1).padStart(2, '0')}
      </span>
      <span style={{
        fontFamily: 'var(--sans)',
        fontSize: 14,
        fontWeight: isCurrent ? 500 : 400,
        color: isCurrent
          ? 'rgba(255,255,255,0.95)'
          : hovered
          ? 'rgba(255,255,255,0.65)'
          : 'rgba(255,255,255,0.38)',
        transition: 'color 90ms',
        letterSpacing: '-0.008em',
        flex: 1,
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {slide.title || `—`}
      </span>
      {isCurrent && (
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 8,
          color: 'var(--accent)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          flexShrink: 0,
          opacity: 0.85,
        }}>
          ● here
        </span>
      )}
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export function TocModal() {
  const [open, setOpen] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [tocData, setTocData] = useState({ sections: [], preSectionSlides: [], totalSlides: 0 });
  const overlayRef = useRef(null);
  const scrollRef = useRef(null);

  const openModal = useCallback(() => {
    setTocData(buildTocData());
    setOpen(true);
  }, []);

  const closeModal = useCallback(() => setOpen(false), []);

  const goToSlide = useCallback((idx) => {
    document.querySelector('deck-stage')?.goTo(idx);
    closeModal();
  }, [closeModal]);

  // Track current slide index
  useEffect(() => {
    const stage = document.querySelector('deck-stage');
    if (!stage) return;
    const handler = (e) => setCurrentIdx(e.detail.index);
    stage.addEventListener('slidechange', handler);
    return () => stage.removeEventListener('slidechange', handler);
  }, []);

  // Keyboard: T toggles, Escape closes — capture phase beats deck-stage's window listener
  useEffect(() => {
    const handler = (e) => {
      if ((e.key === 't' || e.key === 'T') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.stopPropagation();
        e.preventDefault();
        open ? closeModal() : openModal();
      } else if (e.key === 'Escape' && open) {
        e.stopPropagation();
        closeModal();
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [open, openModal, closeModal]);

  // Scroll current slide into view when modal opens
  useEffect(() => {
    if (!open || !scrollRef.current) return;
    const active = scrollRef.current.querySelector('[data-current="1"]');
    active?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [open]);

  if (!open) return null;

  const { sections, preSectionSlides, totalSlides } = tocData;

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483646,
        backdropFilter: 'blur(28px) saturate(0.65)',
        WebkitBackdropFilter: 'blur(28px) saturate(0.65)',
        background: 'rgba(6,6,6,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'toc-fade-in 150ms ease',
      }}
      onClick={(e) => { if (e.target === overlayRef.current) closeModal(); }}
    >
      {/* Content panel */}
      <div
        ref={scrollRef}
        style={{
          width: 'min(70vw, 920px)',
          maxHeight: '78vh',
          overflowY: 'auto',
          padding: '44px 56px 52px',
          animation: 'toc-rise 200ms cubic-bezier(0.16, 1, 0.3, 1)',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {/* Header bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 36,
          paddingBottom: 16,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}>
          <span style={{
            fontFamily: 'var(--mono)',
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.32)',
          }}>
            Contents — <kbd style={{
              background: 'rgba(255,255,255,0.09)',
              borderRadius: 3,
              padding: '2px 5px',
              fontFamily: 'var(--mono)',
              fontSize: 9,
              letterSpacing: '0.04em',
            }}>T</kbd> or <kbd style={{
              background: 'rgba(255,255,255,0.09)',
              borderRadius: 3,
              padding: '2px 5px',
              fontFamily: 'var(--mono)',
              fontSize: 9,
              letterSpacing: '0.04em',
            }}>ESC</kbd> to close
          </span>
          <span style={{
            fontFamily: 'var(--mono)',
            fontSize: 10,
            color: 'rgba(255,255,255,0.22)',
            letterSpacing: '0.06em',
          }}>
            {String(currentIdx + 1).padStart(2, '0')} / {String(totalSlides).padStart(2, '0')}
          </span>
        </div>

        {/* Pre-section slides (title, TOC…) */}
        {preSectionSlides.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            {preSectionSlides.map(slide => (
              <div key={slide.idx} data-current={slide.idx === currentIdx ? '1' : '0'}>
                <SlideRow
                  slide={slide}
                  isCurrent={slide.idx === currentIdx}
                  onClick={() => goToSlide(slide.idx)}
                />
              </div>
            ))}
          </div>
        )}

        {/* Sections */}
        {sections.map((section, si) => (
          <div key={si} style={{ marginBottom: 28 }}>
            <div data-current={section.idx === currentIdx ? '1' : '0'}>
              <SectionRow
                section={section}
                isCurrent={section.idx === currentIdx}
                onClick={() => goToSlide(section.idx)}
              />
            </div>
            <div style={{ marginTop: 4 }}>
              {section.slides.map(slide => (
                <div key={slide.idx} data-current={slide.idx === currentIdx ? '1' : '0'}>
                  <SlideRow
                    slide={slide}
                    isCurrent={slide.idx === currentIdx}
                    onClick={() => goToSlide(slide.idx)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
