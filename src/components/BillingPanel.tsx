import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type BillingState } from '../lib/api';
import { formatCurrency, formatDate, useLocaleStore, useT } from '../i18n';

/** Settings → plan, renewal and one-tap cancel. Nothing here can grant a plan: only verified payment webhooks do. */
export default function BillingPanel() {
  const t = useT();
  const locale = useLocaleStore(s => s.locale);
  const [state, setState] = useState<BillingState | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => api.getBilling().then(setState).catch(() => {}), []);
  useEffect(() => { void load(); }, [load]);

  const cancel = async () => {
    if (!window.confirm(t('billing.cancel.confirm'))) return;
    setBusy(true);
    setError('');
    setNote('');
    try {
      setState(await api.cancelSubscription());
      setNote(t('billing.cancel.done'));
    } catch {
      setError(t('billing.cancel.failed'));
    } finally {
      setBusy(false);
    }
  };

  const date = (d: string | null) => (d ? formatDate(locale, d, { dateStyle: 'long' }) : '');
  const sub = state?.subscription;
  const live = state && state.plan !== 'free';

  let line = '';
  if (state) {
    if (!live) line = t('billing.plan.free');
    else if (state.source === 'grant') line = t('billing.source.grant', { date: date(state.until) });
    else if (sub?.status === 'past_due') line = t('billing.pastDue', { date: date(state.until) });
    else if (sub?.cancelAtPeriodEnd) line = t('billing.ends', { date: date(state.until) });
    else if (sub) line = t('billing.renews', { date: date(state.until), price: formatCurrency(locale, sub.amountMinor / 100, sub.currency), interval: t(sub.interval === 'year' ? 'billing.interval.year' : 'billing.interval.month') });
    else line = t('billing.plan.pro');
  }

  return (
    <section aria-labelledby="billing-title" className="bg-[#0d1117]/80 backdrop-blur-xl rounded-xl border border-accent-border p-5 space-y-3">
      <h2 id="billing-title" className="font-display text-white font-bold tracking-widest text-sm">{t('billing.title')}</h2>
      {!state ? <p className="text-xs font-mono text-gray-400">{t('billing.loading')}</p> : <p className="text-sm font-mono text-gray-300">{line}</p>}
      {state && <p className="text-xs font-mono text-gray-400">{t('billing.aiUsed', { used: state.aiUsedToday, limit: state.limits.aiPerDay })}</p>}
      <div className="flex flex-wrap items-center gap-3">
        {state && !live && <Link to="/pricing" className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-display text-sm tracking-wider">{t('billing.upgrade')}</Link>}
        {sub && live && state?.source === 'subscription' && !sub.cancelAtPeriodEnd && (
          <button onClick={cancel} disabled={busy} className="px-4 py-2 rounded-lg border border-red-500/40 text-red-300 hover:bg-red-500/10 text-sm font-mono disabled:opacity-50">{t('billing.cancel')}</button>
        )}
      </div>
      {note && <p role="status" className="text-xs font-mono text-green-400">{note}</p>}
      {error && <p role="alert" className="text-xs font-mono text-red-400">{error}</p>}
    </section>
  );
}
