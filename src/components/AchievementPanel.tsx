import { useGameStore } from '../store/gameStore';
import { motion } from 'framer-motion';

const ACHIEVEMENTS = [
  { id: 'ACH-01', title: 'First Steps', description: 'Complete your first quest', icon: '👣', xp: 50 },
  { id: 'ACH-02', title: 'Disciplined Initiate', description: 'Complete 5 discipline quests', icon: '⚔️', xp: 100 },
  { id: 'ACH-03', title: 'Skill Seeker', description: 'Complete 5 skill quests', icon: '📚', xp: 100 },
  { id: 'ACH-04', title: 'Physical Prowess', description: 'Complete 5 physical quests', icon: '💪', xp: 100 },
  { id: 'ACH-05', title: 'Nutrition Master', description: 'Complete 5 nutrition quests', icon: '🥗', xp: 100 },
  { id: 'ACH-06', title: 'SaaS Builder', description: 'Complete 5 saas quests', icon: '💻', xp: 150 },
  { id: 'ACH-07', title: 'Mindset Warrior', description: 'Complete 5 mindset quests', icon: '🧘', xp: 100 },
  { id: 'ACH-08', title: 'Spiritual Sage', description: 'Complete 5 spiritual quests', icon: '🕊️', xp: 100 },
  { id: 'ACH-09', title: 'Health Guardian', description: 'Complete 5 health quests', icon: '❤️', xp: 100 },
  { id: 'ACH-10', title: 'Elite Hunter', description: 'Reach Rank B', icon: '🏆', xp: 200 },
  { id: 'ACH-11', title: 'A-Rank Agent', description: 'Reach Rank A', icon: '🌟', xp: 300 },
  { id: 'ACH-12', title: 'S-Rank Legend', description: 'Reach Rank S', icon: '👑', xp: 500 },
];

export default function AchievementPanel() {
  const { profile } = useGameStore();
  const { xp } = profile;

  // Simple achievement tracking based on quest completion and rank
  const completedQuestCounts = {
    discipline: 0,
    skill: 0,
    physical: 0,
    nutrition: 0,
    saas: 0,
    mindset: 0,
    spiritual: 0,
    health: 0,
  };

  // Count completed quests by category (today only for simplicity)
  // In a full implementation, we'd track all-time counts
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.6 }}
      className="bg-card/80 backdrop-blur-sm rounded-2xl border border-purple-monarch/20 p-6"
    >
      <h2 className="text-xl font-display text-purple-monarch mb-4">
        ACHIEVEMENTS
      </h2>

      <div className="grid gap-3">
        {ACHIEVEMENTS.map((achievement) => (
          <motion.div
            key={achievement.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.05 * ACHIEVEMENTS.indexOf(achievement) }}
            className="bg-dungeon/50 rounded-xl border border-purple-monarch/10 p-4 flex items-center space-x-3 hover:bg-purple-monarch/10 transition-colors cursor-pointer"
          >
            <div className="w-10 h-10 flex items-center justify-center text-2xl bg-purple-monarch/20 rounded-full">
              {achievement.icon}
            </div>
            <div className="flex-1">
              <h3 className="font-display text-sm">{achievement.title}</h3>
              <p className="text-xs text-muted">{achievement.description}</p>
            </div>
            <div className="w-10 h-10 flex items-center justify-center">
              {/* Simple completion check - in reality this would be more complex */}
              {false ? (
                <svg className="text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M1 5h22M1 12h22M1 19h22" />
                </svg>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}