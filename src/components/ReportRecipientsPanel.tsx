import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, REPORT_RELATIONS, type RenderedReport, type ReportRecipients, type ReportRelation, type ReportScope } from '../lib/api';
import { Btn, Modal, Panel, inputCls } from './hunter/ui';
import { formatDate, useLocaleStore, useT } from '../i18n';
import type { MessageKey } from '../i18n/messages/en';

const errCode = (e: unknown) => (e instanceof ApiError ? (e.data as { code?: string } | undefined)?.code : undefined);
const selectCls = 'bg-[#161b22] border border-purple-500/20 rounded-lg px-2 py-2 text-sm font-mono text-white focus:outline-none focus:border-purple-400';

/** An email preview. Sandboxed without allow-scripts, so the report HTML can never run script; same-origin only so it renders in-process. */
export function EmailPreview({ open, onClose, report }: { open: boolean; onClose: () => void; report: RenderedReport | null }) {
  return (
    <Modal open={open} onClose={onClose} title={report?.subject ?? ''} wide>
      {report && <iframe title={report.subject} sandbox="allow-same-origin" srcDoc={report.html} className="w-full h-[60vh] rounded-lg bg-white" />}
    </Modal>
  );
}

/** Who receives the hunter's weekly report by email, and which part (institution / personal / both). */
export default function ReportRecipientsPanel() {
  const t = useT();
  const locale = useLocaleStore(s => s.locale);
  const [data, setData] = useState<ReportRecipients | null>(null);
  const [email, setEmail] = useState('');
  const [relation, setRelation] = useState<ReportRelation>('parent');
  const [scope, setScope] = useState<ReportScope>('both');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<RenderedReport | null>(null);

  const load = useCallback(() => api.getReportRecipients().then(setData).catch(() => {}), []);
  useEffect(() => { void load(); }, [load]);

  const fail = (e: unknown) => {
    const c = errCode(e);
    const key = c === 'duplicate' ? 'rep.err.duplicate' : c === 'bad_email' ? 'rep.err.bad_email' : null;
    setMsg({ ok: false, text: key ? t(key) : (e as Error).message });
  };
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      await api.addReportRecipient(email.trim(), relation, data?.inInstitution ? scope : 'both');
      setEmail('');
      await load();
    } catch (err) { fail(err); } finally { setBusy(false); }
  };
  const update = async (id: number, patch: { scope?: ReportScope; active?: boolean }) => {
    try { await api.updateReportRecipient(id, patch); await load(); } catch (err) { fail(err); }
  };
  const remove = async (id: number) => {
    try { await api.removeReportRecipient(id); await load(); } catch (err) { fail(err); }
  };
  const showPreview = async () => {
    try { setPreview((await api.getWeeklyEmail('both')).preview); } catch (err) { fail(err); }
  };
  const sendNow = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await api.sendWeeklyEmail();
      setMsg({ ok: r.sent > 0, text: t('rep.sent', { sent: r.sent, total: r.recipients }) });
      await load();
    } catch (err) { fail(err); } finally { setBusy(false); }
  };

  const scopes: ReportScope[] = data?.inInstitution ? ['both', 'org', 'personal'] : [];
  const activeCount = data?.recipients.filter(r => r.active).length ?? 0;

  return (
    <Panel title={t('rep.title').toUpperCase()}>
      <p className="text-sm text-gray-300 font-mono leading-relaxed">{t('rep.hint')}</p>
      {data && !data.mailConfigured && <p role="note" className="mt-3 text-xs font-mono text-yellow-300 border border-yellow-500/30 bg-yellow-500/10 rounded-lg px-3 py-2">{t('rep.noMail')}</p>}

      <ul className="mt-4 space-y-2">
        {data?.recipients.length === 0 && <li className="text-sm font-mono text-gray-400">{t('rep.none')}</li>}
        {data?.recipients.map(r => (
          <li key={r.id} className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 ${r.active ? 'border-purple-500/20 bg-[#161b22]/60' : 'border-white/5 bg-black/20 opacity-70'}`}>
            <span className="flex-1 min-w-[12rem]">
              <span className="block text-sm font-mono text-white break-all">{r.email}</span>
              <span className="block text-[11px] font-mono text-gray-400">
                {t(`rep.rel.${r.relation}` as MessageKey)}
                {r.managedByInstitution && ` · ${t('rep.managed')}`}
                {!r.active && ` · ${t('rep.paused')}`}
                {r.lastSentAt && ` · ${t('rep.lastSent', { date: formatDate(locale, r.lastSentAt) })}`}
              </span>
            </span>
            {r.managedByInstitution ? (
              <span className="text-[11px] font-mono text-amber-300">{t('rep.scope.org')}</span>
            ) : (
              <>
                {scopes.length > 0 && (
                  <select aria-label={t('rep.scope')} className={selectCls} value={r.scope} onChange={e => update(r.id, { scope: e.target.value as ReportScope })}>
                    {scopes.map(s => <option key={s} value={s}>{t(`rep.scope.${s}` as MessageKey)}</option>)}
                  </select>
                )}
                <Btn variant="ghost" onClick={() => update(r.id, { active: !r.active })}>{r.active ? t('rep.pause') : t('rep.resume')}</Btn>
                <Btn variant="danger" onClick={() => remove(r.id)}>{t('rep.remove')}</Btn>
              </>
            )}
          </li>
        ))}
      </ul>

      {data && data.recipients.length < data.max && (
        <form onSubmit={add} className="mt-4 flex flex-wrap items-end gap-2">
          <label className="flex-1 min-w-[14rem]">
            <span className="block text-[11px] font-mono uppercase tracking-wider text-gray-400 mb-1">{t('rep.email')}</span>
            <input type="email" required className={inputCls} value={email} onChange={e => setEmail(e.target.value)} placeholder="parent@example.com" autoComplete="off" maxLength={254} />
          </label>
          <label>
            <span className="block text-[11px] font-mono uppercase tracking-wider text-gray-400 mb-1">{t('rep.relation')}</span>
            <select className={selectCls} value={relation} onChange={e => setRelation(e.target.value as ReportRelation)}>
              {REPORT_RELATIONS.map(r => <option key={r} value={r}>{t(`rep.rel.${r}` as MessageKey)}</option>)}
            </select>
          </label>
          {scopes.length > 0 && (
            <label>
              <span className="block text-[11px] font-mono uppercase tracking-wider text-gray-400 mb-1">{t('rep.scope')}</span>
              <select className={selectCls} value={scope} onChange={e => setScope(e.target.value as ReportScope)}>
                {scopes.map(s => <option key={s} value={s}>{t(`rep.scope.${s}` as MessageKey)}</option>)}
              </select>
            </label>
          )}
          <Btn type="submit" disabled={busy || !email.trim()}>{t('rep.add')}</Btn>
        </form>
      )}
      {data && <p className="mt-2 text-[11px] font-mono text-gray-500">{t('rep.limit', { max: data.max })}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <Btn variant="ghost" onClick={showPreview}>{t('rep.preview')}</Btn>
        <Btn onClick={sendNow} disabled={busy || !data?.mailConfigured || activeCount === 0}>{t('rep.send')}</Btn>
      </div>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`mt-3 text-sm font-mono ${msg.ok ? 'text-green-400' : 'text-yellow-300'}`}>{msg.text}</p>}
      <EmailPreview open={!!preview} onClose={() => setPreview(null)} report={preview} />
    </Panel>
  );
}
