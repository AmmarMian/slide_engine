// tweaks-panel.jsx — live theming panel, ported to ES modules.
// Persistence: localStorage (primary) + postMessage to parent (kept for
// compatibility with the Claude design host, harmless in standalone use).

import React from 'react';
import { PALETTES, FONT_SYSTEMS, DENSITIES, ACCENT_SWATCHES, TITLE_FX } from './presets.js';
import { saveTheme, resetTheme, initialTheme } from './apply-theme.js';

const __TWEAKS_STYLE = `
  .twk-panel{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:300px;
    max-height:calc(100vh - 32px);display:flex;flex-direction:column;
    background:rgba(250,249,247,.88);color:#29261b;
    -webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);
    border:.5px solid rgba(255,255,255,.6);border-radius:14px;
    box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 12px 40px rgba(0,0,0,.18);
    font:11.5px/1.4 ui-sans-serif,system-ui,-apple-system,sans-serif;overflow:hidden}
  .twk-hd{display:flex;align-items:center;justify-content:space-between;
    padding:10px 8px 10px 14px;cursor:move;user-select:none;
    border-bottom:.5px solid rgba(0,0,0,.08)}
  .twk-hd b{font-size:12px;font-weight:600;letter-spacing:.01em}
  .twk-x{appearance:none;border:0;background:transparent;color:rgba(41,38,27,.55);
    width:22px;height:22px;border-radius:6px;cursor:default;font-size:13px;line-height:1}
  .twk-x:hover{background:rgba(0,0,0,.06);color:#29261b}
  .twk-body{padding:2px 14px 14px;display:flex;flex-direction:column;gap:10px;
    overflow-y:auto;overflow-x:hidden;min-height:0;
    scrollbar-width:thin;scrollbar-color:rgba(0,0,0,.15) transparent}
  .twk-body::-webkit-scrollbar{width:8px}
  .twk-body::-webkit-scrollbar-track{background:transparent;margin:2px}
  .twk-body::-webkit-scrollbar-thumb{background:rgba(0,0,0,.15);border-radius:4px;
    border:2px solid transparent;background-clip:content-box}
  .twk-row{display:flex;flex-direction:column;gap:5px}
  .twk-row-h{flex-direction:row;align-items:center;justify-content:space-between;gap:10px}
  .twk-lbl{display:flex;justify-content:space-between;align-items:baseline;
    color:rgba(41,38,27,.72)}
  .twk-lbl>span:first-child{font-weight:500}
  .twk-val{color:rgba(41,38,27,.5);font-variant-numeric:tabular-nums}
  .twk-sect{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
    color:rgba(41,38,27,.45);padding:10px 0 0}
  .twk-sect:first-child{padding-top:0}
  .twk-field{appearance:none;width:100%;height:26px;padding:0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;
    background:rgba(255,255,255,.6);color:inherit;font:inherit;outline:none}
  .twk-field:focus{border-color:rgba(0,0,0,.25);background:rgba(255,255,255,.85)}
  select.twk-field{padding-right:22px;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='rgba(0,0,0,.5)' d='M0 0h10L5 6z'/></svg>");
    background-repeat:no-repeat;background-position:right 8px center}
  .twk-seg{position:relative;display:flex;padding:2px;border-radius:8px;
    background:rgba(0,0,0,.06);user-select:none}
  .twk-seg-thumb{position:absolute;top:2px;bottom:2px;border-radius:6px;
    background:rgba(255,255,255,.9);box-shadow:0 1px 2px rgba(0,0,0,.12);
    transition:left .15s cubic-bezier(.3,.7,.4,1),width .15s}
  .twk-seg.dragging .twk-seg-thumb{transition:none}
  .twk-seg button{appearance:none;position:relative;z-index:1;flex:1;border:0;
    background:transparent;color:inherit;font:inherit;font-weight:500;min-height:22px;
    border-radius:6px;cursor:default;padding:4px 6px;line-height:1.2;overflow-wrap:anywhere}
  .twk-swatch-row{display:flex;gap:6px;flex-wrap:wrap}
  .twk-swatch-btn{width:22px;height:22px;border-radius:5px;border:2px solid transparent;
    cursor:default;transition:transform .1s}
  .twk-swatch-btn:hover{transform:scale(1.15)}
  .twk-swatch-btn.active{border-color:rgba(0,0,0,.5)}
  .twk-color-row{display:flex;gap:8px;align-items:center}
  .twk-color-input{appearance:none;-webkit-appearance:none;width:26px;height:26px;
    border:.5px solid rgba(0,0,0,.12);border-radius:6px;padding:0;cursor:default;background:transparent}
  .twk-color-input::-webkit-color-swatch-wrapper{padding:2px}
  .twk-color-input::-webkit-color-swatch{border:0;border-radius:4px}
  .twk-color-input::-moz-color-swatch{border:0;border-radius:4px}
  .twk-btn{appearance:none;height:26px;padding:0 12px;border:0;border-radius:7px;
    background:rgba(0,0,0,.78);color:#fff;font:inherit;font-weight:500;cursor:default}
  .twk-btn:hover{background:rgba(0,0,0,.88)}
  .twk-btn.secondary{background:rgba(0,0,0,.06);color:inherit}
  .twk-btn.secondary:hover{background:rgba(0,0,0,.1)}
`;

// ── useTweaks ──────────────────────────────────────────────────────────────
function useTweaks(initial) {
  const [values, setValues] = React.useState(initial);
  const set = React.useCallback((keyOrEdits, val) => {
    const edits = typeof keyOrEdits === 'object' && keyOrEdits !== null
      ? keyOrEdits : { [keyOrEdits]: val };
    setValues(prev => ({ ...prev, ...edits }));
    saveTheme(edits);
    // Keep postMessage for host compat (no-op when not in iframe).
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
    <div className="twk-row">
      <div className="twk-lbl"><span>{label}</span></div>
      <div ref={trackRef} role="radiogroup" onPointerDown={onPointerDown}
           className={dragging ? 'twk-seg dragging' : 'twk-seg'}>
        <div className="twk-seg-thumb"
             style={{ left: `calc(2px + ${idx} * (100% - 4px) / ${n})`, width: `calc((100% - 4px) / ${n})` }} />
        {opts.map(o => <button key={o.value} type="button" role="radio" aria-checked={o.value === value}>{o.label}</button>)}
      </div>
    </div>
  );
}

// ── Select ─────────────────────────────────────────────────────────────────
function TweakSelect({ label, value, options, onChange }) {
  return (
    <div className="twk-row">
      <div className="twk-lbl"><span>{label}</span></div>
      <select className="twk-field" value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => {
          const v = typeof o === 'object' ? o.value : o;
          const l = typeof o === 'object' ? o.label : o;
          return <option key={v} value={v}>{l}</option>;
        })}
      </select>
    </div>
  );
}

// ── Accent swatches + free color picker ───────────────────────────────────
function TweakAccent({ value, onChange }) {
  return (
    <div className="twk-row">
      <div className="twk-lbl"><span>Accent color</span></div>
      <div className="twk-swatch-row">
        {ACCENT_SWATCHES.map(s => (
          <button key={s.value} type="button" title={s.label}
                  className={`twk-swatch-btn ${value === s.value ? 'active' : ''}`}
                  style={{ background: s.value }}
                  onClick={() => onChange(s.value)} />
        ))}
      </div>
      <div className="twk-color-row" style={{ marginTop: 6 }}>
        <input type="color" className="twk-color-input" value={value}
               onChange={e => onChange(e.target.value)} />
        <span style={{ fontSize: 11, color: 'rgba(41,38,27,.5)', fontFamily: 'ui-monospace,monospace' }}>{value}</span>
      </div>
    </div>
  );
}

// ── Panel shell ────────────────────────────────────────────────────────────
export function TweaksPanel() {
  const [t, setTweak] = useTweaks(initialTheme);
  const [open, setOpen] = React.useState(false);
  const dragRef = React.useRef(null);
  const offsetRef = React.useRef({ x: 16, y: 16 });
  const PAD = 16;

  const clamp = React.useCallback(() => {
    const panel = dragRef.current;
    if (!panel) return;
    const w = panel.offsetWidth, h = panel.offsetHeight;
    offsetRef.current = {
      x: Math.min(Math.max(PAD, offsetRef.current.x), Math.max(PAD, window.innerWidth - w - PAD)),
      y: Math.min(Math.max(PAD, offsetRef.current.y), Math.max(PAD, window.innerHeight - h - PAD)),
    };
    panel.style.right  = offsetRef.current.x + 'px';
    panel.style.bottom = offsetRef.current.y + 'px';
  }, []);

  React.useEffect(() => {
    if (!open) return;
    clamp();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(clamp) : null;
    ro ? ro.observe(document.documentElement) : window.addEventListener('resize', clamp);
    return () => ro ? ro.disconnect() : window.removeEventListener('resize', clamp);
  }, [open, clamp]);

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

  const onDragStart = (e) => {
    const panel = dragRef.current;
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY;
    const startR = window.innerWidth - r.right, startB = window.innerHeight - r.bottom;
    const move = (ev) => { offsetRef.current = { x: startR - (ev.clientX - sx), y: startB - (ev.clientY - sy) }; clamp(); };
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  // Floating trigger button when panel is closed.
  if (!open) {
    return (
      <>
        <style>{__TWEAKS_STYLE}</style>
        <button
          onClick={() => setOpen(true)}
          style={{
            position: 'fixed', right: 16, bottom: 16, zIndex: 2147483645,
            width: 36, height: 36, borderRadius: '50%', border: 0,
            background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 16,
            cursor: 'default', display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(8px)', boxShadow: '0 2px 8px rgba(0,0,0,.3)',
          }}
          title="Open theme tweaks"
          aria-label="Open theme tweaks"
        >⚙</button>
      </>
    );
  }

  const palOptions = Object.keys(PALETTES);
  const fontOptions = Object.entries(FONT_SYSTEMS).map(([value, f]) => ({ value, label: f.label }));
  const densityOptions = Object.keys(DENSITIES);

  return (
    <>
      <style>{__TWEAKS_STYLE}</style>
      <div ref={dragRef} className="twk-panel" data-noncommentable=""
           style={{ right: offsetRef.current.x, bottom: offsetRef.current.y }}>
        <div className="twk-hd" onMouseDown={onDragStart}>
          <b>Theme</b>
          <button className="twk-x" aria-label="Close" onMouseDown={e => e.stopPropagation()} onClick={dismiss}>✕</button>
        </div>
        <div className="twk-body">
          <div className="twk-sect">Palette</div>
          <TweakRadio label="Background" value={t.palette} options={palOptions} onChange={v => setTweak('palette', v)} />

          <div className="twk-sect">Accent</div>
          <TweakAccent value={t.accent || '#d23b1c'} onChange={v => setTweak('accent', v)} />

          <div className="twk-sect">Typography</div>
          <TweakSelect label="Font system" value={t.font} options={fontOptions} onChange={v => setTweak('font', v)} />

          <div className="twk-sect">Layout</div>
          <TweakRadio label="Density" value={t.density} options={densityOptions} onChange={v => setTweak('density', v)} />
          <TweakRadio
            label="Type scale"
            value={String(t.typeScale ?? 1)}
            options={[
              { value: '0.75', label: '75%' },
              { value: '0.85', label: '85%' },
              { value: '1',    label: '100%' },
              { value: '1.1',  label: '110%' },
            ]}
            onChange={v => setTweak('typeScale', parseFloat(v))}
          />

          <div className="twk-sect">Effects</div>
          <TweakSelect
            label="Title animation"
            value={t.titleFx ?? 'dust'}
            options={TITLE_FX}
            onChange={v => setTweak('titleFx', v)}
          />
          <TweakRadio
            label="Fox mascot"
            value={t.foxProgress ? 'on' : 'off'}
            options={[{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }]}
            onChange={v => setTweak('foxProgress', v === 'on')}
          />

          <div className="twk-sect" style={{ marginTop: 4 }} />
          <button type="button" className="twk-btn secondary" onClick={() => {
            const t2 = resetTheme();
            setTweak(t2);
          }}>Reset to deck default</button>
        </div>
      </div>
    </>
  );
}
