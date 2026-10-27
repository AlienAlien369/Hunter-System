import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  api, ApiError, DAYS, ORG_KINDS, REPORT_RELATIONS,
  type OrgBilling, type OrgInfo, type OrgKind, type OrgLookup, type OrgMemberRow, type OrgMembers, type OrgRole, type OrgTask,
  type RenderedReport, type ReportRelation,
} from '../lib/api';
import { useOrgStore } from '../store/orgStore';
import { useConfigStore } from '../store/configStore';
import { useAuthStore } from '../store/authStore';
import { Btn, Modal, Panel, Stat, inputCls } from '../components/hunter/ui';
import OrgProgress from '../components/org/OrgProgress';
import { EmailPreview } from '../components/ReportRecipientsPanel';
import { formatCurrency, formatDate, useLocaleStore, useT } from '../i18n';
import type { MessageKey } from '../i18n/messages/en';
import { localDateKey } from '../utils/date';

const errCode = (e: unknown) => (e instanceof ApiError ? (e.data as { code?: string } | undefined)?.code : undefined);
const selectCls = 'bg-[#161b22] border border-purple-500/20 rounded-lg px-2 py-2 text-sm font-mono text-white focus:outline-none focus:border-purple-400';
const labelCls = 'block text-[11px] font-mono uppercase tracking-wider text-gray-400 mb-1';

/** Translate a known API error code, else show the server's own message. */
function useErrorText() {
  const t = useT();
  return (e: unknown) => {
    const c = errCode(e);
    const known = ['not_found', 'bad_code', 'no_seats', 'already_member', 'adult_required'];
    return c && known.includes(c) ? t(`org.err.${c}` as MessageKey) : (e as Error).message;
  };
}

/** /org — an individual joins or sets up an institution; members see their institution; staff run it. */
export default function Institution() {
  const t = useT();
  const { me, loaded, load } = useOrgStore();
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-display text-white font-bold tracking-wider">{me?.org?.name ?? t('org.title')}</h1>
        <p className="text-sm text-gray-400 font-mono mt-1">
          {me?.org ? `${t(`org.kind.${me.org.kind}` as MessageKey)} · ${t(`org.role.${me.org.role}` as MessageKey)}` : t('org.subtitle')}
        </p>
      </header>
      {!loaded ? null : !me?.org ? <NoInstitution /> : me.org.role === 'student' ? <StudentView /> : <StaffConsole org={me.org} />}
    </div>
  );
}

// ── Not in an institution yet (individuals, B2C) ────────────────────────────

function NoInstitution() {
  const t = useT();
  const locale = useLocaleStore(s => s.locale);
  const config = useConfigStore(s => s.config);
  const user = useAuthStore(s => s.user);
  const errText = useErrorText();
  const load = useOrgStore(s => s.load);
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get('code') ?? '');
  const [found, setFound] = useState<OrgLookup | null>(null);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<OrgKind>('school');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const lookup = async (value: string) => {
    setBusy(true); setMsg(null); setFound(null);
    try { setFound(await api.lookupOrg(value)); } catch (err) { setMsg({ ok: false, text: errText(err) }); } finally { setBusy(false); }
  };
  // Arriving from an invite link (/org?code=ABC234): look the code up straight away.
  const linkCode = params.get('code');
  useEffect(() => {
    if (!linkCode) return;
    api.lookupOrg(linkCode).then(setFound).catch(() => {});
  }, [linkCode]);

  const join = async () => {
    setBusy(true); setMsg(null);
    try { await api.joinOrg(code); await load(); } catch (err) { setMsg({ ok: false, text: errText(err) }); setBusy(false); }
  };
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try { await api.createOrg(name, kind); await load(); } catch (err) { setMsg({ ok: false, text: errText(err) }); setBusy(false); }
  };

  const seat = config?.pricing.organization;
  const isAdult = user?.consentStatus === 'not_required';
  return (
    <>
      <Panel title={t('org.join.title').toUpperCase()}>
        <p className="text-sm text-gray-300 font-mono">{t('org.join.hint')}</p>
        <form onSubmit={e => { e.preventDefault(); void lookup(code); }} className="mt-3 flex flex-wrap gap-2">
          <input aria-label={t('org.join.code')} className={`${inputCls} max-w-[12rem] uppercase tracking-widest`} value={code} onChange={e => { setCode(e.target.value); setFound(null); }} maxLength={9} placeholder="ABC234" autoComplete="off" />
          <Btn type="submit" disabled={busy || code.replace(/[\s-]/g, '').length < 6}>{t('org.join.lookup')}</Btn>
        </form>
        {found && (
          <div className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/5 p-4 space-y-3">
            <p className="font-display text-white">{t(found.role === 'student' ? 'org.join.asStudent' : 'org.join.asStaff', { name: found.name })}</p>
            <p className="text-sm text-gray-300 font-mono leading-relaxed">{t('org.join.sees')}</p>
            <p className="text-sm text-gray-400 font-mono leading-relaxed">{t('org.join.notSees')}</p>
            <Btn onClick={join} disabled={busy}>{t('org.join.confirm')}</Btn>
          </div>
        )}
        {msg && <p role={msg.ok ? 'status' : 'alert'} className={`mt-3 text-sm font-mono ${msg.ok ? 'text-green-400' : 'text-yellow-300'}`}>{msg.text}</p>}
      </Panel>

      {isAdult && (
        <Panel title={t('org.create.title').toUpperCase()}>
          <p className="text-sm text-gray-300 font-mono">{t('org.create.hint')}</p>
          <form onSubmit={create} className="mt-4 flex flex-wrap items-end gap-3">
            <label className="flex-1 min-w-[14rem]">
              <span className={labelCls}>{t('org.create.name')}</span>
              <input className={inputCls} value={name} onChange={e => setName(e.target.value)} maxLength={80} placeholder="Sunrise Public School" />
            </label>
            <label>
              <span className={labelCls}>{t('org.create.kind')}</span>
              <select className={selectCls} value={kind} onChange={e => setKind(e.target.value as OrgKind)}>
                {ORG_KINDS.map(k => <option key={k} value={k}>{t(`org.kind.${k}` as MessageKey)}</option>)}
              </select>
            </label>
            <Btn type="submit" disabled={busy || name.trim().length < 2}>{t('org.create.submit')}</Btn>
          </form>
          {seat && (
            <p className="mt-3 text-[11px] font-mono text-gray-400">
              {t('org.create.trial', { days: seat.trialDays, seats: seat.trialSeats, price: formatCurrency(locale, seat.seatYearMinor / 100, config!.pricing.currency) })}
            </p>
          )}
        </Panel>
      )}
    </>
  );
}

// ── Student ─────────────────────────────────────────────────────────────────

function StudentView() {
  const t = useT();
  const load = useOrgStore(s => s.load);
  const leave = async () => {
    if (!window.confirm(t('org.leave.confirm'))) return;
    await api.leaveOrg().catch(() => {});
    await load();
  };
  return (
    <>
      <OrgProgress showLink={false} />
      <div className="flex justify-end"><Btn variant="danger" onClick={leave}>{t('org.leave')}</Btn></div>
    </>
  );
}

// ── Staff console (admins and teachers) ─────────────────────────────────────

type Tab = 'overview' | 'timetable' | 'members' | 'reports' | 'settings' | 'billing';

function StaffConsole({ org }: { org: OrgInfo }) {
  const t = useT();
  const admin = org.role === 'admin';
  const tabs: Tab[] = ['overview', 'timetable', 'members', 'reports', ...(admin ? (['settings', 'billing'] as Tab[]) : [])];
  const [params] = useSearchParams();
  const [tab, setTab] = useState<Tab>(params.get('checkout') ? 'billing' : 'overview');
  return (
    <>
      <div role="tablist" aria-label={org.name} className="flex flex-wrap gap-1 rounded-xl border border-purple-500/20 bg-[#0d1117]/80 p-1">
        {tabs.map(x => (
          <button
            key={x}
            role="tab"
            aria-selected={tab === x}
            onClick={() => setTab(x)}
            className={`px-3 py-2 rounded-lg text-xs font-mono tracking-wider ${tab === x ? 'bg-purple-500/25 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            {t(`org.tab.${x}` as MessageKey)}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === 'overview' && <Overview org={org} />}
        {tab === 'timetable' && <CoreTimetable />}
        {tab === 'members' && <Members org={org} />}
        {tab === 'reports' && <OrgReports org={org} />}
        {tab === 'settings' && admin && <OrgSettings org={org} />}
        {tab === 'billing' && admin && <Billing org={org} />}
      </div>
    </>
  );
}

function CodeBox({ label, code, onRotate }: { label: string; code: string; onRotate?: () => void }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ } };
  return (
    <div className="rounded-lg border border-purple-500/20 bg-[#161b22]/70 p-3">
      <p className="text-[11px] font-mono text-gray-400">{label}</p>
      <p className="font-display text-2xl sm:text-3xl tracking-[0.3em] text-white" aria-label={code.split('').join(' ')}>{code}</p>
      <div className="mt-2 flex gap-2">
        <Btn variant="ghost" onClick={copy}>{copied ? t('org.code.copied') : t('org.code.copy')}</Btn>
        {onRotate && <Btn variant="ghost" onClick={onRotate}>{t('org.code.rotate')}</Btn>}
      </div>
    </div>
  );
}

function PlanLine({ org }: { org: OrgInfo }) {
  const t = useT();
  const locale = useLocaleStore(s => s.locale);
  const p = org.plan;
  if (!p) return null;
  const date = p.until ? formatDate(locale, p.until) : '—';
  if (!p.active) return <p role="alert" className="text-sm font-mono text-yellow-300">{t('org.plan.expired')}</p>;
  return <p className="text-sm font-mono text-gray-300">{t(p.trial ? 'org.plan.trial' : 'org.plan.active', { used: org.students, seats: p.seats, date })}</p>;
}

function Overview({ org }: { org: OrgInfo }) {
  const t = useT();
  const load = useOrgStore(s => s.load);
  const [m, setM] = useState<OrgMembers | null>(null);
  useEffect(() => { api.getOrgMembers().then(setM).catch(() => {}); }, []);
  const rotate = async (which: 'student' | 'staff') => {
    if (!window.confirm(t('org.code.rotate.confirm'))) return;
    await api.rotateOrgCode(which).catch(() => {});
    await load();
  };
  return (
    <div className="space-y-4">
      <Panel title={t('org.tab.overview').toUpperCase()}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label={t('org.ov.students')} value={m ? m.summary.students : '—'} />
          <Stat label={t('org.ov.active')} value={m ? `${m.summary.activeThisWeek} / ${m.summary.students}` : '—'} />
          <Stat label={t('org.ov.completion')} value={m?.summary.avgCompletionPct === null || !m ? '—' : `${m.summary.avgCompletionPct}%`} />
          <Stat label={t('org.ov.weekXp')} value={m ? `+${m.summary.weekXp.toLocaleString()}` : '—'} />
        </div>
        <div className="mt-4"><PlanLine org={org} /></div>
      </Panel>
      <Panel title={t('org.code.student').toUpperCase()}>
        <div className="grid gap-3 sm:grid-cols-2">
          {org.studentCode && <CodeBox label={t('org.code.student')} code={org.studentCode} onRotate={org.role === 'admin' ? () => rotate('student') : undefined} />}
          {org.staffCode && <CodeBox label={t('org.code.staff')} code={org.staffCode} onRotate={() => rotate('staff')} />}
        </div>
        <p className="mt-3 text-[11px] font-mono text-gray-400">{t('org.code.share')}</p>
      </Panel>
    </div>
  );
}

// ── Core timetable ──────────────────────────────────────────────────────────

const emptyTask = { title: '', description: '', difficulty: 2, scheduleTime: '', days: [...DAYS] as string[] };

function TaskForm({ initial, onSubmit, onCancel, submitLabel }: {
  initial: typeof emptyTask;
  onSubmit: (v: typeof emptyTask) => Promise<void>;
  onCancel?: () => void;
  submitLabel: string;
}) {
  const t = useT();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toggleDay = (d: string) => setV(s => ({ ...s, days: s.days.includes(d) ? s.days.filter(x => x !== d) : DAYS.filter(x => x === d || s.days.includes(x)) }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await onSubmit(v); } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <label>
          <span className={labelCls}>{t('org.tt.taskTitle')}</span>
          <input className={inputCls} value={v.title} onChange={e => setV({ ...v, title: e.target.value })} maxLength={120} placeholder="Physics revision" required />
        </label>
        <label>
          <span className={labelCls}>{t('org.tt.difficulty')}</span>
          <select className={selectCls} value={v.difficulty} onChange={e => setV({ ...v, difficulty: Number(e.target.value) })}>
            {[1, 2, 3].map(d => <option key={d} value={d}>{t(`org.diff.${d}` as MessageKey)}</option>)}
          </select>
        </label>
        <label>
          <span className={labelCls}>{t('org.tt.time')}</span>
          <input type="time" className={inputCls} value={v.scheduleTime} onChange={e => setV({ ...v, scheduleTime: e.target.value })} />
        </label>
      </div>
      <label className="block">
        <span className={labelCls}>{t('org.tt.description')}</span>
        <input className={inputCls} value={v.description} onChange={e => setV({ ...v, description: e.target.value })} maxLength={500} />
      </label>
      <fieldset>
        <legend className={labelCls}>{t('org.tt.days')}</legend>
        <div className="flex flex-wrap gap-1">
          {DAYS.map(d => (
            <button type="button" key={d} aria-pressed={v.days.includes(d)} onClick={() => toggleDay(d)}
              className={`px-2 py-1 rounded text-[11px] font-mono border ${v.days.includes(d) ? 'border-amber-400/60 bg-amber-400/15 text-white' : 'border-purple-500/20 text-gray-500'}`}>{d}</button>
          ))}
        </div>
      </fieldset>
      <div className="flex gap-2">
        <Btn type="submit" disabled={busy || !v.title.trim() || v.days.length === 0}>{submitLabel}</Btn>
        {onCancel && <Btn variant="ghost" onClick={onCancel}>{t('org.tt.cancel')}</Btn>}
      </div>
      {error && <p role="alert" className="text-sm font-mono text-yellow-300">{error}</p>}
    </form>
  );
}

const toInput = (v: typeof emptyTask) => ({
  title: v.title.trim(), description: v.description.trim(), difficulty: v.difficulty,
  scheduleTime: v.scheduleTime || null, recurrence: v.days.length === 7 ? null : v.days,
});

function CoreTimetable() {
  const t = useT();
  const reloadMe = useOrgStore(s => s.load);
  const [tasks, setTasks] = useState<OrgTask[] | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [formKey, setFormKey] = useState(0);
  const load = useCallback(() => api.getOrgTasks().then(r => setTasks(r.tasks)).catch(() => {}), []);
  useEffect(() => { void load(); }, [load]);
  const after = async () => { await load(); await reloadMe(); };
  const remove = async (id: number) => {
    if (!window.confirm(t('org.tt.remove.confirm'))) return;
    await api.deleteOrgTask(id).catch(() => {});
    await after();
  };
  const days = (r: string[] | null) => (!r?.length ? t('org.tt.everyDay') : r.join(' · '));
  return (
    <div className="space-y-4">
      <Panel title={t('org.tt.add').toUpperCase()}>
        <p className="text-sm text-gray-300 font-mono mb-4">{t('org.tt.hint')}</p>
        <TaskForm key={formKey} initial={emptyTask} submitLabel={t('org.tt.add')} onSubmit={async v => { await api.createOrgTask(toInput(v)); setFormKey(k => k + 1); await after(); }} />
      </Panel>
      <Panel title={t('org.tab.timetable').toUpperCase()}>
        {tasks?.length === 0 && <p className="text-sm font-mono text-gray-400">{t('org.tt.empty')}</p>}
        <ul className="space-y-2">
          {tasks?.map(task => (
            <li key={task.id} className="rounded-lg border border-purple-500/15 bg-[#161b22]/60 px-3 py-2">
              {editing === task.id ? (
                <TaskForm
                  initial={{ title: task.title, description: task.description ?? '', difficulty: task.difficulty, scheduleTime: task.scheduleTime ?? '', days: task.recurrence ?? [...DAYS] }}
                  submitLabel={t('org.tt.save')}
                  onCancel={() => setEditing(null)}
                  onSubmit={async v => { await api.updateOrgTask(task.id, toInput(v)); setEditing(null); await after(); }}
                />
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="w-14 font-mono text-sm text-amber-300">{task.scheduleTime ?? '—'}</span>
                  <span className="flex-1 min-w-[10rem]">
                    <span className="block text-sm font-mono text-white">{task.title}</span>
                    <span className="block text-[11px] font-mono text-gray-400">{t(`org.diff.${task.difficulty}` as MessageKey)} · +{task.xpReward} XP · {days(task.recurrence)}{task.description ? ` · ${task.description}` : ''}</span>
                  </span>
                  <Btn variant="ghost" onClick={() => setEditing(task.id)}>{t('org.tt.edit')}</Btn>
                  <Btn variant="danger" onClick={() => remove(task.id)}>{t('org.tt.remove')}</Btn>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

// ── Members ─────────────────────────────────────────────────────────────────

function Members({ org }: { org: OrgInfo }) {
  const t = useT();
  const locale = useLocaleStore(s => s.locale);
  const [m, setM] = useState<OrgMembers | null>(null);
  const [guardiansFor, setGuardiansFor] = useState<OrgMemberRow | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(() => api.getOrgMembers().then(setM).catch(e => setError((e as Error).message)), []);
  useEffect(() => { void load(); }, [load]);
  const admin = org.role === 'admin';
  const canRemove = (r: OrgMemberRow) => !r.you && (admin ? r.role !== 'admin' : r.role === 'student');
  const setRole = async (r: OrgMemberRow, role: OrgRole) => {
    setError('');
    try { await api.setOrgRole(r.userId, role); } catch (e) { setError((e as Error).message); }
    await load();
  };
  const remove = async (r: OrgMemberRow) => {
    if (!window.confirm(t('org.mem.remove.confirm', { name: r.name }))) return;
    await api.removeOrgMember(r.userId).catch(e => setError((e as Error).message));
    await load();
  };
  const last = (d: string | null) => (!d ? t('org.mem.never') : d === localDateKey() ? t('org.mem.today') : formatDate(locale, d, { dateStyle: 'medium', timeZone: 'UTC' }));

  return (
    <Panel title={t('org.tab.members').toUpperCase()}>
      {error && <p role="alert" className="mb-3 text-sm font-mono text-yellow-300">{error}</p>}
      {m && m.members.length <= 1 && <p className="text-sm font-mono text-gray-400">{t('org.mem.empty')}</p>}
      {m && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-mono text-left">
            <thead className="text-[11px] text-gray-400">
              <tr>
                <th className="py-1 pr-3">{t('org.mem.name')}</th><th className="pr-3">{t('org.mem.role')}</th><th className="pr-3">{t('org.mem.level')}</th>
                <th className="pr-3">{t('org.mem.week')}</th><th className="pr-3 min-w-[8rem]">{t('org.mem.completion')}</th><th className="pr-3">{t('org.mem.days')}</th>
                <th className="pr-3">{t('org.mem.last')}</th><th className="pr-3">{t('org.mem.guardians')}</th><th />
              </tr>
            </thead>
            <tbody className="text-gray-200">
              {m.members.map(r => (
                <tr key={r.userId} className="border-t border-white/5">
                  <td className="py-2 pr-3 whitespace-nowrap">{r.name}{r.you && <span className="text-[11px] text-gray-500"> ({t('org.mem.you')})</span>}</td>
                  <td className="pr-3">
                    {admin && !r.you ? (
                      <select aria-label={t('org.mem.role')} className="bg-transparent border border-purple-500/20 rounded px-1 py-0.5 text-xs" value={r.role} onChange={e => setRole(r, e.target.value as OrgRole)}>
                        {(['student', 'teacher', 'admin'] as OrgRole[]).map(x => <option key={x} value={x}>{t(`org.role.${x}` as MessageKey)}</option>)}
                      </select>
                    ) : t(`org.role.${r.role}` as MessageKey)}
                  </td>
                  <td className="pr-3 whitespace-nowrap">Lv {r.level} · {r.rank}</td>
                  <td className="pr-3">{r.role === 'student' ? `+${r.weekXp}` : '—'}</td>
                  <td className="pr-3">
                    {r.role !== 'student' || r.completionPct === null ? '—' : (
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 rounded bg-white/10 overflow-hidden" role="presentation"><div className="h-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${r.completionPct}%` }} /></div>
                        <span className="w-10 text-right">{r.completionPct}%</span>
                      </div>
                    )}
                  </td>
                  <td className="pr-3">{r.role === 'student' ? `${r.activeDays7}/7` : '—'}</td>
                  <td className="pr-3 whitespace-nowrap">{r.role === 'student' ? last(r.lastActive) : '—'}</td>
                  <td className="pr-3">{r.role === 'student' ? <button onClick={() => setGuardiansFor(r)} className="text-[11px] text-purple-300 hover:text-white underline-offset-2 hover:underline">{r.guardians} · {t('org.g.manage')}</button> : '—'}</td>
                  <td>{canRemove(r) && <button onClick={() => remove(r)} className="text-[11px] text-red-300 hover:text-red-200">{t('org.mem.remove')}</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-[11px] font-mono text-gray-400">{t('org.mem.privacy')}</p>
      {guardiansFor && <GuardianModal key={guardiansFor.userId} member={guardiansFor} onClose={() => { setGuardiansFor(null); void load(); }} />}
    </Panel>
  );
}

function GuardianModal({ member, onClose }: { member: OrgMemberRow; onClose: () => void }) {
  const t = useT();
  const [list, setList] = useState<{ id: number; email: string; relation: ReportRelation }[]>([]);
  const [email, setEmail] = useState('');
  const [relation, setRelation] = useState<ReportRelation>('parent');
  const [error, setError] = useState('');
  const load = useCallback(() => api.getGuardians(member.userId).then(r => setList(r.guardians)).catch(() => { /* shown empty */ }), [member.userId]);
  useEffect(() => { void load(); }, [load]);
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try { await api.addGuardian(member.userId, email.trim(), relation); setEmail(''); await load(); } catch (err) { setError((err as Error).message); }
  };
  const remove = async (id: number) => { await api.removeGuardian(member.userId, id).catch(() => {}); await load(); };
  return (
    <Modal open onClose={onClose} title={t('org.g.title', { name: member.name })}>
      <p className="text-sm font-mono text-gray-300">{t('org.g.hint')}</p>
      <ul className="mt-3 space-y-2">
        {list.length === 0 && <li className="text-sm font-mono text-gray-400">{t('org.g.none')}</li>}
        {list.map(g => (
          <li key={g.id} className="flex items-center justify-between gap-2 rounded-lg border border-purple-500/15 px-3 py-2">
            <span className="text-sm font-mono text-white break-all">{g.email} <span className="text-[11px] text-gray-400">· {t(`rep.rel.${g.relation}` as MessageKey)}</span></span>
            <Btn variant="danger" onClick={() => remove(g.id)}>{t('rep.remove')}</Btn>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="mt-4 flex flex-wrap gap-2">
        <input type="email" required aria-label={t('rep.email')} className={`${inputCls} flex-1 min-w-[12rem]`} value={email} onChange={e => setEmail(e.target.value)} placeholder="parent@example.com" />
        <select aria-label={t('rep.relation')} className={selectCls} value={relation} onChange={e => setRelation(e.target.value as ReportRelation)}>
          {REPORT_RELATIONS.filter(r => r !== 'self' && r !== 'friend').map(r => <option key={r} value={r}>{t(`rep.rel.${r}` as MessageKey)}</option>)}
        </select>
        <Btn type="submit" disabled={!email.trim()}>{t('org.g.add')}</Btn>
      </form>
      {error && <p role="alert" className="mt-2 text-sm font-mono text-yellow-300">{error}</p>}
    </Modal>
  );
}

// ── Reports ─────────────────────────────────────────────────────────────────

function OrgReports({ org }: { org: OrgInfo }) {
  const t = useT();
  const load = useOrgStore(s => s.load);
  const admin = org.role === 'admin';
  const [emails, setEmails] = useState((org.reportEmails ?? []).join('\n'));
  const [preview, setPreview] = useState<RenderedReport | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const save = async () => {
    setMsg(null);
    try {
      await api.updateOrg({ reportEmails: emails.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean) });
      setMsg({ ok: true, text: t('org.rep.saved') });
      await load();
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  };
  const show = async () => { try { setPreview((await api.getOrgWeeklyEmail()).preview); } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } };
  const send = async () => {
    setMsg(null);
    try { const r = await api.sendOrgWeeklyEmail(); setMsg({ ok: r.sent > 0, text: t('rep.sent', { sent: r.sent, total: r.recipients }) }); } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  };
  return (
    <Panel title={t('org.rep.title').toUpperCase()}>
      <p className="text-sm text-gray-300 font-mono">{t('org.rep.hint')}</p>
      {admin && (
        <label className="block mt-4">
          <span className={labelCls}>{t('org.rep.emails')}</span>
          <textarea className={`${inputCls} min-h-[6rem]`} value={emails} onChange={e => setEmails(e.target.value)} placeholder={'principal@school.edu\ncoordinator@school.edu'} />
        </label>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {admin && <Btn onClick={save}>{t('org.rep.save')}</Btn>}
        <Btn variant="ghost" onClick={show}>{t('rep.preview')}</Btn>
        {admin && <Btn variant="ghost" onClick={send} disabled={!(org.reportEmails ?? []).length}>{t('rep.send')}</Btn>}
      </div>
      <p className="mt-3 text-[11px] font-mono text-gray-400">{t('org.g.hint')}</p>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`mt-3 text-sm font-mono ${msg.ok ? 'text-green-400' : 'text-yellow-300'}`}>{msg.text}</p>}
      <EmailPreview open={!!preview} onClose={() => setPreview(null)} report={preview} />
    </Panel>
  );
}

// ── Settings (admin) ────────────────────────────────────────────────────────

function OrgSettings({ org }: { org: OrgInfo }) {
  const t = useT();
  const load = useOrgStore(s => s.load);
  const [name, setName] = useState(org.name);
  const [kind, setKind] = useState<OrgKind>(org.kind);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try { await api.updateOrg({ name, kind }); setMsg({ ok: true, text: t('org.rep.saved') }); await load(); } catch (err) { setMsg({ ok: false, text: (err as Error).message }); }
  };
  const close = async () => {
    const typed = window.prompt(t('org.set.close.prompt'));
    if (typed === null) return;
    try { await api.closeOrg(typed); await load(); } catch (err) { setMsg({ ok: false, text: (err as Error).message }); }
  };
  return (
    <Panel title={t('org.tab.settings').toUpperCase()}>
      <form onSubmit={save} className="flex flex-wrap items-end gap-3">
        <label className="flex-1 min-w-[14rem]">
          <span className={labelCls}>{t('org.create.name')}</span>
          <input className={inputCls} value={name} onChange={e => setName(e.target.value)} maxLength={80} />
        </label>
        <label>
          <span className={labelCls}>{t('org.create.kind')}</span>
          <select className={selectCls} value={kind} onChange={e => setKind(e.target.value as OrgKind)}>
            {ORG_KINDS.map(k => <option key={k} value={k}>{t(`org.kind.${k}` as MessageKey)}</option>)}
          </select>
        </label>
        <Btn type="submit" disabled={name.trim().length < 2}>{t('org.tt.save')}</Btn>
      </form>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`mt-3 text-sm font-mono ${msg.ok ? 'text-green-400' : 'text-yellow-300'}`}>{msg.text}</p>}
      <div className="mt-8 border-t border-red-500/20 pt-4">
        <Btn variant="danger" onClick={close}>{t('org.set.close')}</Btn>
      </div>
    </Panel>
  );
}

// ── Seats & billing (admin) ─────────────────────────────────────────────────

function Billing({ org }: { org: OrgInfo }) {
  const t = useT();
  const locale = useLocaleStore(s => s.locale);
  const config = useConfigStore(s => s.config);
  const [params] = useSearchParams();
  const [b, setB] = useState<OrgBilling | null>(null);
  const [seats, setSeats] = useState(50);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { api.getOrgBilling().then(r => { setB(r); setSeats(Math.max(r.students, 10)); }).catch(e => setError((e as Error).message)); }, []);
  if (!b) return error ? <p role="alert" className="text-sm font-mono text-yellow-300">{error}</p> : null;
  const money = (minor: number) => formatCurrency(locale, minor / 100, b.seatPrice.currency);
  const buy = async () => {
    setBusy(true); setError('');
    try { window.location.assign((await api.orgCheckout(seats)).url); } catch (e) { setError((e as Error).message); setBusy(false); }
  };
  const support = config?.brand.supportEmail;
  return (
    <Panel title={t('org.tab.billing').toUpperCase()}>
      {params.get('checkout') === 'success' && <p role="status" className="mb-3 text-sm font-mono text-green-300">{t('org.bill.success')}</p>}
      <p className="font-display text-2xl text-white">{t('org.bill.price', { price: money(b.seatPrice.amountMinor) })}</p>
      <p className="mt-1 text-[11px] font-mono text-gray-400">{t('org.bill.includes')}</p>
      <div className="mt-3"><PlanLine org={{ ...org, students: b.students, plan: b.plan }} /></div>
      {b.checkoutEnabled ? (
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <label>
            <span className={labelCls}>{t('org.bill.seats')}</span>
            <input type="number" min={1} max={5000} className={`${inputCls} w-32`} value={seats} onChange={e => setSeats(Math.max(1, Math.min(5000, Number(e.target.value) || 1)))} />
          </label>
          <p className="text-sm font-mono text-gray-200 pb-2">{t('org.bill.total', { price: money(b.seatPrice.amountMinor * seats) })}</p>
          <Btn onClick={buy} disabled={busy}>{t('org.bill.buy')}</Btn>
        </div>
      ) : (
        <p className="mt-5 text-sm font-mono text-gray-300">{support ? t('org.bill.offline', { email: support }) : t('org.bill.offlineNoEmail')}</p>
      )}
      {error && <p role="alert" className="mt-3 text-sm font-mono text-yellow-300">{error}</p>}
    </Panel>
  );
}
