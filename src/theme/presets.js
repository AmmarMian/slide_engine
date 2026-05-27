// presets.js — single source of truth for all theme presets.
// Consumed by apply-theme.js (CSS var writer) and tweaks-panel.jsx (UI).

export const PALETTES = {
  paper: {
    bg: '#f4f3ef', bg2: '#ffffff',
    ink: '#0a0a0a', ink2: '#2a2a2a', ink3: '#6e6e6e',
    rule: '#0a0a0a', ruleSoft: 'rgba(10,10,10,0.14)', tint: '#ebe9e0',
  },
  warm: {
    bg: '#f7f1e6', bg2: '#fdf8eb',
    ink: '#1a1410', ink2: '#3a3328', ink3: '#7a6b54',
    rule: '#1a1410', ruleSoft: 'rgba(26,20,16,0.18)', tint: '#ede2c9',
  },
  cool: {
    bg: '#f1f3f6', bg2: '#ffffff',
    ink: '#0c1422', ink2: '#2a3550', ink3: '#5a6680',
    rule: '#0c1422', ruleSoft: 'rgba(12,20,34,0.14)', tint: '#dbe0eb',
  },
  dark: {
    bg: '#0e0d0b', bg2: '#1a1815',
    ink: '#f3eee0', ink2: '#cabf9f', ink3: '#8a8170',
    rule: '#f3eee0', ruleSoft: 'rgba(243,238,224,0.18)', tint: '#26211a',
  },
  slate: {
    bg: '#f0f0f2', bg2: '#ffffff',
    ink: '#161820', ink2: '#2e3040', ink3: '#666880',
    rule: '#161820', ruleSoft: 'rgba(22,24,32,0.12)', tint: '#dddde8',
  },
  forest: {
    bg: '#f2f4f0', bg2: '#ffffff',
    ink: '#141a10', ink2: '#2a3420', ink3: '#617050',
    rule: '#141a10', ruleSoft: 'rgba(20,26,16,0.14)', tint: '#dde4d4',
  },
};

export const FONT_SYSTEMS = {
  'swiss-sans': {
    sans: "'Inter Tight', -apple-system, sans-serif",
    serif: "'Newsreader', Georgia, serif",
    mono: "'JetBrains Mono', ui-monospace, monospace",
    label: 'Swiss · Inter Tight + Newsreader',
  },
  'modern-mixed': {
    sans: "'Inter', -apple-system, sans-serif",
    serif: "'Source Serif 4', Georgia, serif",
    mono: "'JetBrains Mono', ui-monospace, monospace",
    label: 'Modern · Inter + Source Serif 4',
  },
  'editorial': {
    sans: "'Inter', -apple-system, sans-serif",
    serif: "'Source Serif 4', Georgia, serif",
    mono: "'IBM Plex Mono', ui-monospace, monospace",
    label: 'Editorial · Inter + IBM Plex Mono',
  },
  'classic': {
    sans: "'IBM Plex Sans', -apple-system, sans-serif",
    serif: "'EB Garamond', Georgia, serif",
    mono: "'IBM Plex Mono', ui-monospace, monospace",
    label: 'Classic · IBM Plex + EB Garamond',
  },
};

export const DENSITIES = {
  compact:     { padX: 80,  padTop: 72,  padBot: 60,  label: 'compact' },
  comfortable: { padX: 100, padTop: 100, padBot: 80,  label: 'comfortable' },
  airy:        { padX: 140, padTop: 130, padBot: 110, label: 'airy' },
};

// Title-slide animation modes (drives the <title-fx> island + tweaks selector).
export const TITLE_FX = [
  { value: 'off',           label: 'None' },
  { value: 'flow',          label: 'Flow' },
  { value: 'constellation', label: 'Constellation' },
  { value: 'dust',          label: 'Drifting dust' },
  { value: 'aurora',        label: 'Aurora mesh' },
  { value: 'halftone',      label: 'Halftone wave' },
];

// Suggested accent colors shown as swatches in the panel.
export const ACCENT_SWATCHES = [
  { label: 'Signal red',    value: '#d23b1c' },
  { label: 'Coral',         value: '#ff4f30' },
  { label: 'Indigo',        value: '#4f46e5' },
  { label: 'Azure',         value: '#2563eb' },
  { label: 'Teal',          value: '#0d9488' },
  { label: 'Amber',         value: '#d97706' },
  { label: 'Emerald',       value: '#059669' },
  { label: 'Violet',        value: '#7c3aed' },
];

// Default preset — overridden per-deck via <meta name="deck-theme">.
export const DEFAULT_PRESET = {
  palette: 'slate',
  font: 'swiss-sans',
  accent: '#d23b1c',
  density: 'compact',
  typeScale: 1,
  titleFx: 'constellation',
  foxProgress: false,
};
