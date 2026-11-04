import { MAX_TEMP_WINDOW_S } from '../engine/solver';
import type { Config, Msg, OperatingPoint, Results } from '../engine/types';
import { tm, useT } from '../i18n';
import { frameClass, wheelbaseMm } from '../lib/frame';
import { fmt, fmtNum, fmtThrust } from '../lib/units';
import { Charts, type Snapshot } from './Charts';
import { useUnits } from './context';
import { DroneSketch } from './DroneSketch';
import { HelpTip } from './HelpTip';
import { deriveInsights } from './insights';

interface Props {
  config: Config;
  results: Results | null;
  errors: Msg[];
  snapshots: Snapshot[];
  onSnapshot: () => void;
  onRemoveSnapshot: (id: string) => void;
}

const pct = (v: number) => `${fmtNum(v * 100, 0)} %`;

export function ResultsPanel({ config, results: r, errors, snapshots, onSnapshot, onRemoveSnapshot }: Props) {
  const system = useUnits();
  const t = useT();
  if (!r) {
    return (
      <div className="results">
        <div className="card error-card">
          <h3>{t('Check your inputs')}</h3>
          <ul>{errors.map((e) => <li key={e.tpl + JSON.stringify(e.vars ?? {})}>{tm(e)}</li>)}</ul>
        </div>
      </div>
    );
  }
  const h = r.hover;
  const kpis: { label: string; value: string; sub?: string; tone?: 'good' | 'warn' | 'danger' }[] = [
    { label: 'Hover time', value: h ? `${fmtNum(r.hoverTime, 1)} ${t('min')}` : '—', sub: t('mixed {v} min', { v: fmtNum(r.mixedTime, 1) }), tone: h ? undefined : 'danger' },
    { label: 'Thrust / weight', value: `${fmtNum(r.thrustToWeight, 2)} : 1`, sub: t('max {v}', { v: fmtThrust(system, r.max.totalThrust) }), tone: r.thrustToWeight < 1.6 ? 'danger' : r.thrustToWeight < 2 ? 'warn' : 'good' },
    { label: 'All-up weight', value: fmt(system, 'mass', r.auw), sub: t('drive {a} / frame {b}', { a: pct(r.driveRatio), b: pct(1 - r.driveRatio) }) },
    { label: 'Hover throttle', value: h ? pct(h.throttle) : t('cannot hover'), sub: h ? `${fmtNum(h.batteryCurrent, 1)} ${t('A')} · ${fmtNum(h.electricPower, 0)} ${t('W')}` : undefined, tone: !h || h.throttle > 0.75 ? 'danger' : h.throttle > 0.6 ? 'warn' : 'good' },
    { label: 'Specific thrust', value: h ? `${fmtNum(h.specificThrust, 2)} ${t('g/W')}` : '—', sub: h ? t('motor eff {v}', { v: pct(h.motorEfficiency) }) : undefined },
    { label: 'Peak power', value: `${fmtNum(r.max.electricPower, 0)} ${t('W')}`, sub: `${fmtNum(r.max.batteryCurrent, 1)} ${t('A')} · ${fmtNum(r.max.cRate, 1)}C` },
    { label: 'Max speed', value: fmt(system, 'speed', r.maxSpeed), sub: t('climb {v}', { v: fmt(system, 'climb', r.climbRate) }) },
    { label: 'Best range', value: r.range ? fmt(system, 'distance', r.range.distance) : '—', sub: r.range ? t('at {v}', { v: fmt(system, 'speed', r.range.speed) }) : undefined },
  ];

  return (
    <div className="results">
      <div className="overview">
        <DroneSketch config={config} results={r} />
        <div className="kpis">
        {kpis.map((k) => (
          <div key={k.label} className={`card kpi ${k.tone ?? ''}`}>
            <span className="kpi-label">
              {t(k.label)}
              <HelpTip topic={k.label} />
            </span>
            <span className="kpi-value">{k.value}</span>
            {k.sub && <span className="kpi-sub">{k.sub}</span>}
          </div>
        ))}
      </div>
      </div>

      <div className="card status">
        {r.status.map((s) => (
          <div key={s.key} className={`status-item ${s.severity}`}>
            <span className="dot" aria-hidden />
            <span className="status-label">
              {t(s.label)}
              <HelpTip topic={s.label} />
            </span>
            <span className="status-value">{s.key === 'thermal' ? fmt(system, 'temp', r.motorTempMax) : s.value}</span>
          </div>
        ))}
      </div>

      {r.warnings.length > 0 && (
        <ul className="warnings">
          {r.warnings.map((w) => (
            <li key={w.code + w.message} className={w.severity}>
              <span aria-hidden>{w.severity === 'danger' ? '⛔' : '⚠️'}</span> {tm(w)}
            </li>
          ))}
        </ul>
      )}

      <div className="card conclusions">
        <h3>
          {t('Conclusions')}
          <HelpTip topic="Conclusions" />
        </h3>
        <ul>
          {deriveInsights(config, r, system).map((i) => (
            <li key={i.code} className={i.tone}>
              <strong>{i.title}.</strong> {i.text}
            </li>
          ))}
        </ul>
      </div>

      <div className="compare-bar">
        <button className="btn small" onClick={onSnapshot} disabled={snapshots.length >= 3} title={t('Pin the current results to overlay them on the thrust chart')}>
          {t('+ Pin for comparison ({n}/3)', { n: snapshots.length })}
        </button>
        {snapshots.map((s) => (
          <span key={s.id} className="chip" style={{ borderColor: s.color }}>
            <span className="swatch" style={{ background: s.color }} />
            {s.name}
            <button aria-label={t('Remove {name}', { name: s.name })} onClick={() => onRemoveSnapshot(s.id)}>×</button>
          </span>
        ))}
      </div>

      <Charts results={r} snapshots={snapshots} />

      <MetricsTable config={config} r={r} />
    </div>
  );
}

function MetricsTable({ config, r }: { config: Config; r: Results }) {
  const system = useUnits();
  const t = useT();
  const cols: { title: string; op: OperatingPoint | null }[] = [
    { title: 'Hover', op: r.hover },
    { title: 'Max efficiency', op: r.optimum },
    { title: 'Full throttle', op: r.max },
  ];
  const rows: { label: string; get: (o: OperatingPoint) => string }[] = [
    { label: 'Throttle', get: (o) => pct(o.throttle) },
    { label: 'RPM', get: (o) => fmtNum(o.rpm) },
    { label: 'Thrust per motor', get: (o) => fmt(system, 'thrust', o.thrustPerMotor) },
    { label: 'Current per motor', get: (o) => `${fmtNum(o.motorCurrent, 1)} ${t('A')}` },
    { label: 'Battery current', get: (o) => `${fmtNum(o.batteryCurrent, 1)} ${t('A')}` },
    { label: 'Battery voltage', get: (o) => `${fmtNum(o.batteryVoltage, 2)} ${t('V')}` },
    { label: 'Electric power', get: (o) => `${fmtNum(o.electricPower, 0)} ${t('W')}` },
    { label: 'Shaft power per motor', get: (o) => `${fmtNum(o.mechPowerPerMotor, 0)} ${t('W')}` },
    { label: 'Motor efficiency', get: (o) => pct(o.motorEfficiency) },
    { label: 'ESC efficiency', get: (o) => pct(o.escEfficiency) },
    { label: 'Specific thrust', get: (o) => `${fmtNum(o.specificThrust, 2)} ${t('g/W')}` },
    { label: 'Battery C-rate', get: (o) => `${fmtNum(o.cRate, 1)}C` },
    { label: 'Prop tip Mach', get: (o) => fmtNum(o.tipMach, 2) },
  ];
  const w = r.weights;
  return (
    <div className="card tables">
      <h3>{t('System metrics & performance verdict')}</h3>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th />
              {cols.map((c) => <th key={c.title}>{t(c.title)}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">
                  {t(row.label)}
                  <HelpTip topic={row.label} />
                </th>
                {cols.map((c) => <td key={c.title}>{c.op ? row.get(c.op) : '—'}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="verdict-grid">
        <dl>
          <dt>{t('Motor temp, hover')}<HelpTip topic="Motor temp, hover" /></dt><dd>{fmt(system, 'temp', r.motorTempHover)}</dd>
          <dt>{t('Motor temp, {s} s full', { s: MAX_TEMP_WINDOW_S })}<HelpTip topic="Motor thermal" /></dt><dd>{fmt(system, 'temp', r.motorTempMax)}</dd>
          <dt>{t('Practical extra payload')}<HelpTip topic="Practical extra payload" /></dt><dd>{fmt(system, 'mass', r.practicalPayload)}</dd>
          <dt>{t('Max extra payload')}<HelpTip topic="Max extra payload" /></dt><dd>{fmt(system, 'mass', r.maxPayload)}</dd>
          <dt>{t('Hover time per {m}', { m: fmt(system, 'mass', 100) })}<HelpTip topic="Hover time per 100 g" /></dt><dd>−{fmtNum(r.payloadCost * 60)} {t('s')}</dd>
          <dt>{t('Sag at end of pack')}<HelpTip topic="Sag at end of pack" /></dt><dd>{fmtNum(r.sagEnd, 2)} {t('V/cell')}</dd>
          <dt>{t('Air density')}<HelpTip topic="Air density" /></dt><dd>{fmtNum(r.airDensity, 3)} {t('kg/m³')}</dd>
        </dl>
        <dl>
          <dt>{t('Pack')}<HelpTip topic="Pack" /></dt><dd>{t('{a} V nom · {b} V full', { a: fmtNum(r.battery.nominalVoltage, 1), b: fmtNum(r.battery.fullVoltage, 1) })}</dd>
          <dt>{t('Energy')}<HelpTip topic="Energy" /></dt><dd>{t('{a} Wh · {b} mAh usable', { a: fmtNum(r.battery.energy, 1), b: fmtNum(r.battery.usable) })}</dd>
          <dt>{t('Pack resistance')}<HelpTip topic="Pack resistance" /></dt><dd>{fmtNum(r.battery.resistance * 1000, 1)} {t('mΩ')}</dd>
          <dt>{t('Prop Ct / Cp')}<HelpTip topic="Prop Ct / Cp" /></dt><dd>{fmtNum(r.propCt, 3)} / {fmtNum(r.propCp, 3)}{config.prop.ct == null ? ` ${t('(est.)')}` : ''}</dd>
        </dl>
        <dl>
          <dt>{t('Frame size')}<HelpTip topic="Wheelbase" /></dt><dd>{frameClass(config.frame.maxPropIn, config.frame.layout)} · {Math.round(wheelbaseMm(config.frame.maxPropIn, config.frame.layout))} {t('mm')}</dd>
          <dt>{t('Frame + payload')}<HelpTip topic="Frame + payload" /></dt><dd>{fmt(system, 'mass', w.frame + w.payload)}</dd>
          <dt>{t('Motors + props')}<HelpTip topic="Motors + props" /></dt><dd>{fmt(system, 'mass', w.motors + w.props)}</dd>
          <dt>{t('ESCs')}<HelpTip topic="ESCs" /></dt><dd>{fmt(system, 'mass', w.escs)}</dd>
          <dt>{t('Battery')}<HelpTip topic="Battery" /></dt><dd>{fmt(system, 'mass', w.battery)}</dd>
        </dl>
      </div>
    </div>
  );
}
