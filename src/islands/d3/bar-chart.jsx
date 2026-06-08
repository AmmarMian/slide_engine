// bar-chart.jsx — themed categorical bar chart with value labels, optional
// error whiskers, grow-in animation and a hover tooltip. Companion to
// line-chart.jsx, sharing its theme-awareness (dark palette + adaptive grid).
//
// Usage:
//   <bar-chart
//     ylabel="Précision (%)"
//     ymin="65" ymax="86"
//     data='[{"label":"ARMAGNAC","value":80.6,"err":4.2,"emphasis":true},
//            {"label":"GAH","value":75.3},
//            {"label":"sans BN","value":73.5,"muted":true}]'
//   ></bar-chart>
//
// data[i]:
//   label    — category name (x axis)
//   value    — bar height
//   err      — optional ± error (whisker)
//   emphasis — true → drawn in the deck accent (the highlighted method)
//   muted    — true → drawn in --ink-3 (a de-emphasised baseline)
//   color    — explicit override: any CSS color, or 'ink' / 'accent'

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

export function BarChart({
  title         = '',
  xlabel        = '',
  ylabel        = '',
  data          = [],
  ymin          = null,
  ymax          = null,
  width         = 760,
  height        = 660,
  labelFontSize = 68,
}) {
  const svgRef = useRef(null);
  const [themeTick, setThemeTick] = useState(0);

  useEffect(() => {
    const root = document.documentElement;
    const onTheme = () => setThemeTick(t => t + 1);
    root.addEventListener('deck-theme-change', onTheme);
    return () => root.removeEventListener('deck-theme-change', onTheme);
  }, []);

  useEffect(() => {
    const PAD = { t: title ? 50 : 24, r: 26, b: 280, l: 78 };
    const W = width, H = height;
    const iW = W - PAD.l - PAD.r;
    const iH = H - PAD.t - PAD.b;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    if (!data.length) return;

    const cssVar = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
    const ink  = () => cssVar('--ink')      || '#1a1a1a';
    const ink2 = () => cssVar('--ink-2')    || '#444';
    const ink3 = () => cssVar('--ink-3')    || '#888';
    const bg   = () => cssVar('--bg')       || '#f5f2ed';
    const bg2  = () => cssVar('--bg-2')     || '#fff';
    const mono = () => cssVar('--mono')     || 'monospace';
    const sans = () => cssVar('--sans')     || 'sans-serif';
    const accent = () => cssVar('--accent') || '#d23b1c';

    const lum = (hex) => {
      const c = (hex || '').replace('#', '');
      if (c.length < 3) return 1;
      const h = c.length === 3 ? c.split('').map(x => x + x).join('') : c;
      return (0.299 * parseInt(h.slice(0, 2), 16) + 0.587 * parseInt(h.slice(2, 4), 16) + 0.114 * parseInt(h.slice(4, 6), 16)) / 255;
    };
    const isDark = lum(bg()) < 0.4;
    const neutral = isDark ? '#6fa8dc' : '#3d6fa3';   // default bar colour
    const gridOp = isDark ? 0.18 : 0.11;

    const barColor = (d) => {
      if (d.color === 'accent') return accent();
      if (d.color === 'ink') return ink();
      if (d.color) return d.color;
      if (d.emphasis) return accent();
      if (d.muted) return ink3();
      return neutral;
    };

    // ── Scales ───────────────────────────────────────────────────────────────
    const x = d3.scaleBand().domain(data.map(d => d.label))
      .range([PAD.l, PAD.l + iW]).padding(0.32);
    const vmax = d3.max(data, d => d.value + (d.err || 0));
    const lo = ymin != null ? +ymin : 0;
    const hi = ymax != null ? +ymax : vmax * 1.08;
    const y = d3.scaleLinear().domain([lo, hi]).range([PAD.t + iH, PAD.t]);

    // ── Static chrome ─────────────────────────────────────────────────────────
    if (ylabel) svg.append('text')
      .attr('x', 20).attr('y', PAD.t + iH / 2).attr('text-anchor', 'middle')
      .attr('font-family', mono()).attr('font-size', 19).attr('fill', ink3())
      .attr('letter-spacing', '0.05em')
      .attr('transform', `rotate(-90, 20, ${PAD.t + iH / 2})`).text(ylabel.toUpperCase());
    if (title) svg.append('text')
      .attr('x', PAD.l + iW / 2).attr('y', 26).attr('text-anchor', 'middle')
      .attr('font-family', sans()).attr('font-size', 26).attr('font-weight', 700)
      .attr('fill', ink()).text(title);

    // ── Grid + y axis ─────────────────────────────────────────────────────────
    const yTicks = y.ticks(6);
    svg.append('g').selectAll('line').data(yTicks).join('line')
      .attr('x1', PAD.l).attr('x2', PAD.l + iW)
      .attr('y1', d => y(d)).attr('y2', d => y(d))
      .attr('stroke', ink()).attr('stroke-opacity', gridOp).attr('stroke-width', 1);

    const gy = svg.append('g').attr('transform', `translate(${PAD.l},0)`)
      .call(d3.axisLeft(y).tickValues(yTicks).tickFormat(d3.format('.0f')));
    gy.select('.domain').attr('stroke', ink()).attr('stroke-width', 1.4);
    gy.selectAll('.tick line').remove();
    gy.selectAll('.tick text').attr('font-family', mono()).attr('font-size', 18).attr('fill', ink3());

    // baseline
    svg.append('line').attr('x1', PAD.l).attr('x2', PAD.l + iW)
      .attr('y1', y(lo)).attr('y2', y(lo)).attr('stroke', ink()).attr('stroke-width', 1.4);

    // category labels — rotated 45° so longer names fit at large font size
    svg.append('g').selectAll('text').data(data).join('text')
      .attr('x', d => x(d.label) + x.bandwidth() / 2)
      .attr('y', PAD.t + iH + 36)
      .attr('text-anchor', 'end')
      .attr('font-family', mono()).attr('font-size', labelFontSize)
      .attr('fill', d => d.emphasis ? accent() : ink2())
      .attr('font-weight', d => d.emphasis ? 700 : 400)
      .attr('transform', d => `rotate(-45,${x(d.label) + x.bandwidth() / 2},${PAD.t + iH + 36})`)
      .text(d => d.label);

    if (xlabel) svg.append('text')
      .attr('x', PAD.l + iW / 2).attr('y', H - 6).attr('text-anchor', 'middle')
      .attr('font-family', mono()).attr('font-size', 18).attr('fill', ink3())
      .attr('letter-spacing', '0.05em').text(xlabel.toUpperCase());

    // ── Bars + labels + whiskers (groups so we can animate / reset) ───────────
    const gBars  = svg.append('g');
    const gVals  = svg.append('g');
    const gErr   = svg.append('g');
    const gTip   = svg.append('g').style('pointer-events', 'none').style('display', 'none');

    const y0 = y(lo);

    const drawStatic = (animate) => {
      gBars.selectAll('*').remove();
      gVals.selectAll('*').remove();
      gErr.selectAll('*').remove();

      const bars = gBars.selectAll('rect').data(data).join('rect')
        .attr('x', d => x(d.label)).attr('width', x.bandwidth())
        .attr('fill', barColor).attr('rx', 3)
        .style('cursor', 'pointer')
        .attr('y', animate ? y0 : d => y(d.value))
        .attr('height', animate ? 0 : d => y0 - y(d.value));

      // hover tooltip
      bars.on('mouseenter', function (ev, d) { showTip(d); d3.select(this).attr('fill-opacity', 0.82); })
        .on('mouseleave', function () { hideTip(); d3.select(this).attr('fill-opacity', 1); });

      const drawDecorations = () => {
        gVals.selectAll('text').data(data).join('text')
          .attr('x', d => x(d.label) + x.bandwidth() / 2)
          .attr('y', d => y(d.value + (d.err || 0)) - 12)
          .attr('text-anchor', 'middle')
          .attr('font-family', mono()).attr('font-size', 32).attr('font-weight', 700)
          .attr('fill', d => d.emphasis ? accent() : ink())
          .attr('opacity', 0).text(d => d3.format('.1f')(d.value))
          .transition().duration(300).attr('opacity', 1);

        data.forEach(d => {
          if (!d.err) return;
          const cx = x(d.label) + x.bandwidth() / 2;
          const yHi = y(d.value + d.err), yLo = y(d.value - d.err);
          const g = gErr.append('g').attr('opacity', 0);
          g.append('line').attr('x1', cx).attr('x2', cx).attr('y1', yHi).attr('y2', yLo)
            .attr('stroke', ink()).attr('stroke-width', 1.6);
          [yHi, yLo].forEach(yy => g.append('line')
            .attr('x1', cx - 7).attr('x2', cx + 7).attr('y1', yy).attr('y2', yy)
            .attr('stroke', ink()).attr('stroke-width', 1.6));
          g.transition().duration(300).attr('opacity', 0.75);
        });
      };

      if (animate) {
        bars.transition().delay((d, i) => i * 60).duration(650).ease(d3.easeCubicOut)
          .attr('y', d => y(d.value)).attr('height', d => y0 - y(d.value))
          .on('end', (d, i) => { if (i === data.length - 1) drawDecorations(); });
      } else {
        drawDecorations();
      }
    };

    // ── Tooltip ───────────────────────────────────────────────────────────────
    const hideTip = () => gTip.style('display', 'none');
    const showTip = (d) => {
      gTip.selectAll('*').remove();
      gTip.style('display', null);
      const cx = x(d.label) + x.bandwidth() / 2;
      const top = y(d.value + (d.err || 0));
      const txt = d.err ? `${d3.format('.1f')(d.value)} ± ${d3.format('.1f')(d.err)}` : d3.format('.1f')(d.value);
      const boxW = Math.max(96, 28 + (d.label.length + txt.length) * 9);
      const boxH = 54;
      let bx = cx - boxW / 2;
      bx = Math.max(PAD.l, Math.min(bx, PAD.l + iW - boxW));
      const by = Math.max(PAD.t, top - boxH - 12);
      const box = gTip.append('g').attr('transform', `translate(${bx},${by})`);
      box.append('rect').attr('width', boxW).attr('height', boxH).attr('rx', 6)
        .attr('fill', bg2()).attr('stroke', ink()).attr('stroke-opacity', 0.25)
        .style('filter', 'drop-shadow(0 2px 6px rgba(0,0,0,0.12))');
      box.append('text').attr('x', 12).attr('y', 21)
        .attr('font-family', mono()).attr('font-size', 15).attr('font-weight', 700)
        .attr('fill', barColor(d)).text(d.label);
      box.append('text').attr('x', 12).attr('y', 42)
        .attr('font-family', mono()).attr('font-size', 15).attr('fill', ink())
        .text(txt);
    };

    // ── Reveal / reset wired to slide navigation ──────────────────────────────
    let revealed = false;
    const animate = () => { if (!revealed) { revealed = true; drawStatic(true); } };
    const reset   = () => { revealed = false; drawStatic(false); gBars.selectAll('rect').attr('y', y0).attr('height', 0); gVals.selectAll('*').remove(); gErr.selectAll('*').remove(); };

    drawStatic(false);
    gBars.selectAll('rect').attr('y', y0).attr('height', 0);
    gVals.selectAll('*').remove(); gErr.selectAll('*').remove();

    const stage = document.querySelector('deck-stage');
    if (!stage) { animate(); return; }

    const hostNow = svgRef.current?.closest('bar-chart');
    const activeNow = stage.querySelector('[data-deck-active]');
    if (hostNow && activeNow?.contains(hostNow)) animate();

    const onSlideChange = (e) => {
      const { slide, previousSlide } = e.detail;
      const myHost = svgRef.current?.closest('bar-chart');
      if (!myHost) return;
      if (slide?.contains(myHost)) animate();
      else if (previousSlide?.contains(myHost)) reset();
    };
    stage.addEventListener('slidechange', onSlideChange);
    return () => stage.removeEventListener('slidechange', onSlideChange);
  }, [title, xlabel, ylabel, data, ymin, ymax, width, height, labelFontSize, themeTick]);

  return (
    <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ display: 'block' }} />
  );
}
