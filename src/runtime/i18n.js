// i18n.js — bilingual decks (EN/FR). Runs before the islands register, so every
// component mounts with the chosen language already in place.
//
// Authoring:
//   text      <div data-fr="Texte FR">English text</div>          (innerHTML swap)
//   attribute <slide-header title="Title" title-fr="Titre">       (any attr + "-fr")
//   head      <meta name="deck-title-fr" content="…">, <meta name="deck-date" content="…" content-fr="…">
// Default language: ?lang=fr|en, else localStorage, else <meta name="deck-lang">, else "en".
// Toggle: FR/EN button (top-right) or the "L" key. Switching reloads, keeping the slide.

const KEY = 'deck-lang';

export function getLang() {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'fr' || q === 'en') return q;
  const s = localStorage.getItem(KEY);
  if (s === 'fr' || s === 'en') return s;
  return document.querySelector('meta[name="deck-lang"]')?.content || 'en';
}

function apply(lang) {
  document.documentElement.lang = lang;
  if (lang !== 'fr') return;
  const t = document.querySelector('meta[name="deck-title-fr"]');
  if (t) document.title = t.content;
  document.querySelectorAll('[data-fr]').forEach(el => { el.innerHTML = el.getAttribute('data-fr'); });
  document.querySelectorAll('*').forEach(el => {
    for (const a of [...el.attributes]) {
      if (a.name.endsWith('-fr') && a.name !== 'data-fr') el.setAttribute(a.name.slice(0, -3), a.value);
    }
  });
}

export function setLang(lang) {
  localStorage.setItem(KEY, lang);
  const u = new URL(location.href);
  if (u.searchParams.has('lang')) u.searchParams.set('lang', lang);
  location.replace(u.href);
}

function mountToggle(lang) {
  const b = document.createElement('button');
  b.className = 'lang-toggle';
  b.title = 'Language (L)';
  b.innerHTML = `<span${lang === 'fr' ? ' class="on"' : ''}>FR</span><span${lang === 'en' ? ' class="on"' : ''}>EN</span>`;
  b.addEventListener('click', () => setLang(lang === 'fr' ? 'en' : 'fr'));
  document.body.appendChild(b);
  const st = document.createElement('style');
  st.textContent = `.lang-toggle{position:fixed;top:14px;right:16px;z-index:2147483645;display:flex;gap:2px;padding:3px;background:var(--bg);border:1px solid var(--rule);border-radius:6px;cursor:pointer;font-family:var(--mono);font-size:12px;opacity:.35;transition:opacity 200ms}
.lang-toggle:hover{opacity:1}.lang-toggle span{padding:3px 8px;border-radius:4px;color:var(--ink-3)}.lang-toggle span.on{background:var(--ink);color:var(--bg)}
@media print{.lang-toggle{display:none}}`;
  document.head.appendChild(st);
  document.addEventListener('keydown', e => {
    if ((e.key === 'l' || e.key === 'L') && !e.metaKey && !e.ctrlKey && !e.altKey && !/INPUT|TEXTAREA/.test(e.target.tagName)) {
      setLang(lang === 'fr' ? 'en' : 'fr');
    }
  });
}

const lang = getLang();
apply(lang);
mountToggle(lang);

// Small helper for islands: tr({ en: '…', fr: '…' })
export const tr = (o) => (document.documentElement.lang === 'fr' ? o.fr : o.en) ?? o.en;
