// main.js — deck engine entry point.
// Imported by every deck's <script type="module" src="/src/main.js">.

// ── Fonts (self-hosted via @fontsource) ──────────────────────────────────
// Comment out families you don't use; add @fontsource/<name> to package.json.
import '@fontsource/inter-tight/300.css';
import '@fontsource/inter-tight/400.css';
import '@fontsource/inter-tight/500.css';
import '@fontsource/inter-tight/600.css';
import '@fontsource/inter-tight/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import '@fontsource/newsreader/400.css';
import '@fontsource/newsreader/500.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/source-serif-4/400.css';
import '@fontsource/source-serif-4/500.css';
import '@fontsource/eb-garamond/400.css';
import '@fontsource/eb-garamond/500.css';

// ── Design system CSS ─────────────────────────────────────────────────────
import './theme/theme.css';

// ── Runtime (deck-stage web component) ───────────────────────────────────
import './runtime/deck-stage.js';

// ── Theme preset system ───────────────────────────────────────────────────
// apply-theme.js reads the <meta name="deck-theme"> and localStorage,
// then immediately writes CSS vars to :root. Runs as side-effect on import.
import './theme/apply-theme.js';

// ── React islands ─────────────────────────────────────────────────────────
import './islands/register.jsx';

// ── Citation footnotes ────────────────────────────────────────────────────
import './runtime/citations.js';

// ── Math rendering ────────────────────────────────────────────────────────
import { renderMath } from './math.js';

// ── Tweaks panel ──────────────────────────────────────────────────────────
import React from 'react';
import ReactDOM from 'react-dom/client';
import { TweaksPanel } from './theme/tweaks-panel.jsx';
import { TocModal } from './islands/toc-modal.jsx';

// Boot sequence
function boot() {
  const init = () => {
    renderMath();
    // Re-run on every slide change so React islands that mount after boot
    // (algorithm-stepper, etc.) get their math rendered. KaTeX's data-rendered
    // guard means already-processed elements are skipped instantly.
    const stage = document.querySelector('deck-stage');
    if (stage) stage.addEventListener('slidechange', () => renderMath());
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Mount the tweaks panel.
  const tweaksRoot = document.getElementById('tweaks-root');
  if (tweaksRoot) {
    ReactDOM.createRoot(tweaksRoot).render(React.createElement(TweaksPanel));
  }

  // Mount the TOC modal overlay (injected into body — position:fixed, above everything).
  const tocRoot = document.createElement('div');
  tocRoot.id = 'toc-modal-root';
  document.body.appendChild(tocRoot);
  ReactDOM.createRoot(tocRoot).render(React.createElement(TocModal));
}

boot();
