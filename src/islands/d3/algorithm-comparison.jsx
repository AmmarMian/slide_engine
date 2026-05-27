// algorithm-comparison.jsx — Animated comparison of three optimization trajectories
// on S²: RGD (slow α), RGD (tuned α), and Riemannian CG (Polak-Ribière).
// Cost: f(p) = p₁² + 2p₂² + 8p₃² — elliptic quadratic, min at ±e₁ = (±1,0,0).

import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const dot3   = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const norm3  = v      => Math.sqrt(dot3(v, v));
const add3   = (a, b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
const scale3 = (v, s) => [v[0]*s, v[1]*s, v[2]*s];
const nrm3   = v      => scale3(v, 1/norm3(v));
const cross3 = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];

function makeProj(rotYdeg, rotXdeg, cx, cy, R) {
  const ry = rotYdeg * Math.PI/180, rx = rotXdeg * Math.PI/180;
  const [cY, sY] = [Math.cos(ry), Math.sin(ry)];
  const [cX, sX] = [Math.cos(rx), Math.sin(rx)];
  const rot = ([x, y, z]) => {
    const x1 = x*cY + z*sY, z1 = -x*sY + z*cY;
    return [x1, y*cX - z1*sX, y*sX + z1*cX];
  };
  return p => {
    const [rx_, ry_, rz] = rot(p);
    return { x: cx + rx_*R, y: cy - ry_*R, z: rz, vis: rz > -0.05 };
  };
}

function slerp(p0, p1, t) {
  const c = Math.max(-1, Math.min(1, dot3(p0, p1)));
  const omega = Math.acos(c);
  if (Math.abs(omega) < 1e-7) return p0;
  const s = Math.sin(omega);
  return add3(scale3(p0, Math.sin((1-t)*omega)/s), scale3(p1, Math.sin(t*omega)/s));
}

function geodArc(p0, p1, n = 20) {
  return Array.from({ length: n+1 }, (_, i) => slerp(p0, p1, i/n));
}

function pts2path(pts, proj) {
  let d = '', pen = false;
  for (const p of pts) {
    const { x, y, vis } = proj(p);
    if (vis) { d += pen ? `L${x.toFixed(1)},${y.toFixed(1)}` : `M${x.toFixed(1)},${y.toFixed(1)}`; pen = true; }
    else pen = false;
  }
  return d;
}

// Cost: f(p) = p₁² + 2p₂² + 8p₃², minimum at (1,0,0)
const W_COST = [1, 2, 8];
const cost   = p => W_COST[0]*p[0]*p[0] + W_COST[1]*p[1]*p[1] + W_COST[2]*p[2]*p[2];
const eucGrad= p => [2*W_COST[0]*p[0], 2*W_COST[1]*p[1], 2*W_COST[2]*p[2]];
// Riemannian gradient on S²
const rGrad  = p => { const g = eucGrad(p); return add3(g, scale3(p, -dot3(g, p))); };

// RGD step
const rgdStep = (p, alpha) => nrm3(add3(p, scale3(rGrad(p), -alpha)));

// Parallel transport of vector v from p0 to p1 along geodesic (approximate via reflection)
function parallelTransport(v, p0, p1) {
  const e = nrm3(add3(p1, scale3(p0, -dot3(p0,p1))));
  const vt = add3(v, scale3(e, -dot3(v,e)));
  // 2nd reflection correction
  const mid = nrm3(add3(p0, p1));
  return add3(vt, scale3(mid, -2*dot3(vt, mid)));
}

function computeRGD(p0, nSteps, alpha) {
  const pts = [[...p0]];
  let p = p0;
  for (let i = 0; i < nSteps; i++) { p = rgdStep(p, alpha); pts.push([...p]); }
  return pts;
}

// Riemannian CG — Polak-Ribière with retraction and parallel transport
function computeRCG(p0, nSteps, alpha) {
  const pts = [[...p0]];
  let p = p0;
  let g = rGrad(p);
  let d = scale3(g, -1);
  for (let i = 0; i < nSteps; i++) {
    // line search with fixed alpha (simplified)
    const pNew = nrm3(add3(p, scale3(d, alpha)));
    const gNew = rGrad(pNew);
    // Transport old gradient to new tangent space
    const gT   = parallelTransport(g, p, pNew);
    // Polak-Ribière beta
    const num  = dot3(gNew, add3(gNew, scale3(gT, -1)));
    const den  = dot3(g, g);
    const beta = den > 1e-12 ? Math.max(0, num / den) : 0;
    const dT   = parallelTransport(d, p, pNew);
    d = add3(scale3(gNew, -1), scale3(dT, beta));
    // Project d onto tangent plane at pNew
    d = add3(d, scale3(pNew, -dot3(d, pNew)));
    p = pNew;
    g = gNew;
    pts.push([...p]);
  }
  return pts;
}

const P0 = nrm3([0.4, 0.5, 0.8]);
const N_STEPS = 18;
const ALPHA_SLOW = 0.06, ALPHA_GOOD = 0.22, ALPHA_CG = 0.4;
const W = 1600, H = 720;
const SCX = 430, SCY = 360, SR = 262;
const ROT_Y = -28, ROT_X = -22;
const [PL, PR, PT, PB] = [870, 1560, 60, 648];

// Level circles for this cost
function levelEllipse(c, nPts = 100) {
  // Level set p·Wp = c on S² → parametrize meridians
  const pts = [];
  for (let i = 0; i <= nPts; i++) {
    const th = (i/nPts) * 2 * Math.PI;
    // Walk along sphere with this angle
    const q = nrm3([Math.cos(th) * Math.sqrt(c/W_COST[0]) * 0.85,
                    Math.sin(th) * Math.sqrt(c/W_COST[1]) * 0.85,
                    0]);
    pts.push(q);
  }
  return pts;
}

export function AlgorithmComparison() {
  const svgRef  = useRef(null);
  const animRef = useRef({ step: 0, timer: null, running: false });

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

    const proj = makeProj(ROT_Y, ROT_X, SCX, SCY, SR);

    const pathSlow = computeRGD(P0, N_STEPS, ALPHA_SLOW);
    const pathGood = computeRGD(P0, N_STEPS, ALPHA_GOOD);
    const pathCG   = computeRCG(P0, N_STEPS, ALPHA_CG);

    const costSlow = pathSlow.map(cost);
    const costGood = pathGood.map(cost);
    const costCG   = pathCG.map(cost);

    // Colors: slow=ink3, good=ink2, CG=accent
    const COL_SLOW = () => ink3();
    const COL_GOOD = () => ink2();
    const COL_CG   = () => acc();

    // ── Defs ──────────────────────────────────────────────
    const defs = svg.append('defs');
    defs.append('clipPath').attr('id', 'ac-clip')
        .append('circle').attr('cx', SCX).attr('cy', SCY).attr('r', SR);

    svg.append('circle').attr('cx', SCX).attr('cy', SCY).attr('r', SR)
        .attr('fill', bg2());

    // Level curves (approximate circles in xy-plane)
    [1.0, 1.5, 2.5, 4.0].forEach(c => {
      const d = pts2path(levelEllipse(c), proj);
      if (!d) return;
      svg.append('g').attr('clip-path', 'url(#ac-clip)')
          .append('path').attr('d', d).attr('fill', 'none')
          .attr('stroke', ink3()).attr('stroke-width', 0.8)
          .attr('stroke-opacity', 0.15).attr('stroke-dasharray', '3,5');
    });

    // Ghost full paths
    const drawGhost = (path, color) => {
      const full = path.slice(0,-1).flatMap((p,i) => geodArc(p, path[i+1], 14));
      svg.append('g').attr('clip-path', 'url(#ac-clip)')
          .append('path').attr('d', pts2path(full, proj))
          .attr('fill', 'none').attr('stroke', color).attr('stroke-width', 1.5)
          .attr('stroke-opacity', 0.15).attr('stroke-dasharray', '2,5');
    };
    drawGhost(pathSlow, COL_SLOW());
    drawGhost(pathGood, COL_GOOD());
    drawGhost(pathCG,   COL_CG());

    // Active paths (built step-by-step)
    const makeActivePath = (color, sw) =>
      svg.append('g').attr('clip-path', 'url(#ac-clip)')
         .append('path').attr('fill', 'none').attr('stroke', color)
         .attr('stroke-width', sw).attr('stroke-linecap', 'round');

    const pathEls = [
      makeActivePath(COL_SLOW(), 2),
      makeActivePath(COL_GOOD(), 3),
      makeActivePath(COL_CG(),   3.5),
    ];
    const paths = [pathSlow, pathGood, pathCG];

    // Current point dots
    const dotEls = [
      svg.append('circle').attr('r', 9).attr('fill', COL_SLOW()).attr('stroke', bg2()).attr('stroke-width', 2),
      svg.append('circle').attr('r', 10).attr('fill', COL_GOOD()).attr('stroke', bg2()).attr('stroke-width', 2),
      svg.append('circle').attr('r', 11).attr('fill', COL_CG()).attr('stroke', bg2()).attr('stroke-width', 2.5),
    ];

    // Start/target markers
    const p0Sc = proj(P0);
    svg.append('circle').attr('cx', p0Sc.x).attr('cy', p0Sc.y)
        .attr('r', 8).attr('fill', ink3()).attr('stroke', bg2()).attr('stroke-width', 2);
    svg.append('text').attr('x', p0Sc.x - 20).attr('y', p0Sc.y + 28)
        .attr('text-anchor', 'middle').attr('font-family', 'var(--mono)')
        .attr('font-size', 19).attr('fill', ink3()).text('x₀');

    const minSc = proj([1, 0, 0]);
    svg.append('circle').attr('cx', minSc.x).attr('cy', minSc.y)
        .attr('r', 11).attr('fill', 'none').attr('stroke', acc())
        .attr('stroke-width', 2.5);
    svg.append('text').attr('x', minSc.x + 16).attr('y', minSc.y - 12)
        .attr('font-family', 'var(--mono)').attr('font-size', 19)
        .attr('fill', acc()).attr('font-weight', 600).text('x★');

    svg.append('circle').attr('cx', SCX).attr('cy', SCY).attr('r', SR)
        .attr('fill', 'none').attr('stroke', ink()).attr('stroke-width', 1.8);
    svg.append('text').attr('x', SCX).attr('y', SCY + SR + 44)
        .attr('text-anchor', 'middle').attr('font-family', 'var(--mono)')
        .attr('font-size', 19).attr('fill', ink3()).attr('letter-spacing', '0.07em')
        .text('MANIFOLD  𝕊²');

    // ── Convergence plot ───────────────────────────────────
    const xSc = d3.scaleLinear([0, N_STEPS], [PL, PR]);
    const maxC = Math.max(...costSlow, ...costGood, ...costCG);
    const ySc = d3.scaleLinear([0, maxC * 1.05], [PB, PT]);
    const pw  = PR - PL, ph = PB - PT;

    const gx = svg.append('g').attr('transform', `translate(0,${PB})`).call(d3.axisBottom(xSc).ticks(6).tickSize(-ph));
    const gy = svg.append('g').attr('transform', `translate(${PL},0)`).call(d3.axisLeft(ySc).ticks(5).tickSize(-pw));
    [gx, gy].forEach(g => {
      g.select('.domain').remove();
      g.selectAll('.tick line').attr('stroke', ink3()).attr('stroke-opacity', 0.12).attr('stroke-dasharray', '3,5');
      g.selectAll('.tick text').attr('font-family', 'var(--mono)').attr('font-size', 17).attr('fill', ink3());
    });
    svg.append('text').attr('x', (PL+PR)/2).attr('y', PB + 48)
        .attr('text-anchor', 'middle').attr('font-family', 'var(--mono)')
        .attr('font-size', 18).attr('fill', ink3()).text('ITERATION  k');
    svg.append('text').attr('x', (PL+PR)/2).attr('y', PT - 18)
        .attr('text-anchor', 'middle').attr('font-family', 'var(--sans)')
        .attr('font-size', 26).attr('fill', ink2()).attr('font-weight', 600)
        .text('Cost f(xₖ) vs. Iteration');

    const lineGen = d3.line().x((_,i) => xSc(i)).y(d => ySc(d));

    const makeCurve = (color, sw, dash) =>
      svg.append('path').attr('fill', 'none').attr('stroke', color)
         .attr('stroke-width', sw).attr('stroke-linecap', 'round')
         .attr('stroke-dasharray', dash || null);

    const curveSlow = makeCurve(COL_SLOW(), 2, '5,4');
    const curveGood = makeCurve(COL_GOOD(), 2.5);
    const curveCG   = makeCurve(COL_CG(),   3);

    // Legend
    const METHODS = [
      { label: 'RGD  α=0.06 (slow)',  color: COL_SLOW, dash: '5,4', sw: 2 },
      { label: 'RGD  α=0.22 (tuned)', color: COL_GOOD, dash: null,  sw: 2.5 },
      { label: 'RCG  α=0.40 (Polak-Ribière)', color: COL_CG, dash: null, sw: 3 },
    ];
    METHODS.forEach(({ label, color, dash, sw }, i) => {
      const lx = PL + 20, ly = PT + 30 + i * 44;
      svg.append('line').attr('x1', lx).attr('y1', ly).attr('x2', lx+40).attr('y2', ly)
          .attr('stroke', color()).attr('stroke-width', sw).attr('stroke-dasharray', dash || null);
      svg.append('text').attr('x', lx + 52).attr('y', ly + 7)
          .attr('font-family', 'var(--mono)').attr('font-size', 18).attr('fill', color()).text(label);
    });

    // f★ line
    svg.append('line')
        .attr('x1', PL).attr('x2', PR).attr('y1', ySc(1)).attr('y2', ySc(1))
        .attr('stroke', acc()).attr('stroke-opacity', 0.35)
        .attr('stroke-width', 1.5).attr('stroke-dasharray', '6,4');
    svg.append('text').attr('x', PR + 8).attr('y', ySc(1) + 6)
        .attr('font-family', 'var(--mono)').attr('font-size', 16)
        .attr('fill', acc()).attr('fill-opacity', 0.6).text('f★');

    const update = step => {
      paths.forEach((path, j) => {
        const s = Math.min(step, path.length - 1);
        const segs = path.slice(0, s+1).flatMap((p,i,arr) => i < arr.length-1 ? geodArc(p, arr[i+1], 14) : []);
        pathEls[j].attr('d', segs.length ? pts2path(segs, proj) : '');
        const pSc = proj(path[s]);
        dotEls[j].attr('cx', pSc.x).attr('cy', pSc.y).attr('opacity', pSc.vis ? 1 : 0);
      });
      curveSlow.attr('d', lineGen(costSlow.slice(0, step+1)));
      curveGood.attr('d', lineGen(costGood.slice(0, step+1)));
      curveCG.attr('d',   lineGen(costCG.slice(0, step+1)));
    };
    update(0);

    const anim = animRef.current;
    const animate = () => {
      anim.running = true;
      const tick = () => {
        if (!anim.running || anim.step >= N_STEPS) return;
        anim.step++;
        update(anim.step);
        if (anim.step < N_STEPS) anim.timer = setTimeout(tick, 420);
      };
      anim.timer = setTimeout(tick, 300);
    };
    const reset = () => {
      anim.running = false;
      if (anim.timer) { clearTimeout(anim.timer); anim.timer = null; }
      anim.step = 0;
      update(0);
    };

    const stage = document.querySelector('deck-stage');
    if (!stage) return;
    const onSlide = e => {
      const host = svgRef.current?.closest('algorithm-comparison');
      if (!host) return;
      if (e.detail.slide?.contains(host))              animate();
      else if (e.detail.previousSlide?.contains(host)) reset();
    };
    stage.addEventListener('slidechange', onSlide);
    return () => {
      stage.removeEventListener('slidechange', onSlide);
      if (anim.timer) clearTimeout(anim.timer);
      anim.running = false;
    };
  }, []);

  return <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ display:'block' }} />;
}
