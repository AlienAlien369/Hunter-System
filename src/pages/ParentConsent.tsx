import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import BackgroundFX from '../components/BackgroundFX';
import LegalLinks from '../components/LegalLinks';

type View = 'loading' | 'ready' | 'granted' | 'deleted' | 'invalid';

/** The page a parent or guardian lands on from the consent email (/parent-consent?token=…). No account needed. */
export default function ParentConsent() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
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
        <h1 className="font-display text-xl sm:text-2xl text-white tracking-wider">Parental consent</h1>
        {view === 'loading' && <p className="text-sm font-mono text-gray-400">Loading…</p>}
        {view === 'invalid' && (
          <p className="text-sm font-mono text-gray-300" role="alert">This link is not valid, has expired, or has already been used. If your child still wants to join, they can sign in and send a fresh request.</p>
        )}
        {view === 'ready' && (
          <>
            <p className="text-sm text-gray-300 leading-relaxed">
              Someone using the name <strong className="text-white">{username}</strong> says they are your child and asked to use <strong className="text-white">Hunter System</strong>, a productivity app that turns a daily timetable into quests, XP and ranks. They are under 18, so we need your decision.
            </p>
            <div className="text-sm text-gray-300 leading-relaxed">
              <p className="text-white font-display tracking-wider text-sm mb-1">What we collect about them</p>
              <ul className="list-disc pl-5 space-y-1 marker:text-purple-400">
                <li>Username, Hunter name, birth month (not the day), and this email address.</li>
                <li>What they create in the app: timetable, tasks, completions and XP.</li>
                <li>Text they type into AI features is sent to our AI providers to produce a suggestion.</li>
              </ul>
              <p className="text-white font-display tracking-wider text-sm mt-3 mb-1">What we do not do</p>
              <ul className="list-disc pl-5 space-y-1 marker:text-purple-400">
                <li>No advertising, no selling of data, no ad tracking.</li>
                <li>Their public profile and leaderboard entry show only a chosen nickname, level, rank and streak, and can be turned off.</li>
              </ul>
              <p className="mt-3">You can change your mind later with this same link: withdrawing consent deletes the account and its data.</p>
            </div>
            {granted && <p className="text-xs font-mono text-green-400">You have already approved this account.</p>}
            {error && <p role="alert" className="text-sm font-mono text-red-400">{error}</p>}
            <div className="flex flex-col sm:flex-row gap-3">
              {!granted && (
                <button disabled={busy} onClick={() => decide('grant')} className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-display font-bold py-3 rounded-lg disabled:opacity-50">I APPROVE</button>
              )}
              <button
                disabled={busy}
                onClick={() => { if (window.confirm('This permanently deletes the account and everything in it. Continue?')) decide('decline'); }}
                className="flex-1 border border-red-500/40 text-red-300 hover:bg-red-500/10 font-display font-bold py-3 rounded-lg disabled:opacity-50"
              >
                {granted ? 'WITHDRAW CONSENT & DELETE' : 'DECLINE & DELETE'}
              </button>
            </div>
          </>
        )}
        {view === 'granted' && <p className="text-sm font-mono text-green-400" role="status">Thank you — your child can now use Hunter System. You can return to this link any time to withdraw consent.</p>}
        {view === 'deleted' && <p className="text-sm font-mono text-gray-300" role="status">Done. The account and all of its data have been deleted.</p>}
        <div className="flex items-center justify-between pt-2">
          <LegalLinks />
          <Link to="/login" className="text-[11px] font-mono text-gray-400 hover:text-white">Hunter System</Link>
        </div>
      </div>
    </main>
  );
}
