import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import BackgroundFX from '../components/BackgroundFX';
import LegalLinks from '../components/LegalLinks';
import LanguagePicker from '../components/LanguagePicker';
import { useT } from '../i18n';

type View = 'loading' | 'ready' | 'granted' | 'deleted' | 'invalid';

/** The page a parent or guardian lands on from the consent email (/parent-consent#token=…). No account needed. */
export default function ParentConsent() {
  const t = useT();
  // The link is /parent-consent#token=…: the fragment never reaches any server or log.
  const token = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token') ?? '';
  const [view, setView] = useState<View>(token ? 'loading' : 'invalid');
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = 'Parental consent · Hunter System';
    if (!token) return;
    api.getParentConsent(token)
      .then(r => { setUsername(r.username); setStatus(r.status); setView('ready'); })
      .catch(() => setView('invalid'));
  }, [token]);

  const decide = async (decision: 'grant' | 'decline') => {
    setBusy(true);
    setError('');
    try {
      const r = await api.decideParentConsent(token, decision);
      setView(r.status === 'granted' ? 'granted' : 'deleted');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const granted = status === 'granted';
  return (
    <main className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-base)' }}>
      <BackgroundFX />
      <div className="relative w-full max-w-xl rounded-2xl p-6 sm:p-8 backdrop-blur-xl space-y-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--accent-border)' }}>
        <h1 className="font-display text-xl sm:text-2xl text-white tracking-wider">{t('parent.title')}</h1>
        {view === 'loading' && <p className="text-sm font-mono text-gray-400">{t('common.loading')}</p>}
        {view === 'invalid' && (
          <p className="text-sm font-mono text-gray-300" role="alert">{t('parent.invalid')}</p>
        )}
        {view === 'ready' && (
          <>
            <p className="text-sm text-gray-300 leading-relaxed">
              {t('parent.intro.before')} <strong className="text-white">{username}</strong> {t('parent.intro.middle')}{' '}
              <strong className="text-white">Hunter System</strong>{t('parent.intro.after').startsWith(',') ? '' : ' '}{t('parent.intro.after')}
            </p>
            <div className="text-sm text-gray-300 leading-relaxed">
              <p className="text-white font-display tracking-wider text-sm mb-1">{t('parent.collect.title')}</p>
              <ul className="list-disc pl-5 space-y-1 marker:text-purple-400">
                <li>{t('parent.collect.1')}</li>
                <li>{t('parent.collect.2')}</li>
                <li>{t('parent.collect.3')}</li>
              </ul>
              <p className="text-white font-display tracking-wider text-sm mt-3 mb-1">{t('parent.never.title')}</p>
              <ul className="list-disc pl-5 space-y-1 marker:text-purple-400">
                <li>{t('parent.never.1')}</li>
                <li>{t('parent.never.2')}</li>
              </ul>
              <p className="mt-3">{t('parent.change')}</p>
            </div>
            {granted && <p className="text-xs font-mono text-green-400">{t('parent.alreadyApproved')}</p>}
            {error && <p role="alert" className="text-sm font-mono text-red-400">{error}</p>}
            <div className="flex flex-col sm:flex-row gap-3">
              {!granted && (
                <button disabled={busy} onClick={() => decide('grant')} className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-display font-bold py-3 rounded-lg disabled:opacity-50">{t('parent.approve')}</button>
              )}
              <button
                disabled={busy}
                onClick={() => { if (window.confirm(t('parent.confirmDelete'))) decide('decline'); }}
                className="flex-1 border border-red-500/40 text-red-300 hover:bg-red-500/10 font-display font-bold py-3 rounded-lg disabled:opacity-50"
              >
                {granted ? t('parent.withdraw') : t('parent.decline')}
              </button>
            </div>
          </>
        )}
        {view === 'granted' && <p className="text-sm font-mono text-green-400" role="status">{t('parent.granted')}</p>}
        {view === 'deleted' && <p className="text-sm font-mono text-gray-300" role="status">{t('parent.deleted')}</p>}
        <div className="flex items-center justify-between pt-2">
          <LegalLinks />
          <LanguagePicker />
          <Link to="/login" className="text-[11px] font-mono text-gray-400 hover:text-white">Hunter System</Link>
        </div>
      </div>
    </main>
  );
}
