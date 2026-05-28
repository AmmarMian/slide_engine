// Chapter definitions for the Riemannian Geometry primer on S².
// Each chapter declares: title text, body prose, KaTeX formula(s), camera
// pose, and {enter, exit} lifecycle hooks that build/teardown THREE objects
// in a shared chapterGroup.

import * as THREE from 'three';
import * as M from './math.js';
import {
  buildArrow, buildPolyline, buildDot, buildTangentPlane,
} from './scene.js';

// shared default points used across chapters
const P0 = M.fromLatLon(THREE.MathUtils.degToRad(28), THREE.MathUtils.degToRad(22));
const Q0 = M.fromLatLon(THREE.MathUtils.degToRad(8), THREE.MathUtils.degToRad(78));

// Re-orient a Y-up arrow group at origin to point along direction `dir` from origin `o`.
function setArrowAt(arrow, o, dir, len) {
  arrow.userData.update(o, dir, len);
}

// Thick tube along a list of THREE.Vector3 points.
function buildTube(points, radius, color, opacity = 1) {
  const curve = new THREE.CatmullRomCurve3(points);
  const segs = Math.max(6, points.length - 1);
  const geo = new THREE.TubeGeometry(curve, segs, radius, 6, false);
  const mat = new THREE.MeshStandardMaterial({ color, transparent: opacity < 1, opacity, metalness: 0, roughness: 1 });
  return new THREE.Mesh(geo, mat);
}

// Curved arrow from `from` to `to` using a quadratic bezier bent outward from sphere.
// Adds tube shaft + cone head to `targetGroup` (clears it first for re-use).
function fillCurvedArrow(targetGroup, from, to, color) {
  while (targetGroup.children.length) {
    const c = targetGroup.children.pop();
    c.geometry?.dispose();
    if (c.material) c.material.dispose();
  }
  const mid = from.clone().add(to).multiplyScalar(0.5);
  // Bend outward using `from` direction — `from` is outside the sphere so this
  // keeps the entire arc on the exterior of the surface.
  const outDir = from.clone().normalize();
  const ctrl = mid.clone().addScaledVector(outDir, from.clone().sub(to).length() * 0.50);
  const N = 24;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    pts.push(
      from.clone().multiplyScalar((1 - t) * (1 - t))
        .addScaledVector(ctrl, 2 * (1 - t) * t)
        .addScaledVector(to, t * t)
    );
  }
  const CONE_H = 0.055;
  const shaftPts = pts.slice(0, N - 2);
  if (shaftPts.length >= 2) targetGroup.add(buildTube(shaftPts, 0.006, color));

  const coneDir = pts[N].clone().sub(pts[N - 2]).normalize();
  const coneGeo = new THREE.ConeGeometry(0.018, CONE_H, 8);
  const coneMat = new THREE.MeshStandardMaterial({ color, metalness: 0, roughness: 1 });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), coneDir);
  // Tip of cone sits at `to` — center is offset backward so arrowhead stays outside.
  cone.position.copy(to.clone().sub(coneDir.clone().multiplyScalar(CONE_H * 0.5)));
  targetGroup.add(cone);
}

// helper to add a label via the CSS2D label fn provided in ctx
function makeLabel(ctx, text, position, opts = {}) {
  return ctx.addLabel(text, position, opts);
}

// ---------------------------------------------------------------------------
// CH 1: The manifold S²
// ---------------------------------------------------------------------------
const ch1 = {
  id: 'manifold',
  eyebrow: 'Manifold',
  title: 'The 2-sphere',
  body: `The unit sphere <span class="mono">S²</span> sits in ℝ³ as the level set
    of the squared norm. It is a smooth, compact, two-dimensional Riemannian
    manifold — the simplest non-trivial setting for optimization with a unit-norm
    constraint, and the proving ground for the concepts that follow.`,
  formula: String.raw`S^{2} \;=\; \bigl\{\, x \in \mathbb{R}^{3} : \|x\| = 1 \,\bigr\}, \quad \dim S^{2} = 2`,
  camera: { pos: [0, 0.55, 3.4], target: [0, 0, 0] },
  enter(ctx) {
    // a faint axis triad helps situate the viewer
    const axes = new THREE.Group();
    const c = ctx.palette.textDim;
    const ax = (from, to) => {
      const g = new THREE.BufferGeometry().setFromPoints([from, to]);
      return new THREE.Line(g, new THREE.LineBasicMaterial({
        color: ctx.palette.grid, transparent: true, opacity: 0.25,
      }));
    };
    axes.add(ax(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1.45, 0, 0)));
    axes.add(ax(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1.45, 0)));
    axes.add(ax(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 1.45)));
    ctx.group.add(axes);

    makeLabel(ctx, 'x', new THREE.Vector3(1.50, 0, 0), { dim: true });
    makeLabel(ctx, 'y', new THREE.Vector3(0, 1.50, 0), { dim: true });
    makeLabel(ctx, 'z', new THREE.Vector3(0, 0, 1.50), { dim: true });
    makeLabel(ctx, 'S²', new THREE.Vector3(0, 1.18, 0.0), { italic: true, accent: true });

    return { autoRotate: 0.05 };
  },
};

// ---------------------------------------------------------------------------
// CH 2: Tangent space
// ---------------------------------------------------------------------------
const ch2 = {
  id: 'tangent',
  eyebrow: 'Tangent space',
  title: 'T\u209A S²',
  body: `At each <em>p ∈ S²</em>, the tangent space is the 2-plane through
    the origin <em>orthogonal to the radial direction</em>. Tangent vectors are
    the instantaneous velocities of smooth curves on <span class="mono">S²</span> passing through p; they are the
    objects gradients, search directions, and momenta live in.`,
  formula: String.raw`T_{p}S^{2} \;=\; \bigl\{\, v \in \mathbb{R}^{3} : \langle v,\, p\rangle = 0 \,\bigr\}`,
  camera: { pos: [1.55, 1.05, 2.30], target: [0.30, 0.15, 0.10] },
  pickable: true,
  enter(ctx) {
    const p = ctx.p.clone();
    // tangent plane disc
    const plane = buildTangentPlane({
      p, radius: 0.78,
      color: ctx.palette.tangent, opacity: 0.16
    });
    ctx.group.add(plane);

    // outward normal arrow (radial) — emphasises orthogonality
    const normal = buildArrow({
      origin: p, direction: p.clone(), length: 0.55,
      color: ctx.palette.p, shaft: 0.007, head: 0.032, headLen: 0.065,
    });
    ctx.group.add(normal);

    // a few sample tangent vectors radiating from p
    const [e1, e2] = M.tangentFrame(p);
    const samples = 8;
    for (let i = 0; i < samples; i++) {
      const t = (i / samples) * Math.PI * 2;
      const v = e1.clone().multiplyScalar(Math.cos(t)).addScaledVector(e2, Math.sin(t));
      const a = buildArrow({
        origin: p, direction: v, length: 0.32,
        color: ctx.palette.tangent, shaft: 0.0055, head: 0.022, headLen: 0.05,
      });
      a.userData.mat.opacity = 0.55;
      a.userData.mat.transparent = true;
      ctx.group.add(a);
    }

    // dot at p
    ctx.group.add(buildDot({ position: p, color: ctx.palette.p, radius: 0.022 }));

    makeLabel(ctx, 'p', p.clone().multiplyScalar(1.06), { accent: true });
    makeLabel(ctx, 'T<sub>p</sub>S²',
      p.clone().add(e1.clone().multiplyScalar(0.62)).add(e2.clone().multiplyScalar(0.30)),
      { italic: true, tangent: true });
    makeLabel(ctx, 'p', p.clone().multiplyScalar(1.62), { dim: true, small: true });

    return {
      onPick(newP) {
        ctx.p.copy(newP);
        ctx.requestRebuild();
      },
    };
  },
};

// ---------------------------------------------------------------------------
// CH 3: Riemannian metric
// ---------------------------------------------------------------------------
const ch3 = {
  id: 'metric',
  eyebrow: 'Metric',
  title: 'Inner product on T\u209A',
  body: `<span class="mono">S²</span> inherits its Riemannian metric from the ambient
    Euclidean inner product: lengths and angles of tangent vectors are simply those
    of ℝ³, restricted to each tangent plane. This is what lets us talk about
    <em>gradient</em>, <em>orthogonality</em>, and <em>norm</em> intrinsically.`,
  formula: String.raw`\langle u,\, v\rangle_{p} \;=\; u\!\cdot\! v, \qquad \|v\|_{p} = \sqrt{\langle v,v\rangle_{p}}`,
  camera: { pos: [1.55, 1.05, 2.30], target: [0.30, 0.15, 0.10] },
  enter(ctx) {
    const p = ctx.p.clone();
    const plane = buildTangentPlane({
      p, radius: 0.78,
      color: ctx.palette.tangent, opacity: 0.10
    });
    ctx.group.add(plane);

    const [e1, e2] = M.tangentFrame(p);
    // two arbitrary tangent vectors u, v with a clear angle
    const u = e1.clone().multiplyScalar(0.55).addScaledVector(e2, 0.10);
    const v = e1.clone().multiplyScalar(0.18).addScaledVector(e2, 0.48);

    const arrowU = buildArrow({
      origin: p, direction: u, length: u.length(),
      color: ctx.palette.tangent, shaft: 0.006, head: 0.026, headLen: 0.062,
    });
    const arrowV = buildArrow({
      origin: p, direction: v, length: v.length(),
      color: ctx.palette.accent_2 || ctx.palette.q, shaft: 0.006, head: 0.026, headLen: 0.062,
    });
    ctx.group.add(arrowU);
    ctx.group.add(arrowV);

    // arc between them showing the angle θ
    const uHat = u.clone().normalize();
    const vHat = v.clone().normalize();
    const cosA = Math.max(-1, Math.min(1, uHat.dot(vHat)));
    const ang = Math.acos(cosA);
    const arcPts = [];
    const arcR = 0.14;
    for (let i = 0; i <= 48; i++) {
      const t = (i / 48) * ang;
      const dir = uHat.clone().multiplyScalar(Math.cos(t))
        .addScaledVector(vHat.clone().sub(uHat.clone().multiplyScalar(cosA)).normalize(), Math.sin(t));
      arcPts.push(p.clone().addScaledVector(dir, arcR));
    }
    ctx.group.add(buildPolyline({ points: arcPts, color: ctx.palette.textDim, opacity: 0.7 }));

    ctx.group.add(buildDot({ position: p, color: ctx.palette.p, radius: 0.022 }));

    makeLabel(ctx, 'p', p.clone().multiplyScalar(1.06), { accent: true });
    makeLabel(ctx, 'u', p.clone().add(u.clone().multiplyScalar(1.12)), { tangent: true });
    makeLabel(ctx, 'v', p.clone().add(v.clone().multiplyScalar(1.12)), { tangent: true });
    const mid = uHat.clone().add(vHat).normalize();
    makeLabel(ctx, 'θ', p.clone().addScaledVector(mid, arcR + 0.05), { italic: true, dim: true });
  },
};

// ---------------------------------------------------------------------------
// CH 4: Geodesics
// ---------------------------------------------------------------------------
const ch4 = {
  id: 'geodesic',
  eyebrow: 'Geodesics',
  title: 'Great circles',
  body: `A <em>geodesic</em> is a locally length-minimizing curve. On <span class="mono">S²</span>
    geodesics are arcs of great circles — intersections of the sphere with planes
    through the origin. The geodesic leaving p with initial velocity v traces
    γ(t) on the sphere by trigonometric rotation in the plane <span class="mono">span(p, v̂)</span>.`,
  formula: String.raw`\gamma_{p,v}(t) \;=\; \cos(t)\, p \;+\; \sin(t)\, \hat{v}, \\ \hat{v} = v / \|v\|`,
  camera: { pos: [0.4, 0.8, 3.0], target: [0, 0.05, 0.25] },
  pickable: true,
  enter(ctx) {
    const p = ctx.p.clone();
    const q = ctx.q.clone();

    const u = M.logMap(p, q).normalize();
    const theta = Math.acos(THREE.MathUtils.clamp(p.dot(q), -1, 1));

    // full great circle (faint thin)
    const gcPts = [];
    for (let i = 0; i <= 256; i++) {
      gcPts.push(M.geodesicPoint(p, u, (i / 256) * Math.PI * 2));
    }
    ctx.group.add(buildPolyline({ points: gcPts, color: ctx.palette.geodesic, opacity: 0.18 }));

    // thick geodesic arc p → q
    const arcPts = [];
    for (let i = 0; i <= 96; i++) arcPts.push(M.geodesicPoint(p, u, (i / 96) * theta));
    ctx.group.add(buildTube(arcPts, 0.009, ctx.palette.geodesic));

    // moving dot that travels p → q and loops
    const movingDot = buildDot({ position: p.clone(), color: ctx.palette.accent || 0xffffff, radius: 0.030 });
    ctx.group.add(movingDot);

    ctx.group.add(buildDot({ position: p, color: ctx.palette.p, radius: 0.022 }));
    ctx.group.add(buildDot({ position: q, color: ctx.palette.q, radius: 0.022 }));

    makeLabel(ctx, 'p', p.clone().multiplyScalar(1.06), { accent: true });
    makeLabel(ctx, 'q', q.clone().multiplyScalar(1.06), { q: true });
    makeLabel(ctx, 'γ(t)', M.geodesicPoint(p, u, theta * 0.55).multiplyScalar(1.10), { italic: true, geo: true });

    let tPct = 0;
    const period = 2.4; // seconds p→q one-way, then jumps back

    return {
      tick(time, dt) {
        tPct = (tPct + dt / period) % 1;
        movingDot.position.copy(M.geodesicPoint(p, u, tPct * theta));
      },
      onPick(newP) {
        ctx.p.copy(newP);
        ctx.requestRebuild();
      },
    };
  },
};

// ---------------------------------------------------------------------------
// CH 5: Exponential map
// ---------------------------------------------------------------------------
const ch5 = {
  id: 'exp',
  eyebrow: 'Exp',
  title: 'exp\u209A : T\u209AS² → S²',
  body: `The exponential map sends a tangent vector v ∈ T<sub>p</sub>S² to the
    endpoint of the geodesic of length ‖v‖ that leaves p with direction v̂.
    Intuitively, it <em>wraps the line p + tv on the tangent plane onto the
    sphere</em> along the unique geodesic in that direction. Diffeomorphic for
    ‖v‖ &lt; π.`,
  formula: String.raw`\exp_{p}(v) \;=\; \cos(\|v\|)\, p \;+\; \sin(\|v\|)\, \tfrac{v}{\|v\|}`,
  camera: { pos: [1.55, 1.10, 2.20], target: [0.30, 0.18, 0.10] },
  controlSchema: { vMag: { min: 0.05, max: Math.PI * 0.95, step: 0.01, value: 1.1, label: '‖v‖' } },
  enter(ctx) {
    const p = ctx.p.clone();
    const [e1, e2] = M.tangentFrame(p);
    // a fixed direction in the tangent plane (rotated for visual interest)
    const phi = THREE.MathUtils.degToRad(35);
    const dirHat = e1.clone().multiplyScalar(Math.cos(phi))
      .addScaledVector(e2, Math.sin(phi));

    const plane = buildTangentPlane({
      p, radius: 0.95,
      color: ctx.palette.tangent, opacity: 0.10
    });
    ctx.group.add(plane);

    // arrow v on tangent plane (will grow w/ slider)
    const arrowV = buildArrow({
      origin: p, direction: dirHat, length: 1.1,
      color: ctx.palette.tangent, shaft: 0.006, head: 0.026, headLen: 0.062,
    });
    ctx.group.add(arrowV);

    // tip-of-v marker (in tangent plane, *not* on sphere)
    const tipDot = buildDot({
      position: p.clone().addScaledVector(dirHat, 1.1),
      color: ctx.palette.tangent, radius: 0.018
    });
    ctx.group.add(tipDot);

    // dotted line from tip to exp_p(v) -- visualises the "wrapping"
    const wrapLine = buildPolyline({
      points: [p, p], color: ctx.palette.textDim, opacity: 0.45,
    });
    ctx.group.add(wrapLine);

    // geodesic arc on sphere from p, length |v|
    const arc = buildPolyline({
      points: [p.clone()], color: ctx.palette.geodesic, opacity: 1.0,
    });
    ctx.group.add(arc);

    // exp_p(v) point
    const expDot = buildDot({ position: p, color: ctx.palette.geodesic, radius: 0.024 });
    ctx.group.add(expDot);

    ctx.group.add(buildDot({ position: p, color: ctx.palette.p, radius: 0.022 }));
    makeLabel(ctx, 'p', p.clone().multiplyScalar(1.06), { accent: true });
    const vTipLabel = makeLabel(ctx, 'v', p.clone().addScaledVector(dirHat, 1.18), { tangent: true });
    const expLabel = makeLabel(ctx, 'exp(v)', p.clone(), { geo: true });

    const curvedArrowGroup = new THREE.Group();
    ctx.group.add(curvedArrowGroup);

    function setMag(mag) {
      const v = dirHat.clone().multiplyScalar(mag);
      arrowV.userData.update(p, v, mag);
      const tip = p.clone().addScaledVector(dirHat, mag);
      tipDot.position.copy(tip);
      const ePt = M.expMap(p, v);
      expDot.position.copy(ePt);
      arc.userData.update(M.geodesicRay(p, v, 96));
      wrapLine.userData.update([tip, ePt]);
      vTipLabel.update(p.clone().addScaledVector(dirHat, mag + 0.10));
      expLabel.update(ePt.clone().multiplyScalar(1.08));
      fillCurvedArrow(curvedArrowGroup, tip, ePt, ctx.palette.geodesic);
    }
    setMag(1.1);

    return {
      onControl(name, val) { if (name === 'vMag') setMag(val); },
    };
  },
};

// ---------------------------------------------------------------------------
// CH 6: Log map
// ---------------------------------------------------------------------------
const ch6 = {
  id: 'log',
  eyebrow: 'Log',
  title: 'log\u209A : S² → T\u209AS²',
  body: `On the open hemisphere centred at p, the exponential map is invertible.
    Its inverse, the <em>logarithm</em>, sends q ↦ log<sub>p</sub>(q): the unique
    tangent vector at p whose direction points toward q along the geodesic, with
    magnitude equal to the geodesic distance <span class="mono">d(p,q) = arccos⟨p,q⟩</span>.`,
  formula: String.raw`\log_{p}(q) \;=\; \theta\, \frac{q - \langle p,q\rangle\, p}{\|q - \langle p,q\rangle\, p\|}, \\ \theta = \arccos\langle p,q\rangle`,
  camera: { pos: [0.85, 0.95, 2.55], target: [0.20, 0.12, 0.20] },
  pickable: 'q',
  enter(ctx) {
    const p = ctx.p.clone();
    let q = ctx.q.clone();

    const plane = buildTangentPlane({
      p, radius: 1.05,
      color: ctx.palette.tangent, opacity: 0.10
    });
    ctx.group.add(plane);

    // faint geodesic arc p→q
    const arc = buildPolyline({
      points: M.geodesicArc(p, q, 96), color: ctx.palette.geodesic, opacity: 0.45,
    });
    ctx.group.add(arc);

    // log_p(q) arrow on tangent plane
    const logV = M.logMap(p, q);
    const arrow = buildArrow({
      origin: p, direction: logV, length: logV.length(),
      color: ctx.palette.tangent, shaft: 0.006, head: 0.026, headLen: 0.062,
    });
    ctx.group.add(arrow);

    // chord from tip of log to q
    const chord = buildPolyline({
      points: [p.clone().add(logV), q], color: ctx.palette.textDim, opacity: 0.35,
    });
    ctx.group.add(chord);

    ctx.group.add(buildDot({ position: p, color: ctx.palette.p, radius: 0.022 }));
    const qDot = buildDot({ position: q, color: ctx.palette.q, radius: 0.022 });
    ctx.group.add(qDot);

    makeLabel(ctx, 'p', p.clone().multiplyScalar(1.06), { accent: true });
    const qLabel = makeLabel(ctx, 'q', q.clone().multiplyScalar(1.06), { q: true });
    const logLabel = makeLabel(ctx, 'log_p(q)',
      p.clone().add(logV.clone().multiplyScalar(0.6)).add(p.clone().multiplyScalar(0.04)),
      { tangent: true, small: true });

    const curvedArrowGroup = new THREE.Group();
    ctx.group.add(curvedArrowGroup);
    fillCurvedArrow(curvedArrowGroup, q, p.clone().add(logV), ctx.palette.q);

    return {
      onPick(newQ) {
        q = newQ.clone();
        ctx.q.copy(q);
        qDot.position.copy(q);
        const lv = M.logMap(p, q);
        arrow.userData.update(p, lv, lv.length());
        arc.userData.update(M.geodesicArc(p, q, 96));
        chord.userData.update([p.clone().add(lv), q]);
        qLabel.update(q.clone().multiplyScalar(1.06));
        logLabel.update(p.clone().add(lv.clone().multiplyScalar(0.6)).add(p.clone().multiplyScalar(0.04)));
        fillCurvedArrow(curvedArrowGroup, q, p.clone().add(lv), ctx.palette.q);
      },
    };
  },
};

// ---------------------------------------------------------------------------
// CH 7: Retraction
// ---------------------------------------------------------------------------
const ch7 = {
  id: 'retract',
  eyebrow: 'Retraction',
  title: 'R\u209A ≈ exp\u209A',
  body: `A <em>retraction</em> is any smooth map T<sub>p</sub>S² → S² that agrees
    with the identity to first order at <span class="mono">0 ∈ T<sub>p</sub>S²</span>.
    On the sphere, the cheap standard choice is metric projection — just normalize.
    It coincides with exp<sub>p</sub> at v = 0 and to first order, but diverges as
    ‖v‖ grows. The cost saving is dramatic: no trig, no normalization of v.`,
  formula: String.raw`R_{p}(v) \;=\; \frac{p + v}{\|p + v\|}`,
  camera: { pos: [1.55, 1.10, 2.20], target: [0.30, 0.18, 0.10] },
  controlSchema: { vMag: { min: 0.05, max: Math.PI * 0.95, step: 0.01, value: 1.3, label: '‖v‖' } },
  enter(ctx) {
    const p = ctx.p.clone();
    const [e1, e2] = M.tangentFrame(p);
    const phi = THREE.MathUtils.degToRad(35);
    const dirHat = e1.clone().multiplyScalar(Math.cos(phi))
      .addScaledVector(e2, Math.sin(phi));

    const plane = buildTangentPlane({
      p, radius: 1.45,
      color: ctx.palette.tangent, opacity: 0.10
    });
    ctx.group.add(plane);

    const arrowV = buildArrow({
      origin: p, direction: dirHat, length: 1.3,
      color: ctx.palette.tangent, shaft: 0.006, head: 0.026, headLen: 0.062,
    });
    ctx.group.add(arrowV);

    // straight chord from origin to (p+v) — shows the "lift" before normalizing
    const chord = buildPolyline({
      points: [new THREE.Vector3(0, 0, 0), p.clone().addScaledVector(dirHat, 1.3)],
      color: ctx.palette.retraction, opacity: 0.45, dashed: true,
    });
    ctx.group.add(chord);

    // geodesic to exp_p(v)
    const arc = buildPolyline({
      points: M.geodesicRay(p, dirHat.clone().multiplyScalar(1.3), 96),
      color: ctx.palette.geodesic, opacity: 1.0,
    });
    ctx.group.add(arc);

    const expDot = buildDot({ position: p, color: ctx.palette.geodesic, radius: 0.024 });
    ctx.group.add(expDot);
    const retDot = buildDot({ position: p, color: ctx.palette.retraction, radius: 0.024 });
    ctx.group.add(retDot);

    // chord between exp & retraction points to make the gap visible
    const gapLine = buildPolyline({
      points: [p, p], color: ctx.palette.textDim, opacity: 0.45, dashed: true,
    });
    ctx.group.add(gapLine);

    ctx.group.add(buildDot({ position: p, color: ctx.palette.p, radius: 0.022 }));
    makeLabel(ctx, 'p', p.clone().multiplyScalar(1.06), { accent: true });
    const expL = makeLabel(ctx, 'exp(v)', p.clone(), { geo: true });
    const retL = makeLabel(ctx, 'R(v)', p.clone(), { retract: true });

    function setMag(mag) {
      const v = dirHat.clone().multiplyScalar(mag);
      arrowV.userData.update(p, v, mag);
      const ePt = M.expMap(p, v);
      const rPt = M.retract(p, v);
      expDot.position.copy(ePt);
      retDot.position.copy(rPt);
      arc.userData.update(M.geodesicRay(p, v, 96));
      chord.userData.update([new THREE.Vector3(0, 0, 0), p.clone().add(v)]);
      gapLine.userData.update([ePt, rPt]);
      expL.update(ePt.clone().multiplyScalar(1.10).add(new THREE.Vector3(0, 0.03, 0)));
      retL.update(rPt.clone().multiplyScalar(1.10).add(new THREE.Vector3(0, -0.03, 0)));
    }
    setMag(1.3);

    return {
      onControl(name, val) { if (name === 'vMag') setMag(val); },
    };
  },
};

// ---------------------------------------------------------------------------
// CH 8: Parallel transport
// ---------------------------------------------------------------------------
const ch8 = {
  id: 'transport',
  eyebrow: 'Connection',
  title: 'Parallel transport',
  body: `To compare tangent vectors at different points we need a notion of
    transport. The <em>Levi-Civita parallel transport</em> along a geodesic
    preserves lengths, angles, and the inner product with the velocity.
    On <span class="mono">S²</span>, this is a rigid rotation in the plane
    <span class="mono">span(p, q)</span> by the geodesic angle θ.`,
  formula: String.raw`P_{p\to q}\colon T_{p}S^{2} \to T_{q}S^{2}, \\ \langle P_{p\to q}(u), P_{p\to q}(v)\rangle_{q} = \langle u, v\rangle_{p}`,
  camera: { pos: [0.6, 0.85, 2.85], target: [0.05, 0.10, 0.20] },
  enter(ctx) {
    const p = ctx.p.clone();
    const q = ctx.q.clone();

    // geodesic
    const arc = buildPolyline({
      points: M.geodesicArc(p, q, 96), color: ctx.palette.geodesic, opacity: 0.6,
    });
    ctx.group.add(arc);

    // trail of transported vectors (faint)
    const trailGroup = new THREE.Group();
    ctx.group.add(trailGroup);

    // an initial tangent vector w at p, off-axis relative to log_p(q)
    const lpq = M.logMap(p, q);
    const [e1] = M.tangentFrame(p);
    const baseDir = lpq.clone().normalize();
    // rotate baseDir by ~60° in tangent plane
    const ortho = new THREE.Vector3().crossVectors(p, baseDir).normalize();
    const rot = THREE.MathUtils.degToRad(55);
    const w = baseDir.clone().multiplyScalar(Math.cos(rot))
      .addScaledVector(ortho, Math.sin(rot))
      .multiplyScalar(0.35);

    const arrowMoving = buildArrow({
      origin: p, direction: w, length: w.length(),
      color: ctx.palette.transport, shaft: 0.007, head: 0.030, headLen: 0.070,
    });
    ctx.group.add(arrowMoving);

    // start & end markers
    const startArrow = buildArrow({
      origin: p, direction: w, length: w.length(),
      color: ctx.palette.transport, shaft: 0.006, head: 0.024, headLen: 0.055,
    });
    startArrow.userData.mat.opacity = 0.35;
    startArrow.userData.mat.transparent = true;
    ctx.group.add(startArrow);

    ctx.group.add(buildDot({ position: p, color: ctx.palette.p, radius: 0.022 }));
    ctx.group.add(buildDot({ position: q, color: ctx.palette.q, radius: 0.022 }));

    makeLabel(ctx, 'p', p.clone().multiplyScalar(1.06), { accent: true });
    makeLabel(ctx, 'q', q.clone().multiplyScalar(1.06), { q: true });
    const wLabel = makeLabel(ctx, 'w', p.clone().add(w.clone().multiplyScalar(1.25)),
      { transport: true });
    const PwLabel = makeLabel(ctx, 'P(w)', q.clone(), { transport: true });

    // animated parameter t ∈ [0,1] looping
    let t = 0;
    const period = 4.2;     // seconds for a full traversal
    const hold = 0.7;       // hold at end before reset
    let phase = 'travel';   // travel | hold
    let phaseT = 0;
    let trailPts = [];

    return {
      tick(time, dt) {
        if (phase === 'travel') {
          phaseT += dt;
          t = Math.min(1, phaseT / period);
          if (t >= 1) { phase = 'hold'; phaseT = 0; }
        } else {
          phaseT += dt;
          if (phaseT > hold) {
            // reset
            phase = 'travel';
            phaseT = 0;
            // clear trail
            for (const c of trailPts) trailGroup.remove(c);
            trailPts = [];
          }
        }
        const dot = THREE.MathUtils.clamp(p.dot(q), -1, 1);
        const theta = Math.acos(dot);
        const u = q.clone().addScaledVector(p, -dot).normalize();
        const cur = M.geodesicPoint(p, u, t * theta);
        const wt = M.parallelTransport(p, cur, w);
        arrowMoving.userData.update(cur, wt, wt.length());

        PwLabel.update(cur.clone().add(wt.clone().multiplyScalar(1.25)));

        // intermittently drop a ghost arrow into the trail
        if (phase === 'travel' && Math.floor(t * 12) > trailPts.length - 1) {
          const ghost = buildArrow({
            origin: cur, direction: wt, length: wt.length(),
            color: ctx.palette.transport, shaft: 0.006, head: 0.028, headLen: 0.055,
          });
          ghost.userData.mat.opacity = 0.30;
          ghost.userData.mat.transparent = true;
          trailGroup.add(ghost);
          trailPts.push(ghost);
        }
      },
    };
  },
};

// ---------------------------------------------------------------------------

export const CHAPTERS = [ch1, ch2, ch3, ch4, ch5, ch6, ch7, ch8];
export const DEFAULTS = { P0, Q0 };
