#!/usr/bin/env node
// screenshot-deck.mjs — capture each slide of a deck at design size (1920×1080).
//
// Usage:
//   node scripts/screenshot-deck.mjs              # popills_2026 by default
//   node scripts/screenshot-deck.mjs <deck-name>
//
// Output: screenshots/<deck>/NN.png (1920×1080 each).

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const DECK = process.argv[2] || 'popills_2026';
const BASE = 'http://localhost:5174';
const OUT_DIR = resolve('screenshots', DECK);

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('pageerror:', e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.warn('console.error:', msg.text());
  });

  console.log(`→ loading /decks/${DECK}/ ...`);
  await page.goto(`${BASE}/decks/${DECK}/`, { waitUntil: 'networkidle' });
  // Wait for the deck stage to be present and report a slide count.
  await page.waitForFunction(() => {
    const s = document.querySelector('deck-stage');
    return s && typeof s.length === 'number' && s.length > 0;
  }, null, { timeout: 15000 });

  const total = await page.evaluate(() => document.querySelector('deck-stage').length);
  console.log(`✓ deck has ${total} slides`);

  for (let i = 0; i < total; i++) {
    await page.evaluate((n) => document.querySelector('deck-stage').goTo(n), i);
    // Reveal ALL data-step items so the slide shows its final state.
    await page.evaluate(() => {
      const active = document.querySelector('[data-deck-active]');
      if (!active) return;
      active.querySelectorAll('[data-step]').forEach(el => el.setAttribute('data-step-visible', ''));
    });
    // Force deck-stage to recompute its scale transform — some slides with
    // reactive islands settle into the wrong scale otherwise.
    await page.evaluate(() => {
      const s = document.querySelector('deck-stage');
      if (s && typeof s._fit === 'function') s._fit();
      window.dispatchEvent(new Event('resize'));
    });
    // Give React + KaTeX + Three.js time to mount and lay out.
    await page.waitForTimeout(1400);
    const file = resolve(OUT_DIR, String(i + 1).padStart(2, '0') + '.png');
    await page.screenshot({ path: file, fullPage: false });
    process.stdout.write(`\r→ slide ${i + 1}/${total} → ${file}        `);
  }
  console.log('\n✓ done.');

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
