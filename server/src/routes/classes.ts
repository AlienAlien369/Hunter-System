import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { hit, tooMany } from '../middleware/security.js';
import { requestToday, addDays } from '../time.js';
import { calculateLevel, calculateRank } from '../progression.js';
import {
  CODE_LENGTH, CONSISTENCY_WINDOW_DAYS, FREE_CLASS_CAPACITY, MAX_FREE_CLASSES, MAX_JOINED_CLASSES,
  consistencyOf, generateJoinCode, normalizeJoinCode, validClassName,
} from '../classes.js';

const router = Router();
router.use(authenticateToken);

/** A fresh unique code (collisions are astronomically rare; retry anyway). */
async function newCode(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = generateJoinCode();
    if (!(await pool.query('SELECT 1 FROM classes WHERE code = $1', [code])).rowCount) return code;
  }
  throw new Error('could not allocate a class code');
}

const ownClass = async (userId: number, id: unknown) => {
  const n = Number(id);
  if (!Number.isInteger(n)) return null;
  return (await pool.query('SELECT id, name, code, archived, created_at FROM classes WHERE id = $1 AND owner_id = $2', [n, userId])).rows[0] ?? null;
};

// GET /api/classes — classes I teach and classes I have joined
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const teaching = (await pool.query(
      `SELECT c.id, c.name, c.code, c.archived, c.created_at,
              (SELECT COUNT(*)::int FROM class_members m WHERE m.class_id = c.id) AS members
       FROM classes c WHERE c.owner_id = $1 ORDER BY c.id`, [userId])).rows;
    const joined = (await pool.query(
      `SELECT c.id, c.name, t.name AS teacher, m.joined_at
       FROM class_members m JOIN classes c ON c.id = m.class_id JOIN users t ON t.id = c.owner_id
       WHERE m.user_id = $1 AND NOT c.archived ORDER BY m.joined_at`, [userId])).rows;
    res.set('Cache-Control', 'no-store');
    res.json({
      capacity: FREE_CLASS_CAPACITY,
      canCreate: teaching.filter((c: any) => !c.archived).length < MAX_FREE_CLASSES,
      teaching: teaching.map((c: any) => ({ id: c.id, name: c.name, code: c.code, archived: c.archived, members: c.members, pilot: true, createdAt: c.created_at })),
      joined: joined.map((c: any) => ({ id: c.id, name: c.name, teacher: c.teacher, joinedAt: c.joined_at })),
    });
  } catch (error) {
    console.error('Classes list error:', error);
    res.status(500).json({ error: 'Failed to load classes' });
  }
});

// POST /api/classes { name } — create a class (adults only; the first class is a free pilot)
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const name = validClassName(req.body?.name);
    if (!name) return res.status(400).json({ error: 'Give the class a name (2 to 60 characters).' });
    const u = (await pool.query('SELECT consent_status FROM users WHERE id = $1', [userId])).rows[0];
    if (u?.consent_status !== 'not_required') return res.status(403).json({ error: 'Only adults can create a class.', code: 'adult_required' });
    const mine = (await pool.query('SELECT COUNT(*)::int AS n FROM classes WHERE owner_id = $1 AND NOT archived', [userId])).rows[0].n as number;
    if (mine >= MAX_FREE_CLASSES) {
      return res.status(409).json({ error: 'Your first class is a free pilot. More classes arrive with the Teams plan.', code: 'class_limit' });
    }
    const r = await pool.query('INSERT INTO classes (owner_id, name, code) VALUES ($1, $2, $3) RETURNING id, name, code, created_at', [userId, name, await newCode()]);
    res.status(201).json({ id: r.rows[0].id, name: r.rows[0].name, code: r.rows[0].code, members: 0, pilot: true, capacity: FREE_CLASS_CAPACITY });
  } catch (error) {
    console.error('Class create error:', error);
    res.status(500).json({ error: 'Failed to create class' });
  }
});

// PATCH /api/classes/:id { name?, archived? }
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const c = await ownClass(req.user!.id, req.params.id);
    if (!c) return res.status(404).json({ error: 'Class not found' });
    const name = req.body?.name === undefined ? c.name : validClassName(req.body.name);
    if (!name) return res.status(400).json({ error: 'Give the class a name (2 to 60 characters).' });
    const archived = typeof req.body?.archived === 'boolean' ? req.body.archived : c.archived;
    await pool.query('UPDATE classes SET name = $2, archived = $3 WHERE id = $1', [c.id, name, archived]);
    res.json({ id: c.id, name, archived });
  } catch (error) {
    console.error('Class update error:', error);
    res.status(500).json({ error: 'Failed to update class' });
  }
});

// POST /api/classes/:id/rotate-code — invalidate a leaked code
router.post('/:id/rotate-code', async (req: Request, res: Response) => {
  try {
    const c = await ownClass(req.user!.id, req.params.id);
    if (!c) return res.status(404).json({ error: 'Class not found' });
    const code = await newCode();
    await pool.query('UPDATE classes SET code = $2 WHERE id = $1', [c.id, code]);
    res.json({ code });
  } catch (error) {
    console.error('Class rotate error:', error);
    res.status(500).json({ error: 'Failed to rotate code' });
  }
});

// GET /api/classes/lookup?code=ABC234 — what a student sees BEFORE joining, including what the teacher will see
router.get('/lookup', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const wait = hit(`class-lookup:${userId}`, 20, 60 * 60_000);
    if (wait) return tooMany(res, wait, 'class code attempts');
    const code = normalizeJoinCode(req.query.code);
    if (!code) return res.status(400).json({ error: `A class code has ${CODE_LENGTH} letters and numbers.`, code: 'bad_code' });
    const c = (await pool.query(
      `SELECT c.id, c.name, t.name AS teacher, (SELECT COUNT(*)::int FROM class_members m WHERE m.class_id = c.id) AS members
       FROM classes c JOIN users t ON t.id = c.owner_id WHERE c.code = $1 AND NOT c.archived`, [code])).rows[0];
    if (!c) return res.status(404).json({ error: 'No class with that code.', code: 'not_found' });
    res.json({
      name: c.name, teacher: c.teacher, members: c.members, capacity: FREE_CLASS_CAPACITY,
      teacherSees: ['hunterName', 'levelAndRank', 'streak', 'activeDays', 'lastActive'],
    });
  } catch (error) {
    console.error('Class lookup error:', error);
    res.status(500).json({ error: 'Failed to look up class' });
  }
});

// POST /api/classes/join { code } — the student's own, informed action
router.post('/join', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const wait = hit(`class-join:${userId}`, 10, 60 * 60_000);
    if (wait) return tooMany(res, wait, 'class code attempts');
    const code = normalizeJoinCode(req.body?.code);
    if (!code) return res.status(400).json({ error: `A class code has ${CODE_LENGTH} letters and numbers.`, code: 'bad_code' });
    const me = (await pool.query('SELECT name_set FROM users WHERE id = $1', [userId])).rows[0];
    // A deliberate display name, so the teacher never sees a login username.
    if (!me?.name_set) return res.status(400).json({ error: 'Choose your Hunter name first: that is the name your teacher will see.', code: 'name_required' });
    const c = (await pool.query('SELECT id, owner_id, name FROM classes WHERE code = $1 AND NOT archived', [code])).rows[0];
    if (!c) return res.status(404).json({ error: 'No class with that code.', code: 'not_found' });
    if (c.owner_id === userId) return res.status(400).json({ error: 'This is your own class.', code: 'own_class' });
    const joinedCount = (await pool.query('SELECT COUNT(*)::int AS n FROM class_members WHERE user_id = $1', [userId])).rows[0].n as number;
    const already = (await pool.query('SELECT 1 FROM class_members WHERE class_id = $1 AND user_id = $2', [c.id, userId])).rowCount;
    if (already) return res.json({ id: c.id, name: c.name, joined: true });
    if (joinedCount >= MAX_JOINED_CLASSES) return res.status(409).json({ error: `You can be in up to ${MAX_JOINED_CLASSES} classes. Leave one first.`, code: 'too_many_classes' });
    // Capacity must hold when students arrive together: lock the class row so
    // concurrent joins queue up and each one sees the true count.
    const client = await pool.connect();
    let full = false;
    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM classes WHERE id = $1 FOR UPDATE', [c.id]);
      const count = (await client.query('SELECT COUNT(*)::int AS n FROM class_members WHERE class_id = $1', [c.id])).rows[0].n as number;
      if (count >= FREE_CLASS_CAPACITY) full = true;
      else await client.query('INSERT INTO class_members (class_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [c.id, userId]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
    if (full) return res.status(409).json({ error: 'This class is full.', code: 'class_full' });
    res.status(201).json({ id: c.id, name: c.name, joined: true });
  } catch (error) {
    console.error('Class join error:', error);
    res.status(500).json({ error: 'Failed to join class' });
  }
});

// DELETE /api/classes/:id/membership — leave a class. The teacher's view of you ends immediately.
router.delete('/:id/membership', async (req: Request, res: Response) => {
  try {
    const r = await pool.query('DELETE FROM class_members WHERE class_id = $1 AND user_id = $2', [Number(req.params.id) || 0, req.user!.id]);
    if (!r.rowCount) return res.status(404).json({ error: 'You are not in that class.' });
    res.json({ left: true });
  } catch (error) {
    console.error('Class leave error:', error);
    res.status(500).json({ error: 'Failed to leave class' });
  }
});

// DELETE /api/classes/:id/members/:memberId — teacher removes a student
router.delete('/:id/members/:memberId', async (req: Request, res: Response) => {
  try {
    const c = await ownClass(req.user!.id, req.params.id);
    if (!c) return res.status(404).json({ error: 'Class not found' });
    const r = await pool.query('DELETE FROM class_members WHERE id = $1 AND class_id = $2', [Number(req.params.memberId) || 0, c.id]);
    if (!r.rowCount) return res.status(404).json({ error: 'Student not found' });
    res.json({ removed: true });
  } catch (error) {
    console.error('Class remove error:', error);
    res.status(500).json({ error: 'Failed to remove student' });
  }
});

// GET /api/classes/:id/dashboard — consistency only. Owner only.
router.get('/:id/dashboard', async (req: Request, res: Response) => {
  try {
    const c = await ownClass(req.user!.id, req.params.id);
    if (!c) return res.status(404).json({ error: 'Class not found' });
    const today = requestToday(req);
    const since = addDays(today, -(CONSISTENCY_WINDOW_DAYS + 30));
    const members = (await pool.query(
      `SELECT m.id AS member_id, m.joined_at, u.id AS user_id, u.name, u.xp
       FROM class_members m JOIN users u ON u.id = m.user_id WHERE m.class_id = $1 ORDER BY u.name, m.id`, [c.id])).rows;
    const ids = members.map((m: any) => m.user_id);
    const dayRows = ids.length
      ? (await pool.query(
          `SELECT user_id, d FROM (
             SELECT user_id, completion_date::text AS d FROM quest_completions WHERE user_id = ANY($1) AND completion_date >= $2::date
             UNION SELECT user_id, day::text FROM freeze_days WHERE user_id = ANY($1) AND day >= $2::date
           ) x GROUP BY user_id, d`, [ids, since])).rows
      : [];
    const byUser = new Map<number, Set<string>>();
    for (const r of dayRows) { if (!byUser.has(r.user_id)) byUser.set(r.user_id, new Set()); byUser.get(r.user_id)!.add(r.d); }
    const rows = members.map((m: any) => {
      const k = consistencyOf(byUser.get(m.user_id) ?? new Set(), today);
      return {
        memberId: m.member_id, name: m.name, level: calculateLevel(m.xp), rank: calculateRank(m.xp),
        streak: k.streak, activeDaysThisWeek: k.activeDaysThisWeek, consistencyPct: k.consistencyPct, lastActive: k.lastActive, joinedAt: m.joined_at,
      };
    });
    const n = rows.length;
    res.set('Cache-Control', 'no-store');
    res.json({
      class: { id: c.id, name: c.name, code: c.code, archived: c.archived, capacity: FREE_CLASS_CAPACITY, pilot: true },
      windowDays: CONSISTENCY_WINDOW_DAYS,
      summary: {
        members: n,
        activeThisWeek: rows.filter(r => r.activeDaysThisWeek > 0).length,
        avgConsistencyPct: n ? Math.round(rows.reduce((s, r) => s + r.consistencyPct, 0) / n) : 0,
      },
      members: rows,
    });
  } catch (error) {
    console.error('Class dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

export default router;
