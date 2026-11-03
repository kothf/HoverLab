import type { BatteryItem, ComponentKind, EscItem, FrameItem, Library, MotorItem, PropItem } from '../data/components';
import {
  CHEMISTRIES,
  LAYOUTS,
  airDensity,
  defaultCellResistance,
  estimateBatteryWeight,
  estimateDragArea,
  estimatePropCp,
  estimatePropCt,
  estimatePropWeight,
} from '../engine/physics';
import type { Chemistry, Config, Layout } from '../engine/types';
import { fmt } from '../lib/units';
import { applyPart, type AnyPart } from './applyPart';
import { ComponentPicker } from './ComponentPicker';
import { useUnits } from './context';
import { NumberField, Section, SelectField } from './fields';

interface Props {
  config: Config;
  library: Library;
  auw: number | null;
  onChange: (c: Config) => void;
  onDefine: (kind: ComponentKind, query: string) => void;
}

const edited = (name?: string) => (name && !name.endsWith(' (edited)') ? `${name} (edited)` : name);

const motorDetail = (m: MotorItem) => `${m.kv}KV · ${m.weight} g · ${m.maxCurrent} A`;
const propDetail = (p: PropItem) => `${p.diameter}x${p.pitch}x${p.blades}`;
const batteryDetail = (b: BatteryItem) =>
  b.form === 'cell' ? `cell · ${b.capacity} mAh · ${b.cRating}C` : `${b.s}S · ${b.capacity} mAh · ${b.cRating}C · ${b.weight} g`;
const escDetail = (e: EscItem) => `${e.maxCurrent} A · ${e.format}`;
const frameDetail = (f: FrameItem) => `${LAYOUTS[f.layout].label} · ${f.weight} g · ≤${f.maxPropIn}"`;

export function ConfigPanel({ config: c, library, auw, onChange, onDefine }: Props) {
  const system = useUnits();
  const up = <K extends 'env' | 'frame' | 'battery' | 'esc' | 'motor' | 'prop'>(k: K, patch: Partial<Config[K]>, markEdited = true) => {
    const next = { ...c[k], ...patch } as Config[K];
    if (markEdited && 'name' in next && !('name' in patch)) (next as { name?: string }).name = edited((next as { name?: string }).name);
    onChange({ ...c, [k]: next });
  };

  const pick = (kind: ComponentKind) => (part: AnyPart) => onChange(applyPart(c, kind, part));
  const define = (kind: ComponentKind) => (query: string) => onDefine(kind, query);

  const rho = airDensity(c.env.elevation, c.env.temperature);
  const b = c.battery;
  const chem = CHEMISTRIES[b.chemistry];
  const batAuto = b.cellWeight ? b.cellWeight * b.s * b.p * 1.08 : estimateBatteryWeight(b.chemistry, b.s, b.p, b.capacity);

  return (
    <div className="config">
      <Section icon="env" title="Atmosphere & environment" summary={`ρ = ${rho.toFixed(3)} kg/m³`}>
        <div className="grid2">
          <NumberField label="Field elevation" quantity="altitude" value={c.env.elevation} onChange={(v) => up('env', { elevation: v ?? 0 })} step={50} min={-500} max={8000} />
          <NumberField label="Air temperature" quantity="temp" value={c.env.temperature} onChange={(v) => up('env', { temperature: v ?? 15 })} step={1} />
        </div>
      </Section>

      <Section icon="frame" title="Frame & payload" summary={`${LAYOUTS[c.frame.layout].label} · ${fmt(system, 'mass', c.frame.weight + c.frame.payload)}`}>
        <ComponentPicker
          items={library.frame}
          detail={frameDetail}
          placeholder="Search frames…"
          onPick={pick('frame')}
          onDefine={define('frame')}
          icon="frame"
          kindLabel="frame"
        />
        <div className="grid2">
          <SelectField<Layout>
            label="Rotor configuration"
            value={c.frame.layout}
            options={(Object.keys(LAYOUTS) as Layout[]).map((k) => ({ value: k, label: LAYOUTS[k].label }))}
            onChange={(v) => up('frame', { layout: v }, false)}
          />
          <NumberField label="Max prop size" unitLabel="in" value={c.frame.maxPropIn} onChange={(v) => up('frame', { maxPropIn: v ?? 5 }, false)} step={0.5} />
          <NumberField label="Frame + electronics" quantity="mass" value={c.frame.weight} onChange={(v) => up('frame', { weight: v ?? 0 }, false)} step={10} />
          <NumberField label="Payload" quantity="mass" value={c.frame.payload} onChange={(v) => up('frame', { payload: v ?? 0 }, false)} step={10} slider min={0} max={Math.max(2000, Math.ceil(c.frame.payload / 500) * 500)} />
          <NumberField label="Accessory current" unitLabel="A" value={c.frame.accessoryCurrent} onChange={(v) => up('frame', { accessoryCurrent: v ?? 0 }, false)} step={0.1} />
          <NumberField
            label="Frontal drag area Cd·A"
            unitLabel="m²"
            value={c.frame.dragArea}
            auto={estimateDragArea(auw ?? c.frame.weight * 2)}
            onChange={(v) => up('frame', { dragArea: v }, false)}
            step={0.001}
          />
        </div>
      </Section>

      <Section icon="battery" title="Battery" summary={`${chem.label} ${b.s}S${b.p}P ${b.capacity * b.p} mAh · ${((b.s * chem.nominal * b.capacity * b.p) / 1000).toFixed(0)} Wh`}>
        <ComponentPicker
          items={library.battery}
          current={b.name}
          detail={batteryDetail}
          placeholder="Search batteries or cells…"
          onPick={pick('battery')}
          onDefine={define('battery')}
          icon="battery"
          kindLabel="battery"
        />
        <div className="grid2">
          <SelectField<Chemistry>
            label="Cell chemistry"
            value={b.chemistry}
            options={(Object.keys(CHEMISTRIES) as Chemistry[]).map((k) => ({ value: k, label: `${CHEMISTRIES[k].label} (${CHEMISTRIES[k].nominal} V)` }))}
            onChange={(v) => up('battery', { chemistry: v })}
          />
          <div className="grid2 tight">
            <NumberField label="Series S" value={b.s} integer onChange={(v) => up('battery', { s: v ?? 1 })} step={1} min={1} max={24} />
            <NumberField label="Parallel P" value={b.p} integer onChange={(v) => up('battery', { p: v ?? 1 })} step={1} min={1} max={20} />
          </div>
          <NumberField label="Capacity per cell" unitLabel="mAh" value={b.capacity} onChange={(v) => up('battery', { capacity: v ?? 100 })} step={100} />
          <NumberField label="Cell resistance" unitLabel="mΩ" value={b.resistance} onChange={(v) => up('battery', { resistance: v ?? 0 })} step={0.5} hint={`For this capacity a typical value is ${defaultCellResistance(b.chemistry, b.capacity).toFixed(1)} mΩ`} />
          <NumberField label="Continuous C" unitLabel="C" value={b.cRating} onChange={(v) => up('battery', { cRating: v ?? 1 })} step={5} />
          <NumberField label="Burst C" unitLabel="C" value={b.cBurst} onChange={(v) => up('battery', { cBurst: v ?? 1 })} step={5} />
          <NumberField label="Pack weight" quantity="mass" value={b.weight} auto={batAuto} onChange={(v) => up('battery', { weight: v })} step={10} />
          <NumberField label="Usable capacity" unitLabel="%" value={b.maxDischarge * 100} onChange={(v) => up('battery', { maxDischarge: (v ?? 80) / 100 })} step={5} min={10} max={100} />
        </div>
      </Section>

      <Section icon="esc" title="ESC" summary={`${c.esc.maxCurrent} A cont. / ${c.esc.burstCurrent} A burst`}>
        <ComponentPicker
          items={library.esc}
          current={c.esc.name}
          detail={escDetail}
          placeholder="Search ESCs…"
          onPick={pick('esc')}
          onDefine={define('esc')}
          icon="esc"
          kindLabel="ESC"
        />
        <div className="grid2">
          <NumberField label="Continuous current" unitLabel="A" value={c.esc.maxCurrent} onChange={(v) => up('esc', { maxCurrent: v ?? 1 })} step={5} />
          <NumberField label="Burst current" unitLabel="A" value={c.esc.burstCurrent} onChange={(v) => up('esc', { burstCurrent: v ?? 1 })} step={5} />
          <NumberField label="Rds(on) resistance" unitLabel="mΩ" value={c.esc.resistance} onChange={(v) => up('esc', { resistance: v ?? 0 })} step={0.5} />
          <NumberField label="Weight per motor" quantity="mass" value={c.esc.weight} onChange={(v) => up('esc', { weight: v ?? 0 })} step={1} />
        </div>
      </Section>

      <Section icon="motor" title="Motor" summary={`${c.motor.name ?? ''} ${c.motor.kv}KV`}>
        <ComponentPicker
          items={library.motor}
          current={c.motor.name}
          detail={motorDetail}
          placeholder="Search motors, e.g. T-Motor 2207…"
          onPick={pick('motor')}
          onDefine={define('motor')}
          icon="motor"
          kindLabel="motor"
        />
        <div className="grid2">
          <NumberField label="Motor Kv" unitLabel="RPM/V" value={c.motor.kv} onChange={(v) => up('motor', { kv: v ?? 1 })} step={50} slider min={50} max={5000} />
          <NumberField label="Phase resistance Rm" unitLabel="mΩ" value={c.motor.rm} onChange={(v) => up('motor', { rm: v ?? 1 })} step={5} />
          <NumberField label="No-load current I₀" unitLabel="A" value={c.motor.i0} onChange={(v) => up('motor', { i0: v ?? 0 })} step={0.1} />
          <NumberField label="I₀ test voltage" unitLabel="V" value={c.motor.v0} onChange={(v) => up('motor', { v0: v ?? 10 })} step={1} />
          <NumberField label="Max current (15 s)" unitLabel="A" value={c.motor.maxCurrent} onChange={(v) => up('motor', { maxCurrent: v ?? 1 })} step={1} />
          <NumberField label="Max power (15 s)" unitLabel="W" value={c.motor.maxPower} onChange={(v) => up('motor', { maxPower: v ?? 1 })} step={10} />
          <NumberField label="Motor weight" quantity="mass" value={c.motor.weight} onChange={(v) => up('motor', { weight: v ?? 1 })} step={1} />
        </div>
      </Section>

      <Section icon="prop" title="Propeller" summary={`${c.prop.diameter}x${c.prop.pitch}x${c.prop.blades}`}>
        <ComponentPicker
          items={library.prop}
          current={c.prop.name}
          detail={propDetail}
          placeholder="Search props, e.g. gemfan 5…"
          onPick={pick('prop')}
          onDefine={define('prop')}
          icon="prop"
          kindLabel="propeller"
        />
        <div className="grid2">
          <NumberField label="Diameter" unitLabel="in" value={c.prop.diameter} onChange={(v) => up('prop', { diameter: v ?? 1 })} step={0.5} slider min={2} max={32} />
          <NumberField label="Pitch" unitLabel="in" value={c.prop.pitch} onChange={(v) => up('prop', { pitch: v ?? 1 })} step={0.1} />
          <NumberField label="Blades" value={c.prop.blades} integer onChange={(v) => up('prop', { blades: v ?? 2 })} step={1} min={2} max={8} />
          <NumberField label="Weight" quantity="mass" value={c.prop.weight} auto={estimatePropWeight(c.prop.diameter, c.prop.blades)} onChange={(v) => up('prop', { weight: v })} step={1} />
          <NumberField label="Thrust const. Ct" value={c.prop.ct} auto={estimatePropCt(c.prop.diameter, c.prop.pitch, c.prop.blades)} onChange={(v) => up('prop', { ct: v })} step={0.005} />
          <NumberField label="Power const. Cp" value={c.prop.cp} auto={estimatePropCp(c.prop.diameter, c.prop.pitch, c.prop.blades)} onChange={(v) => up('prop', { cp: v })} step={0.005} />
        </div>
      </Section>
    </div>
  );
}
