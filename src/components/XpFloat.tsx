import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore';

/**
 * Floating "+X XP" toasts shown on every quest completion (and "-X XP" when
 * a quest is un-marked). Each toast rises and fades out over ~1.3s, then
 * removes itself; rapid completions stack neatly.
 */
export default function XpFloat() {
  const xpFloats = useGameStore(s => s.xpFloats);
  const removeXpFloat = useGameStore(s => s.removeXpFloat);

  return (
    <div className="fixed inset-x-0 bottom-8 z-[80] pointer-events-none flex flex-col items-center">
      <AnimatePresence>
        {xpFloats.map(f => {
          const isGain = f.amount > 0;
          return (
            <motion.div
              key={f.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.7 }}
              animate={{ opacity: [0, 1, 1, 0], y: [12, -24, -48, -72], scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.3, times: [0, 0.18, 0.65, 1], ease: 'easeOut' }}
              onAnimationComplete={() => removeXpFloat(f.id)}
              className={`font-display text-xl font-bold ${
                isGain
                  ? 'text-gold drop-shadow-[0_0_10px_rgba(241,196,15,0.8)]'
                  : 'text-red-400 drop-shadow-[0_0_10px_rgba(231,76,60,0.8)]'
              }`}
            >
              {isGain ? '+' : ''}{f.amount} XP
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}