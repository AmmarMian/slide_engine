// apply-theme.js — writes the Swiss design system CSS vars onto :root.
// A trimmed counterpart of the deck's apply-theme; viz pages only need
// the palette + accent + font system.

import { PALETTES, FONT_SYSTEMS } from './presets.js';

export function applyTheme({
  palette = 'slate',
  accent = '#d23b1c',
  font = 'swiss-sans',
} = {}) {
  const p = PALETTES[palette] || PALETTES.slate;
  const f = FONT_SYSTEMS[font] || FONT_SYSTEMS['swiss-sans'];

  const root = document.documentElement;
  root.style.setProperty('--bg',        p.bg);
  root.style.setProperty('--bg-2',      p.bg2);
  root.style.setProperty('--ink',       p.ink);
  root.style.setProperty('--ink-2',     p.ink2);
  root.style.setProperty('--ink-3',     p.ink3);
  root.style.setProperty('--ink-4',     p.ink3);  // alias
  root.style.setProperty('--rule',      p.rule);
  root.style.setProperty('--rule-soft', p.ruleSoft);
  root.style.setProperty('--tint',      p.tint);
  root.style.setProperty('--accent',    accent);

  root.style.setProperty('--sans',  f.sans);
  root.style.setProperty('--serif', f.serif);
  root.style.setProperty('--mono',  f.mono);

  // dataset for selector-based overrides (e.g. inverted dividers)
  root.dataset.palette = palette;
  // legacy compatibility with the original code:
  root.dataset.theme = (palette === 'dark') ? 'dark' : 'light';
}

/** Read the live computed Three.js-ready colors from CSS vars.
 *  Returns hex strings + helpful derivations. */
export function readVizColors() {
  const cs = getComputedStyle(document.documentElement);
  const get = (k) => cs.getPropertyValue(k).trim();
  return {
    bg:        get('--bg'),
    bg2:       get('--bg-2'),
    ink:       get('--ink'),
    ink2:      get('--ink-2'),
    ink3:      get('--ink-3'),
    rule:      get('--rule'),
    ruleSoft:  get('--rule-soft'),
    tint:      get('--tint'),
    accent:    get('--accent'),
    isDark:    document.documentElement.dataset.palette === 'dark',
  };
}
