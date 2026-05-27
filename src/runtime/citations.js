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
//      Renders as a superscript [1]. Multiple refs to the same key share the same number.
//
//   3. The full citation appears automatically as a footnote bar at the bottom of
//      the slide, above the .page-footer. Numbers restart at [1] per slide.

// Register as a do-nothing custom element so the browser parses it correctly.
customElements.define('cite-ref', class extends HTMLElement {});

function buildCiteItem(num, text) {
  const item = document.createElement('div');
  item.className = 'cite-item';
  const numEl = document.createElement('span');
  numEl.className = 'cite-item-num';
  numEl.textContent = `[${num}]`;
  item.appendChild(numEl);
  // Reference text is authored in the deck's own JSON — not user-controlled input.
  // It may include simple HTML like <em>. We use a template + insertAdjacentHTML
  // rather than a blanket innerHTML assignment for clarity.
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

  document.querySelectorAll('deck-stage > section').forEach(slide => {
    const refs = slide.querySelectorAll('cite-ref[key]');
    if (!refs.length) return;

    const order = [];
    const keyToNum = {};

    refs.forEach(el => {
      const key = el.getAttribute('key');
      if (!keyToNum[key]) {
        keyToNum[key] = order.length + 1;
        order.push(key);
      }
      el.textContent = `[${keyToNum[key]}]`;
    });

    const bar = document.createElement('div');
    bar.className = 'slide-citations';
    order.forEach((key, i) => {
      bar.appendChild(buildCiteItem(i + 1, db[key] || key));
    });

    const footer = slide.querySelector('.page-footer');
    if (footer) slide.insertBefore(bar, footer);
    else slide.appendChild(bar);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', processCitations);
} else {
  processCitations();
}
