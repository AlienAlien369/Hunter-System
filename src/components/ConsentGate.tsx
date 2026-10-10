import { useState } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { classifyBirthMonth, looksLikeEmail } from '../utils/age';
import LegalLinks from './LegalLinks';
import LanguagePicker from './LanguagePicker';
import { useT } from '../i18n';
import BackgroundFX from './BackgroundFX';

const field = 'w-full bg-[#0d1117] border border-purple-500/20 rounded-lg px-4 py-3 text-white font-mono focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50';
const button = 'w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-display font-bold py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed';

/**
 * Shown instead of the app when the hunter cannot use it yet:
 *  - needs_age: an account from before the age gate — ask once
 *  - pending:   under 18, waiting for a parent or guardian to approve
 * The server enforces this too (403 consent_required); this is the friendly side.
 */
export default function ConsentGate() {
  const t = useT();
  const user = useAuthStore(s => s.user)!;
  const { checkAuth, logout } = useAuthStore();
  const [birthMonth, setBirthMonth] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const cls = classifyBirthMonth(birthMonth);
  const needsParent = cls === 'minor';

  const submitAge = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.submitAge(birthMonth, needsParent ? parentEmail.trim() : undefined);
      await checkAuth();
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      if (cls === 'blocked') await logout().catch(() => {}); // the server deleted the account
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setBusy(true);
    setError('');
    setNote('');
    try {
      const r = await api.resendParentEmail(parentEmail.trim() || undefined);
      setNote(r.parentMailSent ? t('consent.pending.sent', { email: r.parentEmailMasked }) : t('consent.pending.failed'));
      setParentEmail('');
      await checkAuth();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-base)' }}>
      <BackgroundFX />
      <div className="relative w-full max-w-md rounded-2xl p-8 backdrop-blur-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--accent-border)' }}>
        {user.consentStatus === 'pending' ? (
          <div className="space-y-4">
            <p className="text-4xl text-center" aria-hidden>👪</p>
            <h1 className="font-display text-xl text-white text-center tracking-wider">{t('consent.pending.title')}</h1>
            <p className="text-sm text-gray-300 font-mono leading-relaxed">
              {user.parentEmailMasked ? t('consent.pending.body', { email: user.parentEmailMasked }) : t('consent.pending.bodyNoEmail')}
            </p>
            <p className="text-xs text-gray-500 font-mono">{t('consent.pending.expiry')}</p>
            <label className="block text-xs font-mono uppercase tracking-wider text-gray-400" htmlFor="pe">{t('consent.pending.emailLabel')}</label>
            <input id="pe" type="email" className={field} value={parentEmail} onChange={e => setParentEmail(e.target.value)} autoComplete="off" />
            <button className={button} disabled={busy || (!!parentEmail && !looksLikeEmail(parentEmail))} onClick={resend}>{busy ? t('consent.pending.sending') : t('consent.pending.send')}</button>
          </div>
        ) : (
          <form onSubmit={submitAge} className="space-y-4">
            <p className="text-4xl text-center" aria-hidden>🎂</p>
            <h1 className="font-display text-xl text-white text-center tracking-wider">{t('consent.age.title')}</h1>
            <p className="text-sm text-gray-300 font-mono leading-relaxed">{t('consent.age.body')}</p>
            <label className="block text-xs font-mono uppercase tracking-wider text-gray-400" htmlFor="bm">{t('auth.birthMonth')}</label>
            <input id="bm" type="month" className={field} value={birthMonth} onChange={e => setBirthMonth(e.target.value)} max={new Date().toISOString().slice(0, 7)} required />
            {cls === 'blocked' && <p className="text-xs font-mono text-red-300" role="alert">{t('consent.age.blocked')}</p>}
            {needsParent && (
              <>
                <p className="text-xs font-mono text-yellow-300">{t('consent.age.minor')}</p>
                <input type="email" aria-label={t('auth.parentEmail')} className={field} value={parentEmail} onChange={e => setParentEmail(e.target.value)} placeholder="parent@example.com" required />
              </>
            )}
            <button className={button} disabled={busy || cls === null || (needsParent && !looksLikeEmail(parentEmail))}>{busy ? t('consent.age.wait') : cls === 'blocked' ? t('consent.age.delete') : t('consent.age.continue')}</button>
          </form>
        )}
        {error && <p role="alert" className="mt-4 text-sm font-mono text-red-400 border border-red-500/30 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
        {note && <p role="status" className="mt-4 text-sm font-mono text-green-400">{note}</p>}
        <div className="mt-6 flex items-center justify-between">
          <LegalLinks />
          <LanguagePicker />
          <button onClick={() => logout()} className="text-[11px] font-mono text-gray-400 hover:text-white">{t('common.logout')}</button>
        </div>
      </div>
    </main>
  );
}
