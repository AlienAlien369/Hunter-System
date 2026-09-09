import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { ITEMS, RARITY_CONFIG, type Rarity } from '../data/items';
import { sfx } from '../utils/sounds';

/**
 * Floating loot drop notification. Shows for 4 seconds when an item is found,
 * then auto-dismisses. Clicking "LOOT" adds it to inventory and dismisses.
 */
export default function LootDrop() {
  const { lootDrop, setLootDrop } = useGameStore();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (lootDrop) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(() => setLootDrop(null), 400); // wait for exit animation
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [lootDrop, setLootDrop]);

  if (!lootDrop) return null;

  const def = ITEMS[lootDrop.itemId];
  if (!def) return null;

  const rarity = RARITY_CONFIG[def.rarity as Rarity];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="loot-drop"
          initial={{ y: 40, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 40, opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[75]"
        >
          <div
            className={`
              relative flex items-center gap-4 px-6 py-4 rounded-2xl border backdrop-blur-xl
              bg-[#0d1117]/95 shadow-2xl
              ${rarity.borderColor} ${rarity.glow}
            `}
          >
            {/* Rarity glow ring */}
            <div
              className="absolute inset-0 rounded-2xl opacity-20"
              style={{
                background: def.rarity === 'legendary'
                  ? 'linear-gradient(135deg, rgba(250,204,21,0.3), rgba(245,158,11,0.3))'
                  : def.rarity === 'epic'
                    ? 'linear-gradient(135deg, rgba(168,85,247,0.3), rgba(139,92,246,0.3))'
                    : def.rarity === 'rare'
                      ? 'linear-gradient(135deg, rgba(59,130,246,0.3), rgba(96,165,250,0.3))'
                      : 'linear-gradient(135deg, rgba(156,163,175,0.2), rgba(107,114,128,0.2))',
              }}
            />

            {/* Item icon with rarity pulse */}
            <motion.div
              className="relative z-10 text-4xl"
              animate={
                def.rarity === 'legendary'
                  ? { scale: [1, 1.15, 1], rotate: [0, -5, 5, 0] }
                  : def.rarity === 'epic'
                    ? { scale: [1, 1.08, 1] }
                    : {}
              }
              transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1 }}
            >
              {def.icon}
            </motion.div>

            {/* Item info */}
            <div className="relative z-10 min-w-0">
              <p className="text-[10px] font-mono tracking-widest text-gray-500 uppercase mb-0.5">
                ITEM DROPPED
              </p>
              <p className={`font-display font-bold text-sm ${rarity.color}`}>
                {def.name}
              </p>
              <p className="text-[10px] font-mono text-gray-500 mt-0.5">
                {rarity.label} • {def.effect}
              </p>
            </div>

            {/* Dismiss button */}
            <button
              onClick={() => {
                setVisible(false);
                sfx.click();
                setTimeout(() => setLootDrop(null), 300);
              }}
              className="relative z-10 px-3 py-1.5 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-400 font-display text-xs font-bold hover:bg-purple-500/25 transition-colors"
            >
              LOOT
            </button>

            {/* Auto-dismiss progress bar */}
            <motion.div
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: 4, ease: 'linear' }}
              className="absolute inset-x-0 bottom-0 h-0.5 rounded-b-2xl origin-left"
              style={{
                background: def.rarity === 'legendary' ? '#facc15'
                  : def.rarity === 'epic' ? '#a855f7'
                    : def.rarity === 'rare' ? '#3b82f6'
                      : '#6b7280',
              }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
