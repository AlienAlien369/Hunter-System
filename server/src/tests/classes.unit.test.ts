/**
 * Unit tests for class codes and the consistency figures a teacher sees.
 * Run with: npx tsx --test src/tests/classes.unit.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { CODE_LENGTH, consistencyOf, generateJoinCode, normalizeJoinCode, validClassName } from '../classes.js';

describe('join codes', () => {
  it('generates well-formed codes without look-alike characters', () => {
    for (let i = 0; i < 500; i++) {
      const c = generateJoinCode();
      assert.strictEqual(c.length, CODE_LENGTH);
      assert.match(c, /^[A-HJ-NP-Z2-9]+$/, `no O, I, 0 or 1 in ${c}`);
      assert.strictEqual(normalizeJoinCode(c), c);
    }
  });
  it('rarely repeats', () => {
    const seen = new Set(Array.from({ length: 2000 }, generateJoinCode));
    assert.ok(seen.size > 1990);
  });
  it('normalizes what a student types', () => {
    assert.strictEqual(normalizeJoinCode('abc-d e2'), 'ABCDE2');
    assert.strictEqual(normalizeJoinCode(' ab cd e2 '), 'ABCDE2');
  });
  it('rejects anything that is not a code', () => {
    for (const bad of ['', 'ABC', 'ABCDE23', 'ABCDE0', 'ABCDEI', 'ABCDE!', null, undefined, 123456, 'ABCDE2; DROP TABLE']) assert.strictEqual(normalizeJoinCode(bad), null, String(bad));
  });
});

describe('consistency', () => {
  const today = '2026-10-10';
  const day = (n: number) => new Date(Date.parse(`${today}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);
  it('counts active days this week and over four weeks', () => {
    const days = new Set([day(0), day(1), day(2), day(9), day(20), day(27), day(28), day(40)]);
    const k = consistencyOf(days, today);
    assert.deepStrictEqual({ week: k.activeDaysThisWeek, m: k.activeDays28, pct: k.consistencyPct, streak: k.streak, last: k.lastActive }, { week: 3, m: 6, pct: 21, streak: 3, last: today });
  });
  it('is zero for someone who never started', () => {
    assert.deepStrictEqual(consistencyOf(new Set(), today), { streak: 0, activeDaysThisWeek: 0, activeDays28: 0, consistencyPct: 0, lastActive: null });
  });
  it('keeps a streak alive until the end of today', () => {
    assert.strictEqual(consistencyOf(new Set([day(1), day(2)]), today).streak, 2);
    assert.strictEqual(consistencyOf(new Set([day(2), day(3)]), today).streak, 0);
  });
  it('is 100% for four perfect weeks', () => {
    const all = new Set(Array.from({ length: 28 }, (_, i) => day(i)));
    assert.strictEqual(consistencyOf(all, today).consistencyPct, 100);
  });
  it('ignores days in the future', () => {
    const k = consistencyOf(new Set(['2026-10-20', day(0)]), today);
    assert.strictEqual(k.lastActive, today);
  });
});

describe('class names', () => {
  it('trims, collapses spaces and bounds the length', () => {
    assert.strictEqual(validClassName('  JEE   2027  Batch A '), 'JEE 2027 Batch A');
    for (const bad of ['', ' ', 'a', 'x'.repeat(61), null, 5]) assert.strictEqual(validClassName(bad), null, String(bad));
    assert.strictEqual(validClassName('x'.repeat(60))!.length, 60);
  });
});
