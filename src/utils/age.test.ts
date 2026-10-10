import { describe, it, expect } from 'vitest';
import { ageFromBirthMonth, classifyBirthMonth, looksLikeEmail } from './age';

const NOW = new Date('2026-10-10T12:00:00Z');

describe('sign-up age helpers (mirror server/src/age.ts)', () => {
  it('assumes the youngest possible age until the birth month is over', () => {
    expect(ageFromBirthMonth('2008-10', NOW)).toBe(17);
    expect(ageFromBirthMonth('2008-09', NOW)).toBe(18);
    expect(ageFromBirthMonth('2013-10', NOW)).toBe(12);
    expect(ageFromBirthMonth('2013-09', NOW)).toBe(13);
  });
  it('classifies the three bands', () => {
    expect(classifyBirthMonth('2015-01', NOW)).toBe('blocked');
    expect(classifyBirthMonth('2010-01', NOW)).toBe('minor');
    expect(classifyBirthMonth('1999-01', NOW)).toBe('adult');
  });
  it('rejects nonsense and the future', () => {
    for (const bad of ['', '2010', '2010-13', '2027-01', '1800-01', 'abc']) expect(classifyBirthMonth(bad, NOW)).toBeNull();
  });
  it('checks emails loosely', () => {
    expect(looksLikeEmail('mum@example.com')).toBe(true);
    expect(looksLikeEmail('mum@example')).toBe(false);
  });
});
