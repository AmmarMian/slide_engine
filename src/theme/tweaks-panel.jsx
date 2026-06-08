// tweaks-panel.jsx — theme editor modal, opened with E key or the ⚙ button.
// Persistence: localStorage (primary) + postMessage to parent (host compat).

import React from 'react';
import { PALETTES, FONT_SYSTEMS, DENSITIES, ACCENT_SWATCHES, TITLE_FX } from './presets.js';
import { saveTheme, resetTheme, initialTheme } from './apply-theme.js';

// ── Design tokens (dark modal surface) ───────────────────────────────────
const D = {
  label:    'rgba(255,255,255,0.38)',
  sect:     'rgba(255,255,255,0.28)',
  text:     'rgba(255,255,255,0.82)',
  track:    'rgba(255,255,255,0.08)',
  thumb:    'rgba(255,255,255,0.16)',
  border:   'rgba(255,255,255,0.12)',
  fieldBg:  'rgba(255,255,255,0.07)',
  fieldFg:  'rgba(255,255,255,0.82)',
  divider:  'rgba(255,255,255,0.08)',
  btnBg:    'rgba(255,255,255,0.1)',
  btnHover: 'rgba(255,255,255,0.16)',
  accent:   'var(--accent, #d23b1c)',
  mono:     'ui-monospace, monospace',
  sans:     'ui-sans-serif, system-ui, -apple-system, sans-serif',
};

// ── useTweaks ──────────────────────────────────────────────────────────────
function useTweaks(initial) {
  const [values, setValues] = React.useState(initial);
  const set = React.useCallback((keyOrEdits, val) => {
    const edits = typeof keyOrEdits === 'object' && keyOrEdits !== null
      ? keyOrEdits : { [keyOrEdits]: val };
    setValues(prev => ({ ...prev, ...edits }));
    saveTheme(edits);
    try { window.parent.postMessage({ type: '__edit_mode_set_keys', edits }, '*'); } catch {}
  }, []);
  return [values, set];
}

// ── Segmented radio ────────────────────────────────────────────────────────
function TweakRadio({ label, value, options, onChange }) {
  const trackRef = React.useRef(null);
  const [dragging, setDragging] = React.useState(false);
  const opts = options.map(o => (typeof o === 'object' ? o : { value: o, label: o }));
  const idx = Math.max(0, opts.findIndex(o => o.value === value));
  const n = opts.length;
  const valueRef = React.useRef(value);
  valueRef.current = value;

  const segAt = (clientX) => {
    const r = trackRef.current.getBoundingClientRect();
    const i = Math.floor(((clientX - r.left - 2) / (r.width - 4)) * n);
    return opts[Math.max(0, Math.min(n - 1, i))].value;
  };
  const onPointerDown = (e) => {
    setDragging(true);
    const v0 = segAt(e.clientX);
    if (v0 !== valueRef.current) onChange(v0);
    const move = (ev) => { const v = segAt(ev.clientX); if (v !== valueRef.current) onChange(v); };
    const up = () => { setDragging(false); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {label && <span style={{ fontFamily: D.mono, fontSize: 9, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: D.sect }}>{label}</span>}
      <div
        ref={trackRef} role="radiogroup" onPointerDown={onPointerDown}
        style={{
          position: 'relative', display: 'flex', padding: 2, borderRadius: 7,
          background: D.track, userSelect: 'none',
          cursor: 'default',
        }}
      >
        <div style={{
          position: 'absolute', top: 2, bottom: 2, borderRadius: 5,
          background: D.thumb, boxShadow: '0 1px 3px rgba(0,0,0,.4)',
          transition: dragging ? 'none' : 'left .15s cubic-bezier(.3,.7,.4,1), width .15s',
          left: `calc(2px + ${idx} * (100% - 4px) / ${n})`,
          width: `calc((100% - 4px) / ${n})`,
        }} />
        {opts.map(o => (
          <button key={o.value} type="button" role="radio" aria-checked={o.value === value}
            style={{
              appearance: 'none', position: 'relative', zIndex: 1, flex: 1, border: 0,
              background: 'transparent', fontFamily: D.sans, fontSize: 12, fontWeight: 500,
              color: o.value === value ? D.text : D.label,
              minHeight: 26, borderRadius: 5, cursor: 'default',
              padding: '4px 6px', lineHeight: 1.2, overflowWrap: 'anywhere',
              transition: 'color 120ms',
            }}
          >{o.label}</button>
        ))}
      </div>
    </div>
  );
}

// ── Continuous slider ──────────────────────────────────────────────────────
function TweakSlider({ label, value, min, max, step, format, onChange }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontFamily: D.mono, fontSize: 9, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: D.sect }}>{label}</span>
          <span style={{ fontFamily: D.mono, fontSize: 11, color: D.text }}>{format ? format(value) : value}</span>
        </div>
      )}
      <div style={{ position: 'relative', height: 20, display: 'flex', alignItems: 'center' }}>
        <div style={{
          position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 2,
          background: D.track, overflow: 'hidden',
        }}>
          <div style={{ width: `${pct}%`, height: '100%', background: D.accent }} />
        </div>
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          style={{
            position: 'absolute', left: 0, right: 0, width: '100%',
            opacity: 0, height: 20, cursor: 'default', margin: 0,
          }}
        />
        <div style={{
          position: 'absolute',
          left: `calc(${pct}% - 8px)`,
          width: 16, height: 16, borderRadius: '50%',
          background: D.thumb, boxShadow: '0 1px 4px rgba(0,0,0,.5)',
          pointerEvents: 'none',
        }} />
      </div>
    </div>
  );
}

// ── Select ─────────────────────────────────────────────────────────────────
function TweakSelect({ label, value, options, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {label && <span style={{ fontFamily: D.mono, fontSize: 9, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: D.sect }}>{label}</span>}
      <select
        value={value} onChange={e => onChange(e.target.value)}
        style={{
          appearance: 'none', width: '100%', height: 30, padding: '0 28px 0 10px',
          border: `1px solid ${D.border}`, borderRadius: 7,
          background: `${D.fieldBg} url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='rgba(255,255,255,.4)' d='M0 0h10L5 6z'/></svg>") no-repeat right 8px center`,
          color: D.fieldFg, fontFamily: D.sans, fontSize: 12, outline: 'none', cursor: 'default',
        }}
      >
        {options.map(o => {
          const v = typeof o === 'object' ? o.value : o;
          const l = typeof o === 'object' ? o.label : o;
          return <option key={v} value={v}>{l}</option>;
        })}
      </select>
    </div>
  );
}

// ── Palette picker (coloured squares) ─────────────────────────────────────
function TweakPalette({ value, options, onChange }) {
  const BG = { paper:'#f4f3ef', warm:'#f7f1e6', cool:'#f1f3f6', dark:'#0e0d0b', slate:'#f0f0f2', forest:'#f2f4f0' };
  const INK = { paper:'#0a0a0a', warm:'#1a1410', cool:'#0c1422', dark:'#f3eee0', slate:'#161820', forest:'#141a10' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <span style={{ fontFamily: D.mono, fontSize: 9, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: D.sect }}>Palette</span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {options.map(name => (
          <button key={name} type="button" title={name} onClick={() => onChange(name)}
            style={{
              width: 34, height: 34, borderRadius: 7, border: `2px solid ${value === name ? 'rgba(255,255,255,0.7)' : 'transparent'}`,
              background: BG[name] || '#eee',
              cursor: 'default', transition: 'border-color 100ms, transform 80ms',
              transform: value === name ? 'scale(1.1)' : 'scale(1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
            }}
          >
            <div style={{ width: 10, height: 10, borderRadius: 2, background: INK[name] || '#333', opacity: 0.4 }} />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Accent swatches + free color picker ───────────────────────────────────
function TweakAccent({ value, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <span style={{ fontFamily: D.mono, fontSize: 9, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: D.sect }}>Accent</span>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {ACCENT_SWATCHES.map(s => (
          <button key={s.value} type="button" title={s.label}
            onClick={() => onChange(s.value)}
            style={{
              width: 22, height: 22, borderRadius: 5,
              border: `2px solid ${value === s.value ? 'rgba(255,255,255,0.7)' : 'transparent'}`,
              background: s.value, cursor: 'default',
              transition: 'border-color 100ms, transform 80ms',
              transform: value === s.value ? 'scale(1.12)' : 'scale(1)',
            }}
          />
        ))}
        <label title="Custom colour" style={{
          width: 22, height: 22, borderRadius: 5, overflow: 'hidden', cursor: 'default',
          border: `2px solid ${D.border}`, position: 'relative', flexShrink: 0,
          background: 'rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 11, color: D.label, pointerEvents: 'none' }}>+</span>
          <input type="color" value={value} onChange={e => onChange(e.target.value)}
            style={{
              position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%',
              cursor: 'default', border: 0, padding: 0,
            }} />
        </label>
        <span style={{
          display: 'flex', alignItems: 'center',
          fontFamily: D.mono, fontSize: 10, color: D.label, letterSpacing: '0.05em',
        }}>{value}</span>
      </div>
    </div>
  );
}

// ── Copy-as-meta-tag button ────────────────────────────────────────────────
function CopyMetaButton({ theme }) {
  const [label, setLabel] = React.useState('Copy as <meta> tag');
  const copy = () => {
    const parts = [
      `palette=${theme.palette}`,
      `font=${theme.font}`,
      `accent=${theme.accent || '#d23b1c'}`,
      `density=${theme.density}`,
      `titleFx=${theme.titleFx ?? 'constellation'}`,
    ];
    if (theme.typeScale != null && theme.typeScale !== 1) parts.push(`scale=${theme.typeScale}`);
    const tag = `<meta name="deck-theme" content="${parts.join(';')}">`;
    const write = () => { setLabel('Copied!'); setTimeout(() => setLabel('Copy as <meta> tag'), 2000); };
    try { navigator.clipboard.writeText(tag).then(write).catch(() => legacyCopy(tag, write)); }
    catch { legacyCopy(tag, write); }
  };
  return (
    <button type="button" onClick={copy} style={{
      appearance: 'none', height: 30, padding: '0 14px', border: `1px solid ${D.border}`,
      borderRadius: 7, background: D.btnBg, color: D.text,
      fontFamily: D.mono, fontSize: 10, letterSpacing: '0.03em',
      cursor: 'default', transition: 'background 100ms',
    }}
    onMouseEnter={e => e.currentTarget.style.background = D.btnHover}
    onMouseLeave={e => e.currentTarget.style.background = D.btnBg}
    >{label}</button>
  );
}

function legacyCopy(text, cb) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); cb(); } catch {}
  document.body.removeChild(ta);
}

// ── Panel shell ────────────────────────────────────────────────────────────
export function TweaksPanel() {
  const [t, setTweak] = useTweaks(initialTheme);
  const [open, setOpen] = React.useState(false);
  const overlayRef = React.useRef(null);

  React.useEffect(() => {
    const handler = (e) => {
      const t = e.target;
      const editable = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if (!editable && (e.key === 'e' || e.key === 'E') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (open) {
          e.stopPropagation(); e.preventDefault(); setOpen(false);
        } else if (!document.body.dataset.modalOpen) {
          e.stopPropagation(); e.preventDefault(); setOpen(true);
        }
      } else if (e.key === 'Escape' && open) {
        e.stopPropagation(); setOpen(false);
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [open]);

  React.useEffect(() => {
    if (open) document.body.dataset.modalOpen = '1';
    else delete document.body.dataset.modalOpen;
  }, [open]);

  React.useEffect(() => {
    const onMsg = (e) => {
      const ty = e?.data?.type;
      if (ty === '__activate_edit_mode') setOpen(true);
      else if (ty === '__deactivate_edit_mode') setOpen(false);
    };
    window.addEventListener('message', onMsg);
    try { window.parent.postMessage({ type: '__edit_mode_available' }, '*'); } catch {}
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const dismiss = () => {
    setOpen(false);
    try { window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*'); } catch {}
  };

  const palOptions = Object.keys(PALETTES);
  const fontOptions = Object.entries(FONT_SYSTEMS).map(([value, f]) => ({ value, label: f.label }));
  const densityOptions = Object.keys(DENSITIES);

  return (
    <>
      {/* Floating trigger */}
      <button onClick={() => setOpen(o => !o)} title="Theme editor (E)" aria-label="Open theme editor"
        style={{
          position: 'fixed', right: 16, bottom: 16, zIndex: 2147483645,
          width: 36, height: 36, borderRadius: '50%', border: 0,
          background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 16,
          cursor: 'default', display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(8px)', boxShadow: '0 2px 8px rgba(0,0,0,.3)',
        }}
      >⚙</button>

      {/* Modal */}
      {open && (
        <div ref={overlayRef}
          onClick={(e) => { if (e.target === overlayRef.current) dismiss(); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 2147483646,
            backdropFilter: 'blur(28px) saturate(0.65)',
            WebkitBackdropFilter: 'blur(28px) saturate(0.65)',
            background: 'rgba(6,6,6,0.82)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'toc-fade-in 150ms ease',
          }}
        >
          <div style={{
            width: 'min(700px, 92vw)',
            padding: '44px 52px 40px',
            animation: 'toc-rise 200ms cubic-bezier(0.16,1,0.3,1)',
          }}>
            {/* Header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              marginBottom: 32, paddingBottom: 16,
              borderBottom: `1px solid ${D.divider}`,
            }}>
              <span style={{ fontFamily: D.mono, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: D.sect }}>
                Theme editor — <kbd style={{ background: 'rgba(255,255,255,0.09)', borderRadius: 3, padding: '2px 5px', fontFamily: D.mono, fontSize: 9 }}>E</kbd> or <kbd style={{ background: 'rgba(255,255,255,0.09)', borderRadius: 3, padding: '2px 5px', fontFamily: D.mono, fontSize: 9 }}>ESC</kbd> to close
              </span>
            </div>

            {/* Two-column grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px 48px' }}>

              {/* Left column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <TweakPalette value={t.palette} options={palOptions} onChange={v => setTweak('palette', v)} />
                <TweakAccent value={t.accent || '#d23b1c'} onChange={v => setTweak('accent', v)} />
                <TweakSelect label="Font system" value={t.font} options={fontOptions} onChange={v => setTweak('font', v)} />
              </div>

              {/* Right column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <TweakRadio label="Density" value={t.density} options={densityOptions} onChange={v => setTweak('density', v)} />
                <TweakSlider label="Type scale"
                  value={t.typeScale ?? 1}
                  min={0.5} max={3} step={0.05}
                  format={v => `${Math.round(v * 100)}%`}
                  onChange={v => setTweak('typeScale', v)}
                />
                <TweakRadio label="Footer"
                  value={t.hideFooter ? 'hidden' : 'visible'}
                  options={[{ value: 'visible', label: 'Visible' }, { value: 'hidden', label: 'Hidden' }]}
                  onChange={v => setTweak('hideFooter', v === 'hidden')}
                />
                <TweakSelect label="Title animation" value={t.titleFx ?? 'dust'} options={TITLE_FX} onChange={v => setTweak('titleFx', v)} />
                <TweakRadio label="Fox mascot"
                  value={t.foxProgress ? 'on' : 'off'}
                  options={[{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }]}
                  onChange={v => setTweak('foxProgress', v === 'on')}
                />
              </div>
            </div>

            {/* Footer actions */}
            <div style={{
              marginTop: 32, paddingTop: 18,
              borderTop: `1px solid ${D.divider}`,
              display: 'flex', gap: 10,
            }}>
              <CopyMetaButton theme={t} />
              <button type="button" onClick={() => { const t2 = resetTheme(); setTweak(t2); }}
                style={{
                  appearance: 'none', height: 30, padding: '0 14px',
                  border: `1px solid ${D.border}`, borderRadius: 7,
                  background: 'transparent', color: D.label,
                  fontFamily: D.sans, fontSize: 12, cursor: 'default',
                  transition: 'color 100ms, background 100ms',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = D.btnBg; e.currentTarget.style.color = D.text; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = D.label; }}
              >Reset to default</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
