/**
 * Progress semantics tests
 * Verifies:
 *  - Daily quests reset every day (completion tracked per date)
 *  - DSA (LC-*) marks are permanent
 *  - "Redo all DSA" resets marks but keeps XP and level
 *  - Nutrition marks reset daily, monthly totals persist and reset on the 1st
 *  - Everything is logged in the activity log
 * Run with: node --test (requires the server running on localhost:3000)
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert';

const BASE_URL = 'http://localhost:3000';

async function register(username: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: 'ProgressPass123!' }),
  });
  assert.strictEqual(res.status, 201, `register ${username} failed`);
  const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
  assert.ok(cookie, 'register should set a cookie');
  return cookie;
}

function monthShift(months: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

describe('Progress semantics (daily reset, DSA permanence, nutrition months)', () => {
  const suffix = Date.now();
  let cookie: string;

  before(async () => {
    cookie = await register('prog_user_' + suffix);
  });

  it('daily quest completion is tracked per date and toggles today only', async () => {
    const res = await fetch(`${BASE_URL}/api/quests/DQ-01/complete`, {
      method: 'PATCH',
      headers: { Cookie: cookie },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.action, 'completed');
    assert.strictEqual(data.xpGained, 10);

    // Undo: XP goes back to 0
    const undo = await fetch(`${BASE_URL}/api/quests/DQ-01/complete`, {
      method: 'PATCH',
      headers: { Cookie: cookie },
    });
    assert.strictEqual((await undo.json()).action, 'undone');
    const stats = await (await fetch(`${BASE_URL}/api/stats`, { headers: { Cookie: cookie } })).json();
    assert.strictEqual(stats.user.xp, 0);
  });

  it('DSA marks are permanent: completing once stays done until explicitly toggled', async () => {
    // Complete LC-01 (15 XP)
    const res = await fetch(`${BASE_URL}/api/quests/LC-01/complete`, {
      method: 'PATCH',
      headers: { Cookie: cookie },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual((await res.json()).xpGained, 15);

    // The same PATCH on any later day must NOT create a duplicate or reset it
    // (completion exists regardless of date) — toggling again explicitly undoes it
    let quests = await (await fetch(`${BASE_URL}/api/quests`, { headers: { Cookie: cookie } })).json();
    let lc01 = quests.find((q: any) => q.quest_id === 'LC-01');
    assert.strictEqual(lc01.completions.length, 1);

    // Undo removes the mark and XP
    const undo = await fetch(`${BASE_URL}/api/quests/LC-01/complete`, {
      method: 'PATCH',
      headers: { Cookie: cookie },
    });
    assert.strictEqual((await undo.json()).action, 'undone');
    quests = await (await fetch(`${BASE_URL}/api/quests`, { headers: { Cookie: cookie } })).json();
    lc01 = quests.find((q: any) => q.quest_id === 'LC-01');
    assert.strictEqual(lc01.completions.length, 0);
  });

  it('redo all DSA resets marks but keeps XP and level', async () => {
    // Complete LC-01 (15) and LC-02 (15) = 30 XP
    await fetch(`${BASE_URL}/api/quests/LC-01/complete`, { method: 'PATCH', headers: { Cookie: cookie } });
    await fetch(`${BASE_URL}/api/quests/LC-02/complete`, { method: 'PATCH', headers: { Cookie: cookie } });
    const before = await (await fetch(`${BASE_URL}/api/stats`, { headers: { Cookie: cookie } })).json();
    assert.strictEqual(before.user.xp, 30);

    const redo = await fetch(`${BASE_URL}/api/quests/redo-dsa`, {
      method: 'POST',
      headers: { Cookie: cookie },
    });
    assert.strictEqual(redo.status, 200);
    const redoData = await redo.json();
    assert.strictEqual(redoData.deleted, 2);

    // Marks cleared…
    const quests = await (await fetch(`${BASE_URL}/api/quests`, { headers: { Cookie: cookie } })).json();
    const lc01 = quests.find((q: any) => q.quest_id === 'LC-01');
    const lc02 = quests.find((q: any) => q.quest_id === 'LC-02');
    assert.strictEqual(lc01.completions.length, 0);
    assert.strictEqual(lc02.completions.length, 0);

    // …but XP and level are untouched
    const after = await (await fetch(`${BASE_URL}/api/stats`, { headers: { Cookie: cookie } })).json();
    assert.strictEqual(after.user.xp, 30);
    assert.strictEqual(after.user.rank, before.user.rank);
  });

  it('nutrition: daily marks reset, monthly totals persist and reset on the 1st', async () => {
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = monthShift(0);
    const lastMonth = monthShift(-1);

    // Save today's marks
    const save = await fetch(`${BASE_URL}/api/nutrition/day`, {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: today,
        items: [
          { name: 'Fit Feast Pouch', protein: 20, cost: 60 },
          { name: 'Nandini Milk 500ml', protein: 16.5, cost: 24 },
        ],
      }),
    });
    assert.strictEqual(save.status, 200);

    // Current month shows the entries and totals
    const cur = await (await fetch(`${BASE_URL}/api/nutrition?month=${thisMonth}`, { headers: { Cookie: cookie } })).json();
    assert.strictEqual(cur.entries.length, 2);
    assert.strictEqual(cur.totals.protein, 36.5);
    assert.strictEqual(cur.totals.cost, 84);

    // Re-saving the same day replaces it (daily marks reset)
    const save2 = await fetch(`${BASE_URL}/api/nutrition/day`, {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: today, items: [{ name: 'Fit Feast Pouch', protein: 20, cost: 60 }] }),
    });
    assert.strictEqual(save2.status, 200);
    const cur2 = await (await fetch(`${BASE_URL}/api/nutrition?month=${thisMonth}`, { headers: { Cookie: cookie } })).json();
    assert.strictEqual(cur2.entries.length, 1);
    assert.strictEqual(cur2.totals.protein, 20);

    // A different month is empty — the month resets on the 1st
    const prev = await (await fetch(`${BASE_URL}/api/nutrition?month=${lastMonth}`, { headers: { Cookie: cookie } })).json();
    assert.strictEqual(prev.entries.length, 0);
    assert.strictEqual(prev.totals.protein, 0);
  });

  it('everything is logged in the activity log', async () => {
    const res = await fetch(`${BASE_URL}/api/activity`, { headers: { Cookie: cookie } });
    assert.strictEqual(res.status, 200);
    const log = await res.json();
    const actions = log.map((e: any) => e.action);
    assert.ok(actions.includes('register'));
    assert.ok(actions.includes('quest_complete'));
    assert.ok(actions.includes('quest_undo'));
    assert.ok(actions.includes('dsa_redo'));
    assert.ok(actions.includes('nutrition_update'));
  });
});