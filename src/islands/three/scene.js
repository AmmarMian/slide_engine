// Shared scene building blocks: palettes, sphere, grid, lights, helper visuals.
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// palette: read live CSS vars (written by apply-theme.js) and produce a
// Three.js-friendly object (hex numbers, not strings) plus computed flags.
// ---------------------------------------------------------------------------
const hex = (s) => {
  // accept "#aabbcc" or "#abc" or "rgb(...)" → number
  s = (s || '').trim();
  if (!s) return 0x000000;
  if (s.startsWith('#')) {
    let h = s.slice(1);
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    return parseInt(h, 16);
  }
  // fall back: parse via temporary element
  const tmp = document.createElement('div');
  tmp.style.color = s;
  document.body.appendChild(tmp);
  const cs = getComputedStyle(tmp).color;
  document.body.removeChild(tmp);
  const m = cs.match(/(\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return 0x000000;
  return (Number(m[1]) << 16) | (Number(m[2]) << 8) | Number(m[3]);
};

const luma = (rgbHex) => {
  const r = (rgbHex >> 16) & 0xff;
  const g = (rgbHex >> 8) & 0xff;
  const b = rgbHex & 0xff;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};

/** Returns a palette object derived from the current CSS vars.
 *  Call this whenever the theme changes (apply-theme rewrites the vars). */
export function getPalette() {
  const cs = getComputedStyle(document.documentElement);
  const v = (k) => cs.getPropertyValue(k).trim();
  const bgHex     = hex(v('--bg'));
  const bg2Hex    = hex(v('--bg-2'));
  const inkHex    = hex(v('--ink'));
  const ink2Hex   = hex(v('--ink-2'));
  const ink3Hex   = hex(v('--ink-3'));
  const tintHex   = hex(v('--tint'));
  const accentHex = hex(v('--accent'));
  const isDark    = luma(bgHex) < 0.5;

  return {
    bg:       v('--bg'),
    bg2:      v('--bg-2'),
    ink:      v('--ink'),
    ink2:     v('--ink-2'),
    ink3:     v('--ink-3'),
    rule:     v('--rule'),
    accent:   v('--accent'),
    isDark,

    // numeric (Three.js)
    bgNum:    bgHex,
    inkNum:   inkHex,
    ink2Num:  ink2Hex,
    ink3Num:  ink3Hex,
    tintNum:  tintHex,
    accentNum: accentHex,

    // sphere appearance: warm tinted body, derived per-theme so contrast
    // works on both paper and night backgrounds.
    sphere:       isDark ? mix(bgHex, inkHex, 0.18) : mix(bgHex, inkHex, 0.10),
    sphereEmit:   isDark ? mix(bgHex, accentHex, 0.05) : 0x000000,
    grid:         inkHex,
    gridAlpha:    isDark ? 0.22 : 0.18,
    equator:      inkHex,
    equatorAlpha: isDark ? 0.40 : 0.30,

    // lighting tones
    ambient:      isDark ? mix(bgHex, inkHex, 0.30) : mix(bgHex, inkHex, 0.10),
    key:          0xffffff,
    fill:         isDark ? 0x6a8bbe : 0xb8b0a0,
    rim:          accentHex,

    // primary viz semantic colors — pulled from the Swiss accent palette
    p:            accentHex,
    q:            hex(v('--viz-q')        || '#0d9488'),
    tangent:      hex(v('--viz-tangent')  || '#2563eb'),
    geodesic:     hex(v('--viz-geodesic') || '#d97706'),
    euclid:       hex(v('--viz-euclid')   || '#ff4f30'),
    transport:    hex(v('--viz-transport')|| '#7c3aed'),
    retraction:   hex(v('--viz-retract')  || '#059669'),
    trail:        hex(v('--viz-trail')    || '#d97706'),

    // CSS-string equivalents for plot canvases
    textDim:      v('--ink-3'),
  };
}

function mix(a, b, t) {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const c = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | c;
}

// retained for back-compat (some legacy code referenced PALETTES.dark / light)
export const PALETTES = new Proxy({}, {
  get(_t, k) { return getPalette(); },
});

// ---------------------------------------------------------------------------

export function setupRenderer(canvas, palette) {
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true, powerPreference: 'high-performance',
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  return renderer;
}

export function setupLights(scene, palette) {
  const group = new THREE.Group();
  group.name = 'lights';

  const amb = new THREE.AmbientLight(palette.ambient, 0.9);
  group.add(amb);

  const key = new THREE.DirectionalLight(palette.key, 1.6);
  key.position.set(3.5, 4.5, 5.5);
  group.add(key);

  const fill = new THREE.DirectionalLight(palette.fill, 0.7);
  fill.position.set(-4, 1.8, 3.2);
  group.add(fill);

  const rim = new THREE.DirectionalLight(palette.rim, 0.8);
  rim.position.set(-1.5, -2.2, -5.5);
  group.add(rim);

  scene.add(group);
  return group;
}

// ---------------------------------------------------------------------------

/** Build the sphere as a group with: body mesh, grid (lat/lon), equator highlight,
 *  and an outer fresnel "glow" shell. Pass style: 'translucent' | 'matte'. */
export function buildSphere({
  radius = 1, segments = 128, style = 'translucent', palette,
} = {}) {
  const group = new THREE.Group();
  group.name = 'sphere';

  // --- body ---------------------------------------------------------------
  const geom = new THREE.SphereGeometry(radius, segments, segments);
  let mat;
  if (style === 'translucent') {
    mat = new THREE.MeshStandardMaterial({
      color: palette.sphere,
      transparent: true,
      opacity: 0.62,
      roughness: 0.35,
      metalness: 0.05,
      emissive: palette.sphereEmit,
      emissiveIntensity: 0.7,
      side: THREE.FrontSide,
      depthWrite: true,
    });
  } else { // matte
    mat = new THREE.MeshStandardMaterial({
      color: palette.sphere,
      roughness: 0.72,
      metalness: 0.04,
      emissive: palette.sphereEmit,
      emissiveIntensity: 0.85,
    });
  }
  const body = new THREE.Mesh(geom, mat);
  body.name = 'body';
  group.add(body);

  // --- outer fresnel rim shell (only for translucent, gives an edge glow) -
  if (style === 'translucent') {
    const rimMat = new THREE.ShaderMaterial({
      uniforms: {
        rimColor: { value: new THREE.Color(palette.rim) },
        baseAlpha: { value: 0.35 },
      },
      vertexShader: /* glsl */`
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          vN = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */`
        varying vec3 vN;
        varying vec3 vV;
        uniform vec3 rimColor;
        uniform float baseAlpha;
        void main() {
          float fres = pow(1.0 - max(dot(vN, vV), 0.0), 3.0);
          gl_FragColor = vec4(rimColor, fres * baseAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
    });
    const shellGeom = new THREE.SphereGeometry(radius * 1.015, segments, segments);
    const shell = new THREE.Mesh(shellGeom, rimMat);
    group.add(shell);
  }

  // --- grid ---------------------------------------------------------------
  const grid = buildLatLonGrid({ radius: radius * 1.0005, palette });
  group.add(grid);

  // --- equator (slightly more visible) -----------------------------------
  const eqMat = new THREE.LineBasicMaterial({
    color: palette.equator, transparent: true, opacity: palette.equatorAlpha,
  });
  const eqPts = [];
  const N = 256;
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * Math.PI * 2;
    eqPts.push(new THREE.Vector3(Math.cos(t) * radius * 1.001, 0, Math.sin(t) * radius * 1.001));
  }
  const eqGeom = new THREE.BufferGeometry().setFromPoints(eqPts);
  const eqLine = new THREE.Line(eqGeom, eqMat);
  eqLine.name = 'equator';
  group.add(eqLine);

  group.userData = { body, grid, equator: eqLine, style };
  return group;
}

export function buildLatLonGrid({
  radius = 1, palette, latLines = 11, lonLines = 16,
} = {}) {
  const group = new THREE.Group();
  group.name = 'grid';
  const mat = new THREE.LineBasicMaterial({
    color: palette.grid, transparent: true, opacity: palette.gridAlpha,
  });

  // latitude circles
  for (let i = 1; i < latLines; i++) {
    const lat = (i / latLines) * Math.PI - Math.PI / 2;
    const r = Math.cos(lat) * radius;
    const y = Math.sin(lat) * radius;
    const pts = [];
    const N = 128;
    for (let j = 0; j <= N; j++) {
      const t = (j / N) * Math.PI * 2;
      pts.push(new THREE.Vector3(r * Math.cos(t), y, r * Math.sin(t)));
    }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
  }
  // longitude great semicircles
  for (let i = 0; i < lonLines; i++) {
    const lon = (i / lonLines) * Math.PI * 2;
    const pts = [];
    const N = 128;
    for (let j = 0; j <= N; j++) {
      const lat = (j / N) * Math.PI - Math.PI / 2;
      pts.push(new THREE.Vector3(
        Math.cos(lat) * Math.cos(lon) * radius,
        Math.sin(lat) * radius,
        Math.cos(lat) * Math.sin(lon) * radius,
      ));
    }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
  }
  return group;
}

// ---------------------------------------------------------------------------

/** Tangent plane disc at p, oriented by the tangent normal (= p itself). */
export function buildTangentPlane({
  p, radius = 0.85, color = 0x4dd6ff, opacity = 0.18,
} = {}) {
  const group = new THREE.Group();
  group.name = 'tangentPlane';

  const fillGeom = new THREE.CircleGeometry(radius, 96);
  const fillMat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false,
  });
  const fill = new THREE.Mesh(fillGeom, fillMat);
  group.add(fill);

  const ringPts = [];
  const N = 192;
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * Math.PI * 2;
    ringPts.push(new THREE.Vector3(radius * Math.cos(t), radius * Math.sin(t), 0));
  }
  const ringGeom = new THREE.BufferGeometry().setFromPoints(ringPts);
  const ringMat = new THREE.LineBasicMaterial({
    color, transparent: true, opacity: 0.85,
  });
  const ring = new THREE.Line(ringGeom, ringMat);
  group.add(ring);

  orientPlaneAt(group, p);
  group.userData.update = (newP) => orientPlaneAt(group, newP);
  return group;
}

function orientPlaneAt(plane, p) {
  plane.position.copy(p).multiplyScalar(1.001);
  // align local +Z to outward normal p
  const z = new THREE.Vector3(0, 0, 1);
  const q = new THREE.Quaternion().setFromUnitVectors(z, p.clone().normalize());
  plane.quaternion.copy(q);
}

// ---------------------------------------------------------------------------

/** A small filled sphere (point marker) at a 3D position. */
export function buildDot({ position, color = 0xffffff, radius = 0.025 } = {}) {
  const geom = new THREE.SphereGeometry(radius, 24, 24);
  const mat = new THREE.MeshBasicMaterial({ color });
  const m = new THREE.Mesh(geom, mat);
  m.position.copy(position);
  return m;
}

/** A 3D arrow — minimalist shaft + cone. */
export function buildArrow({
  origin, direction, length = null, color = 0xffffff,
  shaft = 0.007, head = 0.038, headLen = 0.075,
} = {}) {
  const group = new THREE.Group();
  group.name = 'arrow';
  const dir = direction.clone();
  let len = length != null ? length : dir.length();

  // create geometry stubs even at zero-length; we just hide the group then
  const safeLen = Math.max(0.0001, len);
  const safeShaftLen = Math.max(0.0001, safeLen - headLen);
  const shaftGeom = new THREE.CylinderGeometry(shaft, shaft, safeShaftLen, 16);
  shaftGeom.translate(0, safeShaftLen / 2, 0);
  const mat = new THREE.MeshStandardMaterial({
    color, roughness: 0.5, metalness: 0.0,
    emissive: color, emissiveIntensity: 0.15,
  });
  const shaftMesh = new THREE.Mesh(shaftGeom, mat);
  group.add(shaftMesh);

  const headGeom = new THREE.ConeGeometry(head, headLen, 24);
  headGeom.translate(0, safeShaftLen + headLen / 2, 0);
  const headMesh = new THREE.Mesh(headGeom, mat);
  group.add(headMesh);

  group.position.copy(origin);
  if (len > 1e-6) {
    dir.normalize();
    const y = new THREE.Vector3(0, 1, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(y, dir);
    group.quaternion.copy(q);
  } else {
    group.visible = false;
  }

  group.userData = {
    mat,
    update(o, d, L) {
      group.position.copy(o);
      const dd = d.clone();
      const ll = L != null ? L : dd.length();
      if (ll < 1e-6) { group.visible = false; return; }
      group.visible = true;
      dd.normalize();
      const sl = Math.max(0.0001, ll - headLen);
      shaftGeom.dispose();
      const ng = new THREE.CylinderGeometry(shaft, shaft, sl, 16);
      ng.translate(0, sl / 2, 0);
      shaftMesh.geometry = ng;
      headGeom.dispose();
      const hg = new THREE.ConeGeometry(head, headLen, 24);
      hg.translate(0, sl + headLen / 2, 0);
      headMesh.geometry = hg;
      const yy = new THREE.Vector3(0, 1, 0);
      const qq = new THREE.Quaternion().setFromUnitVectors(yy, dd);
      group.quaternion.copy(qq);
    },
  };
  return group;
}

/** A polyline. Returns { line, update(points) }. */
export function buildPolyline({ points, color = 0xffffff, opacity = 1, width = 1, dashed = false } = {}) {
  const geom = new THREE.BufferGeometry().setFromPoints(points);
  const matCls = dashed ? THREE.LineDashedMaterial : THREE.LineBasicMaterial;
  const mat = new matCls({
    color, transparent: opacity < 1, opacity, linewidth: width,
    ...(dashed ? { dashSize: 0.04, gapSize: 0.03 } : {}),
  });
  const line = new THREE.Line(geom, mat);
  if (dashed) line.computeLineDistances();
  line.userData = {
    update(newPts) {
      const g = new THREE.BufferGeometry().setFromPoints(newPts);
      line.geometry.dispose();
      line.geometry = g;
      if (dashed) line.computeLineDistances();
    },
  };
  return line;
}

// ---------------------------------------------------------------------------

/** Pointer raycasting onto the sphere. Returns world point on sphere or null. */
export function pickSphere(event, canvas, camera, radius = 1) {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera({ x, y }, camera);
  const sphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), radius);
  const hit = new THREE.Vector3();
  if (raycaster.ray.intersectSphere(sphere, hit)) return hit;
  return null;
}
