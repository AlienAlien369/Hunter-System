/**
 * Solo Leveling-style HIDDEN QUEST pool — the single source of truth.
 *
 * One challenge is picked per hunter per day (deterministic per username +
 * date) and must be completed the same day. The pool is tiered by hunter
 * level so every challenge matches the hunter's strength:
 *
 *   TIER 1 NOVICE   (level  1– 3)  base XP  40– 60
 *   TIER 2 INITIATE (level  4– 7)  base XP  55– 80
 *   TIER 3 ADEPT    (level  8–14)  base XP  75–110
 *   TIER 4 EXPERT   (level 15–24)  base XP 100–150
 *   TIER 5 MASTER   (level 25+ )   base XP 140–220
 *
 * On top of the tier's base XP, the final reward is scaled by a level-band
 * multiplier (see TIERS below), so a higher-level hunter earns more from the
 * same challenge. All quests are seeded into the `quests` table on boot with
 * their base XP; the completion route awards the scaled amount.
 */

export interface HiddenQuestDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  /** Base XP before the level-band multiplier. */
  baseXp: number;
  /** In-tier challenge rating: 1 = light, 2 = medium, 3 = brutal. */
  difficulty: 1 | 2 | 3;
  /** Tier gate (1–5) — a hunter must be at least TIERS[tier-1].minLevel. */
  tier: 1 | 2 | 3 | 4 | 5;
}

export const TIERS = [
  { name: 'NOVICE', minLevel: 1, maxLevel: 3, multiplier: 1.0 },
  { name: 'INITIATE', minLevel: 4, maxLevel: 7, multiplier: 1.15 },
  { name: 'ADEPT', minLevel: 8, maxLevel: 14, multiplier: 1.3 },
  { name: 'EXPERT', minLevel: 15, maxLevel: 24, multiplier: 1.5 },
  { name: 'MASTER', minLevel: 25, maxLevel: Infinity, multiplier: 1.75 },
] as const;

export function tierForLevel(level: number) {
  return TIERS.find(t => level >= t.minLevel && level <= t.maxLevel) ?? TIERS[TIERS.length - 1];
}

/** Small deterministic string hash so each (user, day) picks a stable challenge. */
export function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** Today's date key (YYYY-MM-DD, UTC — matches the server's completion dates). */
export function todayKey(): string {
  return new Date().toISOString().split('T')[0];
}

/** Level-band scaled XP: base × multiplier, rounded to the nearest 5. */
export function scaleHiddenXp(baseXp: number, level: number): number {
  const mult = tierForLevel(level).multiplier;
  return Math.max(5, Math.round((baseXp * mult) / 5) * 5);
}

/**
 * Today's hidden quest for a hunter — same all day, different every day.
 * Picks from the hunter's own tier band; roughly 1 day in 5 drops one tier
 * lower as a "breather" (still level-appropriate, never harder).
 */
export function selectTodaysHiddenQuest(username: string, level: number): HiddenQuestDef {
  const tier = tierForLevel(level);
  const tierIndex = TIERS.indexOf(tier) + 1; // 1..5
  const band = HIDDEN_QUESTS.filter(q => q.tier === tierIndex);
  const pool = band.length > 0 ? band : HIDDEN_QUESTS;
  const hash = hashStr(`${username}:${todayKey()}`);
  // Breather day: dip one tier down for an easier challenge.
  if (hash % 5 === 0 && tierIndex > 1) {
    const lower = HIDDEN_QUESTS.filter(q => q.tier === tierIndex - 1);
    if (lower.length > 0) return lower[hash % lower.length];
  }
  return pool[hash % pool.length];
}

export const HIDDEN_QUESTS: HiddenQuestDef[] = [
  // ============================= TIER 1 — NOVICE (level 1–3) =============================
  { id: 'HQ-001', title: 'Drink 3L of water', description: 'Hydrate like a hunter. 3 liters of water before bed tonight.', icon: '💧', baseXp: 40, difficulty: 1, tier: 1 },
  { id: 'HQ-002', title: 'Take a cold shower', description: 'Steel your will. A full cold shower — no warm water, no compromises.', icon: '❄️', baseXp: 45, difficulty: 1, tier: 1 },
  { id: 'HQ-003', title: 'Read 10 pages of a book', description: 'Feed your mind. Read at least 10 pages of a real book today.', icon: '📖', baseXp: 40, difficulty: 1, tier: 1 },
  { id: 'HQ-004', title: 'Walk 5,000 steps', description: 'Keep moving. Reach 5,000 steps before the day ends.', icon: '🚶', baseXp: 40, difficulty: 1, tier: 1 },
  { id: 'HQ-005', title: 'Journal 5 lines before bed', description: 'Reflect on the day. Write 5 lines in your journal before sleeping.', icon: '✍️', baseXp: 40, difficulty: 1, tier: 1 },
  { id: 'HQ-006', title: '20 minutes of focused work', description: 'Light the spark. One block of 20 uninterrupted minutes on your top task.', icon: '⏱️', baseXp: 45, difficulty: 1, tier: 1 },
  { id: 'HQ-007', title: 'Make your bed as soon as you wake', description: 'Win the first battle of the day. Make your bed before anything else.', icon: '🛏️', baseXp: 40, difficulty: 1, tier: 1 },
  { id: 'HQ-008', title: 'No soda today', description: 'Drop the sugar bombs. Zero soda from sunrise to midnight.', icon: '🥤', baseXp: 45, difficulty: 1, tier: 1 },
  { id: 'HQ-009', title: 'Eat at least one fruit', description: 'Natural mana. Eat at least one whole piece of fruit today.', icon: '🍎', baseXp: 40, difficulty: 1, tier: 1 },
  { id: 'HQ-010', title: '10 push-ups', description: 'A quick burst of power. 10 push-ups, any time of day.', icon: '💪', baseXp: 40, difficulty: 1, tier: 1 },
  { id: 'HQ-011', title: 'Meditate for 5 minutes', description: 'Clear the noise. Five quiet minutes of meditation.', icon: '🧘', baseXp: 40, difficulty: 1, tier: 1 },
  { id: 'HQ-012', title: 'No phone for the first 30 minutes after waking', description: 'Claim your morning. No phone until 30 minutes after you wake.', icon: '📵', baseXp: 45, difficulty: 1, tier: 1 },
  { id: 'HQ-013', title: 'Help someone today', description: 'A hunter protects. Do one genuine act of help for someone else.', icon: '🤝', baseXp: 45, difficulty: 1, tier: 1 },
  { id: 'HQ-014', title: 'Write down 3 goals for tomorrow', description: 'Scout the battlefield. Write 3 concrete goals for tomorrow.', icon: '🎯', baseXp: 40, difficulty: 1, tier: 1 },
  { id: 'HQ-015', title: 'No screens during meals', description: 'Eat like a hunter — no phone, no TV, no laptop at the table.', icon: '🍽️', baseXp: 45, difficulty: 1, tier: 1 },
  { id: 'HQ-016', title: 'Take the stairs instead of the elevator', description: 'Every step is XP. Choose the stairs every single time today.', icon: '🪜', baseXp: 40, difficulty: 1, tier: 1 },
  { id: 'HQ-017', title: 'Stretch for 10 minutes', description: 'Oil the joints. Ten minutes of stretching, morning or night.', icon: '🤸', baseXp: 40, difficulty: 1, tier: 1 },
  { id: 'HQ-018', title: 'Pack your own lunch', description: 'Control your fuel. Prepare and pack today\u2019s lunch yourself.', icon: '🎒', baseXp: 45, difficulty: 1, tier: 1 },
  { id: 'HQ-019', title: 'Write down 1 thing you are grateful for', description: 'Gratitude is a stat. Note one genuine thing you are grateful for.', icon: '🙏', baseXp: 40, difficulty: 1, tier: 1 },
  { id: 'HQ-020', title: 'Listen to a podcast or audiobook for 15 minutes', description: 'Level up passively. 15 minutes of a podcast or audiobook.', icon: '🎧', baseXp: 40, difficulty: 1, tier: 1 },
  { id: 'HQ-021', title: 'Walk after dinner', description: 'Settle the mana. A 15-minute walk after your evening meal.', icon: '🌆', baseXp: 40, difficulty: 1, tier: 1 },
  { id: 'HQ-022', title: 'Eat greens with lunch', description: 'Vitality buff. Make sure lunch includes a serving of greens.', icon: '🥬', baseXp: 40, difficulty: 1, tier: 1 },
  { id: 'HQ-023', title: 'No complaining for the whole day', description: 'Mind discipline. Zero complaints from sunrise to midnight.', icon: '😤', baseXp: 50, difficulty: 2, tier: 1 },
  { id: 'HQ-024', title: 'Declutter one drawer or shelf', description: 'Order the inventory. Fully declutter one drawer or shelf.', icon: '🗂️', baseXp: 45, difficulty: 1, tier: 1 },
  { id: 'HQ-025', title: 'Call a family member', description: 'Strengthen bonds. Call a family member and actually talk.', icon: '📞', baseXp: 40, difficulty: 1, tier: 1 },
  { id: 'HQ-026', title: 'Wake up without snoozing', description: 'No retreat. Get up on the first alarm, no snooze.', icon: '⏰', baseXp: 45, difficulty: 1, tier: 1 },
  { id: 'HQ-027', title: 'Drink water before every meal', description: 'Ritual of hydration. A full glass of water before each meal.', icon: '🥛', baseXp: 40, difficulty: 1, tier: 1 },
  { id: 'HQ-028', title: 'No junk food today', description: 'Pure discipline. Zero chips, candy, or fried junk today.', icon: '🚫', baseXp: 50, difficulty: 2, tier: 1 },
  { id: 'HQ-029', title: 'Tidy your desk before starting work', description: 'A clean field of battle. Fully tidy your workspace first.', icon: '🖥️', baseXp: 40, difficulty: 1, tier: 1 },
  { id: 'HQ-030', title: 'Do 10 squats', description: 'Leg day begins small. 10 squats, any time of day.', icon: '🦵', baseXp: 40, difficulty: 1, tier: 1 },
  { id: 'HQ-031', title: 'Floss your teeth', description: 'Details matter. Floss tonight — no skipping.', icon: '🦷', baseXp: 40, difficulty: 1, tier: 1 },
  { id: 'HQ-032', title: 'No social media for 1 hour', description: 'Cut the distraction. One full hour off social media.', icon: '📴', baseXp: 45, difficulty: 1, tier: 1 },
  { id: 'HQ-033', title: 'Prepare your outfit for tomorrow', description: 'Be ready before dawn. Lay out tomorrow\u2019s outfit tonight.', icon: '👕', baseXp: 40, difficulty: 1, tier: 1 },
  { id: 'HQ-034', title: 'Say thank you to someone who helped you', description: 'Acknowledge the party. Thank someone who has helped you.', icon: '💌', baseXp: 40, difficulty: 1, tier: 1 },
  { id: 'HQ-035', title: 'Do 1 pomodoro (25 min) of study', description: 'Begin the grind. One 25-minute pomodoro of real study.', icon: '🍅', baseXp: 45, difficulty: 1, tier: 1 },
  { id: 'HQ-036', title: 'Sleep 8 hours tonight', description: 'Regenerate HP. Be in bed with lights out for 8 hours.', icon: '😴', baseXp: 45, difficulty: 1, tier: 1 },
  { id: 'HQ-037', title: 'No caffeine after 4 PM', description: 'Protect your sleep. Zero caffeine after 4:00 PM today.', icon: '☕', baseXp: 40, difficulty: 1, tier: 1 },
  { id: 'HQ-038', title: 'Eat one meal slowly, no distractions', description: 'Mindful fuel. Eat one full meal slowly, tasting every bite.', icon: '🍲', baseXp: 45, difficulty: 1, tier: 1 },
  { id: 'HQ-039', title: 'Write a to-do list for the day', description: 'Plan the raid. Write a complete to-do list this morning.', icon: '📝', baseXp: 40, difficulty: 1, tier: 1 },
  { id: 'HQ-040', title: 'Do 30 jumping jacks', description: 'Ignite the heart. 30 jumping jacks, anywhere, anytime.', icon: '⚡', baseXp: 40, difficulty: 1, tier: 1 },
  { id: 'HQ-041', title: 'Drink herbal tea instead of a snack', description: 'Swap the craving. Choose herbal tea over an evening snack.', icon: '🍵', baseXp: 40, difficulty: 1, tier: 1 },
  { id: 'HQ-042', title: 'Learn 5 new words in a foreign language', description: 'Expand the codex. Learn and review 5 new vocabulary words.', icon: '🗣️', baseXp: 45, difficulty: 1, tier: 1 },
  { id: 'HQ-043', title: 'Read one article on personal growth', description: 'Study the craft. Read one full article on self-improvement.', icon: '📰', baseXp: 40, difficulty: 1, tier: 1 },
  { id: 'HQ-044', title: 'Stand up and move every hour', description: 'Break the stasis. Get up and move for 2 minutes every hour.', icon: '🧍', baseXp: 45, difficulty: 1, tier: 1 },
  { id: 'HQ-045', title: 'No screens 30 minutes before bed', description: 'Wind down properly. No screens in the final 30 minutes before sleep.', icon: '🌙', baseXp: 45, difficulty: 1, tier: 1 },

  // ============================= TIER 2 — INITIATE (level 4–7) =============================
  { id: 'HQ-046', title: 'Walk 10,000 steps', description: 'Keep moving. Reach 10,000 steps before the day ends.', icon: '🚶', baseXp: 60, difficulty: 2, tier: 2 },
  { id: 'HQ-047', title: 'Read 20 pages of a book', description: 'Feed your mind. Read at least 20 pages of a real book today.', icon: '📖', baseXp: 55, difficulty: 1, tier: 2 },
  { id: 'HQ-048', title: '1 hour of deep work with phone away', description: 'Enter the flow state. One uninterrupted hour on your most important task.', icon: '🧠', baseXp: 60, difficulty: 2, tier: 2 },
  { id: 'HQ-049', title: '20 push-ups + 20 squats', description: 'A quick burst of power. 20 push-ups and 20 squats, any time of day.', icon: '💪', baseXp: 55, difficulty: 1, tier: 2 },
  { id: 'HQ-050', title: 'No screens after 9 PM', description: 'Cut the distractions. No phone, no laptop, no TV after 9:00 PM.', icon: '📵', baseXp: 55, difficulty: 1, tier: 2 },
  { id: 'HQ-051', title: 'No sugar or junk food all day', description: 'Pure discipline. Zero sugar, zero junk food from sunrise to midnight.', icon: '🚫', baseXp: 65, difficulty: 2, tier: 2 },
  { id: 'HQ-052', title: 'Complete 5 daily quests before noon', description: 'The System demands speed. Finish 5 of today\u2019s daily quests before 12:00 PM.', icon: '⚡', baseXp: 60, difficulty: 2, tier: 2 },
  { id: 'HQ-053', title: 'Journal 10 lines before bed', description: 'Reflect on the day. Write 10 lines in your journal before sleeping.', icon: '✍️', baseXp: 55, difficulty: 1, tier: 2 },
  { id: 'HQ-054', title: 'Meditate for 15 minutes', description: 'Deepen the silence. Fifteen minutes of focused meditation.', icon: '🧘', baseXp: 55, difficulty: 1, tier: 2 },
  { id: 'HQ-055', title: 'Run 3 km', description: 'Chase the horizon. Run a full 3 km without stopping.', icon: '🏃', baseXp: 60, difficulty: 2, tier: 2 },
  { id: 'HQ-056', title: 'No phone for the first hour after waking', description: 'Own the morning. No phone for a full hour after waking.', icon: '📴', baseXp: 55, difficulty: 1, tier: 2 },
  { id: 'HQ-057', title: 'Cook a full meal from scratch', description: 'Master the kitchen. Cook one complete meal from raw ingredients.', icon: '🍳', baseXp: 60, difficulty: 2, tier: 2 },
  { id: 'HQ-058', title: 'Solve 1 DSA problem', description: 'Sharpen the blade. Solve 1 LeetCode problem without peeking.', icon: '⚔️', baseXp: 65, difficulty: 2, tier: 2 },
  { id: 'HQ-059', title: '4 pomodoros of focused study', description: 'Stack the focus. Four 25-minute pomodoros with real breaks.', icon: '🍅', baseXp: 60, difficulty: 2, tier: 2 },
  { id: 'HQ-060', title: 'Do a 45-minute workout', description: 'Burn the energy. 45 minutes of any real workout.', icon: '🏋️', baseXp: 60, difficulty: 2, tier: 2 },
  { id: 'HQ-061', title: 'No complaining — full day', description: 'Mind iron. Zero complaints, zero negativity from sunrise to midnight.', icon: '😤', baseXp: 60, difficulty: 2, tier: 2 },
  { id: 'HQ-062', title: 'Drink 3L of water', description: 'Hydrate like a hunter. 3 liters of water before bed tonight.', icon: '💧', baseXp: 55, difficulty: 1, tier: 2 },
  { id: 'HQ-063', title: 'Declutter for 20 minutes', description: 'Clear the field. 20 focused minutes of decluttering any space.', icon: '🧹', baseXp: 55, difficulty: 1, tier: 2 },
  { id: 'HQ-064', title: 'Plan your entire week', description: 'Scout ahead. Map out every day of the coming week.', icon: '🗓️', baseXp: 60, difficulty: 2, tier: 2 },
  { id: 'HQ-065', title: 'Deep breathing for 10 minutes', description: 'Control the mana flow. Ten minutes of slow, deep breathing.', icon: '🌬️', baseXp: 55, difficulty: 1, tier: 2 },
  { id: 'HQ-066', title: '50 push-ups in sets', description: 'Build the chest. 50 push-ups in sets, any time of day.', icon: '💪', baseXp: 60, difficulty: 2, tier: 2 },
  { id: 'HQ-067', title: 'Stretch for 20 minutes', description: 'Full mobility ritual. Twenty minutes of stretching.', icon: '🤸', baseXp: 55, difficulty: 1, tier: 2 },
  { id: 'HQ-068', title: 'No screens 1 hour before bed', description: 'Deep sleep protocol. No screens for the final hour before sleep.', icon: '🌙', baseXp: 55, difficulty: 1, tier: 2 },
  { id: 'HQ-069', title: 'Do one hard conversation you have been avoiding', description: 'Face the boss. Have the difficult conversation you\u2019ve postponed.', icon: '🗨️', baseXp: 70, difficulty: 3, tier: 2 },
  { id: 'HQ-070', title: 'Inbox zero', description: 'Clear the queue. Get your email inbox to zero.', icon: '📭', baseXp: 55, difficulty: 1, tier: 2 },
  { id: 'HQ-071', title: 'Write down 5 things you are grateful for', description: 'Stack the gratitude. Write five genuine gratitudes.', icon: '🙏', baseXp: 55, difficulty: 1, tier: 2 },
  { id: 'HQ-072', title: '20 minutes of sunlight outside', description: 'Absorb the light. Twenty minutes of real outdoor sunlight.', icon: '☀️', baseXp: 55, difficulty: 1, tier: 2 },
  { id: 'HQ-073', title: 'No caffeine after 2 PM', description: 'Protect deep sleep. Zero caffeine after 2:00 PM.', icon: '☕', baseXp: 55, difficulty: 1, tier: 2 },
  { id: 'HQ-074', title: 'Eat 2 servings of vegetables', description: 'Armor of health. Two full servings of vegetables today.', icon: '🥦', baseXp: 55, difficulty: 1, tier: 2 },
  { id: 'HQ-075', title: 'Do 1 DSA problem + review yesterday\u2019s', description: 'Compound the skill. Solve one problem and review the last one.', icon: '🧩', baseXp: 70, difficulty: 2, tier: 2 },
  { id: 'HQ-076', title: 'Read one chapter of a non-fiction book', description: 'Absorb knowledge. One full chapter of a non-fiction book.', icon: '📚', baseXp: 60, difficulty: 2, tier: 2 },
  { id: 'HQ-077', title: 'Screen-free lunch break', description: 'True reset. Eat lunch with zero screens.', icon: '🍽️', baseXp: 55, difficulty: 1, tier: 2 },
  { id: 'HQ-078', title: 'Help someone for 30+ minutes', description: 'True protection. Dedicate 30 minutes to genuinely helping someone.', icon: '🤝', baseXp: 60, difficulty: 2, tier: 2 },
  { id: 'HQ-079', title: 'Cold shower + 10 deep breaths', description: 'Double awakening. Cold shower immediately followed by 10 deep breaths.', icon: '❄️', baseXp: 65, difficulty: 2, tier: 2 },
  { id: 'HQ-080', title: 'Plan and prep tomorrow\u2019s meals', description: 'Feed the future. Plan and prep all of tomorrow\u2019s meals today.', icon: '🍱', baseXp: 60, difficulty: 2, tier: 2 },
  { id: 'HQ-081', title: 'Phone in another room while working', description: 'Remove the temptation. Work with your phone in a different room.', icon: '📳', baseXp: 60, difficulty: 2, tier: 2 },
  { id: 'HQ-082', title: 'Do 2 hours of standing-desk work', description: 'Defy the chair. Accumulate 2 hours of standing work.', icon: '🧍', baseXp: 55, difficulty: 1, tier: 2 },
  { id: 'HQ-083', title: '20 squats + 20 lunges', description: 'Leg strength rising. 20 squats and 20 lunges today.', icon: '🦵', baseXp: 55, difficulty: 1, tier: 2 },
  { id: 'HQ-084', title: 'Write 200 words in your journal', description: 'Process the day. Write 200 words — thoughts, plans, anything.', icon: '✍️', baseXp: 60, difficulty: 2, tier: 2 },
  { id: 'HQ-085', title: 'No social media the whole day', description: 'Full detox. Zero social media from sunrise to midnight.', icon: '📴', baseXp: 65, difficulty: 2, tier: 2 },
  { id: 'HQ-086', title: 'Sleep by 11 PM', description: 'Early night protocol. Lights out by 11:00 PM.', icon: '😴', baseXp: 55, difficulty: 1, tier: 2 },
  { id: 'HQ-087', title: 'Take a 30-minute walk outside', description: 'Recover and observe. A full 30-minute outdoor walk.', icon: '🌳', baseXp: 55, difficulty: 1, tier: 2 },
  { id: 'HQ-088', title: 'Review and update your goals', description: 'Recheck the compass. Review all goals and update them.', icon: '🧭', baseXp: 60, difficulty: 2, tier: 2 },
  { id: 'HQ-089', title: 'Do 1 hour of skill practice', description: 'Train the craft. One focused hour on any skill you\u2019re building.', icon: '🎯', baseXp: 60, difficulty: 2, tier: 2 },
  { id: 'HQ-090', title: 'Eat dinner at least 3 hours before bed', description: 'Rested digestion. Finish dinner 3+ hours before sleeping.', icon: '🕗', baseXp: 55, difficulty: 1, tier: 2 },

  // ============================= TIER 3 — ADEPT (level 8–14) =============================
  { id: 'HQ-091', title: 'Solve 3 DSA problems', description: 'Sharpen the blade. Solve 3 LeetCode problems without peeking at solutions.', icon: '⚔️', baseXp: 95, difficulty: 3, tier: 3 },
  { id: 'HQ-092', title: '2 hours of deep work', description: 'Master the flow. Two uninterrupted hours on your most important task.', icon: '🧠', baseXp: 90, difficulty: 2, tier: 3 },
  { id: 'HQ-093', title: 'Run 5 km', description: 'Outrun yesterday. Run a full 5 km without stopping.', icon: '🏃', baseXp: 90, difficulty: 2, tier: 3 },
  { id: 'HQ-094', title: 'Read 40 pages of a book', description: 'Absorb the tome. Read at least 40 pages today.', icon: '📖', baseXp: 85, difficulty: 2, tier: 3 },
  { id: 'HQ-095', title: 'No screens after 8 PM', description: 'Nightfall discipline. No screens after 8:00 PM.', icon: '📵', baseXp: 85, difficulty: 2, tier: 3 },
  { id: 'HQ-096', title: 'Wake up at 5 AM', description: 'Greet the dawn. Out of bed by 5:00 AM — no exceptions.', icon: '🌅', baseXp: 85, difficulty: 2, tier: 3 },
  { id: 'HQ-097', title: '15,000 steps', description: 'Relentless motion. Reach 15,000 steps before midnight.', icon: '🚶', baseXp: 90, difficulty: 2, tier: 3 },
  { id: 'HQ-098', title: 'Journal 20 lines before bed', description: 'Deep reflection. Write 20 lines in your journal tonight.', icon: '✍️', baseXp: 85, difficulty: 2, tier: 3 },
  { id: 'HQ-099', title: '30 push-ups + 50 squats', description: 'The classic gauntlet. 30 push-ups and 50 squats.', icon: '💪', baseXp: 85, difficulty: 2, tier: 3 },
  { id: 'HQ-100', title: 'Meditate for 30 minutes', description: 'Master the mind. A full 30-minute meditation session.', icon: '🧘', baseXp: 90, difficulty: 2, tier: 3 },
  { id: 'HQ-101', title: 'Cold shower + 20 push-ups immediately after', description: 'Shock and power. Cold shower, then 20 push-ups right after.', icon: '❄️', baseXp: 90, difficulty: 2, tier: 3 },
  { id: 'HQ-102', title: 'No phone for 3 consecutive hours', description: 'Complete detachment. Three straight hours without your phone.', icon: '📴', baseXp: 85, difficulty: 2, tier: 3 },
  { id: 'HQ-103', title: '12 pomodoros of deep study', description: 'The full grind. Twelve 25-minute pomodoros today.', icon: '🍅', baseXp: 95, difficulty: 3, tier: 3 },
  { id: 'HQ-104', title: 'Do a 60-minute workout', description: 'Full stamina burn. One complete hour of training.', icon: '🏋️', baseXp: 90, difficulty: 2, tier: 3 },
  { id: 'HQ-105', title: 'Write 500 words', description: 'Open the flow. Write 500 words of anything meaningful.', icon: '✍️', baseXp: 90, difficulty: 2, tier: 3 },
  { id: 'HQ-106', title: 'Complete 8 daily quests before 2 PM', description: 'Speed of the System. Finish 8 dailies before 2:00 PM.', icon: '⚡', baseXp: 90, difficulty: 2, tier: 3 },
  { id: 'HQ-107', title: 'No sugar, no junk, no soda — full day', description: 'Triple lockdown. Zero sugar, junk, or soda all day.', icon: '🚫', baseXp: 95, difficulty: 3, tier: 3 },
  { id: 'HQ-108', title: 'Teach someone something you know', description: 'Pass on the knowledge. Teach one skill to someone for 20+ minutes.', icon: '🎓', baseXp: 90, difficulty: 2, tier: 3 },
  { id: 'HQ-109', title: 'Do a full-body mobility routine', description: 'Unlock the joints. A complete 30-minute mobility routine.', icon: '🤸', baseXp: 85, difficulty: 2, tier: 3 },
  { id: 'HQ-110', title: 'Eat 3 healthy meals, no snacks', description: 'Clean fuel cycle. Three healthy meals, zero snacks.', icon: '🥗', baseXp: 85, difficulty: 2, tier: 3 },
  { id: 'HQ-111', title: 'No screens 2 hours before bed', description: 'Sleep purity. No screens for 2 full hours before sleep.', icon: '🌙', baseXp: 85, difficulty: 2, tier: 3 },
  { id: 'HQ-112', title: 'Do 1 architecture or system design deep dive', description: 'Study the edifice. One deep-dive on a system design topic.', icon: '🏗️', baseXp: 95, difficulty: 3, tier: 3 },
  { id: 'HQ-113', title: 'Prepare and finish a weekly review', description: 'Close the loop. Do a complete weekly review of wins and losses.', icon: '📊', baseXp: 90, difficulty: 2, tier: 3 },
  { id: 'HQ-114', title: 'Complete a 10-minute cold shower', description: 'Full frost exposure. A complete 10-minute cold shower.', icon: '🧊', baseXp: 95, difficulty: 3, tier: 3 },
  { id: 'HQ-115', title: 'Wake at 5 AM + cold shower + meditate', description: 'The triple dawn ritual. Wake at 5, cold shower, 10-minute meditation.', icon: '🌄', baseXp: 100, difficulty: 3, tier: 3 },
  { id: 'HQ-116', title: 'No social media all day + journal your urges', description: 'Detox with data. No social media, and write about the urges.', icon: '🔒', baseXp: 90, difficulty: 2, tier: 3 },
  { id: 'HQ-117', title: 'Drink 4L of water', description: 'Deep hydration. 4 liters of water before bed.', icon: '💧', baseXp: 80, difficulty: 1, tier: 3 },
  { id: 'HQ-118', title: 'Do 2 DSA problems + 1 system design reading', description: 'Stack the skills. Two problems and one design reading.', icon: '🧩', baseXp: 95, difficulty: 3, tier: 3 },
  { id: 'HQ-119', title: 'Intermittent fast for 16 hours', description: 'The healing window. 16 hours without food (water allowed).', icon: '⏳', baseXp: 90, difficulty: 2, tier: 3 },
  { id: 'HQ-120', title: 'Give a genuine compliment to 3 people', description: 'Spread the light. Three real compliments today.', icon: '💬', baseXp: 80, difficulty: 1, tier: 3 },
  { id: 'HQ-121', title: 'Do 100 push-ups in sets', description: 'The century mark. 100 push-ups, split into sets.', icon: '💪', baseXp: 90, difficulty: 2, tier: 3 },
  { id: 'HQ-122', title: 'Plan the entire month', description: 'Long-range scouting. Map the whole month ahead.', icon: '🗓️', baseXp: 85, difficulty: 2, tier: 3 },
  { id: 'HQ-123', title: 'Complete a 45-minute yoga session', description: 'Flex the spirit. A full 45-minute yoga flow.', icon: '🧘', baseXp: 85, difficulty: 2, tier: 3 },
  { id: 'HQ-124', title: 'Do one thing you have been procrastinating on for weeks', description: 'Slay the ancient boss. Finish the task you keep postponing.', icon: '🗡️', baseXp: 100, difficulty: 3, tier: 3 },
  { id: 'HQ-125', title: 'Sleep by 10 PM', description: 'The early-night rank-up. Lights out by 10:00 PM.', icon: '😴', baseXp: 85, difficulty: 2, tier: 3 },
  { id: 'HQ-126', title: 'Read 20 pages + take notes', description: 'Active reading. 20 pages with real notes in the margin.', icon: '📝', baseXp: 85, difficulty: 2, tier: 3 },
  { id: 'HQ-127', title: 'Do a 20-minute HIIT session', description: 'Explosive intervals. Twenty minutes of real HIIT.', icon: '🔥', baseXp: 90, difficulty: 2, tier: 3 },
  { id: 'HQ-128', title: 'No complaining + no gossip — full day', description: 'Pure speech. Zero complaints, zero gossip all day.', icon: '🤐', baseXp: 85, difficulty: 2, tier: 3 },
  { id: 'HQ-129', title: 'Work on your side project for 2 hours', description: 'Build the empire. Two hours on your own project.', icon: '🚀', baseXp: 90, difficulty: 2, tier: 3 },
  { id: 'HQ-130', title: 'Complete an entire course module or chapter', description: 'Progress the syllabus. Finish one full module or chapter.', icon: '🎓', baseXp: 90, difficulty: 2, tier: 3 },

  // ============================= TIER 4 — EXPERT (level 15–24) =============================
  { id: 'HQ-131', title: 'Solve 4 DSA problems (2 medium, 2 hard)', description: 'The blade of an expert. Two medium and two hard problems.', icon: '⚔️', baseXp: 130, difficulty: 3, tier: 4 },
  { id: 'HQ-132', title: 'Run 10 km', description: 'The double-digit threshold. Run 10 km without stopping.', icon: '🏃', baseXp: 125, difficulty: 3, tier: 4 },
  { id: 'HQ-133', title: '3 hours of deep work before noon', description: 'Conquer the morning. Three uninterrupted deep-work hours before noon.', icon: '🧠', baseXp: 125, difficulty: 3, tier: 4 },
  { id: 'HQ-134', title: '100 push-ups + 100 squats + 100 sit-ups', description: 'The hundredfold trial. 100 of each before midnight.', icon: '💪', baseXp: 135, difficulty: 3, tier: 4 },
  { id: 'HQ-135', title: 'Complete a 24-hour media fast', description: 'Total signal blackout. No screens or social media for 24 hours.', icon: '📴', baseXp: 130, difficulty: 3, tier: 4 },
  { id: 'HQ-136', title: 'Read 60 pages of a book', description: 'Devour the volume. Read 60 pages in one sitting or split.', icon: '📖', baseXp: 115, difficulty: 2, tier: 4 },
  { id: 'HQ-137', title: 'Wake at 4:45 AM + train before 6 AM', description: 'Dawn raids. Up at 4:45 and training by 6:00.', icon: '🌅', baseXp: 120, difficulty: 2, tier: 4 },
  { id: 'HQ-138', title: 'No sugar, no junk, no screens after 8 PM', description: 'The full lockdown day. Clean fuel and an early blackout.', icon: '🚫', baseXp: 125, difficulty: 3, tier: 4 },
  { id: 'HQ-139', title: '20,000 steps', description: 'The marathon of steps. Reach 20,000 before midnight.', icon: '🚶', baseXp: 120, difficulty: 2, tier: 4 },
  { id: 'HQ-140', title: 'Meditate for 45 minutes', description: 'Monk-level focus. A full 45-minute meditation.', icon: '🧘', baseXp: 115, difficulty: 2, tier: 4 },
  { id: 'HQ-141', title: 'Do a 90-minute workout', description: 'The extended siege. Ninety minutes of real training.', icon: '🏋️', baseXp: 120, difficulty: 2, tier: 4 },
  { id: 'HQ-142', title: 'Fast for 20 hours', description: 'Deep autophagy. Twenty hours without food.', icon: '⏳', baseXp: 120, difficulty: 2, tier: 4 },
  { id: 'HQ-143', title: 'Complete 12 daily quests before 4 PM', description: 'System speed run. Finish 12 dailies before 4:00 PM.', icon: '⚡', baseXp: 120, difficulty: 2, tier: 4 },
  { id: 'HQ-144', title: 'Write 1,000 words', description: 'The thousand-word gate. Write 1,000 words today.', icon: '✍️', baseXp: 120, difficulty: 2, tier: 4 },
  { id: 'HQ-145', title: 'Do a complete system design interview question', description: 'Architect under pressure. Fully solve one system design question.', icon: '🏗️', baseXp: 135, difficulty: 3, tier: 4 },
  { id: 'HQ-146', title: '20 pomodoros of deep study', description: 'The focus marathon. Twenty full pomodoros today.', icon: '🍅', baseXp: 125, difficulty: 3, tier: 4 },
  { id: 'HQ-147', title: 'Cold shower + 50 push-ups + journal', description: 'The morning triple. Cold shower, 50 push-ups, journal entry.', icon: '🧊', baseXp: 125, difficulty: 3, tier: 4 },
  { id: 'HQ-148', title: 'Prepare an entire week of healthy meals', description: 'The week-long supply. Prep all meals for the next 7 days.', icon: '🍱', baseXp: 115, difficulty: 2, tier: 4 },
  { id: 'HQ-149', title: 'No social media for 48 hours', description: 'The deep detox. Two full days off social media.', icon: '🔒', baseXp: 125, difficulty: 3, tier: 4 },
  { id: 'HQ-150', title: 'Have a 60-minute hard conversation', description: 'Face the dragon. One hour of honest, difficult conversation.', icon: '🗨️', baseXp: 120, difficulty: 2, tier: 4 },
  { id: 'HQ-151', title: 'Do 200 push-ups in sets', description: 'Double century. 200 push-ups, any split.', icon: '💪', baseXp: 120, difficulty: 2, tier: 4 },
  { id: 'HQ-152', title: 'Read one full technical paper or RFC', description: 'Study the blueprints. Read one complete technical paper or RFC.', icon: '📜', baseXp: 125, difficulty: 3, tier: 4 },
  { id: 'HQ-153', title: 'Complete a 10 km walk before sunrise', description: 'Walk in the dark. 10 km on foot before the sun rises.', icon: '🌄', baseXp: 120, difficulty: 2, tier: 4 },
  { id: 'HQ-154', title: 'Do a digital declutter — delete 100+ files/photos', description: 'Purge the inventory. Delete or archive 100+ files.', icon: '🗑️', baseXp: 110, difficulty: 1, tier: 4 },
  { id: 'HQ-155', title: 'Sleep 9 hours tonight', description: 'Maximum recovery. Nine full hours of sleep.', icon: '😴', baseXp: 110, difficulty: 1, tier: 4 },
  { id: 'HQ-156', title: 'Teach someone for 1 hour', description: 'The master\u2019s duty. Teach someone a skill for a full hour.', icon: '🎓', baseXp: 115, difficulty: 2, tier: 4 },
  { id: 'HQ-157', title: 'Build and ship one small thing today', description: 'Ship or perish. Build and ship a small project or feature today.', icon: '🚀', baseXp: 130, difficulty: 3, tier: 4 },
  { id: 'HQ-158', title: 'Complete a 15-minute cold plunge or shower', description: 'The arctic trial. Fifteen full minutes in cold water.', icon: '🧊', baseXp: 125, difficulty: 3, tier: 4 },
  { id: 'HQ-159', title: 'No phone, no laptop, no TV after 7 PM', description: 'The early blackout. All screens off by 7:00 PM.', icon: '📵', baseXp: 115, difficulty: 2, tier: 4 },
  { id: 'HQ-160', title: 'Do 5 DSA problems (any difficulty)', description: 'Volume grind. Five LeetCode problems in one day.', icon: '⚔️', baseXp: 130, difficulty: 3, tier: 4 },
  { id: 'HQ-161', title: 'Finish the task list for the entire week', description: 'Complete the quest board. Clear your full week\u2019s to-do list.', icon: '✅', baseXp: 125, difficulty: 3, tier: 4 },
  { id: 'HQ-162', title: 'Journal for 30 minutes', description: 'The deep reflection. Thirty minutes of continuous journaling.', icon: '✍️', baseXp: 110, difficulty: 1, tier: 4 },
  { id: 'HQ-163', title: 'Do a 60-minute yoga + breathwork session', description: 'Body and breath mastery. One hour of yoga and breathwork.', icon: '🧘', baseXp: 115, difficulty: 2, tier: 4 },
  { id: 'HQ-164', title: 'Lead a meeting or discussion today', description: 'Command the room. Lead or facilitate a meeting/discussion.', icon: '🎤', baseXp: 115, difficulty: 2, tier: 4 },
  { id: 'HQ-165', title: 'Spend 3 hours with your family, no phones', description: 'The bond quest. Three phone-free hours with family.', icon: '👨‍👩‍👧', baseXp: 110, difficulty: 1, tier: 4 },
  { id: 'HQ-166', title: 'Complete 2 system design deep-dives', description: 'Twin towers. Two full system design deep-dives.', icon: '🏗️', baseXp: 135, difficulty: 3, tier: 4 },
  { id: 'HQ-167', title: 'Do 1,000 steps every hour for 12 hours', description: 'The hourly pilgrimage. 1,000 steps each hour, twelve times.', icon: '🚶', baseXp: 120, difficulty: 2, tier: 4 },
  { id: 'HQ-168', title: 'Meditate 5 times for 10 minutes', description: 'Five gates of stillness. Five separate 10-minute meditations.', icon: '🧘', baseXp: 115, difficulty: 2, tier: 4 },
  { id: 'HQ-169', title: 'Clean and organize your entire room', description: 'The full purge. Deep-clean and reorganize your whole room.', icon: '🧹', baseXp: 110, difficulty: 1, tier: 4 },
  { id: 'HQ-170', title: 'Do a 24-hour no-complaint, no-gossip, no-negativity fast', description: 'The speech gauntlet. 24 hours of purely positive speech.', icon: '🤐', baseXp: 115, difficulty: 2, tier: 4 },

  // ============================= TIER 5 — MASTER (level 25+) =============================
  { id: 'HQ-171', title: 'Solve 3 hard DSA problems', description: 'The master blade. Three hard LeetCode problems, no peeking.', icon: '⚔️', baseXp: 180, difficulty: 3, tier: 5 },
  { id: 'HQ-172', title: 'Run a half-marathon (21 km)', description: 'The half-dragon. Run 21 km in one go.', icon: '🏃', baseXp: 180, difficulty: 3, tier: 5 },
  { id: 'HQ-173', title: '4 hours of deep work before noon', description: 'The dawn citadel. Four uninterrupted deep-work hours before noon.', icon: '🧠', baseXp: 170, difficulty: 3, tier: 5 },
  { id: 'HQ-174', title: '150 push-ups + 150 squats + 150 sit-ups', description: 'The hundred-fifty trial. 150 of each before midnight.', icon: '💪', baseXp: 175, difficulty: 3, tier: 5 },
  { id: 'HQ-175', title: 'Complete a 36-hour media fast', description: 'The long silence. A day and a half with no screens.', icon: '📴', baseXp: 170, difficulty: 3, tier: 5 },
  { id: 'HQ-176', title: 'Read a full book in one day', description: 'The tome devourer. Finish one complete book before midnight.', icon: '📖', baseXp: 170, difficulty: 3, tier: 5 },
  { id: 'HQ-177', title: 'Wake at 4 AM and train before 5', description: 'The pre-dawn raid. Up at 4:00, training by 5:00.', icon: '🌅', baseXp: 165, difficulty: 2, tier: 5 },
  { id: 'HQ-178', title: 'Complete a 24-hour fast + 10 km walk', description: 'The empty marathon. 24 hours fasted, 10 km on foot.', icon: '⏳', baseXp: 180, difficulty: 3, tier: 5 },
  { id: 'HQ-179', title: 'Design a complete system and write the architecture doc', description: 'The grand architect. Full system design + written doc.', icon: '🏗️', baseXp: 185, difficulty: 3, tier: 5 },
  { id: 'HQ-180', title: 'Do 300 push-ups in sets', description: 'The triple century. 300 push-ups, any split.', icon: '💪', baseXp: 165, difficulty: 2, tier: 5 },
  { id: 'HQ-181', title: 'Complete 15 daily quests before 2 PM', description: 'System blitz. Fifteen dailies before 2:00 PM.', icon: '⚡', baseXp: 170, difficulty: 3, tier: 5 },
  { id: 'HQ-182', title: 'Write 2,500 words', description: 'The epic scroll. 2,500 words of anything real.', icon: '✍️', baseXp: 170, difficulty: 2, tier: 5 },
  { id: 'HQ-183', title: 'No sugar, no junk, no screens after 7 PM, 2L before noon', description: 'The mastery day. Every discipline rule, all at once.', icon: '🏆', baseXp: 185, difficulty: 3, tier: 5 },
  { id: 'HQ-184', title: 'Complete a 20-minute cold immersion', description: 'The arctic mastery. Twenty full minutes in cold water.', icon: '🧊', baseXp: 175, difficulty: 3, tier: 5 },
  { id: 'HQ-185', title: 'Meditate for 1 hour', description: 'The hour of silence. A full hour of meditation.', icon: '🧘', baseXp: 160, difficulty: 2, tier: 5 },
  { id: 'HQ-186', title: 'Solve a full LeetCode hard + write a blog post about it', description: 'Teach the hard way. One hard problem, fully explained in writing.', icon: '📝', baseXp: 185, difficulty: 3, tier: 5 },
  { id: 'HQ-187', title: 'Do a 2-hour workout split', description: 'The extended siege. Two hours of structured training.', icon: '🏋️', baseXp: 165, difficulty: 2, tier: 5 },
  { id: 'HQ-188', title: 'Lead a project to completion in one day', description: 'The one-day crusade. Take a project from start to done today.', icon: '🎯', baseXp: 180, difficulty: 3, tier: 5 },
  { id: 'HQ-189', title: 'No social media for 72 hours', description: 'The week detox compressed. Three days off social media.', icon: '🔒', baseXp: 170, difficulty: 3, tier: 5 },
  { id: 'HQ-190', title: 'Give a 30-minute talk or presentation', description: 'Command the hall. Deliver a 30-minute talk to anyone.', icon: '🎤', baseXp: 165, difficulty: 2, tier: 5 },
  { id: 'HQ-191', title: 'Complete 2 hard DSA problems + 1 system design deep-dive', description: 'The full assault. Two hards and one architecture deep-dive.', icon: '⚔️', baseXp: 190, difficulty: 3, tier: 5 },
  { id: 'HQ-192', title: 'Run 10 km before breakfast', description: 'The fasted dawn run. 10 km on an empty stomach.', icon: '🏃', baseXp: 170, difficulty: 2, tier: 5 },
  { id: 'HQ-193', title: 'Journal for 1 hour', description: 'The hour of reflection. Sixty minutes of journaling.', icon: '✍️', baseXp: 155, difficulty: 1, tier: 5 },
  { id: 'HQ-194', title: 'Do a 25-hour fast', description: 'Beyond the day. Twenty-five hours without food.', icon: '⏳', baseXp: 165, difficulty: 2, tier: 5 },
  { id: 'HQ-195', title: 'Mentor someone for 2 hours', description: 'The master-apprentice bond. Two hours of real mentorship.', icon: '🎓', baseXp: 160, difficulty: 2, tier: 5 },
  { id: 'HQ-196', title: 'Complete 5 system design flashcards + 1 deep-dive', description: 'The architecture ritual. Five design reviews, one full deep-dive.', icon: '🏗️', baseXp: 175, difficulty: 3, tier: 5 },
  { id: 'HQ-197', title: 'Do 1,000 steps every hour for 16 hours', description: 'The all-day pilgrimage. 1,000 steps hourly, sixteen times.', icon: '🚶', baseXp: 170, difficulty: 2, tier: 5 },
  { id: 'HQ-198', title: 'Build a full project from scratch and deploy it', description: 'From void to live. Build and deploy something real today.', icon: '🚀', baseXp: 190, difficulty: 3, tier: 5 },
  { id: 'HQ-199', title: 'Train twice in one day', description: 'The double session. Two full workouts, AM and PM.', icon: '💪', baseXp: 165, difficulty: 2, tier: 5 },
  { id: 'HQ-200', title: 'Sleep 8 hours for 3 consecutive nights starting tonight', description: 'The recovery pact. Begin an 8-hour sleep streak tonight.', icon: '😴', baseXp: 155, difficulty: 1, tier: 5 },
  { id: 'HQ-201', title: 'No complaining, no gossip, no negativity — 48 hours', description: 'The silence of steel. Two days of pure speech.', icon: '🤐', baseXp: 160, difficulty: 2, tier: 5 },
  { id: 'HQ-202', title: 'Do a 3-hour unbroken deep work block', description: 'The flow monolith. Three hours, no breaks, no phone.', icon: '🧠', baseXp: 175, difficulty: 3, tier: 5 },
  { id: 'HQ-203', title: 'Read 2 full technical papers', description: 'The double blueprint. Two complete papers or RFCs.', icon: '📜', baseXp: 175, difficulty: 3, tier: 5 },
  { id: 'HQ-204', title: 'Complete 20 daily quests today', description: 'The perfect day. Clear twenty dailies before midnight.', icon: '🏆', baseXp: 180, difficulty: 3, tier: 5 },
  { id: 'HQ-205', title: 'Finish a 10-day goal in a single day', description: 'The time-skip. Compress a 10-day goal into today.', icon: '⏩', baseXp: 195, difficulty: 3, tier: 5 },
];