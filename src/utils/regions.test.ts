import { describe, it, expect } from 'vitest';
import { regionName, regionOptions } from './regions';

describe('region options', () => {
  it('lists real countries, sorted, with India and the US present', () => {
    const list = regionOptions('en');
    const codes = list.map(r => r.code);
    expect(codes).toContain('IN');
    expect(codes).toContain('US');
    expect(codes).toContain('AE');
    expect(list.length).toBeGreaterThan(200);
    expect(list.length).toBeLessThan(300);
    const names = list.map(r => r.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
  });
  it('drops codes that are not countries', () => {
    const codes = regionOptions('en').map(r => r.code);
    for (const bad of ['ZZ', 'QQ', 'XX', 'AA']) expect(codes).not.toContain(bad);
  });
  it('names countries in the reader\'s language', () => {
    expect(regionName('en', 'IN')).toBe('India');
    expect(regionName('hi', 'IN')).toBe('भारत');
    expect(regionName('en', null)).toBe('');
  });
});
