// apply-theme.js — reads/writes CSS vars on :root; handles per-deck defaults + persistence.

import { PALETTES, FONT_SYSTEMS, DENSITIES, DEFAULT_PRESET, TITLE_FX } from './presets.js';

const LS_KEY = () => `deck-theme:${location.pathname}`;

// Parse the per-deck <meta name="deck-theme"> attribute.
// Format: "palette=cool;font=editorial;accent=#ff2600;density=comfortable"
function readDeckMeta() {
  const content = document.querySelector('meta[name="deck-theme"]')?.getAttribute('content');
  if (!content) return {};
  return Object.fromEntries(
    content.split(';').map(pair => {
      const [k, ...v] = pair.trim().split('=');
      return [k.trim(), v.join('=').trim()];
    }).filter(([k, v]) => k && v)
  );
}

// Apply a theme object to :root CSS vars immediately.
export function applyTheme({ palette, font, accent, density, typeScale, titleFx, foxProgress } = {}) {
  const root = document.documentElement.style;

  const p = PALETTES[palette] || PALETTES[DEFAULT_PRESET.palette];
  root.setProperty('--bg',        p.bg);
  root.setProperty('--bg-2',      p.bg2);
  root.setProperty('--ink',       p.ink);
  root.setProperty('--ink-2',     p.ink2);
  root.setProperty('--ink-3',     p.ink3);
  root.setProperty('--rule',      p.rule);
  root.setProperty('--rule-soft', p.ruleSoft);
  root.setProperty('--tint',      p.tint);

  const f = FONT_SYSTEMS[font] || FONT_SYSTEMS[DEFAULT_PRESET.font];
  root.setProperty('--sans',  f.sans);
  root.setProperty('--serif', f.serif);
  root.setProperty('--mono',  f.mono);

  root.setProperty('--accent', accent || DEFAULT_PRESET.accent);
  root.setProperty('--type-scale', typeScale != null ? typeScale : DEFAULT_PRESET.typeScale);

  const d = DENSITIES[density] || DENSITIES[DEFAULT_PRESET.density];
  root.setProperty('--d-pad-x',     d.padX  + 'px');
  root.setProperty('--d-pad-y-top', d.padTop + 'px');
  root.setProperty('--d-pad-y-bot', d.padBot + 'px');

  root.setProperty('--fx-title', titleFx || DEFAULT_PRESET.titleFx);
  root.setProperty('--fx-fox', foxProgress ? '1' : '0');
}

// Load the active preset. Priority: localStorage > deck <meta> > global default.
export function loadTheme() {
  const meta = readDeckMeta();
  // "scale" is an alias for "typeScale" in the meta tag for brevity.
  if (meta.scale != null && meta.typeScale == null) {
    meta.typeScale = parseFloat(meta.scale);
    delete meta.scale;
  } else if (meta.typeScale != null) {
    meta.typeScale = parseFloat(meta.typeScale);
  }
  // Validate titleFx against known modes; unknown values fall back to default.
  if (meta.titleFx != null) {
    const valid = TITLE_FX.map(m => m.value);
    if (!valid.includes(meta.titleFx)) delete meta.titleFx;
  }
  const deckDefault = { ...DEFAULT_PRESET, ...meta };
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY()) || 'null');
    if (saved) {
      // Back-compat: if old localStorage had particles:false and no titleFx, map to 'off'.
      if (saved.particles === false && saved.titleFx == null) saved.titleFx = 'off';
      delete saved.particles;
      return { ...deckDefault, ...saved };
    }
  } catch {}
  return deckDefault;
}

function emitThemeChange(full) {
  document.documentElement.dispatchEvent(
    new CustomEvent('deck-theme-change', { detail: full, bubbles: false })
  );
}

// Persist an incremental update and apply it.
export function saveTheme(partial) {
  let current;
  try { current = JSON.parse(localStorage.getItem(LS_KEY()) || 'null') || {}; }
  catch { current = {}; }
  const next = { ...current, ...partial };
  localStorage.setItem(LS_KEY(), JSON.stringify(next));
  const full = { ...loadTheme(), ...next };
  applyTheme(full);
  emitThemeChange(full);
  return full;
}

// Reset to the deck's default (clears localStorage for this deck).
export function resetTheme() {
  localStorage.removeItem(LS_KEY());
  const t = loadTheme();
  applyTheme(t);
  emitThemeChange(t);
  return t;
}

// Boot: apply the initial theme immediately when this module is imported.
export const initialTheme = loadTheme();
applyTheme(initialTheme);
