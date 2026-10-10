import { describe, it, expect } from 'vitest';
import { looksIndian } from './market';

describe('looksIndian', () => {
  it('recognises India by timezone or by Hindi / en-IN language', () => {
    expect(looksIndian(['en-US'], 'Asia/Kolkata')).toBe(true);
    expect(looksIndian(['en-US'], 'Asia/Calcutta')).toBe(true);
    expect(looksIndian(['hi'], 'Europe/London')).toBe(true);
    expect(looksIndian(['hi-IN'], 'America/New_York')).toBe(true);
    expect(looksIndian(['en-IN'], 'Asia/Dubai')).toBe(true);
  });
  it('does not guess for everyone else', () => {
    expect(looksIndian(['en-US'], 'America/New_York')).toBe(false);
    expect(looksIndian(['en-GB', 'fr'], 'Europe/Paris')).toBe(false);
    expect(looksIndian([], 'UTC')).toBe(false);
    expect(looksIndian(['id-ID'], 'Asia/Jakarta')).toBe(false);
  });
});
