import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError, type BillingState, type PlansResponse } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { trackEvent } from '../lib/track';
import { formatCurrency, translate, useLocaleStore, useT } from '../i18n';
import type { MessageKey } from '../i18n/messages/en';
import BackgroundFX from '../components/BackgroundFX';
import LanguagePicker from '../components/LanguagePicker';
import LegalLinks from '../components/LegalLinks';

// Region choices, each standing for a price group (see server/src/pricing.ts).
const REGIONS = ['IN', 'US', 'GB', 'DE', 'AE', 'ID'] as const;

/** Public pricing page (/pricing). Free first, honest prices in the visitor's currency, no countdowns or fake scarcity. */
export default function Pricing() {
  const t = useT();
  const locale = useLocaleStore(s => s.locale);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const user = useAuthStore(s => s.user);
  const [region, setRegion] = useState<string | undefined>(undefined);
  const [data, setData] = useState<PlansResponse | null>(null);
  const [interval, setIntervalState] = useState<'month' | 'year'>('year');
  const [billing, setBilling] = useState<BillingState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const checkout = params.get('checkout');
  const [confirm, setConfirm] = useState<'idle' | 'waiting' | 'done' | 'slow'>('idle');
  const viewed = useRef(false);

  useEffect(() => {
    document.title = `${t('pricing.title')} · Hunter System`;
    if (!viewed.current) { viewed.current = true; trackEvent('pricing_view', { page: '/pricing' }); }
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    api.getPlans(region).then(d => { if (!cancelled) setData(d); }).catch(() => { if (!cancelled) setError(t('pricing.error')); });
    return () => { cancelled = true; };
  }, [region, t]);

  useEffect(() => {
    if (!user) return;
    api.getBilling().then(setBilling).catch(() => {});
  }, [user]);

  // Returning from checkout: access only appears when the provider's webhook has been verified, so poll for it.
  useEffect(() => {
    if (checkout !== 'success' || !user) return;
    let stop = false;
    let tries = 0;
    const timers: number[] = [];
    const poll = async () => {
      if (stop) return;
      tries += 1;
      try {
        const b = await api.getBilling();
        if (stop) return;
        setBilling(b);
        if (b.plan !== 'free') { setConfirm('done'); return; }
      } catch { /* try again */ }
      if (tries >= 20) { setConfirm('slow'); return; }
      setConfirm('waiting');
      timers.push(window.setTimeout(poll, 3000));
    };
    void poll();
    return () => { stop = true; timers.forEach(clearTimeout); };
  }, [checkout, user]);

  const pro = data?.plans.find(p => p.id === 'pro');
  const free = data?.plans.find(p => p.id === 'free');
  const price = pro?.prices?.[interval];
  const money = (p: { currency: string; amountMinor: number }) => formatCurrency(locale, p.amountMinor / 100, p.currency);
  const selectedRegion = region ?? data?.region ?? 'US';
  // The detected region may be a country outside our six picks; show its price group's representative.
  const pickerValue = (REGIONS as readonly string[]).includes(selectedRegion) ? selectedRegion : data?.group === 'EU' ? 'DE' : data?.group === 'LOW' ? 'ID' : data?.group === 'AE' ? 'AE' : data?.group === 'GB' ? 'GB' : data?.group === 'IN' ? 'IN' : 'US';
  const isPro = billing ? billing.plan !== 'free' : false;
  const isMinor = user?.consentStatus === 'granted';
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const upgrade = async () => {
    trackEvent('upgrade_click', { page: '/pricing' });
    if (!user) { navigate('/login', { state: { from: '/pricing' } }); return; }
    setBusy(true);
    setError('');
    try {
      const r = await api.startCheckout(interval, pickerValue);
      window.location.assign(r.url);
    } catch (err) {
      const code = err instanceof ApiError ? (err.data as { code?: string } | undefined)?.code : undefined;
      setError(code === 'adult_required' ? t('pricing.minor') : code === 'already_subscribed' ? t('pricing.alreadyPro') : t('pricing.error'));
      setBusy(false);
    }
  };

  // Under-18s cannot buy: make a link a parent or guardian can open and pay from.
  const askParent = async () => {
    trackEvent('upgrade_click', { page: '/pricing' });
    setBusy(true);
    setError('');
    try {
      const r = await api.createPayLink(interval, pickerValue);
      setShareUrl(r.url);
    } catch {
      setError(t('pricing.askParent.error'));
    } finally {
      setBusy(false);
    }
  };
  const shareText = () => t('pricing.askParent.share', { price: price ? money(price) : '', interval: t(interval === 'month' ? 'pay.interval.month' : 'pay.interval.year') });
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(`${shareText()} ${shareUrl}`); setCopied(true); } catch { /* clipboard blocked */ }
  };

  const feature = (key: MessageKey, vars?: Record<string, string | number>) => (
    <li key={key + String(vars?.count ?? '')} className="flex gap-2 text-sm text-gray-300">
      <span aria-hidden className="text-purple-400">✓</span>
      <span>{translate(locale, key, vars)}</span>
    </li>
  );

  return (
    <main className="min-h-screen px-4 py-10" style={{ background: 'var(--bg-base)' }}>
      <BackgroundFX />
      <div className="relative max-w-4xl mx-auto">
        <nav className="flex items-center justify-between text-xs font-mono mb-8">
          <Link to={user ? '/' : '/login'} className="text-purple-300 hover:text-white">← Hunter System</Link>
          <LanguagePicker />
        </nav>

        <header className="text-center">
          <h1 className="font-display text-3xl sm:text-4xl text-white font-bold tracking-wider">{t('pricing.title')}</h1>
          <p className="mt-3 text-sm sm:text-base text-gray-300 max-w-2xl mx-auto leading-relaxed">{t('pricing.subtitle')}</p>
        </header>

        {checkout === 'cancelled' && <p role="status" className="mt-6 text-center text-sm font-mono text-gray-300">{t('pricing.cancelled')}</p>}
        {checkout === 'success' && (
          <p role="status" className={`mt-6 text-center text-sm font-mono rounded-lg px-4 py-3 border ${confirm === 'done' ? 'text-green-300 border-green-500/30 bg-green-500/10' : 'text-yellow-200 border-yellow-500/30 bg-yellow-500/10'}`}>
            {!user ? t('pricing.success.slow') : confirm === 'done' ? t('pricing.success.done') : confirm === 'slow' ? t('pricing.success.slow') : t('pricing.success.confirming')}
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <label className="inline-flex items-center gap-2 text-xs font-mono text-gray-400">
            {t('pricing.region')}
            <select
              value={pickerValue}
              onChange={e => setRegion(e.target.value)}
              aria-describedby="region-hint"
              className="bg-[#0d1117] border border-purple-500/30 rounded-md px-2 py-1 text-gray-200"
            >
              {REGIONS.map(r => <option key={r} value={r}>{t(`pricing.region.${r}` as MessageKey)}</option>)}
            </select>
          </label>
          <div role="group" aria-label="Billing period" className="inline-flex rounded-lg bg-[#0d1117] p-1 border border-purple-500/20">
            {(['month', 'year'] as const).map(i => (
              <button
                key={i}
                aria-pressed={interval === i}
                onClick={() => setIntervalState(i)}
                className={`px-4 py-1.5 rounded-md text-sm font-mono ${interval === i ? 'bg-purple-500/25 text-white' : 'text-gray-400 hover:text-gray-200'}`}
              >
                {t(i === 'month' ? 'pricing.interval.month' : 'pricing.interval.year')}
                {i === 'year' && pro?.yearlySavingsPct ? <span className="ml-2 text-[10px] text-green-300">{t('pricing.save', { percent: pro.yearlySavingsPct })}</span> : null}
              </button>
            ))}
          </div>
        </div>
        <p id="region-hint" className="mt-2 text-center text-[11px] font-mono text-gray-400">{t('pricing.region.hint')}</p>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <section aria-labelledby="plan-free" className="rounded-2xl p-6 border border-purple-500/20 bg-[#0d1117]/80">
            <h2 id="plan-free" className="font-display text-white tracking-widest">{t('pricing.free.name')}</h2>
            <p className="mt-2 text-3xl font-display text-white">{t('pricing.free.price')}</p>
            <ul className="mt-5 space-y-2">
              {feature('pricing.feature.free.1')}
              {feature('pricing.feature.free.2')}
              {feature('pricing.feature.free.3')}
              {feature('pricing.feature.free.4', { count: free?.limits.aiPerDay ?? 10 })}
            </ul>
            {!isPro && user && <p className="mt-5 text-xs font-mono text-gray-400">{t('pricing.current')}</p>}
          </section>

          <section aria-labelledby="plan-pro" className="rounded-2xl p-6 border border-purple-400/60 bg-[#0d1117]/90 shadow-lg shadow-purple-500/10">
            <h2 id="plan-pro" className="font-display text-white tracking-widest">{t('pricing.pro.name')}</h2>
            <p className="mt-2 text-3xl font-display text-white" aria-live="polite">
              {price ? money(price) : '—'}
              <span className="text-sm text-gray-400 font-mono">{t(interval === 'month' ? 'pricing.perMonth' : 'pricing.perYear')}</span>
            </p>
            <ul className="mt-5 space-y-2">
              {feature('pricing.feature.pro.1')}
              {feature('pricing.feature.pro.2', { count: pro?.limits.aiPerDay ?? 150 })}
              {feature('pricing.feature.pro.3')}
              {feature('pricing.feature.pro.4')}
            </ul>
            {isPro ? (
              <p className="mt-5 text-sm font-mono text-green-300">{t('pricing.alreadyPro')}</p>
            ) : data && !data.checkoutEnabled ? (
              <p className="mt-5 text-sm font-mono text-gray-300">{t('pricing.soon')}</p>
            ) : isMinor ? (
              <div className="mt-5 space-y-3">
                {!shareUrl ? (
                  <button onClick={askParent} disabled={busy || !data} className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-display font-bold py-3 rounded-lg disabled:opacity-50">
                    {busy ? t('pricing.askParent.working') : t('pricing.askParent')}
                  </button>
                ) : (
                  <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-4 space-y-3">
                    <p className="font-display text-white text-sm">{t('pricing.askParent.title')}</p>
                    <p className="text-xs font-mono text-gray-300">{t('pricing.askParent.body', { days: 7 })}</p>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={copyLink} className="px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-display">{t('pricing.askParent.copy')}</button>
                      <a href={`https://wa.me/?text=${encodeURIComponent(`${shareText()} ${shareUrl}`)}`} target="_blank" rel="noopener noreferrer" className="px-3 py-2 rounded-lg border border-green-500/40 text-green-300 hover:bg-green-500/10 text-sm font-display">{t('pricing.askParent.whatsapp')}</a>
                    </div>
                    {copied && <p role="status" className="text-xs font-mono text-green-400">{t('pricing.askParent.copied')}</p>}
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={upgrade}
                disabled={busy || !data}
                className="mt-5 w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-display font-bold py-3 rounded-lg disabled:opacity-50"
              >
                {busy ? t('pricing.cta.starting') : user ? t('pricing.cta.upgrade') : t('pricing.cta.login')}
              </button>
            )}
            {data?.mode === 'test' && <p className="mt-3 text-[11px] font-mono text-yellow-300">{t('pricing.testMode')}</p>}
            {error && <p role="alert" className="mt-3 text-sm font-mono text-red-400">{error}</p>}
          </section>
        </div>

        <p className="mt-6 text-center text-xs font-mono text-gray-400">{t('pricing.cancelAnytime')}</p>
        <LegalLinks className="mt-6 text-center" />
      </div>
    </main>
  );
}
