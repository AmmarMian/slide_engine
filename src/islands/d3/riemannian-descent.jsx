// riemannian-descent.jsx — D3 animation of Riemannian Gradient Descent on S²
// Cost: f(p) = 1 − p·T (minimum at target T ∈ S²)
// Retraction: spherical normalization  R_x(v) = (x+v)/‖x+v‖
// Animates step-by-step on slide reveal; resets on leave.

import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

// ── Math helpers ──────────────────────────────────────────────
const dot3   = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const norm3  = v      => Math.sqrt(dot3(v, v));
const add3   = (a, b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
const scale3 = (v, s) => [v[0]*s,   v[1]*s,   v[2]*s];
const nrm3   = v      => { const n = norm3(v); return scale3(v, 1/n); };
const cross3 = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];

// ── Manifold & cost ───────────────────────────────────────────
// T = normalize([0.4, 0.7, 0.9]) ≈ (0.331, 0.579, 0.745)
const T = nrm3([0.4, 0.7, 0.9]);

// Riemannian gradient of f(p) = 1 − p·T  at  p ∈ S²
//   grad_M f(p) = −T + (T·p) p
const rGrad = p => add3(scale3(T, -1), scale3(p, dot3(T, p)));

// One RGD step with retraction = normalization
const rgdStep = (p, alpha) => nrm3(add3(p, scale3(rGrad(p), -alpha)));

// Compute N steps; returns array of (N+1) points on S²
function computeRGD(p0, nSteps, alpha) {
  const pts = [[...p0]];
  let p = p0;
  for (let i = 0; i < nSteps; i++) { p = rgdStep(p, alpha); pts.push([...p]); }
  return pts;
}

// SLERP between two points on S²
function slerp(p0, p1, t) {
  const c = Math.max(-1, Math.min(1, dot3(p0, p1)));
  const omega = Math.acos(c);
  if (Math.abs(omega) < 1e-7) return p0;
  const s = Math.sin(omega);
  return add3(scale3(p0, Math.sin((1-t)*omega)/s), scale3(p1, Math.sin(t*omega)/s));
}

// Geodesic arc: n+1 points from p0 to p1 along great circle
function geodArc(p0, p1, n = 24) {
  return Array.from({ length: n+1 }, (_, i) => slerp(p0, p1, i/n));
}

// Level circle: points p ∈ S² with p·T = c
function levelCircle(c, n = 90) {
  if (Math.abs(c) > 0.9999) return [];
  const r = Math.sqrt(1 - c*c);
  const u = nrm3(cross3(Math.abs(T[2]) < 0.9 ? [0,0,1] : [1,0,0], T));
  const w = cross3(T, u);
  return Array.from({ length: n+1 }, (_, i) => {
    const th = (i/n) * 2 * Math.PI;
    return add3(scale3(T, c), add3(scale3(u, r*Math.cos(th)), scale3(w, r*Math.sin(th))));
  });
}

// ── Projection ────────────────────────────────────────────────
// Rotation: Y by rotY°, then X by rotX° — chosen so both start and
// target appear in the front hemisphere (z_rot > 0).
// rotY=48°, rotX=12° centres the midpoint of the trajectory.
function makeProj(rotYdeg, rotXdeg, cx, cy, R) {
  const ry = rotYdeg * Math.PI/180, rx = rotXdeg * Math.PI/180;
  const [cy_, sy_] = [Math.cos(ry), Math.sin(ry)];
  const [cx_, sx_] = [Math.cos(rx), Math.sin(rx)];
  const rot = ([x, y, z]) => {
    const x1 = x*cy_ + z*sy_, y1 = y, z1 = -x*sy_ + z*cy_;
    return [x1, y1*cx_ - z1*sx_, y1*sx_ + z1*cx_];
  };
  return p => {
    const [rx_, ry_, rz] = rot(p);
    return { x: cx + rx_*R, y: cy - ry_*R, z: rz, vis: rz > -0.05 };
  };
}

// Convert array of 3D points to SVG path string (lift pen at horizon)
function pts2path(pts, proj) {
  let d = '', pen = false;
  for (const p of pts) {
    const { x, y, vis } = proj(p);
    if (vis) {
      d += pen ? `L${x.toFixed(1)},${y.toFixed(1)}` : `M${x.toFixed(1)},${y.toFixed(1)}`;
      pen = true;
    } else pen = false;
  }
  return d;
}

// ── Constants ─────────────────────────────────────────────────
// P0 = normalize(−0.864, −0.432, −0.259) — already unit length,
// sits 137° from T, both visible after rotation (z_rot ≈ +0.37).
const P0 = [-0.864, -0.432, -0.259];
const N_STEPS = 10, ALPHA = 0.5;
const W = 1600, H = 720;
const [SCX, SCY, SR] = [470, 350, 255];   // sphere centre & radius
const [PL, PR, PT, PB] = [890, 1560, 75, 630]; // plot bounds

export function RiemannianDescent() {
  const svgRef  = useRef(null);
  const animRef = useRef({ step: 0, timer: null, running: false });

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const cs  = s => getComputedStyle(document.documentElement).getPropertyValue(s).trim();
    const ink  = () => cs('--ink')    || '#161820';
    const ink2 = () => cs('--ink-2')  || '#2e3040';
    const ink3 = () => cs('--ink-3')  || '#666880';
    const bg   = () => cs('--bg')     || '#f0f0f2';
    const bg2  = () => cs('--bg-2')   || '#ffffff';
    const acc  = () => cs('--accent') || '#d23b1c';
    const tint = () => cs('--tint')   || '#dddde8';

    const proj = makeProj(48, 12, SCX, SCY, SR);

    // Pre-compute path + costs
    const path  = computeRGD(P0, N_STEPS, ALPHA);
    const costs = path.map(p => 1 - dot3(p, T));

    // ── Defs ──────────────────────────────────────────────────
    const defs = svg.append('defs');
    defs.append('clipPath').attr('id', 'sph-clip')
        .append('circle').attr('cx', SCX).attr('cy', SCY).attr('r', SR);

    // Radial gradient centred on projected target (approximates cost heatmap)
    const tSc = proj(T);
    const rg  = defs.append('radialGradient').attr('id', 'cost-rg')
        .attr('gradientUnits', 'userSpaceOnUse')
        .attr('cx', tSc.x).attr('cy', tSc.y).attr('r', SR * 1.5);
    rg.append('stop').attr('offset',   '0%').attr('stop-color', acc()).attr('stop-opacity', 0.22);
    rg.append('stop').attr('offset',  '40%').attr('stop-color', tint()).attr('stop-opacity', 0.14);
    rg.append('stop').attr('offset', '100%').attr('stop-color', ink3()).attr('stop-opacity', 0.20);

    // ── Sphere background ──────────────────────────────────────
    svg.append('circle').attr('cx', SCX).attr('cy', SCY).attr('r', SR)
        .attr('fill', bg2());
    svg.append('circle').attr('cx', SCX).attr('cy', SCY).attr('r', SR)
        .attr('fill', 'url(#cost-rg)').attr('clip-path', 'url(#sph-clip)');

    // ── Level curves (latitude circles around T) ─────────────
    const lvlG = svg.append('g').attr('clip-path', 'url(#sph-clip)');
    [-0.65, -0.25, 0.18, 0.55, 0.82].forEach((c, i) => {
      const d = pts2path(levelCircle(c), proj);
      if (!d) return;
      lvlG.append('path').attr('d', d).attr('fill', 'none')
          .attr('stroke', ink3()).attr('stroke-width', c > 0.5 ? 1.3 : 0.9)
          .attr('stroke-opacity', 0.14 + i * 0.08)
          .attr('stroke-dasharray', '4,5');
    });

    // ── Ghost path (full trajectory, faint) ───────────────────
    const ghostPts = path.flatMap((p, i) => i < path.length-1 ? geodArc(p, path[i+1], 20) : []);
    svg.append('g').attr('clip-path', 'url(#sph-clip)')
        .append('path').attr('d', pts2path(ghostPts, proj))
        .attr('fill', 'none').attr('stroke', ink3()).attr('stroke-width', 1.5)
        .attr('stroke-opacity', 0.22).attr('stroke-dasharray', '3,6');

    // ── Active descent path ────────────────────────────────────
    const activeG  = svg.append('g').attr('clip-path', 'url(#sph-clip)');
    const activePth = activeG.append('path').attr('fill', 'none')
        .attr('stroke', acc()).attr('stroke-width', 3.5)
        .attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round');

    // ── Tangent vector arrow ───────────────────────────────────
    const arrowG    = svg.append('g');
    const arrowLine = arrowG.append('line')
        .attr('stroke', ink()).attr('stroke-width', 2.8).attr('stroke-linecap', 'round');
    const arrowHead = arrowG.append('polygon').attr('fill', ink());

    // ── Current point dot ──────────────────────────────────────
    const curDot = svg.append('circle').attr('r', 13)
        .attr('fill', acc()).attr('stroke', bg()).attr('stroke-width', 2.5);

    // ── Static markers ────────────────────────────────────────
    const p0Sc = proj(P0);
    svg.append('circle').attr('cx', p0Sc.x).attr('cy', p0Sc.y)
        .attr('r', 9).attr('fill', ink3()).attr('stroke', bg2()).attr('stroke-width', 2);
    svg.append('text').attr('x', p0Sc.x - 18).attr('y', p0Sc.y + 28)
        .attr('text-anchor', 'middle').attr('font-family', 'var(--mono)')
        .attr('font-size', 21).attr('fill', ink3()).text('x₀');

    svg.append('circle').attr('cx', tSc.x).attr('cy', tSc.y).attr('r', 12)
        .attr('fill', acc()).attr('fill-opacity', 0.22)
        .attr('stroke', acc()).attr('stroke-width', 2.5);
    svg.append('text').attr('x', tSc.x + 18).attr('y', tSc.y - 14)
        .attr('font-family', 'var(--mono)').attr('font-size', 21)
        .attr('fill', acc()).attr('font-weight', 600).text('x★');

    // ── Sphere outline (draws on top of all fills) ────────────
    svg.append('circle').attr('cx', SCX).attr('cy', SCY).attr('r', SR)
        .attr('fill', 'none').attr('stroke', ink()).attr('stroke-width', 2);

    // Sphere label
    svg.append('text').attr('x', SCX).attr('y', SCY + SR + 50)
        .attr('text-anchor', 'middle').attr('font-family', 'var(--mono)')
        .attr('font-size', 21).attr('fill', ink3()).attr('letter-spacing', '0.07em')
        .text('MANIFOLD  𝕊²');

    // Step/cost label (dynamic)
    const stepLbl = svg.append('text').attr('x', SCX).attr('y', 36)
        .attr('text-anchor', 'middle').attr('font-family', 'var(--mono)')
        .attr('font-size', 23).attr('fill', ink2());

    // ── Convergence plot ──────────────────────────────────────
    const xSc = d3.scaleLinear([0, N_STEPS], [PL, PR]);
    const ySc = d3.scaleLinear([0, 2.15],    [PB, PT]);
    const pw  = PR - PL, ph = PB - PT;

    const gxEl = svg.append('g').attr('transform', `translate(0,${PB})`)
        .call(d3.axisBottom(xSc).ticks(5).tickSize(-ph));
    const gyEl = svg.append('g').attr('transform', `translate(${PL},0)`)
        .call(d3.axisLeft(ySc).ticks(5).tickSize(-pw));
    [gxEl, gyEl].forEach(g => {
      g.select('.domain').remove();
      g.selectAll('.tick line').attr('stroke', ink3()).attr('stroke-opacity', 0.13)
          .attr('stroke-dasharray', '3,5');
      g.selectAll('.tick text').attr('font-family', 'var(--mono)')
          .attr('font-size', 19).attr('fill', ink3());
    });

    svg.append('text').attr('x', (PL+PR)/2).attr('y', PB + 52)
        .attr('text-anchor', 'middle').attr('font-family', 'var(--mono)')
        .attr('font-size', 20).attr('fill', ink3()).attr('letter-spacing', '0.05em')
        .text('ITERATION  k');
    svg.append('text')
        .attr('transform', `rotate(-90,${PL-52},${(PT+PB)/2})`)
        .attr('x', PL-52).attr('y', (PT+PB)/2)
        .attr('text-anchor', 'middle').attr('font-family', 'var(--mono)')
        .attr('font-size', 19).attr('fill', ink3()).attr('letter-spacing', '0.04em')
        .text('f(xₖ)  =  1 − xₖ · x★');
    svg.append('text').attr('x', (PL+PR)/2).attr('y', PT - 22)
        .attr('text-anchor', 'middle').attr('font-family', 'var(--serif)')
        .attr('font-size', 29).attr('fill', ink2())
        .text('Convergence of RGD on 𝕊²');

    // f★ = 0 reference
    svg.append('line')
        .attr('x1', PL).attr('x2', PR)
        .attr('y1', ySc(0)).attr('y2', ySc(0))
        .attr('stroke', acc()).attr('stroke-opacity', 0.38)
        .attr('stroke-width', 1.5).attr('stroke-dasharray', '6,4');
    svg.append('text').attr('x', PR + 9).attr('y', ySc(0) + 7)
        .attr('font-family', 'var(--mono)').attr('font-size', 17)
        .attr('fill', acc()).attr('fill-opacity', 0.65).text('f★');

    // Dynamic curve + dots
    const costCurve = svg.append('path').attr('fill', 'none')
        .attr('stroke', acc()).attr('stroke-width', 2.5)
        .attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round');
    const costLine  = d3.line().x((_, i) => xSc(i)).y(d => ySc(d));
    const dotsG     = svg.append('g');

    // ── Update display for a given step ──────────────────────
    const update = step => {
      const p   = path[step];
      const pSc = proj(p);

      // Active arc
      const segs = path.slice(0, step+1).flatMap((pt, i, arr) =>
        i < arr.length-1 ? geodArc(pt, arr[i+1], 20) : []
      );
      activePth.attr('d', segs.length ? pts2path(segs, proj) : '');

      // Current dot
      curDot.attr('cx', pSc.x).attr('cy', pSc.y).attr('opacity', pSc.vis ? 1 : 0);

      // Tangent arrow (descent direction = −grad_M f)
      const gM   = rGrad(p);
      const gLen = norm3(gM);
      if (gLen > 1e-5 && pSc.vis) {
        const dir = scale3(gM, -1/gLen);
        const tipSc = proj(slerp(p, nrm3(add3(p, dir)), 0.20));
        const dx = tipSc.x - pSc.x, dy = tipSc.y - pSc.y;
        const dl = Math.sqrt(dx*dx + dy*dy) || 1;
        const nx = dx/dl, ny = dy/dl, disp = 78;
        const ex = pSc.x + nx*disp, ey = pSc.y + ny*disp;
        const ah = 13;
        arrowLine.attr('x1', pSc.x).attr('y1', pSc.y)
            .attr('x2', ex - nx*ah*0.5).attr('y2', ey - ny*ah*0.5);
        arrowHead.attr('points',
          `${ex},${ey} ${ex-nx*ah-ny*6},${ey-ny*ah+nx*6} ${ex-nx*ah+ny*6},${ey-ny*ah-nx*6}`);
        arrowG.attr('opacity', 1);
      } else arrowG.attr('opacity', 0);

      // Step label
      stepLbl.text(`k = ${step}   ·   f(xₖ) = ${costs[step].toFixed(4)}`);

      // Convergence plot
      const shown = costs.slice(0, step+1);
      costCurve.attr('d', costLine(shown));
      dotsG.selectAll('circle').data(shown).join('circle')
          .attr('cx', (_, i) => xSc(i)).attr('cy', d => ySc(d))
          .attr('r', 5.5).attr('fill', acc())
          .attr('stroke', bg2()).attr('stroke-width', 1.5);
    };

    update(0);

    // ── Animation ─────────────────────────────────────────────
    const anim = animRef.current;
    const animate = () => {
      anim.running = true;
      const tick = () => {
        if (!anim.running || anim.step >= N_STEPS) return;
        anim.step++;
        update(anim.step);
        if (anim.step < N_STEPS) anim.timer = setTimeout(tick, 680);
      };
      anim.timer = setTimeout(tick, 360);
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
      const host = svgRef.current?.closest('riemannian-descent');
      if (!host) return;
      if (e.detail.slide?.contains(host))         animate();
      else if (e.detail.previousSlide?.contains(host)) reset();
    };
    stage.addEventListener('slidechange', onSlide);
    return () => {
      stage.removeEventListener('slidechange', onSlide);
      if (anim.timer) clearTimeout(anim.timer);
      anim.running = false;
    };
  }, []);

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`}
         width="100%" height="100%" style={{ display: 'block' }} />
  );
}
