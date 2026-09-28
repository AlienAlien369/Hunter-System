import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useGameStore } from '../store/gameStore';
import { openRoutineSetup } from '../utils/dailyBoard';
import { sfx } from '../utils/sounds';
import { Btn, Panel } from './hunter/ui';

type Onboarding = Awaited<ReturnType<typeof api.getOnboarding>>;

/** First-session checklist; every step is verified server-side, then a one-time bonus. */
export default function InitiationCard() {
  const navigate = useNavigate();
  const xp = useGameStore(s => s.profile.xp);
  const [data, setData] = useState<Onboarding | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.getOnboarding().then(setData).catch(() => {}); }, [xp]);
  if (!data || data.claimed) return null;

  const done = data.steps.filter(s => s.done).length;
  const all = done === data.steps.length;
  const actions: Record<string, { label: string; run: () => void } | undefined> = {
    timetable: { label: 'BUILD', run: openRoutineSetup },
    module: { label: 'ADD', run: () => navigate('/modules') },
    quest: { label: 'GO', run: () => navigate('/quests') },
    extra: { label: 'HOW?', run: () => document.querySelector<HTMLButtonElement>('[data-unplanned-trigger]')?.click() },
  };

  const claim = async () => {
    setBusy(true);
    try {
      const r = await api.claimOnboarding();
      useGameStore.getState().pushXpFloat(r.xpGained);
      sfx.levelUp();
      await useGameStore.getState().loadDashboard();
      setData({ ...data, claimed: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="⚔️ HUNTER INITIATION" right={<span className="text-xs font-mono text-purple-300">{done}/{data.steps.length} · +{data.bonus} XP bonus</span>}>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden mb-4">
        <div className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all" style={{ width: `${(done / data.steps.length) * 100}%` }} />
      </div>
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {data.steps.map(s => {
          const a = actions[s.id];
          return (
            <li key={s.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${s.done ? 'border-green-500/30 bg-green-500/5' : 'border-purple-500/15 bg-[#161b22]/60'}`}>
              <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center text-xs ${s.done ? 'border-green-400 text-green-300' : 'border-gray-600'}`}>{s.done && '✓'}</span>
              <span className={`flex-1 font-mono text-sm ${s.done ? 'text-gray-500 line-through' : 'text-white'}`}>{s.label}</span>
              {!s.done && a && <button type="button" onClick={a.run} className="text-[11px] font-mono text-purple-300 hover:text-white">{a.label} →</button>}
            </li>
          );
        })}
      </ul>
      {all && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3">
          <p className="text-sm font-mono text-yellow-200">Initiation complete — the System acknowledges you, Hunter.</p>
          <Btn onClick={claim} disabled={busy}>CLAIM +{data.bonus} XP</Btn>
        </div>
      )}
    </Panel>
  );
}
