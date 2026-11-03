import { describe, expect, it } from 'vitest';
import { PRESETS } from '../data/presets';
import { decodeConfig, encodeConfig } from '../lib/share';
import { fuzzyFilter } from '../lib/fuzzy';
import { unit } from '../lib/units';
import { DEFAULT_TARGETS, matchKv, optimize } from './optimizer';
import { airDensity } from './physics';
import { buildDrive, simulate, validateConfig } from './simulate';
import { maxPoint, opAtThrottle, opAtThrust } from './solver';
import type { Config, Results } from './types';

const five = PRESETS[0];

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
    const escLoss = op.motorCurrent ** 2 * dr.resc;
    const batteryLoss = op.batteryCurrent ** 2 * dr.rbat;
    const accessories = dr.iacc * op.batteryVoltage;
    const cellPower = dr.voc * op.batteryCurrent;
    const sum = dr.motors * (op.mechPowerPerMotor + op.motorLoss + escLoss) + batteryLoss + accessories;
    expect(sum / cellPower).toBeCloseTo(1, 3);
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
