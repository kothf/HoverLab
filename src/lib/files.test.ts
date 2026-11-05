import { describe, expect, it } from 'vitest';
import { PRESETS } from '../data/presets';
import { makeBackup, parseHoverLabFile } from './files';

describe('design files', () => {
  it('reads a saved design back', () => {
    const r = parseHoverLabFile(JSON.stringify(PRESETS[0]));
    expect(r?.kind).toBe('design');
    if (r?.kind === 'design') expect(r.config).toEqual(PRESETS[0]);
  });
  it('round-trips a full backup', () => {
    const custom = { motor: [], prop: [], battery: [], esc: [], frame: [] };
    const r = parseHoverLabFile(JSON.stringify(makeBackup(PRESETS[0], PRESETS.slice(1, 3), custom)));
    expect(r?.kind).toBe('backup');
    if (r?.kind === 'backup') {
      expect(r.backup.saved).toHaveLength(2);
      expect(r.backup.current.name).toBe(PRESETS[0].name);
    }
  });
  it('rejects files that are not HoverLab data', () => {
    expect(parseHoverLabFile('not json')).toBeNull();
    expect(parseHoverLabFile('{"a":1}')).toBeNull();
  });
});
