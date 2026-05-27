// Riemannian geometry on the unit 2-sphere S² ⊂ ℝ³.
// All vectors are THREE.Vector3. The base manifold is the unit sphere,
// so the metric is the one inherited from ℝ³: ⟨u,v⟩_p = u·v for u,v ∈ T_pS².

import * as THREE from 'three';

const TINY = 1e-9;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// ----- basic projections ------------------------------------------------

/** Snap a point to the sphere. */
export function toSphere(x) {
  return x.clone().normalize();
}

/** Project a Euclidean vector v ∈ ℝ³ onto the tangent space T_p S².
 *  T_p S² = { v ∈ ℝ³ : ⟨v, p⟩ = 0 }.
 *  Π_p(v) = v − ⟨v, p⟩ p. */
export function projectTangent(p, v) {
  const c = v.dot(p);
  return v.clone().addScaledVector(p, -c);
}

// ----- exp / log / retract ---------------------------------------------

/** Exponential map exp_p(v) for v ∈ T_pS².
 *  exp_p(v) = cos(‖v‖) p + sin(‖v‖) · v/‖v‖. */
export function expMap(p, v) {
  const n = v.length();
  if (n < TINY) return p.clone();
  return p.clone().multiplyScalar(Math.cos(n))
    .addScaledVector(v, Math.sin(n) / n);
}

/** Logarithm map log_p(q) ∈ T_pS² (inverse of exp_p).
 *  Let θ = arccos(⟨p,q⟩). log_p(q) = θ · Π_p(q) / ‖Π_p(q)‖. */
export function logMap(p, q) {
  const c = clamp(p.dot(q), -1, 1);
  const theta = Math.acos(c);
  if (theta < TINY) return new THREE.Vector3(0, 0, 0);
  const w = q.clone().addScaledVector(p, -c);
  const wn = w.length();
  if (wn < TINY) return new THREE.Vector3(0, 0, 0);
  return w.multiplyScalar(theta / wn);
}

/** Cheap first-order retraction (normalization).
 *  R_p(v) = (p + v) / ‖p + v‖. */
export function retract(p, v) {
  return p.clone().add(v).normalize();
}

/** Parallel transport of w ∈ T_pS² along the geodesic from p to q.
 *  Closed form on S²: rotate w by angle θ = d(p,q) in the plane span(p,q). */
export function parallelTransport(p, q, w) {
  const c = clamp(p.dot(q), -1, 1);
  const theta = Math.acos(c);
  if (theta < TINY) return w.clone();
  // u: unit vector at p pointing along geodesic toward q
  const u = q.clone().addScaledVector(p, -c).normalize();
  // u_at_q: tangent at q to the same geodesic (γ'(θ))
  const uAtQ = p.clone().multiplyScalar(-Math.sin(theta))
    .addScaledVector(u, Math.cos(theta));
  const wPar = w.dot(u);                                // component along u
  const wPerp = w.clone().addScaledVector(u, -wPar);    // perp survives
  return wPerp.addScaledVector(uAtQ, wPar);
}

// ----- curves ----------------------------------------------------------

/** Point at arc length t along geodesic from p in unit-tangent direction u. */
export function geodesicPoint(p, uUnit, t) {
  return p.clone().multiplyScalar(Math.cos(t))
    .addScaledVector(uUnit, Math.sin(t));
}

/** Sample geodesic arc from p to q. */
export function geodesicArc(p, q, n = 96) {
  const c = clamp(p.dot(q), -1, 1);
  const theta = Math.acos(c);
  const pts = [];
  if (theta < TINY) { pts.push(p.clone(), q.clone()); return pts; }
  const u = q.clone().addScaledVector(p, -c).normalize();
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * theta;
    pts.push(geodesicPoint(p, u, t));
  }
  return pts;
}

/** Sample geodesic ray from p in tangent direction v, of arc length ‖v‖. */
export function geodesicRay(p, v, n = 96) {
  const len = v.length();
  if (len < TINY) return [p.clone()];
  const u = v.clone().multiplyScalar(1 / len);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * len;
    pts.push(geodesicPoint(p, u, t));
  }
  return pts;
}

// ----- helpers ---------------------------------------------------------

/** Build a unit point from latitude/longitude in radians. */
export function fromLatLon(lat, lon) {
  return new THREE.Vector3(
    Math.cos(lat) * Math.cos(lon),
    Math.sin(lat),
    Math.cos(lat) * Math.sin(lon),
  );
}

/** Random orthonormal pair of tangent vectors at p (for picking a frame). */
export function tangentFrame(p) {
  const ref = Math.abs(p.y) < 0.9
    ? new THREE.Vector3(0, 1, 0)
    : new THREE.Vector3(1, 0, 0);
  const e1 = projectTangent(p, ref).normalize();
  const e2 = new THREE.Vector3().crossVectors(p, e1).normalize();
  return [e1, e2];
}

// ----- Riemannian gradients for our cost functions ---------------------

/** Riemannian gradient = projection of Euclidean gradient onto T_pM. */
export function riemannianGradient(p, eucGrad) {
  return projectTangent(p, eucGrad);
}

/** Rayleigh quotient: f(x) = xᵀ A x.  ∇f(x) = 2 A x. */
export function rayleighGrad(p, A) {
  // A is a 3x3 array of arrays
  return new THREE.Vector3(
    2 * (A[0][0]*p.x + A[0][1]*p.y + A[0][2]*p.z),
    2 * (A[1][0]*p.x + A[1][1]*p.y + A[1][2]*p.z),
    2 * (A[2][0]*p.x + A[2][1]*p.y + A[2][2]*p.z),
  );
}

export function rayleighValue(p, A) {
  return (
    p.x*(A[0][0]*p.x + A[0][1]*p.y + A[0][2]*p.z) +
    p.y*(A[1][0]*p.x + A[1][1]*p.y + A[1][2]*p.z) +
    p.z*(A[2][0]*p.x + A[2][1]*p.y + A[2][2]*p.z)
  );
}

/** Squared geodesic distance to target t:  f(x) = (arccos⟨x,t⟩)² / 2.
 *  ∇_R f(x) = − log_x(t). */
export function distSqValue(p, t) {
  const c = clamp(p.dot(t), -1, 1);
  const th = Math.acos(c);
  return 0.5 * th * th;
}

export function distSqGradRiem(p, t) {
  return logMap(p, t).multiplyScalar(-1);
}

/** Fréchet mean cost: Σ ½ d(x, tᵢ)².  Riem grad = − Σ log_x(tᵢ). */
export function frechetValue(p, targets) {
  let s = 0;
  for (const t of targets) s += distSqValue(p, t);
  return s / targets.length;
}

export function frechetGradRiem(p, targets) {
  const g = new THREE.Vector3();
  for (const t of targets) g.add(distSqGradRiem(p, t));
  return g.multiplyScalar(1 / targets.length);
}
