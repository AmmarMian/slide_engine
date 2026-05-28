// shared.js — pure utilities shared across island components. No React, no DOM.

export const GLYPHS = '01ABCDEFGHIJKLMNOPQRSTUVWXYZ▌▐■□◧◨◢◣◤◥▲▼◆●○';

export function rng(seed) {
  let s = (seed | 0) || 1;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

export function fmt(n) { return String(n).padStart(2, '0'); }

// Given a ref inside a custom element, compute 1-based slide index and total
// (excluding end-slide from the total so counts match header labels).
export function getSlidePosition(refEl, hostSelector) {
  const host = refEl?.closest(hostSelector);
  const stage = document.querySelector('deck-stage');
  if (!host || !stage) return { idx: 0, total: 0 };
  let stageChild = host;
  while (stageChild.parentElement && stageChild.parentElement !== stage) {
    stageChild = stageChild.parentElement;
  }
  const children = [...stage.children];
  const idx = children.indexOf(stageChild) + 1;
  const total = children.filter(c => c.tagName.toLowerCase() !== 'end-slide').length;
  return { idx, total };
}

export function getSectionIdx(idx, sections) {
  for (let i = 0; i < sections.length; i++) {
    if (idx <= sections[i].end) return i;
  }
  return sections.length - 1;
}

// 5×7 bitmap digits for SectionDivider big numerals
export const DIGITS_5x7 = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['01110', '10001', '00001', '00110', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
};

export function digitPattern(text, fill = '█') {
  const rows = 7;
  const out = Array.from({ length: rows }, () => []);
  text.split('').forEach((ch, i) => {
    const glyph = DIGITS_5x7[ch];
    if (!glyph) return;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < 5; c++) out[r].push(glyph[r][c] === '1' ? fill : null);
      if (i < text.length - 1) out[r].push(null);
    }
  });
  return out;
}
