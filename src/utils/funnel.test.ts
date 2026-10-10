import { describe, it, expect } from 'vitest';
import { funnelSteps, fmtPct } from './funnel';
import { trackingOptedOut } from '../lib/track';

const row = { region: 'ALL', signups: 100, timetable: 60, firstQuest: 40, d7Eligible: 50, d7Returned: 10, upgraded: 3 };

describe('funnelSteps', () => {
  it('computes step-to-step and overall conversion', () => {
    const s = funnelSteps(row);
    expect(s.map(x => x.count)).toEqual([100, 60, 40, 10, 3]);
    expect(s[1].fromPrev).toBeCloseTo(0.6);
    expect(s[2].fromPrev).toBeCloseTo(40 / 60);
    expect(s[2].ofSignups).toBeCloseTo(0.4);
  });
  it('measures day 7 against hunters old enough to have had a day 7', () => {
    const d7 = funnelSteps(row)[3];
    expect(d7.fromPrev).toBeCloseTo(10 / 50);
    expect(d7.note).toBe('of 50 signed up 7+ days ago');
  });
  it('measures upgrades against signups', () => {
    expect(funnelSteps(row)[4].fromPrev).toBeCloseTo(0.03);
  });
  it('never divides by zero', () => {
    const s = funnelSteps({ ...row, signups: 0, timetable: 0, firstQuest: 0, d7Eligible: 0, d7Returned: 0, upgraded: 0 });
    expect(s.every(x => x.fromPrev === null && x.ofSignups === null)).toBe(true);
    expect(fmtPct(null)).toBe('—');
    expect(fmtPct(0.1234)).toBe('12.3%');
  });
});

describe('trackingOptedOut', () => {
  it('honors Do Not Track and Global Privacy Control', () => {
    expect(trackingOptedOut({ doNotTrack: '1' })).toBe(true);
    expect(trackingOptedOut({ doNotTrack: null, globalPrivacyControl: true })).toBe(true);
    expect(trackingOptedOut({ doNotTrack: '0' })).toBe(false);
    expect(trackingOptedOut({ doNotTrack: null })).toBe(false);
  });
});
