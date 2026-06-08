// citations.js — author-year inline citations + book-icon popup per slide.
//
// Usage:
//   1. Define references in the deck HTML (outside <deck-stage>):
//      <script id="deck-refs" type="application/json">
//        { "huang2017": { "short": "Huang et al. 2017 — Riemannian Network for SPD", "full": "Huang, Z. et al. (2017). AAAI." } }
//      </script>
//      (backward compat: plain strings treated as { short: key, full: string })
//
//   2. Cite inline: <cite-ref key="huang2017"></cite-ref>
//      Renders as [Huang et al. 2017] (author-year extracted from short field).
//
//   3. A book icon appears bottom-left on slides with citations.
//      Click to open a popup showing full references for that slide.
//
//   4. Add <refs-slide> for a full bibliography slide.

customElements.define('cite-ref', class extends HTMLElement {});
customElements.define('refs-slide', class extends HTMLElement {});

// Feather "book-open" icon
const BOOK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`;

function getEntry(db, key) {
  const raw = db[key];
  if (!raw) return null;
  if (typeof raw === 'string') return { short: key, full: raw };
  return raw;
}

// Extract "Author Year" from "Author Year — Title" or "Author Year – Title"
function authorYear(entry, key) {
  if (!entry) return key;
  return (entry.short || key).split(/\s[—–]\s/)[0].trim();
}

function buildRefsItem(num, fullText) {
  const item = document.createElement('div');
  item.className = 'cite-item';
  const numEl = document.createElement('span');
  numEl.className = 'cite-item-num';
  numEl.textContent = `[${num}]`;
  item.appendChild(numEl);
  const span = document.createElement('span');
  // safe: deck-author-controlled content from an inline JSON script tag
  // eslint-disable-next-line no-unsanitized/property
  span.innerHTML = fullText;
  item.appendChild(span);
  return item;
}

function buildPopup(slideKeys, db, globalKeyToNum) {
  const popup = document.createElement('div');
  popup.className = 'cite-popup';

  slideKeys.forEach(key => {
    const entry = getEntry(db, key);
    const num   = globalKeyToNum[key];

    const item  = document.createElement('div');
    item.className = 'cite-popup-item';

    const numEl = document.createElement('span');
    numEl.className = 'cite-popup-num';
    numEl.textContent = `[${num}]`;

    const textEl = document.createElement('span');
    textEl.className = 'cite-popup-text';
    // safe: deck-author-controlled content from an inline JSON script tag
    // eslint-disable-next-line no-unsanitized/property
    textEl.innerHTML = entry ? entry.full : key;

    item.appendChild(numEl);
    item.appendChild(textEl);
    popup.appendChild(item);
  });

  return popup;
}

function processCitations() {
  const refsEl = document.getElementById('deck-refs');
  if (!refsEl) return;
  let db;
  try { db = JSON.parse(refsEl.textContent); } catch { return; }

  // First pass: assign global numbers in first-appearance order.
  const globalOrder   = [];
  const globalKeyToNum = {};
  document.querySelectorAll('deck-stage cite-ref[key]').forEach(el => {
    const key = el.getAttribute('key');
    if (!globalKeyToNum[key]) {
      globalKeyToNum[key] = globalOrder.length + 1;
      globalOrder.push(key);
    }
  });

  // Second pass: render inline author-year labels + book-icon popup per slide.
  document.querySelectorAll('deck-stage > section').forEach(slide => {
    const refs = slide.querySelectorAll('cite-ref[key]');
    if (!refs.length) return;

    const slideKeys = [];
    refs.forEach(el => {
      const key   = el.getAttribute('key');
      const entry = getEntry(db, key);
      el.textContent = `[${authorYear(entry, key)}]`;
      if (!slideKeys.includes(key)) slideKeys.push(key);
    });

    // Book icon button
    const wrap = document.createElement('div');
    wrap.className = 'cite-btn-wrap';

    const badge = document.createElement('span');
    badge.className = 'cite-btn-badge';
    badge.textContent = slideKeys.length;

    const btn = document.createElement('button');
    btn.className = 'cite-btn';
    btn.type = 'button';
    btn.innerHTML = BOOK_SVG;
    btn.setAttribute('aria-label', 'Références');

    const popup = buildPopup(slideKeys, db, globalKeyToNum);

    btn.addEventListener('click', e => {
      e.stopPropagation();
      const opening = !wrap.classList.contains('cite-open');
      // Close any other open popup on the same slide or elsewhere
      document.querySelectorAll('.cite-btn-wrap.cite-open')
              .forEach(w => w.classList.remove('cite-open'));
      if (opening) wrap.classList.add('cite-open');
    });

    wrap.appendChild(badge);
    wrap.appendChild(btn);
    wrap.appendChild(popup);

    const anchor = slide.querySelector('slide-footer') || slide.querySelector('.page-footer');
    if (anchor) slide.insertBefore(wrap, anchor);
    else slide.appendChild(wrap);
  });

  // Close popup on slide navigation.
  const stage = document.querySelector('deck-stage');
  if (stage) {
    stage.addEventListener('slidechange', () => {
      document.querySelectorAll('.cite-btn-wrap.cite-open')
              .forEach(w => w.classList.remove('cite-open'));
    });
  }

  // refs-slide full bibliography
  document.querySelectorAll('deck-stage refs-slide').forEach(slide => {
    const perPage    = Math.max(1, parseInt(slide.getAttribute('per-page') || '14', 10));
    const headerHTML = slide.innerHTML;

    const allItems = globalOrder.map(key => {
      const entry = getEntry(db, key);
      return buildRefsItem(globalKeyToNum[key], entry ? entry.full : key);
    });
    const totalPages = Math.max(1, Math.ceil(allItems.length / perPage));
    let insertAfter  = slide;

    for (let page = 0; page < totalPages; page++) {
      const target = page === 0 ? slide : document.createElement('refs-slide');
      if (page > 0) {
        target.innerHTML = headerHTML;
        insertAfter.insertAdjacentElement('afterend', target);
      }
      if (totalPages > 1) {
        const pager = document.createElement('span');
        pager.className = 'refs-slide-page';
        pager.textContent = `${page + 1} / ${totalPages}`;
        target.appendChild(pager);
      }
      const list = document.createElement('div');
      list.className = 'refs-slide-list';
      allItems.slice(page * perPage, (page + 1) * perPage).forEach(item => list.appendChild(item));
      target.appendChild(list);
      insertAfter = target;
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', processCitations);
} else {
  processCitations();
}
