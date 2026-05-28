# Slide Deck — Codebase Guide

A web-based presentation engine built with Vite + React. Decks are plain HTML files; interactive content mounts as React "islands" via custom elements. Design size is 1920×1080; the viewport scales to fit.

## Build & Dev

```bash
npm run dev    # dev server (hot reload)
npm run build  # production build → dist/
```

Deck files live under `decks/<name>/index.html` and are served from the Vite root. The shared engine lives entirely in `src/`.

---

## Architecture

```
src/
  main.js                  # Entry point — imports fonts, CSS, runtime, islands, tweaks panel
  math.js                  # KaTeX batch renderer (called on boot and on every slidechange)
  runtime/
    deck-stage.js          # <deck-stage> web component — navigation, scaling, step reveals
    citations.js           # <cite-ref> footnote renderer
  theme/
    theme.css              # Design system CSS vars + all component styles
    presets.js             # Palette / font / density / accent presets (single source of truth)
    apply-theme.js         # Reads <meta name="deck-theme"> + localStorage → writes :root vars
    tweaks-panel.jsx       # Live theme editor (⚙ overlay, mounted into #tweaks-root)
  islands/
    register.jsx           # Registers every custom element → React component mapping
    slide-elements.jsx     # Core slide components: headers, footers, progress bar, fox, etc.
    charts.jsx             # D3/SVG chart components
    title-fx.jsx           # Canvas particle animation for title slides
    spdnet-arch.jsx        # SPDNet interactive architecture diagram
    riemann-primer.jsx     # Three.js Riemannian geometry primer (sphere S²)
    riemann-descent.jsx    # Three.js Riemannian gradient descent
    riemann-terrain.jsx    # Three.js curved terrain generalisation
    federated-learning.jsx # Federated learning step animation
    d3/                    # Standalone D3 island components
    three/                 # Shared Three.js scene helpers and chapter configs
```

---

## How Slides Work

### The `<deck-stage>` web component (`src/runtime/deck-stage.js`)

- Direct children of `<deck-stage>` are slides. Supported tags: `<section>`, `<section-divider>`, `<toc-slide>`, `<end-slide>`, and any registered custom element.
- Slides are **hidden, not unmounted** (`visibility:hidden; opacity:0`) — React island state persists across navigation.
- Active slide gets `data-deck-active` attribute.
- Design canvas is fixed at 1920×1080 (or `width`/`height` attributes), scaled with `transform: scale()` to fit the viewport.

**Navigation API:**
```js
const stage = document.querySelector('deck-stage');
stage.goTo(n)   // jump to 0-based index (bypasses step reveals)
stage.next()
stage.prev()
stage.reset()
stage.index     // current index (read-only)
stage.length    // total slides
```

**Keyboard shortcuts:**
| Key | Action |
|-----|--------|
| `→` / `Space` / `PgDn` | Next (respects step reveals) |
| `←` / `PgUp` | Previous |
| `Home` / `R` | Reset to slide 0 |
| `End` | Last slide |
| `1`–`9` | Jump to slide N |
| `F` | Fullscreen toggle |
| `N` | Open speaker notes window |

**`slidechange` event** — fires on every navigation:
```js
stage.addEventListener('slidechange', (e) => {
  e.detail.index         // new 0-based index
  e.detail.previousIndex // -1 on init
  e.detail.total
  e.detail.slide         // active slide element
  e.detail.reason        // 'init' | 'keyboard' | 'click' | 'tap' | 'api'
});
```

---

## React Islands (Custom Elements)

Islands bridge HTML custom elements to React components. Every island is registered in `src/islands/register.jsx` via `defineReactElement(tag, Component, opts)`.

**Pattern:**
```html
<!-- In deck HTML -->
<slide-header title="My Slide"></slide-header>
```
```js
// In register.jsx
defineReactElement('slide-header', SlideHeaderContent, {
  observed: ['title'],                      // attributes that trigger re-render
  props: el => ({ title: el.getAttribute('title') || '' }),
});
```

**Key islands:**

| Tag | Component | Notes |
|-----|-----------|-------|
| `<slide-header title="">` | `SlideHeaderContent` | Auto-reads its own slide index from DOM; shows step counter when `data-step` children exist |
| `<slide-footer>` | `SlideFooterContent` | Reads `<title>` and `<meta name="deck-date">` |
| `<section-divider label="" kicker="" blurb="">` | `SectionDividerContent` | Inverted (dark) slide; `num` auto-computed from DOM order if absent |
| `<toc-slide>` | `TocSlideContent` | Auto-builds from all `<section-divider>` elements in `<deck-stage>` |
| `<end-slide heading="" kicker="" contact="">` | `EndSlideContent` | Inverted; animated token-grid |
| `<progress-bar>` | `ProgressBarContent` | Fixed overlay; sections auto-derived from `<section-divider>` elements |
| `<title-fx>` | `TitleFx` | Canvas particle animation; mode set via `--fx-title` CSS var |
| `<masked-reveal word="" cell="" duration="">` | `MaskedReveal` | Flickering character reveal |

---

## Slide Step Reveals

Add `data-step` to any element inside a `<section>` to make it appear progressively:

```html
<section>
  <slide-header title="My Slide"></slide-header>
  <div class="slide-body">
    <p class="lede" data-step>First point.</p>
    <p class="lede" data-step>Second point.</p>
  </div>
</section>
```

- Steps are revealed one at a time on `→` / Space; each press of `←` hides the last one.
- Hidden steps have `opacity: 0` (stay in flow, layout doesn't shift).
- `@media print` forces all steps visible.
- `slide-header` shows a `visible/total` step counter automatically when steps are present.

---

## Speaker Notes

Add a `<slide-note>` as the first child of any slide element:
```html
<section>
  <slide-note>Notes visible in the speaker window.</slide-note>
  <slide-header title="..."></slide-header>
  ...
</section>
```
Notes are captured at component mount time (before React re-renders the element) and stored in `data-note`. Open the notes window with `N` or the overlay button — it polls `localStorage` for live state.

---

## Theme System

### Per-deck configuration

Set theme via `<meta name="deck-theme">` in the deck `<head>`:
```html
<meta name="deck-theme" content="palette=paper;font=swiss-sans;accent=#d23b1c;density=comfortable;titleFx=dust">
```

| Key | Options |
|-----|---------|
| `palette` | `paper` `warm` `cool` `dark` `slate` `forest` |
| `font` | `swiss-sans` `modern-mixed` `editorial` `classic` |
| `accent` | Any CSS color |
| `density` | `compact` `comfortable` `airy` |
| `typeScale` | Float (e.g. `0.85`) — scales all type uniformly |
| `titleFx` | `off` `flow` `constellation` `dust` `aurora` `halftone` |

### CSS variables (set on `:root`)

```
--bg  --bg-2  --ink  --ink-2  --ink-3  --rule  --rule-soft  --tint
--accent  --sans  --serif  --mono  --type-scale
--d-pad-x  --d-pad-y-top  --d-pad-y-bot
--fx-title  --fx-fox
```

All type sizes use `calc(Npx * var(--type-scale, 1))` so the whole deck scales uniformly.

### User overrides

The tweaks panel (`#tweaks-root` → `<TweaksPanel>`) writes to `localStorage` keyed by `deck-theme:<pathname>`. localStorage wins over `<meta>` wins over the global default in `presets.js`.

### Theme change event

```js
document.documentElement.addEventListener('deck-theme-change', (e) => {
  // e.detail has the full merged theme object
});
```

---

## Layout Helpers (CSS classes)

```html
<div class="slide-body">         <!-- flex:1 column wrapper replacing inline style="flex:1" -->
  <div class="cols cols-2">      <!-- 2-column grid -->
    <div>left</div>
    <div>right</div>
  </div>
</div>
```

Available column layouts: `cols-2`, `cols-3`, `cols-1-2`, `cols-2-1`, `cols-1-3`, `cols-3-1`.

**Type classes:** `.title`, `.h1`, `.h2`, `.lede`, `.body`, `.small`, `.label`, `.mono`, `.eyebrow`

**Component classes:** `.theorem`, `.theorem-tag`, `.theorem-body`, `.theorem-name`, `.pullquote`, `.figcaption`, `.ref`, `.bullet-rail`, `.display-math`, `.algorithm`

---

## Citations

Define references once with a JSON script block:
```html
<script id="deck-refs" type="application/json">
  { "smith2024": "Smith et al. (2024). Title. Venue." }
</script>
```

Use inline in slide content:
```html
Some claim.<cite-ref key="smith2024"></cite-ref>
```

Numbers are auto-assigned per slide; full references appear as footnotes above the footer.

---

## Math Rendering

Use inline `<span class="math">\LaTeX</span>` or display `.math-display` for KaTeX. The engine auto-renders on boot and on every `slidechange`. Inside React islands, use the `KatexSpan` component (defined in `slide-elements.jsx`) instead of `innerHTML` to avoid React conflicts.

---

## Adding a New Island

1. Create `src/islands/my-widget.jsx` exporting a React component.
2. Import it in `src/islands/register.jsx`.
3. Call `defineReactElement('my-widget', MyWidget, { observed: [...], props: el => ({...}) })`.
4. Add CSS host rules to `theme.css` if the element needs `display: block` or sizing.
5. Use `<my-widget attr="..."></my-widget>` in any deck HTML.

---

## Print / PDF Export

`@media print` in `deck-stage.js` lays every slide out as its own page at design size. Use the browser's **Print → Save as PDF** — no extra tooling needed. All `data-step` elements are forced visible in print.
