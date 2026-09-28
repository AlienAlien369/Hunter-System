import { describe, expect, it } from 'vitest';
import { msUntil } from './reminders';

describe('msUntil', () => {
  it('returns the delay until HH:MM today, negative once it has passed', () => {
    const now = new Date(2026, 8, 28, 9, 30, 0);
    expect(msUntil('10:00', now)).toBe(30 * 60_000);
    expect(msUntil('09:30', now)).toBe(0);
    expect(msUntil('07:00', now)).toBe(-150 * 60_000);
  });
});
