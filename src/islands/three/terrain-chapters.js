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
// CH 1 — Toute variété riemannienne
// ===========================================================================
const ch1 = {
  id: 'manifold',
  eyebrow: 'Variété',
  title: 'Variété lisse &amp; atlas',
  body: `Une <em>variété lisse</em> ℳ est un espace qui ressemble localement à ℝⁿ
    en chaque point. Une <em>carte locale</em> φ : U ⊂ ℳ → ℝⁿ donne des coordonnées
    dans un voisinage ouvert U. Un <em>atlas</em> est un recouvrement de ℳ par de
    telles cartes. Ici les lignes de coordonnées (u, v) forment une carte
    couvrant tout le terrain. Aucune structure métrique n'est encore supposée.`,
  formula: String.raw`\mathcal{M} \text{ variété lisse},\quad \dim\mathcal{M} = n \\
    \varphi : U \subset \mathcal{M} \;\xrightarrow{\sim}\; V \subset \mathbb{R}^{n}`,
  camera: { pos: [3.6, 2.8, 4.2], target: [0, 0.15, 0] },
  enter(ctx) {
    // faint ambient axes
    const ax = (from, to) => {
      const g = new THREE.BufferGeometry().setFromPoints([from, to]);
      return new THREE.Line(g, new THREE.LineBasicMaterial({
        color: ctx.palette.grid, transparent: true, opacity: 0.18,
      }));
    };
    ctx.group.add(ax(new THREE.Vector3(0, 0, 0), new THREE.Vector3(2.4, 0, 0)));
    ctx.group.add(ax(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1.4, 0)));
    ctx.group.add(ax(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 2.4)));

    // coordinate grid on the terrain — u-lines (v = const) and v-lines (u = const)
    const U0 = -0.55, U1 = 0.55, V0 = -0.45, V1 = 0.55, NU = 7, NV = 7, NSEG = 48;
    // u-lines (green family)
    for (let j = 0; j <= NV; j++) {
      const v = V0 + j * (V1 - V0) / NV;
      const pts = [];
      for (let i = 0; i <= NSEG; i++) {
        const u = U0 + i * (U1 - U0) / NSEG;
        const p = T.surfacePoint(u, v);
        pts.push(p.clone().addScaledVector(T.normalAt(u, v), 0.006));
      }
      ctx.group.add(buildPolyline({
        points: pts,
        color: ctx.palette.geodesic,
        opacity: (j === 0 || j === NV) ? 0.65 : 0.28,
      }));
    }
    // v-lines (tangent family)
    for (let i = 0; i <= NU; i++) {
      const u = U0 + i * (U1 - U0) / NU;
      const pts = [];
      for (let j = 0; j <= NSEG; j++) {
        const v = V0 + j * (V1 - V0) / NSEG;
        const p = T.surfacePoint(u, v);
        pts.push(p.clone().addScaledVector(T.normalAt(u, v), 0.006));
      }
      ctx.group.add(buildPolyline({
        points: pts,
        color: ctx.palette.tangent,
        opacity: (i === 0 || i === NU) ? 0.65 : 0.28,
      }));
    }

    // labels — use T.h() + explicit y-offset so positions are always above terrain
    const uC = (U0 + U1) / 2, vC = (V0 + V1) / 2;
    lbl(ctx, 'U', new THREE.Vector3(uC, T.h(uC, vC) + 0.52, vC), { accent: true, italic: true });
    lbl(ctx, 'ℳ', new THREE.Vector3(-0.7, T.h(-0.7, -0.55) + 0.42, -0.55), { italic: true, accent: true });
    lbl(ctx, 'φ(u, v)', new THREE.Vector3(U1 + 0.05, T.h(U1, vC) + 0.30, vC), { tangent: true, small: true });

    return { autoRotate: 0.03 };
  },
};

// ===========================================================================
// CH 2 — Espace tangent T_p ℳ
// ===========================================================================
const ch2 = {
  id: 'tangent',
  eyebrow: 'Espace tangent',
  title: 'Tₚ ℳ',
  body: `En chaque p ∈ ℳ, l'<em>espace tangent</em> T<sub>p</sub>ℳ est un
    espace vectoriel de même dimension que ℳ. Les vecteurs tangents sont les
    vitesses des courbes lisses passant par p. Gradients, directions de descente
    et mises à jour y vivent tous. Les vecteurs de base r<sub>u</sub>, r<sub>v</sub>
    engendrent T<sub>p</sub>ℳ pour cette surface.`,
  formula: String.raw`T_{\mathbf{p}}\mathcal{M} \;=\; \bigl\{\, \dot\gamma(0) : \gamma \;\text{smooth},\;
    \gamma(0) = \mathbf{p} \bigr\}`,
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
    const lblP  = lbl(ctx, 'p', pp.clone().add(new THREE.Vector3(0.03, 0.07, 0)), { accent: true });
    const lblRU = lbl(ctx, 'r<sub>u</sub>', pp.clone().addScaledVector(ru, 0.62).add(new THREE.Vector3(0, 0.06, 0.02)), { tangent: true });
    const lblRV = lbl(ctx, 'r<sub>v</sub>', pp.clone().addScaledVector(rv, 0.62).add(new THREE.Vector3(0.02, 0.04, 0.04)), { tangent: true });
    const lblN  = lbl(ctx, 'n', pp.clone().addScaledVector(n, 0.55).add(new THREE.Vector3(0.04, 0.05, 0.0)), { geo: true });

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
// CH 3 — Métrique riemannienne g
// ===========================================================================
const ch3 = {
  id: 'metric',
  eyebrow: 'Métrique',
  title: 'La métrique riemannienne',
  body: `La métrique g<sub>p</sub> est une <em>forme bilinéaire lisse, symétrique,
    définie positive</em> sur T<sub>p</sub>ℳ. Elle définit longueurs des courbes,
    angles entre vecteurs tangents et distances géodésiques. La métrique varie de
    point en point — c'est ce qui rend la géométrie non trivialement courbée.
    L'ellipse unité-g (orange) diffère du cercle euclidien (gris).`,
  formula: String.raw`g_{\mathbf{p}}(\mathbf{u},\mathbf{u}) > 0 \;\; \forall\, \mathbf{u} \ne 0,\\
    \|\mathbf{v}\|_{\mathbf{p}} = \sqrt{g_{\mathbf{p}}(\mathbf{v},\mathbf{v})},\qquad g_{\mathbf{p}} \in C^\infty`,
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
// CH 4 — Géodésique
// ===========================================================================
const ch4 = {
  id: 'geodesic',
  eyebrow: 'Géodésique',
  title: 'La courbe la plus droite',
  body: `Une <em>géodésique</em> est une courbe d'accélération covariante nulle :
    elle ne « tourne » pas dans la variété. Les géodésiques minimisent localement
    la longueur d'arc et généralisent les droites. Sur ℳ, leur forme est dictée par
    les symboles de Christoffel Γ — les termes de « correction » requis par la
    courbure. Le segment droit ambiant (gris) tranche la surface.`,
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
    const lblGeo = lbl(ctx, 'géodésique', new THREE.Vector3(), { geo: true, small: true });
    const lblAmb = lbl(ctx, 'ambiant', new THREE.Vector3(), { small: true, dim: true });

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
// CH 5 — Application exponentielle
// ===========================================================================
const ch5 = {
  id: 'exp',
  eyebrow: 'Application Exp',
  title: 'expₚ',
  body: `L'application exponentielle <em>exp<sub>p</sub> : T<sub>p</sub>ℳ → ℳ</em> enroule
    l'espace tangent sur la variété : exp<sub>p</sub>(v) est le point atteint en suivant
    la géodésique depuis p dans la direction v pendant un temps unité. Elle linéarise
    la géométrie autour de tout point de base. Un éventail de géodésiques rayonne depuis p.`,
  formula: String.raw`\exp_{\mathbf{p}}(\mathbf{v}) = \gamma_{\mathbf{v}}(1),\quad \dot\gamma_{\mathbf{v}}(0) = \mathbf{v},\quad \exp_{\mathbf{p}}(0) = \mathbf{p}`,
  camera: { pos: [2.2, 2.3, 3.1], target: [-0.15, 0.30, 0.05] },
  pickable: true,
  controlSchema: {
    angle: { label: 'angle', min: 0, max: 6.28, step: 0.01, value: 0.7 },
    length: { label: 'longueur', min: 0.1, max: 1.4, step: 0.01, value: 0.95 },
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
// CH 6 — Application logarithmique
// ===========================================================================
const ch6 = {
  id: 'log',
  eyebrow: 'Application Log',
  title: 'logₚ',
  body: `L'application logarithmique est l'inverse local d'exp<sub>p</sub>. Étant donné q
    proche de p, <em>log<sub>p</sub>(q)</em> est le vecteur tangent qui tire une géodésique
    de p vers q en temps unité. Sa norme est égale à la distance géodésique d(p, q).
    Il n'existe pas de forme fermée pour une variété ℳ quelconque — une itération de Newton
    par tir la récupère numériquement.`,
  formula: String.raw`\log_{\mathbf{p}}(\mathbf{q}) \in T_{\mathbf{p}}\mathcal{M},\quad
    d(\mathbf{p},\mathbf{q}) = \bigl\|\log_{\mathbf{p}}(\mathbf{q})\bigr\|_{\mathbf{p}},\quad \exp_{\mathbf{p}}\!\bigl(\log_{\mathbf{p}}(\mathbf{q})\bigr) = \mathbf{q}`,
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
// CH 7 — Rétraction
// ===========================================================================
const ch7 = {
  id: 'retract',
  eyebrow: 'Rétraction',
  title: 'Rétraction Rₚ',
  body: `Le calcul d'exp<sub>p</sub> nécessite l'intégration d'une EDO géodésique. Pour
    les algorithmes itératifs, un substitut au premier ordre suffit : une <em>rétraction</em>
    R<sub>p</sub> : T<sub>p</sub>ℳ → ℳ qui coïncide avec exp<sub>p</sub> au premier ordre
    en 0. Sur cette surface, une rétraction bon marché est « avancer dans ℝ³, projeter sur ℳ »
    (retomber à la hauteur h). Comparez les deux extrémités.`,
  formula: String.raw`R_p(0) = p,\quad \mathrm{d}R_p|_0 = \mathrm{id},\quad
    R_p(v) = \exp_p(v) + O(\|v\|^2)`,
  camera: { pos: [2.2, 2.3, 3.1], target: [-0.15, 0.30, 0.05] },
  pickable: true,
  controlSchema: {
    angle: { label: 'angle', min: 0, max: 6.28, step: 0.01, value: 1.2 },
    length: { label: 'longueur', min: 0.1, max: 1.4, step: 0.01, value: 0.9 },
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
// CH 8 — Transport parallèle — deux vecteurs pour montrer la conservation de l'angle
// ===========================================================================
const ch8 = {
  id: 'transport',
  eyebrow: 'Transport parallèle',
  title: 'Glisser un vecteur',
  body: `Déplacer naïvement un vecteur de T<sub>p</sub>ℳ vers T<sub>q</sub>ℳ rompt la
    tangence. La <em>connexion de Levi-Civita</em> définit le transport canonique compatible
    avec la métrique. <strong>Deux vecteurs</strong> W₁(t), W₂(t) sont transportés
    simultanément — leur angle mutuel est préservé le long de toute la géodésique.`,
  formula: String.raw`\nabla_{\dot\gamma} W = 0,\qquad
    \bigl\|W(t)\bigr\|_{\gamma(t)} = \mathrm{const}`,
  camera: { pos: [2.7, 2.4, 3.4], target: [0.05, 0.30, 0.10] },
  pickable: 'q',
  enter(ctx) {
    const palette = ctx.palette;
    const stateP = ctx.p.clone(), stateQ = ctx.q.clone();
    const dotP   = pointMarker(stateP, palette.p, palette);         ctx.group.add(dotP);
    const dotQ   = pointMarker(stateQ, palette.q, palette);         ctx.group.add(dotQ);
    const dotNow = pointMarker(stateP, palette.transport, palette, 0.028); ctx.group.add(dotNow);
    const lblP   = lbl(ctx, 'p',    new THREE.Vector3(), { accent: true });
    const lblQ   = lbl(ctx, 'q',    new THREE.Vector3(), { q: true });
    const lblW   = lbl(ctx, 'W₁(0)', new THREE.Vector3(), { transport: true, small: true });
    const lblW2  = lbl(ctx, 'W₂(0)', new THREE.Vector3(), { q: true,        small: true });
    const lblWt  = lbl(ctx, 'W₁(t)', new THREE.Vector3(), { transport: true, small: true });
    const lblWt2 = lbl(ctx, 'W₂(t)', new THREE.Vector3(), { q: true,        small: true });
    let geo = buildPolyline({ points: [new THREE.Vector3()], color: palette.geodesic, opacity: 0.85 });
    ctx.group.add(geo);
    let initialArrow  = tangentArrow(stateP, new THREE.Vector3(0.1, 0, 0), palette.transport);
    let initialArrow2 = tangentArrow(stateP, new THREE.Vector3(0.1, 0, 0), palette.q);
    let movingArrow   = tangentArrow(stateP, new THREE.Vector3(0.1, 0, 0), palette.transport);
    let movingArrow2  = tangentArrow(stateP, new THREE.Vector3(0.1, 0, 0), palette.q);
    ctx.group.add(initialArrow); ctx.group.add(initialArrow2);
    ctx.group.add(movingArrow);  ctx.group.add(movingArrow2);
    let ghost = tangentArrow(stateQ, new THREE.Vector3(0.1, 0, 0), palette.ink3Num);
    ctx.group.add(ghost);
    let cachedPath = null, cachedW = null, cachedW2 = null, cachedPts = null, cachedDt = null;

    function recompute() {
      const v   = T.logMap(stateP, stateQ);
      const duv = T.worldToParam(stateP, v);
      const r   = T.traceGeodesic(stateP, duv, 1, 96);
      cachedPath = r.path; cachedDt = r.dt; cachedPts = r.points;
      const initParam = new THREE.Vector2(duv.x, duv.y);
      const W0 = new THREE.Vector2(-initParam.y, initParam.x);
      const gn = T.gNorm(stateP, W0);
      W0.multiplyScalar(0.55 / Math.max(gn, 1e-6));
      cachedW = T.parallelTransport(cachedPath, cachedDt, W0);
      const W02 = new THREE.Vector2(initParam.x, initParam.y);
      const gn2 = T.gNorm(stateP, W02);
      W02.multiplyScalar(0.45 / Math.max(gn2, 1e-6));
      cachedW2 = T.parallelTransport(cachedPath, cachedDt, W02);
    }

    function draw(t) {
      const idx = Math.min(cachedPath.length - 1, Math.round(t * (cachedPath.length - 1)));
      const ss  = cachedPath[idx];
      const ww  = cachedW[idx];
      const ww2 = cachedW2[idx];
      const pos    = T.surfacePoint(ss.u, ss.v).addScaledVector(T.normalAt(ss.u, ss.v), 0.006);
      const wWorld  = T.paramToWorld(new THREE.Vector2(ss.u, ss.v), new THREE.Vector2(ww.Wu,  ww.Wv));
      const wWorld2 = T.paramToWorld(new THREE.Vector2(ss.u, ss.v), new THREE.Vector2(ww2.Wu, ww2.Wv));
      movingArrow.userData.update(pos,  wWorld.clone(),  wWorld.length());
      movingArrow2.userData.update(pos, wWorld2.clone(), wWorld2.length());
      dotNow.position.copy(pos);
      lblWt.update(pos.clone().addScaledVector(wWorld,  0.55).add(new THREE.Vector3( 0.03,  0.06, 0)));
      lblWt2.update(pos.clone().addScaledVector(wWorld2, 0.55).add(new THREE.Vector3(-0.03, -0.06, 0)));
    }

    function refresh(t = 0) {
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
      const W0  = cachedW[0];
      const W02 = cachedW2[0];
      const w0World  = T.paramToWorld(stateP, new THREE.Vector2(W0.Wu,  W0.Wv));
      const w02World = T.paramToWorld(stateP, new THREE.Vector2(W02.Wu, W02.Wv));
      initialArrow.userData.update(pLift,  w0World.clone(),  w0World.length());
      initialArrow2.userData.update(pLift, w02World.clone(), w02World.length());
      lblW.update(pLift.clone().addScaledVector(w0World,  0.55).add(new THREE.Vector3( 0.03,  0.06, 0)));
      lblW2.update(pLift.clone().addScaledVector(w02World, 0.55).add(new THREE.Vector3(-0.03, -0.06, 0)));
      ghost.userData.update(qLift, w0World.clone(), w0World.length());
      draw(t);
    }

    let animT = 0;
    const TRAVEL = 3.8;
    const HOLD = 0.9;
    let phase = 'travel';
    let phaseT = 0;

    refresh(0);

    return {
      tick(time, dt) {
        if (phase === 'travel') {
          phaseT += dt;
          animT = Math.min(1, phaseT / TRAVEL);
          if (animT >= 1) { phase = 'hold'; phaseT = 0; }
        } else {
          phaseT += dt;
          if (phaseT > HOLD) { phase = 'travel'; phaseT = 0; animT = 0; }
        }
        draw(animT);
      },
      onPick(uv) { stateQ.copy(uv); ctx.q.copy(uv); refresh(animT); },
    };
  },
};

export const CHAPTERS = [ch1, ch2, ch3, ch4, ch5, ch6, ch7, ch8];
