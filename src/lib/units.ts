import { t } from '../i18n';

export type UnitSystem = 'metric' | 'imperial';

export type Quantity = 'mass' | 'thrust' | 'length' | 'altitude' | 'temp' | 'speed' | 'distance' | 'climb';

interface UnitDef {
  label: string;
  toDisplay: (v: number) => number;
  fromDisplay: (v: number) => number;
  digits: number;
}

const id = (v: number) => v;

const METRIC: Record<Quantity, UnitDef> = {
  mass: { label: 'g', toDisplay: id, fromDisplay: id, digits: 0 },
  thrust: { label: 'g', toDisplay: id, fromDisplay: id, digits: 0 },
  length: { label: 'in', toDisplay: id, fromDisplay: id, digits: 1 },
  altitude: { label: 'm', toDisplay: id, fromDisplay: id, digits: 0 },
  temp: { label: '°C', toDisplay: id, fromDisplay: id, digits: 0 },
  speed: { label: 'km/h', toDisplay: (v) => v * 3.6, fromDisplay: (v) => v / 3.6, digits: 0 },
  distance: { label: 'km', toDisplay: id, fromDisplay: id, digits: 1 },
  climb: { label: 'm/s', toDisplay: id, fromDisplay: id, digits: 1 },
};

const IMPERIAL: Record<Quantity, UnitDef> = {
  mass: { label: 'oz', toDisplay: (v) => v / 28.3495, fromDisplay: (v) => v * 28.3495, digits: 1 },
  thrust: { label: 'lbf', toDisplay: (v) => v / 453.592, fromDisplay: (v) => v * 453.592, digits: 2 },
  length: { label: 'in', toDisplay: id, fromDisplay: id, digits: 1 },
  altitude: { label: 'ft', toDisplay: (v) => v * 3.28084, fromDisplay: (v) => v / 3.28084, digits: 0 },
  temp: { label: '°F', toDisplay: (v) => (v * 9) / 5 + 32, fromDisplay: (v) => ((v - 32) * 5) / 9, digits: 0 },
  speed: { label: 'mph', toDisplay: (v) => v * 2.23694, fromDisplay: (v) => v / 2.23694, digits: 0 },
  distance: { label: 'mi', toDisplay: (v) => v * 0.621371, fromDisplay: (v) => v / 0.621371, digits: 1 },
  climb: { label: 'ft/s', toDisplay: (v) => v * 3.28084, fromDisplay: (v) => v / 3.28084, digits: 1 },
};

export function unit(system: UnitSystem, q: Quantity): UnitDef {
  const def = (system === 'metric' ? METRIC : IMPERIAL)[q];
  return { ...def, label: t(def.label) };
}

export function fmtNum(v: number, digits = 0): string {
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmt(system: UnitSystem, q: Quantity, v: number, digits?: number): string {
  const u = unit(system, q);
  return `${fmtNum(u.toDisplay(v), digits ?? u.digits)} ${u.label}`;
}

/** Total thrust is easier to read in kg / lbf once it gets large. */
export function fmtThrust(system: UnitSystem, grams: number): string {
  if (system === 'imperial') return fmt(system, 'thrust', grams);
  return grams >= 10000 ? `${fmtNum(grams / 1000, 2)} ${t('kg')}` : `${fmtNum(grams)} ${t('g')}`;
}
