import { useEffect, useState } from 'react';
import { api, type Leaderboard } from '../lib/api';
import { useGameStore } from '../store/gameStore';
import { Panel } from './hunter/ui';

const MEDALS = ['🥇', '🥈', '🥉'];

/** Hunter leaderboard: this week's earned XP (resets Monday UTC) or all-time XP. */
export default function LeaderboardPanel() {
  const [period, setPeriod] = useState<'week' | 'all'>('week');
  const [data, setData] = useState<Leaderboard | null>(null);
  const [error, setError] = useState('');
  const xp = useGameStore(s => s.profile.xp);

  useEffect(() => {
    api.getLeaderboard(period).then(d => { setData(d); setError(''); }).catch(e => setError((e as Error).message));
  }, [period, xp]);

  const toggleVisible = async () => {
    if (!data) return;
    await api.setLeaderboardVisibility(!data.me.visible);
    setData(await api.getLeaderboard(period));
  };

  const tab = (p: 'week' | 'all', label: string) => (
    <button type="button" onClick={() => setPeriod(p)} aria-pressed={period === p}
      className={`px-2.5 py-1 rounded-md text-[11px] font-mono border ${period === p ? 'bg-purple-500/20 border-purple-400/50 text-purple-100' : 'border-gray-700 text-gray-500 hover:text-gray-300'}`}>
      {label}
    </button>
  );

  const unit = period === 'week' ? 'XP this week' : 'XP';
  return (
    <Panel title="🏆 HUNTER LEADERBOARD" right={<div className="flex gap-1.5">{tab('week', 'THIS WEEK')}{tab('all', 'ALL TIME')}</div>}>
      {error && <p className="text-sm text-red-400 font-mono">{error}</p>}
      {data && (
        <div className="space-y-3">
          {data.entries.length === 0 ? (
            <p className="text-sm text-gray-500 font-mono">No hunters on the board yet{period === 'week' ? ' this week' : ''}. Complete a quest to claim the top spot.</p>
          ) : (
            <ol className="space-y-1.5">
              {data.entries.map(e => (
                <li key={`${e.position}-${e.name}`}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${e.isMe ? 'border-purple-400/60 bg-purple-500/15' : 'border-purple-500/10 bg-[#161b22]/60'}`}>
                  <span className="w-8 text-center font-display text-sm text-gray-400">{MEDALS[e.position - 1] ?? `#${e.position}`}</span>
                  <span className="flex-1 min-w-0 truncate font-mono text-sm text-white">{e.name}{e.isMe && <span className="text-purple-300"> (you)</span>}</span>
                  <span className="text-[11px] font-mono text-gray-500 hidden sm:inline">Lv {e.level} · {e.rank}-Rank</span>
                  <span className="font-display text-gold text-sm w-24 text-right">{e.score.toLocaleString()}</span>
                </li>
              ))}
            </ol>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-gray-400 border-t border-purple-500/10 pt-3">
            <span>
              You: <span className="text-white">{data.me.score.toLocaleString()} {unit}</span>
              {data.me.position ? <> · <span className="text-purple-300">#{data.me.position}</span></> : null}
              {!data.me.nameSet && ' · choose a Hunter name to appear on the board'}
              {period === 'week' && <span className="text-gray-600"> · resets Monday 00:00 UTC</span>}
            </span>
            {data.me.nameSet && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={data.me.visible} onChange={toggleVisible} />
                Show me on the leaderboard
              </label>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}
