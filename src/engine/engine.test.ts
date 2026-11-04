import { describe, expect, it } from 'vitest';
import { BUILTIN } from '../data/components';
import { PRESETS } from '../data/presets';
import { decodeConfig, encodeConfig } from '../lib/share';
import { fuzzyFilter } from '../lib/fuzzy';
import { unit } from '../lib/units';
import { HELP } from '../ui/help';
import { sketchGeometry } from '../ui/DroneSketch';
import { maxPropForWheelbase, wheelbaseMm } from '../lib/frame';
import { readFileSync } from 'node:fs';
import { DEFAULT_TARGETS, matchKv, optimize } from './optimizer';
import { airDensity, estimateMotor, estimatePropCp, estimatePropCt, pressureAt, speedOfSound } from './physics';
import { buildDrive, simulate, validateConfig } from './simulate';
import { ESC_SWITCHING_LOSS, inducedVelocity, maxPoint, opAtThrottle, opAtThrust, opInFlight } from './solver';
import type { Config, Results } from './types';

// Reference 5" build (T-Motor 2207 1950KV, 5.1x4.66x3, 6S 1300) used for bench-range and edge-case tests.
const five: Config = {
  name: 'reference 5"',
  env: { elevation: 0, temperature: 20 },
  frame: { layout: 'quadX', weight: 180, payload: 0, maxPropIn: 5.1, accessoryCurrent: 1, dragArea: null },
  battery: { chemistry: 'lipo', s: 6, p: 1, capacity: 1300, cRating: 120, cBurst: 240, resistance: 4, weight: 215, maxDischarge: 0.8 },
  esc: { maxCurrent: 60, burstCurrent: 70, resistance: 3, weight: 4.5 },
  motor: { kv: 1950, i0: 1.4, v0: 10, rm: 60, maxPower: 1000, maxCurrent: 45, weight: 33 },
  prop: { diameter: 5.1, pitch: 4.66, blades: 3, ct: null, cp: null, weight: 4.5 },
};

function run(c: Config): Results {
  const out = simulate(c);
  if (!out.ok) throw new Error(out.errors.join('; '));
  return out.results;
}

describe('atmosphere', () => {
  it('matches ISA sea-level density', () => {
    expect(airDensity(0, 15)).toBeCloseTo(1.225, 3);
  });
  it('drops with altitude and heat', () => {
    expect(airDensity(2000, 2)).toBeCloseTo(1.007, 2); // ISA at 2000 m is 2 °C
    expect(airDensity(0, 35)).toBeLessThan(airDensity(0, 15));
  });
});

describe('literature checks', () => {
  it('ISA pressure and speed of sound match the 1976 standard atmosphere', () => {
    // U.S. Standard Atmosphere 1976: p(1000 m) = 89 876 Pa, p(5000 m) = 54 048 Pa; a(15 °C) = 340.3 m/s.
    expect(pressureAt(1000) / 89876).toBeCloseTo(1, 3);
    expect(pressureAt(5000) / 54048).toBeCloseTo(1, 2); // formula uses geometric height
    expect(speedOfSound(15)).toBeCloseTo(340.3, 1);
    expect(speedOfSound(-56.5)).toBeCloseTo(295.1, 0);
  });

  it('Kt = 60 / (2π·Kv) (Drela first-order motor model)', () => {
    const m = estimateMotor(1000, 50);
    const kt = 60 / (2 * Math.PI * 1000);
    const km = 0.0223 * Math.pow(50 / 32, 0.79);
    expect(m.rm / 1000).toBeCloseTo((kt / km) ** 2, 12);
  });

  it('estimated prop coefficients keep figure of merit in the measured 0.45–0.8 band', () => {
    // FM = Ct^1.5 / (Cp·√(π/2)) for n-based coefficients; UIUC static data for small props spans ~0.5–0.75.
    for (const pd of [0.3, 0.45, 0.6, 0.75, 0.9, 1.1])
      for (const b of [2, 3, 4, 5, 6]) {
        const fm = estimatePropCt(10, 10 * pd, b) ** 1.5 / (estimatePropCp(10, 10 * pd, b) * Math.sqrt(Math.PI / 2));
        expect(fm, `P/D ${pd}, ${b} blades`).toBeGreaterThan(0.45);
        expect(fm, `P/D ${pd}, ${b} blades`).toBeLessThan(0.8);
      }
  });

  it('Glauert induced velocity reduces to the hover, climb and high-speed limits', () => {
    expect(inducedVelocity(8, 0, 0)).toBeCloseTo(8, 9);
    const vc = 5; // axial climb: v_i = −Vc/2 + √((Vc/2)² + v_h²)
    expect(inducedVelocity(8, vc, 0)).toBeCloseTo(-vc / 2 + Math.sqrt((vc / 2) ** 2 + 64), 8);
    expect(inducedVelocity(8, 0, 60) / (64 / 60)).toBeCloseTo(1, 2); // edgewise: v_i → v_h²/V
  });

  it('forward-flight power curve has the classic bucket shape', () => {
    const dr = buildDrive(five);
    const r = run(five);
    const hoverP = opInFlight(dr, r.auw / dr.motors, 0, 0).mechPowerPerMotor;
    expect(hoverP / r.hover!.mechPowerPerMotor).toBeCloseTo(1, 6);
    // Translational lift: a slow cruise needs less power than hover (Bauersfeld & Scaramuzza: P_e/P_h ≈ 0.91).
    const slow = opInFlight(dr, r.auw / dr.motors, 0.3, 6).mechPowerPerMotor;
    expect(slow / hoverP).toBeLessThan(1);
    expect(slow / hoverP).toBeGreaterThan(0.75);
    // Best range sits below top speed, and costs about hover power (paper: P_r/P_h ≈ 1.09).
    expect(r.range!.speed).toBeLessThan(0.9 * r.maxSpeed);
    expect(r.range!.time / r.hoverTime).toBeGreaterThan(0.75);
    expect(r.range!.time / r.hoverTime).toBeLessThan(1.15);
  });

  it('climb power includes the work against gravity', () => {
    const dr = buildDrive(five);
    const r = run(five);
    const w = (r.auw / 1000) * 9.80665;
    const hover = opInFlight(dr, r.auw / dr.motors, 0, 0).mechPowerPerMotor * dr.motors;
    const climb = opInFlight(dr, r.auw / dr.motors, 10, 0).mechPowerPerMotor * dr.motors;
    // Momentum theory: extra power lies between W·Vc/2 (slow climb) and W·Vc (fast climb).
    expect(climb - hover).toBeGreaterThan((w * 10) / 2);
    expect(climb - hover).toBeLessThan(w * 10);
  });
});

describe('operating point solver', () => {
  const dr = buildDrive(five);
  it('hover thrust equals weight', () => {
    const op = opAtThrust(dr, 150);
    expect(op.thrustPerMotor).toBeCloseTo(150, 6);
    expect(op.throttle).toBeGreaterThan(0);
    expect(op.throttle).toBeLessThan(1);
  });
  it('full throttle solves to 100 %', () => {
    expect(maxPoint(dr).throttle).toBeCloseTo(1, 4);
  });
  it('energy balances: shaft + losses = battery power', () => {
    const op = opAtThrottle(dr, 0.6);
    const escLoss = op.motorCurrent ** 2 * dr.resc + ESC_SWITCHING_LOSS * op.batteryVoltage * op.motorCurrent;
    const batteryLoss = op.batteryCurrent ** 2 * dr.rbat;
    const accessories = dr.iacc * op.batteryVoltage;
    const cellPower = dr.voc * op.batteryCurrent;
    const sum = dr.motors * (op.mechPowerPerMotor + op.motorLoss + escLoss) + batteryLoss + accessories;
    expect(sum / cellPower).toBeCloseTo(1, 3);
  });
  it('ESC efficiency is realistic: ~97 % at full throttle, lower at low throttle', () => {
    const full = maxPoint(dr).escEfficiency;
    const low = opAtThrottle(dr, 0.2).escEfficiency;
    expect(full).toBeGreaterThan(0.95);
    expect(full).toBeLessThan(0.99);
    expect(low).toBeLessThan(full);
    expect(low).toBeGreaterThan(0.85);
  });
  it('thrust, current and power rise monotonically with throttle', () => {
    const r = run(five);
    for (let i = 1; i < r.curves.length; i++) {
      expect(r.curves[i].totalThrust).toBeGreaterThan(r.curves[i - 1].totalThrust);
      expect(r.curves[i].batteryCurrent).toBeGreaterThan(r.curves[i - 1].batteryCurrent);
      expect(r.curves[i].electricPower).toBeGreaterThan(r.curves[i - 1].electricPower);
    }
  });
});

describe('simulation', () => {
  it('every preset is a clean example: no warnings at all', () => {
    for (const p of PRESETS) expect(run(p).warnings.map((w) => w.message), p.name).toEqual([]);
  });

  it('runs every preset without errors and with plausible results', () => {
    for (const p of PRESETS) {
      const r = run(p);
      expect(r.hover, p.name).not.toBeNull();
      expect(r.thrustToWeight, p.name).toBeGreaterThan(1.5);
      expect(r.hoverTime, p.name).toBeGreaterThan(2);
      expect(r.hoverTime, p.name).toBeLessThan(90);
      expect(r.hover!.motorEfficiency, p.name).toBeGreaterThan(0.5);
      expect(r.hover!.motorEfficiency, p.name).toBeLessThan(0.95);
    }
  });

  it('5" freestyle preset lands in the range of published bench data', () => {
    // 2207 1950KV + 5.1x4.66x3 on 6S: bench tests show roughly 1.5–1.9 kg and 38–48 A per motor.
    const r = run(five);
    expect(r.max.thrustPerMotor).toBeGreaterThan(1500);
    expect(r.max.thrustPerMotor).toBeLessThan(1900);
    expect(r.max.motorCurrent).toBeGreaterThan(36);
    expect(r.max.motorCurrent).toBeLessThan(48);
  });

  it('follows the FRS flight time formula', () => {
    const r = run(five);
    const expected = ((five.battery.capacity / 1000) * 0.8 * 60) / r.hover!.batteryCurrent;
    expect(r.hoverTime).toBeCloseTo(expected, 6);
  });

  it('more payload means less flight time and higher throttle', () => {
    const a = run(five);
    const b = run({ ...five, frame: { ...five.frame, payload: 300 } });
    expect(b.hoverTime).toBeLessThan(a.hoverTime);
    expect(b.hover!.throttle).toBeGreaterThan(a.hover!.throttle);
    expect(a.payloadEnvelope[0].hoverTime).toBeCloseTo(a.hoverTime, 6);
  });

  it('flags a craft that cannot hover', () => {
    const r = run({ ...five, frame: { ...five.frame, payload: 20000 } });
    expect(r.hover).toBeNull();
    expect(r.warnings.some((w) => w.code === 'no-hover' && w.severity === 'danger')).toBe(true);
  });

  it('VR-04: raises an overload alert above 80 °C', () => {
    const hot = run({ ...five, motor: { ...five.motor, rm: 140 } });
    expect(hot.motorTempMax).toBeGreaterThan(80);
    expect(hot.warnings.some((w) => w.code === 'motor-temp' && w.severity === 'danger')).toBe(true);
    expect(hot.status.find((s) => s.key === 'thermal')!.severity).toBe('danger');
    const cool = run(PRESETS[4]);
    expect(cool.motorTempMax).toBeLessThan(80);
    expect(cool.warnings.some((w) => w.code === 'motor-temp' && w.severity === 'danger')).toBe(false);
  });

  it('rejects physically impossible inputs', () => {
    const bad = { ...five, motor: { ...five.motor, kv: 0, rm: -1 } };
    const errs = validateConfig(bad);
    expect(errs).toContain('Motor Kv must be greater than 0');
    expect(errs).toContain('Motor Rm must be greater than 0');
    expect(simulate(bad).ok).toBe(false);
  });

  it('higher elevation reduces available thrust', () => {
    const sea = run(five);
    const high = run({ ...five, env: { elevation: 3000, temperature: 20 } });
    expect(high.max.totalThrust).toBeLessThan(sea.max.totalThrust);
  });
});

describe('optimizer', () => {
  it('VR-02: sweeps 10k+ permutations in under 1.5 s', () => {
    const r = optimize({ ...DEFAULT_TARGETS, maxPropIn: 10, maxCells: 6 });
    expect(r.evaluated).toBeGreaterThan(10000);
    expect(r.elapsedMs).toBeLessThan(1500);
    expect(r.candidates.length).toBeGreaterThan(0);
  });

  it('returns only candidates that satisfy the constraints', () => {
    const t = { ...DEFAULT_TARGETS, payload: 500, minThrustRatio: 2.2, maxHoverThrottle: 0.55 };
    for (const c of optimize(t).candidates) {
      expect(c.thrustToWeight).toBeGreaterThanOrEqual(2.2 - 0.05);
      expect(c.hoverThrottle).toBeLessThanOrEqual(0.58);
      expect(c.config.prop.diameter).toBeLessThanOrEqual(t.maxPropIn);
      expect(c.motorTempMax).toBeLessThanOrEqual(82);
    }
  });

  it('returns only designs with no errors or warnings', () => {
    for (const t of [DEFAULT_TARGETS, { ...DEFAULT_TARGETS, mode: 'payload' as const, flightTime: 15 }, { ...DEFAULT_TARGETS, chemistry: 'liion' as const, maxPropIn: 15, maxCells: 12, frameWeight: 900, payload: 500 }]) {
      const { candidates } = optimize(t);
      expect(candidates.length).toBeGreaterThan(0);
      for (const c of candidates) {
        const out = simulate(c.config);
        expect(out.ok).toBe(true);
        if (out.ok) expect(out.results.warnings.map((w) => w.message), c.config.name).toEqual([]);
      }
    }
  });

  it('ranks endurance results by hover time', () => {
    const { candidates } = optimize(DEFAULT_TARGETS);
    for (let i = 1; i < candidates.length; i++) expect(candidates[i - 1].score).toBeGreaterThanOrEqual(candidates[i].score);
  });

  it('payload mode honours the endurance target', () => {
    const { candidates } = optimize({ ...DEFAULT_TARGETS, mode: 'payload', flightTime: 15 });
    expect(candidates.length).toBeGreaterThan(0);
    for (const c of candidates) expect(c.hoverTime).toBeGreaterThan(14);
  });

  it('Kv matcher keeps thrust nearly identical across cell counts', () => {
    const matched = matchKv(five, 4);
    expect(matched.motor.kv).toBe(Math.round((five.motor.kv * 6) / 4));
    const a = run(five);
    const b = run(matched);
    expect(b.max.totalThrust / a.max.totalThrust).toBeGreaterThan(0.95);
    expect(b.max.totalThrust / a.max.totalThrust).toBeLessThan(1.05);
    expect(b.hoverTime / a.hoverTime).toBeGreaterThan(0.95);
  });
});

describe('component library', () => {
  it('has unique ids and physically valid motor, prop and battery entries', () => {
    const all = Object.values(BUILTIN).flat() as { id: string }[];
    expect(new Set(all.map((x) => x.id)).size).toBe(all.length);
    for (const mo of BUILTIN.motor) for (const k of ['kv', 'rm', 'weight', 'maxCurrent'] as const) expect(mo[k], mo.id).toBeGreaterThan(0);
    for (const pr of BUILTIN.prop) expect(pr.pitch / pr.diameter, pr.id).toBeLessThan(1.2);
    for (const ba of BUILTIN.battery) expect(ba.capacity, ba.id).toBeGreaterThan(0);
  });
  it('every built-in motor simulates on a matching preset without errors', () => {
    for (const mo of BUILTIN.motor) {
      const out = simulate({ ...five, motor: { ...five.motor, ...mo } });
      expect(out.ok, mo.id).toBe(true);
    }
  });
});

describe('drone sketch geometry', () => {
  it('is to scale: frame from max prop size, props at their own diameter', () => {
    const base = sketchGeometry(five);
    expect(base.wheelbase).toBeGreaterThan(180);
    expect(base.wheelbase).toBeLessThan(260);
    const smallProp = sketchGeometry({ ...five, prop: { ...five.prop, diameter: 4 } });
    expect(smallProp.wheelbase).toBe(base.wheelbase);
    expect(smallProp.propR).toBeLessThan(base.propR);
    const bigFrame = sketchGeometry({ ...five, frame: { ...five.frame, maxPropIn: 7 } });
    expect(bigFrame.wheelbase).toBeGreaterThan(base.wheelbase * 1.3);
    expect(sketchGeometry({ ...five, motor: { ...five.motor, weight: 150 } }).motorD).toBeGreaterThan(base.motorD);
    // Overall footprint of a quad X with props fitted: wheelbase/√2 + one prop diameter per side.
    expect(base.width).toBeCloseTo(base.wheelbase / Math.SQRT2 + 2 * base.propR, 0);
    expect(base.length).toBeGreaterThanOrEqual(base.width - 1e-9);
  });
});

describe('frame size', () => {
  it('wheelbase matches common frame classes and round-trips to max prop size', () => {
    expect(wheelbaseMm(5.1, 'quadX')).toBeGreaterThan(195);
    expect(wheelbaseMm(5.1, 'quadX')).toBeLessThan(240);
    expect(wheelbaseMm(10, 'quadX')).toBeGreaterThan(380);
    expect(wheelbaseMm(10, 'quadX')).toBeLessThan(470);
    for (const l of ['quadX', 'hexa', 'octo', 'x8coax'] as const) expect(maxPropForWheelbase(wheelbaseMm(7, l), l)).toBeCloseTo(7, 6);
  });
});

describe('help text', () => {
  it('every input field label has help', () => {
    for (const file of ['src/ui/ConfigPanel.tsx', 'src/ui/OptimizerPanel.tsx']) {
      const labels = [...readFileSync(file, 'utf8').matchAll(/label="([^"]+)"/g)].map((m) => m[1]);
      expect(labels.length).toBeGreaterThan(5);
      for (const l of labels) expect(HELP[l], `${file}: ${l}`).toBeTruthy();
    }
  });
});

describe('utilities', () => {
  it('share links round-trip a configuration', () => {
    const c = { ...five, name: 'Ünïcode — test' };
    expect(decodeConfig(encodeConfig(c))).toEqual(c);
    expect(decodeConfig('garbage')).toBeNull();
  });
  it('unit conversions round-trip', () => {
    for (const q of ['mass', 'thrust', 'altitude', 'temp', 'speed', 'distance', 'climb'] as const) {
      const u = unit('imperial', q);
      expect(u.fromDisplay(u.toDisplay(123.4))).toBeCloseTo(123.4, 9);
    }
    expect(unit('imperial', 'temp').toDisplay(100)).toBeCloseTo(212, 9);
  });
  it('fuzzy search finds motors by brand and size', () => {
    const items = [
      { name: 'T-Motor F60 Pro IV 2207 1950KV' },
      { name: 'iFlight XING2 2207 1855KV' },
      { name: 'Sunnysky X2216 880KV' },
    ];
    const res = fuzzyFilter(items, 'tmotor 2207', (i) => i.name);
    expect(res[0].name).toContain('T-Motor');
    expect(fuzzyFilter(items, '2207', (i) => i.name)).toHaveLength(2);
  });
});
