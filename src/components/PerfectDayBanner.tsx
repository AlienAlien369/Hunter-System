import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

/** Brief celebration when the server awards the Perfect Day bonus. */
export default function PerfectDayBanner() {
  const [xp, setXp] = useState<number | null>(null);
  useEffect(() => {
    let timer = 0;
    const show = (e: Event) => {
      setXp((e as CustomEvent<number>).detail);
      clearTimeout(timer);
      timer = window.setTimeout(() => setXp(null), 4000);
    };
    window.addEventListener('hunter-perfect-day', show);
    return () => { window.removeEventListener('hunter-perfect-day', show); clearTimeout(timer); };
  }, []);
  return (
    <AnimatePresence>
      {xp !== null && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: -30, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -30 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[95] px-6 py-4 rounded-2xl border border-yellow-400/60 bg-[#1a1405]/95 shadow-2xl shadow-yellow-500/30 text-center pointer-events-none"
        >
          <p className="font-display text-yellow-300 text-xl tracking-[0.25em]">✦ PERFECT DAY ✦</p>
          <p className="font-mono text-sm text-yellow-100/90 mt-1">Every timetable quest cleared · +{xp} XP bonus</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
