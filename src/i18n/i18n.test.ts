import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HELP } from '../ui/help';
import { HE, HELP_HE } from './he';
import { DICTIONARIES, format, t, tName } from './index';
import { HELP_RU, RU } from './ru';

const SRC = join(__dirname, '..');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === 'i18n' ? [] : files(p);
    return /\.tsx?$/.test(f) && !f.endsWith('.test.ts') && f !== 'help.ts' ? [p] : [];
  });
}

const unescape = (s: string) => s.replace(/\\(['"])/g, '$1');

/** Every English string the UI translates: t()/tr() literals, labels, titles, engine messages, presets and notes. */
function usedKeys(): Set<string> {
  const keys = new Set<string>();
  const grab = (s: string, re: RegExp, group = 1) => {
    for (const m of s.matchAll(re)) keys.add(unescape(m[group]));
  };
  for (const f of files(SRC)) {
    const s = readFileSync(f, 'utf8');
    const rel = f.slice(SRC.length + 1).replace(/\\/g, '/');
    grab(s, /\b(?:t|tr)\(\s*(['"])((?:\\.|(?!\1).)*)\1/g, 2);
    grab(s, /tpl: '((?:\\.|[^'])*)'/g);
    grab(s, /add\('[\w-]+', '(?:warn|danger)', '((?:\\.|[^'])*)'/g);
    grab(s, /\b(?:pos|nonNeg)\([^,]+, '([^']+)'\)/g);
    grab(s, /note: '([^']+)'(?! \+)/g);
    if (rel.startsWith('ui/') || rel === 'App.tsx') {
      grab(s, /\b(?:label|title|placeholder|kindLabel|unitLabel)="([^"]+)"/g);
      grab(s, /\b(?:label|title): '([^']+)'/g);
    }
    if (['engine/simulate.ts', 'engine/physics.ts', 'lib/units.ts', 'ui/insights.ts'].includes(rel)) grab(s, /label: '([^']+)'/g);
    if (rel === 'data/presets.ts') {
      grab(s, /preset\(\s*'((?:\\.|[^'])*)'/g);
      grab(s, /name: '((?:\\.|[^'])*)'/g);
    }
    if (rel === 'ui/OptimizerPanel.tsx') grab(s, /\['(\w+)', /g);
  }
  // Built from constants in the data files.
  for (const n of ['Rm, I₀ est. from size/Kv', 'electrical values est. from size/Kv', 'some values est.', 'motor+ESC unit; Rm, I₀ est. from size/Kv']) keys.add(n);
  // Engine status and loads labels shown through t().
  for (const n of ['motors', 'ESCs', 'warn', 'danger', '(edited)']) keys.add(n);
  return keys;
}

// Unit symbols and names that read the same in Hebrew technical text.
const SAME_IN_HE = new Set(['kg', 'g', 'm', 'km', 'km/h', 'm/s', 'oz', 'lbf', 'ft', 'mph', 'mi', 'ft/s', 'mm', 'A', 'W', 'V', 'Wh', 'mAh', 'g/W', 'mΩ', 'kg/m³', 'RPM/V', 'm²', '°C', '°F', '%', 'S', 'C', ': 1', 'LiPo', 'LiHV', 'LiFePO4', 'Li-ion']);
const SAME_IN_RU = new Set(['°C', '°F', '%', 'S', 'C', ': 1', 'LiPo', 'LiHV', 'LiFePO4', 'Li-ion']);

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('translations', () => {
  const keys = usedKeys();

  it('finds the UI strings', () => {
    expect(keys.size).toBeGreaterThan(350);
  });

  it.each([
    ['ru', RU, SAME_IN_RU],
    ['he', HE, SAME_IN_HE],
  ] as const)('%s covers every UI string', (_, dict, same) => {
    const missing = [...keys].filter((k) => !(k in dict) && !same.has(k));
    expect(missing).toEqual([]);
  });

  it.each([
    ['ru', RU],
    ['he', HE],
  ] as const)('%s keeps every placeholder', (_, dict) => {
    const bad = Object.entries(dict).filter(([k, v]) => placeholders(k).join() !== placeholders(v).join());
    expect(bad).toEqual([]);
  });

  it.each([
    ['ru', HELP_RU],
    ['he', HELP_HE],
  ] as const)('%s has help text for every topic', (_, help) => {
    expect(Object.keys(HELP).filter((k) => !help[k])).toEqual([]);
    expect(Object.keys(help).filter((k) => !(k in HELP))).toEqual([]);
  });

  it('translates templates, their string values and edited names', () => {
    expect(t('Hover {v} min', { v: '12.5' }, 'ru')).toBe('Висение 12.5 мин');
    expect(t('The tightest margin is the {part} ({detail}).', { part: 'battery', detail: 'x' }, 'he')).toContain('הסוללה');
    expect(t('Not a key', undefined, 'ru')).toBe('Not a key');
    expect(format('{a}:1', { a: 2 })).toBe('2:1');
    expect(tName('Generic 650 class carbon (edited)', 'ru')).toBe('Типовая карбоновая рама 650 (изменено)');
    expect(Object.keys(DICTIONARIES.en)).toEqual([]);
  });
});
