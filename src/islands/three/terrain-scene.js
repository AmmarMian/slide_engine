// Terrain-specific scene helpers. Reuses palette / arrows / polylines / dots
// from scene.js; adds the surface mesh, iso-parametric grid, boundary frame,
// tangent-disc, and a vertex-colored curvature heatmap.

import * as THREE from 'three';
import * as T from './terrain-math.js';

// ---------------------------------------------------------------------------
// Surface geometry: r(u,v) = (u, h(u,v), v) on a regular grid.
// ---------------------------------------------------------------------------
export function buildTerrainGeometry({ N = 192 } = {}) {
  const L = T.TERRAIN.L;
  const positions = new Float32Array((N+1)*(N+1)*3);
  const normals   = new Float32Array((N+1)*(N+1)*3);
  const curvature = new Float32Array((N+1)*(N+1));
  const indices = [];

  for (let j = 0; j <= N; j++) {
    const v = -L + (2*L)*(j/N);
    for (let i = 0; i <= N; i++) {
      const u = -L + (2*L)*(i/N);
      const idx = j*(N+1) + i;
      positions[3*idx+0] = u;
      positions[3*idx+1] = T.h(u, v);
      positions[3*idx+2] = v;
      const n = T.normalAt(u, v);
      normals[3*idx+0] = n.x;
      normals[3*idx+1] = n.y;
      normals[3*idx+2] = n.z;
      curvature[idx] = T.gaussCurvature(u, v);
    }
  }
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const a = j*(N+1)+i, b = a+1, c = a+(N+1), d = c+1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('normal',   new THREE.BufferAttribute(normals, 3));
  g.setAttribute('aK',       new THREE.BufferAttribute(curvature, 1));
  g.setIndex(indices);
  return g;
}

// ---------------------------------------------------------------------------
// Terrain body mesh. style: 'translucent' | 'matte' | 'curvature'
// ---------------------------------------------------------------------------
export function buildTerrain({ style = 'translucent', palette }) {
  const group = new THREE.Group();
  group.name = 'terrain';
  const geom = buildTerrainGeometry({ N: 192 });

  let mat;
  if (style === 'translucent') {
    mat = new THREE.MeshStandardMaterial({
      color: palette.sphere,
      transparent: true, opacity: 0.78, roughness: 0.55, metalness: 0.04,
      emissive: palette.sphereEmit, emissiveIntensity: 0.5,
      side: THREE.DoubleSide, depthWrite: true,
    });
  } else if (style === 'matte') {
    mat = new THREE.MeshStandardMaterial({
      color: palette.sphere, roughness: 0.78, metalness: 0.04,
      emissive: palette.sphereEmit, emissiveIntensity: 0.55,
      side: THREE.DoubleSide,
    });
  } else {
    mat = buildCurvatureMaterial(palette);
  }

  const body = new THREE.Mesh(geom, mat);
  body.name = 'body';
  group.add(body);
  group.add(buildBoundary(palette));
  group.userData = { body, style };
  return group;
}

function buildCurvatureMaterial(palette) {
  const cool = new THREE.Color(palette.tCool || '#3b6ea8');
  const warm = new THREE.Color(palette.tWarm || '#d97706');
  const neut = new THREE.Color(palette.tNeutral || '#dad5cc');
  return new THREE.ShaderMaterial({
    uniforms: {
      uCool: { value: cool }, uWarm: { value: warm }, uNeut: { value: neut },
      uK0:   { value: 2.4 },
      uLight: { value: new THREE.Vector3(3.5, 4.5, 5.5).normalize() },
      uAmbient: { value: 0.55 },
    },
    vertexShader: /* glsl */`
      attribute float aK;
      varying float vK;
      varying vec3 vN;
      void main() {
        vK = aK;
        vN = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      varying float vK;
      varying vec3 vN;
      uniform vec3 uCool, uWarm, uNeut;
      uniform float uK0, uAmbient;
      uniform vec3 uLight;
      void main() {
        float t = tanh(vK * uK0);
        vec3 base = (t > 0.0) ? mix(uNeut, uWarm, t) : mix(uNeut, uCool, -t);
        float diff = max(0.0, dot(normalize(vN), normalize(uLight)));
        float shade = uAmbient + (1.0 - uAmbient) * diff;
        gl_FragColor = vec4(base * shade, 1.0);
      }
    `,
    side: THREE.DoubleSide,
  });
}

// ---------------------------------------------------------------------------
// Iso-parametric grid (const-u and const-v curves on the surface).
// ---------------------------------------------------------------------------
export function buildIsoGrid({ palette, nLines = 9, samples = 96, lift = 0.0015 } = {}) {
  const L = T.TERRAIN.L;
  const pts = [];
  for (let i = 0; i <= nLines; i++) {
    const u = -L + (2*L)*(i/nLines);
    for (let j = 0; j < samples; j++) {
      const v1 = -L + (2*L)*(j/samples);
      const v2 = -L + (2*L)*((j+1)/samples);
      pts.push(new THREE.Vector3(u, T.h(u, v1)+lift, v1));
      pts.push(new THREE.Vector3(u, T.h(u, v2)+lift, v2));
    }
  }
  for (let j = 0; j <= nLines; j++) {
    const v = -L + (2*L)*(j/nLines);
    for (let i = 0; i < samples; i++) {
      const u1 = -L + (2*L)*(i/samples);
      const u2 = -L + (2*L)*((i+1)/samples);
      pts.push(new THREE.Vector3(u1, T.h(u1, v)+lift, v));
      pts.push(new THREE.Vector3(u2, T.h(u2, v)+lift, v));
    }
  }
  const geom = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({
    color: palette.grid, transparent: true, opacity: palette.gridAlpha * 0.9,
  });
  const seg = new THREE.LineSegments(geom, mat);
  seg.name = 'isoGrid';
  return seg;
}

function buildBoundary(palette) {
  const L = T.TERRAIN.L;
  const N = 64;
  const pts = [];
  const seg = (a, b) => {
    for (let i = 0; i <= N; i++) {
      const t = i/N;
      const u = a.x + t*(b.x - a.x);
      const v = a.y + t*(b.y - a.y);
      pts.push(new THREE.Vector3(u, T.h(u, v)+0.002, v));
    }
  };
  seg(new THREE.Vector2(-L,-L), new THREE.Vector2( L,-L));
  seg(new THREE.Vector2( L,-L), new THREE.Vector2( L, L));
  seg(new THREE.Vector2( L, L), new THREE.Vector2(-L, L));
  seg(new THREE.Vector2(-L, L), new THREE.Vector2(-L,-L));
  const geom = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({
    color: palette.ink2Num, transparent: true, opacity: 0.55,
  });
  return new THREE.Line(geom, mat);
}

// ---------------------------------------------------------------------------
// Ground plane (subtle anchor).
// ---------------------------------------------------------------------------
export function buildGround({ palette }) {
  const L = T.TERRAIN.L * 1.18;
  const g = new THREE.PlaneGeometry(2*L, 2*L);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.MeshBasicMaterial({
    color: palette.bgNum, transparent: true, opacity: 0.0, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.position.y = -0.85;
  return mesh;
}

// ---------------------------------------------------------------------------
// Tangent-plane disc at p (on the surface). Oriented to surface normal n(p).
// ---------------------------------------------------------------------------
export function buildTangentDisc({ uv, radius = 0.55, palette }) {
  const group = new THREE.Group();
  group.name = 'tangentDisc';

  const fillMat = new THREE.MeshBasicMaterial({
    color: palette.tangent, transparent: true, opacity: 0.16,
    side: THREE.DoubleSide, depthWrite: false,
  });
  group.add(new THREE.Mesh(new THREE.CircleGeometry(radius, 96), fillMat));

  const ringPts = [];
  for (let i = 0; i <= 192; i++) {
    const t = (i/192)*Math.PI*2;
    ringPts.push(new THREE.Vector3(radius*Math.cos(t), radius*Math.sin(t), 0));
  }
  const ringMat = new THREE.LineBasicMaterial({
    color: palette.tangent, transparent: true, opacity: 0.85,
  });
  group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ringPts), ringMat));

  orientDiscAt(group, uv);
  group.userData = { update(newUV) { orientDiscAt(group, newUV); } };
  return group;
}

function orientDiscAt(disc, uv) {
  const p = T.surfacePoint(uv.x, uv.y);
  const n = T.normalAt(uv.x, uv.y);
  disc.position.copy(p).addScaledVector(n, 0.002);
  const z = new THREE.Vector3(0, 0, 1);
  const q = new THREE.Quaternion().setFromUnitVectors(z, n);
  disc.quaternion.copy(q);
}

// ---------------------------------------------------------------------------
// Pick: raycast onto the terrain mesh.
// ---------------------------------------------------------------------------
export function pickTerrain(event, canvas, camera, terrainGroup) {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width)  * 2 - 1;
  const y = -((event.clientY - rect.top)  / rect.height) * 2 + 1;
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera({ x, y }, camera);
  const body = terrainGroup.userData.body;
  const hits = raycaster.intersectObject(body, false);
  if (!hits.length) return null;
  const w = hits[0].point;
  return new THREE.Vector2(w.x, w.z);
}
