-- Hunter System Database Initialization

-- Users table (with authentication)
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

-- Quests table
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

-- Quest completions table (per-user: each user has their own completions)
CREATE TABLE IF NOT EXISTS quest_completions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quest_id INTEGER NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
  completion_date DATE NOT NULL,
  completed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, quest_id, completion_date)
);

-- Rank history table
CREATE TABLE IF NOT EXISTS rank_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) DEFAULT 1,
  rank VARCHAR(5) NOT NULL,
  xp_at_rank INTEGER NOT NULL,
  achieved_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Daily stats table
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
CREATE INDEX IF NOT EXISTS idx_quest_completions_user ON quest_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_rank_history_user ON rank_history(user_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Seed default quests (only if empty)
INSERT INTO quests (quest_id, title, xp_reward, category, difficulty)
SELECT 'DQ-01', 'Wake Up at 4:45 AM', 10, 'discipline', 1
WHERE NOT EXISTS (SELECT 1 FROM quests WHERE quest_id = 'DQ-01');

INSERT INTO quests (quest_id, title, xp_reward, category, difficulty)
SELECT 'DQ-02', 'Meditation 10-15 min', 10, 'mindset', 1
WHERE NOT EXISTS (SELECT 1 FROM quests WHERE quest_id = 'DQ-02');

INSERT INTO quests (quest_id, title, xp_reward, category, difficulty)
SELECT 'DQ-03', 'Solve 1 DSA Problem', 25, 'skill', 2
WHERE NOT EXISTS (SELECT 1 FROM quests WHERE quest_id = 'DQ-03');

INSERT INTO quests (quest_id, title, xp_reward, category, difficulty)
SELECT 'DQ-04', 'Attend MMA Class (Mon-Fri)', 20, 'physical', 2
WHERE NOT EXISTS (SELECT 1 FROM quests WHERE quest_id = 'DQ-04');

INSERT INTO quests (quest_id, title, xp_reward, category, difficulty)
SELECT 'DQ-05', 'Consume Fit Feast Pouch', 5, 'nutrition', 1
WHERE NOT EXISTS (SELECT 1 FROM quests WHERE quest_id = 'DQ-05');

-- Add more quests as needed...
