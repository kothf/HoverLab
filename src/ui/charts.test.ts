import { describe, expect, it } from 'vitest';
import { tickText } from './Charts';

describe('chart tick labels', () => {
  it('rounds long fractions instead of printing every digit', () => {
    expect(tickText(45.52552552552, '%')).toBe('46%');
    expect(tickText(7.552552552, ' g/W')).toBe('7.6 g/W');
    expect(tickText(0.25, ' kg')).toBe('0.25 kg');
    expect(tickText(2200, ' W')).toBe('2,200 W');
    expect(tickText(80, '%')).toBe('80%');
  });
});
