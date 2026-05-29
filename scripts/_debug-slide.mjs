import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto('http://localhost:5174/decks/popills_2026/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.querySelector('deck-stage')?.length > 0, null, { timeout: 15000 });

for (const i of [4, 12, 26]) {
  await page.evaluate((n) => document.querySelector('deck-stage').goTo(n), i);
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => {
    const ds = document.querySelector('deck-stage');
    const root = ds?.shadowRoot;
    const canvas = root?.querySelector('.canvas');
    const stage = root?.querySelector('.stage');
    const active = document.querySelector('[data-deck-active]');
    return {
      vw: window.innerWidth, vh: window.innerHeight,
      designW: ds?.designWidth, designH: ds?.designHeight,
      canvasTransform: canvas?.style.transform,
      canvasW: canvas?.offsetWidth, canvasH: canvas?.offsetHeight,
      stageW: stage?.offsetWidth, stageH: stage?.offsetHeight,
      activeTag: active?.tagName,
      activeW: active?.offsetWidth, activeH: active?.offsetHeight,
    };
  });
  console.log(`slide ${i+1}:`, JSON.stringify(info, null, 2));
}
await browser.close();
