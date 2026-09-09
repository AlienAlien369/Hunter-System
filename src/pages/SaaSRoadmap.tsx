import { useGameStore } from '../store/gameStore';
import { motion } from 'framer-motion';
import { useState } from 'react';

const SAAS_STAGES = [
  { id: 1, title: 'Market Research', description: 'Validate problem-solution fit', icon: '🔍', duration: '2 weeks' },
  { id: 2, title: 'MVP Development', description: 'Build core product features', icon: '💻', duration: '6 weeks' },
  { id: 3, title: 'Beta Launch', description: 'Early user feedback & iteration', icon: '🚀', duration: '4 weeks' },
  { id: 4, title: 'Product-Market Fit', description: 'Scale user acquisition', icon: '📈', duration: '8 weeks' },
  { id: 5, title: 'Team Expansion', description: 'Hire key roles', icon: '👥', duration: '6 weeks' },
  { id: 6, title: 'Series Funding', description: 'Secure investment for growth', icon: '💰', duration: '4 weeks' },
];

const stageQuestId = (id: number) => `SS-${String(id).padStart(2, '0')}`;

export default function SaaSRoadmap() {
  const { dailyQuests, completeQuest, redoTrack } = useGameStore();
  const [expandedStage, setExpandedStage] = useState<number | null>(null);
  const today = new Date().toISOString().split('T')[0];

  const doneSet = new Set(
    dailyQuests
      .filter(q => q.id.startsWith('SS-') && q.completedDates.length > 0)
      .map(q => q.id)
  );
  const completed = doneSet.size;
  const progress = (completed / SAAS_STAGES.length) * 100;
  const allDone = completed === SAAS_STAGES.length;

  const handleToggle = (stageId: number) => {
    completeQuest(stageQuestId(stageId), today);
  };

  const handleRedo = () => {
    if (window.confirm('Reset ALL SaaS milestones to start from the beginning?\n\nYour XP and level will stay the same.')) {
      redoTrack('saas');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-[calc(100vh-64px)] p-6"
    >
      <div className="mb-6">
        <h1 className="text-2xl font-display text-purple-monarch flex items-center space-x-3">
          SAAS ROADMAP
        </h1>
      </div>

      {/* Progress Overview */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card/80 backdrop-blur-sm rounded-xl border border-purple-monarch/20 p-5 mb-6"
      >
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-display text-purple-glow font-bold tracking-wider">
              SAAS PROGRESS
            </h2>
            <span className="text-xs text-muted font-mono">PERMANENT • MILESTONES STAY UNTIL YOU REDO</span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-xl font-display text-purple-glow">{completed}/{SAAS_STAGES.length}</p>
              <p className="text-xs text-muted font-mono">MILESTONES DONE</p>
            </div>
            {allDone && (
              <button
                onClick={handleRedo}
                className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-all font-display text-sm font-bold"
              >
                🔄 REDO ALL MILESTONES
              </button>
            )}
          </div>
        </div>
        <div className="mt-4 h-2 bg-dungeon/50 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-purple-monarch to-purple-glow"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8 }}
          />
        </div>
      </motion.div>

      <div className="space-y-4">
        {SAAS_STAGES.map((stage) => {
          const isDone = doneSet.has(stageQuestId(stage.id));
          return (
            <motion.div
              key={stage.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.05 * stage.id }}
              className={`bg-card/80 backdrop-blur-sm rounded-xl border p-5 ${
                expandedStage === stage.id ? 'border-l-4 border-purple-glow' : 'border-purple-monarch/20'
              } ${isDone ? 'opacity-80' : ''}`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-purple-monarch/20">
                    <span className="text-purple-monarch font-bold text-lg">{stage.id}</span>
                  </div>
                  <div>
                    <h3 className={`font-display text-lg ${isDone ? 'text-gold line-through' : ''}`}>{stage.title}</h3>
                    <p className="text-sm text-muted">{stage.duration}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {/* Mark complete (permanent) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggle(stage.id);
                    }}
                    className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                      isDone
                        ? 'bg-gold/20 border-gold text-gold'
                        : 'bg-dungeon/50 border-purple-monarch/30 text-muted hover:border-purple-glow'
                    }`}
                    title={isDone ? 'Mark as not done' : 'Mark as done'}
                  >
                    {isDone ? '✓' : '○'}
                  </button>
                  <button
                    onClick={() => setExpandedStage(expandedStage === stage.id ? null : stage.id)}
                    className={`p-2 rounded-hover hover:bg-purple-monarch/10 transition-colors ${
                      expandedStage === stage.id ? 'bg-purple-monarch/20' : ''
                    }`}
                  >
                    <svg className="w-5 h-5 text-purple-monarch" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>

              <p className="text-sm text-muted mb-3">{stage.description}</p>

              {/* Status Indicator */}
              <div className="flex items-center space-x-3 mb-4">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: isDone ? '#2ECC71' : '#E74C3C' }}
                ></div>
                <span className="text-xs font-mono">{isDone ? 'COMPLETED' : 'PENDING'}</span>
              </div>

              {/* Expanded Content */}
              {expandedStage === stage.id && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="mt-4 pt-3 border-t border-purple-monarch/10"
                >
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <svg className="w-5 h-5 text-green-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
                      </svg>
                      <span className="font-mono text-sm">Sprint 1: Core Features</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <svg className="w-5 h-5 text-green-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
                      </svg>
                      <span className="font-mono text-sm">Sprint 2: UI/UX Improvements</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <svg className="w-5 h-5 text-green-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
                      </svg>
                      <span className="font-mono text-sm">Sprint 3: Testing & Feedback</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}