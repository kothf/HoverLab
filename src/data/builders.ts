import type { Chemistry, Layout } from '../engine/types';
import type { BatteryItem, EscItem, FrameItem, MotorItem, PropItem } from './components';

export const m = (id: string, brand: string, model: string, kv: number, weight: number, rm: number, i0: number, maxCurrent: number, maxPower: number, v0 = 10): MotorItem => ({
  id, brand, model, kv, weight, rm, i0, v0, maxCurrent, maxPower,
});
export const p = (id: string, brand: string, model: string, diameter: number, pitch: number, blades: number, weight: number, ct: number | null = null, cp: number | null = null): PropItem => ({
  id, brand, model, diameter, pitch, blades, weight, ct, cp,
});
export const b = (id: string, brand: string, model: string, chemistry: Chemistry, form: 'pack' | 'cell', s: number, capacity: number, cRating: number, cBurst: number, resistance: number, weight: number): BatteryItem => ({
  id, brand, model, chemistry, form, s, capacity, cRating, cBurst, resistance, weight,
});
export const e = (id: string, brand: string, model: string, format: '4in1' | 'single', maxCurrent: number, burstCurrent: number, resistance: number, weight: number): EscItem => ({
  id, brand, model, format, maxCurrent, burstCurrent, resistance, weight,
});
export const f = (id: string, brand: string, model: string, layout: Layout, weight: number, maxPropIn: number, dragArea: number | null = null): FrameItem => ({
  id, brand, model, layout, weight, maxPropIn, dragArea,
});
