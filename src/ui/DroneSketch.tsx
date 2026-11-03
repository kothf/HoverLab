import { LAYOUTS } from '../engine/physics';
import type { Config, Results, Severity } from '../engine/types';
import { fmt, fmtNum } from '../lib/units';
import { useUnits } from './context';

const SIZE = 340;
const C = SIZE / 2;

const tone = (s: Severity | undefined) => (s === 'danger' ? 'var(--danger)' : s === 'warn' ? 'var(--warn)' : 'var(--good)');

interface Props {
  config: Config;
  results: Results | null;
}

/**
 * Top-view sketch drawn from the current configuration: arm count and layout, prop diameter and
 * blade count to scale with the frame, motor size from its weight, battery footprint from its
 * weight and a payload box. Motors and battery are tinted by their status indicators.
 */
export function DroneSketch({ config: c, results: r }: Props) {
  const system = useUnits();
  const layout = c.frame.layout;
  const info = LAYOUTS[layout];
  const coax = layout === 'x8coax';
  const arms = coax ? 4 : info.motors;
  const plus = layout === 'quadP';

  // Arm length so that neighbouring props just clear each other, then scale everything to fit.
  const propR = c.prop.diameter / 2;
  const clear = propR * 1.08;
  const armLen = Math.max(clear / Math.sin(Math.PI / arms), propR * 1.3);
  const scale = (C - 10) / (armLen + propR);
  const pr = propR * scale;
  const al = armLen * scale;

  const status = (key: string) => r?.status.find((s) => s.key === key)?.severity;
  const motorColor = tone(status('thermal') === 'danger' || status('motor') === 'danger' ? 'danger' : status('thermal') === 'warn' || status('motor') === 'warn' ? 'warn' : 'ok');
  const batteryColor = tone(status('climit'));

  const motorR = Math.max(5, Math.min(pr * 0.35, 4 + Math.cbrt(c.motor.weight) * 2.6 * Math.min(1, scale / 6)));
  const bodyR = Math.max(26, al * 0.32);
  const batWeight = r?.weights.battery ?? 0;
  const auw = r?.auw ?? 1;
  const batFrac = Math.min(0.7, batWeight / auw);
  const batW = bodyR * 2 * (0.55 + batFrac * 0.6);
  const batH = batW * 0.48;
  const offset = plus ? 0 : Math.PI / arms;
  const rpm = r?.hover?.rpm ?? 0;
  // Animation speed only hints at RPM; real rotation is far too fast to draw.
  const spin = rpm > 0 ? Math.max(0.25, Math.min(2.5, 6000 / rpm)) : 0;

  const motors = Array.from({ length: arms }, (_, i) => {
    const a = -Math.PI / 2 + offset + (i * 2 * Math.PI) / arms;
    return { x: C + Math.cos(a) * al, y: C + Math.sin(a) * al, a, cw: i % 2 === 0 };
  });

  const blades = (cx: number, cy: number, radius: number, cw: boolean, key: string) => {
    const n = c.prop.blades;
    const width = Math.max(3, radius * (0.14 + 0.02 * (c.prop.pitch / c.prop.diameter) * 10));
    return (
      <g key={key} className={spin ? 'sketch-spin' : undefined} style={spin ? { transformOrigin: `${cx}px ${cy}px`, animationDuration: `${spin}s`, animationDirection: cw ? 'normal' : 'reverse' } : undefined}>
        {Array.from({ length: n }, (_, k) => {
          const ang = (k * 360) / n;
          return (
            <ellipse key={k} cx={cx} cy={cy - radius / 2} rx={width / 2} ry={radius / 2} transform={`rotate(${ang} ${cx} ${cy})`} className="sketch-blade" />
          );
        })}
      </g>
    );
  };

  return (
    <div className="card sketch">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={`Top view: ${info.label}, ${c.prop.diameter} inch props`}>
        {motors.map((m, i) => (
          <line key={`arm${i}`} x1={C} y1={C} x2={m.x} y2={m.y} className="sketch-arm" strokeWidth={Math.max(4, bodyR * 0.28)} />
        ))}
        <rect x={C - bodyR} y={C - bodyR * 0.8} width={bodyR * 2} height={bodyR * 1.6} rx={bodyR * 0.25} className="sketch-body" />
        {c.frame.payload > 0 && (
          <rect
            x={C - bodyR * 0.45}
            y={C + bodyR * 0.82}
            width={bodyR * 0.9}
            height={Math.max(8, bodyR * 0.5 * Math.min(2, Math.sqrt(c.frame.payload / Math.max(c.frame.weight, 1))))}
            rx={3}
            className="sketch-payload"
          />
        )}
        <rect x={C - batW / 2} y={C - batH / 2} width={batW} height={batH} rx={4} fill={batteryColor} className="sketch-battery" />
        <text x={C} y={C + 4} textAnchor="middle" className="sketch-label">
          {c.battery.s}S{c.battery.p > 1 ? `${c.battery.p}P` : ''}
        </text>
        {motors.map((m, i) => (
          <g key={`m${i}`}>
            <circle cx={m.x} cy={m.y} r={pr} className="sketch-disc" />
            {coax && <circle cx={m.x} cy={m.y} r={pr * 0.94} className="sketch-disc coax" />}
            {blades(m.x, m.y, pr, m.cw, `b${i}`)}
            <circle cx={m.x} cy={m.y} r={motorR} fill={motorColor} className="sketch-motor" />
            <path
              d={`M ${m.x + pr * 0.82} ${m.y} A ${pr * 0.82} ${pr * 0.82} 0 0 ${m.cw ? 1 : 0} ${m.x} ${m.y + (m.cw ? pr * 0.82 : -pr * 0.82)}`}
              className="sketch-dir"
              markerEnd="url(#arrow)"
            />
          </g>
        ))}
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10z" className="sketch-arrowhead" />
          </marker>
        </defs>
        <path d={`M ${C} ${C - bodyR * 0.8 - 2} l -7 -10 h 14 z`} className="sketch-front" />
      </svg>
      <div className="sketch-caption">
        <strong>{info.label}</strong>
        <span>
          {c.prop.diameter}×{c.prop.pitch}×{c.prop.blades} props · {c.motor.kv} KV · {c.battery.s}S {fmtNum(c.battery.capacity * c.battery.p)} mAh
        </span>
        {r && (
          <span>
            AUW {fmt(system, 'mass', r.auw)}
            {r.hover ? ` · hover ${fmtNum(r.hover.rpm)} rpm` : ' · cannot hover'}
          </span>
        )}
      </div>
    </div>
  );
}
