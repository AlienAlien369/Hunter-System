import { describe, it, expect } from 'vitest';
import { THEMES, effectiveTheme, isPremiumTheme } from './themeStore';

const FREE = ['purple-monarch', 'gold', 'crimson'] as const;
const PREMIUM = ['aurora', 'ember', 'glacier', 'sakura'] as const;

describe('themes', () => {
  it('keeps the three original themes and adds four premium ones', () => {
    expect(Object.keys(THEMES).sort()).toEqual([...FREE, ...PREMIUM].sort());
  });
  it('gives every theme the same complete set of colours', () => {
    const keys = Object.keys(THEMES['purple-monarch']).sort();
    for (const [id, t] of Object.entries(THEMES)) expect(Object.keys(t).sort(), id).toEqual(keys);
  });
  it('uses valid, distinct accent colours', () => {
    const accents = Object.values(THEMES).map(t => t.accent);
    for (const a of accents) expect(a).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(new Set(accents).size).toBe(accents.length);
  });
  it('marks only the new themes as premium, so nothing that was free is taken away', () => {
    for (const id of FREE) expect(isPremiumTheme(id)).toBe(false);
    for (const id of PREMIUM) expect(isPremiumTheme(id)).toBe(true);
  });
});

describe('effectiveTheme', () => {
  it('shows free themes to everyone', () => {
    for (const id of FREE) expect(effectiveTheme(id, false, true)).toBe(id);
  });
  it('shows premium themes to Pro hunters', () => {
    expect(effectiveTheme('aurora', true, true)).toBe('aurora');
  });
  it('falls back to the default when Pro has lapsed', () => {
    expect(effectiveTheme('sakura', false, true)).toBe('purple-monarch');
  });
  it('does not flash the default while billing is still loading', () => {
    expect(effectiveTheme('ember', false, false)).toBe('ember');
  });
  it('recovers from an unknown saved theme', () => {
    expect(effectiveTheme('nope' as never, true, true)).toBe('purple-monarch');
  });
});
