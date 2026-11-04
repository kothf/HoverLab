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
 * ESC switching and gate-drive losses as a fraction of V_bat·I_motor. Switching energy per PWM
 * edge scales with the bus voltage and the phase current, not with the duty cycle, so it is
 * modelled as an extra input current k·I drawn at V_bat. 0.02 gives ~97–98 % at full throttle
 * and ~90 % at 20 % duty, in line with bench data for BLHeli/AM32 class ESCs.
 */
export const ESC_SWITCHING_LOSS = 0.02;
/** 60 / 2π: converts Kv in rpm/V to Kt in N·m/A (Kt = 60 / (2π·Kv)). */
export const RPM_PER_RAD_S = 60 / TWO_PI;

/**
 * Steady-state operating point at a given shaft speed.
 * Propeller: T = Ct·ρ·n²·D⁴, P = Cp·ρ·n³·D⁵ (n in rev/s, D in m).
 * Motor (Drela first-order model): I = I0 + Q·Kv·2π/60, V_m = RPM/Kv + I·Rm.
 * ESC (averaged PWM, throttle τ): τ·V_bat = V_m + I·R_esc, I_bat = N·(τ + k_sw)·I + I_acc,
 * where k_sw·V_bat·I is the switching loss (ESC_SWITCHING_LOSS).
 * Battery: V_bat = V_oc − I_bat·R_bat.
 * Solving the last three for τ gives a quadratic. Throttle may exceed 1 for unreachable speeds.
 */
export function opAtRpm(dr: Drive, rpm: number, shaftPower?: number): OperatingPoint {
  const n = rpm / 60;
  const n2 = n * n;
  const d4 = dr.d ** 4;
  const thrustN = dr.ct * dr.rho * n2 * d4;
  const mechPower = shaftPower ?? dr.cp * dr.rho * n2 * n * d4 * dr.d;
  const torque = rpm > 0 ? mechPower / (TWO_PI * n) : 0;
  const i0 = rpm > 0 ? dr.i0 * Math.sqrt(rpm / (dr.kv * dr.v0)) : 0;
  const current = i0 + (torque * dr.kv) / RPM_PER_RAD_S;
  const motorVoltage = rpm / dr.kv + current * dr.rm;
  const vNeed = motorVoltage + current * dr.resc;

  const b = dr.motors * current * dr.rbat;
  const a = dr.voc - dr.iacc * dr.rbat - b * ESC_SWITCHING_LOSS;
  let throttle: number;
  if (b < 1e-12) throttle = vNeed / a;
  else {
    const disc = a * a - 4 * b * vNeed;
    throttle = disc < 0 ? Infinity : (a - Math.sqrt(disc)) / (2 * b);
  }

  const tau = Number.isFinite(throttle) ? throttle : 1;
  const escIn = tau + ESC_SWITCHING_LOSS; // ESC input current per amp of motor current
  const batteryCurrent = dr.motors * escIn * current + dr.iacc;
  const batteryVoltage = dr.voc - batteryCurrent * dr.rbat;
  const drivePower = dr.motors * escIn * current * batteryVoltage;
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
    escEfficiency: tau > 0 && batteryVoltage > 0 ? motorVoltage / (escIn * batteryVoltage) : 0,
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
  return opAtRpm(dr, rpmForThrust(dr, (thrustPerMotorG / 1000) * G));
}

/** Rpm at which the static prop map gives the requested thrust per motor (N). */
function rpmForThrust(dr: Drive, thrustN: number): number {
  return Math.sqrt(thrustN / (dr.ct * dr.rho * dr.d ** 4)) * 60;
}

/**
 * Induced velocity (m/s) of a rotor in oblique flow, from Glauert's momentum theory:
 * v_i = v_h² / √(V_p² + (V_n + v_i)²), with V_n the free-stream component through the disk
 * (positive for climb or a forward-tilted disk) and V_p the component in the disk plane.
 * Reduces to the hover value v_h for V = 0 and to the axial-climb solution for V_p = 0.
 * Leishman, Principles of Helicopter Aerodynamics, 2nd ed., §2.13–2.14 and §5.4.
 */
export function inducedVelocity(vh: number, vNormal: number, vPlane: number): number {
  if (vh <= 0) return 0;
  let vi = vh;
  for (let k = 0; k < 60; k++) {
    const next = (vh * vh) / Math.sqrt(vPlane * vPlane + (vNormal + vi) ** 2);
    if (Math.abs(next - vi) < 1e-9) return next;
    vi = 0.5 * (vi + next);
  }
  return vi;
}

/**
 * Operating point of one rotor delivering thrust T (g, along the shaft) while the vehicle moves
 * through the air. The static prop map gives rpm and hover shaft power P_s; momentum theory
 * splits P_s into ideal induced power T·v_h and the rest (profile drag and induced losses).
 * In flight the ideal induced term becomes T·(v_i + V_n), which includes the climb or parasite
 * work, and the profile part grows by (1 + 4.65 μ²) with advance ratio μ = V_p / (Ω R).
 * Leishman §5.4 (forward-flight power), Bauersfeld & Scaramuzza 2022 (multicopters).
 */
export function opInFlight(dr: Drive, thrustPerMotorG: number, vNormal: number, vPlane: number): OperatingPoint {
  const thrustN = (thrustPerMotorG / 1000) * G;
  const rpm = rpmForThrust(dr, thrustN);
  const n = rpm / 60;
  const staticPower = dr.cp * dr.rho * n ** 3 * dr.d ** 5;
  const area = (Math.PI * dr.d * dr.d) / 4;
  const vh = Math.sqrt(thrustN / (2 * dr.rho * area));
  const rest = Math.max(0, staticPower - thrustN * vh);
  const mu = n > 0 ? vPlane / (Math.PI * dr.d * n) : 0;
  const vi = inducedVelocity(vh, vNormal, vPlane);
  const power = rest * (1 + 4.65 * mu * mu) + thrustN * (vi + vNormal);
  return opAtRpm(dr, rpm, Math.max(power, 0));
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
