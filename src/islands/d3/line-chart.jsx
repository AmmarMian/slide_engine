// line-chart.jsx — generic D3 log/linear line chart with confidence bands,
// reveal animation, zoom/pan, and an interactive crosshair tooltip.
//
// Usage:
//   <line-chart
//     title="Temps de calcul — CPU"
//     xlabel="Taille du batch"
//     ylabel="Temps (s)"
//     xmode="log"   ymode="log"
//     series='[{"name":"arithmetic","color":"#1f77b4","values":[[1,4.7e-5],[2,4.8e-5]],"band":[[1,4.5e-5,4.9e-5],...]}]'
//   ></line-chart>
//
// series[i]:
//   name    — legend label (drawn at the line's end)
//   color   — hex or CSS var string (tab10 hexes are auto-refined to the theme)
//   values  — [[x, y], ...]            (line + dots)
//   band    — [[x, yLow, yHigh], ...]  (optional shaded CI)
//   dash    — SVG stroke-dasharray string (optional, e.g. "6 4")
//   width   — stroke width override (optional, default 2.5)
//
// Interaction: mouse wheel = zoom, drag = pan, double-click = reset, hover =
// crosshair tooltip with every series' value at the nearest x.

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

export function LineChart({
  title   = '',
  xlabel  = '',
  ylabel  = '',
  xmode   = 'linear',
  ymode   = 'linear',
  series  = [],
  width   = 1560,
  height  = 680,
}) {
  const svgRef  = useRef(null);
  const [themeTick, setThemeTick] = useState(0);

  // Re-draw when the deck theme changes so CSS vars (grid, palette) are re-read.
  useEffect(() => {
    const root = document.documentElement;
    const onTheme = () => setThemeTick(t => t + 1);
    root.addEventListener('deck-theme-change', onTheme);
    return () => root.removeEventListener('deck-theme-change', onTheme);
  }, []);

  useEffect(() => {
    // Right margin grows with the longest series name so direct end-of-line
    // labels never clip (mono ≈ 11px/char at the 19px label size).
    const maxLabelLen = series.reduce((m, s) => Math.max(m, (s.name || '').length), 0);
    const PAD = { t: title ? 52 : 28, r: Math.min(360, Math.max(160, 30 + maxLabelLen * 11)), b: 80, l: 90 };
    const W = width, H = height;
    const iW = W - PAD.l - PAD.r;
    const iH = H - PAD.t - PAD.b;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // ── CSS var helpers ──────────────────────────────────────────────────────
    const cssVar = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
    const ink  = () => cssVar('--ink')       || '#1a1a1a';
    const ink3 = () => cssVar('--ink-3')     || '#888';
    const bg   = () => cssVar('--bg')        || '#f5f2ed';
    const bg2  = () => cssVar('--bg-2')      || '#fff';
    const mono = () => cssVar('--mono')      || 'monospace';
    const sans = () => cssVar('--sans')      || 'sans-serif';
    const accent = () => cssVar('--accent')  || '#d23b1c';

    // ── Dark-theme detection (from --bg luminance) ───────────────────────────
    const lum = (hex) => {
      const c = (hex || '').replace('#', '');
      if (c.length < 3) return 1;
      const h = c.length === 3 ? c.split('').map(x => x + x).join('') : c;
      const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
      return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    };
    const isDark = lum(bg()) < 0.4;

    // ── Palette refinement ───────────────────────────────────────────────────
    const TAB10 = isDark ? {
      '#1f77b4': '#6fa8dc', '#ff7f0e': '#e0a458', '#2ca02c': '#88c070',
      '#d62728': accent(),  '#9467bd': '#b39ddb',
    } : {
      '#1f77b4': '#3d6fa3', '#ff7f0e': '#c2792e', '#2ca02c': '#5f8d4e',
      '#d62728': accent(),  '#9467bd': '#8268a0',
    };
    const refine = (c) => TAB10[(c || '').toLowerCase()] || c;
    const resolved = series.map(s => ({
      ...s, color: refine(s.color), _map: new Map(s.values.map(d => [d[0], d[1]])),
    }));

    const gridMinorOp = isDark ? 0.10 : 0.05;
    const gridMajorOp = isDark ? 0.18 : 0.11;

    // ── Base scales (full domain) ────────────────────────────────────────────
    const allX = resolved.flatMap(s => s.values.map(d => d[0]));
    const allXSorted = [...new Set(allX)].sort((a, b) => a - b);
    const allY = resolved.flatMap(s => {
      const ys = s.values.map(d => d[1]);
      const bandYs = (s.band || []).flatMap(d => [d[1], d[2]]);
      return [...ys, ...bandYs];
    });

    const [xMin, xMax] = d3.extent(allX);
    const xPad = xmode === 'log' ? 1 : 0;
    const x0 = (xmode === 'log' ? d3.scaleLog() : d3.scaleLinear())
      .domain([xMin / Math.pow(10, xPad * 0.15), xMax * Math.pow(10, xPad * 0.08)])
      .range([PAD.l, PAD.l + iW]);

    const [yRawMin, yRawMax] = d3.extent(allY);
    const y0 = (ymode === 'log' ? d3.scaleLog() : d3.scaleLinear())
      .domain(
        ymode === 'log'
          ? [Math.pow(10, Math.floor(Math.log10(yRawMin))), Math.pow(10, Math.ceil(Math.log10(yRawMax)))]
          : [yRawMin * 0.95, yRawMax * 1.05]
      )
      .range([PAD.t + iH, PAD.t]);

    // ── Tick + format helpers ────────────────────────────────────────────────
    const logDecades = (scale) => {
      const [lo, hi] = scale.domain();
      const out = [];
      for (let e = Math.round(Math.log10(lo)); e <= Math.round(Math.log10(hi)); e++) out.push(Math.pow(10, e));
      return out;
    };
    const xTicksFor = (xs) => {
      if (xmode === 'log') {
        const [lo, hi] = xs.domain();
        return allXSorted.filter(t => t >= lo * 0.999 && t <= hi * 1.001);
      }
      return xs.ticks(7);
    };
    const yTicksFor = (ys) => ymode === 'log' ? logDecades(ys) : ys.ticks(6);

    const supExp = (e) => `10${e < 0 ? '⁻' : ''}${String(Math.abs(e)).split('').map(c => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c]).join('')}`;
    const fmtX = xmode === 'log' ? d => d3.format('.0f')(d) : d => d3.format('.2~g')(d);
    const fmtY = ymode === 'log'
      ? d => { const e = Math.round(Math.log10(d)); return e === 0 ? '1' : supExp(e); }
      : d => { const a = Math.abs(d); return (a < 1e-3 || a >= 1e4) ? d3.format('.1e')(d) : d3.format('.2~g')(d); };
    const fmtVal = ymode === 'log'
      ? d3.format('.2e')
      : d => d3.format(Math.abs(d) >= 100 ? '.0f' : '.2f')(d);

    // ── Static chrome (drawn once) ───────────────────────────────────────────
    if (xlabel) svg.append('text')
      .attr('x', PAD.l + iW / 2).attr('y', H - 8).attr('text-anchor', 'middle')
      .attr('font-family', mono()).attr('font-size', 21).attr('fill', ink3())
      .attr('letter-spacing', '0.05em').text(xlabel.toUpperCase());
    if (ylabel) svg.append('text')
      .attr('x', 20).attr('y', PAD.t + iH / 2).attr('text-anchor', 'middle')
      .attr('font-family', mono()).attr('font-size', 21).attr('fill', ink3())
      .attr('letter-spacing', '0.05em')
      .attr('transform', `rotate(-90, 20, ${PAD.t + iH / 2})`).text(ylabel.toUpperCase());
    if (title) svg.append('text')
      .attr('x', PAD.l + iW / 2).attr('y', 26).attr('text-anchor', 'middle')
      .attr('font-family', sans()).attr('font-size', 24).attr('font-weight', 600)
      .attr('fill', ink()).text(title);

    // ── Layers ───────────────────────────────────────────────────────────────
    svg.append('defs').append('clipPath').attr('id', 'lc-clip').append('rect')
      .attr('x', PAD.l).attr('y', PAD.t).attr('width', iW).attr('height', iH);

    const gGrid  = svg.append('g');
    const gPlot  = svg.append('g').attr('clip-path', 'url(#lc-clip)');
    const gBands = gPlot.append('g');
    const gLines = gPlot.append('g');
    const gDots  = gPlot.append('g');
    const gx     = svg.append('g').attr('transform', `translate(0,${PAD.t + iH})`);
    const gy     = svg.append('g').attr('transform', `translate(${PAD.l},0)`);
    const gLabels = svg.append('g');
    const overlay = svg.append('rect')
      .attr('x', PAD.l).attr('y', PAD.t).attr('width', iW).attr('height', iH)
      .attr('fill', 'transparent').style('cursor', 'crosshair');
    const gTip   = svg.append('g').style('pointer-events', 'none').style('display', 'none');

    // faint interaction hint, bottom-left of the plot (hidden in print)
    svg.append('text').attr('class', 'lc-hint')
      .attr('x', PAD.l + 4).attr('y', PAD.t + iH - 8)
      .attr('font-family', mono()).attr('font-size', 13).attr('fill', ink3())
      .attr('opacity', 0.5).style('pointer-events', 'none')
      .text('molette : zoom · double-clic : réinit.');

    // ── Drawing routines ─────────────────────────────────────────────────────
    const lineGen = (xs, ys) => d3.line().x(d => xs(d[0])).y(d => ys(d[1])).curve(d3.curveMonotoneX);
    const areaGen = (xs, ys) => d3.area().x(d => xs(d[0])).y0(d => ys(d[1])).y1(d => ys(d[2])).curve(d3.curveMonotoneX);

    const styleAxis = (g) => {
      g.select('.domain').attr('stroke', ink()).attr('stroke-width', 1.4);
      g.selectAll('.tick line').remove();
      g.selectAll('.tick text').attr('font-family', mono()).attr('font-size', 19).attr('fill', ink3());
    };

    const drawGrid = (xs, ys) => {
      gGrid.selectAll('*').remove();
      if (ymode === 'log') {
        const [lo, hi] = ys.domain();
        const minors = [];
        for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++)
          for (let k = 2; k <= 9; k++) { const v = k * Math.pow(10, e); if (v >= lo && v <= hi) minors.push(v); }
        gGrid.append('g').selectAll('line').data(minors).join('line')
          .attr('x1', PAD.l).attr('x2', PAD.l + iW)
          .attr('y1', d => ys(d)).attr('y2', d => ys(d))
          .attr('stroke', ink()).attr('stroke-opacity', gridMinorOp).attr('stroke-width', 1);
      }
      gGrid.append('g').selectAll('line').data(xTicksFor(xs)).join('line')
        .attr('x1', d => xs(d)).attr('x2', d => xs(d)).attr('y1', PAD.t).attr('y2', PAD.t + iH)
        .attr('stroke', ink()).attr('stroke-opacity', gridMajorOp).attr('stroke-width', 1);
      gGrid.append('g').selectAll('line').data(yTicksFor(ys)).join('line')
        .attr('x1', PAD.l).attr('x2', PAD.l + iW).attr('y1', d => ys(d)).attr('y2', d => ys(d))
        .attr('stroke', ink()).attr('stroke-opacity', gridMajorOp).attr('stroke-width', 1);
    };

    const drawAxes = (xs, ys) => {
      gx.call(d3.axisBottom(xs).tickValues(xTicksFor(xs)).tickFormat(fmtX)); styleAxis(gx);
      gy.call(d3.axisLeft(ys).tickValues(yTicksFor(ys)).tickFormat(fmtY)); styleAxis(gy);
    };

    const drawBands = (xs, ys) => {
      gBands.selectAll('*').remove();
      resolved.forEach(s => {
        if (!s.band || !s.band.length) return;
        gBands.append('path').datum(s.band).attr('d', areaGen(xs, ys))
          .attr('fill', s.color).attr('fill-opacity', 0.13).attr('stroke', 'none');
      });
    };

    const drawDots = (xs, ys) => {
      gDots.selectAll('*').remove();
      resolved.forEach(s => {
        const last = s.values.length - 1;
        gDots.append('g').selectAll('circle').data(s.values).join('circle')
          .attr('cx', d => xs(d[0])).attr('cy', d => ys(d[1]))
          .attr('r', (d, i) => i === last ? 5.5 : 4.5)
          .attr('fill', (d, i) => i === last ? s.color : bg())
          .attr('stroke', s.color).attr('stroke-width', 2);
      });
    };

    const drawLabels = (xs, ys) => {
      gLabels.selectAll('*').remove();
      const [lo, hi] = xs.domain();
      const items = [];
      resolved.forEach(s => {
        const vis = s.values.filter(d => d[0] >= lo && d[0] <= hi);
        if (!vis.length) return;
        const p = vis[vis.length - 1];
        const yL = ys(p[1]);
        items.push({ name: s.name, color: s.color, yLine: yL, y: yL });
      });
      items.sort((a, b) => a.yLine - b.yLine);
      const GAP = 30;
      for (let i = 1; i < items.length; i++)
        if (items[i].y - items[i - 1].y < GAP) items[i].y = items[i - 1].y + GAP;
      const bot = PAD.t + iH;
      if (items.length && items[items.length - 1].y > bot) {
        items[items.length - 1].y = bot;
        for (let i = items.length - 2; i >= 0; i--)
          if (items[i + 1].y - items[i].y < GAP) items[i].y = items[i + 1].y - GAP;
      }
      const lx = PAD.l + iW + 16;
      items.forEach(l => {
        if (Math.abs(l.y - l.yLine) > 4)
          gLabels.append('path')
            .attr('d', `M ${PAD.l + iW + 2} ${l.yLine} C ${lx - 8} ${l.yLine}, ${lx - 8} ${l.y}, ${lx - 2} ${l.y}`)
            .attr('fill', 'none').attr('stroke', l.color).attr('stroke-width', 1).attr('stroke-opacity', 0.45);
        gLabels.append('circle').attr('cx', lx + 3).attr('cy', l.y).attr('r', 3.5).attr('fill', l.color);
        gLabels.append('text').attr('x', lx + 14).attr('y', l.y + 6)
          .attr('font-family', mono()).attr('font-size', 19).attr('font-weight', 600)
          .attr('fill', l.color).text(l.name);
      });
    };

    // mode: 'hidden' | 'reveal' | 'static'
    const drawLines = (xs, ys, mode) => {
      gLines.selectAll('*').remove();
      const gen = lineGen(xs, ys);
      const els = [];
      resolved.forEach(s => {
        const path = gLines.append('path').datum(s.values).attr('d', gen)
          .attr('fill', 'none').attr('stroke', s.color)
          .attr('stroke-width', s.width ?? 2.5)
          .attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round');
        if (mode === 'static') { path.attr('stroke-dasharray', s.dash ?? null); return; }
        const len = path.node().getTotalLength();
        path.attr('stroke-dasharray', `${len} ${len}`).attr('stroke-dashoffset', len);
        els.push({ path, len, s });
      });
      return els;
    };

    let xCur = x0, yCur = y0;
    let revealed = false;

    const render = (xs, ys, mode) => {
      drawGrid(xs, ys); drawAxes(xs, ys); drawBands(xs, ys);
      const els = drawLines(xs, ys, mode);
      if (mode === 'hidden') { gDots.selectAll('*').remove(); gLabels.selectAll('*').remove(); return; }
      if (mode === 'static') { drawDots(xs, ys); drawLabels(xs, ys); return; }
      if (mode === 'reveal') {
        els.forEach(({ path, len, s }, i) => {
          path.transition().delay(i * 80).duration(900).ease(d3.easeCubicInOut)
            .attr('stroke-dashoffset', 0)
            .attr('stroke-dasharray', s.dash ?? `${len} ${len}`)
            .on('end', i === els.length - 1 ? () => { drawDots(xs, ys); drawLabels(xs, ys); } : null);
        });
      }
    };

    // ── Crosshair tooltip ────────────────────────────────────────────────────
    // Map client coords → viewBox units via the rendered box. This is robust to
    // the deck's CSS transform:scale() (which getScreenCTM/d3.pointer mishandle)
    // and to preserveAspectRatio="xMidYMid meet" letterboxing.
    const pointerVB = (ev) => {
      const r = svgRef.current.getBoundingClientRect();
      const s = Math.min(r.width / W, r.height / H);
      const offX = (r.width - W * s) / 2, offY = (r.height - H * s) / 2;
      return [(ev.clientX - r.left - offX) / s, (ev.clientY - r.top - offY) / s];
    };

    const hideTip = () => gTip.style('display', 'none');
    const showTip = (ev) => {
      const [mx, my] = pointerVB(ev);
      const [lo, hi] = xCur.domain();
      const xv = xCur.invert(mx);
      const i = d3.bisectCenter(allXSorted, xv);
      const x = allXSorted[i];
      if (x == null || x < lo || x > hi) { hideTip(); return; }

      const rows = resolved
        .filter(s => s._map.has(x))
        .map(s => ({ color: s.color, name: s.name, v: s._map.get(x), y: yCur(s._map.get(x)) }))
        .filter(r => r.y >= PAD.t - 2 && r.y <= PAD.t + iH + 2)
        .sort((a, b) => a.y - b.y);
      if (!rows.length) { hideTip(); return; }

      gTip.selectAll('*').remove();
      gTip.style('display', null);
      const px = xCur(x);

      // vertical guide
      gTip.append('line').attr('x1', px).attr('x2', px).attr('y1', PAD.t).attr('y2', PAD.t + iH)
        .attr('stroke', ink()).attr('stroke-opacity', 0.35).attr('stroke-width', 1).attr('stroke-dasharray', '4 3');
      // highlight dots
      rows.forEach(r => gTip.append('circle').attr('cx', px).attr('cy', r.y).attr('r', 6)
        .attr('fill', r.color).attr('stroke', bg()).attr('stroke-width', 1.6));

      // box
      const rowH = 26, padB = 12, headH = 26;
      const longest = Math.max(...rows.map(r => r.name.length + fmtVal(r.v).length + 3));
      const boxW = Math.max(150, 26 + longest * 10.5);
      const boxH = headH + rows.length * rowH + padB;
      let bx = px + 18;
      if (bx + boxW > PAD.l + iW) bx = px - boxW - 18;
      let by = my - boxH / 2;
      by = Math.max(PAD.t, Math.min(by, PAD.t + iH - boxH));

      const box = gTip.append('g').attr('transform', `translate(${bx},${by})`);
      box.append('rect').attr('width', boxW).attr('height', boxH).attr('rx', 6)
        .attr('fill', bg2()).attr('stroke', ink()).attr('stroke-opacity', 0.25).attr('stroke-width', 1)
        .style('filter', 'drop-shadow(0 2px 6px rgba(0,0,0,0.12))');
      box.append('text').attr('x', 12).attr('y', 19)
        .attr('font-family', mono()).attr('font-size', 15).attr('font-weight', 700).attr('fill', ink())
        .text(`${xlabel || 'x'} = ${fmtX(x)}`);
      box.append('line').attr('x1', 10).attr('x2', boxW - 10).attr('y1', headH).attr('y2', headH)
        .attr('stroke', ink()).attr('stroke-opacity', 0.15);
      rows.forEach((r, k) => {
        const ry = headH + 6 + k * rowH + 13;
        box.append('circle').attr('cx', 19).attr('cy', ry - 4).attr('r', 5).attr('fill', r.color);
        box.append('text').attr('x', 32).attr('y', ry)
          .attr('font-family', mono()).attr('font-size', 16).attr('fill', ink())
          .text(r.name);
        box.append('text').attr('x', boxW - 12).attr('y', ry).attr('text-anchor', 'end')
          .attr('font-family', mono()).attr('font-size', 16).attr('font-weight', 700).attr('fill', r.color)
          .text(fmtVal(r.v));
      });
    };

    overlay.on('mousemove', showTip).on('mouseleave', hideTip);

    // ── Zoom / pan ───────────────────────────────────────────────────────────
    const zoom = d3.zoom()
      .scaleExtent([1, 14])
      .extent([[PAD.l, PAD.t], [PAD.l + iW, PAD.t + iH]])
      .translateExtent([[PAD.l, PAD.t], [PAD.l + iW, PAD.t + iH]])
      .on('zoom', (ev) => {
        xCur = ev.transform.rescaleX(x0);
        yCur = ev.transform.rescaleY(y0);
        revealed = true;
        render(xCur, yCur, 'static');
        hideTip();
      });
    overlay.call(zoom).on('dblclick.zoom', null);
    overlay.on('dblclick', () => overlay.transition().duration(300).call(zoom.transform, d3.zoomIdentity));
    // Keep chart interaction from advancing the deck (it advances on click/tap).
    overlay.on('click', (ev) => ev.stopPropagation());
    overlay.on('pointerdown', (ev) => ev.stopPropagation());

    const resetZoom = () => { overlay.node().__zoom = d3.zoomIdentity; xCur = x0; yCur = y0; };

    // ── Reveal / reset wired to slide navigation ─────────────────────────────
    const animate = () => {
      if (revealed) { render(xCur, yCur, 'static'); return; }
      revealed = true;
      render(x0, y0, 'reveal');
    };
    const reset = () => {
      revealed = false;
      resetZoom();
      hideTip();
      gLines.selectAll('path').interrupt();
      render(x0, y0, 'hidden');
    };

    // initial paint (hidden lines, visible grid/axes/bands)
    render(x0, y0, 'hidden');

    const stage = document.querySelector('deck-stage');
    if (!stage) { animate(); return; }

    const hostNow = svgRef.current?.closest('line-chart');
    const activeNow = stage.querySelector('[data-deck-active]');
    if (hostNow && activeNow?.contains(hostNow)) animate();

    const onSlideChange = (e) => {
      const { slide, previousSlide } = e.detail;
      const myHost = svgRef.current?.closest('line-chart');
      if (!myHost) return;
      if (slide?.contains(myHost)) animate();
      else if (previousSlide?.contains(myHost)) reset();
    };
    stage.addEventListener('slidechange', onSlideChange);
    return () => stage.removeEventListener('slidechange', onSlideChange);
  }, [title, xlabel, ylabel, xmode, ymode, series, width, height, themeTick]);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      width="100%" height="100%"
      style={{ display: 'block' }}
    />
  );
}
