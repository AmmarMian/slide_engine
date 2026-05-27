// tangent-projection.jsx — animated decomposition of Euclidean gradient into
// normal + tangential components on S², yielding the Riemannian gradient.
// Four-stage animation: (1) sphere, (2) tangent plane, (3) Euclidean gradient,
// (4) decomposition with normal and Riemannian gradient arrows.

import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const dot3   = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const norm3  = v      => Math.sqrt(dot3(v, v));
const add3   = (a, b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
const scale3 = (v, s) => [v[0]*s, v[1]*s, v[2]*s];
const nrm3   = v      => scale3(v, 1/norm3(v));
const cross3 = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const sub3   = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];

// Rotation: Y then X
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

function levelCircle(c, T, n = 80) {
  if (Math.abs(c) > 0.9999) return [];
  const r = Math.sqrt(1 - c*c);
  const aux = Math.abs(T[2]) < 0.9 ? [0,0,1] : [1,0,0];
  const u = nrm3(cross3(aux, T));
  const w = cross3(T, u);
  return Array.from({ length: n+1 }, (_, i) => {
    const th = (i/n) * 2 * Math.PI;
    return add3(scale3(T, c), add3(scale3(u, r*Math.cos(th)), scale3(w, r*Math.sin(th))));
  });
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

// The base point on S²
const P  = nrm3([0.618, 0.309, 0.721]);
// Cost f(p) = 1 - p_z → Euclidean gradient ∇f = (0, 0, -1)
const GRAD_E = [0, 0, -1];
// Normal component: (∇f · P) P
const NORM_COMP = scale3(P, dot3(GRAD_E, P));
// Riemannian gradient: ∇f - (∇f·P)P
const GRAD_R = sub3(GRAD_E, NORM_COMP);

const W = 1600, H = 720;
const CX = 430, CY = 360, CR = 270;   // sphere centre/radius
// Rotation chosen so P faces camera
const ROT_Y = -25, ROT_X = 20;

export function TangentProjection() {
  const svgRef  = useRef(null);
  const animRef = useRef({ stage: 0, timers: [] });

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

    const proj = makeProj(ROT_Y, ROT_X, CX, CY, CR);
    const pSc  = proj(P);

    // ── Defs ────────────────────────────────────────────────
    const defs = svg.append('defs');
    defs.append('clipPath').attr('id', 'tp-clip')
        .append('circle').attr('cx', CX).attr('cy', CY).attr('r', CR);

    // ── Sphere ───────────────────────────────────────────────
    svg.append('circle').attr('cx', CX).attr('cy', CY).attr('r', CR)
        .attr('fill', bg2()).attr('stroke', ink()).attr('stroke-width', 1.8);

    // Level curves: f(p) = 1 - p_z = c → p_z = 1-c
    const T_axis = [0, 0, 1]; // axis of f(p) = 1-p_z
    [0.15, 0.4, 0.65, 0.9].forEach(z => {
      const d = pts2path(levelCircle(z, T_axis), proj);
      if (!d) return;
      svg.append('g').attr('clip-path', 'url(#tp-clip)')
          .append('path').attr('d', d).attr('fill', 'none')
          .attr('stroke', ink3()).attr('stroke-width', 1).attr('stroke-opacity', 0.18)
          .attr('stroke-dasharray', '4,6');
    });

    // f minimum marker (north pole = [0,0,1])
    const northSc = proj([0, 0, 1]);
    svg.append('circle').attr('cx', northSc.x).attr('cy', northSc.y)
        .attr('r', 9).attr('fill', 'none')
        .attr('stroke', acc()).attr('stroke-width', 2).attr('stroke-opacity', 0.55);
    svg.append('text').attr('x', northSc.x + 14).attr('y', northSc.y - 10)
        .attr('font-family', 'var(--mono)').attr('font-size', 18)
        .attr('fill', acc()).attr('fill-opacity', 0.7).text('min f');

    // ── Stage indicators (right panel) ──────────────────────
    const STAGES = [
      { label: '1', desc: 'Point p on S²' },
      { label: '2', desc: 'Tangent plane TₚS²' },
      { label: '3', desc: 'Euclidean gradient ∇f' },
      { label: '4', desc: 'Riemannian gradient' },
    ];
    const stageG = svg.append('g');
    STAGES.forEach(({ label, desc }, i) => {
      const gy = 180 + i * 100;
      const dot = stageG.append('circle').attr('cx', 1060).attr('cy', gy)
          .attr('r', 18).attr('fill', bg2()).attr('stroke', ink3()).attr('stroke-width', 1.5)
          .attr('opacity', 0.4);
      stageG.append('text').attr('x', 1060).attr('y', gy + 7)
          .attr('text-anchor', 'middle').attr('font-family', 'var(--mono)')
          .attr('font-size', 18).attr('font-weight', 600).attr('fill', ink3())
          .attr('opacity', 0.4).text(label);
      stageG.append('text').attr('x', 1090).attr('y', gy + 7)
          .attr('font-family', 'var(--mono)').attr('font-size', 18).attr('fill', ink3())
          .attr('opacity', 0.4).text(desc);
      // Store refs for later highlighting
      dot.attr('id', `tp-dot-${i}`);
    });

    const highlightStage = s => {
      STAGES.forEach((_, i) => {
        const op = i <= s ? 1 : 0.35;
        stageG.selectAll(`#tp-dot-${i}`).attr('opacity', op)
            .attr('fill', i === s ? acc() : bg2())
            .attr('stroke', i === s ? acc() : ink3());
        stageG.selectAll(`text`).filter((_, n, ns) => +ns[n].getAttribute('x') > 1050 && +ns[n].getAttribute('y') - 7 === (180 + i*100))
            .attr('opacity', op);
      });
      // Re-select all text nodes by position
      svg.selectAll('text').each(function() {
        const el = d3.select(this);
        const x = +el.attr('x'), y = +el.attr('y');
        const stageIdx = STAGES.findIndex((_, i) => y - 7 === 180 + i*100);
        if (stageIdx >= 0 && x >= 1050) el.attr('opacity', stageIdx <= s ? 1 : 0.35);
      });
    };

    // ── Point P marker ──────────────────────────────────────
    svg.append('circle').attr('cx', pSc.x).attr('cy', pSc.y)
        .attr('r', 11).attr('fill', ink()).attr('stroke', bg2()).attr('stroke-width', 2.5);
    svg.append('text').attr('x', pSc.x + 16).attr('y', pSc.y + 7)
        .attr('font-family', 'var(--mono)').attr('font-size', 22)
        .attr('fill', ink()).attr('font-weight', 600).text('p');

    // ── Tangent plane (parallelogram, initially hidden) ──────
    const tangentG = svg.append('g').attr('opacity', 0);

    // Tangent plane basis in 3D
    const u3 = nrm3(cross3(P, [0, 1, 0.001]));
    const v3 = cross3(P, u3);
    const planePts3 = [
      add3(P, add3(scale3(u3,  0.55), scale3(v3,  0.45))),
      add3(P, add3(scale3(u3, -0.55), scale3(v3,  0.45))),
      add3(P, add3(scale3(u3, -0.55), scale3(v3, -0.45))),
      add3(P, add3(scale3(u3,  0.55), scale3(v3, -0.45))),
    ].map(pt => proj(pt));
    const planeD = planePts3.map((pt, i) => `${i===0?'M':'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ') + 'Z';
    tangentG.append('path').attr('d', planeD)
        .attr('fill', acc()).attr('fill-opacity', 0.07)
        .attr('stroke', acc()).attr('stroke-width', 1.5).attr('stroke-opacity', 0.55)
        .attr('stroke-dasharray', '6,4');
    tangentG.append('text').attr('x', planePts3[0].x + 12).attr('y', planePts3[0].y - 10)
        .attr('font-family', 'var(--mono)').attr('font-size', 19)
        .attr('fill', acc()).attr('fill-opacity', 0.75).text('TₚS²');

    // ── Arrow helper ─────────────────────────────────────────
    function drawArrow(parent, x1, y1, x2, y2, color, sw = 3) {
      const dx = x2-x1, dy = y2-y1, dl = Math.sqrt(dx*dx+dy*dy) || 1;
      const nx = dx/dl, ny = dy/dl, ah = 14;
      const ex = x2, ey = y2;
      parent.append('line')
          .attr('x1', x1).attr('y1', y1)
          .attr('x2', ex - nx*ah*0.5).attr('y2', ey - ny*ah*0.5)
          .attr('stroke', color).attr('stroke-width', sw).attr('stroke-linecap', 'round');
      parent.append('polygon')
          .attr('fill', color)
          .attr('points', `${ex},${ey} ${ex-nx*ah-ny*5},${ey-ny*ah+nx*5} ${ex-nx*ah+ny*5},${ey-ny*ah-nx*5}`);
    }

    // ── Euclidean gradient arrow (initially hidden) ──────────
    const SCALE = 200;
    const gradEG  = svg.append('g').attr('opacity', 0);
    const geEnd   = proj(add3(P, scale3(GRAD_E, 0.5)));
    drawArrow(gradEG, pSc.x, pSc.y, pSc.x + (geEnd.x - pSc.x) * 1.0, pSc.y + (geEnd.y - pSc.y) * 1.0, ink(), 3.5);
    gradEG.append('text')
        .attr('x', pSc.x + (geEnd.x - pSc.x) * 1.1 + 10)
        .attr('y', pSc.y + (geEnd.y - pSc.y) * 1.1)
        .attr('font-family', 'var(--mono)').attr('font-size', 22)
        .attr('fill', ink()).attr('font-weight', 600).text('∇f');

    // ── Decomposition arrows (initially hidden) ──────────────
    const decompG = svg.append('g').attr('opacity', 0);

    // Normal component: (∇f·p)p direction in 3D projected
    const ncEnd  = proj(add3(P, scale3(NORM_COMP, 0.85)));
    // Riemannian gradient
    const grEnd  = proj(add3(P, scale3(GRAD_R, 0.85)));

    // Dashed line from tip of ∇f to tip of ∇f_R (decomposition parallelogram)
    const gradETip = proj(add3(P, scale3(GRAD_E, 0.5)));
    const gradRTip = proj(add3(P, scale3(GRAD_R, 0.85)));
    const normTip  = proj(add3(P, scale3(NORM_COMP, 0.85)));

    decompG.append('line')
        .attr('x1', gradRTip.x).attr('y1', gradRTip.y)
        .attr('x2', gradETip.x).attr('y2', gradETip.y)
        .attr('stroke', ink3()).attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4,4').attr('stroke-opacity', 0.55);
    decompG.append('line')
        .attr('x1', normTip.x).attr('y1', normTip.y)
        .attr('x2', gradETip.x).attr('y2', gradETip.y)
        .attr('stroke', ink3()).attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4,4').attr('stroke-opacity', 0.55);

    drawArrow(decompG, pSc.x, pSc.y, normTip.x, normTip.y, ink3(), 2.5);
    decompG.append('text').attr('x', normTip.x + 10).attr('y', normTip.y + 7)
        .attr('font-family', 'var(--mono)').attr('font-size', 20)
        .attr('fill', ink3()).text('(∇f·p)p');

    drawArrow(decompG, pSc.x, pSc.y, grEnd.x, grEnd.y, acc(), 4);
    decompG.append('text').attr('x', grEnd.x + 12).attr('y', grEnd.y + 7)
        .attr('font-family', 'var(--mono)').attr('font-size', 22).attr('font-weight', 700)
        .attr('fill', acc()).text('grad f(p)');

    // ── Right-panel formula ──────────────────────────────────
    const formulaG = svg.append('g');
    const RX = 1150;
    formulaG.append('text').attr('x', RX).attr('y', 84)
        .attr('font-family', 'var(--sans)').attr('font-size', 30).attr('font-weight', 600)
        .attr('fill', ink()).text('Gradient decomposition on S²');

    const formulaLines = [
      { y: 550, text: '∇f(p)  =  grad f(p)  +  (∇f·p) p', color: () => ink2(), size: 22 },
      { y: 596, text: '          tangential      normal', color: () => ink3(), size: 18 },
      { y: 650, text: 'grad f(p) = ∇f(p) − (∇f·p) p', color: () => acc(), size: 24, bold: true },
    ];
    formulaLines.forEach(({ y, text, color, size, bold }) => {
      formulaG.append('text').attr('x', RX).attr('y', y)
          .attr('font-family', 'var(--mono)').attr('font-size', size)
          .attr('font-weight', bold ? 700 : 400)
          .attr('fill', color()).text(text);
    });

    formulaG.append('line')
        .attr('x1', RX).attr('x2', RX + 420)
        .attr('y1', 520).attr('y2', 520)
        .attr('stroke', ink()).attr('stroke-width', 1.5).attr('stroke-opacity', 0.2);

    formulaG.append('line')
        .attr('x1', RX).attr('x2', RX + 420)
        .attr('y1', 620).attr('y2', 620)
        .attr('stroke', acc()).attr('stroke-width', 2).attr('stroke-opacity', 0.3);

    // ── Animation ────────────────────────────────────────────
    const anim = animRef.current;
    highlightStage(-1);

    const animate = () => {
      anim.stage = 0;
      highlightStage(0);

      const t1 = setTimeout(() => {
        tangentG.transition().duration(500).attr('opacity', 1);
        highlightStage(1);
      }, 600);
      const t2 = setTimeout(() => {
        gradEG.transition().duration(500).attr('opacity', 1);
        highlightStage(2);
      }, 1500);
      const t3 = setTimeout(() => {
        decompG.transition().duration(600).attr('opacity', 1);
        highlightStage(3);
      }, 2600);
      anim.timers = [t1, t2, t3];
    };

    const reset = () => {
      anim.timers.forEach(clearTimeout);
      anim.timers = [];
      anim.stage = 0;
      tangentG.attr('opacity', 0);
      gradEG.attr('opacity', 0);
      decompG.attr('opacity', 0);
      highlightStage(-1);
    };

    const stage = document.querySelector('deck-stage');
    if (!stage) return;
    const onSlide = e => {
      const host = svgRef.current?.closest('tangent-projection');
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
