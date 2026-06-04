// notation-modal.jsx — per-deck notation cheatsheet. Press C to open, Esc/C to close.
import React, { useState, useEffect, useRef, useCallback } from 'react';
import katex from 'katex';

function KatexCell({ latex }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) {
      katex.render(latex, ref.current, { throwOnError: false, displayMode: false });
    }
  }, [latex]);
  return <span ref={ref} />;
}

export function NotationModal() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const overlayRef = useRef(null);

  const openModal = useCallback(() => {
    const el = document.getElementById('deck-notation');
    if (el) {
      try { setData(JSON.parse(el.textContent)); }
      catch { setData(null); }
    } else {
      setData(null);
    }
    setOpen(true);
  }, []);

  const closeModal = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const handler = (e) => {
      const t = e.target;
      const editable = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if (!editable && e.key === 'c' && !e.metaKey && !e.ctrlKey && !e.altKey) {
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

  if (!open) return null;

  const sections = data?.sections ?? [];
  const title = data?.title ?? 'Notation';

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
      <div style={{
        width: 'min(680px, 92vw)',
        maxHeight: '80vh',
        display: 'flex', flexDirection: 'column',
        animation: 'toc-rise 200ms cubic-bezier(0.16,1,0.3,1)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          padding: '36px 48px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          flexShrink: 0,
        }}>
          <span style={{
            fontFamily: 'var(--sans)', fontSize: 15, fontWeight: 600,
            color: 'rgba(255,255,255,0.85)', letterSpacing: '-0.01em',
          }}>
            {title}
          </span>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)',
          }}>
            C or Esc to close
          </span>
        </div>

        {/* Scrollable body */}
        <div style={{
          overflowY: 'auto', padding: '8px 48px 40px',
          scrollbarWidth: 'none',
        }}>
          {sections.length === 0 ? (
            <p style={{
              fontFamily: 'var(--sans)', fontSize: 14,
              color: 'rgba(255,255,255,0.38)', marginTop: 24,
            }}>
              No notation defined for this deck.
              Add a <code style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>#deck-notation</code> JSON script block to the deck HTML.
            </p>
          ) : sections.map((section) => (
            <div key={section.heading} style={{ marginTop: 24 }}>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em',
                textTransform: 'uppercase', color: 'rgba(255,255,255,0.32)',
                marginBottom: 8,
              }}>
                {section.heading}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {(section.entries ?? []).map((entry, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'baseline', gap: 24,
                    padding: '7px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}>
                    <div style={{
                      flexShrink: 0, width: 180,
                      fontFamily: 'var(--mono)', fontSize: 13,
                      color: 'rgba(255,255,255,0.9)',
                    }}>
                      <KatexCell latex={entry.symbol} />
                    </div>
                    <div style={{
                      fontFamily: 'var(--sans)', fontSize: 13,
                      color: 'rgba(255,255,255,0.52)', flex: 1,
                      lineHeight: 1.45,
                    }}>
                      {entry.meaning}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
