import type { Chemistry, Layout } from './types';

export const G = 9.80665;
export const IN_TO_M = 0.0254;
const RHO0 = 1.225;
const P0 = 101325;
const T0 = 288.15;
const SPEED_OF_SOUND_0 = 340.3;

/** ISA barometric pressure in Pa at a given geometric altitude. */
export function pressureAt(elevation: number): number {
  return P0 * Math.pow(1 - 2.25577e-5 * elevation, 5.25588);
}

/** FRS 3.2: ρ = ρ0 · (P_alt / P0) · (T0 / T_amb). */
export function airDensity(elevation: number, temperatureC: number): number {
  return RHO0 * (pressureAt(elevation) / P0) * (T0 / (temperatureC + 273.15));
}

export function speedOfSound(temperatureC: number): number {
  return SPEED_OF_SOUND_0 * Math.sqrt((temperatureC + 273.15) / T0);
}

export interface LayoutInfo {
  label: string;
  motors: number;
  /** Average thrust-coefficient factor. Coaxial lower rotors work in the upper rotor's wake. */
  thrustFactor: number;
}

export const LAYOUTS: Record<Layout, LayoutInfo> = {
  quadX: { label: 'Quad X', motors: 4, thrustFactor: 1 },
  quadP: { label: 'Quad +', motors: 4, thrustFactor: 1 },
  hexa: { label: 'Hexa (flat)', motors: 6, thrustFactor: 1 },
  octo: { label: 'Octo (flat)', motors: 8, thrustFactor: 1 },
  x8coax: { label: 'Octo coaxial (X8)', motors: 8, thrustFactor: 0.9 },
};

export interface ChemistryInfo {
  label: string;
  nominal: number; // V per cell under typical load
  full: number;
  min: number; // minimum cell voltage under load
  energyDensity: number; // Wh/kg for a complete pack
  cRating: number;
  cBurst: number;
  /** Cell resistance ≈ k / capacity_Ah mΩ, used for defaults and the optimizer. */
  resistanceK: number;
}

export const CHEMISTRIES: Record<Chemistry, ChemistryInfo> = {
  lipo: { label: 'LiPo', nominal: 3.7, full: 4.2, min: 3.3, energyDensity: 150, cRating: 50, cBurst: 100, resistanceK: 4.5 },
  lihv: { label: 'LiHV', nominal: 3.8, full: 4.35, min: 3.3, energyDensity: 160, cRating: 50, cBurst: 100, resistanceK: 4.5 },
  lifepo4: { label: 'LiFePO4', nominal: 3.3, full: 3.65, min: 2.8, energyDensity: 100, cRating: 20, cBurst: 40, resistanceK: 20 },
  liion: { label: 'Li-ion', nominal: 3.6, full: 4.2, min: 3.0, energyDensity: 200, cRating: 8, cBurst: 15, resistanceK: 75 },
};

export function defaultCellResistance(chem: Chemistry, capacityMah: number): number {
  return CHEMISTRIES[chem].resistanceK / Math.max(capacityMah / 1000, 0.05);
}

export function estimateBatteryWeight(chem: Chemistry, s: number, p: number, capacityMah: number): number {
  const wh = (s * CHEMISTRIES[chem].nominal * p * capacityMah) / 1000;
  return (wh / CHEMISTRIES[chem].energyDensity) * 1000;
}

/**
 * Static thrust/power coefficients estimated from geometry when no measured constants exist.
 * Fitted to typical UIUC/APC static data: 10x4.5 2-blade → Ct≈0.10, Cp≈0.044;
 * 5x4.3 3-blade → Ct≈0.19, Cp≈0.10. Expect ±15 %; measured constants should be preferred.
 */
export function estimatePropCt(diameter: number, pitch: number, blades: number): number {
  const pd = pitch / diameter;
  return 0.16 * Math.pow(pd, 0.6) * Math.pow(blades / 2, 0.6);
}

export function estimatePropCp(diameter: number, pitch: number, blades: number): number {
  const pd = pitch / diameter;
  return 0.075 * pd * Math.pow(blades / 2, 0.8) + 0.01;
}

export function estimatePropWeight(diameter: number, blades: number): number {
  return 0.12 * Math.pow(diameter, 2.3) * (blades / 2);
}

/** Frontal Cd·A estimate (m²) for a multirotor of the given all-up weight. */
export function estimateDragArea(auwG: number): number {
  return 0.02 * Math.pow(auwG / 1000, 2 / 3);
}

/** Motor thermal resistance to ambient (°C/W) under prop-wash cooling. */
export function motorThermalResistance(weightG: number): number {
  return 15 / Math.pow(Math.max(weightG, 1), 0.6);
}

/** Effective motor heat capacity (J/°C): stator, windings and bell share the heat. */
export function motorHeatCapacity(weightG: number): number {
  return (weightG / 1000) * 700;
}

/**
 * Generic motor parameters from Kv and mass, used by the optimizer when searching
 * component space. Motor constant Km = Kt/√Rm scales ≈ m^0.79 (2207 ≈ 0.022 N·m/√W).
 */
export function estimateMotor(kv: number, weightG: number) {
  const km = 0.0223 * Math.pow(weightG / 32, 0.79);
  const kt = 9.5488 / kv;
  const rmOhm = (kt / km) ** 2;
  const i0 = 0.06 * Math.pow(weightG, 0.8) * ((kv * 10) / 15000);
  const maxCurrent = Math.sqrt((2 * weightG) / rmOhm);
  return { rm: rmOhm * 1000, i0, v0: 10, maxCurrent };
}
