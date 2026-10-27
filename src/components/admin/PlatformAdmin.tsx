import { useCallback, useEffect, useState } from 'react';
import { api, type AdminOrgRow, type PlatformSettings } from '../../lib/api';
import { useConfigStore } from '../../store/configStore';
import { Btn, Panel, inputCls } from '../hunter/ui';

const labelCls = 'block text-[11px] font-mono uppercase tracking-wider text-gray-400 mb-1';
const rupees = (paise: number) => String(paise / 100);
const toPaise = (rupeesText: string) => Math.round(Number(rupeesText) * 100);

/**
 * Super admin only (/admin): the product's name and prices, which every page,
 * email and checkout read from, and every institution with its seats.
 */
export default function PlatformAdmin() {
  return (
    <>
      <PlatformSettingsPanel />
      <InstitutionsPanel />
    </>
  );
}

function PlatformSettingsPanel() {
  const [s, setS] = useState<PlatformSettings | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const fill = (x: PlatformSettings) => {
    setS(x);
    setForm({
      brandName: x.brandName, tagline: x.tagline, supportEmail: x.supportEmail,
      proYearInr: rupees(x.proYearInr), proMonthInr: rupees(x.proMonthInr), orgSeatYearInr: rupees(x.orgSeatYearInr),
      orgTrialDays: String(x.orgTrialDays), orgTrialSeats: String(x.orgTrialSeats),
    });
  };
  useEffect(() => { api.getPlatformSettings().then(r => fill(r.settings)).catch(e => setMsg({ ok: false, text: (e as Error).message })); }, []);
  if (!s) return msg ? <Panel title="PLATFORM"><p role="alert" className="text-sm font-mono text-yellow-300">{msg.text}</p></Panel> : null;

  const field = (key: string, label: string, opts: { type?: string; prefix?: string; hint?: string } = {}) => (
    <label key={key} className="block">
      <span className={labelCls}>{label}</span>
      <span className="flex items-center gap-1">
        {opts.prefix && <span className="text-sm font-mono text-gray-400">{opts.prefix}</span>}
        <input className={inputCls} type={opts.type ?? 'text'} value={form[key] ?? ''} onChange={e => setForm({ ...form, [key]: e.target.value })} />
      </span>
      {opts.hint && <span className="block mt-1 text-[11px] font-mono text-gray-500">{opts.hint}</span>}
    </label>
  );

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const r = await api.savePlatformSettings({
        brandName: form.brandName, tagline: form.tagline, supportEmail: form.supportEmail,
        proYearInr: toPaise(form.proYearInr), proMonthInr: toPaise(form.proMonthInr), orgSeatYearInr: toPaise(form.orgSeatYearInr),
        orgTrialDays: Number(form.orgTrialDays), orgTrialSeats: Number(form.orgTrialSeats),
      });
      fill(r.settings);
      // Every open page picks the new name up at once.
      useConfigStore.getState().apply(await api.getPublicConfig(true));
      setMsg({ ok: true, text: 'Saved. The new name and prices are live for every visitor.' });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="PLATFORM SETTINGS (SUPER ADMIN)">
      <form onSubmit={save} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {field('brandName', 'Website name', { hint: 'Shown in the app, landing page, emails and checkout.' })}
          {field('supportEmail', 'Support email', { type: 'email', hint: 'Shown to institutions that want an invoice.' })}
        </div>
        {field('tagline', 'Tagline')}
        <div>
          <p className="text-xs font-mono text-gray-300 mb-2">Prices in India (INR). Other regions keep their own currency prices.</p>
          <div className="grid gap-4 sm:grid-cols-3">
            {field('proYearInr', 'Individual · per year', { type: 'number', prefix: '₹' })}
            {field('proMonthInr', 'Individual · per month', { type: 'number', prefix: '₹' })}
            {field('orgSeatYearInr', 'Institution · per student / year', { type: 'number', prefix: '₹' })}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {field('orgTrialDays', 'Institution free trial (days)', { type: 'number' })}
          {field('orgTrialSeats', 'Students during the trial', { type: 'number' })}
        </div>
        <Btn type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save platform settings'}</Btn>
        {msg && <p role={msg.ok ? 'status' : 'alert'} className={`text-sm font-mono ${msg.ok ? 'text-green-400' : 'text-yellow-300'}`}>{msg.text}</p>}
      </form>
    </Panel>
  );
}

function InstitutionsPanel() {
  const [orgs, setOrgs] = useState<AdminOrgRow[] | null>(null);
  const [edit, setEdit] = useState<{ id: number; seats: string; until: string } | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(() => api.getAdminOrgs().then(r => setOrgs(r.orgs)).catch(e => setError((e as Error).message)), []);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!edit) return;
    setError('');
    try {
      await api.grantOrgSeats(edit.id, Number(edit.seats), edit.until ? new Date(`${edit.until}T23:59:59Z`).toISOString() : null);
      setEdit(null);
      await load();
    } catch (e) { setError((e as Error).message); }
  };
  const fmt = (d: string | null) => (d ? new Date(d).toISOString().slice(0, 10) : '—');

  return (
    <Panel title="INSTITUTIONS (B2B)">
      {error && <p role="alert" className="mb-3 text-sm font-mono text-yellow-300">{error}</p>}
      {orgs?.length === 0 && <p className="text-sm font-mono text-gray-400">No institutions yet.</p>}
      {!!orgs?.length && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono text-left">
            <thead className="text-gray-400">
              <tr><th className="py-1 pr-3">Institution</th><th className="pr-3">Admin</th><th className="pr-3">Students</th><th className="pr-3">Plan</th><th className="pr-3">Seats</th><th className="pr-3">Until</th><th /></tr>
            </thead>
            <tbody className="text-gray-200">
              {orgs.map(o => (
                <tr key={o.id} className="border-t border-white/5 align-top">
                  <td className="py-2 pr-3">{o.name}<span className="block text-gray-500">{o.kind} · since {fmt(o.createdAt)}</span></td>
                  <td className="pr-3">{o.admin ?? '—'}</td>
                  <td className="pr-3">{o.students} <span className="text-gray-500">+{o.staff} staff</span></td>
                  <td className="pr-3">{!o.plan.active ? <span className="text-yellow-300">inactive</span> : o.plan.trial ? 'trial / grant' : 'paid'}</td>
                  <td className="pr-3">
                    {edit?.id === o.id
                      ? <input aria-label="Seats" type="number" min={0} className={`${inputCls} w-24`} value={edit.seats} onChange={e => setEdit({ ...edit, seats: e.target.value })} />
                      : o.plan.seats}
                  </td>
                  <td className="pr-3">
                    {edit?.id === o.id
                      ? <input aria-label="Until" type="date" className={inputCls} value={edit.until} onChange={e => setEdit({ ...edit, until: e.target.value })} />
                      : fmt(o.plan.until)}
                  </td>
                  <td className="whitespace-nowrap">
                    {edit?.id === o.id ? (
                      <span className="flex gap-1"><Btn onClick={save}>Save</Btn><Btn variant="ghost" onClick={() => setEdit(null)}>Cancel</Btn></span>
                    ) : (
                      <Btn variant="ghost" onClick={() => setEdit({ id: o.id, seats: String(o.grantSeats), until: o.grantUntil ? fmt(o.grantUntil) : '' })}>Grant seats</Btn>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-[11px] font-mono text-gray-400">Grants are for invoices paid offline, pilots and discounts. Paid seat subscriptions add to them automatically.</p>
    </Panel>
  );
}
