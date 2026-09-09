import { useGameStore } from '../store/gameStore';
import { motion } from 'framer-motion';
import { useState } from 'react';

const ARCH_CHALLENGES = [
  { week: 1, scenario: 'Multi-tenant B2B SaaS data isolation', scale: '100 tenants / 100k users' },
  { week: 1, scenario: 'Notification system with retries & DLQ', scale: '1M notifications/day' },
  { week: 2, scenario: 'Fleet telemetry ingestion & live dashboard', scale: '1,000 vehicles × 1 event/min' },
  { week: 2, scenario: 'Role/permission system for multi-tenants', scale: '50 roles + custom permissions' },
  { week: 3, scenario: 'File/document storage with tenant isolation', scale: '10 TB total' },
  { week: 3, scenario: 'Audit logging for enterprise', scale: '100M audit events' },
  { week: 4, scenario: 'Configuration/feature flags per tenant', scale: '1,000 tenants' },
  { week: 4, scenario: 'Order/trip workflow with idempotency', scale: 'High concurrency' },
  { week: 5, scenario: 'API rate limiting and abuse protection', scale: '10k requests/sec' },
  { week: 5, scenario: 'Search/reporting without hurting transactional DB', scale: 'Large datasets' },
  { week: 6, scenario: 'Caching strategy and invalidation', scale: 'High-read workload' },
  { week: 6, scenario: 'Deployment/observability for production SaaS', scale: 'Multi-service production' },
];

const challengeQuestId = (index: number) => `AR-${String(index + 1).padStart(2, '0')}`;

export default function SystemDesign() {
  const { dailyQuests, completeQuest, redoTrack, saveArchDecision } = useGameStore();
  const [expandedChallenge, setExpandedChallenge] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    decision: '',
    why: '',
    tradeoffs: '',
  });
  const today = new Date().toISOString().split('T')[0];

  const doneSet = new Set(
    dailyQuests
      .filter(q => q.id.startsWith('AR-') && q.completedDates.length > 0)
      .map(q => q.id)
  );
  const completed = doneSet.size;
  const progress = (completed / ARCH_CHALLENGES.length) * 100;
  const allDone = completed === ARCH_CHALLENGES.length;

  const handleToggle = (index: number) => {
    completeQuest(challengeQuestId(index), today);
  };

  const handleRedo = () => {
    if (window.confirm('Reset ALL Architecture challenges to start from the beginning?\n\nYour XP and level will stay the same.')) {
      redoTrack('arch');
    }
  };

  const handleSave = (week: number) => {
    saveArchDecision(week, formData);
    setFormData({ decision: '', why: '', tradeoffs: '' });
    setExpandedChallenge(null);
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
          SYSTEM DESIGN CHALLENGES
        </h1>
        <div className="mt-3 text-sm text-muted">
          Complete all 12 challenges to unlock the System Design Master achievement
        </div>
      </div>

      {/* Progress Overview */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card/80 backdrop-blur-sm rounded-xl border border-purple-monarch/20 p-5 mb-6"
      >
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-display text-red-danger font-bold tracking-wider">
              ARCHITECTURE PROGRESS
            </h2>
            <span className="text-xs text-muted font-mono">PERMANENT • CHALLENGES STAY UNTIL YOU REDO</span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-xl font-display text-red-danger">{completed}/{ARCH_CHALLENGES.length}</p>
              <p className="text-xs text-muted font-mono">CHALLENGES DONE</p>
            </div>
            {allDone && (
              <button
                onClick={handleRedo}
                className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-all font-display text-sm font-bold"
              >
                🔄 REDO ALL CHALLENGES
              </button>
            )}
          </div>
        </div>
        <div className="mt-4 h-2 bg-dungeon/50 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-red-danger to-orange-400"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8 }}
          />
        </div>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-2">
        {ARCH_CHALLENGES.map((challenge, index) => {
          const isExpanded = expandedChallenge === index;
          const isDone = doneSet.has(challengeQuestId(index));
          return (
            <motion.div
              key={challenge.scenario}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 * index }}
              className={`bg-card/80 backdrop-blur-sm rounded-xl border p-4 ${
                isExpanded ? 'border-l-4 border-purple-glow' : 'border-purple-monarch/20'
              } ${isDone ? 'opacity-80' : ''}`}
              onClick={() => setExpandedChallenge(isExpanded ? null : index)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-purple-monarch/20">
                    <span className="text-purple-monarch font-bold">W{challenge.week}</span>
                  </div>
                  <div>
                    <h3 className={`font-display text-sm ${isDone ? 'text-gold line-through' : ''}`}>{challenge.scenario}</h3>
                    <p className="text-xs text-muted">{challenge.scale}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {/* Mark complete (permanent) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggle(index);
                    }}
                    className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all ${
                      isDone
                        ? 'bg-gold/20 border-gold text-gold'
                        : 'bg-dungeon/50 border-purple-monarch/30 text-muted hover:border-purple-glow'
                    }`}
                    title={isDone ? 'Mark as not done' : 'Mark as done'}
                  >
                    {isDone ? '✓' : '○'}
                  </button>
                  <div className={`w-5 h-5 flex-shrink-0 ${isDone ? '' : ''}`}>
                    {isExpanded ? (
                      <svg className="text-purple-monarch" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    ) : (
                      <svg className="text-purple-monarch" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 18l6-6-6-6" />
                      </svg>
                    )}
                  </div>
                </div>
              </div>

              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="mt-4 pt-3 border-t border-purple-monarch/10"
                >
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-muted mb-1">Decision</label>
                      <textarea
                        value={formData.decision}
                        onChange={(e) =>
                          setFormData({ ...formData, decision: e.target.value })
                        }
                        className="w-full bg-dungeon/50 rounded border border-purple-monarch/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-monarch"
                        rows={3}
                        placeholder="What is your decision or solution?"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-muted mb-1">Why</label>
                      <textarea
                        value={formData.why}
                        onChange={(e) =>
                          setFormData({ ...formData, why: e.target.value })
                        }
                        className="w-full bg-dungeon/50 rounded border border-purple-monarch/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-monarch"
                        rows={3}
                        placeholder="Why did you choose this approach?"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-muted mb-1">Trade-offs</label>
                      <textarea
                        value={formData.tradeoffs}
                        onChange={(e) =>
                          setFormData({ ...formData, tradeoffs: e.target.value })
                        }
                        className="w-full bg-dungeon/50 rounded border border-purple-monarch/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-monarch"
                        rows={3}
                        placeholder="What are the trade-offs of this decision?"
                      />
                    </div>

                    <div className="flex justify-end mt-4">
                      <button
                        onClick={() => handleSave(challenge.week)}
                        className="px-4 py-2 bg-purple-monarch/20 text-purple-monarch rounded hover:bg-purple-monarch/30 transition-colors text-sm font-medium"
                      >
                        Save Decision
                      </button>
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