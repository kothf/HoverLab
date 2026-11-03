import { BUILTIN, type ComponentKind, type Library } from '../data/components';
import type { Config } from '../engine/types';

const KEYS = {
  configs: 'hoverlab.configs.v1',
  custom: 'hoverlab.library.v1',
  current: 'hoverlab.current.v1',
  prefs: 'hoverlab.prefs.v1',
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode, quota) — the app keeps working in memory */
  }
}

export const loadSavedConfigs = () => read<Config[]>(KEYS.configs, []);
export const storeSavedConfigs = (c: Config[]) => write(KEYS.configs, c);
export const loadCurrent = () => read<Config | null>(KEYS.current, null);
export const storeCurrent = (c: Config) => write(KEYS.current, c);

export interface Prefs {
  units: 'metric' | 'imperial';
  theme: 'dark' | 'light';
}
export const loadPrefs = (): Prefs => read<Prefs>(KEYS.prefs, { units: 'metric', theme: 'dark' });
export const storePrefs = (p: Prefs) => write(KEYS.prefs, p);

export function emptyLibrary(): Library {
  return { motor: [], prop: [], battery: [], esc: [], frame: [] };
}

export const loadCustomLibrary = () => ({ ...emptyLibrary(), ...read<Partial<Library>>(KEYS.custom, {}) });
export const storeCustomLibrary = (l: Library) => write(KEYS.custom, l);

export function mergedLibrary(custom: Library): Library {
  const out = emptyLibrary();
  for (const k of Object.keys(out) as ComponentKind[]) {
    (out[k] as unknown[]) = [...custom[k].map((x) => ({ ...x, custom: true })), ...BUILTIN[k]];
  }
  return out;
}

/** Validate an imported JSON component database; unknown or malformed entries are dropped. */
export function parseLibraryJson(text: string): { library: Library; count: number; skipped: number } {
  const data = JSON.parse(text) as Partial<Record<ComponentKind, unknown[]>>;
  const lib = emptyLibrary();
  let count = 0;
  let skipped = 0;
  const required: Record<ComponentKind, string[]> = {
    motor: ['kv', 'rm', 'i0', 'weight'],
    prop: ['diameter', 'pitch', 'blades'],
    battery: ['capacity', 'cRating', 'weight'],
    esc: ['maxCurrent', 'weight'],
    frame: ['weight', 'maxPropIn'],
  };
  for (const k of Object.keys(lib) as ComponentKind[]) {
    for (const item of data[k] ?? []) {
      const it = item as Record<string, unknown>;
      const ok =
        it && typeof it.model === 'string' && required[k].every((f) => typeof it[f] === 'number' && (it[f] as number) > 0);
      if (!ok) {
        skipped++;
        continue;
      }
      (lib[k] as unknown[]).push({ brand: 'Custom', id: `${k}-${crypto.randomUUID?.() ?? Date.now() + Math.random()}`, ...it });
      count++;
    }
  }
  return { library: lib, count, skipped };
}
