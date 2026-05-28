# Slide Deck Engine

A self-hosted HTML presentation system built with Vite + React. Decks are plain HTML files; the engine handles scaling, navigation, theming, speaker notes, step reveals, and interactive React/D3/Three.js islands.

---

## Quick start

```bash
npm install
npm run new my-talk     # scaffold a new deck at decks/my-talk/
npm run dev             # http://localhost:5173/decks/my-talk/
```

Open `decks/my-talk/index.html` in your editor and start writing slides. Everything hot-reloads.

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with HMR |
| `npm run build` | Production build → `dist/` (all decks) |
| `npm run build:single` | Self-contained `.html` per deck — edit `DECK=` in `package.json` scripts first |
| `npm run preview` | Preview the production build |
| `npm run new <name>` | Scaffold `decks/<name>/index.html` from the starter template |

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| `→` `Space` `PgDn` | Next slide (or reveal next step) |
| `←` `PgUp` | Previous (or hide last step) |
| `Home` / `R` | Jump to slide 1 |
| `End` | Jump to last slide |
| `1`–`9` | Jump to slide N |
| `F` | Toggle fullscreen |
| `N` | Open speaker notes window |
| `T` | Toggle table-of-contents overlay |

---

## Deck anatomy

Every deck is a single `index.html` inside `decks/<name>/`. Minimal structure:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>My Talk</title>
  <meta name="deck-theme" content="palette=paper;font=swiss-sans;accent=#d23b1c;density=comfortable;titleFx=dust">
  <meta name="deck-date"  content="Conference · 2025">
  <script type="module" src="/src/main.js"></script>
</head>
<body>

<deck-stage width="1920" height="1080">
  <!-- slides go here -->
</deck-stage>

<div id="tweaks-root"></div>
<progress-bar></progress-bar>

</body>
</html>
```

`deck-stage` renders at 1920×1080 and auto-scales to fill the viewport while preserving aspect ratio. Everything else (progress bar, tweaks panel, TOC modal) is mounted outside the stage as fixed overlays at viewport level.

---

## Slide types

### Title slide

```html
<section data-label="Title">
  <title-fx></title-fx>
  <div class="particle-scrim"></div>
  <div style="position:relative;z-index:1;flex:1;display:flex;flex-direction:column;justify-content:space-between;">
    <div class="label">Conference · 2025</div>
    <div>
      <div class="eyebrow" style="margin-bottom:32px;">Subtitle or venue</div>
      <h1 class="title">Talk Title</h1>
      <div class="lede" style="margin-top:36px;max-width:1300px;">One-line summary.</div>
    </div>
    <div class="body" style="font-size:28px;">Author Name</div>
  </div>
</section>
```

`<title-fx>` renders the animated background (controlled by `titleFx` in the theme). `.particle-scrim` is a gradient veil that keeps the title text readable over the animation.

### Table of contents

```html
<toc-slide></toc-slide>
```

Auto-populated from all `<section-divider>` elements in the deck. No configuration needed. The interactive TOC overlay (press **T** during the talk) also uses this data.

### Section divider

```html
<section-divider
  label="Optimization on Manifolds"
  kicker="Part 02"
  blurb="One sentence describing this section.">
</section-divider>
```

`num` is optional — auto-computed from DOM order. `blurb` appears in the `<toc-slide>`.

### Content slide

```html
<section>
  <slide-note>Speaker-only note for this slide.</slide-note>
  <slide-header title="Your Slide Title"></slide-header>
  <div class="slide-body">
    <!-- your content -->
  </div>
  <slide-footer></slide-footer>
</section>
```

`<slide-header>` auto-numbers the slide and shows step progress when `data-step` children are present. `<slide-footer>` reads the deck title from `<title>` and the date from `<meta name="deck-date">`.

### End slide

```html
<end-slide
  heading="THANK YOU"
  kicker="Questions?"
  contact="your@email.com">
</end-slide>
```

All attributes optional; heading defaults to `THANK YOU`.

---

## Step reveals

Add `data-step` to any element inside a `<section>` to reveal it progressively:

```html
<section>
  <slide-header title="Key Results"></slide-header>
  <div class="slide-body">
    <p class="lede">Always visible.</p>
    <p class="lede" data-step>Revealed on first → press.</p>
    <p class="lede" data-step>Revealed on second → press.</p>
  </div>
  <slide-footer></slide-footer>
</section>
```

- `→` reveals the next hidden step; the slide doesn't advance until all steps are shown.
- `←` hides the last revealed step; going back past step 1 moves to the previous slide.
- The header shows `N·visible/total` while steps are present.
- All steps are visible in print/PDF export.

---

## Layout helpers

Use these inside `.slide-body`:

```html
<!-- Two equal columns -->
<div class="cols cols-2">
  <div>Left column</div>
  <div>Right column</div>
</div>
```

Available ratios: `cols-2` `cols-3` `cols-1-2` `cols-2-1` `cols-1-3` `cols-3-1`

`.slide-body` is `flex:1` + column flex — content fills the space between header and footer automatically.

---

## Typography classes

| Class | Size | Use |
|---|---|---|
| `.title` | ~112px | Hero title on title slide |
| `.h1` | ~80px | Primary slide heading |
| `.h2` | ~60px | Secondary heading |
| `.lede` | ~38px | Large intro / key point |
| `.body` | ~30px | Body text |
| `.small` | ~24px | Captions, footnotes |
| `.label` | ~24px mono | Uppercase label / eyebrow |
| `.eyebrow` | ~24px mono | Accent-coloured kicker above title |
| `.mono` | ~26px | Monospace inline |
| `.pullquote` | ~72px | Large emphasized quote |

All sizes use `calc(Npx * var(--type-scale, 1))` and scale uniformly when `typeScale` is set in the theme.

### Math

Use KaTeX inline with `<span class="math">…</span>` or block with `<div class="display-math"><span class="math">…</span></div>`. LaTeX source goes directly as text. Rendered automatically on each slide change.

Inside React islands use the `KatexSpan` component from `src/islands/token-grid.jsx` to avoid React/innerHTML conflicts.

---

## Content components

### Theorem block

```html
<div class="theorem">
  <div class="theorem-tag">Theorem <span class="theorem-name">Riemannian Gradient Descent</span></div>
  <div class="theorem-body">Let M be a Riemannian manifold…</div>
</div>
```

### Algorithm block

```html
<div class="algorithm">
  <div class="algorithm-header">Algorithm 1 · Gradient Descent</div>
  <div class="algorithm-body">
    <div><span class="ln">1:</span> <b>for</b> t = 1, …, T <b>do</b></div>
    <div><span class="ln">2:</span> &nbsp;&nbsp; x ← x − η ∇f(x)</div>
    <div><span class="ln">3:</span> <b>return</b> x</div>
  </div>
</div>
```

### Results table

```html
<table class="results">
  <thead><tr><th>Method</th><th>Acc ↑</th><th>Time ↓</th></tr></thead>
  <tbody>
    <tr><td>Baseline</td><td>82.1</td><td>4.2 s</td></tr>
    <tr class="best"><td>Ours</td><td>87.4</td><td>3.1 s</td></tr>
  </tbody>
</table>
```

`class="best"` highlights a row in the accent colour.

### Citations

Define once in the deck `<head>`:

```html
<script id="deck-refs" type="application/json">
{
  "smith2024": "Smith et al. (2024). Title. NeurIPS.",
  "jones2023": "Jones & Lee (2023). Another Paper. ICML."
}
</script>
```

Use inline:

```html
Some claim.<cite-ref key="smith2024"></cite-ref>
```

Numbers are auto-assigned per slide; full references appear as footnotes above the footer.

---

## Speaker notes

Write notes next to their slide, inside any slide element:

```html
<section>
  <slide-note>Mention the 2023 ablation here. Budget 3 minutes.</slide-note>
  <slide-header title="Results"></slide-header>
  …
</section>
```

`<slide-note>` is invisible in the rendered deck. Press **N** to open the notes window — it syncs live via `localStorage`.

**Notes window controls:**

| Key | Action |
|---|---|
| `Space` | Start / pause timer |
| `R` | Reset timer |
| `N` | Re-focus the deck window |

Enter a countdown target (e.g. `20:00`) in the `cd` field. The timer turns amber in the last 20% and pulses red when time is up.

---

## TOC overlay

Press **T** at any point during the presentation to open the table-of-contents overlay. It shows all sections and their slides; clicking any item navigates there and closes the overlay. The fox mascot animates to the new position automatically. Press **T** or **Esc** to close.

---

## Theme

Set per-deck in `<meta name="deck-theme">`:

```html
<meta name="deck-theme" content="palette=paper;font=swiss-sans;accent=#d23b1c;density=comfortable;titleFx=dust">
```

| Key | Options |
|---|---|
| `palette` | `paper` · `warm` · `cool` · `dark` · `slate` · `forest` |
| `font` | `swiss-sans` · `modern-mixed` · `editorial` · `classic` |
| `accent` | Any CSS color |
| `density` | `compact` · `comfortable` · `airy` |
| `typeScale` | Float e.g. `0.85` — scales all slide typography uniformly |
| `titleFx` | `off` · `flow` · `constellation` · `dust` · `aurora` · `halftone` |

Adjust live via the **⚙ tweaks panel** (gear icon, bottom-right). Changes persist per-deck in `localStorage`. "Reset to deck default" restores the meta-tag values.

---

## Progress bar

```html
<progress-bar></progress-bar>
```

Sections are **auto-derived from `<section-divider>` elements** — no configuration needed. Override with explicit JSON (0-based slide indices) if required:

```html
<progress-bar sections='[
  {"label":"Background", "start":2, "end":7},
  {"label":"Method",     "start":8, "end":14}
]'></progress-bar>
```

Enable the fox mascot via the tweaks panel (`foxProgress` toggle).

---

## Built-in islands

| Tag | File | Description |
|---|---|---|
| `<title-fx>` | `title-fx.jsx` | Animated background for the title slide |
| `<toc-slide>` | `slide-chrome.jsx` | Auto-generated table of contents |
| `<section-divider>` | `slide-chrome.jsx` | Section break with animated numerals |
| `<slide-header>` | `slide-chrome.jsx` | Title + auto page number |
| `<slide-footer>` | `slide-chrome.jsx` | Deck title + date footer |
| `<end-slide>` | `slide-chrome.jsx` | Thank-you / questions slide |
| `<progress-bar>` | `progress-bar.jsx` | Bottom progress strip + fox mascot |
| `<masked-reveal>` | `token-grid.jsx` | Flickering character-reveal animation |
| `<riemann-primer>` | `riemann-primer.jsx` | Three.js Riemannian geometry primer (S²) |
| `<riemann-descent>` | `riemann-descent.jsx` | Three.js gradient descent on manifold |
| `<riemann-terrain>` | `riemann-terrain.jsx` | Three.js curved terrain generalisation |
| `<spdnet-arch>` | `spdnet-arch.jsx` | SPDNet interactive architecture diagram |
| `<federated-learning>` | `federated-learning.jsx` | Federated learning step animation |
| `<riemannian-descent>` | `d3/riemannian-descent.jsx` | D3 RGD on S² |
| `<tangent-projection>` | `d3/tangent-projection.jsx` | Gradient decomposition |
| `<algorithm-comparison>` | `d3/algorithm-comparison.jsx` | RGD vs RCG convergence |
| `<spd-geodesic>` | `d3/spd-geodesic.jsx` | Geodesic on SPD manifold |
| `<poincare-disk>` | `d3/poincare-disk.jsx` | Hyperbolic geometry |
| `<scatter-flow>` | `d3/scatter-flow.jsx` | Animated scatter with flow field |
| `<nll-chart>` | `charts.jsx` | NLL chart |
| `<dist-chart>` | `charts.jsx` | Distribution chart |
| `<diffusion-strip>` | `diffusion.jsx` | Diffusion timestep grid |
| `<diffusion-scrubber>` | `diffusion.jsx` | Interactive diffusion timeline |
| `<algorithm-stepper>` | `diffusion.jsx` | Step-by-step algorithm trace |

---

## Adding a new island

1. Create `src/islands/my-widget.jsx` exporting a React component.

2. Import and register in `src/islands/register.jsx`:

   ```js
   import { MyWidget } from './my-widget.jsx';

   defineReactElement('my-widget', MyWidget, {
     observed: ['value', 'mode'],          // attributes that trigger re-render
     props: el => ({
       value: el.getAttribute('value') || '',
       mode:  el.getAttribute('mode')  || 'default',
     }),
   });
   ```

3. Use in any deck:

   ```html
   <my-widget value="42" mode="animated"></my-widget>
   ```

4. Add CSS to `theme.css` if the element needs `display: block` or specific sizing:

   ```css
   my-widget { display: block; width: 100%; height: 100%; flex: 1; }
   ```

### Passing inner HTML to an island

If your island needs to wrap authored HTML content (callout boxes, labelled figures, etc.), use the `innerHtml` option:

```js
defineReactElement('callout-box', CalloutBox, {
  innerHtml: true,           // captures innerHTML before React mounts
  observed: ['variant'],
  props: el => ({ variant: el.getAttribute('variant') || 'info' }),
});
```

The component receives `props.innerHtml` as a string containing the original inner HTML. The content is captured from the deck source (trusted author HTML) before React takes over the element.

### Shared utilities

`src/islands/shared.js` exports pure helpers available to all islands without circular imports:

- `fmt(n)` — zero-pads a number to 2 digits
- `getSlidePosition(ref, selector)` — returns `{ idx, total }` for a slide element
- `getSectionIdx(idx, sections)` — maps a slide index to its section
- `rng(seed)` — seeded PRNG for deterministic animations
- `GLYPHS`, `DIGITS_5x7`, `digitPattern()` — for TokenGrid-style animations

---

## File layout

```
decks/
  <name>/
    index.html          ← your deck
    assets/             ← images, data files

src/
  main.js               ← entry: fonts, CSS, runtime, islands, tweaks panel, TOC modal
  math.js               ← KaTeX batch renderer
  runtime/
    deck-stage.js       ← <deck-stage> web component (navigation, scaling, steps)
    citations.js        ← <cite-ref> footnote renderer
  theme/
    theme.css           ← design system CSS vars + all component styles
    presets.js          ← palette / font / density / fx definitions
    apply-theme.js      ← reads <meta> + localStorage → writes :root vars
    tweaks-panel.jsx    ← live theme editor overlay
  islands/
    register.jsx        ← custom element → React bridge + all registrations
    shared.js           ← pure utilities (fmt, rng, getSlidePosition, …)
    token-grid.jsx      ← KatexSpan, TokenGrid, MaskedReveal
    fox.jsx             ← FoxMascot sprite animation
    progress-bar.jsx    ← ProgressBarContent (wraps fox)
    slide-chrome.jsx    ← SlideHeader, SlideFooter, TocSlide, SectionDivider, EndSlide
    diffusion.jsx       ← HeroRow, DiffusionStrip, DiffusionScrubber, AlgorithmStepper
    misc-islands.jsx    ← InteractiveArch, Filmstrip
    toc-modal.jsx       ← T-key TOC overlay (mounted globally by main.js)
    title-fx.jsx        ← title background animations
    charts.jsx          ← D3/SVG chart components
    spdnet-arch.jsx     ← SPDNet interactive architecture
    riemann-primer.jsx  ← Three.js Riemannian primer
    riemann-descent.jsx ← Three.js gradient descent
    riemann-terrain.jsx ← Three.js curved terrain
    federated-learning.jsx ← federated learning animation
    d3/                 ← standalone D3 islands
    three/              ← shared Three.js scene helpers + chapter configs

scripts/
  new-deck.mjs          ← deck scaffolder (npm run new <name>)
```

---

## PDF export

Use the browser's **Print → Save as PDF**. `@media print` lays every slide as its own page at design size. All `data-step` elements are forced visible. No extra tooling required.

---

## Navigation API

For programmatic control from browser devtools or custom scripts:

```js
const stage = document.querySelector('deck-stage');
stage.goTo(n)   // jump to 0-based index
stage.next()
stage.prev()
stage.reset()
stage.index     // current index (read-only)
stage.length    // total slide count
```

The stage dispatches a `slidechange` event on every navigation:

```js
stage.addEventListener('slidechange', (e) => {
  e.detail.index         // new 0-based index
  e.detail.previousIndex // -1 on init
  e.detail.total
  e.detail.slide         // active slide element
  e.detail.reason        // 'init' | 'keyboard' | 'click' | 'tap' | 'api'
});
```
