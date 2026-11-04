import {
  CHEMISTRIES,
  G,
  IN_TO_M,
  LAYOUTS,
  airDensity,
  estimateBatteryWeight,
  estimateDragArea,
  estimatePropCp,
  estimatePropCt,
  estimatePropWeight,
  speedOfSound,
} from './physics';
import {
  MAX_TEMP_WINDOW_S,
  flightMinutes,
  maxPoint,
  opAtThrottle,
  opAtThrust,
  opInFlight,
  thermalModel,
  type Drive,
} from './solver';
import type {
  Config,
  Msg,
  CurvePoint,
  OperatingPoint,
  PayloadPoint,
  Results,
  Severity,
  SimulationOutcome,
  StatusIndicator,
  Warning,
  WeightBreakdown,
} from './types';

export const HOVER_THROTTLE_LIMIT = 0.8;
/** Limits for the practical payload: still flyable with control margin, not just able to lift off. */
export const PRACTICAL_TW = 2;
export const PRACTICAL_HOVER_THROTTLE = 0.6;
export const MOTOR_TEMP_LIMIT = 80;

/** Fills {name} placeholders in an English message template. */
export const english = (m: Msg) => m.tpl.replace(/\{(\w+)\}/g, (x, k: string) => (m.vars && k in m.vars ? String(m.vars[k]) : x));

/** FRS 3.4 data verification: reject physically impossible inputs before simulating. */
export function validateMsgs(c: Config): Msg[] {
  const e: Msg[] = [];
  const pos = (v: number | null | undefined, label: string) => {
    if (v == null || !Number.isFinite(v) || v <= 0) e.push({ tpl: '{label} must be greater than 0', vars: { label } });
  };
  const nonNeg = (v: number, label: string) => {
    if (!Number.isFinite(v) || v < 0) e.push({ tpl: '{label} cannot be negative', vars: { label } });
  };
  pos(c.motor.kv, 'Motor Kv');
  pos(c.motor.rm, 'Motor Rm');
  nonNeg(c.motor.i0, 'Motor no-load current');
  pos(c.motor.v0, 'No-load test voltage');
  pos(c.motor.weight, 'Motor weight');
  pos(c.prop.diameter, 'Prop diameter');
  pos(c.prop.pitch, 'Prop pitch');
  if (!Number.isInteger(c.prop.blades) || c.prop.blades < 2 || c.prop.blades > 8) e.push({ tpl: 'Blade count must be 2–8' });
  if (c.prop.ct != null) pos(c.prop.ct, 'Thrust constant');
  if (c.prop.cp != null) pos(c.prop.cp, 'Power constant');
  if (!Number.isInteger(c.battery.s) || c.battery.s < 1 || c.battery.s > 24) e.push({ tpl: 'Cell count S must be 1–24' });
  if (!Number.isInteger(c.battery.p) || c.battery.p < 1 || c.battery.p > 20) e.push({ tpl: 'Parallel count P must be 1–20' });
  pos(c.battery.capacity, 'Battery capacity');
  pos(c.battery.cRating, 'Battery C-rating');
  nonNeg(c.battery.resistance, 'Battery resistance');
  if (c.battery.weight != null) pos(c.battery.weight, 'Battery weight');
  if (!(c.battery.maxDischarge > 0 && c.battery.maxDischarge <= 1)) e.push({ tpl: 'Usable capacity must be 1–100 %' });
  pos(c.esc.maxCurrent, 'ESC current');
  nonNeg(c.esc.resistance, 'ESC resistance');
  nonNeg(c.esc.weight, 'ESC weight');
  pos(c.frame.weight, 'Frame weight');
  nonNeg(c.frame.payload, 'Payload');
  nonNeg(c.frame.accessoryCurrent, 'Accessory current');
  if (c.env.temperature < -60 || c.env.temperature > 60) e.push({ tpl: 'Air temperature must be −60…60 °C' });
  if (c.env.elevation < -500 || c.env.elevation > 8000) e.push({ tpl: 'Elevation must be −500…8000 m' });
  return e;
}

export const validateConfig = (c: Config): string[] => validateMsgs(c).map(english);

export function batteryWeight(c: Config): number {
  const b = c.battery;
  if (b.weight != null) return b.weight;
  if (b.cellWeight) return b.cellWeight * b.s * b.p * 1.08;
  return estimateBatteryWeight(b.chemistry, b.s, b.p, b.capacity);
}

export function weightBreakdown(c: Config, extraPayload = 0): WeightBreakdown {
  const n = LAYOUTS[c.frame.layout].motors;
  return {
    frame: c.frame.weight,
    payload: c.frame.payload + extraPayload,
    motors: c.motor.weight * n,
    props: (c.prop.weight ?? estimatePropWeight(c.prop.diameter, c.prop.blades)) * n,
    escs: c.esc.weight * n,
    battery: batteryWeight(c),
  };
}

export function buildDrive(c: Config): Drive {
  const layout = LAYOUTS[c.frame.layout];
  const chem = CHEMISTRIES[c.battery.chemistry];
  const ct = c.prop.ct ?? estimatePropCt(c.prop.diameter, c.prop.pitch, c.prop.blades);
  const cp = c.prop.cp ?? estimatePropCp(c.prop.diameter, c.prop.pitch, c.prop.blades);
  return {
    motors: layout.motors,
    rho: airDensity(c.env.elevation, c.env.temperature),
    d: c.prop.diameter * IN_TO_M,
    pitch: c.prop.pitch * IN_TO_M,
    ct: ct * layout.thrustFactor,
    cp,
    kv: c.motor.kv,
    i0: c.motor.i0,
    v0: c.motor.v0,
    rm: c.motor.rm / 1000,
    resc: c.esc.resistance / 1000,
    voc: c.battery.s * chem.nominal,
    rbat: (c.battery.s * c.battery.resistance) / 1000 / c.battery.p,
    iacc: c.frame.accessoryCurrent,
    capacityAh: (c.battery.capacity * c.battery.p) / 1000,
    usable: c.battery.maxDischarge,
    motorWeight: c.motor.weight,
    ambient: c.env.temperature,
    speedOfSound: speedOfSound(c.env.temperature),
  };
}

/** Resting cell voltage once the usable capacity is spent, interpolated from full to the 80 % point. */
export function endCellVoltage(c: Config): number {
  const chem = CHEMISTRIES[c.battery.chemistry];
  return chem.full - (chem.full - chem.empty) * Math.min(c.battery.maxDischarge / 0.8, 1.15);
}

const sum = (w: WeightBreakdown) => w.frame + w.payload + w.motors + w.props + w.escs + w.battery;

export function hoverAt(dr: Drive, auwG: number): OperatingPoint | null {
  const op = opAtThrust(dr, auwG / dr.motors);
  return op.throttle <= 1 ? op : null;
}

/** Largest extra payload (g) that keeps hover throttle at or below the limit. */
export function maxExtraPayload(dr: Drive, auwG: number, limit = HOVER_THROTTLE_LIMIT): number {
  if (!(opAtThrust(dr, auwG / dr.motors).throttle <= limit)) return 0;
  let lo = 0;
  let hi = maxPoint(dr).totalThrust;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (opAtThrust(dr, (auwG + mid) / dr.motors).throttle <= limit) lo = mid;
    else hi = mid;
  }
  return lo;
}

function mixedCurrent(dr: Drive, hover: OperatingPoint, max: OperatingPoint): number {
  // Mixed profile: 70 % of the time at hover, 30 % at half-way between hover and full throttle.
  const mid = opAtThrottle(dr, (hover.throttle + max.throttle) / 2);
  return 0.7 * hover.batteryCurrent + 0.3 * mid.batteryCurrent;
}

/** Climb and forward-flight performance from momentum theory (see opInFlight). */
function forwardFlight(dr: Drive, auwG: number, cdaFront: number, max: OperatingPoint) {
  const W = (auwG / 1000) * G;
  const cdaTop = cdaFront * 2.5;
  // The static prop map overestimates thrust at high inflow; keep kinematic caps on pitch speed.
  const pitchSpeed = (max.rpm / 60) * dr.pitch;
  const perMotorG = (thrustN: number) => ((thrustN / G) * 1000) / dr.motors;

  const climbOp = (v: number) => opInFlight(dr, perMotorG(W + 0.5 * dr.rho * v * v * cdaTop), v, 0);
  const cruise = (v: number) => {
    let theta = 0;
    let T = W;
    for (let k = 0; k < 8; k++) {
      const cda = cdaFront * Math.cos(theta) + cdaTop * Math.sin(theta);
      const drag = 0.5 * dr.rho * v * v * cda;
      T = Math.hypot(W, drag);
      theta = Math.atan2(drag, W);
    }
    // Forward-tilted disk: the free stream crosses it at V·sinθ and runs along it at V·cosθ.
    return opInFlight(dr, perMotorG(T), v * Math.sin(theta), v * Math.cos(theta));
  };
  const ok = (op: OperatingPoint) => op.throttle <= 1;

  /** Largest speed in [0, cap] for which `feasible` holds, scanning up then bisecting. */
  const limit = (cap: number, feasible: (v: number) => boolean) => {
    if (cap <= 0 || !feasible(0)) return 0;
    const steps = 48;
    let lo = 0;
    for (let i = 1; i <= steps; i++) {
      const v = (cap * i) / steps;
      if (!feasible(v)) {
        let hi = v;
        for (let k = 0; k < 30; k++) {
          const mid = (lo + hi) / 2;
          if (feasible(mid)) lo = mid;
          else hi = mid;
        }
        return lo;
      }
      lo = v;
    }
    return cap;
  };

  const climb = limit(0.6 * pitchSpeed, (v) => ok(climbOp(v)));
  const maxSpeed = limit(0.85 * pitchSpeed, (v) => ok(cruise(v)));

  let range: Results['range'] = null;
  if (maxSpeed > 1) {
    const steps = 40;
    for (let i = 1; i <= steps; i++) {
      const v = (maxSpeed * i) / steps;
      const op = cruise(v);
      if (!ok(op)) break;
      const time = flightMinutes(dr, op.batteryCurrent);
      const distance = (v * time * 60) / 1000;
      if (!range || distance > range.distance) range = { speed: v, distance, time };
    }
  }
  return { climb, maxSpeed, range };
}

function worst(...s: Severity[]): Severity {
  return s.includes('danger') ? 'danger' : s.includes('warn') ? 'warn' : 'ok';
}

function assess(c: Config, r: Omit<Results, 'warnings' | 'status'>): { warnings: Warning[]; status: StatusIndicator[] } {
  const w: Warning[] = [];
  const add = (code: string, severity: 'warn' | 'danger', tpl: string, vars?: Msg['vars']) => w.push({ code, severity, tpl, vars, message: english({ tpl, vars }) });
  const { max, hover } = r;
  const pct = (x: number) => `${Math.round(x * 100)} %`;

  // Thrust / throttle
  let thrustSev: Severity = 'ok';
  if (!hover || r.thrustToWeight < 1) {
    thrustSev = 'danger';
    add('no-hover', 'danger', 'Insufficient thrust: the craft cannot hover.');
  } else if (r.thrustToWeight < 1.6) {
    thrustSev = 'danger';
    add('low-tw', 'danger', 'Thrust-to-weight {a}:1 is too low for safe control (≥ 2:1 recommended).', { a: r.thrustToWeight.toFixed(2) });
  } else if (r.thrustToWeight < 2) {
    thrustSev = 'warn';
    add('low-tw', 'warn', 'Thrust-to-weight {a}:1 is below the recommended 2:1.', { a: r.thrustToWeight.toFixed(2) });
  }
  let throttleSev: Severity = 'ok';
  if (hover && hover.throttle > 0.75) {
    throttleSev = 'danger';
    add('hover-throttle', 'danger', 'Hover throttle {a} leaves almost no control authority.', { a: pct(hover.throttle) });
  } else if (hover && hover.throttle > 0.6) {
    throttleSev = 'warn';
    add('hover-throttle', 'warn', 'Hover throttle {a} is high; aim for 35–55 %.', { a: pct(hover.throttle) });
  } else if (!hover) throttleSev = 'danger';

  // Thermal
  let thermalSev: Severity = 'ok';
  if (r.motorTempMax > MOTOR_TEMP_LIMIT || r.motorTempHover > MOTOR_TEMP_LIMIT) {
    thermalSev = 'danger';
    add('motor-temp', 'danger', 'Motor overload: predicted {a} °C exceeds {b} °C.', { a: Math.round(Math.max(r.motorTempMax, r.motorTempHover)), b: MOTOR_TEMP_LIMIT });
  } else if (r.motorTempMax > 65) {
    thermalSev = 'warn';
    add('motor-temp', 'warn', 'Motor runs warm: {a} °C after {b} s at full throttle.', { a: Math.round(r.motorTempMax), b: MAX_TEMP_WINDOW_S });
  }

  // Motor ratings
  let motorSev: Severity = 'ok';
  if (max.motorCurrent > c.motor.maxCurrent || max.motorVoltage * max.motorCurrent > c.motor.maxPower) {
    motorSev = 'danger';
    add('motor-rating', 'danger', 'Motor max current/power exceeded: {a} A, {b} W (rated {c} A / {d} W).', { a: max.motorCurrent.toFixed(1), b: Math.round(max.motorVoltage * max.motorCurrent), c: c.motor.maxCurrent, d: c.motor.maxPower });
  } else if (max.motorCurrent > 0.9 * c.motor.maxCurrent || max.motorVoltage * max.motorCurrent > 0.9 * c.motor.maxPower) {
    motorSev = 'warn';
    add('motor-rating', 'warn', 'Motor operates within 10 % of its rated current/power at full throttle.');
  }

  // ESC
  let escSev: Severity = 'ok';
  if (max.motorCurrent > c.esc.burstCurrent) {
    escSev = 'danger';
    add('esc', 'danger', 'ESC overload: {a} A exceeds the {b} A burst rating.', { a: max.motorCurrent.toFixed(1), b: c.esc.burstCurrent });
  } else if (max.motorCurrent > c.esc.maxCurrent) {
    escSev = 'warn';
    add('esc', 'warn', 'ESC above continuous rating at full throttle ({a} A > {b} A); burst use only.', { a: max.motorCurrent.toFixed(1), b: c.esc.maxCurrent });
  }

  // Battery
  let cSev: Severity = 'ok';
  if (max.cRate > c.battery.cBurst) {
    cSev = 'danger';
    add('c-rate', 'danger', 'Battery C-rate {a}C exceeds burst rating {b}C.', { a: max.cRate.toFixed(1), b: c.battery.cBurst });
  } else if (max.cRate > c.battery.cRating) {
    cSev = 'warn';
    add('c-rate', 'warn', 'Battery C-rate {a}C exceeds continuous rating {b}C.', { a: max.cRate.toFixed(1), b: c.battery.cRating });
  } else if (max.cRate > 0.9 * c.battery.cRating) {
    cSev = 'warn';
    add('c-rate', 'warn', 'Battery runs at {a} of its continuous {b}C rating at full throttle.', { a: pct(max.cRate / c.battery.cRating), b: c.battery.cRating });
  }
  const cellMin = CHEMISTRIES[c.battery.chemistry].min;
  if (max.batteryVoltage / c.battery.s < cellMin) {
    cSev = worst(cSev, 'warn');
    add('sag', 'warn', 'Voltage sags to {a} V/cell at full throttle (min {b} V).', { a: (max.batteryVoltage / c.battery.s).toFixed(2), b: cellMin });
  } else if (r.sagEnd < cellMin) {
    cSev = worst(cSev, 'warn');
    add('sag', 'warn', 'Near the end of the pack, full throttle sags to {a} V/cell (min {b} V): expect low-voltage cut-outs.', { a: r.sagEnd.toFixed(2), b: cellMin });
  }

  // Geometry
  if (c.prop.diameter > c.frame.maxPropIn) add('prop-size', 'danger', 'Prop {a}" exceeds the frame limit of {b}".', { a: c.prop.diameter, b: c.frame.maxPropIn });
  if (max.tipMach > 0.8) add('tip-mach', 'danger', 'Prop tip speed Mach {a} — risk of blade failure and severe loss of efficiency.', { a: max.tipMach.toFixed(2) });
  else if (max.tipMach > 0.7) add('tip-mach', 'warn', 'Prop tip speed Mach {a} is high (keep below 0.7).', { a: max.tipMach.toFixed(2) });

  const status: StatusIndicator[] = [
    { key: 'thrust', label: 'Thrust/Weight', severity: thrustSev, value: `${r.thrustToWeight.toFixed(2)} : 1` },
    { key: 'throttle', label: 'Hover throttle', severity: throttleSev, value: hover ? pct(hover.throttle) : '—' },
    { key: 'thermal', label: 'Motor thermal', severity: thermalSev, value: `${Math.round(r.motorTempMax)} °C` },
    { key: 'motor', label: 'Motor load', severity: motorSev, value: `${pct(max.motorCurrent / c.motor.maxCurrent)}` },
    { key: 'esc', label: 'ESC load', severity: escSev, value: `${pct(max.motorCurrent / c.esc.maxCurrent)}` },
    { key: 'climit', label: 'Battery C', severity: cSev, value: `${max.cRate.toFixed(1)}C / ${c.battery.cRating}C` },
  ];
  return { warnings: w, status };
}

export function simulate(c: Config): SimulationOutcome {
  const errorMsgs = validateMsgs(c);
  if (errorMsgs.length) return { ok: false, errors: errorMsgs.map(english), errorMsgs };

  const dr = buildDrive(c);
  const chem = CHEMISTRIES[c.battery.chemistry];
  const weights = weightBreakdown(c);
  const auw = sum(weights);
  const max = maxPoint(dr);
  const hover = hoverAt(dr, auw);

  const curves: CurvePoint[] = [];
  for (let i = 1; i <= 20; i++) {
    const op = opAtThrottle(dr, i / 20);
    curves.push({ ...op, throttlePct: i * 5 });
  }
  let optimum = curves[0];
  for (let i = 1; i <= 40; i++) {
    const op = opAtThrottle(dr, i / 40);
    if (op.motorEfficiency > optimum.motorEfficiency) optimum = { ...op, throttlePct: (i / 40) * 100 };
  }

  const thermal = thermalModel(dr, hover ? hover.motorLoss : max.motorLoss, max.motorLoss);
  const thermalCurve = Array.from({ length: 37 }, (_, i) => ({ t: i * 5, temp: thermal.at(i * 5) }));

  const hoverTime = hover ? flightMinutes(dr, hover.batteryCurrent) : 0;
  const mixedTime = hover ? flightMinutes(dr, mixedCurrent(dr, hover, max)) : 0;
  const cda = c.frame.dragArea ?? estimateDragArea(auw);
  const ff = forwardFlight(dr, auw, cda, max);

  const maxPayload = maxExtraPayload(dr, auw);
  const practicalPayload = Math.max(0, Math.min(max.totalThrust / PRACTICAL_TW - auw, maxExtraPayload(dr, auw, PRACTICAL_HOVER_THROTTLE)));
  const heavier = hoverAt(dr, auw + 100);
  const payloadCost = hover && heavier ? hoverTime - flightMinutes(dr, heavier.batteryCurrent) : 0;
  const sagEnd = maxPoint({ ...dr, voc: c.battery.s * endCellVoltage(c) }).batteryVoltage / c.battery.s;
  const payloadEnvelope: PayloadPoint[] = [];
  if (hover) {
    const steps = 12;
    for (let i = 0; i <= steps; i++) {
      const extra = (maxPayload * i) / steps;
      const op = opAtThrust(dr, (auw + extra) / dr.motors);
      if (op.throttle > 1) break;
      payloadEnvelope.push({ payload: extra, hoverTime: flightMinutes(dr, op.batteryCurrent), hoverThrottle: op.throttle });
    }
  }

  const base: Omit<Results, 'warnings' | 'status'> = {
    airDensity: dr.rho,
    motors: dr.motors,
    auw,
    weights,
    driveRatio: (weights.motors + weights.props + weights.escs + weights.battery) / auw,
    propCt: dr.ct,
    propCp: dr.cp,
    battery: {
      nominalVoltage: dr.voc,
      fullVoltage: c.battery.s * chem.full,
      capacity: c.battery.capacity * c.battery.p,
      energy: dr.voc * dr.capacityAh,
      usable: c.battery.capacity * c.battery.p * c.battery.maxDischarge,
      resistance: dr.rbat,
    },
    hover,
    max,
    optimum,
    thrustToWeight: max.totalThrust / auw,
    hoverTime,
    mixedTime,
    motorTempHover: thermal.hover,
    motorTempMax: thermal.at(MAX_TEMP_WINDOW_S),
    thermal: thermalCurve,
    climbRate: ff.climb,
    maxSpeed: ff.maxSpeed,
    range: ff.range,
    maxPayload,
    practicalPayload,
    payloadCost,
    sagEnd,
    curves,
    payloadEnvelope,
  };
  return { ok: true, results: { ...base, ...assess(c, base) } };
}
