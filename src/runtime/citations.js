// citations.js — auto-numbered footnote citations for slides.
//
// Author usage:
//   1. Define references once in the deck HTML (outside <deck-stage>):
//      <script id="deck-refs" type="application/json">
//        { "austin2021": "Austin, J. et al. (2021). Structured denoising diffusion. NeurIPS." }
//      </script>
//
//   2. Cite inline in any <section>:
//      <cite-ref key="austin2021"></cite-ref>
//      Renders as a superscript [N]. Numbers are global across the whole deck,
//      assigned in first-appearance order.
//
//   3. The full citation appears automatically as a footnote bar at the bottom of
//      the slide, above the .page-footer.
//
//   4. Add <refs-slide> anywhere in <deck-stage> to get a full bibliography slide.

// Register as a do-nothing custom element so the browser parses it correctly.
customElements.define('cite-ref', class extends HTMLElement {});
customElements.define('refs-slide', class extends HTMLElement {});

function buildCiteItem(num, text) {
  const item = document.createElement('div');
  item.className = 'cite-item';
  const numEl = document.createElement('span');
  numEl.className = 'cite-item-num';
  numEl.textContent = `[${num}]`;
  item.appendChild(numEl);
  const span = document.createElement('span');
  // safe: deck-author-controlled content from an inline JSON script tag
  // eslint-disable-next-line no-unsanitized/property
  span.innerHTML = text;
  item.appendChild(span);
  return item;
}

function processCitations() {
  const refsEl = document.getElementById('deck-refs');
  if (!refsEl) return;

  let db;
  try { db = JSON.parse(refsEl.textContent); } catch { return; }

  // First pass: assign global numbers in first-appearance order across all slides.
  const globalOrder = [];
  const globalKeyToNum = {};

  document.querySelectorAll('deck-stage cite-ref[key]').forEach(el => {
    const key = el.getAttribute('key');
    if (!globalKeyToNum[key]) {
      globalKeyToNum[key] = globalOrder.length + 1;
      globalOrder.push(key);
    }
  });

  // Second pass: render inline labels and per-slide footnote bars.
  document.querySelectorAll('deck-stage > section').forEach(slide => {
    const refs = slide.querySelectorAll('cite-ref[key]');
    if (!refs.length) return;

    const slideKeys = [];
    refs.forEach(el => {
      const key = el.getAttribute('key');
      el.textContent = `[${globalKeyToNum[key]}]`;
      if (!slideKeys.includes(key)) slideKeys.push(key);
    });

    const bar = document.createElement('div');
    bar.className = 'slide-citations';
    slideKeys.forEach(key => {
      bar.appendChild(buildCiteItem(globalKeyToNum[key], db[key] || key));
    });

    // Insert before <slide-footer> which is always in the HTML at parse time.
    // Fallback: before .page-footer (React-rendered), then append.
    const anchor = slide.querySelector('slide-footer') || slide.querySelector('.page-footer');
    if (anchor) slide.insertBefore(bar, anchor);
    else slide.appendChild(bar);
  });

  // Populate <refs-slide> with the full bibliography, splitting across
  // multiple slides if needed.  Per-slide limit is set via the `per-page`
  // attribute on the element (default 14).
  document.querySelectorAll('deck-stage refs-slide').forEach(slide => {
    const perPage = Math.max(1, parseInt(slide.getAttribute('per-page') || '14', 10));
    const headerHTML = slide.innerHTML; // preserve title / header markup

    const allItems = globalOrder.map(key =>
      buildCiteItem(globalKeyToNum[key], db[key] || key)
    );
    const totalPages = Math.max(1, Math.ceil(allItems.length / perPage));

    let insertAfter = slide;

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
      allItems.slice(page * perPage, (page + 1) * perPage)
              .forEach(item => list.appendChild(item));
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
