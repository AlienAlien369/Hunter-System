import { useEffect, useState } from 'react';
import { api, DAYS as DAY_CODES, type ActivityEntry, type Routine, type RoutineItem, type RoutinePreview } from '../lib/api';
import { useGameStore } from '../store/gameStore';
import { Btn, Modal, Panel, XpDelta } from '../components/hunter/ui';
import { RoutineChangeDialog, RoutineEditor } from '../components/routine/RoutineEditor';
import { fmtTime, previewRoutineChange, slotsValid } from '../components/routine/routineUtils';
import RoutineSetup from '../components/routine/RoutineSetup';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function Timetable() {
  const [routine, setRoutine] = useState<Routine | null | undefined>(undefined);
  const [history, setHistory] = useState<ActivityEntry[]>([]);
  const [setupOpen, setSetupOpen] = useState(false);
  const [draft, setDraft] = useState<RoutineItem[] | null>(null);
  const [preview, setPreview] = useState<RoutinePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    api.getRoutine().then(r => setRoutine(r.routine)).catch(() => setRoutine(null));
    api.getRoutineHistory().then(setHistory).catch(() => {});
  };
  useEffect(load, []);

  const apply = async (items: RoutineItem[], expectedNetXp?: number) => {
    setBusy(true); setError('');
    try {
      await api.saveRoutine({ items, expectedNetXp });
      setDraft(null);
      setPreview(null);
      load();
      await useGameStore.getState().loadDashboard();
    } catch (e) {
      setError((e as Error).message);
      if (/changed/i.test((e as Error).message)) setPreview((await previewRoutineChange(items)).preview); // stale → re-review
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!draft) return;
    setBusy(true); setError('');
    try {
      const { preview: p, needsConfirm } = await previewRoutineChange(draft);
      if (!p.changes.length) setDraft(null);
      else if (needsConfirm) setPreview(p);
      else await apply(draft); // setup period: normal editing
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (routine === undefined) return <div className="text-gray-500 font-mono text-sm p-6">Loading routine…</div>;

  if (!routine) {
    return (
      <div className="space-y-6">
        <Panel title="SET UP YOUR HUNTER ROUTINE">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-400 font-mono max-w-2xl">Build your own timetable from your goals — modules like Skincare, Workout or Content Creation. Hunter can suggest one from a short description.</p>
            <Btn onClick={() => setSetupOpen(true)}>CREATE MY ROUTINE</Btn>
          </div>
        </Panel>
        <RoutineSetup open={setupOpen} onClose={() => setSetupOpen(false)} onDone={() => { setSetupOpen(false); load(); }} />
      </div>
    );
  }

  const todayIdx = (new Date().getDay() + 6) % 7;
  const times = [...new Set(routine.items.map(i => i.time))].sort();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display text-purple-monarch">TIMETABLE</h1>
          <p className={`mt-2 text-xs font-mono ${routine.established ? 'text-purple-300' : 'text-yellow-300'}`}>
            {routine.established
              ? 'ESTABLISHED ROUTINE — changes show their XP impact before applying'
              : `SETUP PERIOD — edit freely until ${new Date(routine.graceEndsAt!).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`}
          </p>
        </div>
        <Btn onClick={() => setDraft(routine.items)}>EDIT ROUTINE</Btn>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse bg-card/50 backdrop-blur-sm rounded-xl border border-purple-monarch/10 text-sm">
          <thead>
            <tr>
              <th className="px-3 py-3 text-left text-xs font-mono text-muted uppercase w-24">Time</th>
              {DAY_NAMES.map((d, i) => (
                <th key={d} className={`px-3 py-3 text-center text-xs font-mono uppercase ${i === todayIdx ? 'text-purple-glow' : 'text-muted'}`}>{d.slice(0, 3)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {times.map(t => (
              <tr key={t} className="border-b border-purple-monarch/5">
                <td className="px-3 py-2 font-mono whitespace-nowrap">{fmtTime(t)}</td>
                {DAY_CODES.map((d, i) => (
                  <td key={d} className={`px-3 py-2 text-center ${i === todayIdx ? 'text-purple-glow' : ''}`}>
                    {routine.items.filter(x => x.time === t && x.days.includes(d)).map(x => x.title).join(' / ') || <span className="text-gray-700">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Panel title="ROUTINE HISTORY">
        {history.length ? (
          <ul className="space-y-2 font-mono text-sm">
            {history.map(h => (
              <li key={h.id} className="flex items-center justify-between gap-3">
                <span className="text-gray-500 text-xs w-16 flex-shrink-0">{new Date(h.created_at).toLocaleDateString([], { month: 'short', day: '2-digit' })}</span>
                <span className="flex-1 text-white">
                  {h.action === 'routine_confirm' ? 'Hunter Routine confirmed' : String(h.details?.label ?? h.entity)}
                  {h.details?.detail ? <span className="block text-xs text-gray-500">{String(h.details.detail)}</span> : null}
                </span>
                <XpDelta xp={Number(h.details?.xp ?? 0)} className="text-xs" />
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-gray-500 font-mono">No changes yet.</p>}
      </Panel>

      <Modal open={!!draft && !preview} onClose={() => setDraft(null)} title="EDIT ROUTINE" wide>
        {draft && (
          <div className="space-y-4">
            <RoutineEditor items={draft} onChange={setDraft} />
            {error && <p className="text-sm text-red-400 font-mono">{error}</p>}
            <div className="flex justify-end gap-2">
              <Btn variant="ghost" onClick={() => setDraft(null)}>CANCEL</Btn>
              <Btn onClick={save} disabled={busy || !slotsValid(draft)}>{busy ? 'CHECKING…' : 'SAVE CHANGES'}</Btn>
            </div>
          </div>
        )}
      </Modal>
      <RoutineChangeDialog preview={preview} busy={busy} error={error}
        onCancel={() => { setPreview(null); setError(''); }}
        onConfirm={() => draft && preview && apply(draft, preview.netXp)} />
    </div>
  );
}
