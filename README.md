# Slide Deck Engine

A lightweight, build-powered HTML slide deck system. **Static HTML for content. React + d3 for the complex 20%.**

## Quick start

```bash
npm install
npm run dev
# → open http://localhost:5173/decks/demo/
```

## Create a new deck

```bash
npm run new my-talk
# → edit decks/my-talk/index.html
# → npm run dev  →  http://localhost:5173/decks/my-talk/
```

## Build

```bash
npm run build          # static dist/ folder (open dist/decks/<name>/index.html)
npm run build:single   # one self-contained .html per deck (offline, emailable)
```

---

## Authoring cheat-sheet

Each deck is a single HTML file in `decks/<name>/index.html`. Edit it directly.

### Deck structure

```html
<deck-stage width="1920" height="1080">
  <section data-label="01 Title">...</section>   <!-- plain HTML slide -->
  <section-divider ...></section-divider>          <!-- React island -->
  <!-- more slides ... -->
</deck-stage>

<progress-bar sections='[...]'></progress-bar>   <!-- optional progress overlay -->
<div id="tweaks-root"></div>                      <!-- theme panel mount point -->
```

### Per-deck theme

Set defaults in a `<meta>` tag — no panel required:

```html
<meta name="deck-theme" content="palette=cool;font=editorial;accent=#2563eb;density=comfortable">
```

| Key | Options |
|---|---|
| `palette` | `paper` · `warm` · `cool` · `dark` · `slate` · `forest` |
| `font` | `swiss-sans` · `modern-mixed` · `editorial` · `classic` |
| `accent` | any CSS color: `#d23b1c`, `blue`, `oklch(60% 0.2 250)` |
| `density` | `compact` · `comfortable` · `airy` |

The **⚙ button** (bottom-right) opens the live panel. Changes persist via `localStorage`. "Reset to deck default" reverts.

### CSS classes (type scale)

| Class | Size | Notes |
|---|---|---|
| `.title` | 112px | Cover title |
| `.h1` | 80px | Slide heading |
| `.h2` | 60px | Sub-heading |
| `.lede` | 38px | Lead paragraph |
| `.body` | 30px | Body text |
| `.small` | 24px | Captions, notes |
| `.eyebrow` | 24px mono | Uppercase label above title |
| `.label` | 24px mono | Section labels, headers |
| `.mono` | 26px | Inline monospace |

### CSS variables (color palette)

```
--bg, --bg-2, --ink, --ink-2, --ink-3, --ink-4
--rule, --rule-soft, --accent, --tint
--sans, --serif, --mono
--d-pad-x, --d-pad-y-top, --d-pad-y-bot
```

All components read these vars — switch theme, all slides update instantly.

### Content components (HTML classes)

```html
<!-- Page chrome -->
<div class="page-header"><div class="label">Section</div><div class="label">02/18</div></div>
<div class="page-footer"><div>Talk title</div><div>Venue · Year</div></div>

<!-- Theorem / definition -->
<div class="theorem">
  <div class="theorem-tag">Theorem 1 <span class="theorem-name">— name</span></div>
  <div class="theorem-body">Statement in serif font with <span class="math">x_0</span>.</div>
</div>

<!-- Framed equation -->
<div class="display-math">
  <span class="math-display">\mathcal{L} = \sum_t \dots</span>
  <div class="eq-label">(1)</div>
</div>

<!-- Pseudocode -->
<div class="algorithm">
  <div class="algorithm-header"><span>Algorithm 1</span><span>O(T·d)</span></div>
  <div class="algorithm-body">
    <div><span class="ln">1:</span><b>for</b> t = T … 1 <b>do</b></div>
  </div>
</div>

<!-- Results table -->
<table class="results">
  <thead><tr><th>Method</th><th>Score ↓</th></tr></thead>
  <tbody>
    <tr><td>Baseline</td><td>0.14</td></tr>
    <tr class="best"><td>Ours</td><td>0.07</td></tr>  <!-- .best → accent color -->
  </tbody>
</table>

<!-- Bullet rail -->
<div class="bullet-rail">
  <div><div class="label">Point A</div><div class="body">Explanation.</div></div>
  <div><div class="label">Point B</div><div class="body">Explanation.</div></div>
</div>

<!-- TOC entry -->
<div class="toc-entry">
  <div class="toc-num">01</div>
  <div><div class="toc-label">Section</div><div class="toc-blurb">Summary.</div></div>
  <div class="toc-pages">01–03</div>
</div>

<!-- Pull-quote -->
<div class="pullquote">A memorable sentence.</div>

<!-- Reference -->
<div class="ref">
  <div class="ref-num">1</div>
  <div>
    <span class="ref-authors">Author, A.</span>
    Title. <span class="ref-venue">Venue 2024.</span>
  </div>
</div>

<!-- Figure caption -->
<div class="figcaption"><span class="num">Figure 1</span><span>Caption text.</span></div>
```

### Math

Write TeX as `textContent`, KaTeX renders it on load:

```html
<span class="math">x_0 \in \{1,\dots,K\}</span>          <!-- inline -->
<span class="math-display">\mathcal{L} = \sum \dots</span>  <!-- block, centered -->
```

### React islands (custom tags)

Drop these anywhere in a `<section>` or as direct children of `<deck-stage>`:

| Tag | Attributes | Description |
|---|---|---|
| `<masked-reveal>` | `word cell duration` | Animated token-reveal effect |
| `<section-divider>` | `num label kicker slide-num total-slides` | Dark inverted section break |
| `<interactive-arch>` | `slide-num total-slides` | Clickable architecture diagram |
| `<filmstrip-slide>` | `slide-num total-slides` | Animated unmasking table |
| `<end-slide>` | `slide-num total-slides` | Dark end slide with THANK YOU animation |
| `<diffusion-strip>` | `steps` | Static row of noisy → clean panels |
| `<diffusion-scrubber>` | — | Interactive continuous vs discrete slider |
| `<algorithm-stepper>` | — | Stepped pseudocode with live trace |
| `<hero-row>` | `state highlight compact headers label` | The canonical sample row |
| `<nll-chart>` | — | SVG line chart (NLL vs steps) |
| `<dist-chart>` | — | SVG marginal distributions |
| `<arch-diagram>` | — | SVG architecture overview |
| `<scatter-flow>` | `n seed` | **d3 animated scatter** — fires on slide reveal |
| `<progress-bar>` | `sections` (JSON) | Top progress bar overlay |

### Adding a new island

1. Create `src/islands/my-widget.jsx` and export a React component.
2. Import it in `src/islands/register.jsx` and call `defineReactElement('my-widget', MyWidget, { ... })`.
3. Use `<my-widget>` in any deck's HTML.

For d3 islands, follow the pattern in `src/islands/d3/scatter-flow.jsx`:
- `useRef` + `useEffect` for imperactive d3 code
- Read CSS vars via `getComputedStyle` for theme awareness
- Listen to `document.querySelector('deck-stage').addEventListener('slidechange', ...)` to animate **on reveal**, not on mount

### Speaker notes

```html
<script type="application/json" id="speaker-notes">
["Slide 1 notes.", "Slide 2 notes.", ...]
</script>
```

Navigate via `window.postMessage({ slideIndexChanged: n }, '*')` — the `deck-stage` runtime emits this on every nav.

### Keyboard navigation

`←` / `→` / `Space` advance/retreat. `Home` / `End` jump to first/last. `1`–`9` jump to slide N. `R` resets to slide 1.

---

## Project structure

```
src/
  main.js                  ← deck entry (fonts + theme + islands + math)
  runtime/deck-stage.js    ← player (framework-agnostic, don't edit)
  theme/
    theme.css              ← CSS-var design system
    presets.js             ← all palette/font/density definitions
    apply-theme.js         ← reads <meta> + localStorage, writes :root vars
    tweaks-panel.jsx       ← live theme panel (⚙ button)
  islands/
    register.jsx           ← HTML-tag ↔ React bridge
    slide-elements.jsx     ← SectionDivider, Filmstrip, AlgorithmStepper, etc.
    charts.jsx             ← SVG charts
    d3/scatter-flow.jsx    ← d3 island example
  math.js                  ← KaTeX renderer

decks/
  demo/index.html          ← capabilities showcase (18 slides)
  <your-deck>/index.html   ← created by npm run new <name>

legacy/                    ← original CDN/Babel versions for reference
scripts/new-deck.mjs       ← deck scaffold script
```
