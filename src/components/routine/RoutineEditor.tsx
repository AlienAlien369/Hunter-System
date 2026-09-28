import { DAYS, type Day, type RoutineItem, type RoutinePreview } from '../../lib/api';
import { newSlot } from './routineUtils';
import { Btn, Modal, XpDelta, inputCls } from '../hunter/ui';

/** Editable list of routine slots. Module names are free text (Skincare, Content Creation, Reading…). */
export function RoutineEditor({ items, onChange }: { items: RoutineItem[]; onChange: (items: RoutineItem[]) => void }) {
  const modules = [...new Set(items.map(i => i.module).filter(Boolean))];
  const update = (id: string, patch: Partial<RoutineItem>) => onChange(items.map(i => (i.id === id ? { ...i, ...patch } : i)));
  const toggleDay = (i: RoutineItem, d: Day) => update(i.id, { days: i.days.includes(d) ? i.days.filter(x => x !== d) : DAYS.filter(x => x === d || i.days.includes(x)) });

  return (
    <div className="space-y-2">
      <datalist id="routine-modules">
        {[...new Set([...modules, 'Wake', 'Skincare', 'Workout', 'Work', 'Deep Work', 'Coding', 'Content Creation', 'Reading', 'Meditation', 'Wind Down', 'Sleep'])].map(m => <option key={m} value={m} />)}
      </datalist>
      {[...items].sort((a, b) => a.time.localeCompare(b.time)).map(i => (
        <div key={i.id} className="rounded-lg border border-purple-500/15 bg-[#161b22]/60 p-2 space-y-2">
          <div className="grid grid-cols-12 gap-2">
            <input type="time" aria-label="Time" className={`${inputCls} col-span-4 sm:col-span-2`} value={i.time} onChange={e => update(i.id, { time: e.target.value })} />
            <input aria-label="Module" list="routine-modules" placeholder="Module" className={`${inputCls} col-span-8 sm:col-span-3`} value={i.module} maxLength={40}
              onChange={e => update(i.id, { module: e.target.value, title: i.title === i.module ? e.target.value : i.title })} />
            <input aria-label="Title" placeholder="What" className={`${inputCls} col-span-7 sm:col-span-4`} value={i.title} maxLength={80} onChange={e => update(i.id, { title: e.target.value })} />
            <div className="col-span-4 sm:col-span-2 flex items-center gap-1">
              <input type="number" aria-label="Duration in minutes" min={5} max={720} className={inputCls} value={i.durationMin} onChange={e => update(i.id, { durationMin: Number(e.target.value) })} />
              <span className="text-[10px] text-gray-500 font-mono">min</span>
            </div>
            <button type="button" aria-label={`Remove ${i.title || 'slot'}`} className="col-span-1 text-gray-500 hover:text-red-400" onClick={() => onChange(items.filter(x => x.id !== i.id))}>✕</button>
          </div>
          <div className="flex flex-wrap gap-1">
            {DAYS.map(d => (
              <button key={d} type="button" aria-pressed={i.days.includes(d)} onClick={() => toggleDay(i, d)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${i.days.includes(d) ? 'bg-purple-500/20 border-purple-400/50 text-purple-200' : 'border-gray-700 text-gray-600'}`}>
                {d}
              </button>
            ))}
          </div>
        </div>
      ))}
      <Btn variant="ghost" onClick={() => onChange([...items, newSlot()])}>+ ADD SLOT</Btn>
    </div>
  );
}

/** "⚠️ HUNTER ROUTINE CHANGE" — shows what changed and the exact XP consequence before applying. */
export function RoutineChangeDialog({ preview, busy, error, onConfirm, onCancel, title = '⚠️ HUNTER ROUTINE CHANGE', intro = 'You are changing an established routine.' }: {
  preview: RoutinePreview | null; busy: boolean; error: string; onConfirm: () => void; onCancel: () => void; title?: string; intro?: string;
}) {
  const groups: [string, string[]][] = [
    ['Removed', ['module_removed', 'task_removed']],
    ['Replaced', ['module_replaced']],
    ['Added', ['module_added', 'task_added']],
    ['Changed', ['time_changed', 'duration_changed', 'frequency_changed']],
  ];
  const impact = preview?.changes.filter(c => c.xp !== 0) ?? [];
  return (
    <Modal open={!!preview} onClose={onCancel} title={title}>
      {preview && (
        <div className="space-y-4 font-mono text-sm">
          <p className="text-gray-400">{intro} Your commitments carry weight — here is exactly what this change means.</p>
          {groups.map(([label, kinds]) => {
            const list = preview.changes.filter(c => kinds.includes(c.kind));
            return list.length ? (
              <div key={label}>
                <p className="text-xs text-purple-300 uppercase tracking-wider mb-1">{label}</p>
                <ul className="space-y-1">
                  {list.map((c, n) => (
                    <li key={n} className="text-white">
                      {c.label.replace(/^(Removed|Added|Changed) /, '').replace(/^New module added: /, '')}
                      {c.detail && <span className="block text-xs text-gray-400">{c.detail}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null;
          })}
          <div className="rounded-lg border border-purple-500/20 p-3 space-y-1">
            <p className="text-xs text-purple-300 uppercase tracking-wider">XP impact</p>
            {impact.length ? impact.map((c, n) => (
              <div key={n} className="flex justify-between gap-3 text-xs">
                <span className="text-gray-400">{c.reason}</span>
                <XpDelta xp={c.xp} />
              </div>
            )) : <p className="text-xs text-gray-400">No XP change.</p>}
            <div className="border-t border-purple-500/20 mt-2 pt-2 grid grid-cols-3 text-center">
              <div><p className="text-[10px] text-gray-500">NET</p><XpDelta xp={preview.netXp} /></div>
              <div><p className="text-[10px] text-gray-500">CURRENT XP</p><p className="font-display text-white">{preview.currentXp}</p></div>
              <div><p className="text-[10px] text-gray-500">NEW XP</p><p className={`font-display ${preview.newXp < 0 ? 'text-red-400' : 'text-white'}`}>{preview.newXp}</p></div>
            </div>
            {preview.newXp < 0 && <p className="text-[11px] text-gray-500 pt-1">XP can go below zero; your level never drops below 1.</p>}
          </div>
          {error && <p className="text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={onCancel}>CANCEL</Btn>
            <Btn onClick={onConfirm} disabled={busy}>{busy ? 'APPLYING…' : 'CONFIRM CHANGE'}</Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}
