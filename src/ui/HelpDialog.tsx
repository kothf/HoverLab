import { useEffect, useState, type ReactNode } from 'react';
import { getLang, useT } from '../i18n';
import { HELP_CONTENT_HE } from '../i18n/guide-he';
import { HELP_CONTENT_RU } from '../i18n/guide-ru';
import { ext, REPO } from './helpLinks';
import { Icon } from './Icons';

export type HelpTab = 'start' | 'calc' | 'optimizer' | 'library' | 'model' | 'warnings' | 'faq' | 'about';

const TABS: { key: HelpTab; label: string }[] = [
  { key: 'start', label: 'Getting started' },
  { key: 'calc', label: 'Calculator' },
  { key: 'optimizer', label: 'Design optimizer' },
  { key: 'library', label: 'Parts library' },
  { key: 'model', label: 'How it calculates' },
  { key: 'warnings', label: 'Warnings' },
  { key: 'faq', label: 'FAQ' },
  { key: 'about', label: 'About & credits' },
];

const CONTENT: Record<HelpTab, ReactNode> = {
  start: (
    <>
      <p>
        HoverLab estimates how a multirotor will fly from its parts: frame, battery, ESCs, motors and propellers. Everything recalculates as you type, and
        nothing leaves your browser.
      </p>
      <ol>
        <li>
          Pick a <strong>preset</strong> close to your build (top bar → Presets), or start from the current one.
        </li>
        <li>
          In the <strong>Calculator</strong> tab, replace parts section by section. Each section has a search box: type a brand or size such as{' '}
          <code>tmotor 2207</code> or <code>gemfan 5</code>. If your part is missing, choose <em>Can't find it? Define a custom part</em>.
        </li>
        <li>
          Read the results on the right: the drone sketch, the key numbers, the status lights, warnings, the <strong>Conclusions</strong> card, charts and
          the detailed table.
        </li>
        <li>
          Fix anything red or amber, then use the <strong>Design optimizer</strong> tab if you want HoverLab to suggest a better motor, prop, cell count or
          battery for your goal.
        </li>
        <li>
          Save the build (Load / Save), export a PDF or CSV report, or copy a share link (Export).
        </li>
      </ol>
      <p className="muted">
        Every input and result has a small <strong>?</strong> next to it with a short explanation and typical values.
      </p>
    </>
  ),
  calc: (
    <>
      <h4>Inputs (left)</h4>
      <ul>
        <li>
          <strong>Atmosphere</strong>: field elevation and temperature set the air density. Thinner air means less thrust per rpm.
        </li>
        <li>
          <strong>Frame &amp; payload</strong>: layout (quad, hexa, octo, X8 coax), max prop size and wheelbase (linked), frame weight with electronics, payload
          (added on top), accessory current and drag area.
        </li>
        <li>
          <strong>Battery</strong>: chemistry, cells in series (S) and parallel (P), capacity, cell resistance, C ratings, pack weight and usable capacity.
          Changing S offers a matching motor Kv.
        </li>
        <li>
          <strong>ESC</strong>, <strong>Motor</strong> and <strong>Propeller</strong>: ratings and constants. Empty fields marked <em>auto</em> are estimated
          from the other values.
        </li>
      </ul>
      <h4>Results (right)</h4>
      <ul>
        <li>
          <strong>Drone sketch</strong>: top view drawn to scale, with overall width and length. The dashed ring is the largest prop the frame fits. Motors and
          battery turn amber or red with their warnings.
        </li>
        <li>
          <strong>Key numbers</strong>: hover and mixed flight time, thrust-to-weight, all-up weight, hover throttle, specific thrust (g/W), peak power, top
          speed, climb and best range.
        </li>
        <li>
          <strong>Status lights and warnings</strong>: green is fine, amber needs attention, red should be fixed before flying.
        </li>
        <li>
          <strong>Conclusions</strong>: a plain-language verdict with practical payload, matching tips and battery limits.
        </li>
        <li>
          <strong>Charts</strong>: thrust, current and power, efficiency against throttle, motor temperature over time, and payload against flight time. Pin up
          to three builds to compare them on the thrust chart.
        </li>
        <li>
          <strong>System metrics table</strong>: hover, best-efficiency and full-throttle operating points side by side.
        </li>
      </ul>
    </>
  ),
  optimizer: (
    <>
      <p>
        The optimizer works backwards: you give the goal and limits, it searches thousands of combinations of prop size and pitch, cell count, motor size, Kv
        and battery energy, and returns up to five of the best designs.
      </p>
      <ul>
        <li>
          <strong>Goals</strong>: maximum flight endurance, maximum payload (spare lift while meeting the target endurance), or maximum flight range.
        </li>
        <li>
          <strong>Limits</strong>: target payload and endurance, minimum range, max prop size or wheelbase, minimum thrust-to-weight, maximum hover throttle,
          and the cell-count range.
        </li>
        <li>
          Frame weight, payload, battery chemistry and environment follow the Calculator, and the <em>From the calculator</em> card shows the build you start
          from.
        </li>
        <li>
          Every returned design passes the full simulation with no errors or warnings. <strong>Apply</strong> opens it in the Calculator.
        </li>
      </ul>
      <p className="muted">
        Optimizer parts are generic: motor resistance and no-load current are scaled from motor mass and Kv. After applying a design, pick real parts with
        similar specs from the library and check the result again.
      </p>
    </>
  ),
  library: (
    <>
      <p>
        The built-in library has a few hundred motors, propellers, batteries and cells, ESCs and frames, from tiny whoops to heavy-lift systems, including
        brands sold mainly on AliExpress and Banggood.
      </p>
      <ul>
        <li>Open it from the top bar (Library), or use the search box at the top of each section.</li>
        <li>
          Parts marked <em>est.</em> have some values estimated from similar parts because the maker did not publish them. Check the datasheet for exact
          numbers.
        </li>
        <li>
          <strong>Custom parts</strong>: <em>+ New part</em>, <em>+ From current config</em>, or <em>Can't find it? Define a custom part</em> in any search. They are
          stored in this browser. Use <em>Export custom</em> / <em>Import JSON</em> to back them up or move them to another device.
        </li>
      </ul>
    </>
  ),
  model: (
    <>
      <p>The calculation chains standard models. In short:</p>
      <ul>
        <li>
          <strong>Air</strong>: International Standard Atmosphere pressure at your elevation, density from pressure and temperature.
        </li>
        <li>
          <strong>Propeller</strong>: static thrust T = C<sub>T</sub>·ρ·n²·D⁴ and power P = C<sub>P</sub>·ρ·n³·D⁵. Without measured constants, C<sub>T</sub> and
          C<sub>P</sub> are estimated from pitch, diameter and blade count (about ±15 %).
        </li>
        <li>
          <strong>Motor</strong>: I = I₀ + Q·Kv/9.5488 and V = rpm/Kv + I·R<sub>m</sub>, with no-load losses growing with speed.
        </li>
        <li>
          <strong>ESC and battery</strong>: averaged PWM with resistive and switching losses; the battery sags by its internal resistance.
        </li>
        <li>
          <strong>Flight time</strong>: usable capacity ÷ hover current. Mixed flight assumes 70 % hover and 30 % at half-way to full throttle.
        </li>
        <li>
          <strong>Forward flight, climb and range</strong>: momentum theory with translational lift, profile power growth with advance ratio, and body drag.
        </li>
        <li>
          <strong>Motor temperature</strong>: a first-order thermal model scaled by motor mass. Treat it as a rough indicator.
        </li>
      </ul>
      <p className="muted">
        With accurate motor and prop data, results are typically within ±10–15 % of bench tests. Always verify against manufacturer data and measurements
        before flight. The checks against literature are documented in {ext(`${REPO}/blob/main/docs/physics-validation.md`, 'physics-validation.md')}.
      </p>
    </>
  ),
  warnings: (
    <>
      <ul>
        <li>
          <strong>Cannot hover / low thrust-to-weight</strong>: below 2:1 the craft is hard to control in wind; below 1.6:1 it is unsafe. Use bigger props,
          higher Kv or more cells, or reduce weight.
        </li>
        <li>
          <strong>Hover throttle high</strong>: above 60 % leaves little control margin. Aim for 35–55 %.
        </li>
        <li>
          <strong>Motor overload / temperature</strong>: over 80 °C after 15 s at full throttle, or above the rated current or power. Use a bigger motor or a
          smaller prop or lower Kv.
        </li>
        <li>
          <strong>ESC overload</strong>: full-throttle current above the ESC's continuous or burst rating.
        </li>
        <li>
          <strong>Battery C-rate and voltage sag</strong>: the pack can't deliver the current, or its voltage drops below the safe cell minimum. Use a bigger or
          higher-rated pack.
        </li>
        <li>
          <strong>Prop too large / tip speed</strong>: the prop doesn't fit the frame, or blade tips go above Mach 0.7.
        </li>
      </ul>
    </>
  ),
  faq: (
    <>
      <h4>Does "Frame + electronics" include payload?</h4>
      <p>No. Payload is a separate input and is added on top.</p>
      <h4>Why does a part say "est."?</h4>
      <p>Its maker didn't publish some values, so they were estimated from similar parts. Enter datasheet values when you have them.</p>
      <h4>Where are my saved builds and custom parts?</h4>
      <p>In this browser's local storage. Export them (Config file, Export custom) to keep a copy.</p>
      <h4>Does it work offline?</h4>
      <p>Yes. After the first visit HoverLab is cached and can be installed as an app from the browser menu.</p>
      <h4>I still see an old version.</h4>
      <p>Reload the page. The version is shown next to the HoverLab name.</p>
      <h4>How do I share a build?</h4>
      <p>Export → Copy share link. The whole build is encoded in the link; nothing is uploaded.</p>
    </>
  ),
  about: (
    <>
      <p>
        <strong>HoverLab</strong> v{__APP_VERSION__}: a professional multirotor powertrain calculator and design optimizer.
      </p>
      <p>
        Created by <strong>Andrey</strong> for {ext('https://aerocat.tech', 'aerocat.tech')}. Source code: {ext(REPO, 'github.com/kothf/HoverLab')}, MIT
        license. Bug reports and ideas: {ext(`${REPO}/issues`, 'GitHub issues')}.
      </p>
      <h4>References</h4>
      <ul>
        <li>U.S. Standard Atmosphere, 1976 (NOAA/NASA/USAF).</li>
        <li>J. G. Leishman, <em>Principles of Helicopter Aerodynamics</em>, 2nd ed., Cambridge University Press, 2006.</li>
        <li>
          J. Brandt, M. Selig, "Propeller Performance Data at Low Reynolds Numbers", AIAA 2011-1255, and the{' '}
          {ext('https://m-selig.ae.illinois.edu/props/propDB.html', 'UIUC Propeller Data Site')}.
        </li>
        <li>M. Drela, DC electric motor models (QPROP documentation), MIT.</li>
        <li>
          D. Shi, X. Dai, X. Zhang, Q. Quan, "A Practical Performance Evaluation Method for Electric Multicopters", IEEE/ASME Trans. Mechatronics, 2017; Q. Quan,{' '}
          <em>Introduction to Multicopter Design and Control</em>, Springer, 2017.
        </li>
        <li>L. Bauersfeld, D. Scaramuzza, "Range, Endurance, and Optimal Speed Estimates for Multicopters", IEEE RA-L, 2022.</li>
        <li>R. C. Harrington, NACA TN-2318, 1951 (coaxial rotors).</li>
      </ul>
      <h4>Data</h4>
      <p>
        Part specifications are typical figures from manufacturer and retailer listings and forum measurements; see{' '}
        {ext(`${REPO}/blob/main/docs/library-sources.md`, 'library-sources.md')}. Brand names belong to their owners; HoverLab is not affiliated with them.
      </p>
      <h4>Built with</h4>
      <p>
        {ext('https://react.dev', 'React')}, {ext('https://recharts.org', 'Recharts')}, {ext('https://vite.dev', 'Vite')},{' '}
        {ext('https://vite-pwa-org.netlify.app', 'vite-plugin-pwa')} / Workbox, TypeScript and Vitest.
      </p>
      <p className="muted">
        HoverLab gives estimates, not guarantees. Check every build against manufacturer data and fly safely.
      </p>
    </>
  ),
};

interface Props {
  initial?: HelpTab;
  onClose: () => void;
}

export function HelpDialog({ initial = 'start', onClose }: Props) {
  const t = useT();
  const [tab, setTab] = useState<HelpTab>(initial);
  const lang = getLang();
  const content = lang === 'ru' ? HELP_CONTENT_RU : lang === 'he' ? HELP_CONTENT_HE : CONTENT;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal help-modal" role="dialog" aria-label={t('HoverLab help')} onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2>
            <Icon name="library" /> {tab === 'about' ? t('About HoverLab') : t('HoverLab help')}
          </h2>
          <button className="btn ghost" onClick={onClose} aria-label={t('Close')}>
            ×
          </button>
        </header>
        <div className="help-layout">
          <nav className="help-nav" aria-label={t('Help topics')}>
            {TABS.map((x) => (
              <button key={x.key} className={tab === x.key ? 'active' : ''} onClick={() => setTab(x.key)}>
                {t(x.label)}
              </button>
            ))}
          </nav>
          <article className="help-body">
            <h3>{t(TABS.find((x) => x.key === tab)!.label)}</h3>
            {content[tab]}
          </article>
        </div>
      </div>
    </div>
  );
}
