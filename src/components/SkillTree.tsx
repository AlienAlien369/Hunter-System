import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { STAT_CONFIG, getActiveBuffs, getAvailableStatPoints, BASE_STATS, type StatThreshold } from '../utils/xp';
import { sfx } from '../utils/sounds';

const STAT_META: Record<string, { icon: string; color: string; barFrom: string; barTo: string }> = {
  str: { icon: '💪', color: 'text-red-400',    barFrom: 'from-red-500',    barTo: 'to-orange-500' },
  agi: { icon: '⚡', color: 'text-green-400',  barFrom: 'from-green-500',  barTo: 'to-emerald-500' },
  vit: { icon: '❤️', color: 'text-yellow-400', barFrom: 'from-green-500',  barTo: 'to-teal-500' },
  int: { icon: '🧠', color: 'text-blue-400',   barFrom: 'from-blue-500',   barTo: 'to-purple-500' },
  sen: { icon: '👁️', color: 'text-purple-400', barFrom: 'from-purple-500', barTo: 'to-pink-500' },
} as const;

function TierNode({ stat, threshold, currentValue }: { stat: string; threshold: StatThreshold; currentValue: number }) {
  const unlocked = currentValue >= threshold.min;
  const meta = STAT_META[stat];

  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-all ${
      unlocked
        ? 'bg-gray-800/60 border-gray-700/60'
        : 'bg-gray-900/30 border-gray-800/30 opacity-40'
    }`}>
      <span className={`text-xl ${unlocked ? '' : 'grayscale opacity-50'}`}>{threshold.icon}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-display font-bold ${unlocked ? threshold.color : 'text-gray-600'}`}>
          {threshold.label}
        </p>
        <p className="text-[10px] font-mono text-gray-500 truncate">{threshold.description}</p>
      </div>
      <span className={`text-[10px] font-mono ${unlocked ? 'text-gray-400' : 'text-gray-700'}`}>
        {threshold.min}
      </span>
    </div>
  );
}

function StatColumn({ statKey, value, available, onAllocate, onDeallocate }: {
  statKey: string;
  value: number;
  available: number;
  onAllocate: () => void;
  onDeallocate: () => void;
}) {
  const meta = STAT_META[statKey];
  const tiers = STAT_CONFIG[statKey];
  const baseValue = (BASE_STATS as Record<string, number>)[statKey];
  const canAlloc = available > 0;
  const canDealloc = value > baseValue;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#0d1117]/80 backdrop-blur-sm rounded-xl border border-purple-500/20 overflow-hidden"
    >
      {/* Stat header */}
      <div className="px-5 py-4 border-b border-white/5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{meta.icon}</span>
            <div>
              <h3 className="font-display text-white font-bold text-sm tracking-wider">{statKey.toUpperCase()}</h3>
              <p className="text-[10px] font-mono text-gray-500">BASE {baseValue}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <motion.span
              key={value}
              initial={{ scale: 1.3, color: '#a78bfa' }}
              animate={{ scale: 1, color: '#ffffff' }}
              className="text-3xl font-display font-bold"
            >
              {value}
            </motion.span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden mb-3">
          <motion.div
            className={`h-full bg-gradient-to-r ${meta.barFrom} ${meta.barTo}`}
            initial={{ width: 0 }}
            animate={{ width: `${(value / 100) * 100}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>

        {/* Allocate / Deallocate buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => { if (canDealloc) { onDeallocate(); } }}
            disabled={!canDealloc}
            className={`flex-1 py-1.5 rounded-lg font-mono text-xs border transition-all ${
              canDealloc
                ? 'bg-gray-800/60 text-gray-400 border-gray-700/50 hover:bg-gray-700/60 hover:text-white'
                : 'bg-gray-900/30 text-gray-700 border-gray-800/30 cursor-not-allowed'
            }`}
          >
            −1
          </button>
          <div className="flex-1 text-center">
            <span className="text-[10px] font-mono text-gray-500">SP</span>
          </div>
          <button
            onClick={() => { if (canAlloc) { onAllocate(); } }}
            disabled={!canAlloc}
            className={`flex-1 py-1.5 rounded-lg font-mono text-xs border transition-all ${
              canAlloc
                ? `bg-purple-500/15 text-purple-400 border-purple-500/30 hover:bg-purple-500/25 hover:text-purple-300`
                : 'bg-gray-900/30 text-gray-700 border-gray-800/30 cursor-not-allowed'
            }`}
          >
            +1
          </button>
        </div>
      </div>

      {/* Tier nodes */}
      <div className="p-4 space-y-2">
        <p className="text-[10px] font-mono text-gray-600 tracking-wider mb-2">PASSIVE BUFFS</p>
        {tiers.map(t => (
          <TierNode key={t.min} stat={statKey} threshold={t} currentValue={value} />
        ))}
      </div>
    </motion.div>
  );
}

export default function SkillTree() {
  const { profile, allocateStat, deallocateStat } = useGameStore();
  const available = getAvailableStatPoints(profile.level, profile.stats);
  const buffs = getActiveBuffs(profile.stats);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-display text-white font-bold tracking-wider">
            SKILL TREE
          </h1>
          <p className="text-gray-400 mt-1 font-mono text-sm">
            Allocate stat points • Unlock passive buffs
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Available points */}
          <motion.div
            className={`px-4 py-2 rounded-xl border font-mono text-sm ${
              available > 0
                ? 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                : 'bg-gray-800/50 border-gray-700/30 text-gray-500'
            }`}
            animate={available > 0 ? { scale: [1, 1.02, 1] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <span className="text-[10px] tracking-wider">AVAILABLE SP</span>
            <span className="ml-2 text-lg font-display font-bold">{available}</span>
          </motion.div>
          {/* Level badge */}
          <div className="px-4 py-2 rounded-xl border bg-gray-800/50 border-gray-700/30 text-gray-400 font-mono text-sm">
            <span className="text-[10px] tracking-wider">LEVEL</span>
            <span className="ml-2 text-lg font-display font-bold text-gold">{profile.level}</span>
          </div>
        </div>
      </motion.div>

      {/* Active buffs summary */}
      {buffs.buffs.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-purple-900/30 via-[#0d1117]/90 to-blue-900/30 backdrop-blur-sm rounded-xl border border-purple-500/20 p-4"
        >
          <h3 className="font-display text-white font-bold tracking-wider text-sm mb-3">
            ⚡ ACTIVE PASSIVE BUFFS
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {buffs.buffs.map(({ stat, threshold }) => (
              <div key={`${stat}-${threshold.min}`} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800/40 border border-gray-700/30">
                <span className="text-lg">{threshold.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-display font-bold ${threshold.color}`}>{threshold.label}</p>
                  <p className="text-[10px] font-mono text-gray-500 truncate">{threshold.description}</p>
                </div>
              </div>
            ))}
          </div>
          {buffs.xpMultiplier > 1 && (
            <p className="text-[10px] font-mono text-gray-500 mt-2">
              Total XP Multiplier: <span className="text-gold">×{buffs.xpMultiplier.toFixed(2)}</span>
            </p>
          )}
          {buffs.penaltyReduction > 0 && (
            <p className="text-[10px] font-mono text-gray-500">
              Penalty Reduction: <span className="text-green-400">-{Math.round(buffs.penaltyReduction * 100)}%</span>
            </p>
          )}
          {buffs.hiddenQuestChance > 0 && (
            <p className="text-[10px] font-mono text-gray-500">
              Hidden Quest Chance: <span className="text-purple-400">+{buffs.hiddenQuestChance}%</span>
            </p>
          )}
        </motion.div>
      )}

      {/* Stat columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {(['str', 'agi', 'vit', 'int', 'sen'] as const).map(statKey => (
          <StatColumn
            key={statKey}
            statKey={statKey}
            value={profile.stats[statKey]}
            available={available}
            onAllocate={() => allocateStat(statKey)}
            onDeallocate={() => deallocateStat(statKey)}
          />
        ))}
      </div>

      {/* XP progress hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center text-[10px] font-mono text-gray-600"
      >
        Gain {2} stat points per level up • Stats sync to the server automatically
      </motion.div>
    </div>
  );
}
