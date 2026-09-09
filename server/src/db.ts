import { Pool, PoolConfig } from 'pg';
import { HIDDEN_QUESTS } from './data/hiddenQuests.js';

const poolConfig: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'hunter',
  password: process.env.DB_PASSWORD || 'hunterpass',
  database: process.env.DB_NAME || 'hunter_system',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

export const pool = new Pool(poolConfig);

export async function initDatabase() {
  const client = await pool.connect();
  try {
    // Create users table with auth fields
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name VARCHAR(100) NOT NULL DEFAULT 'Hunter',
        rank VARCHAR(5) NOT NULL DEFAULT 'E',
        xp INTEGER NOT NULL DEFAULT 0,
        hp INTEGER NOT NULL DEFAULT 80,
        mp INTEGER NOT NULL DEFAULT 60,
        str INTEGER NOT NULL DEFAULT 10,
        agi INTEGER NOT NULL DEFAULT 10,
        vit INTEGER NOT NULL DEFAULT 10,
        int INTEGER NOT NULL DEFAULT 10,
        sen INTEGER NOT NULL DEFAULT 10,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS quests (
        id SERIAL PRIMARY KEY,
        quest_id VARCHAR(20) UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        xp_reward INTEGER NOT NULL DEFAULT 10,
        category VARCHAR(50) NOT NULL,
        difficulty INTEGER NOT NULL DEFAULT 1,
        is_daily BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS quest_completions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        quest_id INTEGER NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
        completion_date DATE NOT NULL,
        completed_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, quest_id, completion_date)
      );

      CREATE TABLE IF NOT EXISTS rank_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) DEFAULT 1,
        rank VARCHAR(5) NOT NULL,
        xp_at_rank INTEGER NOT NULL,
        achieved_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS daily_stats (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) DEFAULT 1,
        stat_date DATE NOT NULL,
        quests_completed INTEGER NOT NULL DEFAULT 0,
        total_xp INTEGER NOT NULL DEFAULT 0,
        streak INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, stat_date)
      );

      CREATE TABLE IF NOT EXISTS nutrition_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        log_date DATE NOT NULL,
        food_name VARCHAR(100) NOT NULL,
        protein NUMERIC(6,2) NOT NULL DEFAULT 0,
        cost NUMERIC(8,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS activity_log (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        action VARCHAR(50) NOT NULL,
        entity VARCHAR(100),
        details JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS track_progress (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        track VARCHAR(10) NOT NULL,
        total_completions INTEGER NOT NULL DEFAULT 0,
        total_xp INTEGER NOT NULL DEFAULT 0,
        passes INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, track)
      );

      -- Penalties for missing daily quests 2+ days in a row
      CREATE TABLE IF NOT EXISTS penalties (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        penalty_date DATE NOT NULL,
        missed_days INTEGER NOT NULL DEFAULT 2,
        broken_streak INTEGER NOT NULL DEFAULT 0,
        xp_lost INTEGER NOT NULL DEFAULT 0,
        hp_lost INTEGER NOT NULL DEFAULT 0,
        recovered BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, penalty_date)
      );

      -- Idempotent migration: streak-based penalty scaling + recovery tracking
      ALTER TABLE penalties ADD COLUMN IF NOT EXISTS broken_streak INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE penalties ADD COLUMN IF NOT EXISTS recovered BOOLEAN NOT NULL DEFAULT false;

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_quest_completions_date ON quest_completions(completion_date);
      CREATE INDEX IF NOT EXISTS idx_quest_completions_quest ON quest_completions(quest_id);
      CREATE INDEX IF NOT EXISTS idx_rank_history_user ON rank_history(user_id);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_nutrition_user_date ON nutrition_logs(user_id, log_date);
      CREATE INDEX IF NOT EXISTS idx_activity_user_time ON activity_log(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_track_progress_user ON track_progress(user_id);

    `);

    // Idempotent migration: record exactly how much XP each completion awarded
    // (level-scaled hidden quests award more than the quest's base xp_reward).
    await client.query('ALTER TABLE quest_completions ADD COLUMN IF NOT EXISTS xp_awarded INTEGER');
    await client.query(
      `UPDATE quest_completions qc
       SET xp_awarded = q.xp_reward
       FROM quests q
       WHERE qc.quest_id = q.id AND qc.xp_awarded IS NULL`
    );

    // Idempotent migration: scope quest completions to a user (existing databases)
    await client.query('ALTER TABLE quest_completions ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE');
    const demoUser = await client.query('SELECT id FROM users WHERE username = $1 LIMIT 1', ['demo_user']);
    await client.query('UPDATE quest_completions SET user_id = $1 WHERE user_id IS NULL', [demoUser.rows[0]?.id ?? 1]);
    await client.query('ALTER TABLE quest_completions ALTER COLUMN user_id SET NOT NULL');
    await client.query('ALTER TABLE quest_completions DROP CONSTRAINT IF EXISTS quest_completions_quest_id_completion_date_key');
    await client.query('ALTER TABLE quest_completions DROP CONSTRAINT IF EXISTS quest_completions_user_quest_date_key');
    await client.query('ALTER TABLE quest_completions ADD CONSTRAINT quest_completions_user_quest_date_key UNIQUE (user_id, quest_id, completion_date)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_quest_completions_user ON quest_completions(user_id)');

    // Seed default quests (idempotent: fills in any missing quests on every boot)
    const defaultQuests = [
      // Discipline
      { id: 'DQ-01', title: 'Wake Up at 4:45 AM', xp: 10, category: 'discipline', difficulty: 1 },
      { id: 'DQ-02', title: 'Meditation 10-15 min', xp: 10, category: 'mindset', difficulty: 1 },
      { id: 'DQ-03', title: 'Solve 1 DSA Problem', xp: 25, category: 'skill', difficulty: 2 },
      { id: 'DQ-04', title: 'Attend MMA Class (Mon-Fri)', xp: 20, category: 'physical', difficulty: 2 },
      { id: 'DQ-05', title: 'Consume Fit Feast Pouch', xp: 5, category: 'nutrition', difficulty: 1 },
      { id: 'DQ-06', title: 'Drink 500ml Milk', xp: 5, category: 'nutrition', difficulty: 1 },
      { id: 'DQ-07', title: 'Eat 50g Oats', xp: 5, category: 'nutrition', difficulty: 1 },
      { id: 'DQ-08', title: 'Eat 150g Paneer', xp: 5, category: 'nutrition', difficulty: 1 },
      { id: 'DQ-09', title: 'Eat 30g Roasted Chana', xp: 5, category: 'nutrition', difficulty: 1 },
      { id: 'DQ-10', title: 'Eat 20g Peanuts', xp: 5, category: 'nutrition', difficulty: 1 },
      { id: 'DQ-11', title: 'SaaS Building Time', xp: 20, category: 'saas', difficulty: 2 },
      { id: 'DQ-12', title: 'System Design Practice', xp: 20, category: 'skill', difficulty: 2 },
      { id: 'DQ-13', title: 'Satsang Attendance', xp: 20, category: 'spiritual', difficulty: 1 },
      { id: 'DQ-14', title: 'Badminton/TT', xp: 25, category: 'physical', difficulty: 2 },
      { id: 'DQ-15', title: 'Sleep by 10:45 PM', xp: 10, category: 'health', difficulty: 1 },
      // LeetCode 75 (DSA practice)
      { id: 'LC-01', title: 'Two Sum', xp: 15, category: 'skill', difficulty: 1 },
      { id: 'LC-02', title: 'Add Two Numbers', xp: 15, category: 'skill', difficulty: 2 },
      { id: 'LC-03', title: 'Longest Substring Without Repeating Characters', xp: 20, category: 'skill', difficulty: 2 },
      { id: 'LC-04', title: 'Median of Two Sorted Arrays', xp: 30, category: 'skill', difficulty: 3 },
      { id: 'LC-05', title: 'Longest Palindromic Substring', xp: 20, category: 'skill', difficulty: 2 },
      { id: 'LC-06', title: 'Zigzag Conversion', xp: 15, category: 'skill', difficulty: 2 },
      { id: 'LC-07', title: 'Reverse Integer', xp: 15, category: 'skill', difficulty: 2 },
      { id: 'LC-08', title: 'String to Integer (atoi)', xp: 20, category: 'skill', difficulty: 2 },
      { id: 'LC-09', title: 'Palindrome Number', xp: 10, category: 'skill', difficulty: 1 },
      { id: 'LC-10', title: 'Regular Expression Matching', xp: 30, category: 'skill', difficulty: 3 },
      { id: 'LC-11', title: 'Container With Most Water', xp: 20, category: 'skill', difficulty: 2 },
      { id: 'LC-12', title: 'Integer to Roman', xp: 15, category: 'skill', difficulty: 2 },
      { id: 'LC-13', title: 'Roman to Integer', xp: 10, category: 'skill', difficulty: 1 },
      { id: 'LC-14', title: 'Longest Common Prefix', xp: 10, category: 'skill', difficulty: 1 },
      { id: 'LC-15', title: '3Sum', xp: 25, category: 'skill', difficulty: 2 },
      { id: 'LC-16', title: '3Sum Closest', xp: 20, category: 'skill', difficulty: 2 },
      { id: 'LC-17', title: 'Letter Combinations of a Phone Number', xp: 20, category: 'skill', difficulty: 2 },
      { id: 'LC-18', title: '4Sum', xp: 25, category: 'skill', difficulty: 2 },
      { id: 'LC-19', title: 'Remove Nth Node From End of List', xp: 15, category: 'skill', difficulty: 2 },
      { id: 'LC-20', title: 'Valid Parentheses', xp: 10, category: 'skill', difficulty: 1 },
      { id: 'LC-21', title: 'Merge Two Sorted Lists', xp: 10, category: 'skill', difficulty: 1 },
      { id: 'LC-22', title: 'Generate Parentheses', xp: 20, category: 'skill', difficulty: 2 },
      { id: 'LC-23', title: 'Merge k Sorted Lists', xp: 30, category: 'skill', difficulty: 3 },
      { id: 'LC-24', title: 'Swap Nodes in Pairs', xp: 15, category: 'skill', difficulty: 2 },
      { id: 'LC-25', title: 'Reverse Nodes in k-Group', xp: 30, category: 'skill', difficulty: 3 },
      { id: 'LC-26', title: 'Remove Duplicates from Sorted Array', xp: 10, category: 'skill', difficulty: 1 },
      { id: 'LC-27', title: 'Remove Element', xp: 10, category: 'skill', difficulty: 1 },
      { id: 'LC-28', title: 'Find the Index of the First Occurrence in a String', xp: 15, category: 'skill', difficulty: 1 },
      { id: 'LC-29', title: 'Divide Two Integers', xp: 20, category: 'skill', difficulty: 2 },
      { id: 'LC-30', title: 'Substring with Concatenation of All Words', xp: 30, category: 'skill', difficulty: 3 },
      { id: 'LC-31', title: 'Next Permutation', xp: 25, category: 'skill', difficulty: 2 },
      { id: 'LC-32', title: 'Longest Valid Parentheses', xp: 30, category: 'skill', difficulty: 3 },
      { id: 'LC-33', title: 'Search in Rotated Sorted Array', xp: 20, category: 'skill', difficulty: 2 },
      { id: 'LC-34', title: 'Find First and Last Position of Element in Sorted Array', xp: 20, category: 'skill', difficulty: 2 },
      { id: 'LC-35', title: 'Search Insert Position', xp: 10, category: 'skill', difficulty: 1 },
      { id: 'LC-36', title: 'Valid Sudoku', xp: 20, category: 'skill', difficulty: 2 },
      { id: 'LC-37', title: 'Sudoku Solver', xp: 30, category: 'skill', difficulty: 3 },
      { id: 'LC-38', title: 'Count and Say', xp: 15, category: 'skill', difficulty: 2 },
      { id: 'LC-39', title: 'Combination Sum', xp: 20, category: 'skill', difficulty: 2 },
      { id: 'LC-40', title: 'Combination Sum II', xp: 20, category: 'skill', difficulty: 2 },
      { id: 'LC-41', title: 'First Missing Positive', xp: 30, category: 'skill', difficulty: 3 },
      { id: 'LC-42', title: 'Trapping Rain Water', xp: 30, category: 'skill', difficulty: 3 },
      { id: 'LC-43', title: 'Multiply Strings', xp: 20, category: 'skill', difficulty: 2 },
      { id: 'LC-44', title: 'Wildcard Matching', xp: 30, category: 'skill', difficulty: 3 },
      { id: 'LC-45', title: 'Jump Game II', xp: 25, category: 'skill', difficulty: 2 },
      { id: 'LC-46', title: 'Permutations', xp: 20, category: 'skill', difficulty: 2 },
      { id: 'LC-47', title: 'Permutations II', xp: 20, category: 'skill', difficulty: 2 },
      { id: 'LC-48', title: 'Rotate Image', xp: 20, category: 'skill', difficulty: 2 },
      { id: 'LC-49', title: 'Group Anagrams', xp: 20, category: 'skill', difficulty: 2 },
      { id: 'LC-50', title: 'Pow(x, n)', xp: 20, category: 'skill', difficulty: 2 },
      { id: 'LC-51', title: 'N-Queens', xp: 30, category: 'skill', difficulty: 3 },
      { id: 'LC-52', title: 'N-Queens II', xp: 30, category: 'skill', difficulty: 3 },
      { id: 'LC-53', title: 'Maximum Subarray', xp: 15, category: 'skill', difficulty: 1 },
      { id: 'LC-54', title: 'Spiral Matrix', xp: 20, category: 'skill', difficulty: 2 },
      { id: 'LC-55', title: 'Jump Game', xp: 20, category: 'skill', difficulty: 2 },
      { id: 'LC-56', title: 'Merge Intervals', xp: 25, category: 'skill', difficulty: 2 },
      { id: 'LC-57', title: 'Insert Interval', xp: 25, category: 'skill', difficulty: 2 },
      { id: 'LC-58', title: 'Length of Last Word', xp: 10, category: 'skill', difficulty: 1 },
      { id: 'LC-59', title: 'Spiral Matrix II', xp: 20, category: 'skill', difficulty: 2 },
      { id: 'LC-60', title: 'Permutation Sequence', xp: 30, category: 'skill', difficulty: 3 },
      { id: 'LC-61', title: 'Rotate List', xp: 20, category: 'skill', difficulty: 2 },
      { id: 'LC-62', title: 'Unique Paths', xp: 20, category: 'skill', difficulty: 2 },
      { id: 'LC-63', title: 'Unique Paths II', xp: 20, category: 'skill', difficulty: 2 },
      { id: 'LC-64', title: 'Minimum Path Sum', xp: 20, category: 'skill', difficulty: 2 },
      { id: 'LC-65', title: 'Valid Number', xp: 30, category: 'skill', difficulty: 3 },
      { id: 'LC-66', title: 'Plus One', xp: 10, category: 'skill', difficulty: 1 },
      { id: 'LC-67', title: 'Add Binary', xp: 10, category: 'skill', difficulty: 1 },
      { id: 'LC-68', title: 'Text Justification', xp: 30, category: 'skill', difficulty: 3 },
      { id: 'LC-69', title: 'Sqrt(x)', xp: 15, category: 'skill', difficulty: 1 },
      { id: 'LC-70', title: 'Climbing Stairs', xp: 10, category: 'skill', difficulty: 1 },
      { id: 'LC-71', title: 'Simplify Path', xp: 20, category: 'skill', difficulty: 2 },
      { id: 'LC-72', title: 'Edit Distance', xp: 25, category: 'skill', difficulty: 2 },
      { id: 'LC-73', title: 'Set Matrix Zeroes', xp: 20, category: 'skill', difficulty: 2 },
      { id: 'LC-74', title: 'Search a 2D Matrix', xp: 15, category: 'skill', difficulty: 2 },
      { id: 'LC-75', title: 'Sort Colors', xp: 15, category: 'skill', difficulty: 2 },
      // SaaS milestones (permanent track)
      { id: 'SS-01', title: 'Market Research', xp: 40, category: 'saas', difficulty: 2 },
      { id: 'SS-02', title: 'MVP Development', xp: 50, category: 'saas', difficulty: 2 },
      { id: 'SS-03', title: 'Beta Launch', xp: 50, category: 'saas', difficulty: 2 },
      { id: 'SS-04', title: 'Product-Market Fit', xp: 60, category: 'saas', difficulty: 2 },
      { id: 'SS-05', title: 'Team Expansion', xp: 50, category: 'saas', difficulty: 2 },
      { id: 'SS-06', title: 'Series Funding', xp: 80, category: 'saas', difficulty: 3 },
      // Architecture challenges (permanent track)
      { id: 'AR-01', title: 'Multi-tenant B2B SaaS data isolation', xp: 30, category: 'architecture', difficulty: 3 },
      { id: 'AR-02', title: 'Notification system with retries & DLQ', xp: 30, category: 'architecture', difficulty: 3 },
      { id: 'AR-03', title: 'Fleet telemetry ingestion & live dashboard', xp: 30, category: 'architecture', difficulty: 3 },
      { id: 'AR-04', title: 'Role/permission system for multi-tenants', xp: 30, category: 'architecture', difficulty: 3 },
      { id: 'AR-05', title: 'File/document storage with tenant isolation', xp: 30, category: 'architecture', difficulty: 3 },
      { id: 'AR-06', title: 'Audit logging for enterprise', xp: 30, category: 'architecture', difficulty: 3 },
      { id: 'AR-07', title: 'Configuration/feature flags per tenant', xp: 30, category: 'architecture', difficulty: 3 },
      { id: 'AR-08', title: 'Order/trip workflow with idempotency', xp: 30, category: 'architecture', difficulty: 3 },
      { id: 'AR-09', title: 'API rate limiting and abuse protection', xp: 30, category: 'architecture', difficulty: 3 },
      { id: 'AR-10', title: 'Search/reporting without hurting transactional DB', xp: 30, category: 'architecture', difficulty: 3 },
      { id: 'AR-11', title: 'Caching strategy and invalidation', xp: 30, category: 'architecture', difficulty: 3 },
      { id: 'AR-12', title: 'Deployment/observability for production SaaS', xp: 30, category: 'architecture', difficulty: 3 },
      // Hidden quests (HQ-*): one random challenge per day, must be done the same day.
      // Single source of truth: server/src/data/hiddenQuests.ts (200+ tiered challenges).
      ...HIDDEN_QUESTS.map(h => ({ id: h.id, title: h.title, xp: h.baseXp, category: 'hidden', difficulty: h.difficulty })),
    ];

    for (const q of defaultQuests) {
      await client.query(
        `INSERT INTO quests (quest_id, title, xp_reward, category, difficulty)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (quest_id) DO NOTHING`,
        [q.id, q.title, q.xp, q.category, q.difficulty]
      );
    }

    // Backfill track_progress from the activity log (idempotent: only fills missing rows).
    // The activity log is the full audit trail, so lifetime totals survive redo-alls
    // that deleted quest_completion rows.
    const TRACK_PREFIXES: Record<string, string> = { dsa: 'LC-%', saas: 'SS-%', arch: 'AR-%' };
    const trackTotals: Record<string, number> = {};
    for (const [track, prefix] of Object.entries(TRACK_PREFIXES)) {
      const res = await client.query('SELECT COUNT(*) AS total FROM quests WHERE quest_id LIKE $1', [prefix]);
      trackTotals[track] = parseInt(res.rows[0].total);
    }
    const history = await client.query(
      `SELECT al.user_id, al.action, al.entity,
              COALESCE((al.details->>'xp')::int, 0) AS xp,
              al.created_at
       FROM activity_log al
       WHERE al.action IN ('quest_complete', 'quest_undo')
       ORDER BY al.created_at ASC, al.id ASC`
    );
    type TrackEntry = { completions: number; xp: number; done: Set<string>; passes: number; total: number };
    const byUserTrack = new Map<string, TrackEntry>();
    const getEntry = (userId: string, track: string): TrackEntry => {
      const key = `${userId}:${track}`;
      let entry = byUserTrack.get(key);
      if (!entry) {
        entry = { completions: 0, xp: 0, done: new Set(), passes: 0, total: trackTotals[track] };
        byUserTrack.set(key, entry);
      }
      return entry;
    };
    for (const row of history.rows) {
      const questId = String(row.entity || '');
      const track = Object.keys(TRACK_PREFIXES).find(t => questId.startsWith(TRACK_PREFIXES[t].replace('-%', '')));
      if (!track || !questId) continue;
      const entry = getEntry(String(row.user_id), track);
      if (row.action === 'quest_complete') {
        entry.completions += 1;
        entry.xp += row.xp;
        entry.done.add(questId);
        if (entry.done.size === entry.total) {
          entry.passes += 1;
          entry.done = new Set();
        }
      } else {
        entry.completions = Math.max(0, entry.completions - 1);
        entry.xp = Math.max(0, entry.xp - row.xp);
      }
    }
    for (const [key, entry] of byUserTrack) {
      const [userId, track] = key.split(':');
      await client.query(
        `INSERT INTO track_progress (user_id, track, total_completions, total_xp, passes)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, track) DO NOTHING`,
        [userId, track, entry.completions, entry.xp, entry.passes]
      );
    }

    // Seed demo user from environment variables
    const demoUsername = process.env.DEMO_USER || 'demo_user';
    const demoPassword = process.env.DEMO_PASS || 'DemoPass123!';
    const demoName = process.env.DEMO_NAME || 'Demo Hunter';

    const userCount = await client.query('SELECT COUNT(*) FROM users WHERE username = $1', [demoUsername]);
    if (parseInt(userCount.rows[0].count) === 0) {
      const bcrypt = await import('bcrypt');
      const passwordHash = await bcrypt.hash(demoPassword, 10);

      await client.query(
        `INSERT INTO users (username, password_hash, name) VALUES ($1, $2, $3)`,
        [demoUsername, passwordHash, demoName]
      );
      console.log(`Demo user created: ${demoUsername}`);
    }

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  } finally {
    client.release();
  }
}
