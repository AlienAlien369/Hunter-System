import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { trackEvent } from '../lib/track';
import { useDocumentMeta } from '../lib/meta';
import { browserLooksIndian } from '../utils/market';
import { formatCurrency, suggestLocale, useLocaleStore, useT } from '../i18n';
import type { MessageKey } from '../i18n/messages/en';
import BackgroundFX from '../components/BackgroundFX';
import LanguagePicker from '../components/LanguagePicker';
import LegalLinks from '../components/LegalLinks';

export type LandingVariant = 'global' | 'india';

const FOR: Record<LandingVariant, MessageKey[]> = {
  global: ['landing.for.global.1', 'landing.for.global.2', 'landing.for.global.3', 'landing.for.global.4'],
  india: ['landing.for.india.1', 'landing.for.india.2', 'landing.for.india.3', 'landing.for.india.4', 'landing.for.india.5', 'landing.for.india.6'],
};
const HOW = [
  ['🗓️', 'landing.how.1.title', 'landing.how.1.body'],
  ['⚔️', 'landing.how.2.title', 'landing.how.2.body'],
  ['🏆', 'landing.how.3.title', 'landing.how.3.body'],
] as const;
const FEATURES = [
  ['🧩', 'landing.feat.1.title', 'landing.feat.1.body'],
  ['🧠', 'landing.feat.2.title', 'landing.feat.2.body'],
  ['🌍', 'landing.feat.3.title', 'landing.feat.3.body'],
  ['🔒', 'landing.feat.4.title', 'landing.feat.4.body'],
] as const;
const FAQ = [
  ['landing.faq.1.q', 'landing.faq.1.a'],
  ['landing.faq.2.q', 'landing.faq.2.a'],
  ['landing.faq.3.q', 'landing.faq.3.a'],
  ['landing.faq.4.q', 'landing.faq.4.a'],
  ['landing.faq.5.q', 'landing.faq.5.a'],
] as const;
const TRUST: MessageKey[] = ['landing.trust.1', 'landing.trust.2', 'landing.trust.3', 'landing.trust.4'];

/**
 * Public home page for signed-out visitors. One page, two voices:
 *  - global (/):  students, remote workers, habit builders, gamers
 *  - india  (/in): exam and interview consistency, Hinglish by default
 * Same product, same account system; only the words and examples change.
 */
export default function Landing({ variant }: { variant: LandingVariant }) {
  const t = useT();
  const locale = useLocaleStore(s => s.locale);
  const path = variant === 'india' ? '/in' : '/';
  const [monthly, setMonthly] = useState<string | null>(null);
  const showIndiaOffer = variant === 'global' && browserLooksIndian();

  useDocumentMeta({ title: t(`landing.meta.title.${variant}` as MessageKey), description: t(`landing.meta.description.${variant}` as MessageKey), path });

  // /in is written for India: open it in Hinglish unless the visitor already chose a language.
  useEffect(() => { if (variant === 'india') suggestLocale('hi-Latn'); }, [variant]);
  useEffect(() => { trackEvent('landing_view', { page: path }); }, [path]);
  useEffect(() => {
    api.getPlans().then(p => {
      const price = p.plans.find(x => x.id === 'pro')?.prices?.month;
      if (price) setMonthly(formatCurrency(locale, price.amountMinor / 100, price.currency));
    }).catch(() => { /* the page reads fine without a price */ });
  }, [locale]);

  const cta = (
    <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
      <Link to="/login?mode=register" onClick={() => trackEvent('cta_click', { page: path })} className="w-full sm:w-auto text-center bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-display font-bold px-8 py-3 rounded-lg shadow-lg shadow-purple-500/25">
        {t('landing.cta.start')}
      </Link>
      <Link to="/login" className="text-sm font-mono text-gray-300 hover:text-white underline-offset-4 hover:underline">{t('landing.cta.login')}</Link>
    </div>
  );

  return (
    <div className="min-h-screen text-white" style={{ background: 'var(--bg-base)' }}>
      <BackgroundFX />
      <div className="relative">
        <header className="max-w-5xl mx-auto px-4 py-5 flex items-center justify-between">
          <Link to="/" className="font-display font-bold tracking-[0.25em] text-sm sm:text-base">{t('common.appName')}</Link>
          <div className="flex items-center gap-4">
            <LanguagePicker />
            <Link to="/login" className="text-xs font-mono text-gray-300 hover:text-white">{t('auth.tab.login')}</Link>
          </div>
        </header>

        <main>
          {showIndiaOffer && (
            <p className="max-w-3xl mx-auto px-4 text-center">
              <Link to="/in" className="inline-block text-xs font-mono text-yellow-200 border border-yellow-500/30 bg-yellow-500/10 rounded-full px-4 py-2 hover:bg-yellow-500/20">{t('landing.suggest.india')}</Link>
            </p>
          )}

          <section className="max-w-3xl mx-auto px-4 pt-12 pb-10 text-center">
            <p className="text-purple-300 font-mono text-[11px] sm:text-xs tracking-[0.25em]">{t(`landing.eyebrow.${variant}` as MessageKey)}</p>
            <h1 className="mt-4 font-display text-3xl sm:text-5xl font-bold leading-tight">{t(`landing.h1.${variant}` as MessageKey)}</h1>
            <p className="mt-5 text-base sm:text-lg text-gray-300 leading-relaxed max-w-2xl mx-auto">{t(`landing.sub.${variant}` as MessageKey)}</p>
            {cta}
            <p className="mt-10 text-[11px] font-mono text-gray-400 tracking-widest">{t('landing.for.title').toUpperCase()}</p>
            <ul className="mt-3 flex flex-wrap justify-center gap-2">
              {FOR[variant].map(k => <li key={k} className="px-3 py-1 rounded-full border border-purple-500/30 bg-purple-500/10 text-sm font-mono text-purple-100">{t(k)}</li>)}
            </ul>
          </section>

          <section className="max-w-3xl mx-auto px-4 py-10 text-center">
            <h2 className="font-display text-xl sm:text-2xl font-bold">{t(`landing.block.${variant}.title` as MessageKey)}</h2>
            <p className="mt-3 text-gray-300 leading-relaxed">{t(`landing.block.${variant}.body` as MessageKey)}</p>
          </section>

          <section aria-labelledby="how" className="max-w-5xl mx-auto px-4 py-10">
            <h2 id="how" className="font-display text-xl sm:text-2xl font-bold text-center">{t('landing.how.title')}</h2>
            <ol className="mt-8 grid gap-4 md:grid-cols-3">
              {HOW.map(([icon, title, body], i) => (
                <li key={title} className="rounded-2xl border border-purple-500/20 bg-[#0d1117]/80 p-5">
                  <p className="text-3xl" aria-hidden>{icon}</p>
                  <h3 className="mt-3 font-display text-white"><span className="text-purple-300">{i + 1}.</span> {t(title)}</h3>
                  <p className="mt-2 text-sm text-gray-300 leading-relaxed">{t(body)}</p>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="features" className="max-w-5xl mx-auto px-4 py-10">
            <h2 id="features" className="font-display text-xl sm:text-2xl font-bold text-center">{t('landing.features.title')}</h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {FEATURES.map(([icon, title, body]) => (
                <li key={title} className="flex gap-4 rounded-2xl border border-purple-500/20 bg-[#0d1117]/80 p-5">
                  <span className="text-2xl" aria-hidden>{icon}</span>
                  <div>
                    <h3 className="font-display text-white">{t(title)}</h3>
                    <p className="mt-1 text-sm text-gray-300 leading-relaxed">{t(body)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="parents" className="max-w-3xl mx-auto px-4 py-10">
            <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-6">
              <h2 id="parents" className="font-display text-lg text-white">{t('landing.parents.title')}</h2>
              <p className="mt-2 text-sm text-gray-300 leading-relaxed">{t('landing.parents.body')}</p>
            </div>
          </section>

          <section aria-labelledby="trust" className="max-w-3xl mx-auto px-4 py-6 text-center">
            <h2 id="trust" className="font-display text-lg">{t('landing.trust.title')}</h2>
            <ul className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-mono text-gray-300">
              {TRUST.map(k => <li key={k}><span aria-hidden className="text-green-400">✓ </span>{t(k)}</li>)}
            </ul>
          </section>

          <section aria-labelledby="pricing" className="max-w-3xl mx-auto px-4 py-10 text-center">
            <h2 id="pricing" className="font-display text-xl sm:text-2xl font-bold">{t('landing.pricing.title')}</h2>
            <p className="mt-3 text-gray-300 leading-relaxed">{monthly ? t('landing.pricing.body', { price: monthly }) : t('landing.pricing.bodyNoPrice')}</p>
            <Link to="/pricing" className="mt-5 inline-block text-sm font-mono text-purple-300 hover:text-white underline underline-offset-4">{t('landing.cta.pricing')}</Link>
          </section>

          <section aria-labelledby="faq" className="max-w-3xl mx-auto px-4 py-10">
            <h2 id="faq" className="font-display text-xl sm:text-2xl font-bold text-center">{t('landing.faq.title')}</h2>
            <div className="mt-6 space-y-3">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group rounded-xl border border-purple-500/20 bg-[#0d1117]/80 p-4">
                  <summary className="cursor-pointer font-display text-white list-none flex justify-between gap-4">
                    {t(q)}<span aria-hidden className="text-purple-300 group-open:rotate-45 transition-transform">+</span>
                  </summary>
                  <p className="mt-3 text-sm text-gray-300 leading-relaxed">{t(a)}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="max-w-3xl mx-auto px-4 pb-16 text-center">
            <h2 className="font-display text-xl sm:text-2xl font-bold">{t(`landing.h1.${variant}` as MessageKey)}</h2>
            {cta}
          </section>
        </main>

        <footer className="max-w-5xl mx-auto px-4 pb-10 text-center">
          <LegalLinks />
          <p className="mt-3 text-[11px] font-mono text-gray-400">{t('auth.footer')}</p>
        </footer>
      </div>
    </div>
  );
}
