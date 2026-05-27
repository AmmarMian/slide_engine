// spd-geodesic.jsx — Animated geodesic between two 2×2 SPD matrices.
// Shows a row of 7 ellipses (static snapshots along the geodesic) plus a
// continuously morphing ellipse that travels from A₀ to A₁ and back.
// Geodesic: γ(t) = A₀^{1/2} (A₀^{-1/2} A₁ A₀^{-1/2})^t A₀^{1/2}

import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

// ── 2×2 symmetric-matrix helpers ─────────────────────────────
// Represented as [a, b, d] where matrix = [[a,b],[b,d]]
// Eigendecomposition: values λ₁,λ₂; vectors [cos θ, -sin θ], [sin θ, cos θ]
function eig22(a, b, d) {
  const tr = a + d, det = a*d - b*b;
  const disc = Math.sqrt(Math.max(0, tr*tr/4 - det));
  const l1 = tr/2 + disc, l2 = tr/2 - disc;
  let angle;
  if (Math.abs(b) < 1e-10) {
    angle = a >= d ? 0 : Math.PI/2;
  } else {
    angle = Math.atan2(l1 - a, b);
  }
  return { l1: Math.max(l1, 1e-8), l2: Math.max(l2, 1e-8), angle };
}

// Square root of SPD [[a,b],[b,d]] via eigen: A^{1/2} = V diag(√λ) Vᵀ
function sqrtM(a, b, d) {
  const { l1, l2, angle } = eig22(a, b, d);
  const s1 = Math.sqrt(l1), s2 = Math.sqrt(l2);
  const c = Math.cos(angle), s = Math.sin(angle);
  // V diag(s1,s2) Vᵀ
  const aa = s1*c*c + s2*s*s;
  const bb = (s1 - s2)*c*s;
  const dd = s1*s*s + s2*c*c;
  return [aa, bb, dd];
}

// Inverse of SPD
function invM(a, b, d) {
  const det = a*d - b*b;
  return [d/det, -b/det, a/det];
}

// Product of two 2×2 symmetric-ish matrices (result may not be symmetric)
// M×N as [a,b;c,d] × [e,f;g,h] — we track full 2×2
function mul22(A, B) {
  // A = [[A[0],A[1]],[A[2],A[3]]], B = [[B[0],B[1]],[B[2],B[3]]]
  return [
    A[0]*B[0] + A[1]*B[2], A[0]*B[1] + A[1]*B[3],
    A[2]*B[0] + A[3]*B[2], A[2]*B[1] + A[3]*B[3],
  ];
}

// Power of SPD (symmetric) to real t: M^t = V diag(λᵢ^t) Vᵀ
function powM(a, b, d, t) {
  const { l1, l2, angle } = eig22(a, b, d);
  const p1 = Math.pow(Math.max(l1, 1e-10), t);
  const p2 = Math.pow(Math.max(l2, 1e-10), t);
  const c = Math.cos(angle), s = Math.sin(angle);
  const aa = p1*c*c + p2*s*s;
  const bb = (p1 - p2)*c*s;
  const dd = p1*s*s + p2*c*c;
  return [aa, bb, dd];
}

// Symmetric full 2×2 [a,b,d] ↔ full [a,b,b,d]
const sym2full = ([a, b, d]) => [a, b, b, d];
const full2sym = ([a, b, c, d]) => [a, (b+c)/2, d];

// Geodesic γ(t) = A₀^{1/2} (A₀^{-1/2} A₁ A₀^{-1/2})^t A₀^{1/2}
function geodesic(A0, A1, t) {
  const S0   = sqrtM(...A0);        // A₀^{1/2}
  const S0i  = invM(...S0);         // A₀^{-1/2}
  // M = A₀^{-1/2} A₁ A₀^{-1/2}
  const S0iF = sym2full(S0i);
  const A1F  = sym2full(A1);
  const tmp  = mul22(S0iF, A1F);
  const M    = full2sym(mul22(tmp, S0iF));
  // M^t
  const Mt   = powM(...M, t);
  // S₀ M^t S₀
  const S0F  = sym2full(S0);
  const MtF  = sym2full(Mt);
  const res  = full2sym(mul22(mul22(S0F, MtF), S0F));
  return res;
}

// Draw ellipse corresponding to SPD matrix A at (cx,cy) with scale s
// The ellipse {x : xᵀA⁻¹x = 1} has semi-axes √λᵢ in eigenvector directions
function ellipsePath(a, b, d, cx, cy, scale) {
  const { l1, l2, angle } = eig22(a, b, d);
  const rx = Math.sqrt(l1) * scale, ry = Math.sqrt(l2) * scale;
  const deg = angle * 180 / Math.PI;
  return `M${cx},${cy} m${rx},0 a${rx},${ry},${deg},1,0,${-2*rx},0 a${rx},${ry},${deg},1,0,${2*rx},0`;
}

// A₀ = [[4,0],[0,1]], A₁ = [[1,1.2],[1.2,2]]
const A0 = [4, 0, 1];
const A1 = [1, 1.2, 2];

const N_STATIC = 7;
const W = 1600, H = 720;
const ELL_Y    = 240;
const ELL_SCALE = 58;
const ANIM_CX  = 800, ANIM_CY = 530, ANIM_SCALE = 110;
const STATIC_XS = Array.from({ length: N_STATIC }, (_, i) => 160 + i * 220);

export function SPDGeodesic() {
  const svgRef  = useRef(null);
  const animRef = useRef({ running: false, raf: null, startTime: null });

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

    // ── Static snapshot row ──────────────────────────────────
    STATIC_XS.forEach((cx, i) => {
      const t = i / (N_STATIC - 1);
      const At = geodesic(A0, A1, t);
      const { l1, l2 } = eig22(...At);
      const r1 = Math.sqrt(l1) * ELL_SCALE, r2 = Math.sqrt(l2) * ELL_SCALE;
      const { angle } = eig22(...At);
      const deg = angle * 180 / Math.PI;

      // Connecting line (geodesic backbone)
      if (i < N_STATIC - 1) {
        svg.append('line')
            .attr('x1', cx + r1 * 0.6).attr('y1', ELL_Y)
            .attr('x2', cx + 220 - r1 * 0.6).attr('y2', ELL_Y)
            .attr('stroke', ink3()).attr('stroke-width', 1)
            .attr('stroke-opacity', 0.2).attr('stroke-dasharray', '3,4');
      }

      const g = svg.append('g').attr('transform', `translate(${cx},${ELL_Y})`);
      // Shade fade from A0 (tint) to A1 (accent)
      const frac = t;
      g.append('ellipse').attr('rx', r1).attr('ry', r2)
          .attr('transform', `rotate(${deg})`)
          .attr('fill', tint()).attr('fill-opacity', 0.12 + frac * 0.05)
          .attr('stroke', i === 0 ? ink2() : i === N_STATIC-1 ? acc() : ink3())
          .attr('stroke-width', i === 0 || i === N_STATIC-1 ? 2.5 : 1.4)
          .attr('stroke-opacity', 0.6 + frac * 0.3);

      // t label
      svg.append('text').attr('x', cx).attr('y', ELL_Y + 90)
          .attr('text-anchor', 'middle').attr('font-family', 'var(--mono)')
          .attr('font-size', 17).attr('fill', ink3())
          .text(t === 0 ? 'A₀' : t === 1 ? 'A₁' : `t=${t.toFixed(2)}`);
    });

    // ── Axis labels for static row ────────────────────────────
    svg.append('text').attr('x', 800).attr('y', 40)
        .attr('text-anchor', 'middle').attr('font-family', 'var(--sans)')
        .attr('font-size', 28).attr('font-weight', 600).attr('fill', ink())
        .text('Geodesic γ(t) = A₀^½ (A₀^{-½} A₁ A₀^{-½})^t A₀^½  on  𝒮²₊₊');

    svg.append('text').attr('x', 800).attr('y', 90)
        .attr('text-anchor', 'middle').attr('font-family', 'var(--mono)')
        .attr('font-size', 18).attr('fill', ink3()).attr('letter-spacing', '0.04em')
        .text('A₀ = diag(4,1)  →  A₁ = [[1, 1.2], [1.2, 2]]');

    // Horizontal axis line
    svg.append('line')
        .attr('x1', 80).attr('y1', ELL_Y)
        .attr('x2', 1520).attr('y2', ELL_Y)
        .attr('stroke', ink3()).attr('stroke-width', 1).attr('stroke-opacity', 0.18);

    // ── Animated ellipse section ─────────────────────────────
    svg.append('line')
        .attr('x1', 60).attr('y1', 370)
        .attr('x2', 1540).attr('y2', 370)
        .attr('stroke', ink3()).attr('stroke-width', 1).attr('stroke-opacity', 0.12);

    svg.append('text').attr('x', 800).attr('y', 400)
        .attr('text-anchor', 'middle').attr('font-family', 'var(--sans)')
        .attr('font-size', 22).attr('font-weight', 600).attr('fill', ink2())
        .text('Continuous animation along geodesic');

    const animEll = svg.append('ellipse')
        .attr('cx', ANIM_CX).attr('cy', ANIM_CY)
        .attr('fill', acc()).attr('fill-opacity', 0.1)
        .attr('stroke', acc()).attr('stroke-width', 3);

    const animLabel = svg.append('text')
        .attr('x', ANIM_CX).attr('y', ANIM_CY + ANIM_SCALE + 52)
        .attr('text-anchor', 'middle').attr('font-family', 'var(--mono)')
        .attr('font-size', 20).attr('fill', ink2());

    // Eigenvalue labels
    const ev1Label = svg.append('text')
        .attr('text-anchor', 'middle').attr('font-family', 'var(--mono)')
        .attr('font-size', 17).attr('fill', ink3());
    const ev2Label = svg.append('text')
        .attr('text-anchor', 'middle').attr('font-family', 'var(--mono)')
        .attr('font-size', 17).attr('fill', ink3());

    // t-progress bar
    const BAR_X = 340, BAR_W = 920, BAR_Y = 680;
    svg.append('rect').attr('x', BAR_X).attr('y', BAR_Y - 3)
        .attr('width', BAR_W).attr('height', 6)
        .attr('fill', ink3()).attr('fill-opacity', 0.12).attr('rx', 3);
    const progFg = svg.append('rect').attr('x', BAR_X).attr('y', BAR_Y - 3)
        .attr('height', 6).attr('fill', acc()).attr('rx', 3);
    svg.append('text').attr('x', BAR_X - 10).attr('y', BAR_Y + 5)
        .attr('text-anchor', 'end').attr('font-family', 'var(--mono)')
        .attr('font-size', 16).attr('fill', ink3()).text('t=0');
    svg.append('text').attr('x', BAR_X + BAR_W + 10).attr('y', BAR_Y + 5)
        .attr('font-family', 'var(--mono)').attr('font-size', 16)
        .attr('fill', ink3()).text('t=1');

    const updateAnim = t => {
      const At = geodesic(A0, A1, t);
      const { l1, l2, angle } = eig22(...At);
      const rx = Math.sqrt(l1) * ANIM_SCALE;
      const ry = Math.sqrt(l2) * ANIM_SCALE;
      const deg = angle * 180 / Math.PI;
      animEll.attr('rx', rx).attr('ry', ry)
             .attr('transform', `rotate(${deg},${ANIM_CX},${ANIM_CY})`);
      animLabel.text(`t = ${t.toFixed(3)}`);
      progFg.attr('width', BAR_W * t);

      // Place eigenvalue labels at ellipse tips
      const c = Math.cos(angle), s = Math.sin(angle);
      ev1Label.attr('x', ANIM_CX + rx * c + 12).attr('y', ANIM_CY - rx * s)
              .text(`λ₁=${l1.toFixed(2)}`);
      ev2Label.attr('x', ANIM_CX - ry * s - 12).attr('y', ANIM_CY - ry * c - 10)
              .text(`λ₂=${l2.toFixed(2)}`);
    };
    updateAnim(0);

    const PERIOD = 4200; // ms for one pass
    const anim = animRef.current;

    const animate = () => {
      anim.running = true;
      anim.startTime = performance.now();
      const tick = (now) => {
        if (!anim.running) return;
        const elapsed = (now - anim.startTime) % (PERIOD * 2);
        const t = elapsed < PERIOD
          ? elapsed / PERIOD
          : 2 - elapsed / PERIOD;
        updateAnim(Math.max(0, Math.min(1, t)));
        anim.raf = requestAnimationFrame(tick);
      };
      anim.raf = requestAnimationFrame(tick);
    };
    const reset = () => {
      anim.running = false;
      if (anim.raf) { cancelAnimationFrame(anim.raf); anim.raf = null; }
      updateAnim(0);
    };

    const stage = document.querySelector('deck-stage');
    if (!stage) return;
    const onSlide = e => {
      const host = svgRef.current?.closest('spd-geodesic');
      if (!host) return;
      if (e.detail.slide?.contains(host))              animate();
      else if (e.detail.previousSlide?.contains(host)) reset();
    };
    stage.addEventListener('slidechange', onSlide);
    return () => {
      stage.removeEventListener('slidechange', onSlide);
      anim.running = false;
      if (anim.raf) cancelAnimationFrame(anim.raf);
    };
  }, []);

  return <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ display:'block' }} />;
}
