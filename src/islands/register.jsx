// register.jsx — defines the HTML-tag ↔ React bridge and registers every custom element.
// Each tag becomes a web component that mounts a React root into itself.
// To add a new island: import the component, call defineReactElement('your-tag', YourComponent).

import React from 'react';
import ReactDOM from 'react-dom/client';
import { MaskedReveal } from './token-grid.jsx';
import { ProgressBarContent } from './progress-bar.jsx';
import {
  SlideHeaderContent, SlideFooterContent, TocSlideContent,
  SectionDividerContent, EndSlideContent,
} from './slide-chrome.jsx';
import {
  HeroRow, DiffusionStripContent, DiffusionScrubberContent, AlgorithmStepperContent,
} from './diffusion.jsx';
import { InteractiveArchContent, FilmstripContent } from './misc-islands.jsx';
import { NLLChart, DistChart, ArchDiagram } from './charts.jsx';
import { ScatterFlow } from './d3/scatter-flow.jsx';
import { RiemannianDescent } from './d3/riemannian-descent.jsx';
import { TangentProjection } from './d3/tangent-projection.jsx';
import { AlgorithmComparison } from './d3/algorithm-comparison.jsx';
import { SPDGeodesic } from './d3/spd-geodesic.jsx';
import { PoincareDisk } from './d3/poincare-disk.jsx';
import { TitleFx } from './title-fx.jsx';
import { SpdNetArch } from './spdnet-arch.jsx';
import { RiemannPrimer } from './riemann-primer.jsx';
import { RiemannDescent } from './riemann-descent.jsx';
import { FederatedLearning } from './federated-learning.jsx';
import { RiemannTerrain } from './riemann-terrain.jsx';

// ── Bridge ─────────────────────────────────────────────────────────────────
// opts.observed : attribute names that trigger a re-render on change
// opts.props    : (element) => props object
// opts.classes  : CSS classes added to the host element (for slide-frame styling)
// opts.innerHtml: true → capture innerHTML before React mounts; passed as
//                 props.innerHtml (string) so the component can render the
//                 author's static HTML. Content is always deck-author HTML,
//                 never external input — safe to use as-is in the component.
function defineReactElement(tag, Component, opts = {}) {
  if (customElements.get(tag)) return;
  class El extends HTMLElement {
    connectedCallback() {
      if (this._mounted) return;
      this._mounted = true;
      if (opts.classes) opts.classes.forEach(c => this.classList.add(c));
      if (opts.innerHtml) this._innerHtml = this.innerHTML;
      this._root = ReactDOM.createRoot(this);
      const render = () => {
        const props = opts.props ? opts.props(this) : {};
        if (opts.innerHtml) props.innerHtml = this._innerHtml;
        this._root.render(React.createElement(Component, props));
      };
      this._render = render;
      render();
    }
    static get observedAttributes() { return opts.observed || []; }
    attributeChangedCallback() { if (this._render) this._render(); }
    disconnectedCallback() {
      if (this._root) {
        const r = this._root; this._root = null; this._mounted = false;
        Promise.resolve().then(() => r.unmount());
      }
    }
  }
  customElements.define(tag, El);
}

// ── Attribute helpers ───────────────────────────────────────────────────────
const readInt = (el, name, fallback) => { const v = parseInt(el.getAttribute(name), 10); return Number.isFinite(v) ? v : fallback; };
const readStr = (el, name, fallback) => el.getAttribute(name) ?? fallback;
const readJSON = (el, name, fallback) => { try { return JSON.parse(el.getAttribute(name)); } catch { return fallback; } };

// ── Registrations ──────────────────────────────────────────────────────────
defineReactElement('masked-reveal', MaskedReveal, {
  observed: ['word', 'cell', 'duration'],
  props: el => ({ word: readStr(el, 'word', ''), cell: readInt(el, 'cell', 22), duration: readInt(el, 'duration', 1400) }),
});

defineReactElement('section-divider', SectionDividerContent, {
  classes: ['section-divider'],
  observed: ['num', 'label', 'kicker'],
  props: el => {
    // Auto-compute section number from DOM order if num attribute is absent.
    let num = readInt(el, 'num', 0);
    if (!num) {
      const stage = document.querySelector('deck-stage');
      if (stage) num = [...stage.querySelectorAll('section-divider')].indexOf(el) + 1;
    }
    return { num: num || 1, label: readStr(el, 'label', ''), kicker: readStr(el, 'kicker', '') };
  },
});

defineReactElement('interactive-arch', InteractiveArchContent, {
  observed: ['slide-num', 'total-slides'],
  props: el => ({ slideNum: readInt(el, 'slide-num', 1), totalSlides: readInt(el, 'total-slides', 1) }),
});

defineReactElement('filmstrip-slide', FilmstripContent, {
  observed: ['slide-num', 'total-slides'],
  props: el => ({ slideNum: readInt(el, 'slide-num', 1), totalSlides: readInt(el, 'total-slides', 1) }),
});

defineReactElement('end-slide', EndSlideContent, {
  classes: ['section-divider'],
  observed: ['heading', 'kicker', 'contact'],
  props: el => ({
    heading: readStr(el, 'heading', 'THANK YOU'),
    kicker:  readStr(el, 'kicker',  'the deck returns to noise'),
    contact: readStr(el, 'contact', ''),
  }),
});

defineReactElement('diffusion-strip', DiffusionStripContent, {
  observed: ['steps'],
  props: el => ({ steps: readInt(el, 'steps', 6) }),
});

defineReactElement('hero-row', HeroRow, {
  observed: ['state', 'highlight', 'compact', 'headers', 'label'],
  props: el => ({
    state:     readInt(el, 'state', 6),
    highlight: readInt(el, 'highlight', -1),
    compact:   el.hasAttribute('compact'),
    headers:   el.getAttribute('headers') !== 'false',
    label:     readStr(el, 'label', null) || undefined,
  }),
});

defineReactElement('diffusion-scrubber', DiffusionScrubberContent);
defineReactElement('algorithm-stepper',  AlgorithmStepperContent);

defineReactElement('nll-chart',  () => React.createElement(NLLChart));
defineReactElement('dist-chart', () => React.createElement(DistChart));
defineReactElement('arch-diagram', () => React.createElement(ArchDiagram));

defineReactElement('scatter-flow', ScatterFlow, {
  observed: ['n', 'seed'],
  props: el => ({ n: readInt(el, 'n', 120), seed: readInt(el, 'seed', 42) }),
});

defineReactElement('toc-slide', TocSlideContent);

defineReactElement('slide-header', SlideHeaderContent, {
  observed: ['title'],
  props: el => ({ title: readStr(el, 'title', '') }),
});

defineReactElement('progress-bar', ProgressBarContent, {
  observed: ['sections'],
  props: el => ({ sections: readJSON(el, 'sections', null) }),
});

defineReactElement('riemannian-descent', RiemannianDescent);
defineReactElement('tangent-projection', TangentProjection);
defineReactElement('algorithm-comparison', AlgorithmComparison);
defineReactElement('spd-geodesic', SPDGeodesic);
defineReactElement('poincare-disk', PoincareDisk);
defineReactElement('title-fx', TitleFx);
defineReactElement('slide-footer', SlideFooterContent);
defineReactElement('spdnet-arch', SpdNetArch);
defineReactElement('riemann-primer', RiemannPrimer);
defineReactElement('riemann-descent', RiemannDescent);
defineReactElement('federated-learning', FederatedLearning);
defineReactElement('riemann-terrain', RiemannTerrain);
