# Slide Deck

A minimal, self-hosted HTML slide system. Decks are plain HTML files; the engine handles scaling, navigation, theming, speaker notes, and D3/React islands. No build step required to author — `npm run dev` serves everything live.

---

## Quick start

```bash
npm install
npm run new my-talk          # scaffold a new deck
npm run dev                  # http://localhost:5173/decks/my-talk/
```

Open `decks/my-talk/index.html` in your editor and start writing slides. Everything hot-reloads.

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with HMR on port 5173 |
| `npm run build` | Multi-file production build → `dist/` |
| `npm run build:single` | Self-contained single `.html` file per deck (for sharing) |
| `npm run preview` | Preview the production build locally |
| `npm run new <name>` | Scaffold `decks/<name>/index.html` from the starter template |

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| `→` `Space` `PgDn` | Next slide (or next step if paused) |
| `←` `PgUp` | Previous slide (or hide last step) |
| `Home` | Jump to slide 1 |
| `End` | Jump to last slide |
| `R` | Reset to slide 1 |
| `F` | Toggle fullscreen |
| `N` | Open speaker notes window |
| `1`–`9` | Jump to slide N |

---

## Deck structure

Every deck is a single `index.html` inside `decks/<name>/`. The minimal anatomy:

```html
<head>
  <meta name="deck-theme" content="palette=paper;font=swiss-sans;accent=#d23b1c;density=comfortable;titleFx=dust">
  <meta name="deck-date"  content="Conference · 2025">
  <script type="module" src="/src/main.js"></script>
</head>
<body>
<deck-stage width="1920" height="1080">

  <!-- slides go here -->

</deck-stage>

<div id="tweaks-root"></div>

<progress-bar sections='[…]'></progress-bar>

<script type="application/json" id="speaker-notes">
["Note for slide 1", "Note for slide 2"]
</script>
</body>
```

`deck-stage` auto-scales to fill the viewport while preserving the 1920×1080 aspect ratio.

---

## Slide types

### Title slide

```html
<section data-label="Title">
  <title-fx></title-fx>
  <div class="particle-scrim"></div>
  <div style="position:relative;z-index:1;flex:1;display:flex;flex-direction:column;justify-content:space-between;">
    <div class="label">Your talk · Date</div>
    <div>
      <div class="eyebrow" style="margin-bottom:32px;">Subtitle</div>
      <h1 class="title">Talk Title</h1>
      <div class="lede" style="margin-top:36px;max-width:1300px;">One-line summary.</div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:baseline;">
      <div class="body" style="font-size:28px;">Author</div>
      <div class="small">Venue · Year</div>
    </div>
  </div>
</section>
```

`<title-fx>` renders the animated background (controlled by `titleFx` in the theme). `.particle-scrim` is the left-side veil that keeps the title readable.

### Table of contents

```html
<toc-slide></toc-slide>
```

Auto-populated from all `<section-divider>` elements in the deck. No configuration needed.

### Section divider

```html
<section-divider
  label="Optimization"
  kicker="Part 02"
  blurb="One sentence describing this section.">
</section-divider>
```

`num` is optional — auto-computed from DOM order. `blurb` appears in the TOC.

### Content slide

```html
<section>
  <slide-header title="Your Slide Title"></slide-header>
  <div class="slide-body">
    <!-- your content -->
  </div>
  <slide-footer></slide-footer>
</section>
```

`<slide-header>` shows the slide title + auto-numbered position. `<slide-footer>` shows deck title + date from `<meta name="deck-date">`.

### End slide

```html
<end-slide></end-slide>
```

Auto-numbered and auto-totalled. No attributes needed.

---

## Layout helpers

Use these inside `.slide-body` to avoid inline styles:

```html
<!-- Two equal columns -->
<div class="cols cols-2">
  <div>Left</div>
  <div>Right</div>
</div>

<!-- Other column ratios -->
<div class="cols cols-3">…</div>      <!-- 1fr 1fr 1fr -->
<div class="cols cols-1-2">…</div>   <!-- 1fr 2fr -->
<div class="cols cols-2-1">…</div>   <!-- 2fr 1fr -->
<div class="cols cols-1-3">…</div>   <!-- 1fr 3fr -->
<div class="cols cols-3-1">…</div>   <!-- 3fr 1fr -->
```

`.slide-body` is `flex:1` + column flex, so content fills the vertical space between header and footer.

---

## Step reveals (Beamer-style pauses)

Add `data-step` to any element to hide it until navigation reaches it:

```html
<section>
  <slide-header title="My Slide"></slide-header>
  <div class="slide-body">
    <p>Always visible.</p>
    <p data-step>Revealed on first → press.</p>
    <p data-step>Revealed on second → press.</p>
  </div>
  <slide-footer></slide-footer>
</section>
```

- `→` reveals the next hidden element; the slide doesn't advance until all steps are visible.
- `←` hides the last revealed element; going back past step 1 moves to the previous slide with all its steps already revealed.
- The overlay shows `step N / M` while on a stepped slide.
- Steps are invisible in print/PDF export.

---

## Speaker notes

Write notes inline, right next to the slide they belong to:

```html
<section>
  <slide-note>Key point to emphasise here. Mention the 2023 paper.</slide-note>
  <slide-header title="My Slide"></slide-header>
  …
</section>
```

`<slide-note>` is invisible in the rendered deck. Works inside any slide element: `<section>`, `<section-divider>`, `<toc-slide>`, `<end-slide>`.

Press **N** in the deck to open the notes window. It syncs live via `localStorage` — no server needed.

The legacy `#speaker-notes` JSON block is still supported as a fallback if no inline notes are found.

### Notes window controls

| Key | Action |
|---|---|
| `Space` | Start / pause timer |
| `R` | Reset timer |
| `N` | Re-focus the deck window |

Type a countdown target (e.g. `20:00`) in the `cd` input. The timer turns amber in the last 20% and pulses red when time is up.

---

## Theme

Set per-deck via `<meta name="deck-theme">`:

```html
<meta name="deck-theme" content="palette=paper;font=swiss-sans;accent=#d23b1c;density=comfortable;titleFx=dust">
```

| Key | Options |
|---|---|
| `palette` | `paper` · `warm` · `cool` · `dark` · `slate` · `forest` |
| `font` | `swiss-sans` · `modern-mixed` · `editorial` · `classic` |
| `accent` | Any CSS color |
| `density` | `compact` · `comfortable` · `airy` |
| `titleFx` | `off` · `flow` · `constellation` · `dust` · `aurora` · `halftone` |

All options are also adjustable live via the **tweaks panel** (gear icon, bottom-right). Changes are saved per-deck in `localStorage` and survive reload. "Reset to deck default" restores the meta-tag values.

---

## Progress bar

```html
<progress-bar></progress-bar>
```

Sections are **auto-derived from `<section-divider>` elements** in the deck — no configuration needed. Each section spans from its divider to just before the next one; the last section extends to `<end-slide>`.

Override with explicit JSON if needed (0-based indices):

```html
<progress-bar sections='[
  {"label":"Background", "start":2, "end":7},
  {"label":"Algorithms", "start":8, "end":14}
]'></progress-bar>
```

The fox mascot is enabled via `foxProgress` in the tweaks panel.

---

## Typography classes

| Class | Use |
|---|---|
| `.title` | Hero title (~140px) |
| `.lede` | Large intro text (~52px) |
| `.h1` / `.h2` / `.h3` | Section headings |
| `.body` | Body text (~32px) |
| `.small` | Captions / labels (~24px) |
| `.label` | Mono uppercase label (~20px) |
| `.eyebrow` | Accent-colored kicker above title |
| `.code` | Monospace inline code |

Math via KaTeX: wrap in `<span class="math">…</span>` (inline) or `<div class="display-math">…</div>` (block). LaTeX source goes directly as text content.

---

## D3 / React islands

Custom elements that mount React or D3 visualizations. Register new ones in `src/islands/register.jsx`. Built-in islands:

| Tag | Description |
|---|---|
| `<title-fx>` | Animated title background (mode set by theme) |
| `<toc-slide>` | Auto-generated table of contents |
| `<section-divider>` | Section break with number, label, kicker |
| `<slide-header>` | Slide title + auto page number |
| `<slide-footer>` | Deck title + date footer |
| `<progress-bar>` | Bottom progress strip with section labels |
| `<end-slide>` | Thank-you / questions final slide |
| `<riemannian-descent>` | Animated RGD on S² |
| `<tangent-projection>` | Gradient decomposition visualization |
| `<algorithm-comparison>` | RGD vs RCG convergence |
| `<spd-geodesic>` | Geodesic on SPD manifold |
| `<poincare-disk>` | Hyperbolic geometry |
| `<scatter-flow>` | Animated scatter with flow field |
| `<nll-chart>` / `<dist-chart>` | Statistical charts |

To add a new island: create a React component in `src/islands/`, import it in `register.jsx`, and call `defineReactElement('your-tag', YourComponent)`.

---

## File layout

```
decks/
  <name>/index.html     ← your deck
notes.html              ← speaker notes window (open manually)
src/
  main.js               ← entry point
  runtime/
    deck-stage.js       ← web component engine
  islands/
    register.jsx        ← custom element registry
    slide-elements.jsx  ← slide chrome (header, footer, TOC, …)
    title-fx.jsx        ← title background animations
    d3/                 ← D3 visualization islands
  theme/
    theme.css           ← all typography, layout, component styles
    presets.js          ← palette / font / density / fx definitions
    apply-theme.js      ← writes CSS vars from preset
    tweaks-panel.jsx    ← live tweaks UI
scripts/
  new-deck.mjs          ← deck scaffolder
```
