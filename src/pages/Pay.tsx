import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ApiError, type PayLinkInfo } from '../lib/api';
import { formatCurrency, formatDate, useLocaleStore, useT } from '../i18n';
import BackgroundFX from '../components/BackgroundFX';
import LanguagePicker from '../components/LanguagePicker';
import LegalLinks from '../components/LegalLinks';

const codeOf = (e: unknown) => (e instanceof ApiError ? (e.data as { code?: string } | undefined)?.code : undefined);

/** The page a parent or guardian opens from their child's pay link (/pay#token=…). No account needed. */
export default function Pay() {
  const t = useT();
  const locale = useLocaleStore(s => s.locale);
  const [params] = useSearchParams();
  // The token lives in the URL fragment: it never reaches a server log or a Referer header.
  const token = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token') ?? '';
  const done = params.get('done') === '1';
  const cancelled = params.get('cancelled') === '1';
  const [info, setInfo] = useState<PayLinkInfo | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'invalid'>(token ? 'loading' : done || cancelled ? 'ready' : 'invalid');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const load = () => api.lookupPayLink(token).then(i => { setInfo(i); setState('ready'); }).catch(() => setState('invalid'));
  useEffect(() => { document.title = `${t('pay.title')} · Hunter System`; }, [t]);
  useEffect(() => { if (token) void load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const money = (p: { currency: string; amountMinor: number }) => formatCurrency(locale, p.amountMinor / 100, p.currency);
  const intervalWord = (i: 'month' | 'year') => t(i === 'year' ? 'pay.interval.year' : 'pay.interval.month');

  const pay = async () => {
    setBusy(true); setError('');
    try { window.location.assign((await api.payLinkCheckout(token)).url); }
    catch (err) {
      const c = codeOf(err);
      setError(c === 'expired' ? t('pay.expired') : c === 'already_subscribed' ? t('pay.already') : t('pay.error'));
      setBusy(false);
    }
  };
  const cancel = async () => {
    if (!window.confirm(t('pay.cancel.confirm'))) return;
    setBusy(true); setError(''); setNote('');
    try { await api.payLinkCancel(token); setNote(t('pay.cancel.done')); await load(); } catch { setError(t('pay.cancel.failed')); } finally { setBusy(false); }
  };

  const sub = info?.subscription;
  return (
    <main className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-base)' }}>
      <BackgroundFX />
      <div className="relative w-full max-w-xl rounded-2xl p-6 sm:p-8 backdrop-blur-xl space-y-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--accent-border)' }}>
        <div className="flex items-center justify-between">
          <h1 className="font-display text-xl sm:text-2xl text-white tracking-wider">{t('pay.title')}</h1>
          <LanguagePicker />
        </div>

        {done && <p role="status" className="text-sm font-mono text-green-300 border border-green-500/30 bg-green-500/10 rounded-lg px-4 py-3">{t('pay.done')}</p>}
        {cancelled && <p role="status" className="text-sm font-mono text-gray-300">{t('pay.cancelled')}</p>}
        {state === 'loading' && <p className="text-sm font-mono text-gray-400">{t('common.loading')}</p>}
        {state === 'invalid' && !done && !cancelled && <p role="alert" className="text-sm font-mono text-gray-300">{t('pay.invalid')}</p>}

        {state === 'ready' && info && (
          <>
            <p className="text-sm text-gray-300 leading-relaxed">{t('pay.intro')}</p>
            <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4">
              <p className="text-xs font-mono text-gray-400">{info.name ? t('pay.for', { name: info.name }) : t('pay.forUnnamed')}</p>
              <p className="mt-1 font-display text-3xl text-white">{t('pay.price', { price: money(info), interval: intervalWord(info.interval) })}</p>
              <p className="mt-2 text-xs font-mono text-gray-400">{t('pay.cancelAnytime')}</p>
            </div>

            {info.subscribed && sub ? (
              <div className="space-y-3">
                <p className="text-sm font-mono text-green-300">{t('pay.already')}</p>
                <p className="text-sm font-mono text-gray-300">
                  {sub.cancelAtPeriodEnd
                    ? t('pay.ends', { date: sub.currentPeriodEnd ? formatDate(locale, sub.currentPeriodEnd, { dateStyle: 'long' }) : '' })
                    : t('pay.renews', { date: sub.currentPeriodEnd ? formatDate(locale, sub.currentPeriodEnd, { dateStyle: 'long' }) : '', price: money(sub) })}
                </p>
                {!sub.cancelAtPeriodEnd && <button onClick={cancel} disabled={busy} className="px-4 py-2 rounded-lg border border-red-500/40 text-red-300 hover:bg-red-500/10 text-sm font-mono disabled:opacity-50">{t('pay.cancel')}</button>}
              </div>
            ) : info.expired ? (
              <p role="alert" className="text-sm font-mono text-yellow-300">{t('pay.expired')}</p>
            ) : (
              <>
                <label className="flex items-start gap-3 text-sm font-mono text-gray-200 cursor-pointer">
                  <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} className="mt-0.5 accent-purple-500" />
                  <span>{t('pay.confirm')}</span>
                </label>
                <button onClick={pay} disabled={!agree || busy} className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-display font-bold py-3 rounded-lg disabled:opacity-50">
                  {busy ? t('pay.cta.working') : t('pay.cta')}
                </button>
              </>
            )}
            {note && <p role="status" className="text-sm font-mono text-green-400">{note}</p>}
            {error && <p role="alert" className="text-sm font-mono text-red-400">{error}</p>}
          </>
        )}
        <div className="flex items-center justify-between pt-2">
          <LegalLinks />
          <Link to="/login" className="text-[11px] font-mono text-gray-400 hover:text-white">Hunter System</Link>
        </div>
      </div>
    </main>
  );
}
