import { Pool, PoolConfig } from 'pg';

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
        quest_id INTEGER NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
        completion_date DATE NOT NULL,
        completed_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(quest_id, completion_date)
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

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_quest_completions_date ON quest_completions(completion_date);
      CREATE INDEX IF NOT EXISTS idx_quest_completions_quest ON quest_completions(quest_id);
      CREATE INDEX IF NOT EXISTS idx_rank_history_user ON rank_history(user_id);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    `);

    // Seed default quests if empty
    const questCount = await client.query('SELECT COUNT(*) FROM quests');
    if (parseInt(questCount.rows[0].count) === 0) {
      const defaultQuests = [
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
      ];

      for (const q of defaultQuests) {
        await client.query(
          `INSERT INTO quests (quest_id, title, xp_reward, category, difficulty) VALUES ($1, $2, $3, $4, $5)`,
          [q.id, q.title, q.xp, q.category, q.difficulty]
        );
      }
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
