import { G, motorHeatCapacity, motorThermalResistance } from './physics';
import type { OperatingPoint } from './types';

/**
 * Flattened, unit-normalised description of one powertrain. Building this once lets the
 * optimizer evaluate thousands of candidates without touching config objects.
 */
export interface Drive {
  motors: number;
  rho: number; // kg/m³
  d: number; // prop diameter m
  pitch: number; // prop pitch m
  ct: number; // includes layout thrust factor
  cp: number;
  kv: number;
  i0: number; // A at v0
  v0: number;
  rm: number; // Ω
  resc: number; // Ω
  voc: number; // pack nominal V
  rbat: number; // pack Ω
  iacc: number; // A
  capacityAh: number;
  usable: number; // fraction
  motorWeight: number; // g
  ambient: number; // °C
  speedOfSound: number;
}

const TWO_PI = 2 * Math.PI;

/**
 * Steady-state operating point at a given shaft speed.
 * Propeller: T = Ct·ρ·n²·D⁴, P = Cp·ρ·n³·D⁵ (n in rev/s, D in m).
 * Motor: I = I0 + Q·Kv/9.5488, V_m = RPM/Kv + I·Rm.
 * ESC (averaged PWM, throttle τ): τ·V_bat = V_m + I·R_esc, I_bat = N·τ·I + I_acc.
 * Battery: V_bat = V_oc − I_bat·R_bat.
 * Solving the last three for τ gives a quadratic. Throttle may exceed 1 for unreachable speeds.
 */
export function opAtRpm(dr: Drive, rpm: number): OperatingPoint {
  const n = rpm / 60;
  const n2 = n * n;
  const d4 = dr.d ** 4;
  const thrustN = dr.ct * dr.rho * n2 * d4;
  const mechPower = dr.cp * dr.rho * n2 * n * d4 * dr.d;
  const torque = rpm > 0 ? mechPower / (TWO_PI * n) : 0;
  const i0 = rpm > 0 ? dr.i0 * Math.sqrt(rpm / (dr.kv * dr.v0)) : 0;
  const current = i0 + (torque * dr.kv) / 9.5488;
  const motorVoltage = rpm / dr.kv + current * dr.rm;
  const vNeed = motorVoltage + current * dr.resc;

  const a = dr.voc - dr.iacc * dr.rbat;
  const b = dr.motors * current * dr.rbat;
  let throttle: number;
  if (b < 1e-12) throttle = vNeed / a;
  else {
    const disc = a * a - 4 * b * vNeed;
    throttle = disc < 0 ? Infinity : (a - Math.sqrt(disc)) / (2 * b);
  }

  const tau = Number.isFinite(throttle) ? throttle : 1;
  const batteryCurrent = dr.motors * tau * current + dr.iacc;
  const batteryVoltage = dr.voc - batteryCurrent * dr.rbat;
  const drivePower = dr.motors * tau * current * batteryVoltage;
  const motorIn = motorVoltage * current;
  const thrustG = (thrustN / G) * 1000;
  const tipSpeed = Math.PI * dr.d * n;

  return {
    throttle,
    rpm,
    thrustPerMotor: thrustG,
    totalThrust: thrustG * dr.motors,
    torque,
    motorCurrent: current,
    batteryCurrent,
    batteryVoltage,
    motorVoltage,
    electricPower: batteryVoltage * batteryCurrent,
    mechPowerPerMotor: mechPower,
    motorLoss: motorIn - mechPower,
    motorEfficiency: motorIn > 0 ? mechPower / motorIn : 0,
    escEfficiency: tau > 0 && batteryVoltage > 0 ? motorVoltage / (tau * batteryVoltage) : 0,
    specificThrust: drivePower > 0 ? (thrustG * dr.motors) / drivePower : 0,
    cRate: batteryCurrent / dr.capacityAh,
    tipMach: tipSpeed / dr.speedOfSound,
  };
}

function bisectRpm(dr: Drive, targetThrottle: number): OperatingPoint {
  let lo = 0;
  let hi = dr.kv * dr.voc;
  for (let i = 0; i < 36; i++) {
    const mid = (lo + hi) / 2;
    if (opAtRpm(dr, mid).throttle > targetThrottle) hi = mid;
    else lo = mid;
  }
  return opAtRpm(dr, lo);
}

export function opAtThrottle(dr: Drive, throttle: number): OperatingPoint {
  return bisectRpm(dr, throttle);
}

export function maxPoint(dr: Drive): OperatingPoint {
  return bisectRpm(dr, 1);
}

/** Operating point producing the given thrust per motor (g). Throttle > 1 means unreachable. */
export function opAtThrust(dr: Drive, thrustPerMotorG: number): OperatingPoint {
  const thrustN = (thrustPerMotorG / 1000) * G;
  const n = Math.sqrt(thrustN / (dr.ct * dr.rho * dr.d ** 4));
  return opAtRpm(dr, n * 60);
}

export function flightMinutes(dr: Drive, batteryCurrent: number): number {
  if (batteryCurrent <= 0) return 0;
  return ((dr.capacityAh * dr.usable) / batteryCurrent) * 60;
}

export const MAX_TEMP_WINDOW_S = 15;

export function thermalModel(dr: Drive, hoverLoss: number, maxLoss: number) {
  const rth = motorThermalResistance(dr.motorWeight);
  const tau = rth * motorHeatCapacity(dr.motorWeight);
  const hover = dr.ambient + hoverLoss * rth;
  const ss = dr.ambient + maxLoss * rth;
  const at = (t: number) => hover + (ss - hover) * (1 - Math.exp(-t / tau));
  return { hover, steadyMax: ss, at, timeConstant: tau };
}
