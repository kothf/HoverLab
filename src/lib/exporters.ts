import { CHEMISTRIES, LAYOUTS } from '../engine/physics';
import type { Config, Results } from '../engine/types';

const csvCell = (v: unknown) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\n');
}

const r2 = (v: number, d = 2) => (Number.isFinite(v) ? +v.toFixed(d) : '');

/** Full calculation report as CSV: inputs, summary metrics and the throttle curve. */
export function reportCsv(c: Config, r: Results): string {
  const rows: unknown[][] = [
    ['HoverLab report', c.name],
    [],
    ['Input', 'Value'],
    ['Layout', LAYOUTS[c.frame.layout].label],
    ['Elevation (m)', c.env.elevation],
    ['Temperature (°C)', c.env.temperature],
    ['Frame weight (g)', c.frame.weight],
    ['Payload (g)', c.frame.payload],
    ['Battery', `${c.battery.name ?? ''} ${CHEMISTRIES[c.battery.chemistry].label} ${c.battery.s}S${c.battery.p}P ${c.battery.capacity}mAh`],
    ['Motor', `${c.motor.name ?? ''} ${c.motor.kv}KV Rm ${c.motor.rm}mΩ I0 ${c.motor.i0}A@${c.motor.v0}V`],
    ['Propeller', `${c.prop.name ?? ''} ${c.prop.diameter}x${c.prop.pitch}x${c.prop.blades}`],
    ['ESC', `${c.esc.name ?? ''} ${c.esc.maxCurrent}A`],
    [],
    ['Metric', 'Value'],
    ['All-up weight (g)', r2(r.auw, 0)],
    ['Thrust-to-weight', r2(r.thrustToWeight)],
    ['Hover throttle (%)', r.hover ? r2(r.hover.throttle * 100, 1) : ''],
    ['Hover current (A)', r.hover ? r2(r.hover.batteryCurrent) : ''],
    ['Hover power (W)', r.hover ? r2(r.hover.electricPower, 1) : ''],
    ['Specific thrust at hover (g/W)', r.hover ? r2(r.hover.specificThrust) : ''],
    ['Hover time (min)', r2(r.hoverTime, 1)],
    ['Mixed flight time (min)', r2(r.mixedTime, 1)],
    ['Max thrust (g)', r2(r.max.totalThrust, 0)],
    ['Max current (A)', r2(r.max.batteryCurrent, 1)],
    ['Peak power (W)', r2(r.max.electricPower, 0)],
    ['Motor temp after 15 s full throttle (°C)', r2(r.motorTempMax, 0)],
    ['Max climb (m/s)', r2(r.climbRate, 1)],
    ['Max speed (km/h)', r2(r.maxSpeed * 3.6, 0)],
    ['Best range (km)', r.range ? r2(r.range.distance) : ''],
    [],
    ['Throttle (%)', 'RPM', 'Total thrust (g)', 'Battery current (A)', 'Power (W)', 'Motor eff (%)', 'ESC eff (%)', 'g/W', 'C-rate'],
    ...r.curves.map((p) => [
      p.throttlePct, r2(p.rpm, 0), r2(p.totalThrust, 0), r2(p.batteryCurrent), r2(p.electricPower, 1),
      r2(p.motorEfficiency * 100, 1), r2(p.escEfficiency * 100, 1), r2(p.specificThrust), r2(p.cRate, 1),
    ]),
  ];
  if (r.warnings.length) rows.push([], ['Warnings'], ...r.warnings.map((w) => [w.severity, w.message]));
  return toCsv(rows);
}

export function download(filename: string, content: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function slug(s: string) {
  return s.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'hoverlab';
}
