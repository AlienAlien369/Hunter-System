import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useOrgStore } from '../../store/orgStore';
import { useGameStore } from '../../store/gameStore';
import { getLevelInfo } from '../../utils/xp';
import { sfx } from '../../utils/sounds';
import { useT } from '../../i18n';
import { Panel } from '../hunter/ui';
import type { LedgerProgress } from '../../lib/api';

/** One XP ledger: level, rank and progress to the next level. */
export function LedgerCard({ label, sub, progress, accent }: { label: string; sub?: string; progress: LedgerProgress; accent: 'gold' | 'purple' }) {
  const t = useT();
  const info = getLevelInfo(progress.xp);
  const pct = Math.max(0, Math.min(100, (info.intoLevel / (info.nextLevelXP - info.currentLevelXP)) * 100));
  const bar = accent === 'gold' ? 'from-amber-400 to-orange-500' : 'from-purple-500 to-blue-500';
  const border = accent === 'gold' ? 'border-amber-400/30' : 'border-purple-500/30';
  return (
    <div className={`rounded-xl border ${border} bg-[#0d1117]/90 p-4`}>
      <p className="text-[11px] font-mono uppercase tracking-widest text-gray-400">{label}</p>
      <p className="mt-1 font-display text-2xl text-white">{t('org.ledger.level', { level: info.level, rank: progress.rank })}</p>
      {sub && <p className="text-[11px] font-mono text-gray-400 truncate">{sub}</p>}
      <div className="mt-3 h-2 rounded bg-white/10 overflow-hidden" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <motion.div className={`h-full bg-gradient-to-r ${bar}`} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} />
      </div>
      <p className="mt-1 text-[11px] font-mono text-gray-400">{progress.xp.toLocaleString()} XP</p>
    </div>
  );
}

/**
 * For members of an institution: the two separate progressions side by side
 * and today's core tasks. Renders nothing for individuals.
 */
export default function OrgProgress({ showLink = true }: { showLink?: boolean }) {
  const t = useT();
  const { me, load, toggle, busyTask } = useOrgStore();
  const personalXp = useGameStore(s => s.profile.xp);
  const personalRank = useGameStore(s => s.profile.rank);
  useEffect(() => { void load(); }, [load]);
  if (!me?.org || !me.progress) return null;

  const today = (me.tasks ?? []).filter(x => x.today);
  const done = today.filter(x => x.done).length;
  const personal = getLevelInfo(personalXp);
  const onToggle = async (id: number) => {
    const r = await toggle(id);
    if (r?.action === 'completed') sfx.complete();
    else if (r) sfx.undo();
  };

  return (
    <section aria-label={me.org.name} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <LedgerCard
          label={t('org.ledger.institution')}
          sub={`${me.org.name} · ${t('org.ledger.week', { xp: me.progress.weekXp })}`}
          progress={me.progress}
          accent="gold"
        />
        <LedgerCard
          label={t('org.ledger.personal')}
          progress={{ xp: personalXp, level: personal.level, rank: personalRank }}
          accent="purple"
        />
      </div>
      <p className="text-[11px] font-mono text-gray-400">{t('org.ledger.note')}</p>

      {me.org.role === 'student' && (
        <Panel
          title={t('org.tasks.title').toUpperCase()}
          right={<span className="text-xs font-mono text-amber-300">{t('org.tasks.done', { done, total: today.length })}</span>}
        >
          {today.length === 0 ? (
            <p className="text-sm font-mono text-gray-400">{t('org.tasks.none')}</p>
          ) : (
            <ul className="grid gap-2 md:grid-cols-2">
              {today.map(task => (
                <li key={task.id}>
                  <button
                    type="button"
                    onClick={() => onToggle(task.id)}
                    disabled={busyTask !== null}
                    aria-pressed={task.done}
                    className={`w-full text-left flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors disabled:opacity-60 ${task.done ? 'border-amber-400/40 bg-amber-400/10' : 'border-purple-500/20 bg-[#161b22]/70 hover:border-amber-400/40'}`}
                  >
                    <span aria-hidden className={`w-5 h-5 rounded border flex items-center justify-center text-xs ${task.done ? 'bg-amber-400 border-amber-400 text-black' : 'border-gray-500'}`}>{task.done ? '✓' : ''}</span>
                    <span className="flex-1 min-w-0">
                      <span className={`block text-sm font-mono truncate ${task.done ? 'text-gray-400 line-through' : 'text-white'}`}>{task.title}</span>
                      <span className="block text-[11px] font-mono text-gray-500 truncate">
                        {task.scheduleTime ? `${task.scheduleTime} · ` : ''}{t('org.tasks.from', { name: me.org!.name })}
                      </span>
                    </span>
                    <span className="text-xs font-display text-amber-300">+{task.xpReward}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {showLink && <Link to="/org" className="mt-3 inline-block text-[11px] font-mono text-purple-300 hover:text-white">{t('nav.institution')} →</Link>}
        </Panel>
      )}
    </section>
  );
}
