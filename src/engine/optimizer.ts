import {
  CHEMISTRIES,
  G,
  IN_TO_M,
  LAYOUTS,
  airDensity,
  defaultCellResistance,
  estimateBatteryWeight,
  estimateMotor,
  estimatePropCp,
  estimatePropCt,
  estimatePropWeight,
  speedOfSound,
} from './physics';
import { MAX_TEMP_WINDOW_S, flightMinutes, maxPoint, opAtThrust, thermalModel, type Drive } from './solver';
import { simulate } from './simulate';
import type { Chemistry, Config, Layout } from './types';

export type OptimizerMode = 'endurance' | 'payload';

export interface OptimizerTargets {
  mode: OptimizerMode;
  layout: Layout;
  chemistry: Chemistry;
  frameWeight: number; // g incl. electronics
  payload: number; // g
  flightTime: number; // min, target hover time
  minThrustRatio: number;
  maxPropIn: number;
  minCells: number;
  maxCells: number;
  maxHoverThrottle: number; // 0..1
  accessoryCurrent: number; // A
  elevation: number;
  temperature: number;
}

export interface Candidate {
  config: Config;
  score: number;
  hoverTime: number;
  mixedTime: number;
  thrustToWeight: number;
  hoverThrottle: number;
  specificThrust: number;
  auw: number;
  motorTempMax: number;
  liftCapacity: number; // extra payload g available while keeping the target thrust ratio
  meetsFlightTime: boolean;
}

export interface OptimizerResult {
  candidates: Candidate[];
  evaluated: number;
  feasible: number;
  elapsedMs: number;
}

export const DEFAULT_TARGETS: OptimizerTargets = {
  mode: 'endurance',
  layout: 'quadX',
  chemistry: 'lipo',
  frameWeight: 400,
  payload: 300,
  flightTime: 20,
  minThrustRatio: 2,
  maxPropIn: 10,
  minCells: 2,
  maxCells: 6,
  maxHoverThrottle: 0.6,
  accessoryCurrent: 0.8,
  elevation: 0,
  temperature: 20,
};

const DIAMETERS = [2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 26, 28, 30];
const PITCH_RATIOS = [0.45, 0.6, 0.75];
const MASS_FACTORS = [0.6, 1, 1.5, 2.2];
const KV_FACTORS = [0.8, 0.9, 1, 1.12, 1.25, 1.4];
const ENERGY_WH = [2, 4, 7, 11, 16, 22, 30, 40, 55, 75, 100, 130, 170, 220, 300, 400, 550, 750];
const ESC_RATINGS = [6, 12, 20, 30, 35, 45, 55, 65, 80, 100, 120, 150, 200];
const LIION_CELL_MAH = 5000;
const MAX_TIP_MACH = 0.7;
// Battery may make up at most half of the all-up weight; beyond that endurance gains vanish.
const MAX_BATTERY_TO_DRY = 1;

export function escForCurrent(maxCurrent: number) {
  const rating = ESC_RATINGS.find((r) => r >= maxCurrent * 1.2) ?? ESC_RATINGS[ESC_RATINGS.length - 1];
  return { maxCurrent: rating, burstCurrent: Math.round(rating * 1.25), resistance: +(120 / rating).toFixed(2), weight: +(2 + 0.35 * rating).toFixed(1) };
}

interface Raw {
  d: number;
  pitch: number;
  blades: number;
  s: number;
  p: number;
  capacity: number; // mAh per cell
  motorMass: number;
  kv: number;
  score: number;
}

function batteryFor(chem: Chemistry, s: number, wh: number) {
  const cellWh = (CHEMISTRIES[chem].nominal * s) / 1000;
  if (chem === 'liion') {
    const p = Math.max(1, Math.round(wh / (cellWh * LIION_CELL_MAH)));
    return { p, capacity: LIION_CELL_MAH };
  }
  return { p: 1, capacity: Math.max(50, Math.round(wh / cellWh / 50) * 50) };
}

/**
 * FRS 3.3 inverse design: sweep prop diameter/pitch, cell count, motor size, Kv and battery
 * energy; reject candidates failing thrust, throttle, thermal, rating or tip-speed checks; rank
 * by the selected objective and return the best configuration per (prop, cell count) family.
 */
export function optimize(t: OptimizerTargets): OptimizerResult {
  const start = performance.now();
  const layout = LAYOUTS[t.layout];
  const n = layout.motors;
  const chem = CHEMISTRIES[t.chemistry];
  const rho = airDensity(t.elevation, t.temperature);
  const sos = speedOfSound(t.temperature);
  const minD = Math.max(2, t.maxPropIn * 0.45);
  const diameters = DIAMETERS.filter((d) => d <= t.maxPropIn + 1e-9 && d >= minD);
  if (!diameters.length) diameters.push(t.maxPropIn);

  const best = new Map<string, Raw>();
  let evaluated = 0;
  let feasible = 0;

  const dr: Drive = {
    motors: n, rho, d: 0, pitch: 0, ct: 0, cp: 0, kv: 0, i0: 0, v0: 10, rm: 0, resc: 0, voc: 0, rbat: 0,
    iacc: t.accessoryCurrent, capacityAh: 0, usable: 0.8, motorWeight: 0, ambient: t.temperature, speedOfSound: sos,
  };

  for (const d of diameters) {
    const blades = d < 7 ? 3 : 2;
    const propWeight = estimatePropWeight(d, blades);
    const m0 = 1.1 * Math.pow(d, 1.85);
    for (const pr of PITCH_RATIOS) {
      const pitch = +(d * pr).toFixed(1);
      dr.d = d * IN_TO_M;
      dr.pitch = pitch * IN_TO_M;
      dr.ct = estimatePropCt(d, pitch, blades) * layout.thrustFactor;
      dr.cp = estimatePropCp(d, pitch, blades);
      for (let s = Math.max(1, t.minCells); s <= t.maxCells; s++) {
        const voc = s * chem.nominal;
        dr.voc = voc;
        for (const mf of MASS_FACTORS) {
          const motorMass = Math.round(m0 * mf);
          const escWeight = 2 + 0.15 * motorMass;
          const dryMass = t.frameWeight + t.payload + n * (motorMass + propWeight + escWeight);
          for (const wh of ENERGY_WH) {
            const { p, capacity } = batteryFor(t.chemistry, s, wh);
            const batMass = estimateBatteryWeight(t.chemistry, s, p, capacity);
            if (batMass > dryMass * MAX_BATTERY_TO_DRY) continue;
            const auw = dryMass + batMass;
            dr.capacityAh = (capacity * p) / 1000;
            dr.rbat = (s * defaultCellResistance(t.chemistry, capacity)) / 1000 / p;
            dr.motorWeight = motorMass;
            const thrustReq = (t.minThrustRatio * auw) / n;
            const rpmReq = Math.sqrt(((thrustReq / 1000) * G) / (dr.ct * rho * dr.d ** 4)) * 60;
            if ((Math.PI * dr.d * rpmReq) / 60 / sos > MAX_TIP_MACH) continue;
            const kvRef = rpmReq / (0.85 * voc);
            for (const kf of KV_FACTORS) {
              evaluated++;
              const kv = Math.max(10, Math.round((kvRef * kf) / 10) * 10);
              const m = estimateMotor(kv, motorMass);
              dr.kv = kv;
              dr.rm = m.rm / 1000;
              dr.i0 = m.i0;
              dr.resc = 0.12 / 40;
              const max = maxPoint(dr);
              if (max.totalThrust < t.minThrustRatio * auw) continue;
              if (max.tipMach > MAX_TIP_MACH) continue;
              if (max.motorCurrent > m.maxCurrent) continue;
              if (max.cRate > chem.cBurst) continue;
              const hover = opAtThrust(dr, auw / n);
              if (hover.throttle > t.maxHoverThrottle) continue;
              const temp = thermalModel(dr, hover.motorLoss, max.motorLoss).at(MAX_TEMP_WINDOW_S);
              if (temp > 80) continue;
              const hoverTime = flightMinutes(dr, hover.batteryCurrent);
              let score: number;
              if (t.mode === 'endurance') score = hoverTime;
              else {
                if (hoverTime < t.flightTime) continue;
                score = max.totalThrust / t.minThrustRatio - auw;
              }
              feasible++;
              const key = `${d}|${s}`;
              const prev = best.get(key);
              if (!prev || score > prev.score) {
                best.set(key, { d, pitch, blades, s, p, capacity, motorMass, kv, score });
              }
            }
          }
        }
      }
    }
  }

  const ranked = [...best.values()].sort((a, b) => b.score - a.score).slice(0, 5);
  const candidates = ranked.map((r) => toCandidate(r, t)).filter((c): c is Candidate => c !== null);
  return { candidates, evaluated, feasible, elapsedMs: performance.now() - start };
}

function toCandidate(r: Raw, t: OptimizerTargets): Candidate | null {
  const est = estimateMotor(r.kv, r.motorMass);
  const config: Config = {
    name: `Optimized ${r.d}" ${r.s}S`,
    env: { elevation: t.elevation, temperature: t.temperature },
    frame: { layout: t.layout, weight: t.frameWeight, payload: t.payload, maxPropIn: t.maxPropIn, accessoryCurrent: t.accessoryCurrent, dragArea: null },
    battery: {
      name: 'Generic',
      chemistry: t.chemistry,
      s: r.s,
      p: r.p,
      capacity: r.capacity,
      cRating: CHEMISTRIES[t.chemistry].cRating,
      cBurst: CHEMISTRIES[t.chemistry].cBurst,
      resistance: +defaultCellResistance(t.chemistry, r.capacity).toFixed(2),
      weight: null,
      maxDischarge: 0.8,
    },
    esc: { name: 'Generic', ...escForCurrent(est.maxCurrent) },
    motor: {
      name: `Generic ${r.motorMass} g ${r.kv}KV`,
      kv: r.kv,
      i0: +est.i0.toFixed(2),
      v0: est.v0,
      rm: +est.rm.toFixed(1),
      maxCurrent: Math.round(est.maxCurrent),
      maxPower: Math.round(est.maxCurrent * r.s * CHEMISTRIES[t.chemistry].nominal),
      weight: r.motorMass,
    },
    prop: { name: `Generic ${r.d}x${r.pitch}x${r.blades}`, diameter: r.d, pitch: r.pitch, blades: r.blades, ct: null, cp: null, weight: null },
  };
  const out = simulate(config);
  if (!out.ok || !out.results.hover) return null;
  const res = out.results;
  return {
    config,
    score: r.score,
    hoverTime: res.hoverTime,
    mixedTime: res.mixedTime,
    thrustToWeight: res.thrustToWeight,
    hoverThrottle: res.hover!.throttle,
    specificThrust: res.hover!.specificThrust,
    auw: res.auw,
    motorTempMax: res.motorTempMax,
    liftCapacity: Math.max(0, res.max.totalThrust / t.minThrustRatio - res.auw),
    meetsFlightTime: res.hoverTime >= t.flightTime,
  };
}

/**
 * FRS 3.3 mode 3: Kv & cell matcher. Changing S by a factor k keeps prop speed identical when
 * Kv scales by 1/k. A rewound motor of equal mass has Rm ∝ 1/Kv² and I0 ∝ Kv; pack energy is
 * held constant so battery weight is unchanged.
 */
export function matchKv(c: Config, newS: number): Config {
  const k = c.battery.s / newS;
  const kv = Math.round(c.motor.kv * k);
  const ratio = kv / c.motor.kv;
  return {
    ...c,
    name: `${c.name} (${newS}S matched)`,
    motor: { ...c.motor, name: `${c.motor.name ?? 'Motor'} rewound ${kv}KV`, kv, rm: +(c.motor.rm / ratio ** 2).toFixed(1), i0: +(c.motor.i0 * ratio).toFixed(2), maxCurrent: Math.round(c.motor.maxCurrent / ratio) },
    battery: { ...c.battery, s: newS, capacity: Math.round(c.battery.capacity * k), resistance: +(c.battery.resistance / k).toFixed(2) },
  };
}
