import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { useEffect, useState } from 'react';
import HunterCard from '../components/HunterCard';
import QuestBoard from '../components/QuestBoard';
import AchievementPanel from '../components/AchievementPanel';

export default function StatusWindow() {
  const { profile } = useGameStore();
  const { level, xp, rank, stats } = profile;

  // Calculate progress to next level
  const currentLevelXP = (level - 1) * 1000;
  const nextLevelXP = level * 1000;
  const levelProgress = (xp - currentLevelXP) / (nextLevelXP - currentLevelXP);

  // XP gain animation trigger
  const [xpAnimation, setXpAnimation] = useState(false);

  // Watch for XP changes to trigger animation
  useEffect(() => {
    if (xpAnimation) {
      // Reset animation after it completes
      setTimeout(() => setXpAnimation(false), 800);
    }
  }, [xp, xpAnimation]);

  // Trigger XP animation when XP increases
  useEffect(() => {
    const prevXP = localStorage.getItem('prevXP');
    if (prevXP && Number(prevXP) < xp) {
      setXpAnimation(true);
    }
    localStorage.setItem('prevXP', xp.toString());
  }, [xp]);

  return (
    <div      className="min-h-[calc(100vh-64px)] p-4 sm:p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Hunter Card and Stats */}
        <div className="lg:col-span-1">
          <HunterCard
            level={level}
            xp={xp}
            rank={rank}
            stats={stats}
            levelProgress={levelProgress}
            xpAnimation={xpAnimation}
          />
        </div>

        {/* Middle Column - Quest Board */}
        <div className="lg:col-span-2">
          <QuestBoard />
        </div>

        {/* Right Column - Achievement Panel */}
        <div className="lg:col-span-1">
          <AchievementPanel />
        </div>
      </div>

      {/* Level-up animation (full screen) */}
      {level > 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0], scale: [0.8, 1.2, 1] }}
          transition={{ duration: 1.5 }}
          className="fixed inset-0 flex items-center justify-center bg-black/80 z-50 pointer-events-none"
        >
          <h1 className="text-gold font-display text-6xl font-bold">LEVEL UP!</h1>
        </motion.div>
      )}

      {/* XP gain floating animation */}
      {xpAnimation && (
        <motion.div
          initial={{ y: 0, opacity: 1 }}
          animate={{ y: -30, opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="fixed pointer-events-none text-gold font-bold text-xl"
          style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
        >
          +{xp - (Number(localStorage.getItem('prevXP')) || 0)} XP
        </motion.div>
      )}
    </div>
  );
}