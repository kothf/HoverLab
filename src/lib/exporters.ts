import { CHEMISTRIES, LAYOUTS } from '../engine/physics';
import type { Config, Results } from '../engine/types';
import { t, tm, tName } from '../i18n';

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
    [t('HoverLab report'), tName(c.name)],
    [],
    [t('Input'), t('Value')],
    [t('Layout'), t(LAYOUTS[c.frame.layout].label)],
    [t('Elevation (m)'), c.env.elevation],
    [t('Temperature (°C)'), c.env.temperature],
    [t('Frame weight (g)'), c.frame.weight],
    [t('Payload (g)'), c.frame.payload],
    [t('Battery'), `${c.battery.name ?? ''} ${CHEMISTRIES[c.battery.chemistry].label} ${c.battery.s}S${c.battery.p}P ${c.battery.capacity}mAh`],
    [t('Motor'), `${c.motor.name ?? ''} ${c.motor.kv}KV Rm ${c.motor.rm}mΩ I0 ${c.motor.i0}A@${c.motor.v0}V`],
    [t('Propeller'), `${c.prop.name ?? ''} ${c.prop.diameter}x${c.prop.pitch}x${c.prop.blades}`],
    [t('ESC'), `${c.esc.name ?? ''} ${c.esc.maxCurrent}A`],
    [],
    [t('Quantity'), t('Value')],
    [t('All-up weight (g)'), r2(r.auw, 0)],
    [t('Thrust-to-weight'), r2(r.thrustToWeight)],
    [t('Hover throttle (%)'), r.hover ? r2(r.hover.throttle * 100, 1) : ''],
    [t('Hover current (A)'), r.hover ? r2(r.hover.batteryCurrent) : ''],
    [t('Hover power (W)'), r.hover ? r2(r.hover.electricPower, 1) : ''],
    [t('Specific thrust at hover (g/W)'), r.hover ? r2(r.hover.specificThrust) : ''],
    [t('Hover time (min)'), r2(r.hoverTime, 1)],
    [t('Mixed flight time (min)'), r2(r.mixedTime, 1)],
    [t('Max thrust (g)'), r2(r.max.totalThrust, 0)],
    [t('Max current (A)'), r2(r.max.batteryCurrent, 1)],
    [t('Peak power (W)'), r2(r.max.electricPower, 0)],
    [t('Motor temp after 15 s full throttle (°C)'), r2(r.motorTempMax, 0)],
    [t('Max climb (m/s)'), r2(r.climbRate, 1)],
    [t('Max speed (km/h)'), r2(r.maxSpeed * 3.6, 0)],
    [t('Best range (km)'), r.range ? r2(r.range.distance) : ''],
    [t('Practical extra payload (g)'), r2(r.practicalPayload, 0)],
    [t('Max extra payload (g)'), r2(r.maxPayload, 0)],
    [t('Hover time lost per 100 g (s)'), r2(r.payloadCost * 60, 0)],
    [t('Full-throttle sag at end of pack (V/cell)'), r2(r.sagEnd)],
    [],
    [t('Throttle (%)'), t('RPM'), t('Total thrust (g)'), t('Battery current (A)'), t('Power (W)'), t('Motor eff (%)'), t('ESC eff (%)'), t('g/W'), t('C-rate')],
    ...r.curves.map((p) => [
      p.throttlePct, r2(p.rpm, 0), r2(p.totalThrust, 0), r2(p.batteryCurrent), r2(p.electricPower, 1),
      r2(p.motorEfficiency * 100, 1), r2(p.escEfficiency * 100, 1), r2(p.specificThrust), r2(p.cRate, 1),
    ]),
  ];
  if (r.warnings.length) rows.push([], [t('Warnings')], ...r.warnings.map((w) => [t(w.severity), tm(w)]));
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
