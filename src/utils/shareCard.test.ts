import { describe, expect, it } from 'vitest';
import { cardStats } from './shareCard';

describe('cardStats', () => {
  it('formats the four stat tiles', () => {
    const base = { name: 'Shadow', rank: 'C', level: 7, xp: 21450, streak: 1, weeklyXp: 1230, modules: [], url: 'https://x' };
    expect(cardStats(base)).toEqual([
      { label: 'LEVEL', value: '7' },
      { label: 'TOTAL XP', value: '21,450' },
      { label: 'STREAK', value: '1 day' },
      { label: 'THIS WEEK', value: '+1,230 XP' },
    ]);
    expect(cardStats({ ...base, streak: 12 })[2].value).toBe('12 days');
  });
});
