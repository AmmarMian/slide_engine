import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto('http://localhost:5174/decks/popills_2026/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.querySelector('deck-stage')?.length > 0, null, { timeout: 15000 });
await page.evaluate(() => document.querySelector('deck-stage').goTo(26));
await page.waitForTimeout(2500);
const info = await page.evaluate(() => {
  const fl = document.querySelector('federated-learning');
  if (!fl) return { error: 'no federated-learning' };
  const svg = fl.querySelector('svg');
  const innerHost = fl.children[0];
  return {
    flBox: { w: fl.offsetWidth, h: fl.offsetHeight },
    flStyle: fl.getAttribute('style'),
    innerHostBox: innerHost ? { w: innerHost.offsetWidth, h: innerHost.offsetHeight } : null,
    innerHostStyle: innerHost?.getAttribute('style'),
    svgBox: svg ? { w: svg.clientWidth, h: svg.clientHeight, bb: svg.getBoundingClientRect() } : null,
    svgParent: svg?.parentElement?.getAttribute('style'),
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
