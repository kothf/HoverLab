import type { Config, EnvConfig, FrameConfig } from '../engine/types';
import { applyPart } from '../ui/applyPart';
import { BUILTIN, type ComponentKind } from './components';

// Presets are built from library parts so their values always match the library. Each one is a
// sound example: the test suite requires every preset to simulate without any warning.

const env: EnvConfig = { elevation: 0, temperature: 20 };

type Parts = Partial<Record<Exclude<ComponentKind, 'frame'>, string>>;

function preset(name: string, frame: FrameConfig, parts: Parts, battery: Partial<Config['battery']> = {}): Config {
  let c: Config = {
    name,
    env,
    frame,
    battery: { chemistry: 'lipo', s: 4, p: 1, capacity: 1000, cRating: 50, cBurst: 100, resistance: 5, weight: null, maxDischarge: 0.8 },
    esc: { maxCurrent: 30, burstCurrent: 40, resistance: 5, weight: 5 },
    motor: { kv: 1000, i0: 0.5, v0: 10, rm: 100, maxPower: 300, maxCurrent: 20, weight: 50 },
    prop: { diameter: 5, pitch: 4, blades: 3, ct: null, cp: null, weight: null },
  };
  for (const [kind, id] of Object.entries(parts) as [Exclude<ComponentKind, 'frame'>, string][]) {
    const part = (BUILTIN[kind] as { id: string }[]).find((p) => p.id === id);
    if (!part) throw new Error(`Preset ${name}: unknown ${kind} ${id}`);
    c = applyPart(c, kind, part as never);
  }
  return { ...c, battery: { ...c.battery, ...battery } };
}

export const PRESETS: Config[] = [
  preset(
    '5" freestyle 6S',
    { name: 'Generic 5" freestyle (incl. FC/VTX/cam)', layout: 'quadX', weight: 180, payload: 0, maxPropIn: 5.1, accessoryCurrent: 1, dragArea: null },
    { motor: 'if-2507-1500', prop: 'gf-51466', battery: 'cnhl-6s-1500-130', esc: 'hw-60a-4in1' },
  ),
  preset(
    '3" cinewhoop 4S',
    { name: 'Generic 3" cinewhoop (ducted)', layout: 'quadX', weight: 140, payload: 0, maxPropIn: 3, accessoryCurrent: 0.8, dragArea: 0.012 },
    { motor: 'bh-1507-3800', prop: 'hq-3x3x3', battery: 'tt-4s-850', esc: 'hb-tekko-50' },
  ),
  preset(
    '7" long range 6S3P Li-ion',
    { name: 'Generic 7" long-range (incl. GPS)', layout: 'quadX', weight: 230, payload: 0, maxPropIn: 7.5, accessoryCurrent: 1.2, dragArea: null },
    { motor: 'tm-2806-1300', prop: 'gf-7035-2', battery: 'mol-p42a', esc: 'hb-tekko-50' },
    { s: 6, p: 3 },
  ),
  preset(
    '450 camera quad 3S',
    { name: 'Generic 450 class camera quad', layout: 'quadX', weight: 450, payload: 200, maxPropIn: 10, accessoryCurrent: 0.6, dragArea: null },
    { motor: 'ss-2216-880', prop: 'apc-10x47', battery: 'tt-3s-5200', esc: 'hw-xr-30a' },
  ),
  preset(
    '650 endurance 6S',
    { name: 'Generic 650 class carbon', layout: 'quadX', weight: 700, payload: 300, maxPropIn: 15, accessoryCurrent: 1, dragArea: null },
    { motor: 'tm-4114-400', prop: 'tm-14x48', battery: 'tt-6s-10000', esc: 'hw-40a' },
  ),
  preset(
    'X8 heavy lift 12S',
    { name: 'Generic X8 coaxial heavy lift', layout: 'x8coax', weight: 3200, payload: 3000, maxPropIn: 24, accessoryCurrent: 2, dragArea: 0.12 },
    { motor: 'tm-u8ii-100', prop: 'tm-24x72', battery: 'tt-6s-16000', esc: 'hw-80a' },
    { name: '2× Tattu 6S 16000mAh in series', s: 12 },
  ),
];

export const DEFAULT_CONFIG: Config = PRESETS[0];
