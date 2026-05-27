// poincare-disk.jsx — Poincaré disk model of hyperbolic space.
// Left panel: disk with random geodesics (circular arcs perpendicular to boundary).
// Right panel: animated hyperbolic binary tree grown level by level.

import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

// ── Complex arithmetic (as [re, im]) ──────────────────────────
const cadd  = ([a,b],[c,d]) => [a+c, b+d];
const cmul  = ([a,b],[c,d]) => [a*c-b*d, a*d+b*c];
const cdiv  = ([a,b],[c,d]) => { const n = c*c+d*d; return [(a*c+b*d)/n,(b*c-a*d)/n]; };
const cabs  = ([a,b])       => Math.sqrt(a*a+b*b);
const cnorm = z             => { const r = cabs(z); return r > 1e-12 ? [z[0]/r, z[1]/r] : [1,0]; };
const cconj = ([a,b])       => [a,-b];
const cscale= ([a,b],s)     => [a*s, b*s];
const csub  = ([a,b],[c,d]) => [a-c, b-d];

// Möbius transform φ_a(z) = (z - a) / (1 - conj(a)·z)  (maps D→D, a→0)
const mobius_a = (z, a) => cdiv(csub(z, a), csub([1,0], cmul(cconj(a), z)));

// Inverse: φ_a^{-1}(z) = (z + a) / (1 + conj(a)·z)
const mobius_a_inv = (z, a) => cdiv(cadd(z, a), cadd([1,0], cmul(cconj(a), z)));

// Hyperbolic exponential map at p in direction d (unit tangent)
// Result: γ(||d||) starting at p going in direction d
// exp_p(v) = φ_p^{-1}( tanh(||v||/2) * v/||v|| )
function hyp_exp(p, v) {
  const r = cabs(v);
  if (r < 1e-12) return p;
  const dir = cnorm(v);
  const scaled = cscale(dir, Math.tanh(r / 2));
  return mobius_a_inv(scaled, p);
}

// Geodesic: sequence of points from p1 to p2 in Poincaré disk
// Parametrize via Möbius: map p1→0, get straight line to image of p2, map back
function geodesicPts(p1, p2, n = 40) {
  const q2 = mobius_a(p2, p1);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // linear in hyperbolic coords (straight line through 0 is a geodesic)
    const q  = cscale(q2, t);
    pts.push(mobius_a_inv(q, p1));
  }
  return pts;
}

// Project hyperbolic point (in unit disk) to SVG coords
function toSvg(z, cx, cy, R) {
  return [cx + z[0] * R, cy - z[1] * R];
}

// ── Seeded PRNG ────────────────────────────────────────────────
function seededRng(seed) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}

const W = 1600, H = 720;
// Left panel: geodesic display
const LCX = 390, LCY = 360, LR = 290;
// Right panel: tree embedding
const RCX = 1200, RCY = 360, RR = 260;

const TREE_DEPTH = 4;
const BRANCHING  = 2;

// Build hyperbolic binary tree points
// Level 0: root at origin
// Each node spawns BRANCHING children at hyperbolic distance d, evenly spaced angles
function buildTree(depth, branchDist = 1.1) {
  const nodes = [{ z: [0,0], depth: 0, parent: null, angle: 0, idx: 0 }];
  const edges = [];
  let idx = 1;
  // BFS
  const queue = [nodes[0]];
  while (queue.length > 0) {
    const node = queue.shift();
    if (node.depth >= depth) continue;
    const nChildren = BRANCHING;
    const spreadAngle = depth === 1 ? Math.PI * 2 : Math.PI * 1.1;
    for (let b = 0; b < nChildren; b++) {
      const baseAngle = node.depth === 0
        ? (b / nChildren) * 2 * Math.PI
        : node.angle + spreadAngle * (b / (nChildren - 1) - 0.5);
      const dir = [Math.cos(baseAngle), Math.sin(baseAngle)];
      const v   = cscale(dir, branchDist * (0.72 + node.depth * 0.08));
      const child = { z: hyp_exp(node.z, v), depth: node.depth + 1, parent: node, angle: baseAngle, idx: idx++ };
      nodes.push(child);
      edges.push({ from: node, to: child, depth: node.depth });
      queue.push(child);
    }
  }
  return { nodes, edges };
}

export function PoincareDisk() {
  const svgRef  = useRef(null);
  const animRef = useRef({ step: 0, timers: [] });

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const cs   = s => getComputedStyle(document.documentElement).getPropertyValue(s).trim();
    const ink  = () => cs('--ink')    || '#161820';
    const ink2 = () => cs('--ink-2')  || '#2e3040';
    const ink3 = () => cs('--ink-3')  || '#666880';
    const bg   = () => cs('--bg')     || '#f0f0f2';
    const bg2  = () => cs('--bg-2')   || '#ffffff';
    const acc  = () => cs('--accent') || '#d23b1c';
    const tint = () => cs('--tint')   || '#dddde8';

    // ── Left panel: geodesics ────────────────────────────────
    svg.append('text').attr('x', LCX).attr('y', 34)
        .attr('text-anchor', 'middle').attr('font-family', 'var(--sans)')
        .attr('font-size', 24).attr('font-weight', 600).attr('fill', ink())
        .text('Poincaré Disk — geodesics');
    svg.append('text').attr('x', LCX).attr('y', 60)
        .attr('text-anchor', 'middle').attr('font-family', 'var(--mono)')
        .attr('font-size', 16).attr('fill', ink3())
        .text('All geodesics are circular arcs ⊥ to boundary');

    const defs = svg.append('defs');
    defs.append('clipPath').attr('id', 'pd-l-clip')
        .append('circle').attr('cx', LCX).attr('cy', LCY).attr('r', LR);
    defs.append('clipPath').attr('id', 'pd-r-clip')
        .append('circle').attr('cx', RCX).attr('cy', RCY).attr('r', RR);

    svg.append('circle').attr('cx', LCX).attr('cy', LCY).attr('r', LR)
        .attr('fill', bg2());

    // Draw random geodesics
    const rng = seededRng(77);
    const N_GEO = 8;
    const geoG = svg.append('g').attr('clip-path', 'url(#pd-l-clip)');
    for (let i = 0; i < N_GEO; i++) {
      const ang1 = rng() * 2 * Math.PI;
      const ang2 = ang1 + 0.6 + rng() * 1.8;
      // Two points on boundary (radius ≈ 0.98)
      const r1 = 0.86 + rng() * 0.08;
      const r2 = 0.86 + rng() * 0.08;
      const p1 = [r1 * Math.cos(ang1), r1 * Math.sin(ang1)];
      const p2 = [r2 * Math.cos(ang2), r2 * Math.sin(ang2)];
      const pts = geodesicPts(p1, p2, 60).map(z => toSvg(z, LCX, LCY, LR));
      const d = pts.map((p, j) => `${j===0?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
      geoG.append('path').attr('d', d).attr('fill', 'none')
          .attr('stroke', i < 3 ? acc() : ink3())
          .attr('stroke-width', i < 3 ? 2 : 1.2)
          .attr('stroke-opacity', i < 3 ? 0.55 : 0.22);
    }

    // A special "parallel" pair (same horoball, never intersect inside disk)
    const horoPts = (ang) => [0.92 * Math.cos(ang), 0.92 * Math.sin(ang)];
    const horoA = horoPts(0.3), horoB = horoPts(Math.PI + 0.3);
    const paraGeo = geodesicPts(horoPts(0.8), horoB, 60).map(z => toSvg(z, LCX, LCY, LR));
    const para2   = geodesicPts(horoPts(-0.8), horoB, 60).map(z => toSvg(z, LCX, LCY, LR));

    // Disk boundary
    svg.append('circle').attr('cx', LCX).attr('cy', LCY).attr('r', LR)
        .attr('fill', 'none').attr('stroke', ink()).attr('stroke-width', 2);

    // Center dot
    const oSvg = toSvg([0,0], LCX, LCY, LR);
    svg.append('circle').attr('cx', oSvg[0]).attr('cy', oSvg[1]).attr('r', 6)
        .attr('fill', acc()).attr('fill-opacity', 0.7);

    // Caption
    svg.append('text').attr('x', LCX).attr('y', LCY + LR + 44)
        .attr('text-anchor', 'middle').attr('font-family', 'var(--mono)')
        .attr('font-size', 17).attr('fill', ink3()).attr('letter-spacing', '0.05em')
        .text('HYPERBOLIC PLANE  ℍ²  (constant curvature −1)');

    // ── Right panel: tree embedding ──────────────────────────
    svg.append('text').attr('x', RCX).attr('y', 34)
        .attr('text-anchor', 'middle').attr('font-family', 'var(--sans)')
        .attr('font-size', 24).attr('font-weight', 600).attr('fill', ink())
        .text('Hyperbolic tree embedding');
    svg.append('text').attr('x', RCX).attr('y', 60)
        .attr('text-anchor', 'middle').attr('font-family', 'var(--mono)')
        .attr('font-size', 16).attr('fill', ink3())
        .text('Exponential capacity — trees embed with low distortion');

    svg.append('circle').attr('cx', RCX).attr('cy', RCY).attr('r', RR)
        .attr('fill', bg2());

    // Concentric distance rings
    [0.3, 0.55, 0.78, 0.93].forEach(r => {
      svg.append('circle').attr('cx', RCX).attr('cy', RCY).attr('r', r * RR)
          .attr('fill', 'none').attr('stroke', ink3()).attr('stroke-opacity', 0.1)
          .attr('stroke-width', 1).attr('stroke-dasharray', '2,6');
    });

    const { nodes, edges } = buildTree(TREE_DEPTH);

    // Group edges by depth for level-by-level reveal
    const edgesByDepth = {};
    edges.forEach(e => {
      if (!edgesByDepth[e.depth]) edgesByDepth[e.depth] = [];
      edgesByDepth[e.depth].push(e);
    });

    const treeG = svg.append('g').attr('clip-path', 'url(#pd-r-clip)');
    const nodeG = svg.append('g').attr('clip-path', 'url(#pd-r-clip)');

    // Depth color scale
    const depthColor = d => d === 0 ? acc() : d === 1 ? ink2() : d <= 3 ? ink3() : ink3();
    const depthOpacity = d => Math.max(0.2, 0.8 - d * 0.12);

    const drawEdge = (e) => {
      const pts = geodesicPts(e.from.z, e.to.z, 30).map(z => toSvg(z, RCX, RCY, RR));
      const d = pts.map((p, i) => `${i===0?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
      treeG.append('path').attr('d', d).attr('fill', 'none')
           .attr('stroke', depthColor(e.depth))
           .attr('stroke-width', Math.max(1, 3 - e.depth * 0.6))
           .attr('stroke-opacity', depthOpacity(e.depth))
           .attr('class', `tree-edge-${e.depth}`);
    };
    const drawNode = (n) => {
      const [nx, ny] = toSvg(n.z, RCX, RCY, RR);
      nodeG.append('circle').attr('cx', nx).attr('cy', ny)
           .attr('r', Math.max(3, 8 - n.depth * 1.5))
           .attr('fill', depthColor(n.depth))
           .attr('fill-opacity', depthOpacity(n.depth) + 0.1)
           .attr('stroke', bg2()).attr('stroke-width', 1.2)
           .attr('class', `tree-node-${n.depth}`);
    };

    // Initially draw root
    drawNode(nodes[0]);

    svg.append('circle').attr('cx', RCX).attr('cy', RCY).attr('r', RR)
        .attr('fill', 'none').attr('stroke', ink()).attr('stroke-width', 2);

    svg.append('text').attr('x', RCX).attr('y', RCY + RR + 44)
        .attr('text-anchor', 'middle').attr('font-family', 'var(--mono)')
        .attr('font-size', 17).attr('fill', ink3()).attr('letter-spacing', '0.05em')
        .text('POINCARÉ BALL  𝔹ⁿ  — Nickel & Kiela (NeurIPS 2017)');

    // Vertical separator
    svg.append('line').attr('x1', 790).attr('y1', 60).attr('x2', 790).attr('y2', 690)
        .attr('stroke', ink3()).attr('stroke-opacity', 0.15).attr('stroke-width', 1);

    // ── Animation: grow tree level by level ──────────────────
    const anim = animRef.current;
    const maxDepth = TREE_DEPTH;

    const animate = () => {
      anim.step = 0;
      const tick = (d) => {
        if (d > maxDepth) return;
        const t = setTimeout(() => {
          // Draw all edges at depth d
          (edgesByDepth[d] || []).forEach(drawEdge);
          // Draw all nodes at depth d+1
          nodes.filter(n => n.depth === d+1).forEach(drawNode);
          tick(d + 1);
        }, 480 * d);
        anim.timers.push(t);
      };
      tick(0);
    };

    const reset = () => {
      anim.timers.forEach(clearTimeout);
      anim.timers = [];
      anim.step = 0;
      treeG.selectAll('*').remove();
      nodeG.selectAll('*').remove();
      drawNode(nodes[0]);
    };

    const stage = document.querySelector('deck-stage');
    if (!stage) return;
    const onSlide = e => {
      const host = svgRef.current?.closest('poincare-disk');
      if (!host) return;
      if (e.detail.slide?.contains(host))              animate();
      else if (e.detail.previousSlide?.contains(host)) reset();
    };
    stage.addEventListener('slidechange', onSlide);
    return () => {
      stage.removeEventListener('slidechange', onSlide);
      anim.timers.forEach(clearTimeout);
    };
  }, []);

  return <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ display:'block' }} />;
}
