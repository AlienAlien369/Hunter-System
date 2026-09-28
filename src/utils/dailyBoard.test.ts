import { describe, expect, it } from 'vitest';
import type { DailyQuest } from '../store/gameStore';
import { dailyBoard } from './dailyBoard';

const q = (id: string, over: Partial<DailyQuest> = {}): DailyQuest =>
  ({ id, title: id, xpReward: 10, category: 'discipline', completedDates: [], ...over });

describe('dailyBoard', () => {
  it('gives new hunters an empty board instead of someone else\'s default routine', () => {
    expect(dailyBoard([q('DQ-01'), q('DQ-02'), q('LC-01')])).toEqual([]);
  });

  it('keeps the default quests for hunters who already use them', () => {
    const board = dailyBoard([q('DQ-01', { completedDates: ['2026-09-01'] }), q('DQ-02'), q('LC-01')]);
    expect(board.map(x => x.id)).toEqual(['DQ-01', 'DQ-02']);
  });

  it('always prefers the hunter\'s own timetable quests', () => {
    const board = dailyBoard([q('DQ-01', { completedDates: ['2026-09-01'] }), q('CQ-9', { category: 'routine' }), q('CQ-10', { category: 'skincare' as DailyQuest['category'] })]);
    expect(board.map(x => x.id)).toEqual(['CQ-9']);
  });
});
