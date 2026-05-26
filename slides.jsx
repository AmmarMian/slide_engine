// Slides.jsx — renders all 11 slides for a given theme variant.
// Math is rendered with KaTeX (via window.katex.renderToString).

const K = (tex, opts = {}) => {
  if (typeof window === 'undefined' || !window.katex) return tex;
  try { return window.katex.renderToString(tex, { throwOnError: false, displayMode: !!opts.display, output: 'html' }); }
  catch (e) { return tex; }
};
const M = ({ tex, display }) => <span dangerouslySetInnerHTML={{ __html: K(tex, { display }) }} />;

// shared content
const TITLE = 'Discrete Diffusion for Tabular Data';
const SUBTITLE = 'A categorical framework for high-fidelity synthetic tables';
const AUTHORS = 'A. Researcher · B. Collaborator · C. Advisor';
const VENUE   = 'NeurIPS 2026 · Generative Models Workshop';

// ─── Slide builders. Each returns the inner JSX for one <section>. ───

function S_Title({ theme }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div className="label">Paper presentation · 12 min</div>
      <div>
        <div className="eyebrow" style={{ marginBottom: 32 }}>Discrete Diffusion · Tabular</div>
        <h1 className="title">{TITLE}</h1>
        <div className="lede" style={{ marginTop: 36, maxWidth: 1300 }}>{SUBTITLE}</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div className="body" style={{ fontSize: 28 }}>{AUTHORS}</div>
        <div className="small">{VENUE}</div>
      </div>
    </div>
  );
}

function PageHeader({ section, n, total = 12 }) {
  return (
    <div className="page-header">
      <div className="label">{section}</div>
      <div className="label">{String(n).padStart(2,'0')} / {String(total).padStart(2,'0')}</div>
    </div>
  );
}
function PageFooter({ short }) {
  return (
    <div className="page-footer">
      <div>{short || 'Discrete Diffusion · Tabular'}</div>
      <div>{VENUE}</div>
    </div>
  );
}

function S_Motivation({ theme }) {
  return (
    <>
      <PageHeader section="01 · Motivation" n={2} />
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 88, alignItems: 'start' }}>
        <div>
          <h2 className="h1">Tabular generation resists the tools that work elsewhere.</h2>
          <div className="lede" style={{ marginTop: 36 }}>
            Mixed continuous and categorical columns, heavy-tailed marginals, and brittle inter-column constraints break GAN- and VAE-based generators.
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
          {[
            ['Mixed types', 'Continuous, ordinal, and categorical columns coexist; common likelihoods do not.'],
            ['Multi-modal marginals', 'Real columns concentrate around discrete modes that smooth densities under-fit.'],
            ['Privacy & utility', 'Synthetic tables are deployed when raw data cannot be shared — fidelity matters.'],
          ].map(([t, d]) => (
            <div key={t} style={{ borderTop: '1px solid var(--rule-soft)', paddingTop: 22 }}>
              <div className="label" style={{ marginBottom: 12 }}>{t}</div>
              <div className="body" style={{ fontSize: 26 }}>{d}</div>
            </div>
          ))}
        </div>
      </div>
      <PageFooter />
    </>
  );
}

function S_Background({ theme }) {
  return (
    <>
      <PageHeader section="02 · Background" n={3} />
      <h2 className="h1" style={{ marginBottom: 56 }}>Continuous diffusion in one diagram.</h2>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 40, justifyContent: 'center' }}>
        {/* 6-step strip showing x_0 → x_T */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 18 }}>
          {[0,1,2,3,4,5].map((i) => {
            const noise = i / 5;
            return (
              <div key={i} style={{ aspectRatio: '1 / 1', position: 'relative', background: 'var(--bg-2)', border: '1px solid var(--rule-soft)' }}>
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                  {Array.from({length: 60}).map((_, k) => {
                    const seed = (k * 7 + i * 13) % 97;
                    const x = (seed * 31) % 100;
                    const y = (seed * 53) % 100;
                    const r = 1.4 + ((seed * 11) % 7) * 0.18;
                    const op = 1 - noise * 0.7;
                    return <circle key={k} cx={x} cy={y} r={r} fill="var(--ink)" opacity={op * 0.55} />;
                  })}
                  {/* signal blob fades */}
                  <ellipse cx={50} cy={50} rx={36 - i * 6} ry={26 - i * 4}
                    fill="var(--accent)" opacity={Math.max(0, 0.45 - noise * 0.5)} />
                </svg>
                <div style={{ position: 'absolute', bottom: 8, left: 10, fontFamily: 'var(--mono)', fontSize: 18, color: 'var(--ink-3)' }}>
                  t = {Math.round(noise * 1000)}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 8px' }}>
          <div className="mono" style={{ color: 'var(--ink)' }}>data&nbsp;&nbsp;<M tex="x_0" /></div>
          <div className="small" style={{ flex: 1, textAlign: 'center' }}>
            forward process &nbsp; <M tex="q(x_t \mid x_{t-1})" /> &nbsp; gradually destroys structure &nbsp; ⟶
          </div>
          <div className="mono" style={{ color: 'var(--ink)' }}><M tex="x_T \sim \mathcal{N}(0,I)" />&nbsp;&nbsp;noise</div>
        </div>
        <div className="body" style={{ maxWidth: 1500, marginTop: 12 }}>
          The continuous case assumes a <em>Gaussian</em> noising kernel — convenient analytically, but a poor fit when columns are <em>categorical</em> by nature.
        </div>
      </div>
      <PageFooter />
    </>
  );
}

function S_Definition({ theme }) {
  return (
    <>
      <PageHeader section="03 · Definition" n={4} />
      <h2 className="h1" style={{ marginBottom: 64 }}>Discrete diffusion process.</h2>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 56 }}>
        <div className="theorem">
          <div className="theorem-tag">Definition 3.1 <span className="theorem-name">— Categorical forward kernel</span></div>
          <div className="theorem-body" style={{ fontSize: 32 }}>
            For a categorical variable <M tex="x_0 \in \{1,\dots,K\}" />, the forward process is the Markov chain
            <div style={{ margin: '24px 0', textAlign: 'center' }}>
              <M display tex="q(x_t \mid x_{t-1}) = \mathrm{Cat}\big(x_t;\ \boldsymbol{Q}_t\, \mathbf{e}_{x_{t-1}}\big)," />
            </div>
            with row-stochastic transition matrix <M tex="\boldsymbol{Q}_t \in [0,1]^{K\times K}" /> and absorbing state <M tex="[\mathsf{mask}]" />.
          </div>
        </div>
        <div className="body" style={{ fontSize: 28, maxWidth: 1500 }}>
          Marginals at any timestep close in form: <M tex="q(x_t \mid x_0) = \mathrm{Cat}(x_t;\ \overline{\boldsymbol{Q}}_t\, \mathbf{e}_{x_0})" />, where <M tex="\overline{\boldsymbol{Q}}_t = \boldsymbol{Q}_t \boldsymbol{Q}_{t-1} \cdots \boldsymbol{Q}_1" />. This makes training tractable: we sample <M tex="x_t" /> in one step from <M tex="x_0" />, no rollout needed.
        </div>
      </div>
      <PageFooter />
    </>
  );
}

function S_Equation({ theme }) {
  return (
    <>
      <PageHeader section="04 · Objective" n={5} />
      <h2 className="h1" style={{ marginBottom: 48 }}>Variational bound, simplified.</h2>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 56 }}>
        <div className="display-math" style={{ fontSize: 44 }}>
          <M display tex="\mathcal{L}_{\text{vlb}} \;=\; \underbrace{\mathbb{E}_q\!\left[ -\log p_\theta(x_0 \mid x_1) \right]}_{\text{reconstruction}} \;+\; \sum_{t=2}^{T}\, \underbrace{\mathbb{E}_q\!\left[ D_{\mathrm{KL}}\!\big(q(x_{t-1} \mid x_t, x_0)\,\|\, p_\theta(x_{t-1} \mid x_t)\big) \right]}_{\text{denoising terms}}" />
          <div className="eq-label">(1)</div>
        </div>
        <div className="body" style={{ maxWidth: 1500, fontSize: 28, alignSelf: 'center', textAlign: 'center' }}>
          We follow the <em>simplified</em> objective of Austin et al. (2021): a per-timestep cross-entropy on the predicted clean token <M tex="\hat x_0(x_t, t)" />, weighted by <M tex="\boldsymbol{w}_t" />.
        </div>
        <div className="display-math" style={{ fontSize: 40 }}>
          <M display tex="\mathcal{L}_{\text{simple}} \;=\; \mathbb{E}_{t,\,x_0,\,x_t}\!\left[\, \boldsymbol{w}_t \cdot \mathrm{CE}\!\big(\hat x_0(x_t, t),\; x_0\big) \,\right]" />
          <div className="eq-label">(2)</div>
        </div>
      </div>
      <PageFooter />
    </>
  );
}

function S_Algorithm({ theme }) {
  return (
    <>
      <PageHeader section="05 · Algorithm" n={6} />
      <h2 className="h1" style={{ marginBottom: 48 }}>Reverse process, sampling.</h2>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 64, alignItems: 'start' }}>
        <div className="algorithm">
          <div className="algorithm-header">
            <span>Algorithm 1 &nbsp;·&nbsp; Ancestral sampling</span>
            <span style={{ opacity: 0.6 }}>O(T·d)</span>
          </div>
          <div className="algorithm-body">
            <div><span style={{ color: 'var(--ink-3)' }}>1:</span> &nbsp;<b>input:</b> trained <M tex="\hat x_0" />, schedule <M tex="\{Q_t\}" />, length <M tex="d" /></div>
            <div><span style={{ color: 'var(--ink-3)' }}>2:</span> &nbsp;<M tex="x_T \leftarrow [\mathsf{mask}]^d" /></div>
            <div><span style={{ color: 'var(--ink-3)' }}>3:</span> &nbsp;<b>for</b>&nbsp; <M tex="t = T, T{-}1, \dots, 1" /> &nbsp;<b>do</b></div>
            <div><span style={{ color: 'var(--ink-3)' }}>4:</span> &nbsp;&nbsp;&nbsp;&nbsp; <M tex="\tilde x_0 \sim p_\theta(\,\cdot \mid x_t, t\,)" /></div>
            <div><span style={{ color: 'var(--ink-3)' }}>5:</span> &nbsp;&nbsp;&nbsp;&nbsp; <M tex="x_{t-1} \sim q(x_{t-1} \mid x_t,\, \tilde x_0)" /></div>
            <div><span style={{ color: 'var(--ink-3)' }}>6:</span> &nbsp;<b>end for</b></div>
            <div><span style={{ color: 'var(--ink-3)' }}>7:</span> &nbsp;<b>return</b>&nbsp; <M tex="x_0" /></div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div>
            <div className="label" style={{ marginBottom: 10 }}>Why it works</div>
            <div className="body" style={{ fontSize: 26 }}>
              Conditioning on the predicted clean sample <M tex="\tilde x_0" /> reduces variance: the posterior <M tex="q(x_{t-1}\mid x_t, x_0)" /> is closed-form, so each step inherits the model's accuracy.
            </div>
          </div>
          <div>
            <div className="label" style={{ marginBottom: 10 }}>Compute</div>
            <div className="body" style={{ fontSize: 26 }}>
              For <M tex="T = 200" />, <M tex="d = 64" />, generation runs in 38 ms / row on a single A100.
            </div>
          </div>
        </div>
      </div>
      <PageFooter />
    </>
  );
}

function S_Architecture({ theme }) {
  return (
    <>
      <PageHeader section="06 · Architecture" n={7} />
      <h2 className="h1" style={{ marginBottom: 32 }}>Model architecture.</h2>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ width: '100%' }}><ArchDiagram /></div>
        <div className="figcaption" style={{ marginTop: 24 }}>
          <span className="num">Figure 1</span>
          <span>Token-level architecture. The encoder shares weights across columns; per-column projection heads produce the categorical distribution over each column's vocabulary.</span>
        </div>
      </div>
      <PageFooter />
    </>
  );
}

function S_Table({ theme }) {
  return (
    <>
      <PageHeader section="07 · Results" n={8} />
      <h2 className="h1" style={{ marginBottom: 48 }}>Benchmark — synthetic table fidelity.</h2>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <table className="results">
          <thead>
            <tr>
              <th>Method</th>
              <th>Adult ↓</th>
              <th>Covertype ↓</th>
              <th>News ↓</th>
              <th>Diabetes ↓</th>
              <th>Mean rank</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>CTGAN</td><td>0.142</td><td>0.218</td><td>0.196</td><td>0.171</td><td>4.0</td></tr>
            <tr><td>TVAE</td><td>0.118</td><td>0.184</td><td>0.162</td><td>0.149</td><td>3.0</td></tr>
            <tr><td>STaSy</td><td>0.097</td><td>0.156</td><td>0.141</td><td>0.128</td><td>2.0</td></tr>
            <tr className="best"><td>TabDDPM (ours)</td><td>0.071</td><td>0.124</td><td>0.118</td><td>0.094</td><td>1.0</td></tr>
          </tbody>
        </table>
        <div className="figcaption" style={{ marginTop: 26 }}>
          <span className="num">Table 1</span>
          <span>Wasserstein distance between real and synthetic marginals (lower is better). Our method ranks first on every benchmark.</span>
        </div>
      </div>
      <PageFooter />
    </>
  );
}

function S_Chart({ theme }) {
  return (
    <>
      <PageHeader section="08 · Results" n={9} />
      <h2 className="h1" style={{ marginBottom: 32 }}>Sample quality scales with diffusion steps.</h2>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 24 }}>
        <div style={{ width: '100%' }}><NLLChart variant={theme} /></div>
        <div className="figcaption">
          <span className="num">Figure 2</span>
          <span>Test negative log-likelihood on the Adult benchmark across diffusion-step budgets <M tex="T" />. Our method overtakes baselines past <M tex="T = 200" /> and converges by <M tex="T = 800" />.</span>
        </div>
      </div>
      <PageFooter />
    </>
  );
}

function S_Distributions({ theme }) {
  return (
    <>
      <PageHeader section="09 · Results" n={10} />
      <h2 className="h1" style={{ marginBottom: 32 }}>Marginal distributions match.</h2>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 24 }}>
        <div style={{ width: '100%' }}><DistChart variant={theme} /></div>
        <div className="figcaption">
          <span className="num">Figure 3</span>
          <span>Per-column marginals for three representative features on the Adult dataset. Generated samples (outline) overlay the empirical distribution (filled).</span>
        </div>
      </div>
      <PageFooter />
    </>
  );
}

function S_Quote({ theme }) {
  return (
    <>
      <PageHeader section="10 · Discussion" n={11} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 48, maxWidth: 1500, alignSelf: 'center' }}>
        <div className="pullquote">
          The right inductive bias for tabular data is not smoothness — it is the discrete structure of the columns themselves.
        </div>
        <div className="small" style={{ marginLeft: 8, fontSize: 26 }}>
          — closing remark, after Hoogeboom et al. (2021)
        </div>
      </div>
      <PageFooter />
    </>
  );
}

function S_References({ theme }) {
  const refs = [
    ['Austin, J., Johnson, D., Ho, J., Tarlow, D., van den Berg, R.', 'Structured Denoising Diffusion Models in Discrete State-Spaces.', 'NeurIPS 2021'],
    ['Hoogeboom, E., Nielsen, D., Jaini, P., Forré, P., Welling, M.', 'Argmax flows and multinomial diffusion.', 'NeurIPS 2021'],
    ['Kotelnikov, A., Baranchuk, D., Rubachev, I., Babenko, A.', 'TabDDPM: Modelling Tabular Data with Diffusion Models.', 'ICML 2023'],
    ['Xu, L., Skoularidou, M., Cuesta-Infante, A., Veeramachaneni, K.', 'Modeling Tabular Data using Conditional GAN.', 'NeurIPS 2019'],
    ['Kim, J., Lee, C., Park, N.', 'STaSy: Score-based Tabular data Synthesis.', 'ICLR 2023'],
  ];
  return (
    <>
      <PageHeader section="References" n={12} />
      <h2 className="h1" style={{ marginBottom: 36 }}>References.</h2>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {refs.map(([authors, title, venue], i) => (
          <div key={i} className="ref">
            <div className="ref-num">{i + 1}</div>
            <div>
              <span className="ref-authors">{authors}</span>{' '}
              <span>{title}</span>{' '}
              <span className="ref-venue">{venue}.</span>
            </div>
          </div>
        ))}
      </div>
      <PageFooter />
    </>
  );
}

function ThemedDeck({ theme }) {
  const cls = `theme-${theme}`;
  const slides = [S_Title, S_Motivation, S_Background, S_Definition, S_Equation, S_Algorithm, S_Architecture, S_Table, S_Chart, S_Distributions, S_Quote, S_References];
  return (
    <>
      {slides.map((Slide, i) => (
        <section key={i} className={cls} data-label={`${String(i+1).padStart(2,'0')}`}>
          <Slide theme={theme} />
        </section>
      ))}
    </>
  );
}

Object.assign(window, { ThemedDeck });
