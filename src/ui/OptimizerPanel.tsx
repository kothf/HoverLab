import { useEffect, useState } from 'react';
import { DEFAULT_TARGETS, type OptimizerMode, type OptimizerResult, type OptimizerTargets } from '../engine/optimizer';
import { CHEMISTRIES, LAYOUTS } from '../engine/physics';
import type { Chemistry, Config, Results } from '../engine/types';
import { frameClass, maxPropForWheelbase, wheelbaseMm } from '../lib/frame';
import { fmt, fmtNum, fmtThrust } from '../lib/units';
import { optEngine } from '../worker/engineClient';
import { useUnits } from './context';
import { NumberField, SelectField } from './fields';
import { Icon } from './Icons';

interface Props {
  config: Config;
  results: Results | null;
  onApply: (c: Config) => void;
}

/** Fields the optimizer takes from the calculator build; goals and limits stay the user's. */
function buildFields(c: Config): Partial<OptimizerTargets> {
  return {
    layout: c.frame.layout,
    chemistry: c.battery.chemistry,
    frameWeight: c.frame.weight,
    payload: c.frame.payload,
    maxPropIn: c.frame.maxPropIn,
    accessoryCurrent: c.frame.accessoryCurrent,
    elevation: c.env.elevation,
    temperature: c.env.temperature,
  };
}

function targetsFrom(c: Config): OptimizerTargets {
  return {
    ...DEFAULT_TARGETS,
    ...buildFields(c),
    layout: c.frame.layout,
    chemistry: c.battery.chemistry,
    frameWeight: c.frame.weight,
    payload: c.frame.payload,
    maxPropIn: c.frame.maxPropIn,
    maxCells: Math.max(6, c.battery.s),
    accessoryCurrent: c.frame.accessoryCurrent,
    elevation: c.env.elevation,
    temperature: c.env.temperature,
  };
}

export function OptimizerPanel({ config, results, onApply }: Props) {
  const system = useUnits();
  const [t, setT] = useState<OptimizerTargets>(() => targetsFrom(config));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<OptimizerResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<OptimizerTargets>) => setT((x) => ({ ...x, ...patch }));

  // Follow the calculator: whenever the build changes, take its frame, payload, battery chemistry
  // and environment, and make sure its cell count is inside the searched range.
  useEffect(() => {
    setT((x) => ({ ...x, ...buildFields(config), minCells: Math.min(x.minCells, config.battery.s), maxCells: Math.max(x.maxCells, config.battery.s) }));
  }, [config]);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(await optEngine.optimize(t));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="opt-page">
      <div className="card opt-form">
      <h2 className="opt-title">
        <Icon name="optimizer" /> Design optimizer
      </h2>
      <p className="muted small">Set your goal and limits; the optimizer searches props, cell count, motor size, Kv and battery and returns the best clean designs. Apply one to open it in the calculator.</p>
      <BuildSummary config={config} results={results} />
      <div className="grid2">
        <SelectField<OptimizerMode>
          label="Objective"
          value={t.mode}
          options={[
            { value: 'endurance', label: 'Maximum flight endurance' },
            { value: 'payload', label: 'Maximum payload / lift' },
            { value: 'range', label: 'Maximum flight range' },
          ]}
          onChange={(v) => set({ mode: v })}
        />
        <SelectField<Chemistry>
          label="Battery chemistry"
          value={t.chemistry}
          options={(Object.keys(CHEMISTRIES) as Chemistry[]).map((k) => ({ value: k, label: CHEMISTRIES[k].label }))}
          onChange={(v) => set({ chemistry: v })}
        />
        <NumberField label="Target payload" quantity="mass" value={t.payload} onChange={(v) => set({ payload: v ?? 0 })} step={50} />
        <NumberField label="Target endurance" unitLabel="min" value={t.flightTime} onChange={(v) => set({ flightTime: v ?? 0 })} step={1} />
        <NumberField label="Min flight range" quantity="distance" value={t.minRange} onChange={(v) => set({ minRange: Math.max(0, v ?? 0) })} step={0.5} min={0} />
        <NumberField label="Frame + electronics" quantity="mass" value={t.frameWeight} onChange={(v) => set({ frameWeight: v ?? 0 })} step={10} />
        <NumberField label="Max prop size" unitLabel="in" value={t.maxPropIn} onChange={(v) => set({ maxPropIn: v ?? 5 })} step={0.5} />
        <NumberField
          label="Wheelbase"
          unitLabel="mm"
          value={Math.round(wheelbaseMm(t.maxPropIn, t.layout))}
          onChange={(v) => v && set({ maxPropIn: +maxPropForWheelbase(v, t.layout).toFixed(1) })}
          step={10}
        />
        <NumberField label="Min thrust/weight" unitLabel=": 1" value={t.minThrustRatio} onChange={(v) => set({ minThrustRatio: v ?? 2 })} step={0.1} />
        <NumberField label="Max hover throttle" unitLabel="%" value={t.maxHoverThrottle * 100} onChange={(v) => set({ maxHoverThrottle: (v ?? 60) / 100 })} step={5} />
        <NumberField label="Min cells" unitLabel="S" integer value={t.minCells} onChange={(v) => set({ minCells: v ?? 1 })} step={1} min={1} max={24} />
        <NumberField label="Max cells" unitLabel="S" integer value={t.maxCells} onChange={(v) => set({ maxCells: v ?? 6 })} step={1} min={1} max={24} />
      </div>
      <div className="row">
        <button className="btn primary wide" onClick={run} disabled={busy}>
          {busy ? 'Optimizing…' : 'Run automatic design optimizer'}
        </button>
        <button className="btn small ghost" onClick={() => setT(targetsFrom(config))} title="Reset goals and limits to defaults, keeping the calculator build">
          Reset
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
      </div>
      <div className="opt-out">
      {!result && !busy && <div className="card muted opt-empty">Results appear here. Press <strong>Run automatic design optimizer</strong> to start.</div>}
      {result && (
        <div className="opt-results">
          <p className="muted small">
            {fmtNum(result.evaluated)} permutations evaluated, {fmtNum(result.feasible)} feasible, in {fmtNum(result.elapsedMs)} ms.
          </p>
          {result.candidates.length === 0 && <p className="error-text">No configuration meets all constraints. Relax thrust ratio, endurance, hover throttle or prop size.</p>}
          {result.candidates.map((c, i) => (
            <div key={i} className="opt-card">
              <div className="opt-head">
                <strong>#{i + 1} · {c.config.prop.diameter}x{c.config.prop.pitch}x{c.config.prop.blades} · {c.config.battery.s}S{c.config.battery.p}P {fmtNum(c.config.battery.capacity * c.config.battery.p)} mAh</strong>
                <button className="btn small primary" onClick={() => onApply(c.config)}>Apply</button>
              </div>
              <div className="opt-metrics">
                <span>
                  Frame {frameClass(c.config.frame.maxPropIn, c.config.frame.layout)} · {Math.round(wheelbaseMm(c.config.frame.maxPropIn, c.config.frame.layout))} mm
                </span>
                <span>Motor {c.config.motor.weight} g · {c.config.motor.kv}KV</span>
                <span className={c.meetsFlightTime ? 'ok-text' : 'warn-text'}>Hover {fmtNum(c.hoverTime, 1)} min</span>
                <span className={t.mode === 'range' ? 'ok-text' : undefined}>
                  Range {fmt(system, 'distance', c.range)} at {fmt(system, 'speed', c.rangeSpeed)}
                </span>
                <span>T/W {fmtNum(c.thrustToWeight, 2)}</span>
                <span>Throttle {fmtNum(c.hoverThrottle * 100)} %</span>
                <span>{fmtNum(c.specificThrust, 2)} g/W</span>
                <span>AUW {fmt(system, 'mass', c.auw)}</span>
                <span>Spare lift {fmtThrust(system, c.liftCapacity)}</span>
                <span>{fmt(system, 'temp', c.motorTempMax)} max</span>
              </div>
            </div>
          ))}
          <p className="muted small">Optimizer parts are generic: motor resistance and no-load current are scaled from mass and Kv. Pick real parts with similar specs from the library afterwards.</p>
        </div>
      )}
      </div>
    </div>
  );
}

/** The calculator build the optimizer starts from, so both tabs show the same parameters. */
function BuildSummary({ config: c, results: r }: { config: Config; results: Results | null }) {
  const system = useUnits();
  const b = c.battery;
  const rows: [string, string][] = [
    ['Frame', `${c.frame.name ?? frameClass(c.frame.maxPropIn, c.frame.layout)} · ${LAYOUTS[c.frame.layout].label} · ${Math.round(wheelbaseMm(c.frame.maxPropIn, c.frame.layout))} mm`],
    ['Weight', `${fmt(system, 'mass', c.frame.weight)} frame + ${fmt(system, 'mass', c.frame.payload)} payload`],
    ['Battery', `${b.name ? `${b.name} · ` : ''}${CHEMISTRIES[b.chemistry].label} ${b.s}S${b.p}P ${fmtNum(b.capacity * b.p)} mAh`],
    ['Motor', `${c.motor.name ?? 'Custom'} · ${c.motor.kv} KV`],
    ['Prop', `${c.prop.name ?? 'Custom'} · ${c.prop.diameter}×${c.prop.pitch}×${c.prop.blades}`],
  ];
  if (r) rows.push(['Now', `${r.hover ? `hover ${fmtNum(r.hoverTime, 1)} min` : 'cannot hover'} · T/W ${fmtNum(r.thrustToWeight, 2)} · AUW ${fmt(system, 'mass', r.auw)}${r.range ? ` · range ${fmt(system, 'distance', r.range.distance)}` : ''}`]);
  return (
    <div className="build-summary">
      <h4>From the calculator</h4>
      <dl>
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="muted small">Frame, payload, battery chemistry and environment below follow the calculator automatically.</p>
    </div>
  );
}
