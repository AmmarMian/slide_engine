import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { glob } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { readFile } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';

// Public base path. "/" locally; "/<repo>/" on GitHub Pages (set by the workflow via BASE).
const BASE = (process.env.BASE || '/').replace(/\/*$/, '/').replace(/^\/*/, '/');

// ── HTML partials: <!--#include file="./sections/foo.html"--> ─────────────
function htmlIncludePlugin() {
  function expand(src, dir) {
    return src.replace(/<!--#include file="([^"]+)"-->/g, (_, rel) => {
      const abs = resolve(dir, rel);
      return expand(readFileSync(abs, 'utf8'), dirname(abs));
    });
  }
  return {
    name: 'html-include',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        return expand(html, dirname(ctx.filename));
      },
    },
  };
}

// Collect all decks/*/index.html as multipage inputs.
async function getDeckInputs() {
  const entries = {};
  for await (const file of glob('decks/*/index.html')) {
    const name = file.split('/')[1]; // decks/<name>/index.html → <name>
    entries[name] = resolve(process.cwd(), file);
  }
  return entries;
}

// ── Palette background colours (mirrors presets.js) ───────────────────────
const PALETTE_BG = {
  paper:  '#f4f3ef', warm:   '#f7f1e6', cool:   '#f1f3f6',
  dark:   '#0e0d0b', slate:  '#f0f0f2', forest: '#f2f4f0',
};
const PALETTE_INK = {
  paper:  '#0a0a0a', warm:   '#1a1410', cool:   '#0c1422',
  dark:   '#f3eee0', slate:  '#161820', forest: '#141a10',
};

function generateIndexHtml(decks) {
  const cards = decks.map(({ name, title, palette, accent, href }) => {
    const bg  = PALETTE_BG[palette]  || PALETTE_BG.paper;
    const ink = PALETTE_INK[palette] || PALETTE_INK.paper;
    return `
    <a href="${href}" class="card" style="--bg:${bg};--ink:${ink};--accent:${accent};">
      <div class="card-accent"></div>
      <div class="card-body">
        <div class="card-name">${name}</div>
        <div class="card-title">${title}</div>
      </div>
      <div class="card-arrow">→</div>
    </a>`;
  }).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Slide Decks</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
    background: #f0f0f0; color: #111; min-height: 100vh;
    display: flex; flex-direction: column; align-items: center;
    padding: 64px 24px;
  }
  h1 {
    font-size: 13px; font-weight: 600; letter-spacing: 0.08em;
    text-transform: uppercase; color: rgba(0,0,0,0.35); margin-bottom: 40px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px; width: 100%; max-width: 960px;
  }
  .card {
    display: flex; align-items: center; gap: 0;
    background: var(--bg); color: var(--ink);
    border-radius: 10px; overflow: hidden;
    text-decoration: none;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.06);
    transition: transform 120ms ease, box-shadow 120ms ease;
    min-height: 80px;
  }
  .card:hover {
    transform: translateY(-2px);
    box-shadow: 0 2px 6px rgba(0,0,0,0.1), 0 8px 24px rgba(0,0,0,0.1);
  }
  .card-accent {
    width: 4px; align-self: stretch; flex-shrink: 0;
    background: var(--accent);
  }
  .card-body {
    flex: 1; padding: 18px 16px;
  }
  .card-name {
    font-size: 10px; font-weight: 600; letter-spacing: 0.07em;
    text-transform: uppercase; color: var(--accent); margin-bottom: 5px;
    font-family: ui-monospace, monospace;
  }
  .card-title {
    font-size: 16px; font-weight: 600; letter-spacing: -0.02em;
    line-height: 1.3; color: var(--ink);
  }
  .card-arrow {
    padding: 0 18px; font-size: 18px; opacity: 0.25; flex-shrink: 0;
    transition: opacity 120ms, transform 120ms;
  }
  .card:hover .card-arrow { opacity: 0.7; transform: translateX(3px); }
</style>
</head>
<body>
<h1>Slide Decks</h1>
<div class="grid">
${cards}
</div>
</body>
</html>`;
}

// ── Vite plugin: deck index at / ──────────────────────────────────────────
function deckIndexPlugin(allInputs, singleFile) {
  if (singleFile) return { name: 'deck-index' };

  async function buildHtml() {
    const decks = await Promise.all(
      Object.entries(allInputs).map(async ([name, filePath]) => {
        const src = await readFile(filePath, 'utf8');
        const title   = src.match(/name="deck-title-fr"\s+content="([^"]*)"/)?.[1]?.trim()
                     || src.match(/<title>([^<]*)<\/title>/)?.[1]?.trim() || name;
        const theme   = src.match(/name="deck-theme"\s+content="([^"]*)"/)?.[1] || '';
        const palette = theme.match(/palette=([a-z]+)/)?.[1] || 'paper';
        const accent  = theme.match(/accent=(#[0-9a-fA-F]{3,8})/)?.[1] || '#d23b1c';
        return { name, title, palette, accent, href: `${BASE}decks/${name}/` };
      })
    );
    decks.sort((a, b) => a.name.localeCompare(b.name));
    return generateIndexHtml(decks);
  }

  return {
    name: 'deck-index',

    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0];
        if (url !== BASE && url !== `${BASE}index.html`) return next();
        try {
          const html = await buildHtml();
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(html);
        } catch (err) {
          next(err);
        }
      });
    },

    async generateBundle() {
      const html = await buildHtml();
      this.emitFile({ type: 'asset', fileName: 'index.html', source: html });
    },
  };
}

export default defineConfig(async () => {
  const allInputs  = await getDeckInputs();
  const singleFile = !!process.env.SINGLEFILE;

  // Single-file mode requires exactly one Rollup entry; pick the requested deck or the first one.
  let input = { ...allInputs };
  if (singleFile) {
    const deckName = process.env.DECK || Object.keys(allInputs)[0];
    if (!allInputs[deckName]) throw new Error(`build:single — deck "${deckName}" not found. Available: ${Object.keys(allInputs).join(', ')}`);
    input = { [deckName]: allInputs[deckName] };
  } else if (existsSync('notes.html')) {
    // Speaker-notes window (opened with N) must ship with the site.
    input.notes = resolve(process.cwd(), 'notes.html');
  }

  return {
    base: BASE,
    server: { port: 5174 },
    plugins: [
      htmlIncludePlugin(),
      react(),
      deckIndexPlugin(allInputs, singleFile),
      ...(singleFile ? [viteSingleFile()] : []),
    ],
    build: {
      rollupOptions: { input },
      ...(singleFile
        ? { assetsInlineLimit: 100_000_000, cssCodeSplit: false }
        : {}),
    },
  };
});
