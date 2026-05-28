// Riemannian geometry on a height-function surface M = { (u, h(u,v), v) : (u,v) ∈ Ω }
// embedded in ℝ³ with the inherited metric.
//
// Conventions
//   World: three.js, y-up.
//   Surface parameterization r(u, v) = (u, h(u, v), v).
//   "Param coords" (u, v) ↔ "world point" via surfacePoint(u, v).
//   A tangent vector at p has param-coord components (a, b) and world-vector
//   components a · r_u + b · r_v = (a, h_u·a + h_v·b, b).
//   So conversion world ↔ param is trivial: param = (worldX, worldZ).

import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Terrain definition. Sum of Gaussians.
// ---------------------------------------------------------------------------
export const TERRAIN = {
  L: 1.8,
  bumps: [
    { x: -0.75, z: -0.55, A:  0.62, s: 0.55 },
    { x:  0.85, z:  0.55, A:  0.52, s: 0.62 },
    { x:  0.05, z:  1.05, A: -0.40, s: 0.55 },
    { x: -0.95, z:  0.90, A:  0.18, s: 0.45 },
  ],
};

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export { clamp };

export function h(u, v) {
  let s = 0;
  for (const b of TERRAIN.bumps) {
    const dx = u - b.x, dz = v - b.z;
    s += b.A * Math.exp(-(dx*dx + dz*dz) / (2 * b.s * b.s));
  }
  return s;
}
export function hu(u, v) {
  let s = 0;
  for (const b of TERRAIN.bumps) {
    const dx = u - b.x, dz = v - b.z;
    const g = Math.exp(-(dx*dx + dz*dz) / (2 * b.s * b.s));
    s += -b.A * dx / (b.s * b.s) * g;
  }
  return s;
}
export function hv(u, v) {
  let s = 0;
  for (const b of TERRAIN.bumps) {
    const dx = u - b.x, dz = v - b.z;
    const g = Math.exp(-(dx*dx + dz*dz) / (2 * b.s * b.s));
    s += -b.A * dz / (b.s * b.s) * g;
  }
  return s;
}
export function huu(u, v) {
  let s = 0;
  for (const b of TERRAIN.bumps) {
    const dx = u - b.x, dz = v - b.z;
    const s2 = b.s * b.s;
    const g = Math.exp(-(dx*dx + dz*dz) / (2 * s2));
    s += b.A / s2 * (dx*dx / s2 - 1) * g;
  }
  return s;
}
export function hvv(u, v) {
  let s = 0;
  for (const b of TERRAIN.bumps) {
    const dx = u - b.x, dz = v - b.z;
    const s2 = b.s * b.s;
    const g = Math.exp(-(dx*dx + dz*dz) / (2 * s2));
    s += b.A / s2 * (dz*dz / s2 - 1) * g;
  }
  return s;
}
export function huv(u, v) {
  let s = 0;
  for (const b of TERRAIN.bumps) {
    const dx = u - b.x, dz = v - b.z;
    const s2 = b.s * b.s;
    const g = Math.exp(-(dx*dx + dz*dz) / (2 * s2));
    s += b.A * dx * dz / (s2 * s2) * g;
  }
  return s;
}

export function surfacePoint(u, v) {
  return new THREE.Vector3(u, h(u, v), v);
}
export function lift(uv) { return surfacePoint(uv.x, uv.y); }

export function normalAt(u, v) {
  const a = -hu(u, v), b = 1, c = -hv(u, v);
  const W = Math.sqrt(a*a + b*b + c*c);
  return new THREE.Vector3(a / W, b / W, c / W);
}

export function W(u, v) {
  const a = hu(u, v), b = hv(u, v);
  return Math.sqrt(1 + a*a + b*b);
}

export function basis(u, v) {
  const ru = new THREE.Vector3(1, hu(u, v), 0);
  const rv = new THREE.Vector3(0, hv(u, v), 1);
  return [ru, rv];
}

export function worldToParam(_p, vWorld) {
  return new THREE.Vector2(vWorld.x, vWorld.z);
}

export function paramToWorld(uv, ab) {
  const a = ab.x, b = ab.y;
  return new THREE.Vector3(a, hu(uv.x, uv.y) * a + hv(uv.x, uv.y) * b, b);
}

export function projectTangent(uv, wWorld) {
  const n = normalAt(uv.x, uv.y);
  const c = wWorld.dot(n);
  return wWorld.clone().addScaledVector(n, -c);
}

export function metric(u, v) {
  const a = hu(u, v), b = hv(u, v);
  return { E: 1 + a*a, F: a*b, G: 1 + b*b, det: 1 + a*a + b*b };
}

export function gInner(uv, ab1, ab2) {
  const m = metric(uv.x, uv.y);
  return m.E * ab1.x * ab2.x + m.F * (ab1.x * ab2.y + ab1.y * ab2.x) + m.G * ab1.y * ab2.y;
}

export function gNorm(uv, ab) { return Math.sqrt(Math.max(0, gInner(uv, ab, ab))); }

function rhsGeodesic(u, v, du, dv) {
  const Hu = hu(u, v), Hv = hv(u, v);
  const Huu = huu(u, v), Hvv = hvv(u, v), Huv = huv(u, v);
  const W2 = 1 + Hu*Hu + Hv*Hv;
  const Q = Huu * du*du + 2 * Huv * du * dv + Hvv * dv * dv;
  return { ddu: -Hu * Q / W2, ddv: -Hv * Q / W2 };
}

function geodesicStep(y, dt) {
  const f1 = rhsGeodesic(y.u, y.v, y.du, y.dv);
  const k1 = { u: y.du, v: y.dv, du: f1.ddu, dv: f1.ddv };
  const y2u = y.u + 0.5*dt*k1.u, y2v = y.v + 0.5*dt*k1.v;
  const y2du = y.du + 0.5*dt*k1.du, y2dv = y.dv + 0.5*dt*k1.dv;
  const f2 = rhsGeodesic(y2u, y2v, y2du, y2dv);
  const k2 = { u: y2du, v: y2dv, du: f2.ddu, dv: f2.ddv };
  const y3u = y.u + 0.5*dt*k2.u, y3v = y.v + 0.5*dt*k2.v;
  const y3du = y.du + 0.5*dt*k2.du, y3dv = y.dv + 0.5*dt*k2.dv;
  const f3 = rhsGeodesic(y3u, y3v, y3du, y3dv);
  const k3 = { u: y3du, v: y3dv, du: f3.ddu, dv: f3.ddv };
  const y4u = y.u + dt*k3.u, y4v = y.v + dt*k3.v;
  const y4du = y.du + dt*k3.du, y4dv = y.dv + dt*k3.dv;
  const f4 = rhsGeodesic(y4u, y4v, y4du, y4dv);
  const k4 = { u: y4du, v: y4dv, du: f4.ddu, dv: f4.ddv };
  return {
    u:  y.u  + (dt/6)*(k1.u  + 2*k2.u  + 2*k3.u  + k4.u),
    v:  y.v  + (dt/6)*(k1.v  + 2*k2.v  + 2*k3.v  + k4.v),
    du: y.du + (dt/6)*(k1.du + 2*k2.du + 2*k3.du + k4.du),
    dv: y.dv + (dt/6)*(k1.dv + 2*k2.dv + 2*k3.dv + k4.dv),
  };
}

export function traceGeodesic(uv, duv, T, steps = 96) {
  const dt = T / steps;
  let y = { u: uv.x, v: uv.y, du: duv.x, dv: duv.y };
  const pts = [surfacePoint(y.u, y.v)];
  const path = [{ ...y }];
  for (let i = 0; i < steps; i++) {
    y = geodesicStep(y, dt);
    pts.push(surfacePoint(y.u, y.v));
    path.push({ ...y });
  }
  return { points: pts, finalState: y, path, dt };
}

export function expMap(uv, vWorld, steps = 64) {
  const duv = worldToParam(uv, vWorld);
  const r = traceGeodesic(uv, duv, 1, steps);
  return { uv: new THREE.Vector2(r.finalState.u, r.finalState.v),
           point: surfacePoint(r.finalState.u, r.finalState.v),
           points: r.points };
}

export function logMap(pUV, qUV, opts = {}) {
  const maxIter = opts.maxIter ?? 30;
  const tol = opts.tol ?? 1e-5;
  const steps = opts.steps ?? 48;
  const pW = surfacePoint(pUV.x, pUV.y);
  const qW = surfacePoint(qUV.x, qUV.y);
  const disp = qW.clone().sub(pW);
  const dispT = projectTangent(pUV, disp);
  let v = new THREE.Vector2(dispT.x, dispT.z);
  const target = new THREE.Vector2(qUV.x, qUV.y);
  for (let it = 0; it < maxIter; it++) {
    const r = traceGeodesic(pUV, v, 1, steps);
    const end = new THREE.Vector2(r.finalState.u, r.finalState.v);
    const resid = end.clone().sub(target);
    if (resid.length() < tol) break;
    const eps = 1e-4;
    const rP = traceGeodesic(pUV, new THREE.Vector2(v.x + eps, v.y), 1, steps);
    const rQ = traceGeodesic(pUV, new THREE.Vector2(v.x, v.y + eps), 1, steps);
    const dEdu = new THREE.Vector2((rP.finalState.u - end.x)/eps, (rP.finalState.v - end.y)/eps);
    const dEdv = new THREE.Vector2((rQ.finalState.u - end.x)/eps, (rQ.finalState.v - end.y)/eps);
    const a = dEdu.x, b = dEdv.x, c = dEdu.y, d = dEdv.y;
    const det = a*d - b*c;
    if (Math.abs(det) < 1e-12) break;
    const rx = -resid.x, ry = -resid.y;
    const dvu = ( d*rx - b*ry) / det;
    const dvv = (-c*rx + a*ry) / det;
    let step = 1.0;
    const stepNorm = Math.hypot(dvu, dvv);
    if (stepNorm > 1.5) step = 1.5 / stepNorm;
    v.x += step * dvu;
    v.y += step * dvv;
  }
  return paramToWorld(pUV, v);
}

export function retract(uv, vWorld) {
  const pW = surfacePoint(uv.x, uv.y);
  const stepped = pW.clone().add(vWorld);
  const u2 = stepped.x, v2 = stepped.z;
  return { uv: new THREE.Vector2(u2, v2), point: surfacePoint(u2, v2) };
}

function transportRHS(u, v, du, dv, Wu, Wv) {
  const Hu = hu(u, v), Hv = hv(u, v);
  const Huu = huu(u, v), Hvv = hvv(u, v), Huv = huv(u, v);
  const W2 = 1 + Hu*Hu + Hv*Hv;
  const S = Huu*du*Wu + Huv*(du*Wv + dv*Wu) + Hvv*dv*Wv;
  return { dWu: -Hu*S/W2, dWv: -Hv*S/W2 };
}

export function parallelTransport(path, dt, initialW) {
  const Ws = [{ Wu: initialW.x, Wv: initialW.y }];
  let Ww = { Wu: initialW.x, Wv: initialW.y };
  for (let i = 0; i < path.length - 1; i++) {
    const s1 = path[i], s2 = path[i+1];
    const interp = (t) => ({
      u:  s1.u  + t*(s2.u  - s1.u),
      v:  s1.v  + t*(s2.v  - s1.v),
      du: s1.du + t*(s2.du - s1.du),
      dv: s1.dv + t*(s2.dv - s1.dv),
    });
    const a0 = interp(0), a1 = interp(0.5), a2 = interp(1);
    const k1 = transportRHS(a0.u, a0.v, a0.du, a0.dv, Ww.Wu, Ww.Wv);
    const k2 = transportRHS(a1.u, a1.v, a1.du, a1.dv, Ww.Wu+0.5*dt*k1.dWu, Ww.Wv+0.5*dt*k1.dWv);
    const k3 = transportRHS(a1.u, a1.v, a1.du, a1.dv, Ww.Wu+0.5*dt*k2.dWu, Ww.Wv+0.5*dt*k2.dWv);
    const k4 = transportRHS(a2.u, a2.v, a2.du, a2.dv, Ww.Wu+dt*k3.dWu, Ww.Wv+dt*k3.dWv);
    Ww = {
      Wu: Ww.Wu + (dt/6)*(k1.dWu + 2*k2.dWu + 2*k3.dWu + k4.dWu),
      Wv: Ww.Wv + (dt/6)*(k1.dWv + 2*k2.dWv + 2*k3.dWv + k4.dWv),
    };
    Ws.push({ ...Ww });
  }
  return Ws;
}

export function gaussCurvature(u, v) {
  const Hu = hu(u, v), Hv = hv(u, v);
  const W2 = 1 + Hu*Hu + Hv*Hv;
  return (huu(u, v) * hvv(u, v) - huv(u, v)**2) / (W2 * W2);
}

export function geodesicDistance(pUV, qUV) {
  const v = logMap(pUV, qUV);
  const ab = worldToParam(pUV, v);
  return gNorm(pUV, ab);
}

export function clampDomain(uv, pad = 0) {
  const L = TERRAIN.L - pad;
  return new THREE.Vector2(clamp(uv.x, -L, L), clamp(uv.y, -L, L));
}

export function orthoFrame(uv) {
  const n = normalAt(uv.x, uv.y);
  let e1 = new THREE.Vector3(1, 0, 0);
  e1.addScaledVector(n, -e1.dot(n));
  e1.normalize();
  const e2 = new THREE.Vector3().crossVectors(n, e1).normalize();
  return [e1, e2];
}
