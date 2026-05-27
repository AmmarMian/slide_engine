// scatter-flow.jsx — d3 animated scatter viz.
//
// Pattern for all d3 islands:
//   1. Hold a ref to the SVG container.
//   2. Run d3 imperatively in a useEffect.
//   3. Animate on REVEAL — listen to deck-stage's `slidechange` CustomEvent
//      and fire the enter transition only when this island's slide becomes active.
//      This avoids "wasted" animations on slides the user hasn't seen yet.
//   4. Read CSS vars for colors so the viz reacts to theme switching.
//
// Usage:  <scatter-flow n="120" seed="42"></scatter-flow>

import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

// Seeded PRNG so the layout is deterministic across renders.
function seededRng(seed) {
  let s = (seed | 0) || 1;
  return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
}

// Generate two "clusters" (noise → structured) for the same n points.
function makePoints(n, seed) {
  const rand = seededRng(seed);
  return Array.from({ length: n }, (_, i) => {
    // Noise positions: uniform random in [0.1, 0.9]^2
    const nx = 0.1 + rand() * 0.8;
    const ny = 0.1 + rand() * 0.8;
    // Structured positions: two tight clusters
    const cluster = i < n / 2 ? 0 : 1;
    const cx = cluster === 0 ? 0.28 : 0.72;
    const cy = cluster === 0 ? 0.45 : 0.55;
    const angle = rand() * Math.PI * 2;
    const r = rand() * 0.12;
    return {
      id: i,
      nx, ny,
      sx: cx + Math.cos(angle) * r,
      sy: cy + Math.sin(angle) * r,
      cluster,
    };
  });
}

export function ScatterFlow({ n = 120, seed = 42 }) {
  const svgRef = useRef(null);
  const animatedRef = useRef(false);

  const W = 1600, H = 700;
  const PAD = { t: 40, r: 80, b: 80, l: 80 };

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const pts = makePoints(n, seed);

    // Helpers to read theme colors live (so palette switches work)
    const ink  = () => getComputedStyle(document.documentElement).getPropertyValue('--ink').trim()  || '#0a0a0a';
    const ink3 = () => getComputedStyle(document.documentElement).getPropertyValue('--ink-3').trim() || '#6e6e6e';
    const bg2  = () => getComputedStyle(document.documentElement).getPropertyValue('--bg-2').trim()  || '#ffffff';
    const accent = () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#d23b1c';

    svg.selectAll('*').remove();

    // Scales
    const x = d3.scaleLinear([0, 1], [PAD.l, W - PAD.r]);
    const y = d3.scaleLinear([0, 1], [H - PAD.b, PAD.t]);

    // Axes (light gridlines)
    const xAxis = d3.axisBottom(x).ticks(6).tickSize(-(H - PAD.t - PAD.b));
    const yAxis = d3.axisLeft(y).ticks(5).tickSize(-(W - PAD.l - PAD.r));

    const gx = svg.append('g').attr('transform', `translate(0,${H - PAD.b})`).call(xAxis);
    const gy = svg.append('g').attr('transform', `translate(${PAD.l},0)`).call(yAxis);

    [gx, gy].forEach(g => {
      g.select('.domain').attr('stroke', ink()).attr('stroke-width', 1.2);
      g.selectAll('.tick line').attr('stroke', ink3()).attr('stroke-opacity', 0.2).attr('stroke-dasharray', '3,4');
      g.selectAll('.tick text').attr('font-family', 'var(--mono)').attr('font-size', 20).attr('fill', ink3());
    });

    // Axis labels
    svg.append('text').attr('x', PAD.l + (W - PAD.l - PAD.r) / 2).attr('y', H - 8)
      .attr('text-anchor', 'middle').attr('font-family', 'var(--mono)').attr('font-size', 22)
      .attr('fill', ink3()).attr('letter-spacing', '0.04em').text('FEATURE 1');

    svg.append('text').attr('x', 22).attr('y', PAD.t + (H - PAD.t - PAD.b) / 2)
      .attr('text-anchor', 'middle').attr('font-family', 'var(--mono)').attr('font-size', 22)
      .attr('fill', ink3()).attr('letter-spacing', '0.04em')
      .attr('transform', `rotate(-90, 22, ${PAD.t + (H - PAD.t - PAD.b) / 2})`)
      .text('FEATURE 2');

    // Points — start at noise positions
    const circles = svg.append('g').selectAll('circle')
      .data(pts, d => d.id)
      .enter().append('circle')
      .attr('cx', d => x(d.nx))
      .attr('cy', d => y(d.ny))
      .attr('r', 7)
      .attr('fill', d => d.cluster === 0 ? ink() : accent())
      .attr('fill-opacity', 0.55)
      .attr('stroke', d => d.cluster === 0 ? ink() : accent())
      .attr('stroke-width', 1.2)
      .attr('stroke-opacity', 0.85);

    // Legend
    const legendData = [
      { label: 'Cluster A', color: ink() },
      { label: 'Cluster B', color: accent() },
    ];
    const lg = svg.append('g').attr('transform', `translate(${W - PAD.r - 180}, ${PAD.t + 10})`);
    legendData.forEach(({ label, color }, i) => {
      lg.append('circle').attr('cx', 8).attr('cy', i * 36 + 8).attr('r', 7)
        .attr('fill', color).attr('fill-opacity', 0.55).attr('stroke', color).attr('stroke-width', 1.2);
      lg.append('text').attr('x', 22).attr('y', i * 36 + 14)
        .attr('font-family', 'var(--mono)').attr('font-size', 20).attr('fill', ink3()).text(label);
    });

    // "Noise" label (top-left)
    const stateLabel = svg.append('text')
      .attr('x', PAD.l).attr('y', PAD.t - 8)
      .attr('font-family', 'var(--mono)').attr('font-size', 24).attr('font-weight', 600)
      .attr('fill', ink3()).attr('letter-spacing', '0.06em')
      .text('NOISE  →  STRUCTURED');

    // The animate function: transitions dots from noise positions to structured positions.
    const animate = () => {
      if (animatedRef.current) return;
      animatedRef.current = true;
      circles.transition()
        .delay((_, i) => i * 12)
        .duration(900)
        .ease(d3.easeCubicInOut)
        .attr('cx', d => x(d.sx))
        .attr('cy', d => y(d.sy))
        .attr('fill-opacity', 0.72)
        .attr('stroke-opacity', 1);
    };

    // Reset function: snap back to noise, ready for next animation.
    const reset = () => {
      animatedRef.current = false;
      circles.interrupt()
        .attr('cx', d => x(d.nx))
        .attr('cy', d => y(d.ny))
        .attr('fill-opacity', 0.55)
        .attr('stroke-opacity', 0.85);
    };

    // Listen to the deck's slidechange event.
    const stage = document.querySelector('deck-stage');
    if (!stage) return;

    const onSlideChange = (e) => {
      const { slide, previousSlide } = e.detail;
      // This island lives inside a custom-element host; check if the active slide contains it.
      const myHost = svgRef.current?.closest('scatter-flow');
      if (!myHost) return;
      if (slide?.contains(myHost)) {
        animate();
      } else if (previousSlide?.contains(myHost)) {
        reset();
      }
    };

    stage.addEventListener('slidechange', onSlideChange);
    return () => stage.removeEventListener('slidechange', onSlideChange);
  }, [n, seed]);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height="100%"
      style={{ display: 'block' }}
    />
  );
}
