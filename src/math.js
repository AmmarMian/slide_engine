// math.js — render .math / .math-display elements via KaTeX (bundled).
// Call renderMath() once after the DOM is ready. Engine switching is kept
// for compat but KaTeX is the default; MathJax loads lazily from CDN only
// if explicitly requested.

import katex from 'katex';
import 'katex/dist/katex.min.css';

function snapshotSources() {
  document.querySelectorAll('.math, .math-display').forEach(el => {
    if (!el.hasAttribute('data-tex')) {
      el.setAttribute('data-tex', el.textContent.trim());
    }
  });
}

function ensureMathJax() {
  if (window.MathJax?.tex2svg) return Promise.resolve();
  return new Promise(res => {
    window.MathJax = {
      tex: { inlineMath: [['$','$'],['\\(','\\)']] },
      svg: { fontCache: 'global' },
      startup: { typeset: false, ready: () => { window.MathJax.startup.defaultReady(); res(); } },
    };
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js';
    s.async = true;
    document.head.appendChild(s);
  });
}

export async function renderMath(engine = 'katex') {
  snapshotSources();
  const els = [...document.querySelectorAll('.math, .math-display')];
  if (!els.length) return;

  if (engine === 'mathjax') {
    await ensureMathJax();
    els.forEach(el => {
      if (el.dataset.rendered === 'mathjax') return;
      const tex = el.getAttribute('data-tex');
      const display = el.classList.contains('math-display');
      try {
        const node = window.MathJax.tex2svg(tex, { display });
        el.innerHTML = ''; // safe: clearing before appending a trusted node
        el.appendChild(node);
        el.querySelectorAll('svg').forEach(s => { s.style.color = 'currentColor'; });
        el.dataset.rendered = 'mathjax';
      } catch { el.textContent = tex; }
    });
  } else {
    els.forEach(el => {
      if (el.dataset.rendered === 'katex') return;
      const tex = el.getAttribute('data-tex');
      const display = el.classList.contains('math-display');
      try {
        // katex.renderToString output is trusted library output, not user-controlled HTML
        // eslint-disable-next-line no-unsanitized/property
        el.innerHTML = katex.renderToString(tex, { throwOnError: false, displayMode: display, output: 'html' });
        el.dataset.rendered = 'katex';
      } catch { el.textContent = tex; }
    });
  }
}
