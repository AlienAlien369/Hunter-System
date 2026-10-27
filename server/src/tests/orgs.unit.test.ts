/**
 * Unit tests for institutions (B2B), the weekly report and platform settings:
 * permissions, plan/seat status, the institution progress figures, report
 * scopes and rendering, unsubscribe tokens and settings validation.
 * Run with: npx tsx --test src/tests/orgs.unit.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { can, dayCode, memberProgress, orgPlanStatus, sanitizeOrgTask, scheduledOn, seatAvailable, taskSince, validOrgKind, validOrgName } from '../orgs.js';
import { renderOrgWeekly, renderWeekly, reportDue, sectionsFor, unsubscribeToken, verifyUnsubscribeToken, type WeeklyData } from '../reports.js';
import { DEFAULT_SETTINGS, mergeSettings } from '../platform.js';
import { taskXp } from '../rules.js';
import { productName } from '../payments/types.js';
import { entitlementOf } from '../billing.js';

const NOW = new Date('2026-10-25T12:00:00Z');
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

describe('institution permissions', () => {
  it('lets staff manage the timetable and see members, never students', () => {
    for (const r of ['admin', 'teacher']) { assert.ok(can.manageTasks(r)); assert.ok(can.viewMembers(r)); assert.ok(can.addGuardian(r)); }
    for (const r of ['student', null, undefined, 'owner']) { assert.ok(!can.manageTasks(r)); assert.ok(!can.viewMembers(r)); }
  });
  it('keeps settings, roles and billing with admins', () => {
    assert.ok(can.editSettings('admin') && can.changeRoles('admin') && can.manageBilling('admin'));
    assert.ok(!can.editSettings('teacher') && !can.changeRoles('teacher') && !can.manageBilling('teacher'));
  });
  it('lets admins remove anyone but admins, and teachers only students', () => {
    assert.ok(can.removeMember('admin', 'teacher') && can.removeMember('admin', 'student'));
    assert.ok(!can.removeMember('admin', 'admin'));
    assert.ok(can.removeMember('teacher', 'student'));
    assert.ok(!can.removeMember('teacher', 'teacher') && !can.removeMember('teacher', 'admin'));
    assert.ok(!can.removeMember('student', 'student'));
  });
});

describe('institution names and kinds', () => {
  it('normalizes names and rejects markup', () => {
    assert.strictEqual(validOrgName('  Sunrise   Public  School '), 'Sunrise Public School');
    for (const bad of ['', 'x', 'a'.repeat(81), '<b>x</b>', null, 42]) assert.strictEqual(validOrgName(bad), null, String(bad));
  });
  it('knows the kinds', () => {
    assert.strictEqual(validOrgKind('coaching'), 'coaching');
    assert.strictEqual(validOrgKind('casino'), null);
  });
});

describe('core tasks', () => {
  it('derives XP from difficulty so staff cannot inflate the ledger', () => {
    const t = sanitizeOrgTask({ title: ' Physics revision ', difficulty: 3, xpReward: 99999, scheduleTime: '07:00', recurrence: ['MON', 'WED'] });
    assert.ok(typeof t !== 'string');
    assert.deepStrictEqual(t, { title: 'Physics revision', description: null, difficulty: 3, xpReward: taskXp(3), scheduleTime: '07:00', recurrence: ['MON', 'WED'] });
  });
  it('treats every day as daily and rejects bad input', () => {
    const t = sanitizeOrgTask({ title: 'Read', difficulty: 1, recurrence: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] });
    assert.ok(typeof t !== 'string' && t.recurrence === null);
    assert.strictEqual(typeof sanitizeOrgTask({ title: '', difficulty: 1 }), 'string');
    assert.strictEqual(typeof sanitizeOrgTask({ title: 'x', difficulty: 9 }), 'string');
    assert.strictEqual(typeof sanitizeOrgTask({ title: 'x', difficulty: 1, scheduleTime: '25:00' }), 'string');
    assert.strictEqual(typeof sanitizeOrgTask({ title: 'x', difficulty: 1, recurrence: [] }), 'string');
  });
  it('knows which days a task is scheduled', () => {
    assert.strictEqual(dayCode('2026-10-26'), 'MON');
    assert.strictEqual(dayCode('2026-10-25'), 'SUN');
    assert.ok(scheduledOn(null, '2026-10-25'));
    assert.ok(scheduledOn(['MON'], '2026-10-26'));
    assert.ok(!scheduledOn(['MON'], '2026-10-25'));
  });
});

describe('institution plan and seats', () => {
  it('starts with the trial grant', () => {
    const p = orgPlanStatus({ seats: 30, planUntil: days(10) }, [], NOW);
    assert.deepStrictEqual({ a: p.active, s: p.seats, t: p.trial }, { a: true, s: 30, t: true });
  });
  it('switches off when the trial ends and nothing is paid', () => {
    const p = orgPlanStatus({ seats: 30, planUntil: days(-1) }, [], NOW);
    assert.deepStrictEqual({ a: p.active, s: p.seats }, { a: false, s: 0 });
  });
  it('uses paid seats once they cover the grant', () => {
    const p = orgPlanStatus({ seats: 30, planUntil: days(10) }, [{ seats: 120, currentPeriodEnd: days(365), live: true }], NOW);
    assert.deepStrictEqual({ a: p.active, s: p.seats, t: p.trial }, { a: true, s: 120, t: false });
  });
  it('adds up several live seat subscriptions and ignores dead ones', () => {
    const p = orgPlanStatus({ seats: 0, planUntil: null }, [
      { seats: 50, currentPeriodEnd: days(200), live: true },
      { seats: 25, currentPeriodEnd: days(300), live: true },
      { seats: 999, currentPeriodEnd: days(-3), live: false },
    ], NOW);
    assert.strictEqual(p.seats, 75);
  });
  it('fills seats with students only', () => {
    const p = orgPlanStatus({ seats: 2, planUntil: days(5) }, [], NOW);
    assert.ok(seatAvailable(p, 1));
    assert.ok(!seatAvailable(p, 2));
    assert.ok(!seatAvailable(orgPlanStatus({ seats: 2, planUntil: days(-5) }, [], NOW), 0));
  });
  it('gives members of an active institution Pro, never over a personal subscription', () => {
    const until = days(30);
    assert.deepStrictEqual(entitlementOf({ subscriptions: [], org: { active: true, until } }, NOW), { plan: 'pro', source: 'org', until });
    assert.strictEqual(entitlementOf({ subscriptions: [], org: { active: false, until: null } }, NOW).plan, 'free');
    const own = entitlementOf({ subscriptions: [{ status: 'active', current_period_end: days(100) }], org: { active: true, until } }, NOW);
    assert.strictEqual(own.source, 'subscription');
  });
});

describe('institution progress', () => {
  const today = '2026-10-25'; // Sunday
  it('measures completion against what was actually scheduled', () => {
    // One daily task for 7 days, done on 5 of them.
    const tasks = [{ id: 1, recurrence: null, since: '2026-01-01' }];
    const comps = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-23', '2026-10-25'].map(date => ({ date, taskId: 1 }));
    const p = memberProgress(comps, tasks, today, 7);
    assert.deepStrictEqual(p, { activeDays7: 5, activeDays28: 5, completionPct: 71, lastActive: '2026-10-25' });
  });
  it('does not count days before a task existed, or days it is not scheduled', () => {
    const tasks = [{ id: 1, recurrence: ['MON'], since: '2026-01-01' }, { id: 2, recurrence: null, since: '2026-10-24' }];
    // Scheduled in 7 days: task1 on Mon 19th = 1; task2 on 24th, 25th = 2 → 3.
    const p = memberProgress([{ date: '2026-10-19', taskId: 1 }, { date: '2026-10-25', taskId: 2 }], tasks, today, 7);
    assert.strictEqual(p.completionPct, 67);
  });
  it('starts a task on its local day, so one made just after midnight in India is not missed the day before', () => {
    // 18:40 UTC on the 27th is 00:10 on the 28th in India.
    const since = taskSince('2026-10-27T18:40:00Z', 'Asia/Kolkata');
    assert.strictEqual(since, '2026-10-28');
    const p = memberProgress([{ date: '2026-10-28', taskId: 1 }], [{ id: 1, recurrence: null, since }], '2026-10-28', 7);
    assert.strictEqual(p.completionPct, 100);
  });
  it('reports nothing scheduled as null, not 0%', () => {
    assert.strictEqual(memberProgress([], [], today).completionPct, null);
  });
  it('ignores completions outside the window', () => {
    const p = memberProgress([{ date: '2026-01-01', taskId: 1 }, { date: '2026-11-01', taskId: 1 }], [{ id: 1, recurrence: null, since: '2025-01-01' }], today, 7);
    assert.deepStrictEqual({ d: p.activeDays7, pct: p.completionPct, last: p.lastActive }, { d: 0, pct: 0, last: '2026-01-01' });
  });
});

describe('weekly report', () => {
  const b2c: WeeklyData = {
    name: 'Asha', from: '2026-10-19', to: '2026-10-25',
    personal: { xpGained: 140, xp: 900, level: 2, rank: 'D', tasksDone: 9, activeDays: 5, streak: 3 },
    org: null,
  };
  const b2b: WeeklyData = { ...b2c, org: { name: 'Sunrise School', xpGained: 220, xp: 1500, level: 2, rank: 'C', tasksDone: 14, completionPct: 80, activeDays: 6 } };

  it('shows each recipient only the part its scope allows', () => {
    assert.deepStrictEqual(sectionsFor(b2b, 'both'), { personal: true, org: true });
    assert.deepStrictEqual(sectionsFor(b2b, 'org'), { personal: false, org: true });
    assert.deepStrictEqual(sectionsFor(b2b, 'personal'), { personal: true, org: false });
    // Individuals have no institution part.
    assert.deepStrictEqual(sectionsFor(b2c, 'both'), { personal: true, org: false });
    assert.deepStrictEqual(sectionsFor(b2c, 'org'), { personal: false, org: false });
  });
  it('keeps personal numbers out of an institution-only email', () => {
    const m = renderWeekly(b2b, 'org', { brand: 'Acme Study' });
    assert.match(m.text, /Institution XP this week: \+220/);
    assert.doesNotMatch(m.text, /Personal XP/);
    assert.doesNotMatch(m.html, /Personal/);
  });
  it('separates the two ledgers when both are sent', () => {
    const m = renderWeekly(b2b, 'both', { brand: 'Acme Study', unsubscribeUrl: 'https://x.test/u?token=1.abc' });
    assert.match(m.text, /INSTITUTION — Sunrise School/);
    assert.match(m.text, /PERSONAL GROWTH/);
    assert.match(m.subject, /Asha's weekly report .* Acme Study/);
    assert.match(m.text, /Stop these emails: https:\/\/x\.test\/u\?token=1\.abc/);
  });
  it('uses the dynamic brand name and escapes names in HTML', () => {
    const m = renderWeekly({ ...b2c, name: '<script>x</script>' }, 'both', { brand: 'Brand & Co' });
    assert.ok(!m.html.includes('<script>x'));
    assert.match(m.html, /Brand &amp; Co/);
  });
  it('summarises an institution, flagging inactive students', () => {
    const m = renderOrgWeekly({
      name: 'Sunrise School', from: '2026-10-19', to: '2026-10-25',
      students: [
        { name: 'A', xpGained: 50, level: 1, completionPct: 60, activeDays: 4 },
        { name: 'B', xpGained: 0, level: 1, completionPct: 0, activeDays: 0 },
      ],
    }, { brand: 'Acme Study' });
    assert.match(m.text, /Students: 2 · active this week: 1 · average core-timetable completion: 30%/);
    assert.match(m.text, /Not active this week: B/);
  });
});

describe('unsubscribe tokens', () => {
  it('round-trips and rejects tampering', () => {
    const t = unsubscribeToken(42);
    assert.strictEqual(verifyUnsubscribeToken(t), 42);
    assert.strictEqual(verifyUnsubscribeToken(t.replace(/^42/, '43')), null);
    assert.strictEqual(verifyUnsubscribeToken(`${t}x`), null);
    for (const bad of ['', '42', '42.', 'x.y', null, 7]) assert.strictEqual(verifyUnsubscribeToken(bad), null, String(bad));
  });
});

describe('report schedule', () => {
  it('is due on Sunday evening in the hunter\'s own timezone', () => {
    // 2026-10-25 is a Sunday. 12:30 UTC = 18:00 in India.
    assert.deepStrictEqual(reportDue('Asia/Kolkata', new Date('2026-10-25T12:30:00Z')), { due: true, weekEnd: '2026-10-25' });
    assert.strictEqual(reportDue('Asia/Kolkata', new Date('2026-10-25T12:00:00Z')).due, false);
    assert.strictEqual(reportDue('Asia/Kolkata', new Date('2026-10-26T04:00:00Z')).due, false);
    assert.strictEqual(reportDue('America/New_York', new Date('2026-10-25T12:30:00Z')).due, false);
  });
  it('falls back to India time for unknown zones', () => {
    assert.strictEqual(reportDue('Mars/Base', new Date('2026-10-25T12:30:00Z')).due, true);
  });
});

describe('platform settings', () => {
  it('defaults to ₹600 a year for individuals and per institution seat', () => {
    assert.strictEqual(DEFAULT_SETTINGS.proYearInr, 60000);
    assert.strictEqual(DEFAULT_SETTINGS.orgSeatYearInr, 60000);
  });
  it('renames the product and changes prices', () => {
    const s = mergeSettings(DEFAULT_SETTINGS, { brandName: '  Study   Quest ', proYearInr: 70000, orgTrialDays: 14 });
    assert.ok(typeof s !== 'string');
    assert.deepStrictEqual({ n: s.brandName, p: s.proYearInr, t: s.orgTrialDays, seat: s.orgSeatYearInr }, { n: 'Study Quest', p: 70000, t: 14, seat: 60000 });
  });
  it('rejects bad values without changing anything', () => {
    for (const patch of [
      { brandName: 'x' }, { brandName: 'a'.repeat(41) }, { brandName: '<img>' }, { supportEmail: 'nope' },
      { proYearInr: 5 }, { proYearInr: 12.5 }, { proYearInr: '60000' }, { orgTrialDays: 400 }, { orgTrialSeats: -1 },
    ]) assert.strictEqual(typeof mergeSettings(DEFAULT_SETTINGS, patch), 'string', JSON.stringify(patch));
  });
  it('names checkout products after the brand', () => {
    assert.strictEqual(productName('Study Quest', 'pro'), 'Study Quest Pro');
    assert.strictEqual(productName('Study Quest', 'teams'), 'Study Quest Institution seats');
  });
});
