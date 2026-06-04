// spd-cone.jsx — SPD cone geometry for 2×2 matrices.
// Left: Three.js 3D cone with three showcase matrices.
// Right: explanatory text about the cone structure.

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { setupRenderer, setupLights, getPalette } from './three/scene.js';
import { renderMath } from '../math.js';

// ── Showcase matrices: (a, b, c) = (Σ₁₁, Σ₁₂, Σ₂₂), all with det > 0 ──────
const MATRICES = [
  { id: 'I', a: 1.0, b: 0.0, c: 1.0, tex: '\\mathbf{I} = \\begin{pmatrix}1&0\\\\0&1\\end{pmatrix}', colorKey: 'accent' },
  { id: 'Σ₁', a: 1.8, b: 0.65, c: 0.55, tex: '\\boldsymbol{\\Sigma}_1 = \\begin{pmatrix}1.8&0.65\\\\0.65&0.55\\end{pmatrix}', colorKey: 'tangent' },
  { id: 'Σ₂', a: 0.45, b: -0.35, c: 1.7, tex: '\\boldsymbol{\\Sigma}_2 = \\begin{pmatrix}0.45&{-}0.35\\\\{-}0.35&1.7\\end{pmatrix}', colorKey: 'retraction' },
];

// ── Cone boundary mesh: ac = b², parametrised by (r,θ) ───────────────────────
// Mapping (a,b,c) → Three.js (x,y,z): x=a, y=b, z=c.
function buildConeSurface(R = 1.7, Nr = 28, Nt = 52) {
  const verts = [];
  const idx = (i, j) => i * (Nt + 1) + j;
  for (let i = 0; i <= Nr; i++) {
    const r = i * R / Nr;
    for (let j = 0; j <= Nt; j++) {
      const th = j * Math.PI / Nt;
      const cos = Math.cos(th), sin = Math.sin(th);
      verts.push(r * r * cos * cos, r * r * cos * sin, r * r * sin * sin);
    }
  }
  const indices = [];
  for (let i = 0; i < Nr; i++) {
    for (let j = 0; j < Nt; j++) {
      const a = idx(i, j), b = idx(i, j + 1), c = idx(i + 1, j), d = idx(i + 1, j + 1);
      indices.push(a, b, d, a, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ── Label system: manual screen-space projection, no CSS2DRenderer ────────────
// Returns an array of { worldPos, el } entries; call updateLabels() each frame.
function createLabelLayer(container) {
  const items = [];

  function add(worldPos, text, style) {
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = `position:absolute;top:0;left:0;pointer-events:none;transform-origin:50% 50%;${style}`;
    container.appendChild(el);
    items.push({ worldPos: worldPos.clone(), el });
    return el;
  }

  function update(camera, W, H) {
    const v = new THREE.Vector3();
    for (const { worldPos, el } of items) {
      v.copy(worldPos).project(camera);
      if (v.z > 1) { el.style.opacity = '0'; continue; }
      const x = (v.x + 1) * 0.5 * W;
      const y = (-v.y + 1) * 0.5 * H;
      el.style.opacity = '1';
      el.style.transform = `translate(-50%,-50%) translate(${x}px,${y}px)`;
    }
  }

  function destroy() {
    for (const { el } of items) el.remove();
    items.length = 0;
  }

  return { add, update, destroy };
}

// ── Main island component ──────────────────────────────────────────────────────
export function SpdCone() {
  const hostRef = useRef(null);
  const canvasRef = useRef(null);
  const labelRef = useRef(null);
  const textRef = useRef(null);
  const controlsRef = useRef(null);
  const [rotating, setRotating] = useState(true);

  const toggleRotation = () => {
    const next = !controlsRef.current?.autoRotate;
    if (controlsRef.current) controlsRef.current.autoRotate = next;
    setRotating(next);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const labelLayer = labelRef.current;
    if (!canvas || !labelLayer) return;

    const W = canvas.parentElement.clientWidth || 1056;
    const H = canvas.parentElement.clientHeight || 940;

    // ── Renderer ──────────────────────────────────────────────────────────
    const renderer = setupRenderer(canvas);
    renderer.setSize(W, H);

    // ── Scene ─────────────────────────────────────────────────────────────
    const palette = getPalette();
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(palette.bgNum);
    setupLights(scene, palette);

    // ── Camera ────────────────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(34, W / H, 0.05, 40);
    camera.position.set(3.8, 2.6, 4.8);
    camera.lookAt(0.7, 0.05, 0.8);

    // ── Cone boundary surface ─────────────────────────────────────────────
    const coneGeo = buildConeSurface();

    scene.add(new THREE.Mesh(coneGeo, new THREE.MeshPhongMaterial({
      color: palette.tintNum, side: THREE.DoubleSide,
      transparent: true, opacity: 0.30, depthWrite: false,
    })));
    scene.add(new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({
      color: palette.ink3Num, wireframe: true,
      transparent: true, opacity: 0.18,
    })));

    // ── Labels (manual screen-projection, immune to StrictMode double-mount) ─
    const labels = createLabelLayer(labelLayer);

    const axisLabelStyle = [
      'font-family:var(--mono)', 'font-size:15px', 'font-weight:700',
      'color:var(--ink-2)', 'background:var(--bg)',
      'padding:1px 6px', 'border-radius:3px',
    ].join(';');

    // Axis arrows + their tip label positions
    const axisColor = palette.ink2Num;
    const orig = new THREE.Vector3(-0.05, 0, -0.05);
    [
      { dir: new THREE.Vector3(1, 0, 0), len: 2.1, label: 'a', from: orig.clone() },
      { dir: new THREE.Vector3(0, 1, 0), len: 1.8, label: 'b', from: new THREE.Vector3(-0.05, -0.8, -0.05) },
      { dir: new THREE.Vector3(0, 0, 1), len: 2.1, label: 'c', from: orig.clone() },
    ].forEach(({ dir, len, label, from }) => {
      scene.add(new THREE.ArrowHelper(dir.clone().normalize(), from, len, axisColor, 0.10, 0.055));
      labels.add(from.clone().addScaledVector(dir, len + 0.18), label, axisLabelStyle);
    });

    // Origin dot
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 12, 12),
      new THREE.MeshBasicMaterial({ color: palette.ink3Num }),
    ));

    // ── Matrix markers ─────────────────────────────────────────────────────
    const colors = [palette.accentNum, palette.tangent, palette.retraction];
    MATRICES.forEach(({ id, a, b, c }, i) => {
      const color = colors[i];
      // Sphere
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 20, 20),
        new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 0.18 }),
      );
      sphere.position.set(a, b, c);
      scene.add(sphere);
      // Dashed drop-line to b=0 plane
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(a, 0, c), new THREE.Vector3(a, b, c),
      ]);
      const line = new THREE.Line(lineGeo, new THREE.LineDashedMaterial({
        color, dashSize: 0.06, gapSize: 0.05, opacity: 0.55, transparent: true,
      }));
      line.computeLineDistances();
      scene.add(line);
      // Label
      const hexStr = color.toString(16).padStart(6, '0');
      labels.add(new THREE.Vector3(a, b + 0.17, c), id, [
        'font-family:var(--mono)', 'font-size:14px', 'font-weight:700',
        `color:#${hexStr}`,
        'background:var(--bg)', 'padding:2px 7px',
        'border-radius:4px', 'border:1px solid var(--rule)',
        'white-space:nowrap',
      ].join(';'));
    });

    // ── OrbitControls ──────────────────────────────────────────────────────
    const controls = new OrbitControls(camera, canvas);
    controls.target.set(0.7, 0.05, 0.8);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 1.5;
    controls.maxDistance = 10;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.55;
    controlsRef.current = controls;
    controls.update();

    // ── Render loop ────────────────────────────────────────────────────────
    let raf;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
      labels.update(camera, W, H);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      renderer.dispose();
      controls.dispose();
      labels.destroy();
    };
  }, []);

  useEffect(() => { renderMath(); }, []);

  return (
    <div ref={hostRef} style={{ width: '100%', height: '100%', display: 'flex', background: 'var(--bg)' }}>

      {/* ── Left: Three.js scene ── */}
      <div style={{ flex: '0 0 56%', position: 'relative', minHeight: 0 }}>
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
        <div ref={labelRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }} />
        <button
          onClick={toggleRotation}
          style={{
            position: 'absolute', bottom: 18, left: 18,
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '6px 14px',
            background: 'var(--bg)', borderRadius: 6, cursor: 'pointer',
            fontFamily: 'var(--mono)', fontSize: 12,
            color: rotating ? 'var(--accent)' : 'var(--ink-3)',
            letterSpacing: '0.06em', userSelect: 'none',
            transition: 'color 200ms, border-color 200ms',
            border: `1px solid ${rotating ? 'var(--accent)' : 'var(--rule)'}`,
          }}
        >
          <span style={{ fontSize: 14, lineHeight: 1 }}>{rotating ? '⏸' : '▶'}</span>
          {rotating ? 'rotation' : 'pause'}
        </button>
      </div>

      {/* ── Right: explanatory text ── */}
      <div ref={textRef} style={{
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
        gap: 26, padding: '40px 52px 40px 40px',
        borderLeft: '1px solid var(--rule-soft)', overflowY: 'auto',
      }}>

        <div>
          <div className="eyebrow" style={{ color: 'var(--accent)', marginBottom: 10 }}>Géométrie du cône</div>
          <p className="body" style={{ lineHeight: 1.6 }}>
            Pour <span className="math">{'d=2'}</span>, une matrice symétrique <span className="math">{'\\boldsymbol{\\Sigma}=\\begin{pmatrix}a&b\\\\b&c\\end{pmatrix}'}</span> est SPD si&nbsp;:
          </p>
          <div className="math-display" style={{ margin: '12px 0' }}>
            {'a > 0 \\quad \\text{et} \\quad \\det\\boldsymbol{\\Sigma} = ac - b^2 > 0'}
          </div>
        </div>

        <div>
          <div className="eyebrow" style={{ color: 'var(--accent)', marginBottom: 10 }}>Propriétés</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
            {[
              ['Cône', <>si <span className="math">{'\\boldsymbol{\\Sigma}\\in\\mathcal{S}_{++}'}</span>, alors <span className="math">{'\\lambda\\boldsymbol{\\Sigma}\\in\\mathcal{S}_{++}'}</span> pour tout <span className="math">{'\\lambda>0'}</span></>],
              ['Convexe', <>le segment entre deux matrices SPD reste dans <span className="math">{'\\mathcal{S}_{++}'}</span></>],
              ['Ouvert', <>le bord <span className="math">{'\\partial\\mathcal{S}_{+}'}</span> (rang <span className="math">{'<d'}</span>, <span className="math">{'\\det=0'}</span>) est exclu</>],
              ['Non compact', 'le cône est illimité — il s\'étend à l\'infini le long de la diagonale'],
            ].map(([title, desc]) => (
              <li key={title} className="body" style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                <span style={{ color: 'var(--accent)', fontWeight: 700, flexShrink: 0 }}>·</span>
                <span><strong>{title} :</strong> {desc}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* <div style={{ paddingTop: 4, borderTop: '1px solid var(--rule-soft)' }}> */}
        {/*   <div className="eyebrow" style={{ color: 'var(--accent)', marginBottom: 10 }}>Les trois matrices</div> */}
        {/*   <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}> */}
        {/*     {MATRICES.map(({ id, a, b, c, tex }, i) => { */}
        {/*       const cssColors = ['var(--accent)', 'var(--viz-tangent,#2563eb)', 'var(--viz-retract,#059669)']; */}
        {/*       return ( */}
        {/*         <div key={id} style={{ display: 'flex', gap: 12, alignItems: 'center' }}> */}
        {/*           <span style={{ color: cssColors[i], fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700, flexShrink: 0, width: 24 }}>{id}</span> */}
        {/*           <span className="math" style={{ fontSize: 15 }}>{tex}</span> */}
        {/*           <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-3)', flexShrink: 0 }}> */}
        {/*             {`det = ${(a * c - b * b).toFixed(2)}`} */}
        {/*           </span> */}
        {/*         </div> */}
        {/*       ); */}
        {/*     })} */}
        {/*   </div> */}
        {/* </div> */}

      </div>
    </div>
  );
}
