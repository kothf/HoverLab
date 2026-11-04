import { describe, expect, it } from 'vitest';
import { PRESETS } from '../data/presets';
import { simulate } from '../engine/simulate';
import type { Config, Results } from '../engine/types';
import { deriveInsights, loads } from './insights';

const run = (c: Config): Results => {
  const o = simulate(c);
  if (!o.ok) throw new Error(o.errors.join('; '));
  return o.results;
};
const byName = (n: string) => PRESETS.find((p) => p.name.startsWith(n))!;

describe('conclusions', () => {
  it('gives every preset a verdict and a payload line', () => {
    for (const p of PRESETS) {
      const codes = deriveInsights(p, run(p), 'metric').map((i) => i.code);
      expect(codes[0], p.name).toBe('verdict');
      expect(codes, p.name).toContain('payload');
    }
  });

  it('practical payload is stricter than the lift-off payload and keeps T/W ≥ 2', () => {
    for (const p of PRESETS) {
      const r = run(p);
      expect(r.practicalPayload, p.name).toBeLessThan(r.maxPayload);
      expect(r.max.totalThrust / (r.auw + r.practicalPayload), p.name).toBeGreaterThanOrEqual(2 - 1e-6);
      const heavier = run({ ...p, frame: { ...p.frame, payload: p.frame.payload + r.practicalPayload } });
      expect(heavier.hover!.throttle, p.name).toBeLessThanOrEqual(0.6 + 1e-3);
    }
  });

  it('payload cost matches the drop in hover time for 100 g', () => {
    const p = byName('5"');
    const a = run(p);
    const b = run({ ...p, frame: { ...p.frame, payload: p.frame.payload + 100 } });
    expect(a.payloadCost).toBeCloseTo(a.hoverTime - b.hoverTime, 6);
  });

  it('calls a freestyle quad agile and flags its motors as sized for punch', () => {
    const p = byName('5"');
    const ins = deriveInsights(p, run(p), 'metric');
    expect(ins[0].text).toMatch(/Agile/);
    expect(deriveInsights(byName('X8'), run(byName('X8')), 'metric')[0].text).toMatch(/Payload carrier/);
    expect(ins.some((i) => i.code === 'motor-match')).toBe(true);
  });

  it('spots oversized ESCs on the heavy lifter and the range cap on slow craft', () => {
    const p = byName('X8');
    const codes = deriveInsights(p, run(p), 'metric').map((i) => i.code);
    expect(codes).toContain('esc-oversized');
    expect(codes).toContain('range-cap');
  });

  it('names the busiest part as the bottleneck', () => {
    const p = byName('3"');
    expect(loads(p, run(p))[0].label).toBe('battery');
  });

  it('says so when the craft cannot hover', () => {
    const p = byName('5"');
    const c = { ...p, frame: { ...p.frame, payload: 20000 } };
    const ins = deriveInsights(c, run(c), 'metric');
    expect(ins[0].tone).toBe('caution');
    expect(ins[0].text).toMatch(/cannot hover/);
  });
});

describe('battery limits', () => {
  it('warns when the battery runs above 90 % of its C rating', () => {
    const p = byName('3"');
    const c = { ...p, battery: { ...p.battery, cRating: 72 } };
    expect(run(c).warnings.some((w) => w.code === 'c-rate' && w.severity === 'warn')).toBe(true);
  });

  it('warns when full throttle near the end of the pack sags below the cell minimum', () => {
    const p = byName('6"');
    const c = { ...p, battery: { ...p.battery, resistance: 25 } };
    const r = run(c);
    expect(r.sagEnd).toBeLessThan(3.0);
    expect(r.warnings.some((w) => w.code === 'sag')).toBe(true);
    expect(r.sagEnd).toBeLessThan(r.max.batteryVoltage / c.battery.s);
  });
});
