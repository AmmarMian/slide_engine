// federated-learning.jsx — Federated Learning animation island.
// 6 stepped phases: overview → select → broadcast → train → upload → aggregate.
// Step-paced via [data-step] + MutationObserver (same pattern as riemann-primer).

import React, { useRef, useEffect, useState } from 'react';
import katex from 'katex';

function mountHTML(el, html) {
  if (!el) return;
  el.replaceChildren(document.createRange().createContextualFragment(html));
}

const GOLD    = '#c59c1a';
const PANEL_W = 640;
const R       = 36;    // client circle radius (SVG units, viewBox 0 0 640 430)
const SW      = 150;   // server rect width
const SH      = 50;    // server rect height
const SX      = 320;   // server centre x
const SY      = 205;   // server centre y

const CLIENTS = [
  { id: 0, cx: 320, cy: 38,  lbl: 'Cl. 1', sup: '(1)', active: true  },
  { id: 1, cx: 56,  cy: 340, lbl: 'Cl. 2', sup: '(2)', active: true  },
  { id: 2, cx: 584, cy: 340, lbl: 'Cl. 3', sup: '(3)', active: true  },
  { id: 3, cx: 32,  cy: 148, lbl: 'Cl. 4', sup: '(4)', active: false },
  { id: 4, cx: 608, cy: 148, lbl: 'Cl. 5', sup: '(5)', active: false },
];

// Private data dot positions per active client (decorative)
const DATA_DOTS = [
  [{ x: -14, y: -12, c: '#d23b1c' }, { x: 6, y: -16, c: GOLD }, { x: 16, y: 3, c: '#3a9bd5' }, { x: -8, y: 14, c: GOLD }, { x: 12, y: 14, c: '#d23b1c' }],
  [{ x: -13, y: -13, c: '#3a9bd5' }, { x: 10, y: -12, c: '#d23b1c' }, { x: -5, y: 6, c: GOLD }, { x: 15, y: 10, c: '#3a9bd5' }, { x: -16, y: 12, c: '#d23b1c' }],
  [{ x: -12, y: -14, c: GOLD }, { x: 13, y: -11, c: '#3a9bd5' }, { x: -16, y: 4, c: '#d23b1c' }, { x: 7, y: 15, c: GOLD }, { x: 15, y: 5, c: '#d23b1c' }],
];

// Point on client circle boundary toward target
function edgePt(cx, cy, tx, ty, r) {
  const d = Math.hypot(tx - cx, ty - cy);
  return [cx + r * (tx - cx) / d, cy + r * (ty - cy) / d];
}

// Point on server rect boundary toward target
function rectEdgePt(tx, ty) {
  const dx = tx - SX, dy = ty - SY;
  const hw = SW / 2, hh = SH / 2;
  const t = Math.min(
    dx !== 0 ? hw / Math.abs(dx) : Infinity,
    dy !== 0 ? hh / Math.abs(dy) : Infinity,
  );
  return [SX + dx * t, SY + dy * t];
}

// Precompute connection endpoints for active clients
const CONNS = CLIENTS.filter(c => c.active).map(c => {
  const [spx, spy] = rectEdgePt(c.cx, c.cy);
  const [epx, epy] = edgePt(c.cx, c.cy, SX, SY, R);
  return { ...c, spx, spy, epx, epy };
});

const STEPS = [
  {
    eyebrow: "00 / VUE D'ENSEMBLE",
    title: 'Apprentissage fédéré',
    body: 'K clients détiennent des données locales <b>𝒟<sup>(k)</sup></b> qui ne quittent jamais leur machine. L\'objectif&nbsp;: minimiser une perte globale partagée.',
    formula: String.raw`F(\theta) = \sum_{k=1}^{K} \frac{n_k}{n}\, F_k(\theta)`,
    phase: 'overview',
  },
  {
    eyebrow: '01 / SÉLECTION',
    title: 'Sélection des clients',
    body: 'À chaque round&nbsp;<i>t</i>, le serveur tire un sous-ensemble <b>S<sub>t</sub></b> de&nbsp;<i>m</i> participants. Les clients non sélectionnés (pointillés) restent inactifs.',
    formula: String.raw`S_t \subset [K],\quad |S_t| = m`,
    phase: 'select',
  },
  {
    eyebrow: '02 / DIFFUSION',
    title: 'Envoi du modèle global',
    body: 'Le serveur diffuse le modèle courant <b>θ<sub>t</sub></b> à chaque client sélectionné. <em>Aucune donnée ne transite</em>&nbsp;— seulement les paramètres.',
    formula: String.raw`\theta_t \;\xrightarrow{\;\text{broadcast}\;}\; k \in S_t`,
    phase: 'broadcast',
  },
  {
    eyebrow: '03 / ENTRAÎNEMENT LOCAL',
    title: 'Descente locale',
    body: 'Chaque client effectue <i>E</i>&nbsp;pas de descente de gradient sur ses données privées, en partant du modèle reçu θ<sub>t</sub>.',
    formula: String.raw`\theta^{(k)} \leftarrow \theta_t - \eta\,\nabla F_k(\theta_t)`,
    phase: 'train',
  },
  {
    eyebrow: '04 / REMONTÉE',
    title: 'Envoi des mises à jour',
    body: 'Seuls les <b>paramètres mis à jour</b> θ<sup>(k)</sup> remontent vers le serveur&nbsp;— les données restent privées sur chaque machine.',
    formula: String.raw`\theta^{(k)} \;\xrightarrow{\;\text{upload}\;}\; \text{serveur}`,
    phase: 'upload',
  },
  {
    eyebrow: '05 / AGRÉGATION',
    title: 'FedAvg',
    body: 'Le serveur calcule une moyenne pondérée par les tailles des jeux locaux et produit θ<sub>t+1</sub>. Le processus se répète jusqu\'à convergence.',
    formula: String.raw`\theta_{t+1} = \sum_{k \in S_t} \frac{n_k}{n}\,\theta^{(k)}`,
    phase: 'aggregate',
  },
];

// ── CSS animations (scoped to SVG) ────────────────────────────────────────────

const CSS_ANIM = `
  @keyframes fl-dash-fwd {
    from { stroke-dashoffset: 30; }
    to   { stroke-dashoffset:  0; }
  }
  @keyframes fl-dash-rev {
    from { stroke-dashoffset: -30; }
    to   { stroke-dashoffset:   0; }
  }
  @keyframes fl-spin {
    to { transform: rotate(360deg); }
  }
  @keyframes fl-pulse {
    0%, 100% { transform: scale(1);    opacity: 0.65; }
    50%       { transform: scale(1.30); opacity: 0.08; }
  }
  @keyframes fl-server-glow {
    0%, 100% { opacity: 1;   }
    50%       { opacity: 0.5; }
  }
  @keyframes fl-fadein {
    from { opacity: 0; transform: translateY(5px); }
    to   { opacity: 1; transform: translateY(0);   }
  }
  @keyframes fl-dot-pulse {
    0%, 100% { transform: scale(1);   }
    50%       { transform: scale(1.7); }
  }
`;

// ── Panel (right side) ────────────────────────────────────────────────────────

function FedPanel({ stepIdx }) {
  const titleRef   = useRef(null);
  const bodyRef    = useRef(null);
  const formulaRef = useRef(null);

  useEffect(() => {
    const s = STEPS[stepIdx];
    mountHTML(titleRef.current, s.title);
    mountHTML(bodyRef.current, s.body);
    if (formulaRef.current) {
      formulaRef.current.replaceChildren();
      katex.render(s.formula, formulaRef.current, { throwOnError: false, displayMode: true });
    }
  });

  const s = STEPS[stepIdx];

  return (
    <div style={{
      position: 'absolute', right: 0, top: 0, bottom: 0, width: PANEL_W + 'px',
      padding: '64px 44px 48px 44px', boxSizing: 'border-box',
      display: 'flex', flexDirection: 'column', gap: '24px',
      background: 'linear-gradient(270deg, var(--bg) 0%, color-mix(in srgb, var(--bg) 92%, transparent) 65%, color-mix(in srgb, var(--bg) 40%, transparent) 100%)',
      borderLeft: '1px solid var(--rule-soft)',
      overflowY: 'auto', zIndex: 5,
    }}>
      {/* Eyebrow + counter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: '15px', fontWeight: 500, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--accent)' }}>
          {s.eyebrow}
        </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: '16px', letterSpacing: '0.10em' }}>
          <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{String(stepIdx + 1).padStart(2, '0')}</span>
          <span style={{ color: 'var(--ink-3)' }}>{' / ' + String(STEPS.length).padStart(2, '0')}</span>
        </span>
      </div>

      <h2 ref={titleRef} style={{
        fontFamily: 'var(--sans)', fontSize: '40px', lineHeight: 1.0,
        letterSpacing: '-0.025em', fontWeight: 600, margin: 0, color: 'var(--ink)',
      }} />

      <hr style={{ height: '1px', background: 'var(--rule-soft)', border: 0, margin: 0 }} />

      <div ref={bodyRef} style={{
        fontFamily: 'var(--sans)', fontSize: '22px', lineHeight: 1.55,
        color: 'var(--ink-2)', letterSpacing: '-0.005em',
      }} />

      {/* Formula box */}
      <div style={{
        background: 'var(--bg-2)', border: '1px solid var(--rule)',
        borderLeft: '3px solid var(--accent)', padding: '18px 20px', color: 'var(--ink)',
      }}>
        <div ref={formulaRef} />
      </div>

      {/* Legend */}
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', gap: '28px' }}>
          {[{ color: 'var(--accent)', label: 'param. global' }, { color: GOLD, label: 'param. local' }].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'var(--mono)', fontSize: '14px', color: 'var(--ink-3)' }}>
              <svg width="34" height="10" style={{ flexShrink: 0 }}>
                <line x1="0" y1="5" x2="34" y2="5" stroke={color} strokeWidth="2.5" strokeDasharray="8 5" />
              </svg>
              {label}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '28px' }}>
          {[{ dash: undefined, label: 'sélectionné' }, { dash: '7 5', label: 'inactif' }].map(({ dash, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'var(--mono)', fontSize: '14px', color: 'var(--ink-3)' }}>
              <svg width="22" height="22" style={{ flexShrink: 0 }}>
                <circle cx="11" cy="11" r="8" fill="none" stroke="var(--ink-3)" strokeWidth="2" strokeDasharray={dash} />
              </svg>
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Diagram (SVG, left side) ──────────────────────────────────────────────────

function FedDiagram({ phase }) {
  const isBroadcast = phase === 'broadcast';
  const isUpload    = phase === 'upload';
  const isTrain     = phase === 'train';
  const isAggregate = phase === 'aggregate';

  // Arc path for spinning "computing" indicator inside client
  const arcR   = R - 12;
  const arcEnd = `${arcR * Math.sin(Math.PI * 2 / 3).toFixed(4)} -${(arcR * Math.cos(Math.PI * 2 / 3) * -1).toFixed(4)}`;
  const arcD   = `M 0 -${arcR} A ${arcR} ${arcR} 0 0 1 ${arcEnd}`;

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: PANEL_W + 'px', bottom: 0, overflow: 'hidden' }}>
    <svg
      viewBox="0 0 640 430"
      width="100%" height="100%"
      preserveAspectRatio="xMidYMid meet"
    >
      <style>{CSS_ANIM}</style>
      <defs>
        <marker id="fl-ah-g" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
          <path d="M 0 0.5 L 8.5 4.5 L 0 8.5 Z" style={{ fill: 'var(--accent)' }} />
        </marker>
        <marker id="fl-ah-l" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
          <path d="M 0 0.5 L 8.5 4.5 L 0 8.5 Z" fill={GOLD} />
        </marker>
      </defs>

      {/* Static background lines */}
      {CONNS.map(c => (
        <line key={c.id}
          x1={c.spx} y1={c.spy} x2={c.epx} y2={c.epy}
          stroke="rgba(10,10,10,0.10)" strokeWidth="1.5"
        />
      ))}

      {/* Broadcast paths: server → client */}
      {CONNS.map(c => (
        <path key={c.id}
          d={`M ${c.spx} ${c.spy} L ${c.epx} ${c.epy}`}
          fill="none" strokeWidth="2" strokeDasharray="9 6" strokeLinecap="round"
          markerEnd="url(#fl-ah-g)"
          style={{
            stroke: 'var(--accent)',
            opacity: isBroadcast ? 1 : 0,
            transition: 'opacity 0.35s',
            animation: isBroadcast ? 'fl-dash-fwd 0.75s linear infinite' : 'none',
          }}
        />
      ))}

      {/* Upload paths: client → server */}
      {CONNS.map(c => (
        <path key={c.id}
          d={`M ${c.epx} ${c.epy} L ${c.spx} ${c.spy}`}
          fill="none" strokeWidth="2" strokeDasharray="9 6" strokeLinecap="round"
          markerEnd="url(#fl-ah-l)"
          fillOpacity="0"
          style={{
            stroke: GOLD,
            opacity: (isUpload || isAggregate) ? 1 : 0,
            transition: 'opacity 0.35s',
            animation: isUpload ? 'fl-dash-rev 0.75s linear infinite' : 'none',
          }}
        />
      ))}

      {/* Path parameter labels */}
      {isBroadcast && (
        <text x={SX + 16} y={SY - SH / 2 - 12} textAnchor="start"
          style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: '20px', fill: 'var(--accent)', animation: 'fl-fadein 0.4s ease' }}>
          {'θ'}
          <tspan dy="3" fontSize="15">{'t'}</tspan>
        </text>
      )}
      {(isUpload || isAggregate) && CONNS.map(c => {
        const mx = (c.epx + c.spx) / 2;
        const my = (c.epy + c.spy) / 2;
        return (
          <text key={c.id} x={mx + 10} y={my - 6} textAnchor="start"
            style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: '18px', fill: GOLD, animation: 'fl-fadein 0.5s ease' }}>
            {'θ'}
            <tspan dy="3" fontSize="13">{`(${c.sup[1]})`}</tspan>
          </text>
        );
      })}

      {/* Clients */}
      {CLIENTS.map((c, ci) => (
        <g key={c.id} transform={`translate(${c.cx}, ${c.cy})`}>
          {/* Outer pulse ring during training */}
          {isTrain && c.active && (
            <circle r={R} fill="none" strokeWidth="2"
              style={{
                stroke: 'var(--accent)',
                transformBox: 'fill-box', transformOrigin: 'center',
                animation: 'fl-pulse 1.4s ease-in-out infinite',
              }}
            />
          )}

          {/* Circle body */}
          <circle r={R}
            strokeWidth={c.active ? 3 : 1.5}
            strokeDasharray={c.active ? undefined : '8 5'}
            style={{
              fill: 'var(--bg-2)',
              stroke: c.active ? 'var(--accent)' : 'rgba(10,10,10,0.25)',
              opacity: c.active ? 1 : 0.4,
              transition: 'opacity 0.5s',
            }}
          />

          {/* Private data dots */}
          {c.active && DATA_DOTS[ci] && DATA_DOTS[ci].map((d, di) => (
            <circle key={di} cx={d.x} cy={d.y} r="5" fill={d.c}
              style={{
                opacity: 0.55,
                transformBox: 'fill-box', transformOrigin: 'center',
                animation: isTrain ? `fl-dot-pulse ${1.0 + di * 0.22}s ease-in-out infinite` : 'none',
              }}
            />
          ))}

          {/* Spinning compute arc during training */}
          {isTrain && c.active && (
            <path d={arcD} fill="none" strokeWidth="2" strokeLinecap="round"
              style={{
                stroke: 'var(--accent)',
                transformBox: 'fill-box', transformOrigin: 'center',
                animation: 'fl-spin 1.1s linear infinite',
              }}
            />
          )}

          {/* Client label */}
          <text textAnchor="middle" dy="-8"
            style={{
              fontFamily: 'var(--sans)', fontWeight: 700, fontSize: '20px',
              fill: c.active ? 'var(--ink)' : 'rgba(10,10,10,0.30)',
            }}>
            {c.lbl}
          </text>
          <text textAnchor="middle" dy="16"
            style={{
              fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: '17px',
              fill: c.active ? 'var(--ink-2)' : 'rgba(10,10,10,0.20)',
            }}>
            {'𝒟' + c.sup}
          </text>
        </g>
      ))}

      {/* Server */}
      <g>
        {/* Glow ring during aggregate */}
        {isAggregate && (
          <rect
            x={SX - SW / 2 - 9} y={SY - SH / 2 - 9} width={SW + 18} height={SH + 18} rx="18"
            fill="none" strokeWidth="2.5"
            style={{
              stroke: 'var(--accent)',
              opacity: 0.38,
              animation: 'fl-server-glow 1.1s ease-in-out infinite',
            }}
          />
        )}
        {/* Rect */}
        <rect
          x={SX - SW / 2} y={SY - SH / 2} width={SW} height={SH} rx="12"
          strokeWidth={isAggregate ? 3 : 2.5}
          style={{
            fill: isAggregate ? 'color-mix(in srgb, var(--accent) 7%, var(--bg-2))' : 'var(--bg-2)',
            stroke: 'var(--accent)',
            transition: 'fill 0.5s',
          }}
        />
        <text x={SX} y={SY - 7} textAnchor="middle"
          style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: '22px', fill: 'var(--ink)' }}>
          Serveur
        </text>
        <text x={SX} y={SY + 18} textAnchor="middle"
          style={{ fontFamily: 'var(--mono)', fontSize: '15px', fill: 'var(--accent)', letterSpacing: '0.06em' }}>
          {isAggregate ? 'FedAvg ↻' : 'agrégation'}
        </text>

        {/* θ_t label — visible during early phases */}
        <text x={SX - SW / 2 - 16} y={SY - SH / 2 - 12} textAnchor="end"
          style={{
            fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: '20px',
            fill: 'var(--accent)',
            opacity: (phase === 'overview' || phase === 'select' || phase === 'broadcast') ? 1 : 0,
            transition: 'opacity 0.4s',
          }}>
          {'θ'}
          <tspan dy="3" fontSize="15">{'t'}</tspan>
          <tspan dy="-3" fontSize="18">{' ∈ ℳ'}</tspan>
        </text>

        {/* θ_{t+1} label — appears after aggregate */}
        {isAggregate && (
          <text x={SX + SW / 2 + 16} y={SY - SH / 2 - 12} textAnchor="start"
            style={{
              fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: '20px',
              fill: GOLD,
              animation: 'fl-fadein 0.6s ease',
            }}>
            {'θ'}
            <tspan dy="3" fontSize="15">{'t+1'}</tspan>
          </text>
        )}
      </g>

      {/* Round indicator */}
      <text x={18} y={420}
        style={{ fontFamily: 'var(--mono)', fontSize: '16px', fill: 'var(--ink-4)', letterSpacing: '0.04em' }}>
        {isAggregate ? 'Round  t  →  t + 1' : 'Round  t'}
      </text>

      {/* Convergence sparkline during aggregate */}
      {isAggregate && (
        <g style={{ animation: 'fl-fadein 0.7s ease' }}>
          <text x={SX} y={SY + SH / 2 + 32} textAnchor="middle"
            style={{ fontFamily: 'var(--mono)', fontSize: '13px', fill: 'var(--ink-4)', letterSpacing: '0.04em' }}>
            {'F(θ)'}
          </text>
          <path
            d={`M ${SX - 100} ${SY + SH / 2 + 58} C ${SX - 60} ${SY + SH / 2 + 52}, ${SX - 20} ${SY + SH / 2 + 44}, ${SX + 20} ${SY + SH / 2 + 36} C ${SX + 55} ${SY + SH / 2 + 30}, ${SX + 85} ${SY + SH / 2 + 28}, ${SX + 100} ${SY + SH / 2 + 27}`}
            fill="none" strokeWidth="2.5" strokeLinecap="round"
            style={{ stroke: GOLD }}
          />
          <line
            x1={SX - 104} y1={SY + SH / 2 + 28}
            x2={SX - 104} y2={SY + SH / 2 + 62}
            stroke="rgba(10,10,10,0.18)" strokeWidth="1.5"
          />
          <line
            x1={SX - 104} y1={SY + SH / 2 + 62}
            x2={SX + 104} y2={SY + SH / 2 + 62}
            stroke="rgba(10,10,10,0.18)" strokeWidth="1.5"
          />
        </g>
      )}
    </svg>
    </div>
  );
}

// ── Main island ───────────────────────────────────────────────────────────────

export function FederatedLearning() {
  const hostRef = useRef(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    function readStep() {
      const markers = [...host.querySelectorAll('i[data-step]')];
      const n = markers.filter(m => m.hasAttribute('data-step-visible')).length;
      setStep(Math.min(n, STEPS.length - 1));
    }

    const obs = new MutationObserver(readStep);
    obs.observe(host, { subtree: true, attributes: true, attributeFilter: ['data-step-visible'] });
    readStep();
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={hostRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      {STEPS.slice(1).map((_, i) => <i key={i} data-step style={{ display: 'none' }} />)}
      <FedDiagram phase={STEPS[step].phase} />
      <FedPanel stepIdx={step} />
    </div>
  );
}
