import { useState } from 'react';
import { DEFAULT_TARGETS, type OptimizerMode, type OptimizerResult, type OptimizerTargets } from '../engine/optimizer';
import { CHEMISTRIES } from '../engine/physics';
import type { Chemistry, Config } from '../engine/types';
import { fmt, fmtNum, fmtThrust } from '../lib/units';
import { optEngine } from '../worker/engineClient';
import { useUnits } from './context';
import { NumberField, Section, SelectField } from './fields';

interface Props {
  config: Config;
  onApply: (c: Config) => void;
}

function targetsFrom(c: Config): OptimizerTargets {
  return {
    ...DEFAULT_TARGETS,
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

export function OptimizerPanel({ config, onApply }: Props) {
  const system = useUnits();
  const [t, setT] = useState<OptimizerTargets>(() => targetsFrom(config));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<OptimizerResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<OptimizerTargets>) => setT((x) => ({ ...x, ...patch }));

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
    <Section icon="optimizer" title="Inverse design optimizer" summary="auto-select Kv, prop, cells, battery" defaultOpen={false}>
      <div className="grid2">
        <SelectField<OptimizerMode>
          label="Objective"
          value={t.mode}
          options={[
            { value: 'endurance', label: 'Maximum flight endurance' },
            { value: 'payload', label: 'Maximum payload / lift' },
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
        <NumberField label="Frame + electronics" quantity="mass" value={t.frameWeight} onChange={(v) => set({ frameWeight: v ?? 0 })} step={10} />
        <NumberField label="Max prop size" unitLabel="in" value={t.maxPropIn} onChange={(v) => set({ maxPropIn: v ?? 5 })} step={0.5} />
        <NumberField label="Min thrust/weight" unitLabel=": 1" value={t.minThrustRatio} onChange={(v) => set({ minThrustRatio: v ?? 2 })} step={0.1} />
        <NumberField label="Max hover throttle" unitLabel="%" value={t.maxHoverThrottle * 100} onChange={(v) => set({ maxHoverThrottle: (v ?? 60) / 100 })} step={5} />
        <NumberField label="Min cells" unitLabel="S" integer value={t.minCells} onChange={(v) => set({ minCells: v ?? 1 })} step={1} min={1} max={24} />
        <NumberField label="Max cells" unitLabel="S" integer value={t.maxCells} onChange={(v) => set({ maxCells: v ?? 6 })} step={1} min={1} max={24} />
      </div>
      <div className="row">
        <button className="btn primary wide" onClick={run} disabled={busy}>
          {busy ? 'Optimizing…' : 'Run automatic design optimizer'}
        </button>
        <button className="btn small ghost" onClick={() => setT(targetsFrom(config))} title="Copy frame, payload and environment from the current configuration">
          Use current frame
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
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
                <span>Motor {c.config.motor.weight} g · {c.config.motor.kv}KV</span>
                <span className={c.meetsFlightTime ? 'ok-text' : 'warn-text'}>Hover {fmtNum(c.hoverTime, 1)} min</span>
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
    </Section>
  );
}
