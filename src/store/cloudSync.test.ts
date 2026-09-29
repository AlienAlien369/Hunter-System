import { describe, expect, it } from 'vitest';
import { mergeCloudState, useGameStore } from './gameStore';

describe('game progress persistence', () => {
  it('merges the cloud copy: unlocks union, inventory/loadout/freezes from the server', () => {
    const merged = mergeCloudState(
      { inventory: [], freezeCount: 0, freezeDates: ['2026-09-01'], unlockedTitles: ['A'], unlockedAchievements: ['x'] },
      { inventory: [{ itemId: 'potion', instanceId: 'p1' }], freezeCount: 2, freezeDates: ['2026-09-02'], unlockedTitles: ['B', 'A'] },
    );
    expect(merged.inventory).toHaveLength(1);
    expect(merged.freezeCount).toBe(2);
    expect(merged.freezeDates).toEqual(['2026-09-01', '2026-09-02']);
    expect(merged.unlockedTitles).toEqual(['A', 'B']);
    expect(merged.unlockedAchievements).toEqual(['x']);
  });

  it('a partial save keeps the other persisted keys', () => {
    useGameStore.setState({ unlockedTitles: ['Shadow Monarch'], freezeCount: 3 });
    useGameStore.getState().addItem('health_potion'); // saves only { inventory }
    const saved = JSON.parse(localStorage.getItem('hunter_system_v1') ?? '{}');
    expect(saved.inventory).toHaveLength(1);
    expect(saved.unlockedTitles).toEqual(['Shadow Monarch']);
    expect(saved.freezeCount).toBe(3);
  });
});
