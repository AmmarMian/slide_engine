// shortcuts-modal.jsx — keyboard shortcut reference. Press ? to open, Esc/? to close.
import React, { useState, useEffect, useRef, useCallback } from 'react';

const SHORTCUTS = [
  { keys: ['→', 'Space', 'PgDn'], action: 'Next slide / reveal step' },
  { keys: ['←', 'PgUp'],          action: 'Previous slide / hide step' },
  { keys: ['Home'],                action: 'First slide' },
  { keys: ['End'],                 action: 'Last slide' },
  { keys: ['1 – 9'],               action: 'Jump to slide N' },
  { keys: ['R'],                   action: 'Reset to slide 1' },
  { keys: ['T'],                   action: 'Table of contents' },
  { keys: ['E'],                   action: 'Theme editor' },
  { keys: ['/'],                   action: 'Search slides' },
  { keys: ['?'],                   action: 'Keyboard shortcuts' },
  { keys: ['N'],                   action: 'Speaker notes window' },
  { keys: ['F'],                   action: 'Fullscreen toggle' },
  { keys: ['Esc'],                 action: 'Close overlay' },
];

const kbd = (key) => (
  <kbd key={key} style={{
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(255,255,255,0.09)', borderRadius: 4,
    padding: '2px 7px', fontFamily: 'var(--mono)', fontSize: 11,
    letterSpacing: '0.04em', color: 'rgba(255,255,255,0.8)',
    border: '1px solid rgba(255,255,255,0.12)',
    minWidth: 28,
  }}>{key}</kbd>
);

export function ShortcutsModal() {
  const [open, setOpen] = useState(false);
  const overlayRef = useRef(null);

  const openModal  = useCallback(() => setOpen(true),  []);
  const closeModal = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const handler = (e) => {
      const t = e.target;
      const editable = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      const isQuestion = e.key === '?';
      if (!editable && isQuestion && !e.metaKey && !e.ctrlKey && !e.altKey) {
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
        width: 'min(480px, 90vw)',
        padding: '40px 48px 44px',
        animation: 'toc-rise 200ms cubic-bezier(0.16,1,0.3,1)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          marginBottom: 28, paddingBottom: 14,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.32)',
          }}>
            Keyboard shortcuts — {kbd('?')} or {kbd('Esc')} to close
          </span>
        </div>

        {/* Shortcuts table */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {SHORTCUTS.map(({ keys, action }) => (
            <div key={action} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 16, padding: '8px 0',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}>
              <span style={{
                fontFamily: 'var(--sans)', fontSize: 14,
                color: 'rgba(255,255,255,0.55)', flex: 1,
              }}>
                {action}
              </span>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                {keys.map(k => kbd(k))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
