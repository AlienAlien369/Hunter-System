/**
 * Unit tests for launch hardening: origin allowlist and rate limiter.
 * Run with: npx tsx --test src/tests/security.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { isAllowedOrigin, hit, blockedFor, clearKey } from '../middleware/security.js';

describe('origin allowlist', () => {
  it('allows Hunter frontends and this project\'s Vercel previews only', () => {
    assert.ok(isAllowedOrigin('https://hunters-system.vercel.app'));
    assert.ok(isAllowedOrigin('http://localhost:5173'));
    assert.ok(isAllowedOrigin('https://hunter-system-n4398n9zl-lakshyas-projects-c97e54f6.vercel.app'));
    assert.ok(!isAllowedOrigin('https://evil.example'));
    assert.ok(!isAllowedOrigin('https://hunters-system.vercel.app.evil.example'));
    assert.ok(!isAllowedOrigin('https://hunter-system-x-someone-else.vercel.app'));
  });
});

describe('rate limiter', () => {
  it('blocks after max hits within the window and resets afterwards', () => {
    const k = 'test:' + Math.random();
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) assert.strictEqual(hit(k, 3, 60_000, t0), 0);
    assert.strictEqual(blockedFor(k, 3, t0), 60);
    assert.strictEqual(hit(k, 3, 60_000, t0 + 1000), 59);
    assert.strictEqual(blockedFor(k, 3, t0 + 60_000), 0, 'window expired');
    assert.strictEqual(hit(k, 3, 60_000, t0 + 60_000), 0);
    clearKey(k);
    assert.strictEqual(blockedFor(k, 3, t0), 0);
  });
});

describe('JWT secret selection', () => {
  it('prefers JWT_SECRET, else derives from DATABASE_URL, never the old public constant', async () => {
    const { jwtSecret } = await import('../middleware/auth.js');
    const saved = { s: process.env.JWT_SECRET, d: process.env.DATABASE_URL };
    try {
      process.env.JWT_SECRET = 'explicit';
      assert.strictEqual(jwtSecret(), 'explicit');
      delete process.env.JWT_SECRET;
      process.env.DATABASE_URL = 'postgres://u:p@host/db';
      const derived = jwtSecret();
      assert.match(derived, /^[0-9a-f]{64}$/);
      assert.strictEqual(jwtSecret(), derived, 'stable across calls');
      assert.notStrictEqual(derived, 'hunter-system-secret-key-2024');
    } finally {
      if (saved.s === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = saved.s;
      if (saved.d === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = saved.d;
    }
  });
});

describe('leaderboard week boundary', () => {
  it('weeks start Monday 00:00 UTC', async () => {
    const { weekStart } = await import('../routes/leaderboard.js');
    assert.strictEqual(weekStart(new Date('2026-09-28T10:00:00Z')), '2026-09-28'); // Monday
    assert.strictEqual(weekStart(new Date('2026-10-04T23:59:00Z')), '2026-09-28'); // Sunday
    assert.strictEqual(weekStart(new Date('2026-10-05T00:00:00Z')), '2026-10-05'); // next Monday
  });
});

describe('weekly coach', () => {
  it('aggregates week stats per day and area', async () => {
    const { buildWeekStats } = await import('../routes/coach.js');
    const s = buildWeekStats(
      [{ date: '2026-09-28', area: 'routine', xp: 30 }, { date: '2026-09-28', area: 'skincare', xp: 10 }, { date: '2026-09-30', area: 'routine', xp: 20 }],
      [{ title: 'Debugged API', xp: 40 }],
      '2026-09-28', '2026-09-30',
    );
    assert.strictEqual(s.daysElapsed, 3);
    assert.strictEqual(s.activeDays, 2);
    assert.strictEqual(s.xpEarned, 100);
    assert.deepStrictEqual(s.byArea, [{ area: 'Timetable', completions: 2 }, { area: 'Skincare', completions: 1 }]);
    assert.deepStrictEqual(s.byDay.map(d => d.completions), [2, 0, 1]);
  });

  it('writes a grounded rules-based review (and an encouraging one for an empty week)', async () => {
    const { buildWeekStats, rulesReview } = await import('../routes/coach.js');
    const s = buildWeekStats([{ date: '2026-09-28', area: 'routine', xp: 30 }], [], '2026-09-28', '2026-09-29');
    const r = rulesReview(s);
    assert.strictEqual(r.source, 'rules');
    assert.match(r.wins.join(' '), /30 XP/);
    assert.match(r.focus.join(' '), /Tuesday/);
    const empty = rulesReview(buildWeekStats([], [], '2026-09-28', '2026-09-28'));
    assert.match(empty.headline, /quiet week/);
  });
});
