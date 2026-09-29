import { test } from 'node:test';
import assert from 'node:assert';
import { nudgeDue, nudgeMessage, recapDue, recapMessage } from '../push.js';
import { currentStreak } from '../time.js';

test('nudge fires once, at/after 8pm in the hunter’s own timezone', () => {
  const at = new Date('2026-09-29T14:45:00Z'); // 20:15 in Kolkata, 10:45 in New York
  assert.deepStrictEqual(nudgeDue('Asia/Kolkata', null, at), { due: true, today: '2026-09-29' });
  assert.strictEqual(nudgeDue('Asia/Kolkata', '2026-09-29', at).due, false, 'already nudged today');
  assert.strictEqual(nudgeDue('Asia/Kolkata', '2026-09-28', at).due, true);
  assert.strictEqual(nudgeDue('America/New_York', null, at).due, false, 'too early there');
  assert.strictEqual(nudgeDue('Pacific/Kiritimati', null, at).due, false, 'already past midnight → new day, 04:45');
});

test('streak counts back from today, or from yesterday before today’s first quest', () => {
  const days = new Set(['2026-09-26', '2026-09-27', '2026-09-28']);
  assert.strictEqual(currentStreak(days, '2026-09-29'), 3);
  assert.strictEqual(currentStreak(new Set([...days, '2026-09-29']), '2026-09-29'), 4);
  assert.strictEqual(currentStreak(days, '2026-09-30'), 0);
  assert.match(nudgeMessage(3).title, /3-day streak/);
  assert.match(nudgeMessage(0).title, /waiting/);
});

test('weekly recap: Monday 9am+ local, once', () => {
  const mon = new Date('2026-09-28T04:00:00Z'); // Mon 09:30 Kolkata; Sun 21:00 Los Angeles
  assert.deepStrictEqual(recapDue('Asia/Kolkata', null, mon), { due: true, today: '2026-09-28' });
  assert.strictEqual(recapDue('Asia/Kolkata', '2026-09-28', mon).due, false);
  assert.strictEqual(recapDue('America/Los_Angeles', null, mon).due, false, 'still Sunday there');
  assert.strictEqual(recapDue('Asia/Kolkata', null, new Date('2026-09-28T02:00:00Z')).due, false, '07:30 is too early');
  assert.match(recapMessage(340, 2, 5).title, /\+340 XP · #2 of 5 friends/);
  assert.doesNotMatch(recapMessage(340, 1, 1).title, /friends/);
  assert.match(recapMessage(0, 1, 1).title, /new week/);
});
