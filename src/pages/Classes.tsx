import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, type ClassDashboard, type ClassLookup, type ClassesResponse } from '../lib/api';
import { Btn, Panel, inputCls } from '../components/hunter/ui';
import { formatDate, useLocaleStore, useT } from '../i18n';
import { localDateKey } from '../utils/date';
import type { MessageKey } from '../i18n/messages/en';

const errCode = (e: unknown) => (e instanceof ApiError ? (e.data as { code?: string } | undefined)?.code : undefined);

/** Classes: join one with a code (students) or run one (teachers). Teachers see consistency only. */
export default function Classes() {
  const t = useT();
  const [data, setData] = useState<ClassesResponse | null>(null);
  const load = useCallback(() => api.getClasses().then(setData).catch(() => {}), []);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-display text-white font-bold tracking-wider">{t('classes.title')}</h1>
        <p className="text-sm text-gray-400 font-mono mt-1">{t('classes.subtitle')}</p>
      </header>
      <JoinPanel onChange={load} />
      <MyClasses data={data} onChange={load} />
      <TeachPanel data={data} onChange={load} />
    </div>
  );
}

function JoinPanel({ onChange }: { onChange: () => void }) {
  const t = useT();
  const [code, setCode] = useState('');
  const [found, setFound] = useState<ClassLookup | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const fail = (e: unknown) => {
    const c = errCode(e);
    const key: MessageKey | null = c === 'name_required' ? 'classes.join.needName' : c === 'not_found' ? 'classes.join.notFound' : c === 'class_full' ? 'classes.join.full' : c === 'too_many_classes' ? 'classes.join.tooMany' : null;
    setMsg({ ok: false, text: key ? t(key) : (e as Error).message });
  };
  const lookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null); setFound(null);
    try { setFound(await api.lookupClass(code)); } catch (err) { fail(err); } finally { setBusy(false); }
  };
  const join = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await api.joinClass(code);
      setMsg({ ok: true, text: t('classes.join.joined', { name: r.name }) });
      setFound(null); setCode('');
      onChange();
    } catch (err) { fail(err); } finally { setBusy(false); }
  };

  return (
    <Panel title={t('classes.join.title').toUpperCase()}>
      <form onSubmit={lookup} className="flex flex-wrap gap-2">
        <input aria-label={t('classes.join.code')} className={`${inputCls} max-w-[12rem] uppercase tracking-widest`} value={code} onChange={e => { setCode(e.target.value); setFound(null); }} maxLength={9} placeholder="ABC234" autoComplete="off" />
        <Btn type="submit" disabled={busy || code.replace(/[\s-]/g, '').length < 6}>{t('classes.join.lookup')}</Btn>
      </form>
      {found && (
        <div className="mt-4 rounded-lg border border-purple-500/30 bg-purple-500/5 p-4 space-y-3">
          <p className="font-display text-white">{t('classes.join.confirmTitle', { name: found.name, teacher: found.teacher })}</p>
          <p className="text-sm text-gray-300 font-mono leading-relaxed">{t('classes.join.sees')}</p>
          <p className="text-sm text-gray-400 font-mono leading-relaxed">{t('classes.join.notSees')}</p>
          <Btn onClick={join} disabled={busy}>{t('classes.join.confirm')}</Btn>
        </div>
      )}
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`mt-3 text-sm font-mono ${msg.ok ? 'text-green-400' : 'text-yellow-300'}`}>{msg.text}</p>}
    </Panel>
  );
}

function MyClasses({ data, onChange }: { data: ClassesResponse | null; onChange: () => void }) {
  const t = useT();
  const leave = async (id: number) => {
    if (!window.confirm(t('classes.leave.confirm'))) return;
    await api.leaveClass(id).catch(() => {});
    onChange();
  };
  return (
    <Panel title={t('classes.joined.title').toUpperCase()}>
      {data && data.joined.length === 0 && <p className="text-sm text-gray-500 font-mono">{t('classes.joined.none')}</p>}
      <ul className="space-y-2">
        {data?.joined.map(c => (
          <li key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-purple-500/15 bg-[#161b22]/60 px-3 py-2">
            <span>
              <span className="block font-mono text-sm text-white">{c.name}</span>
              <span className="block text-[11px] font-mono text-gray-500">{t('classes.joined.with', { teacher: c.teacher })}</span>
            </span>
            <Btn variant="ghost" onClick={() => leave(c.id)}>{t('classes.leave')}</Btn>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function TeachPanel({ data, onChange }: { data: ClassesResponse | null; onChange: () => void }) {
  const t = useT();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try { await api.createClass(name); setName(''); onChange(); } catch (err) { setError(errCode(err) === 'adult_required' ? t('classes.teach.adultOnly') : (err as Error).message); }
  };
  const active = data?.teaching.filter(c => !c.archived) ?? [];
  return (
    <Panel title={t('classes.teach.title').toUpperCase()}>
      {active.map(c => <TeacherClass key={c.id} id={c.id} onChange={onChange} />)}
      {data?.canCreate ? (
        <form onSubmit={create} className="space-y-2">
          <label className="block text-xs font-mono uppercase tracking-wider text-gray-400" htmlFor="class-name">{t('classes.teach.name')}</label>
          <div className="flex flex-wrap gap-2">
            <input id="class-name" className={`${inputCls} max-w-xs`} value={name} onChange={e => setName(e.target.value)} maxLength={60} placeholder="JEE 2027 · Batch A" />
            <Btn type="submit" disabled={name.trim().length < 2}>{t('classes.teach.create')}</Btn>
          </div>
          <p className="text-[11px] font-mono text-gray-500">{t('classes.teach.pilot', { capacity: data.capacity })}</p>
          {error && <p role="alert" className="text-sm font-mono text-yellow-300">{error}</p>}
        </form>
      ) : data && <p className="text-[11px] font-mono text-gray-500 mt-3">{t('classes.teach.limit')}</p>}
    </Panel>
  );
}

function TeacherClass({ id, onChange }: { id: number; onChange: () => void }) {
  const t = useT();
  const locale = useLocaleStore(s => s.locale);
  const [d, setD] = useState<ClassDashboard | null>(null);
  const [note, setNote] = useState('');
  const refresh = useCallback(() => api.getClassDashboard(id).then(setD).catch(() => {}), [id]);
  useEffect(() => { void refresh(); }, [refresh]);
  if (!d) return null;

  const copy = async () => {
    try { await navigator.clipboard.writeText(d.class.code); setNote(t('classes.teach.copied')); } catch { /* clipboard blocked */ }
  };
  const rotate = async () => { if (window.confirm(t('classes.teach.rotate.confirm'))) { await api.rotateClassCode(id); await refresh(); } };
  const archive = async () => { if (window.confirm(t('classes.teach.archive.confirm'))) { await api.archiveClass(id); onChange(); } };
  const remove = async (memberId: number) => { if (window.confirm(t('classes.dash.remove.confirm'))) { await api.removeClassMember(id, memberId); await refresh(); } };
  const last = (iso: string | null) => (iso ? formatDate(locale, iso, { dateStyle: 'medium', timeZone: 'UTC' }) : t('classes.dash.never'));

  return (
    <div className="mb-6 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="font-display text-white text-lg">{d.class.name}</h3>
          <p className="text-[11px] font-mono text-gray-500">{t('classes.teach.members', { count: d.summary.members, capacity: d.class.capacity })}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-mono text-gray-500">{t('classes.teach.code')}</p>
          <p className="font-display text-3xl tracking-[0.3em] text-white" aria-label={d.class.code.split('').join(' ')}>{d.class.code}</p>
          <div className="mt-1 flex justify-end gap-2">
            <Btn variant="ghost" onClick={copy}>{t('classes.teach.copy')}</Btn>
            <Btn variant="ghost" onClick={rotate}>{t('classes.teach.rotate')}</Btn>
            <Btn variant="ghost" onClick={archive}>{t('classes.teach.archive')}</Btn>
          </div>
        </div>
      </div>
      <p className="text-xs font-mono text-gray-400">{t('classes.teach.share')}</p>
      {note && <p role="status" className="text-xs font-mono text-green-400">{note}</p>}

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-purple-500/15 bg-[#161b22]/60 p-3"><p className="text-[11px] font-mono text-gray-500">{t('classes.dash.active')}</p><p className="font-display text-2xl text-white">{d.summary.activeThisWeek} / {d.summary.members}</p></div>
        <div className="rounded-lg border border-purple-500/15 bg-[#161b22]/60 p-3"><p className="text-[11px] font-mono text-gray-500">{t('classes.dash.avg')}</p><p className="font-display text-2xl text-white">{d.summary.avgConsistencyPct}%</p></div>
      </div>

      <h4 className="font-display text-sm tracking-widest text-gray-300">{t('classes.dash.title').toUpperCase()}</h4>
      {d.members.length === 0 ? <p className="text-sm text-gray-500 font-mono">{t('classes.dash.empty')}</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-mono text-left">
            <thead className="text-[11px] text-gray-500">
              <tr><th className="py-1 pr-3">{t('classes.dash.student')}</th><th className="pr-3">{t('classes.dash.streak')}</th><th className="pr-3">{t('classes.dash.week')}</th><th className="pr-3 min-w-[8rem]">{t('classes.dash.consistency')}</th><th className="pr-3">{t('classes.dash.last')}</th><th /></tr>
            </thead>
            <tbody className="text-gray-200">
              {d.members.map(m => (
                <tr key={m.memberId} className="border-t border-white/5">
                  <td className="py-2 pr-3">{m.name} <span className="text-[11px] text-gray-500">Lv {m.level} · {m.rank}</span></td>
                  <td className="pr-3">🔥 {m.streak}</td>
                  <td className="pr-3">{m.activeDaysThisWeek}/7</td>
                  <td className="pr-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 rounded bg-white/10 overflow-hidden" role="presentation"><div className="h-full bg-gradient-to-r from-purple-500 to-blue-500" style={{ width: `${m.consistencyPct}%` }} /></div>
                      <span className="w-10 text-right">{m.consistencyPct}%</span>
                    </div>
                  </td>
                  <td className="pr-3 whitespace-nowrap">{m.lastActive === localDateKey() ? t('classes.dash.today') : last(m.lastActive)}</td>
                  <td><button onClick={() => remove(m.memberId)} className="text-[11px] text-red-300 hover:text-red-200">{t('classes.dash.remove')}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] font-mono text-gray-500">{t('classes.dash.privacy')}</p>
    </div>
  );
}
