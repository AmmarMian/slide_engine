#!/usr/bin/env node
// Usage: npm run new <deck-name>
// Creates decks/<deck-name>/index.html from the starter template.

import { mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const name = process.argv[2];
if (!name || !/^[a-z0-9_-]+$/.test(name)) {
  console.error('Usage: npm run new <deck-name>   (lowercase, hyphens/underscores ok)');
  process.exit(1);
}

const dir = join(process.cwd(), 'decks', name);
try { await access(dir); console.error(`decks/${name} already exists.`); process.exit(1); }
catch {}

await mkdir(dir, { recursive: true });

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${name}</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />

<!--
  DECK THEME  — pick a preset by setting any combination:
    palette    : paper | warm | cool | dark
    font       : swiss-sans | modern-mixed | editorial | classic
    accent     : any CSS color
    density    : compact | comfortable | airy

  Example:
    <meta name="deck-theme" content="palette=cool;font=editorial;accent=#2563eb;density=comfortable">
-->
<meta name="deck-theme" content="palette=paper;font=swiss-sans;accent=#d23b1c;density=comfortable">

<script type="module" src="/src/main.js"></script>
</head>
<body>
<deck-stage width="1920" height="1080">

  <!-- ═══════════════════════════════════════
       01 · Title
       ═══════════════════════════════════════ -->
  <section data-label="01 Title">
    <div style="flex:1;display:flex;flex-direction:column;justify-content:space-between;">
      <div class="label">Your talk · Date</div>
      <div>
        <div class="eyebrow" style="margin-bottom:32px;">Topic · Subtitle</div>
        <h1 class="title">${name.replace(/-/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase())}</h1>
        <div class="lede" style="margin-top:36px;max-width:1300px;">One-sentence summary of your talk.</div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;">
        <div class="body" style="font-size:28px;">Author Name</div>
        <div class="small">Venue · Year</div>
      </div>
    </div>
  </section>

  <!-- ═══════════════════════════════════════
       02 · Content (edit freely)
       ═══════════════════════════════════════ -->
  <section data-label="02 Content">
    <div class="page-header">
      <div class="label">Section</div>
      <div class="label">02 / 03</div>
    </div>
    <h2 class="h1" style="margin-bottom:48px;">Your slide title.</h2>
    <div class="lede" style="max-width:1400px;">
      Edit this slide. Add more <code>&lt;section&gt;</code> blocks for each slide.
    </div>
    <div class="page-footer">
      <div>${name}</div>
      <div>Venue · Year</div>
    </div>
  </section>

  <!-- ═══════════════════════════════════════
       03 · End
       ═══════════════════════════════════════ -->
  <end-slide slide-num="3" total-slides="3" data-label="03 End"></end-slide>

</deck-stage>

<div id="tweaks-root"></div>

<script type="application/json" id="speaker-notes">
[
  "Slide 1: introduce yourself and the problem.",
  "Slide 2: your key points here.",
  "Slide 3: questions."
]
</script>
</body>
</html>
`;

await writeFile(join(dir, 'index.html'), html);
console.log(`✓ Created decks/${name}/index.html`);
console.log(`  Run: npm run dev  →  http://localhost:5173/decks/${name}/`);
