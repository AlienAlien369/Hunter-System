import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import QuestCard from '../components/QuestCard';
import TrackReward from '../components/TrackReward';

interface TrackConfig {
  id: string;
  title: string;
  note: string;
  textClass: string;
  barClass: string;
  buttonClass: string;
  confirmMsg: string;
}

const TRACKS: TrackConfig[] = [
  {
    id: 'dsa',
    title: 'DSA PROGRESS',
    note: 'PERMANENT • MARKS STAY UNTIL YOU REDO',
    textClass: 'text-gold',
    barClass: 'from-gold to-yellow-500',
    buttonClass: 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20',
    confirmMsg: 'Reset ALL DSA problems to start from the beginning?\n\nYour XP and level will stay the same.',
  },
  {
    id: 'saas',
    title: 'SAAS PROGRESS',
    note: 'PERMANENT • MILESTONES STAY UNTIL YOU REDO',
    textClass: 'text-purple-glow',
    barClass: 'from-purple-monarch to-purple-glow',
    buttonClass: 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20',
    confirmMsg: 'Reset ALL SaaS milestones to start from the beginning?\n\nYour XP and level will stay the same.',
  },
  {
    id: 'arch',
    title: 'ARCHITECTURE PROGRESS',
    note: 'PERMANENT • CHALLENGES STAY UNTIL YOU REDO',
    textClass: 'text-red-danger',
    barClass: 'from-red-danger to-orange-400',
    buttonClass: 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20',
    confirmMsg: 'Reset ALL Architecture challenges to start from the beginning?\n\nYour XP and level will stay the same.',
  },
];

function TrackSection({
  track,
  quests,
  currentXp,
  onToggle,
  onRedo,
}: {
  track: TrackConfig;
  quests: { id: string; title: string; xpReward: number; category: string; completedDates: string[] }[];
  currentXp: number;
  onToggle: (id: string) => void;
  onRedo: () => void;
}) {
  const completed = quests.filter(q => q.completedDates.length > 0).length;
  const progress = quests.length > 0 ? (completed / quests.length) * 100 : 0;
  const allDone = quests.length > 0 && completed === quests.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className={`text-lg font-display font-bold tracking-wider ${track.textClass}`}>
            {track.title}
          </h2>
          <span className="text-xs text-gray-500 font-mono">{track.note}</span>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <p className={`text-xl font-display ${track.textClass}`}>{completed}/{quests.length}</p>
            <p className="text-xs text-gray-500 font-mono">DONE</p>
          </div>
          {allDone && (
            <button
              onClick={() => {
                if (window.confirm(track.confirmMsg)) onRedo();
              }}
              className={`px-4 py-2 border rounded-lg hover:bg-red-500/20 transition-all font-display text-sm font-bold ${track.buttonClass}`}
            >
              🔄 REDO ALL
            </button>
          )}
        </div>
      </div>

      {/* Reward Preview */}
      <TrackReward
        quests={quests.map(q => ({ xpReward: q.xpReward, done: q.completedDates.length > 0 }))}
        currentXp={currentXp}
        accentClass={track.textClass}
        chipClass="border-purple-500/10 bg-[#0d1117]/60"
      />

      {/* Track Progress Bar */}
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <motion.div
          className={`h-full bg-gradient-to-r ${track.barClass}`}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
        <span className="sr-only">{progress.toFixed(0)}% complete</span>
      </div>

      {/* Track Quest Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {quests.map((quest, index) => (
          <motion.div
            key={quest.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.02 }}
          >
            <QuestCard
              quest={{ ...quest, category: quest.category as any, completedToday: quest.completedDates.length > 0 }}
              onComplete={() => onToggle(quest.id)}
            />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

export default function QuestLog() {
  const { dailyQuests, completeQuest, redoTrack, profile } = useGameStore();
  const today = new Date().toISOString().split('T')[0];

  const dailyQuestsList = dailyQuests
    .filter(q => q.id.startsWith('DQ-'))
    .map(quest => ({
      ...quest,
      completedToday: quest.completedDates.includes(today),
    }));

  const todaysXP = dailyQuestsList.reduce((total, quest) =>
    total + (quest.completedToday ? quest.xpReward : 0), 0);

  const todaysCompleted = dailyQuestsList.filter(q => q.completedToday).length;
  const dailyProgress = dailyQuestsList.length > 0 ? (todaysCompleted / dailyQuestsList.length) * 100 : 0;

  const dsaQuests = dailyQuests.filter(q => q.id.startsWith('LC-'));
  const saasQuests = dailyQuests.filter(q => q.id.startsWith('SS-'));
  const archQuests = dailyQuests.filter(q => q.id.startsWith('AR-'));

  const trackQuestLists: Record<string, typeof dsaQuests> = {
    dsa: dsaQuests,
    saas: saasQuests,
    arch: archQuests,
  };

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
            QUEST LOG
          </h1>
          <p className="text-gray-400 mt-1 font-mono text-sm">
            Daily challenges • {new Date().toLocaleDateString()}
          </p>
        </div>

        {/* Stats Card (daily quests only) */}
        <div className="flex items-center space-x-3 sm:space-x-4 bg-[#0d1117]/80 backdrop-blur-sm rounded-lg px-3 sm:px-4 py-3 sm:py-4 border border-purple-500/20">
          <div className="text-center min-w-[3rem]">
            <p className="text-xl sm:text-2xl font-display text-gold">{todaysCompleted}</p>
            <p className="text-[10px] sm:text-xs text-gray-500 font-mono">DONE</p>
          </div>
          <div className="w-px h-8 bg-purple-500/20" />
          <div className="text-center min-w-[3rem]">
            <p className="text-xl sm:text-2xl font-display text-purple-400">{todaysXP}</p>
            <p className="text-[10px] sm:text-xs text-gray-500 font-mono">XP EARNED</p>
          </div>
          <div className="w-px h-8 bg-purple-500/20" />
          <div className="text-center min-w-[3rem]">
            <p className="text-xl sm:text-2xl font-display text-blue-400">{dailyQuestsList.length - todaysCompleted}</p>
            <p className="text-[10px] sm:text-xs text-gray-500 font-mono">LEFT</p>
          </div>
        </div>
      </motion.div>

      {/* Daily Quest Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-display text-purple-400 font-bold tracking-wider">
            DAILY QUESTS
          </h2>
          <span className="text-xs text-gray-500 font-mono">RESETS EVERY DAY • {today}</span>
        </div>

        {/* Reward Preview */}
        <TrackReward
          quests={dailyQuestsList.map(q => ({ xpReward: q.xpReward, done: q.completedToday }))}
          currentXp={profile.xp}
          label="⚡ TODAY'S XP"
          accentClass="text-purple-400"
          chipClass="border-purple-500/10 bg-[#0d1117]/60"
        />

        {/* Daily Progress Bar */}
        <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-purple-500 to-blue-500"
            initial={{ width: 0 }}
            animate={{ width: `${dailyProgress}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>

        {/* Daily Quest Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {dailyQuestsList.map((quest, index) => (
            <motion.div
              key={quest.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <QuestCard
                quest={quest}
                onComplete={() => completeQuest(quest.id, today)}
              />
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Permanent Track Sections */}
      {TRACKS.map((track, i) => (
        <motion.div
          key={track.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 * (i + 1) }}
        >
          <TrackSection
            track={track}
            quests={trackQuestLists[track.id]}
            currentXp={profile.xp}
            onToggle={id => completeQuest(id, today)}
            onRedo={() => redoTrack(track.id as 'dsa' | 'saas' | 'arch')}
          />
        </motion.div>
      ))}
    </div>
  );
}