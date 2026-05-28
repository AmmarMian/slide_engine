// search-modal.jsx — slide text search. Press / to open, Esc to close.
import React, { useState, useEffect, useRef, useCallback } from 'react';

// ── Index building ─────────────────────────────────────────────────────────

function extractBodyText(slideEl) {
  const els = slideEl.querySelectorAll('.h1,.h2,.lede,.body,.theorem-body,.pullquote,.label');
  return [...els].map(el => {
    const clone = el.cloneNode(true);
    // Remove KaTeX MathML (duplicate XML text) — leave .katex-html visible text
    clone.querySelectorAll('.katex-mathml').forEach(n => n.remove());
    return clone.textContent.replace(/\s+/g, ' ').trim();
  }).filter(t => t.length > 2).join(' ');
}

function buildSearchIndex() {
  const stage = document.querySelector('deck-stage');
  if (!stage) return [];
  const children = [...stage.children];

  // Pre-compute section label for each slide index
  const sectionLabels = [];
  let currentSection = '';
  children.forEach(el => {
    if (el.tagName.toLowerCase() === 'section-divider') {
      currentSection = el.getAttribute('label') || '';
    }
    sectionLabels.push(currentSection);
  });

  return children.map((el, idx) => {
    const tag = el.tagName.toLowerCase();
    const title = el.querySelector('slide-header')?.getAttribute('title')
               || el.getAttribute('label')
               || (tag === 'toc-slide' ? 'Outline' : '')
               || (tag === 'end-slide' ? (el.getAttribute('heading') || 'End') : '');
    const sectionLabel = sectionLabels[idx];
    const bodyText = extractBodyText(el);
    const combined = `${title} ${sectionLabel} ${bodyText}`.toLowerCase();
    return { idx, tag, title, sectionLabel, bodyText, combined };
  });
}

// ── Snippet extraction ─────────────────────────────────────────────────────

function makeSnippet(text, query) {
  if (!text || !query) return '';
  const lower = text.toLowerCase();
  const pos = lower.indexOf(query.toLowerCase());
  if (pos === -1) return text.slice(0, 120);
  const start = Math.max(0, pos - 50);
  const end = Math.min(text.length, pos + query.length + 70);
  const pre = (start > 0 ? '…' : '') + text.slice(start, pos);
  const match = text.slice(pos, pos + query.length);
  const post = text.slice(pos + query.length, end) + (end < text.length ? '…' : '');
  return { pre, match, post };
}

// ── Result row ─────────────────────────────────────────────────────────────

function ResultRow({ item, query, isSelected, onClick, onMouseEnter }) {
  const snippet = makeSnippet(item.bodyText, query);
  const isDivider = item.tag === 'section-divider';
  return (
    <div
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      style={{
        padding: '10px 16px',
        borderRadius: 6,
        cursor: 'pointer',
        background: isSelected ? 'rgba(255,255,255,0.09)' : 'transparent',
        transition: 'background 80ms',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 9,
          color: isSelected ? 'var(--accent)' : 'rgba(255,255,255,0.22)',
          minWidth: 22, letterSpacing: '0.05em', flexShrink: 0,
        }}>
          {String(item.idx + 1).padStart(2, '0')}
        </span>
        <span style={{
          fontFamily: 'var(--sans)', fontSize: 15,
          fontWeight: isDivider ? 600 : (isSelected ? 500 : 400),
          color: isSelected ? 'rgba(255,255,255,0.97)' : 'rgba(255,255,255,0.7)',
          flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          letterSpacing: '-0.01em',
        }}>
          {item.title || '—'}
        </span>
        {item.sectionLabel && (
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 9,
            color: 'rgba(255,255,255,0.22)', letterSpacing: '0.06em',
            textTransform: 'uppercase', flexShrink: 0,
          }}>
            {item.sectionLabel}
          </span>
        )}
      </div>
      {snippet && typeof snippet === 'object' && (
        <div className="search-snippet" style={{
          fontFamily: 'var(--sans)', fontSize: 12,
          color: 'rgba(255,255,255,0.35)', marginTop: 3, marginLeft: 32,
          lineHeight: 1.5, letterSpacing: '0.005em',
        }}>
          {snippet.pre}<em>{snippet.match}</em>{snippet.post}
        </div>
      )}
    </div>
  );
}

// ── Main modal ─────────────────────────────────────────────────────────────

export function SearchModal() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const overlayRef = useRef(null);

  const openModal = useCallback(() => {
    setIndex(buildSearchIndex());
    setQuery('');
    setSelectedIdx(0);
    setOpen(true);
  }, []);

  const closeModal = useCallback(() => setOpen(false), []);

  const goToSlide = useCallback((slideIdx) => {
    document.querySelector('deck-stage')?.goTo(slideIdx);
    closeModal();
  }, [closeModal]);

  // / key opens, Esc closes
  useEffect(() => {
    const handler = (e) => {
      const t = e.target;
      const editable = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      // Match the `/` glyph regardless of shift state. On some layouts (French AZERTY)
      // `/` is produced via Shift + another key, so excluding shiftKey would break it.
      // Shortcuts modal claims `?` only, so the two keys never collide.
      if (!editable && e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (open) return;
        if (document.body.dataset.modalOpen) return;
        e.stopPropagation(); e.preventDefault();
        openModal();
      } else if (e.key === 'Escape' && open) {
        e.stopPropagation();
        closeModal();
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [open, openModal, closeModal]);

  // Modal-open guard
  useEffect(() => {
    if (open) document.body.dataset.modalOpen = '1';
    else delete document.body.dataset.modalOpen;
  }, [open]);

  // Focus input when modal opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // Keyboard navigation within modal
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results.length > 0) {
      goToSlide(results[selectedIdx].idx);
    }
  };

  const lowerQuery = query.toLowerCase().trim();
  const results = lowerQuery
    ? index.filter(item => item.combined.includes(lowerQuery))
    : [];

  // Scroll selected result into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.children[selectedIdx];
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  // Reset selection when query changes
  useEffect(() => { setSelectedIdx(0); }, [query]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 2147483646,
        backdropFilter: 'blur(28px) saturate(0.65)',
        WebkitBackdropFilter: 'blur(28px) saturate(0.65)',
        background: 'rgba(6,6,6,0.8)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '12vh',
        animation: 'toc-fade-in 150ms ease',
      }}
      onClick={(e) => { if (e.target === overlayRef.current) closeModal(); }}
    >
      <div
        onKeyDown={onKeyDown}
        style={{
          width: 'min(640px, 90vw)',
          background: 'rgba(16,15,14,0.96)',
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          animation: 'toc-rise 200ms cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* Search input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 18px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 16, flexShrink: 0 }}>⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search slides…"
            style={{
              flex: 1, background: 'transparent', border: 0, outline: 'none',
              fontFamily: 'var(--sans)', fontSize: 16, color: 'rgba(255,255,255,0.9)',
              letterSpacing: '-0.01em',
            }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{
              background: 'transparent', border: 0, color: 'rgba(255,255,255,0.3)',
              cursor: 'default', fontSize: 14, padding: '2px 4px',
            }}>✕</button>
          )}
        </div>

        {/* Results */}
        <div
          ref={listRef}
          style={{
            maxHeight: '52vh', overflowY: 'auto',
            scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent',
            padding: '6px 4px',
          }}
        >
          {!lowerQuery && (
            <div style={{
              padding: '28px 20px', textAlign: 'center',
              fontFamily: 'var(--mono)', fontSize: 11,
              color: 'rgba(255,255,255,0.2)', letterSpacing: '0.06em',
            }}>
              Type to search slide titles and content
            </div>
          )}
          {lowerQuery && results.length === 0 && (
            <div style={{
              padding: '28px 20px', textAlign: 'center',
              fontFamily: 'var(--mono)', fontSize: 11,
              color: 'rgba(255,255,255,0.2)', letterSpacing: '0.06em',
            }}>
              No slides found for "{query}"
            </div>
          )}
          {results.map((item, i) => (
            <ResultRow
              key={item.idx}
              item={item}
              query={lowerQuery}
              isSelected={i === selectedIdx}
              onClick={() => goToSlide(item.idx)}
              onMouseEnter={() => setSelectedIdx(i)}
            />
          ))}
        </div>

        {/* Footer hint */}
        {results.length > 0 && (
          <div style={{
            padding: '8px 18px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', gap: 16,
            fontFamily: 'var(--mono)', fontSize: 10,
            color: 'rgba(255,255,255,0.2)', letterSpacing: '0.05em',
          }}>
            <span>↑↓ navigate</span>
            <span>↵ jump</span>
            <span>Esc close</span>
            <span style={{ marginLeft: 'auto' }}>{results.length} result{results.length !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>
    </div>
  );
}
