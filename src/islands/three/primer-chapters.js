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
// CH 1: La variété S²
// ---------------------------------------------------------------------------
const ch1 = {
  id: 'manifold',
  eyebrow: 'Variété',
  title: 'La 2-sphère',
  body: `La sphère unité <span class="mono">S²</span> s'inscrit dans ℝ³ comme l'ensemble de niveau de la norme au carré. C'est une variété riemannienne lisse, compacte, de dimension deux — le cadre le plus simple pour l'optimisation sous contrainte de norme unitaire, et le terrain d'expérimentation des concepts qui suivent.`,
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
// CH 2: Espace tangent
// ---------------------------------------------------------------------------
const ch2 = {
  id: 'tangent',
  eyebrow: 'Espace tangent',
  title: 'Tₚ S²',
  body: `En chaque <em>p ∈ S²</em>, l'espace tangent est le 2-plan passant par l'origine <em>orthogonal à la direction radiale</em>. Les vecteurs tangents sont les vitesses instantanées des courbes lisses sur <span class="mono">S²</span> passant par p ; c'est là que vivent les gradients, directions de descente et moments.`,
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
// CH 3: Métrique riemannienne
// ---------------------------------------------------------------------------
const ch3 = {
  id: 'metric',
  eyebrow: 'Métrique',
  title: 'Produit intérieur sur Tₚ',
  body: `<span class="mono">S²</span> hérite de sa métrique riemannienne du produit scalaire euclidien ambiant : longueurs et angles des vecteurs tangents sont simplement ceux de ℝ³, restreints à chaque plan tangent. C'est ce qui permet de parler de <em>gradient</em>, d'<em>orthogonalité</em> et de <em>norme</em> de façon intrinsèque.`,
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
// CH 4: Géodésiques
// ---------------------------------------------------------------------------
const ch4 = {
  id: 'geodesic',
  eyebrow: 'Géodésiques',
  title: 'Grands cercles',
  body: `Une <em>géodésique</em> est une courbe qui minimise localement la longueur. Sur <span class="mono">S²</span>, les géodésiques sont des arcs de grands cercles — intersections de la sphère avec des plans passant par l'origine. La géodésique partant de p avec vitesse initiale v trace γ(t) par rotation trigonométrique dans le plan <span class="mono">span(p, v̂)</span>.`,
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
// CH 5: Application exponentielle
// ---------------------------------------------------------------------------
const ch5 = {
  id: 'exp',
  eyebrow: 'Exp',
  title: 'expₚ : TₚS² → S²',
  body: `L'application exponentielle envoie un vecteur tangent v ∈ T<sub>p</sub>S² vers l'extrémité de la géodésique de longueur ‖v‖ partant de p dans la direction v̂. Intuitivement, elle <em>enroule la droite p + tv sur la sphère</em> le long de l'unique géodésique dans cette direction. Difféomorphisme pour ‖v‖ &lt; π.`,
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
// CH 6: Application logarithmique
// ---------------------------------------------------------------------------
const ch6 = {
  id: 'log',
  eyebrow: 'Log',
  title: 'logₚ : S² → TₚS²',
  body: `Sur l'hémisphère ouvert centré en p, l'application exponentielle est inversible. Son inverse, le <em>logarithme</em>, envoie q ↦ log<sub>p</sub>(q) : l'unique vecteur tangent en p dont la direction pointe vers q le long de la géodésique, de module égal à la distance géodésique <span class="mono">d(p,q) = arccos⟨p,q⟩</span>.`,
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
// CH 7: Rétraction
// ---------------------------------------------------------------------------
const ch7 = {
  id: 'retract',
  eyebrow: 'Rétraction',
  title: 'Rₚ ≈ expₚ',
  body: `Une <em>rétraction</em> est toute application lisse T<sub>p</sub>S² → S² qui coïncide avec l'identité au premier ordre en <span class="mono">0 ∈ T<sub>p</sub>S²</span>. Sur la sphère, le choix canonique bon marché est la projection métrique — normaliser simplement. Elle coïncide avec exp<sub>p</sub> en v = 0 et au premier ordre, mais s'en écarte quand ‖v‖ croît. Le gain en coût est considérable : pas de trig, pas de normalisation de v.`,
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
// CH 8: Transport parallèle — deux vecteurs pour montrer la conservation de l'angle
// ---------------------------------------------------------------------------
const ch8 = {
  id: 'transport',
  eyebrow: 'Connexion',
  title: 'Transport parallèle',
  body: `Pour comparer des vecteurs tangents en des points différents, il faut une notion de transport. Le <em>transport parallèle de Levi-Civita</em> le long d'une géodésique préserve longueurs, angles et le produit intérieur avec la vitesse. Sur <span class="mono">S²</span>, c'est une rotation rigide dans le plan <span class="mono">span(p, q)</span>. <strong>Deux vecteurs</strong> sont transportés ici : leur angle mutuel est constant.`,
  formula: String.raw`P_{p\to q}\colon T_{p}S^{2} \to T_{q}S^{2}, \\ \langle P_{p\to q}(u), P_{p\to q}(v)\rangle_{q} = \langle u, v\rangle_{p}`,
  camera: { pos: [0.6, 0.85, 2.85], target: [0.05, 0.10, 0.20] },
  enter(ctx) {
    const p = ctx.p.clone();
    const q = ctx.q.clone();

    // geodesic arc p → q
    const arc = buildPolyline({
      points: M.geodesicArc(p, q, 96), color: ctx.palette.geodesic, opacity: 0.6,
    });
    ctx.group.add(arc);

    // trail groups for ghost arrows
    const trailGroup  = new THREE.Group();
    const trailGroup2 = new THREE.Group();
    ctx.group.add(trailGroup);
    ctx.group.add(trailGroup2);

    // first vector w at p — off-axis relative to log_p(q)
    const lpq = M.logMap(p, q);
    const baseDir = lpq.clone().normalize();
    const ortho = new THREE.Vector3().crossVectors(p, baseDir).normalize();
    const rot = THREE.MathUtils.degToRad(55);
    const w = baseDir.clone().multiplyScalar(Math.cos(rot))
      .addScaledVector(ortho, Math.sin(rot))
      .multiplyScalar(0.35);

    // second vector w2 — rotate w by 70° around the outward normal at p
    const normalP = p.clone().normalize();
    const rot2cos = Math.cos(THREE.MathUtils.degToRad(70));
    const rot2sin = Math.sin(THREE.MathUtils.degToRad(70));
    const wPerp = new THREE.Vector3().crossVectors(normalP, w.clone().normalize()).multiplyScalar(w.length());
    const w2 = w.clone().multiplyScalar(rot2cos).addScaledVector(wPerp, rot2sin);

    // moving arrows (travel along geodesic)
    const arrowMoving = buildArrow({
      origin: p, direction: w, length: w.length(),
      color: ctx.palette.transport, shaft: 0.007, head: 0.030, headLen: 0.070,
    });
    const arrowMoving2 = buildArrow({
      origin: p, direction: w2, length: w2.length(),
      color: ctx.palette.q, shaft: 0.007, head: 0.030, headLen: 0.070,
    });
    ctx.group.add(arrowMoving);
    ctx.group.add(arrowMoving2);

    // ghost arrows at start (semi-transparent)
    const startArrow = buildArrow({
      origin: p, direction: w, length: w.length(),
      color: ctx.palette.transport, shaft: 0.006, head: 0.024, headLen: 0.055,
    });
    startArrow.userData.mat.opacity = 0.35;
    startArrow.userData.mat.transparent = true;
    const startArrow2 = buildArrow({
      origin: p, direction: w2, length: w2.length(),
      color: ctx.palette.q, shaft: 0.006, head: 0.024, headLen: 0.055,
    });
    startArrow2.userData.mat.opacity = 0.35;
    startArrow2.userData.mat.transparent = true;
    ctx.group.add(startArrow);
    ctx.group.add(startArrow2);

    ctx.group.add(buildDot({ position: p, color: ctx.palette.p, radius: 0.022 }));
    ctx.group.add(buildDot({ position: q, color: ctx.palette.q, radius: 0.022 }));

    makeLabel(ctx, 'p', p.clone().multiplyScalar(1.06), { accent: true });
    makeLabel(ctx, 'q', q.clone().multiplyScalar(1.06), { q: true });
    const wLabel  = makeLabel(ctx, 'w₁', p.clone().add(w.clone().multiplyScalar(1.28)),  { transport: true });
    const w2Label = makeLabel(ctx, 'w₂', p.clone().add(w2.clone().multiplyScalar(1.28)), { q: true });
    const PwLabel  = makeLabel(ctx, 'P(w₁)', q.clone(), { transport: true });
    const Pw2Label = makeLabel(ctx, 'P(w₂)', q.clone(), { q: true });

    let t = 0;
    const period = 4.2;   // seconds for a full traversal
    const hold = 0.7;     // hold at destination before reset
    let phase = 'travel';
    let phaseT = 0;
    let trailPts  = [];
    let trailPts2 = [];

    return {
      tick(time, dt) {
        if (phase === 'travel') {
          phaseT += dt;
          t = Math.min(1, phaseT / period);
          if (t >= 1) { phase = 'hold'; phaseT = 0; }
        } else {
          phaseT += dt;
          if (phaseT > hold) {
            phase = 'travel'; phaseT = 0;
            for (const c of trailPts)  trailGroup.remove(c);
            for (const c of trailPts2) trailGroup2.remove(c);
            trailPts = []; trailPts2 = [];
          }
        }
        const dot   = THREE.MathUtils.clamp(p.dot(q), -1, 1);
        const theta = Math.acos(dot);
        const u     = q.clone().addScaledVector(p, -dot).normalize();
        const cur   = M.geodesicPoint(p, u, t * theta);
        const wt    = M.parallelTransport(p, cur, w);
        const w2t   = M.parallelTransport(p, cur, w2);

        arrowMoving.userData.update(cur, wt, wt.length());
        arrowMoving2.userData.update(cur, w2t, w2t.length());
        PwLabel.update(cur.clone().add(wt.clone().multiplyScalar(1.28)));
        Pw2Label.update(cur.clone().add(w2t.clone().multiplyScalar(1.28)));

        // drop ghost arrows into trail for both vectors simultaneously
        if (phase === 'travel' && Math.floor(t * 12) > trailPts.length - 1) {
          const ghost = buildArrow({
            origin: cur, direction: wt, length: wt.length(),
            color: ctx.palette.transport, shaft: 0.006, head: 0.028, headLen: 0.055,
          });
          ghost.userData.mat.opacity = 0.22;
          ghost.userData.mat.transparent = true;
          trailGroup.add(ghost);
          trailPts.push(ghost);

          const ghost2 = buildArrow({
            origin: cur, direction: w2t, length: w2t.length(),
            color: ctx.palette.q, shaft: 0.006, head: 0.028, headLen: 0.055,
          });
          ghost2.userData.mat.opacity = 0.22;
          ghost2.userData.mat.transparent = true;
          trailGroup2.add(ghost2);
          trailPts2.push(ghost2);
        }
      },
    };
  },
};

// ---------------------------------------------------------------------------

export const CHAPTERS = [ch1, ch2, ch3, ch4, ch5, ch6, ch7, ch8];
export const DEFAULTS = { P0, Q0 };
