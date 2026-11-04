import { LAYOUTS } from '../engine/physics';
import { batteryWeight } from '../engine/simulate';
import type { Config, Results, Severity } from '../engine/types';
import { fmt, fmtNum, type UnitSystem } from '../lib/units';
import { useUnits } from './context';
import { wheelbaseMm } from '../lib/frame';
import { t, useT } from '../i18n';

const SIZE = 340;
const C = SIZE / 2;
const MARGIN = 28; // room for the dimension lines
const IN = 25.4;

// The view snaps to these spans (mm) so a bigger frame or prop visibly grows within a size class
// instead of being re-fitted to the same size every time.
const SPANS = [100, 160, 250, 400, 600, 900, 1300, 1900, 2800, 4000];

const tone = (s: Severity | undefined) => (s === 'danger' ? 'var(--danger)' : s === 'warn' ? 'var(--warn)' : 'var(--good)');

/** Physical footprint estimates (mm) for drawing; rough but consistent between builds. */
export function sketchGeometry(c: Config) {
  const coax = c.frame.layout === 'x8coax';
  const arms = coax ? 4 : LAYOUTS[c.frame.layout].motors;
  const frameR = (c.frame.maxPropIn * IN) / 2;
  // Arm length where two neighbouring props of the frame's maximum size just clear each other.
  const arm = wheelbaseMm(c.frame.maxPropIn, c.frame.layout) / 2;
  const propR = (c.prop.diameter * IN) / 2;
  const motorD = 8 * Math.pow(c.motor.weight, 0.38); // bell diameter: 1404 ≈ 18 mm, 2207 ≈ 30 mm, U10 ≈ 90 mm
  // Battery as a box of LiPo/Li-ion density ~2 g/cm³ with 3 : 1.6 : 1 proportions.
  const batVol = (batteryWeight(c) / 2) * 1000; // mm³
  const batH = Math.cbrt(batVol / 4.8);
  const payloadSide = c.frame.payload > 0 ? Math.cbrt((c.frame.payload / 1.2) * 1000) : 0;
  const plate = Math.max(arm * 0.42, batH * 1.8, 24);
  const extent = arm + Math.max(propR, frameR);

  // Motor positions (mm from centre, y towards the rear) and the overall footprint with props fitted.
  const offset = c.frame.layout === 'quadP' ? 0 : Math.PI / arms;
  const motors = Array.from({ length: arms }, (_, i) => {
    const a = -Math.PI / 2 + offset + (i * 2 * Math.PI) / arms;
    return { x: Math.cos(a) * arm, y: Math.sin(a) * arm, cw: i % 2 === 0 };
  });
  const reach = Math.max(propR, motorD / 2);
  const bounds = {
    minX: Math.min(-plate / 2, ...motors.map((m) => m.x - reach)),
    maxX: Math.max(plate / 2, ...motors.map((m) => m.x + reach)),
    minY: Math.min(-plate / 2, ...motors.map((m) => m.y - reach)),
    maxY: Math.max(plate / 2 + (payloadSide ? payloadSide * 0.8 : 0), ...motors.map((m) => m.y + reach)),
  };
  return {
    arms, coax, arm, propR, frameR, motorD, batL: batH * 3, batW: batH * 1.6, payloadSide, plate, wheelbase: arm * 2, extent, motors, bounds,
    width: bounds.maxX - bounds.minX,
    length: bounds.maxY - bounds.minY,
  };
}

const lengthLabel = (system: UnitSystem, mm: number) =>
  system === 'imperial' ? `${fmtNum(mm / IN, mm / IN < 10 ? 1 : 0)} ${t('in')}` : mm >= 1000 ? `${fmtNum(mm / 1000, 1)} ${t('m')}` : `${fmtNum(mm)} ${t('mm')}`;

interface Props {
  config: Config;
  results: Results | null;
}

/**
 * Top view drawn to scale from the configuration. Arm length comes from the frame's maximum prop
 * size, props are drawn at their real diameter (a smaller prop leaves a visible gap), motors,
 * battery and payload at an estimated physical size. Motors and pack are tinted by status.
 */
export function DroneSketch({ config: c, results: r }: Props) {
  const system = useUnits();
  useT();
  const info = LAYOUTS[c.frame.layout];
  const g = sketchGeometry(c);
  const span = SPANS.find((s) => s >= g.extent * 2 * 1.04) ?? g.extent * 2 * 1.04;
  const k = (SIZE - MARGIN * 2) / span; // px per mm
  const cy = C;
  const motors = g.motors.map((m) => ({ x: C + m.x * k, y: cy + m.y * k, cw: m.cw }));
  const box = { x0: C + g.bounds.minX * k, x1: C + g.bounds.maxX * k, y0: cy + g.bounds.minY * k, y1: cy + g.bounds.maxY * k };
  const dimTop = Math.max(10, box.y0 - 12);
  const dimRight = Math.min(SIZE - 10, box.x1 + 12);

  const status = (key: string) => r?.status.find((s) => s.key === key)?.severity;
  const motorSev: Severity =
    status('thermal') === 'danger' || status('motor') === 'danger' ? 'danger' : status('thermal') === 'warn' || status('motor') === 'warn' ? 'warn' : 'ok';
  const rpm = r?.hover?.rpm ?? 0;
  // Animation speed only hints at RPM; real rotation is far too fast to draw.
  const spin = rpm > 0 ? Math.max(0.25, Math.min(2.5, 6000 / rpm)) : 0;
  const pr = g.propR * k;
  const fr = g.frameR * k;
  const tooBig = c.prop.diameter > c.frame.maxPropIn;

  const blades = (x: number, y: number, cw: boolean, key: string) => {
    const n = c.prop.blades;
    const width = Math.max(2, pr * (0.13 + 0.12 * (c.prop.pitch / c.prop.diameter)));
    return (
      <g
        key={key}
        className={spin ? 'sketch-spin' : undefined}
        style={spin ? { transformOrigin: `${x}px ${y}px`, animationDuration: `${spin}s`, animationDirection: cw ? 'normal' : 'reverse' } : undefined}
      >
        {Array.from({ length: n }, (_, i) => (
          <ellipse key={i} cx={x} cy={y - pr / 2} rx={width / 2} ry={pr / 2} transform={`rotate(${(i * 360) / n} ${x} ${y})`} className="sketch-blade" />
        ))}
      </g>
    );
  };

  return (
    <div className="card sketch">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={t('Top view to scale: {layout}, wheelbase {wb} mm, {d} inch props', { layout: info.label, wb: Math.round(g.wheelbase), d: c.prop.diameter })}>
        {motors.map((m, i) => (
          <line key={`arm${i}`} x1={C} y1={cy} x2={m.x} y2={m.y} className="sketch-arm" strokeWidth={Math.max(3, g.motorD * k * 0.45)} />
        ))}
        <rect x={C - (g.plate * k) / 2} y={cy - (g.plate * k) / 2} width={g.plate * k} height={g.plate * k} rx={g.plate * k * 0.18} className="sketch-body" />
        {g.payloadSide > 0 && (
          <rect x={C - (g.payloadSide * k) / 2} y={cy + (g.plate * k) / 2 - 2} width={g.payloadSide * k} height={g.payloadSide * k * 0.8} rx={3} className="sketch-payload" />
        )}
        <rect x={C - (g.batW * k) / 2} y={cy - (g.batL * k) / 2} width={g.batW * k} height={g.batL * k} rx={3} fill={tone(status('climit'))} className="sketch-battery" />
        {motors.map((m, i) => (
          <g key={`m${i}`}>
            <circle cx={m.x} cy={m.y} r={fr} className={`sketch-limit${tooBig ? ' over' : ''}`} />
            <circle cx={m.x} cy={m.y} r={pr} className="sketch-disc" />
            {g.coax && <circle cx={m.x} cy={m.y} r={pr * 0.94} className="sketch-disc coax" />}
            {blades(m.x, m.y, m.cw, `b${i}`)}
            <circle cx={m.x} cy={m.y} r={Math.max(2.5, (g.motorD * k) / 2)} fill={tone(motorSev)} className="sketch-motor" />
          </g>
        ))}
        <path d={`M ${C} ${cy - (g.plate * k) / 2 - 3} l -6 -9 h 12 z`} className="sketch-front" />
        <g className="sketch-dim">
          <line x1={box.x0} y1={box.y0} x2={box.x0} y2={dimTop - 4} className="ext" />
          <line x1={box.x1} y1={box.y0} x2={box.x1} y2={dimTop - 4} className="ext" />
          <line x1={box.x0} y1={dimTop} x2={box.x1} y2={dimTop} markerStart="url(#dim-arrow)" markerEnd="url(#dim-arrow)" />
          <text x={(box.x0 + box.x1) / 2} y={dimTop - 4} textAnchor="middle" className="dim-label">
            {lengthLabel(system, g.width)}
          </text>
          <line x1={box.x1} y1={box.y0} x2={dimRight + 4} y2={box.y0} className="ext" />
          <line x1={box.x1} y1={box.y1} x2={dimRight + 4} y2={box.y1} className="ext" />
          <line x1={dimRight} y1={box.y0} x2={dimRight} y2={box.y1} markerStart="url(#dim-arrow)" markerEnd="url(#dim-arrow)" />
          <text
            x={dimRight + 4}
            y={(box.y0 + box.y1) / 2}
            textAnchor="middle"
            transform={`rotate(90 ${dimRight + 4} ${(box.y0 + box.y1) / 2})`}
            className="dim-label"
          >
            {lengthLabel(system, g.length)}
          </text>
        </g>
        <defs>
          <marker id="dim-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 1L10 5L0 9z" className="dim-arrowhead" />
          </marker>
        </defs>
      </svg>
      <div className="sketch-caption">
        <strong>{t(info.label)} · {t('wheelbase {v}', { v: lengthLabel(system, g.wheelbase) })}</strong>
        <span>
          {t('{d}″ props in a {f}″ frame', { d: c.prop.diameter, f: c.frame.maxPropIn })} · {c.motor.kv} KV · {c.battery.s}S {fmtNum(c.battery.capacity * c.battery.p)} {t('mAh')}
        </span>
        {r && (
          <span>
            {t('AUW')} {fmt(system, 'mass', r.auw)}
            {r.hover ? ` · ${t('hover {v} rpm', { v: fmtNum(r.hover.rpm) })}` : ` · ${t('cannot hover')}`}
          </span>
        )}
        <span>
          {t('Overall {w} wide × {l} long, props included', { w: lengthLabel(system, g.width), l: lengthLabel(system, g.length) })}
        </span>
        <span className="sketch-legend">{t('Dashed ring: largest prop the frame fits. Drawn to scale.')}</span>
      </div>
    </div>
  );
}
