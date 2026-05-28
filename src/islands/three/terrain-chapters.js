// Chapter definitions for the Terrain Riemannian primer (deck island version).
// Panel text uses general/abstract notation — no terrain-specific formulas —
// to convey that every concept applies to *any* Riemannian manifold.
// The enter() visuals remain terrain-specific.

import * as THREE from 'three';
import * as T from './terrain-math.js';
import { buildArrow, buildPolyline, buildDot } from './scene.js';
import { buildTangentDisc } from './terrain-scene.js';

const P0 = new THREE.Vector2(-0.65, -0.15);
const Q0 = new THREE.Vector2(0.85, 0.65);
export const DEFAULTS = { P0, Q0 };

function lbl(ctx, text, position, opts) { return ctx.addLabel(text, position, opts); }

function pointMarker(uv, color, palette, r = 0.034) {
  const p = T.surfacePoint(uv.x, uv.y);
  const n = T.normalAt(uv.x, uv.y);
  p.addScaledVector(n, 0.005);
  return buildDot({ position: p, color, radius: r });
}

function tangentArrow(uv, w, color, scale = 1) {
  const p = T.surfacePoint(uv.x, uv.y);
  const n = T.normalAt(uv.x, uv.y);
  p.addScaledVector(n, 0.005);
  const dir = w.clone().multiplyScalar(scale);
  return buildArrow({
    origin: p, direction: dir, length: dir.length(), color,
    shaft: 0.007, head: 0.038, headLen: 0.075
  });
}

// ===========================================================================
// CH 1 — Any Riemannian manifold
// ===========================================================================
const ch1 = {
  id: 'manifold',
  eyebrow: 'Manifold',
  title: 'Any Riemannian manifold',
  body: `Everything we saw on S² generalises. A <em>Riemannian manifold</em>
    (ℳ, g) is any smooth space locally homeomorphic to ℝⁿ, equipped with a
    <em>smoothly varying inner product</em> g on each tangent space. This
    terrain — with hills, valleys, saddles — is one example among infinitely
    many. No symmetries are assumed.`,
  formula: String.raw`(\mathcal{M},\, g),\quad \dim \mathcal{M} = n,\\
    g_p : T_p\mathcal{M} \times T_p\mathcal{M} \to \mathbb{R}`,
  camera: { pos: [3.6, 2.8, 4.2], target: [0, 0.15, 0] },
  enter(ctx) {
    const ax = (from, to) => {
      const g = new THREE.BufferGeometry().setFromPoints([from, to]);
      return new THREE.Line(g, new THREE.LineBasicMaterial({
        color: ctx.palette.grid, transparent: true, opacity: 0.25,
      }));
    };
    ctx.group.add(ax(new THREE.Vector3(0, 0, 0), new THREE.Vector3(2.4, 0, 0)));
    ctx.group.add(ax(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1.4, 0)));
    ctx.group.add(ax(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 2.4)));
    lbl(ctx, 'u', new THREE.Vector3(2.50, 0, 0), { dim: true });
    lbl(ctx, 'h', new THREE.Vector3(0, 1.45, 0), { dim: true });
    lbl(ctx, 'v', new THREE.Vector3(0, 0, 2.50), { dim: true });
    lbl(ctx, 'ℳ', new THREE.Vector3(-0.7, T.h(-0.7, -0.55) + 0.42, -0.55),
      { italic: true, accent: true });
    return { autoRotate: 0.03 };
  },
};

// ===========================================================================
// CH 2 — Tangent space T_p ℳ
// ===========================================================================
const ch2 = {
  id: 'tangent',
  eyebrow: 'Tangent space',
  title: 'Tₚ ℳ',
  body: `At each p ∈ ℳ the <em>tangent space</em> T<sub>p</sub>ℳ is a
    vector space of the same dimension as ℳ. Tangent vectors are the
    velocities of smooth curves through p. Gradients, descent directions,
    and updates all live here. The basis vectors r<sub>u</sub>, r<sub>v</sub>
    span T<sub>p</sub>ℳ for this surface.`,
  formula: String.raw`T_p\mathcal{M} \;=\; \bigl\{\, \dot\gamma(0) : \gamma \;\text{smooth},\;
    \gamma(0) = p \bigr\}`,
  camera: { pos: [2.4, 2.1, 2.9], target: [-0.3, 0.3, 0] },
  pickable: true,
  enter(ctx) {
    const palette = ctx.palette;
    const stateP = ctx.p.clone();

    const disc = buildTangentDisc({ uv: stateP, radius: 0.62, palette });
    ctx.group.add(disc);

    const [ru, rv] = T.basis(stateP.x, stateP.y);
    const aU = tangentArrow(stateP, ru, palette.tangent, 0.55);
    const aV = tangentArrow(stateP, rv, palette.tangent, 0.55);
    ctx.group.add(aU); ctx.group.add(aV);

    const n = T.normalAt(stateP.x, stateP.y);
    const aN = tangentArrow(stateP, n, palette.geodesic, 0.5);
    ctx.group.add(aN);

    const dotP = pointMarker(stateP, palette.p, palette);
    ctx.group.add(dotP);

    const pp = T.surfacePoint(stateP.x, stateP.y);
    const lblP = lbl(ctx, 'p', pp.clone().add(new THREE.Vector3(0.03, 0.07, 0)), { accent: true });
    const lblRU = lbl(ctx, 'r<sub>u</sub>', pp.clone().addScaledVector(ru, 0.62).add(new THREE.Vector3(0, 0.06, 0.02)), { tangent: true });
    const lblRV = lbl(ctx, 'r<sub>v</sub>', pp.clone().addScaledVector(rv, 0.62).add(new THREE.Vector3(0.02, 0.04, 0.04)), { tangent: true });
    const lblN = lbl(ctx, 'n', pp.clone().addScaledVector(n, 0.55).add(new THREE.Vector3(0.04, 0.05, 0.0)), { geo: true });

    function refresh() {
      disc.userData.update(stateP);
      const [ru1, rv1] = T.basis(stateP.x, stateP.y);
      const n1 = T.normalAt(stateP.x, stateP.y);
      const p1 = T.surfacePoint(stateP.x, stateP.y).addScaledVector(n1, 0.005);
      aU.userData.update(p1, ru1.clone().multiplyScalar(0.55), 0.55 * ru1.length());
      aV.userData.update(p1, rv1.clone().multiplyScalar(0.55), 0.55 * rv1.length());
      aN.userData.update(p1, n1.clone(), 0.50);
      dotP.position.copy(p1);
      lblP.update(p1.clone().add(new THREE.Vector3(0.03, 0.07, 0)));
      lblRU.update(p1.clone().addScaledVector(ru1, 0.55).add(new THREE.Vector3(0, 0.06, 0.02)));
      lblRV.update(p1.clone().addScaledVector(rv1, 0.55).add(new THREE.Vector3(0.02, 0.04, 0.04)));
      lblN.update(p1.clone().addScaledVector(n1, 0.55).add(new THREE.Vector3(0.04, 0.05, 0.0)));
    }
    return { onPick(uv) { stateP.copy(uv); ctx.p.copy(uv); refresh(); } };
  },
};

// ===========================================================================
// CH 3 — Riemannian metric g
// ===========================================================================
const ch3 = {
  id: 'metric',
  eyebrow: 'Metric',
  title: 'The Riemannian metric',
  body: `The metric g<sub>p</sub> is a <em>smooth, positive-definite, symmetric
    bilinear form</em> on T<sub>p</sub>ℳ. It defines lengths of curves, angles
    between tangent vectors, and geodesic distances. The metric varies from
    point to point — that is what makes the geometry non-trivially curved.
    The unit-g ellipse (orange) differs from the Euclidean circle (grey).`,
  formula: String.raw`g_p(u,u) > 0 \;\; \forall\, u \ne 0,\\
    \|v\|_p = \sqrt{g_p(v,v)},\qquad g_p \in C^\infty`,
  camera: { pos: [2.5, 2.2, 2.8], target: [-0.2, 0.25, 0.05] },
  pickable: true,
  enter(ctx) {
    const palette = ctx.palette;
    const stateP = ctx.p.clone();
    const disc = buildTangentDisc({ uv: stateP, radius: 0.55, palette });
    ctx.group.add(disc);
    const parGroup = new THREE.Group();
    ctx.group.add(parGroup);
    const indicGroup = new THREE.Group();
    ctx.group.add(indicGroup);
    const dotP = pointMarker(stateP, palette.p, palette);
    ctx.group.add(dotP);
    const lblP = lbl(ctx, 'p', T.surfacePoint(stateP.x, stateP.y).add(new THREE.Vector3(0.03, 0.07, 0)), { accent: true });
    const lblG = lbl(ctx, '', new THREE.Vector3(), { small: true, dim: true });

    function refresh() {
      disc.userData.update(stateP);
      while (parGroup.children.length) { const c = parGroup.children.pop(); c.geometry?.dispose(); c.material?.dispose(); }
      while (indicGroup.children.length) { const c = indicGroup.children.pop(); c.geometry?.dispose(); c.material?.dispose(); }
      const p = T.surfacePoint(stateP.x, stateP.y);
      const n = T.normalAt(stateP.x, stateP.y);
      const pLift = p.clone().addScaledVector(n, 0.006);
      dotP.position.copy(pLift);
      lblP.update(pLift.clone().add(new THREE.Vector3(0.03, 0.07, 0)));
      const [ru, rv] = T.basis(stateP.x, stateP.y);
      const Lstep = 0.55;
      const stepU = ru.clone().multiplyScalar(Lstep);
      const stepV = rv.clone().multiplyScalar(Lstep);
      parGroup.add(buildArrow({
        origin: pLift, direction: stepU, length: stepU.length(),
        color: palette.tangent, shaft: 0.007, head: 0.032, headLen: 0.070
      }));
      parGroup.add(buildArrow({
        origin: pLift, direction: stepV, length: stepV.length(),
        color: palette.tangent, shaft: 0.007, head: 0.032, headLen: 0.070
      }));
      const m = T.metric(stateP.x, stateP.y);
      const R = 0.55, Npts = 128;
      const paramCircle = [], gEllipse = [];
      for (let i = 0; i <= Npts; i++) {
        const th = (i / Npts) * Math.PI * 2;
        const a = R * Math.cos(th), b = R * Math.sin(th);
        const wEuc = ru.clone().multiplyScalar(a).addScaledVector(rv, b);
        paramCircle.push(pLift.clone().add(wEuc));
        const denom = Math.sqrt(m.E * Math.cos(th) ** 2 + 2 * m.F * Math.cos(th) * Math.sin(th) + m.G * Math.sin(th) ** 2);
        const r2 = R / denom;
        const aa = r2 * Math.cos(th), bb = r2 * Math.sin(th);
        const wG = ru.clone().multiplyScalar(aa).addScaledVector(rv, bb);
        gEllipse.push(pLift.clone().add(wG));
      }
      indicGroup.add(buildPolyline({ points: paramCircle, color: palette.ink3Num, opacity: 0.6 }));
      indicGroup.add(buildPolyline({ points: gEllipse, color: palette.geodesic, opacity: 0.95 }));
      lblG.setText(`E = ${m.E.toFixed(2)}  F = ${m.F.toFixed(2)}  G = ${m.G.toFixed(2)}`);
      lblG.update(pLift.clone().add(new THREE.Vector3(0.05, 0.38, 0.05)));
    }
    refresh();
    return { onPick(uv) { stateP.copy(uv); ctx.p.copy(uv); refresh(); } };
  },
};

// ===========================================================================
// CH 4 — Geodesic
// ===========================================================================
const ch4 = {
  id: 'geodesic',
  eyebrow: 'Geodesic',
  title: 'The straightest curve',
  body: `A <em>geodesic</em> is a curve with vanishing covariant acceleration:
    it does not "turn" within the manifold. Geodesics locally minimise arc
    length and generalise straight lines. On ℳ their shape is dictated by the
    Christoffel symbols Γ — the "correction" terms the curvature requires. The
    ambient straight segment (grey) slices through the surface instead.`,
  formula: String.raw`\nabla_{\dot\gamma}\dot\gamma = 0,\qquad
    \ddot u^k + \Gamma^k_{ij}\,\dot u^i\dot u^j = 0`,
  camera: { pos: [2.3, 2.6, 3.6], target: [0.05, 0.25, 0.10] },
  pickable: 'q',
  enter(ctx) {
    const palette = ctx.palette;
    const stateP = ctx.p.clone(), stateQ = ctx.q.clone();
    const dotP = pointMarker(stateP, palette.p, palette); ctx.group.add(dotP);
    const dotQ = pointMarker(stateQ, palette.q, palette); ctx.group.add(dotQ);
    const lblP = lbl(ctx, 'p', T.surfacePoint(stateP.x, stateP.y).add(new THREE.Vector3(0.03, 0.08, 0)), { accent: true });
    const lblQ = lbl(ctx, 'q', T.surfacePoint(stateQ.x, stateQ.y).add(new THREE.Vector3(0.03, 0.08, 0)), { q: true });
    let lineAmbient = buildPolyline({ points: [new THREE.Vector3()], color: palette.euclid, opacity: 0.95 });
    let lineDrop = buildPolyline({ points: [new THREE.Vector3()], color: palette.euclid, opacity: 0.55, dashed: true });
    let lineGeo = buildPolyline({ points: [new THREE.Vector3()], color: palette.geodesic, opacity: 1.0 });
    ctx.group.add(lineAmbient); ctx.group.add(lineDrop); ctx.group.add(lineGeo);
    const lblGeo = lbl(ctx, 'geodesic', new THREE.Vector3(), { geo: true, small: true });
    const lblAmb = lbl(ctx, 'ambient', new THREE.Vector3(), { small: true, dim: true });

    function refresh() {
      const pW = T.surfacePoint(stateP.x, stateP.y);
      const qW = T.surfacePoint(stateQ.x, stateQ.y);
      dotP.position.copy(pW.clone().addScaledVector(T.normalAt(stateP.x, stateP.y), 0.005));
      dotQ.position.copy(qW.clone().addScaledVector(T.normalAt(stateQ.x, stateQ.y), 0.005));
      lblP.update(pW.clone().add(new THREE.Vector3(0.03, 0.08, 0)));
      lblQ.update(qW.clone().add(new THREE.Vector3(0.03, 0.08, 0)));
      const ambPts = [], dropPts = [], N = 80;
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const w = pW.clone().lerp(qW, t);
        ambPts.push(w.clone());
        dropPts.push(new THREE.Vector3(w.x, T.h(w.x, w.z) + 0.003, w.z));
      }
      lineAmbient.userData.update(ambPts);
      lineDrop.userData.update(dropPts);
      const v = T.logMap(stateP, stateQ);
      const duv = T.worldToParam(stateP, v);
      const r = T.traceGeodesic(stateP, duv, 1, 96);
      const lifted = r.points.map((pp) => new THREE.Vector3(pp.x, pp.y + 0.005, pp.z));
      lineGeo.userData.update(lifted);
      lblGeo.update(lifted[Math.floor(lifted.length / 2)].clone().add(new THREE.Vector3(0, 0.10, 0)));
      lblAmb.update(ambPts[Math.floor(ambPts.length / 2)].clone().add(new THREE.Vector3(0, 0.10, 0)));
    }
    refresh();
    return { onPick(uv) { stateQ.copy(uv); ctx.q.copy(uv); refresh(); } };
  },
};

// ===========================================================================
// CH 5 — Exponential map
// ===========================================================================
const ch5 = {
  id: 'exp',
  eyebrow: 'Exp map',
  title: 'expₚ',
  body: `The exponential map <em>exp<sub>p</sub> : T<sub>p</sub>ℳ → ℳ</em> wraps
    the tangent space onto the manifold: exp<sub>p</sub>(v) is the point reached
    by following the geodesic from p in direction v for unit time. It linearises
    the geometry around any base point. Many geodesics radiate from p — a fan
    of them is shown for context.`,
  formula: String.raw`\exp_p(v) = \gamma_v(1),\quad \dot\gamma_v(0) = v,\quad \exp_p(0) = p`,
  camera: { pos: [2.2, 2.3, 3.1], target: [-0.15, 0.30, 0.05] },
  pickable: true,
  controlSchema: {
    angle: { label: 'angle', min: 0, max: 6.28, step: 0.01, value: 0.7 },
    length: { label: 'length', min: 0.1, max: 1.4, step: 0.01, value: 0.95 },
  },
  enter(ctx) {
    const palette = ctx.palette;
    const stateP = ctx.p.clone();
    const params = { angle: 0.7, length: 0.95 };
    const disc = buildTangentDisc({ uv: stateP, radius: 0.62, palette });
    ctx.group.add(disc);
    const dotP = pointMarker(stateP, palette.p, palette); ctx.group.add(dotP);
    const dotExp = pointMarker(new THREE.Vector2(0, 0), palette.q, palette); ctx.group.add(dotExp);
    const lblP = lbl(ctx, 'p', new THREE.Vector3(), { accent: true });
    const lblExp = lbl(ctx, 'exp<sub>p</sub>(v)', new THREE.Vector3(), { q: true, small: true });
    const lblV = lbl(ctx, 'v', new THREE.Vector3(), { tangent: true });
    let arrowV = tangentArrow(stateP, new THREE.Vector3(0.1, 0, 0), palette.tangent, 1);
    ctx.group.add(arrowV);
    let geo = buildPolyline({ points: [new THREE.Vector3()], color: palette.geodesic, opacity: 1 });
    ctx.group.add(geo);
    const fan = new THREE.Group();
    ctx.group.add(fan);

    function refresh() {
      while (fan.children.length) { const c = fan.children.pop(); c.geometry?.dispose(); c.material?.dispose(); }
      disc.userData.update(stateP);
      const p = T.surfacePoint(stateP.x, stateP.y);
      const n = T.normalAt(stateP.x, stateP.y);
      const pLift = p.clone().addScaledVector(n, 0.006);
      dotP.position.copy(pLift);
      lblP.update(pLift.clone().add(new THREE.Vector3(0.03, 0.08, 0)));
      const [e1, e2] = T.orthoFrame(stateP);
      const dirW = e1.clone().multiplyScalar(Math.cos(params.angle))
        .addScaledVector(e2, Math.sin(params.angle)).multiplyScalar(params.length);
      arrowV.userData.update(pLift, dirW.clone(), dirW.length());
      lblV.update(pLift.clone().addScaledVector(dirW, 0.65).add(new THREE.Vector3(0.02, 0.06, 0)));
      const duv = T.worldToParam(stateP, dirW);
      const r = T.traceGeodesic(stateP, duv, 1, 96);
      const lifted = r.points.map((pp) => new THREE.Vector3(pp.x, pp.y + 0.005, pp.z));
      geo.userData.update(lifted);
      const end = lifted[lifted.length - 1];
      dotExp.position.copy(end);
      lblExp.update(end.clone().add(new THREE.Vector3(0.03, 0.08, 0)));
      const Nrays = 16;
      for (let i = 0; i < Nrays; i++) {
        const th = (i / Nrays) * Math.PI * 2;
        const d = e1.clone().multiplyScalar(Math.cos(th)).addScaledVector(e2, Math.sin(th)).multiplyScalar(0.95);
        const duvi = T.worldToParam(stateP, d);
        const ri = T.traceGeodesic(stateP, duvi, 1, 48);
        const pts = ri.points.map((pp) => new THREE.Vector3(pp.x, pp.y + 0.002, pp.z));
        fan.add(buildPolyline({ points: pts, color: palette.geodesic, opacity: 0.20 }));
      }
    }
    refresh();
    return {
      onPick(uv) { stateP.copy(uv); ctx.p.copy(uv); refresh(); },
      onControl(name, value) { params[name] = value; refresh(); },
    };
  },
};

// ===========================================================================
// CH 6 — Log map
// ===========================================================================
const ch6 = {
  id: 'log',
  eyebrow: 'Log map',
  title: 'logₚ',
  body: `The logarithmic map is the local inverse of exp<sub>p</sub>. Given q
    close to p, <em>log<sub>p</sub>(q)</em> is the tangent vector that shoots
    a geodesic from p to q in unit time. Its norm equals the geodesic distance
    d(p, q). No closed form exists for a generic ℳ — a shooting Newton
    iteration recovers it numerically.`,
  formula: String.raw`\log_p(q) \in T_p\mathcal{M},\quad
    d(p,q) = \bigl\|\log_p(q)\bigr\|_p,\quad \exp_p\!\bigl(\log_p(q)\bigr) = q`,
  camera: { pos: [2.4, 2.4, 3.3], target: [0.05, 0.25, 0.05] },
  pickable: 'q',
  enter(ctx) {
    const palette = ctx.palette;
    const stateP = ctx.p.clone(), stateQ = ctx.q.clone();
    const disc = buildTangentDisc({ uv: stateP, radius: 0.62, palette });
    ctx.group.add(disc);
    const dotP = pointMarker(stateP, palette.p, palette); ctx.group.add(dotP);
    const dotQ = pointMarker(stateQ, palette.q, palette); ctx.group.add(dotQ);
    const lblP = lbl(ctx, 'p', new THREE.Vector3(), { accent: true });
    const lblQ = lbl(ctx, 'q', new THREE.Vector3(), { q: true });
    const lblV = lbl(ctx, 'log<sub>p</sub>(q)', new THREE.Vector3(), { tangent: true, small: true });
    const lblD = lbl(ctx, '', new THREE.Vector3(), { small: true, dim: true });
    let arrowV = tangentArrow(stateP, new THREE.Vector3(0.1, 0, 0), palette.tangent);
    ctx.group.add(arrowV);
    let geo = buildPolyline({ points: [new THREE.Vector3()], color: palette.geodesic, opacity: 1 });
    ctx.group.add(geo);

    function refresh() {
      disc.userData.update(stateP);
      const pW = T.surfacePoint(stateP.x, stateP.y);
      const qW = T.surfacePoint(stateQ.x, stateQ.y);
      const nP = T.normalAt(stateP.x, stateP.y), nQ = T.normalAt(stateQ.x, stateQ.y);
      const pLift = pW.clone().addScaledVector(nP, 0.005);
      const qLift = qW.clone().addScaledVector(nQ, 0.005);
      dotP.position.copy(pLift); dotQ.position.copy(qLift);
      lblP.update(pLift.clone().add(new THREE.Vector3(0.03, 0.08, 0)));
      lblQ.update(qLift.clone().add(new THREE.Vector3(0.03, 0.08, 0)));
      const v = T.logMap(stateP, stateQ);
      arrowV.userData.update(pLift, v.clone(), v.length());
      lblV.update(pLift.clone().addScaledVector(v, 0.55).add(new THREE.Vector3(0.04, 0.06, 0)));
      const duv = T.worldToParam(stateP, v);
      const r = T.traceGeodesic(stateP, duv, 1, 96);
      const lifted = r.points.map((pp) => new THREE.Vector3(pp.x, pp.y + 0.005, pp.z));
      geo.userData.update(lifted);
      const d = T.gNorm(stateP, duv);
      lblD.setText(`d(p, q) = ${d.toFixed(3)}`);
      lblD.update(pLift.clone().add(new THREE.Vector3(0.0, 0.55, 0.0)));
    }
    refresh();
    return { onPick(uv) { stateQ.copy(uv); ctx.q.copy(uv); refresh(); } };
  },
};

// ===========================================================================
// CH 7 — Retraction
// ===========================================================================
const ch7 = {
  id: 'retract',
  eyebrow: 'Retraction',
  title: 'Retraction Rₚ',
  body: `Computing exp<sub>p</sub> requires integrating a geodesic ODE. For
    iterative algorithms a first-order substitute suffices: a <em>retraction</em>
    R<sub>p</sub> : T<sub>p</sub>ℳ → ℳ that agrees with exp<sub>p</sub> to first
    order at 0. On this surface, one cheap retraction is "step in ℝ³, project
    back onto ℳ" (drop back to the height h). Compare the two endpoints.`,
  formula: String.raw`R_p(0) = p,\quad \mathrm{d}R_p|_0 = \mathrm{id},\quad
    R_p(v) = \exp_p(v) + O(\|v\|^2)`,
  camera: { pos: [2.2, 2.3, 3.1], target: [-0.15, 0.30, 0.05] },
  pickable: true,
  controlSchema: {
    angle: { label: 'angle', min: 0, max: 6.28, step: 0.01, value: 1.2 },
    length: { label: 'length', min: 0.1, max: 1.4, step: 0.01, value: 0.9 },
  },
  enter(ctx) {
    const palette = ctx.palette;
    const stateP = ctx.p.clone();
    const params = { angle: 1.2, length: 0.9 };
    const disc = buildTangentDisc({ uv: stateP, radius: 0.62, palette });
    ctx.group.add(disc);
    const dotP = pointMarker(stateP, palette.p, palette); ctx.group.add(dotP);
    const dotExp = pointMarker(new THREE.Vector2(0, 0), palette.q, palette); ctx.group.add(dotExp);
    const dotR = pointMarker(new THREE.Vector2(0, 0), palette.retraction, palette); ctx.group.add(dotR);
    const lblP = lbl(ctx, 'p', new THREE.Vector3(), { accent: true });
    const lblE = lbl(ctx, 'exp<sub>p</sub>(v)', new THREE.Vector3(), { q: true, small: true });
    const lblR = lbl(ctx, 'R<sub>p</sub>(v)', new THREE.Vector3(), { retract: true, small: true });
    const lblV = lbl(ctx, 'v', new THREE.Vector3(), { tangent: true });
    let arrowV = tangentArrow(stateP, new THREE.Vector3(0.1, 0, 0), palette.tangent);
    ctx.group.add(arrowV);
    let geo = buildPolyline({ points: [new THREE.Vector3()], color: palette.geodesic, opacity: 1 });
    ctx.group.add(geo);
    let amb = buildPolyline({ points: [new THREE.Vector3()], color: palette.retraction, opacity: 0.8, dashed: true });
    ctx.group.add(amb);
    let drop = buildPolyline({ points: [new THREE.Vector3()], color: palette.retraction, opacity: 0.5 });
    ctx.group.add(drop);

    function refresh() {
      disc.userData.update(stateP);
      const p = T.surfacePoint(stateP.x, stateP.y);
      const n = T.normalAt(stateP.x, stateP.y);
      const pLift = p.clone().addScaledVector(n, 0.005);
      dotP.position.copy(pLift);
      lblP.update(pLift.clone().add(new THREE.Vector3(0.03, 0.08, 0)));
      const [e1, e2] = T.orthoFrame(stateP);
      const dirW = e1.clone().multiplyScalar(Math.cos(params.angle))
        .addScaledVector(e2, Math.sin(params.angle)).multiplyScalar(params.length);
      arrowV.userData.update(pLift, dirW.clone(), dirW.length());
      lblV.update(pLift.clone().addScaledVector(dirW, 0.55).add(new THREE.Vector3(0.03, 0.06, 0)));
      const duv = T.worldToParam(stateP, dirW);
      const r = T.traceGeodesic(stateP, duv, 1, 96);
      const lifted = r.points.map((pp) => new THREE.Vector3(pp.x, pp.y + 0.004, pp.z));
      geo.userData.update(lifted);
      const eEnd = lifted[lifted.length - 1];
      dotExp.position.copy(eEnd);
      lblE.update(eEnd.clone().add(new THREE.Vector3(0.03, 0.08, 0)));
      const ret = T.retract(stateP, dirW);
      const retLift = ret.point.clone().addScaledVector(T.normalAt(ret.uv.x, ret.uv.y), 0.005);
      dotR.position.copy(retLift);
      lblR.update(retLift.clone().add(new THREE.Vector3(0.03, 0.06, 0)));
      const tip = p.clone().add(dirW);
      amb.userData.update([pLift, tip]);
      drop.userData.update([tip, retLift]);
    }
    refresh();
    return {
      onPick(uv) { stateP.copy(uv); ctx.p.copy(uv); refresh(); },
      onControl(name, value) { params[name] = value; refresh(); },
    };
  },
};

// ===========================================================================
// CH 8 — Parallel transport
// ===========================================================================
const ch8 = {
  id: 'transport',
  eyebrow: 'Parallel transport',
  title: 'Sliding a vector',
  body: `Moving a vector from T<sub>p</sub>ℳ to T<sub>q</sub>ℳ by naive
    translation breaks tangency. The <em>Levi-Civita connection</em> defines the
    canonical transport that preserves lengths and angles — compatible with the
    metric and with the geodesic structure. Slide the progress control to watch
    W(t) travel along the geodesic, staying tangent and keeping its norm.`,
  formula: String.raw`\nabla_{\dot\gamma} W = 0,\qquad
    \bigl\|W(t)\bigr\|_{\gamma(t)} = \mathrm{const}`,
  camera: { pos: [2.7, 2.4, 3.4], target: [0.05, 0.30, 0.10] },
  pickable: 'q',
  controlSchema: {
    t: { label: 'progress', min: 0, max: 1, step: 0.005, value: 1.0 },
  },
  enter(ctx) {
    const palette = ctx.palette;
    const stateP = ctx.p.clone(), stateQ = ctx.q.clone();
    const params = { t: 1.0 };
    const dotP = pointMarker(stateP, palette.p, palette); ctx.group.add(dotP);
    const dotQ = pointMarker(stateQ, palette.q, palette); ctx.group.add(dotQ);
    const dotNow = pointMarker(stateP, palette.transport, palette, 0.028); ctx.group.add(dotNow);
    const lblP = lbl(ctx, 'p', new THREE.Vector3(), { accent: true });
    const lblQ = lbl(ctx, 'q', new THREE.Vector3(), { q: true });
    const lblW = lbl(ctx, 'W(0)', new THREE.Vector3(), { transport: true, small: true });
    const lblWt = lbl(ctx, 'W(t)', new THREE.Vector3(), { transport: true, small: true });
    let geo = buildPolyline({ points: [new THREE.Vector3()], color: palette.geodesic, opacity: 0.85 });
    ctx.group.add(geo);
    let initialArrow = tangentArrow(stateP, new THREE.Vector3(0.1, 0, 0), palette.transport);
    let movingArrow = tangentArrow(stateP, new THREE.Vector3(0.1, 0, 0), palette.transport);
    ctx.group.add(initialArrow); ctx.group.add(movingArrow);
    let ghost = tangentArrow(stateQ, new THREE.Vector3(0.1, 0, 0), palette.ink3Num);
    ctx.group.add(ghost);
    let cachedPath = null, cachedW = null, cachedPts = null, cachedDt = null;

    function recompute() {
      const v = T.logMap(stateP, stateQ);
      const duv = T.worldToParam(stateP, v);
      const r = T.traceGeodesic(stateP, duv, 1, 96);
      cachedPath = r.path; cachedDt = r.dt; cachedPts = r.points;
      const initParam = new THREE.Vector2(duv.x, duv.y);
      const W0 = new THREE.Vector2(-initParam.y, initParam.x);
      const gn = T.gNorm(stateP, W0);
      W0.multiplyScalar(0.55 / Math.max(gn, 1e-6));
      cachedW = T.parallelTransport(cachedPath, cachedDt, W0);
    }

    function refresh() {
      const pW = T.surfacePoint(stateP.x, stateP.y);
      const qW = T.surfacePoint(stateQ.x, stateQ.y);
      const nP = T.normalAt(stateP.x, stateP.y), nQ = T.normalAt(stateQ.x, stateQ.y);
      const pLift = pW.clone().addScaledVector(nP, 0.005);
      const qLift = qW.clone().addScaledVector(nQ, 0.005);
      dotP.position.copy(pLift); dotQ.position.copy(qLift);
      lblP.update(pLift.clone().add(new THREE.Vector3(0.03, 0.08, 0)));
      lblQ.update(qLift.clone().add(new THREE.Vector3(0.03, 0.08, 0)));
      recompute();
      const lifted = cachedPts.map(pp => new THREE.Vector3(pp.x, pp.y + 0.004, pp.z));
      geo.userData.update(lifted);
      const W0 = cachedW[0];
      const w0World = T.paramToWorld(stateP, new THREE.Vector2(W0.Wu, W0.Wv));
      initialArrow.userData.update(pLift, w0World.clone(), w0World.length());
      lblW.update(pLift.clone().addScaledVector(w0World, 0.55).add(new THREE.Vector3(0.03, 0.06, 0)));
      const idx = Math.min(cachedPath.length - 1, Math.round(params.t * (cachedPath.length - 1)));
      const ss = cachedPath[idx], ww = cachedW[idx];
      const pos = T.surfacePoint(ss.u, ss.v).addScaledVector(T.normalAt(ss.u, ss.v), 0.006);
      const wWorld = T.paramToWorld(new THREE.Vector2(ss.u, ss.v), new THREE.Vector2(ww.Wu, ww.Wv));
      movingArrow.userData.update(pos, wWorld.clone(), wWorld.length());
      dotNow.position.copy(pos);
      lblWt.update(pos.clone().addScaledVector(wWorld, 0.55).add(new THREE.Vector3(0.03, 0.06, 0)));
      ghost.userData.update(qLift, w0World.clone(), w0World.length());
    }
    refresh();
    return {
      onPick(uv) { stateQ.copy(uv); ctx.q.copy(uv); refresh(); },
      onControl(name, value) { params[name] = value; refresh(); },
    };
  },
};

// ===========================================================================
// CH 9 — Curvature
// ===========================================================================
const ch9 = {
  id: 'curvature',
  eyebrow: 'Curvature',
  title: 'Curvature K',
  body: `The Riemann curvature tensor is the intrinsic invariant measuring
    deviation from flatness. Geodesics <em>converge</em> where K > 0 (hilltops,
    valley bottoms) and <em>diverge</em> where K < 0 (saddles). The terrain is
    recoloured by K — warm = positive, cool = negative. The holonomy of a small
    loop equals ∫K dA (Gauss–Bonnet in miniature).`,
  formula: String.raw`K = \frac{R_{1212}}{g_{11}g_{22}-g_{12}^{2}},\\
    \iint_D K\,\mathrm{d}A = 2\pi - \oint_{\partial D}\kappa_g\,\mathrm{d}s`,
  camera: { pos: [2.5, 2.9, 3.6], target: [0.0, 0.20, 0.05] },
  pickable: true,
  wantCurvatureSurface: true,
  enter(ctx) {
    const palette = ctx.palette;
    const stateP = ctx.p.clone();
    const dotP = pointMarker(stateP, palette.p, palette); ctx.group.add(dotP);
    const lblP = lbl(ctx, 'p', new THREE.Vector3(), { accent: true });
    const lblK = lbl(ctx, '', new THREE.Vector3(), { small: true, dim: true });
    const radius = 0.30;
    const loop = buildPolyline({ points: [new THREE.Vector3()], color: palette.transport, opacity: 0.9 });
    ctx.group.add(loop);
    const arrowStart = tangentArrow(stateP, new THREE.Vector3(0.1, 0, 0), palette.transport);
    const arrowEnd = tangentArrow(stateP, new THREE.Vector3(0.1, 0, 0), palette.tangent);
    ctx.group.add(arrowStart); ctx.group.add(arrowEnd);
    const lblHol = lbl(ctx, '', new THREE.Vector3(), { transport: true, small: true });

    function refresh() {
      const p = T.surfacePoint(stateP.x, stateP.y);
      const n = T.normalAt(stateP.x, stateP.y);
      const pLift = p.clone().addScaledVector(n, 0.006);
      dotP.position.copy(pLift);
      lblP.update(pLift.clone().add(new THREE.Vector3(0.03, 0.08, 0)));
      const K = T.gaussCurvature(stateP.x, stateP.y);
      lblK.setText(`K(p) = ${K.toFixed(3)}`);
      lblK.update(pLift.clone().add(new THREE.Vector3(0.0, 0.55, 0.05)));
      const r = radius;
      const corners = [
        new THREE.Vector2(stateP.x + r, stateP.y + 0),
        new THREE.Vector2(stateP.x + 0, stateP.y + r),
        new THREE.Vector2(stateP.x - r, stateP.y + 0),
        new THREE.Vector2(stateP.x + 0, stateP.y - r),
      ];
      let currentP = stateP.clone();
      let currentW = new THREE.Vector2(1, 0);
      const startWorld = T.paramToWorld(stateP, currentW.clone().multiplyScalar(0.5));
      arrowStart.userData.update(pLift, startWorld.clone(), startWorld.length());
      const loopPts = [];
      for (let i = 0; i <= corners.length; i++) {
        const targ = corners[i % corners.length];
        const v = T.logMap(currentP, targ);
        const duv = T.worldToParam(currentP, v);
        const seg = T.traceGeodesic(currentP, duv, 1, 24);
        for (const pt of seg.points) loopPts.push(new THREE.Vector3(pt.x, pt.y + 0.006, pt.z));
        const Wseries = T.parallelTransport(seg.path, seg.dt, currentW);
        currentW.set(Wseries[Wseries.length - 1].Wu, Wseries[Wseries.length - 1].Wv);
        currentP.set(targ.x, targ.y);
      }
      loop.userData.update(loopPts);
      const endWorld = T.paramToWorld(stateP, currentW.clone().multiplyScalar(0.5));
      arrowEnd.userData.update(pLift, endWorld.clone(), endWorld.length());
      const sw = startWorld.clone().normalize(), ew = endWorld.clone().normalize();
      const cosA = THREE.MathUtils.clamp(sw.dot(ew), -1, 1);
      const sinA = new THREE.Vector3().crossVectors(sw, ew).dot(n);
      const ang = Math.atan2(sinA, cosA);
      lblHol.setText(`holonomy ≈ ${(ang * 180 / Math.PI).toFixed(1)}°`);
      lblHol.update(pLift.clone().add(new THREE.Vector3(0.0, 0.42, 0.0)));
    }
    refresh();
    return {
      onPick(uv) {
        const padded = T.clampDomain(uv, 0.45);
        stateP.copy(padded); ctx.p.copy(padded); refresh();
      },
    };
  },
};

export const CHAPTERS = [ch1, ch2, ch3, ch4, ch5, ch6, ch7, ch8, ch9];
