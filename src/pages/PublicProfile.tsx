import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type PublicHunter } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import BackgroundFX from '../components/BackgroundFX';

const RANK_COLORS: Record<string, string> = { E: '#8A92B2', D: '#3498DB', C: '#8B5CF6', B: '#A855F7', A: '#F1C40F', S: '#F59E0B' };

/** Public hunter profile (/h/:name) — where shared cards and links land. */
export default function PublicProfile() {
  const { name = '' } = useParams();
  const user = useAuthStore(s => s.user);
  const [hunter, setHunter] = useState<PublicHunter | null>(null);
  const [error, setError] = useState('');
  const [followMsg, setFollowMsg] = useState('');

  useEffect(() => {
    api.getPublicHunter(name).then(setHunter).catch(e => setError((e as Error).message));
  }, [name]);
  useEffect(() => {
    if (hunter) document.title = `${hunter.name} · ${hunter.rank}-Rank Hunter`;
  }, [hunter]);

  const isMe = !!user?.name_set && user.name.toLowerCase() === name.toLowerCase();
  const follow = () => api.addFriend(name).then(r => setFollowMsg(`Now following ${r.name} — see Rank → Friends.`)).catch(e => setFollowMsg((e as Error).message));
  const tiles = hunter && [
    ['LEVEL', String(hunter.level)],
    ['STREAK', `${hunter.streak} day${hunter.streak === 1 ? '' : 's'}`],
    ['THIS WEEK', `+${hunter.weeklyXp.toLocaleString()} XP`],
    ['TOTAL XP', hunter.xp.toLocaleString()],
  ];

  return (
    <main className="min-h-screen flex items-center justify-center p-4 py-10" style={{ background: 'var(--bg-base)' }}>
      <BackgroundFX />
      <div className="relative w-full max-w-md bg-[#161b22]/90 backdrop-blur rounded-2xl border border-purple-500/30 p-6 text-center">
        {error ? (
          <>
            <p className="text-4xl mb-3">🕳️</p>
            <p className="font-mono text-gray-300">{error}</p>
            <Link to="/login" className="inline-block mt-6 font-mono text-sm text-purple-300 underline">Start your own journey →</Link>
          </>
        ) : !hunter ? (
          <p className="font-mono text-gray-400 py-16">Scanning hunter…</p>
        ) : (
          <>
            <p className="text-purple-300 font-mono text-[10px] tracking-[0.3em]">HUNTER PROFILE</p>
            <div
              className="mx-auto mt-4 w-24 h-24 rounded-full flex items-center justify-center font-display text-5xl font-bold border-4"
              style={{ color: RANK_COLORS[hunter.rank], borderColor: RANK_COLORS[hunter.rank] }}
            >
              {hunter.rank}
            </div>
            <h1 className="font-display text-3xl font-bold text-white tracking-widest mt-4 break-words">{hunter.name}</h1>
            <p className="font-mono text-sm text-gray-400">{hunter.rank}-Rank Hunter · Level {hunter.level}</p>
            <div className="grid grid-cols-2 gap-2 mt-6">
              {tiles!.map(([label, value]) => (
                <div key={label} className="rounded-lg border border-purple-500/15 bg-[#0d1117] py-3">
                  <p className="text-[10px] font-mono text-gray-400 tracking-widest">{label}</p>
                  <p className="font-display text-lg text-gold">{value}</p>
                </div>
              ))}
            </div>
            {hunter.modules.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1.5 mt-4">
                {hunter.modules.map(m => <span key={m} className="text-xs font-mono px-2 py-1 rounded-full bg-purple-500/10 text-purple-200">{m}</span>)}
              </div>
            )}
            <div className="mt-6">
              {isMe ? (
                <Link to="/" className="font-mono text-sm text-purple-300 underline">This is you — back to your dashboard</Link>
              ) : user ? (
                <>
                  <button type="button" onClick={follow} className="w-full py-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-display tracking-widest">
                    FOLLOW {hunter.name.toUpperCase()}
                  </button>
                  {followMsg && <p className="mt-2 text-xs font-mono text-green-400">{followMsg}</p>}
                </>
              ) : (
                <>
                  <Link to={`/login?invite=${encodeURIComponent(hunter.name)}`} className="block w-full py-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-display tracking-widest">
                    RACE {hunter.name.toUpperCase()}
                  </Link>
                  <p className="mt-3 text-xs font-mono text-gray-400">Turn your real-life habits into quests, XP and ranks. Free.</p>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
