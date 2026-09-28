import { useEffect, useState } from 'react';
import { api, type CoachWeekly } from '../lib/api';
import { Btn, Panel } from './hunter/ui';

/** Weekly AI coach: a short, data-grounded review of this week with next-week focus. */
export default function CoachPanel() {
  const [data, setData] = useState<CoachWeekly | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { api.getCoachWeekly().then(setData).catch(e => setError((e as Error).message)); }, []);

  const generate = async () => {
    setBusy(true);
    setError('');
    try { setData(await api.generateCoachWeekly()); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const r = data?.review;
  const section = (title: string, icon: string, items: string[]) => (
    <div>
      <p className="text-xs font-mono text-purple-300 uppercase tracking-[0.2em] mb-1.5">{icon} {title}</p>
      <ul className="space-y-1">
        {items.map(i => <li key={i} className="text-sm text-gray-200 font-mono leading-snug">• {i}</li>)}
      </ul>
    </div>
  );

  return (
    <Panel title="🧠 HUNTER COACH" right={r && <Btn variant="ghost" onClick={generate} disabled={busy}>{busy ? 'THINKING…' : 'REFRESH'}</Btn>}>
      {!r ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-400 font-mono max-w-xl">
            Get a personal review of your week so far — your wins, where you slipped, and what to focus on next.
            {data && ` ${data.stats.completions} quests · ${data.stats.xpEarned} XP · ${data.stats.activeDays}/${data.stats.daysElapsed} active days this week.`}
          </p>
          <Btn onClick={generate} disabled={busy}>{busy ? 'ANALYZING YOUR WEEK…' : 'REVIEW MY WEEK'}</Btn>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="font-display text-white text-lg tracking-wide">{r.headline}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {section('Wins', '🏆', r.wins)}
            {section('Focus', '🎯', r.focus)}
            {section('Next week', '🗓️', r.nextWeek)}
          </div>
          <p className="text-[11px] text-gray-600 font-mono">
            {r.source === 'ai' ? 'Written by Hunter AI from your real stats' : 'Generated from your stats'}
            {data?.generatedAt && ` · ${new Date(data.generatedAt).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`}
          </p>
        </div>
      )}
      {error && <p className="text-sm text-yellow-300/90 font-mono mt-2">{error}</p>}
    </Panel>
  );
}
