import { useEffect, useState } from 'react';
import { api, type ReferralStatus } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { trackEvent } from '../lib/track';
import { appName, useT } from '../i18n';

/** Settings → invite friends, see progress toward free Pro months. Pro time only: never XP or rank. */
export default function ReferralCard() {
  const t = useT();
  const me = useAuthStore(s => s.user);
  const [s, setS] = useState<ReferralStatus | null>(null);
  const [note, setNote] = useState('');
  useEffect(() => { api.getReferrals().then(setS).catch(() => {}); }, []);

  const invite = async () => {
    trackEvent('invite_click', { page: '/settings' });
    const url = `${window.location.origin}/login?invite=${encodeURIComponent(me?.name ?? '')}`;
    const text = t('referral.shareText');
    try {
      if (navigator.share) await navigator.share({ title: appName(), text, url });
      else { await navigator.clipboard.writeText(`${text} ${url}`); setNote(t('referral.copied')); }
    } catch { /* share sheet dismissed */ }
  };

  return (
    <section aria-labelledby="ref-title" className="bg-[#0d1117]/80 backdrop-blur-xl rounded-xl border border-accent-border p-5 space-y-3">
      <h2 id="ref-title" className="font-display text-white font-bold tracking-widest text-sm">{t('referral.title')}</h2>
      <p className="text-sm font-mono text-gray-300">{t('referral.body', { count: s?.invitesPerReward ?? 3 })}</p>
      {s && (
        <div className="text-xs font-mono text-gray-400 space-y-1">
          <p>{t('referral.progress', { qualified: s.qualified, pending: s.pending })}</p>
          <p>{s.capped ? t('referral.capped') : t('referral.next', { n: s.nextRewardIn ?? 0 })}</p>
          <p>{t('referral.earned', { months: s.monthsEarned, max: s.maxMonths })}</p>
        </div>
      )}
      {me?.name_set ? (
        <button onClick={invite} className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-display text-sm tracking-wider">{t('referral.copy')}</button>
      ) : (
        <p className="text-xs font-mono text-gray-400">{t('referral.needName')}</p>
      )}
      {note && <p role="status" className="text-xs font-mono text-green-400">{note}</p>}
    </section>
  );
}
