import { createHmac, timingSafeEqual } from 'crypto';
import { pool } from './db.js';
import { jwtSecret } from './middleware/auth.js';
import { addDays, currentStreak, isValidTimeZone, localDate } from './time.js';
import { calculateLevel, calculateRank } from './progression.js';
import { activeDays } from './routes/stats.js';
import { appUrl, mailConfigured, sendMail } from './mailer.js';
import { brandName } from './platform.js';
import { memberProgress, taskSince } from './orgs.js';

// Weekly progress reports by email: for parents, teachers, family or friends a
// hunter chooses, and for the guardian emails an institution adds. Each
// recipient gets the part of the report its scope allows:
//   'org'      — institution progress only (what staff may see anyway)
//   'personal' — the hunter's own modules and timetable only
//   'both'     — both, clearly separated
// Individuals (B2C) have only the personal part.

export const RELATIONS = ['parent', 'guardian', 'teacher', 'family', 'friend', 'mentor', 'self', 'other'] as const;
export type Relation = (typeof RELATIONS)[number];
export const SCOPES = ['both', 'org', 'personal'] as const;
export type Scope = (typeof SCOPES)[number];

export const MAX_RECIPIENTS = 10;
/** Reports go out on Sunday evening in the hunter's timezone. */
export const REPORT_WEEKDAY = 0;
export const REPORT_HOUR = 18;
export const DEFAULT_TZ = 'Asia/Kolkata';

export interface WeeklyData {
  name: string;
  from: string;
  to: string;
  personal: { xpGained: number; xp: number; level: number; rank: string; tasksDone: number; activeDays: number; streak: number };
  org: null | { name: string; xpGained: number; xp: number; level: number; rank: string; tasksDone: number; completionPct: number | null; activeDays: number };
}

// ── Unsubscribe tokens: HMAC over the recipient id, so nothing secret is stored.

const sign = (id: number) => createHmac('sha256', `report-unsub:${jwtSecret()}`).update(String(id)).digest('base64url').slice(0, 32);
export const unsubscribeToken = (recipientId: number) => `${recipientId}.${sign(recipientId)}`;

/** The recipient id a token belongs to, or null if it was not issued by us. */
export function verifyUnsubscribeToken(token: unknown): number | null {
  if (typeof token !== 'string') return null;
  const [rawId, mac] = token.split('.');
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0 || !mac) return null;
  const expected = Buffer.from(sign(id));
  const got = Buffer.from(mac);
  return expected.length === got.length && timingSafeEqual(expected, got) ? id : null;
}

export const unsubscribeUrl = (recipientId: number) =>
  `${appUrl()}/api/public/report-unsubscribe?token=${encodeURIComponent(unsubscribeToken(recipientId))}`;

// ── Data ────────────────────────────────────────────────────────────────────

/** The week ending `to` (inclusive, 7 days, calendar days in `tz`) for one hunter. */
export async function computeWeekly(userId: number, to: string, tz = DEFAULT_TZ): Promise<WeeklyData | null> {
  const from = addDays(to, -6);
  const u = (await pool.query('SELECT name, xp FROM users WHERE id = $1', [userId])).rows[0];
  if (!u) return null;
  const [personal, days, member] = await Promise.all([
    pool.query(
      `SELECT COALESCE(SUM(xp), 0)::int AS xp, COUNT(*) FILTER (WHERE kind = 'q')::int AS done, COUNT(DISTINCT d) FILTER (WHERE kind = 'q')::int AS days FROM (
         SELECT 'q' AS kind, completion_date AS d, COALESCE(xp_awarded, 0) AS xp FROM quest_completions WHERE user_id = $1 AND completion_date BETWEEN $2::date AND $3::date
         UNION ALL
         SELECT 'u', resolved_at::date, COALESCE(xp_awarded, 0) FROM unplanned_activities WHERE user_id = $1 AND status = 'accepted' AND resolved_at::date BETWEEN $2::date AND $3::date
       ) e`, [userId, from, to]),
    activeDays(userId),
    pool.query(
      `SELECT m.org_id, m.xp, o.name FROM org_members m JOIN organizations o ON o.id = m.org_id WHERE m.user_id = $1 AND NOT o.archived`, [userId]),
  ]);
  let org: WeeklyData['org'] = null;
  const m = member.rows[0];
  if (m) {
    const [comps, tasks] = await Promise.all([
      pool.query(
        `SELECT task_id, completion_date::text AS d, xp_awarded FROM org_task_completions
         WHERE user_id = $1 AND org_id = $2 AND completion_date BETWEEN $3::date AND $4::date`, [userId, m.org_id, from, to]),
      pool.query(`SELECT id, recurrence, created_at FROM org_tasks WHERE org_id = $1 AND NOT archived`, [m.org_id]),
    ]);
    const p = memberProgress(
      comps.rows.map((c: any) => ({ date: c.d, taskId: c.task_id })),
      tasks.rows.map((t: any) => ({ id: t.id, recurrence: t.recurrence, since: taskSince(t.created_at, tz) })),
      to, 7,
    );
    org = {
      name: m.name, xp: m.xp, level: calculateLevel(m.xp), rank: calculateRank(m.xp),
      xpGained: comps.rows.reduce((s: number, c: any) => s + c.xp_awarded, 0),
      tasksDone: comps.rows.length, completionPct: p.completionPct, activeDays: p.activeDays7,
    };
  }
  return {
    name: u.name, from, to,
    personal: {
      xpGained: personal.rows[0].xp, xp: u.xp, level: calculateLevel(u.xp), rank: calculateRank(u.xp),
      tasksDone: personal.rows[0].done, activeDays: personal.rows[0].days, streak: currentStreak(days, to),
    },
    org,
  };
}

// ── Rendering (pure; unit-tested) ───────────────────────────────────────────

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const fmtDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** What a recipient with this scope may see. Individuals have no institution part. */
export function sectionsFor(data: WeeklyData, scope: Scope): { personal: boolean; org: boolean } {
  return {
    personal: scope !== 'org',
    org: scope !== 'personal' && !!data.org,
  };
}

export function renderWeekly(data: WeeklyData, scope: Scope, opts: { brand: string; unsubscribeUrl?: string; appLink?: string }) {
  const show = sectionsFor(data, scope);
  const range = `${fmtDay(data.from)} – ${fmtDay(data.to)}`;
  const subject = `${data.name}'s weekly report · ${range} · ${opts.brand}`;
  const lines: string[] = [`Weekly report for ${data.name}`, range, ''];
  const blocks: string[] = [];
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 0;color:#6b7280">${esc(label)}</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#111827">${esc(value)}</td></tr>`;
  const card = (title: string, rows: [string, string][]) =>
    `<div style="border:1px solid #e5e7eb;border-radius:12px;padding:16px 20px;margin:16px 0"><h2 style="margin:0 0 8px;font-size:16px;color:#4c1d95">${esc(title)}</h2><table style="width:100%;border-collapse:collapse;font-size:14px">${rows.map(([l, v]) => row(l, v)).join('')}</table></div>`;

  if (show.org && data.org) {
    const o = data.org;
    const rows: [string, string][] = [
      ['Institution XP this week', `+${o.xpGained}`],
      ['Core tasks completed', String(o.tasksDone)],
      ['Core timetable followed', o.completionPct === null ? 'No tasks scheduled' : `${o.completionPct}%`],
      ['Active days', `${o.activeDays} of 7`],
      ['Institution level', `Level ${o.level} · Rank ${o.rank}`],
    ];
    lines.push(`INSTITUTION — ${o.name}`, ...rows.map(([l, v]) => `  ${l}: ${v}`), '');
    blocks.push(card(`Institution · ${o.name}`, rows));
  }
  if (show.personal) {
    const p = data.personal;
    const rows: [string, string][] = [
      ['Personal XP this week', `${p.xpGained >= 0 ? '+' : ''}${p.xpGained}`],
      ['Personal tasks completed', String(p.tasksDone)],
      ['Active days', `${p.activeDays} of 7`],
      ['Current streak', `${p.streak} day${p.streak === 1 ? '' : 's'}`],
      ['Personal level', `Level ${p.level} · Rank ${p.rank}`],
    ];
    lines.push(data.org ? 'PERSONAL GROWTH' : 'PROGRESS', ...rows.map(([l, v]) => `  ${l}: ${v}`), '');
    blocks.push(card(data.org ? 'Personal growth' : 'Progress', rows));
  }
  const footer = `You receive this because ${data.name} (or their institution) added your email to their ${opts.brand} weekly report.`;
  lines.push(footer);
  if (opts.unsubscribeUrl) lines.push(`Stop these emails: ${opts.unsubscribeUrl}`);
  const html = `<!doctype html><html><body style="margin:0;background:#f9fafb;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:24px">
<p style="margin:0;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#7c3aed">${esc(opts.brand)}</p>
<h1 style="margin:4px 0 0;font-size:22px;color:#111827">Weekly report for ${esc(data.name)}</h1>
<p style="margin:4px 0 0;color:#6b7280;font-size:14px">${esc(range)}</p>
${blocks.join('\n')}
${opts.appLink ? `<p style="margin:16px 0"><a href="${esc(opts.appLink)}" style="color:#7c3aed">Open ${esc(opts.brand)}</a></p>` : ''}
<p style="margin:24px 0 0;font-size:12px;color:#9ca3af">${esc(footer)}${opts.unsubscribeUrl ? ` <a href="${esc(opts.unsubscribeUrl)}" style="color:#9ca3af">Unsubscribe</a>.` : ''}</p>
</div></body></html>`;
  return { subject, text: lines.join('\n'), html };
}

export interface OrgWeekly {
  name: string;
  from: string;
  to: string;
  students: { name: string; xpGained: number; level: number; completionPct: number | null; activeDays: number }[];
}

export function renderOrgWeekly(data: OrgWeekly, opts: { brand: string; appLink?: string }) {
  const range = `${fmtDay(data.from)} – ${fmtDay(data.to)}`;
  const subject = `${data.name} · weekly institution report · ${range}`;
  const sorted = [...data.students].sort((a, b) => b.xpGained - a.xpGained);
  const active = sorted.filter(s => s.activeDays > 0).length;
  const pcts = sorted.map(s => s.completionPct).filter((p): p is number => p !== null);
  const avg = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null;
  const needs = sorted.filter(s => s.activeDays === 0).map(s => s.name);
  const text = [
    `${data.name} — weekly institution report`, range, '',
    `Students: ${sorted.length} · active this week: ${active} · average core-timetable completion: ${avg === null ? 'n/a' : `${avg}%`}`, '',
    ...sorted.map(s => `  ${s.name}: +${s.xpGained} XP · Lv ${s.level} · ${s.completionPct === null ? 'n/a' : `${s.completionPct}%`} · ${s.activeDays}/7 days`),
    '', needs.length ? `Not active this week: ${needs.join(', ')}` : 'Every student was active this week.',
    '', `Sent by ${opts.brand} to the report emails your institution admin chose.`,
  ].join('\n');
  const rows = sorted.map(s => `<tr><td style="padding:6px 8px">${esc(s.name)}</td><td style="padding:6px 8px;text-align:right">+${s.xpGained}</td><td style="padding:6px 8px;text-align:right">${s.level}</td><td style="padding:6px 8px;text-align:right">${s.completionPct === null ? '—' : `${s.completionPct}%`}</td><td style="padding:6px 8px;text-align:right">${s.activeDays}/7</td></tr>`).join('');
  const html = `<!doctype html><html><body style="margin:0;background:#f9fafb;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<div style="max-width:640px;margin:0 auto;padding:24px">
<p style="margin:0;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#7c3aed">${esc(opts.brand)}</p>
<h1 style="margin:4px 0 0;font-size:22px;color:#111827">${esc(data.name)}</h1>
<p style="margin:4px 0 16px;color:#6b7280;font-size:14px">Weekly institution report · ${esc(range)}</p>
<p style="font-size:14px;color:#111827">${sorted.length} students · ${active} active this week · average core-timetable completion ${avg === null ? 'n/a' : `${avg}%`}</p>
<table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #e5e7eb"><thead><tr style="background:#f3f4f6"><th style="padding:6px 8px;text-align:left">Student</th><th style="padding:6px 8px;text-align:right">XP</th><th style="padding:6px 8px;text-align:right">Level</th><th style="padding:6px 8px;text-align:right">Timetable</th><th style="padding:6px 8px;text-align:right">Days</th></tr></thead><tbody>${rows}</tbody></table>
${needs.length ? `<p style="font-size:14px;color:#b45309">Not active this week: ${esc(needs.join(', '))}</p>` : ''}
${opts.appLink ? `<p><a href="${esc(opts.appLink)}" style="color:#7c3aed">Open the institution dashboard</a></p>` : ''}
</div></body></html>`;
  return { subject, text, html };
}

// ── Sending ─────────────────────────────────────────────────────────────────

export interface SendResult { mailConfigured: boolean; recipients: number; sent: number }

/** Send this hunter's weekly report (week ending `to`, days in `tz`) to every active recipient. */
export async function sendWeeklyReport(userId: number, to: string, tz = DEFAULT_TZ): Promise<SendResult> {
  const recipients = (await pool.query(
    `SELECT id, email, scope FROM report_recipients WHERE user_id = $1 AND active ORDER BY id`, [userId])).rows;
  const result: SendResult = { mailConfigured: mailConfigured(), recipients: recipients.length, sent: 0 };
  if (!recipients.length) return result;
  const data = await computeWeekly(userId, to, tz);
  if (!data) return result;
  for (const r of recipients) {
    const show = sectionsFor(data, r.scope);
    if (!show.personal && !show.org) continue; // institution-only recipient after the hunter left it
    const url = unsubscribeUrl(r.id);
    const mail = renderWeekly(data, r.scope, { brand: brandName(), unsubscribeUrl: url, appLink: appUrl() });
    if (await sendMail({ to: r.email, ...mail, unsubscribeUrl: url })) {
      result.sent += 1;
      await pool.query('UPDATE report_recipients SET last_sent_at = NOW() WHERE id = $1', [r.id]);
    }
  }
  return result;
}

/** The institution summary for the admin's chosen report emails. */
export async function computeOrgWeekly(orgId: number, to: string, tz = DEFAULT_TZ): Promise<OrgWeekly | null> {
  const from = addDays(to, -6);
  const o = (await pool.query('SELECT name FROM organizations WHERE id = $1 AND NOT archived', [orgId])).rows[0];
  if (!o) return null;
  const [members, comps, tasks] = await Promise.all([
    pool.query(`SELECT m.user_id, m.xp, u.name FROM org_members m JOIN users u ON u.id = m.user_id WHERE m.org_id = $1 AND m.role = 'student'`, [orgId]),
    pool.query(`SELECT user_id, task_id, completion_date::text AS d, xp_awarded FROM org_task_completions WHERE org_id = $1 AND completion_date BETWEEN $2::date AND $3::date`, [orgId, from, to]),
    pool.query(`SELECT id, recurrence, created_at FROM org_tasks WHERE org_id = $1 AND NOT archived`, [orgId]),
  ]);
  const sched = tasks.rows.map((t: any) => ({ id: t.id, recurrence: t.recurrence, since: taskSince(t.created_at, tz) }));
  return {
    name: o.name, from, to,
    students: members.rows.map((m: any) => {
      const mine = comps.rows.filter((c: any) => c.user_id === m.user_id);
      const p = memberProgress(mine.map((c: any) => ({ date: c.d, taskId: c.task_id })), sched, to, 7);
      return { name: m.name, xpGained: mine.reduce((s: number, c: any) => s + c.xp_awarded, 0), level: calculateLevel(m.xp), completionPct: p.completionPct, activeDays: p.activeDays7 };
    }),
  };
}

export async function sendOrgWeeklyReport(orgId: number, to: string, tz = DEFAULT_TZ): Promise<SendResult> {
  const o = (await pool.query('SELECT report_emails FROM organizations WHERE id = $1 AND NOT archived', [orgId])).rows[0];
  const emails: string[] = o?.report_emails ?? [];
  const result: SendResult = { mailConfigured: mailConfigured(), recipients: emails.length, sent: 0 };
  if (!emails.length) return result;
  const data = await computeOrgWeekly(orgId, to, tz);
  if (!data) return result;
  const mail = renderOrgWeekly(data, { brand: brandName(), appLink: `${appUrl()}/org` });
  for (const email of emails) if (await sendMail({ to: email, ...mail })) result.sent += 1;
  return result;
}

// ── Scheduler ───────────────────────────────────────────────────────────────

const localParts = (tz: string, now: Date) => {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: 'numeric', hourCycle: 'h23' }).formatToParts(now);
  const wd = f.find(p => p.type === 'weekday')!.value;
  return { weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd), hour: Number(f.find(p => p.type === 'hour')!.value) };
};

/** Is it report time in this timezone (Sunday from 18:00)? Pure; unit-tested. */
export function reportDue(tz: string, now = new Date()): { due: boolean; weekEnd: string } {
  const zone = isValidTimeZone(tz) ? tz : DEFAULT_TZ;
  const { weekday, hour } = localParts(zone, now);
  return { due: weekday === REPORT_WEEKDAY && hour >= REPORT_HOUR, weekEnd: localDate(zone, now) };
}

/** Claim a (subject, week) once, across restarts and instances. */
async function claim(kind: 'user' | 'org', id: number, weekEnd: string): Promise<boolean> {
  const r = await pool.query(
    `INSERT INTO report_log (subject_kind, subject_id, week_start) VALUES ($1, $2, $3::date) ON CONFLICT DO NOTHING RETURNING subject_id`,
    [kind, id, addDays(weekEnd, -6)]);
  return !!r.rowCount;
}

export async function runWeeklyReports(now = new Date()) {
  if (!mailConfigured()) return;
  const users = (await pool.query(
    `SELECT DISTINCT r.user_id, COALESCE(rt.timezone, (SELECT timezone FROM push_subscriptions p WHERE p.user_id = r.user_id LIMIT 1)) AS tz
     FROM report_recipients r LEFT JOIN routines rt ON rt.user_id = r.user_id WHERE r.active`)).rows;
  for (const u of users) {
    const tz = u.tz && isValidTimeZone(u.tz) ? u.tz : DEFAULT_TZ;
    const { due, weekEnd } = reportDue(tz, now);
    if (!due || !(await claim('user', u.user_id, weekEnd))) continue;
    const r = await sendWeeklyReport(u.user_id, weekEnd, tz).catch(e => { console.error('Weekly report failed:', e); return null; });
    if (r) await pool.query(`UPDATE report_log SET sent = $3 WHERE subject_kind = 'user' AND subject_id = $1 AND week_start = $2::date`, [u.user_id, addDays(weekEnd, -6), r.sent]);
  }
  const orgs = (await pool.query(`SELECT id FROM organizations WHERE NOT archived AND cardinality(report_emails) > 0`)).rows;
  for (const o of orgs) {
    const { due, weekEnd } = reportDue(DEFAULT_TZ, now);
    if (!due || !(await claim('org', o.id, weekEnd))) continue;
    await sendOrgWeeklyReport(o.id, weekEnd).catch(e => console.error('Institution report failed:', e));
  }
}

export function startReportScheduler() {
  const tick = () => runWeeklyReports().catch(e => console.error('Report scheduler failed:', e));
  setInterval(tick, 15 * 60_000).unref();
}

/** The hunter's timezone for "today" outside a request (stored routine or push subscription). */
export async function userTimeZone(userId: number): Promise<string> {
  const r = (await pool.query(
    `SELECT COALESCE((SELECT timezone FROM routines WHERE user_id = $1), (SELECT timezone FROM push_subscriptions WHERE user_id = $1 LIMIT 1)) AS tz`, [userId])).rows[0];
  return r?.tz && isValidTimeZone(r.tz) ? r.tz : DEFAULT_TZ;
}
