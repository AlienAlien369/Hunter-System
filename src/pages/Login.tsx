import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import { sfx } from '../utils/sounds';
import BackgroundFX from '../components/BackgroundFX';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, user } = useAuthStore();
  // Return to the page that required login (deep links, refreshes); only same-app paths.
  const from = (location.state as { from?: string } | null)?.from;
  const target = from && from.startsWith('/') && !from.startsWith('//') ? from : '/';
  // Invite links (/login?invite=<Hunter name>) — remembered in case the visitor wanders off first.
  const [invite] = useState(() => {
    const fromUrl = new URLSearchParams(location.search).get('invite')?.trim().slice(0, 30) || '';
    try {
      if (fromUrl) localStorage.setItem('hunter.invite', fromUrl);
      return fromUrl || localStorage.getItem('hunter.invite') || '';
    } catch { return fromUrl; }
  });
  // Newcomers land on "create account"; browsers that have signed in before land on login.
  const [mode, setMode] = useState<'login' | 'register' | 'recover'>(() => {
    if (new URLSearchParams(location.search).get('invite')) return 'register';
    try { return localStorage.getItem('hunter.hasAccount') ? 'login' : 'register'; } catch { return 'login'; }
  });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If already logged in, go where the hunter was headed
  if (user) {
    return <Navigate to={target} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'recover') {
        const response = await api.recover(username, code, password);
        login(response.user);
        sfx.login();
        navigate('/settings', { replace: true }); // straight to Account to make a fresh code
      } else if (mode === 'login') {
        const response = await api.login(username, password);
        try { localStorage.setItem('hunter.hasAccount', '1'); } catch { /* storage unavailable */ }
        login(response.user);
        sfx.login();
        navigate(target, { replace: true });
      } else {
        const response = await api.register(username, password, invite || undefined);
        try { localStorage.setItem('hunter.hasAccount', '1'); localStorage.removeItem('hunter.invite'); } catch { /* storage unavailable */ }
        login(response.user);
        sfx.login();
        navigate(target, { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 py-10" style={{ background: 'var(--bg-base)' }}>
      {/* Animated system background */}
      <BackgroundFX />

      {/* Mobile order: headline → form → features. Desktop: pitch left, form right. */}
      <div className="relative w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 lg:grid-rows-[auto_1fr] gap-x-10 gap-y-6 items-center">
      {/* Pitch: what Hunter is, for visitors arriving from a shared card or link */}
      <motion.section initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="text-center lg:text-left lg:col-start-1 lg:row-start-1 lg:self-end">
        <p className="text-purple-300 font-mono text-xs tracking-[0.3em]">THE SYSTEM HAS CHOSEN YOU</p>
        <h2 className="font-display text-3xl sm:text-5xl font-bold text-white tracking-wider mt-3 leading-tight">
          Level up your <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">real life</span>
        </h2>
        <p className="text-gray-400 font-mono text-sm mt-4 max-w-md mx-auto lg:mx-0">
          Hunter turns your day into quests. Earn XP for the habits you keep, rank up from E to S, and see who's grinding hardest this week.
        </p>
      </motion.section>

      <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="lg:col-start-1 lg:row-start-2 lg:self-start">
        <ul className="space-y-3 text-left max-w-md mx-auto lg:mx-0">
          {[
            ['🗓️', 'Your timetable becomes your quest log', 'Describe your day — Hunter builds the schedule, every slot earns XP.'],
            ['🧩', 'Modules for everything you care about', 'Fitness, skincare, reading, content creation — or build your own with AI.'],
            ['⚡', 'Real consequences, real progress', 'Streaks, penalties for skipped days, and a 2-day rule that keeps you honest.'],
            ['🏆', 'Ranks, leaderboard & shareable cards', 'Climb the weekly board and flex your Hunter card with friends.'],
          ].map(([icon, title, body]) => (
            <li key={title} className="flex gap-3">
              <span className="text-xl">{icon}</span>
              <span>
                <span className="block text-white font-mono text-sm">{title}</span>
                <span className="block text-gray-400 font-mono text-xs">{body}</span>
              </span>
            </li>
          ))}
        </ul>
      </motion.section>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-md mx-auto lg:col-start-2 lg:row-start-1 lg:row-span-2 row-start-2"
      >
        {/* Card */}
        <div className="backdrop-blur-xl rounded-2xl p-8 shadow-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--accent-border)', boxShadow: '0 25px 50px -12px var(--aurora-1)' }}>
          {/* Header */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ y: -20 }}
              animate={{ y: 0 }}
              className="text-6xl mb-4"
            >
              ⚔️
            </motion.div>
            <h1 className="font-display text-3xl font-bold text-white tracking-widest">
              HUNTER SYSTEM
            </h1>
            <p className="text-purple-400 font-mono text-sm mt-2">
              {mode === 'login' ? 'ENTER THE DUNGEON' : mode === 'recover' ? 'RECOVER YOUR ACCOUNT' : 'JOIN THE HUNTERS'}
            </p>
            {invite && mode === 'register' && (
              <p className="mt-3 text-xs font-mono text-gold border border-yellow-500/30 bg-yellow-500/10 rounded-lg px-3 py-2">
                ⚔️ {invite} invited you — you'll race each other on weekly XP.
              </p>
            )}
          </div>

          {/* Mode Toggle */}
          <div className="flex bg-[#0d1117] rounded-lg p-1 mb-6">
            <button
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 py-2 rounded-md font-mono text-sm transition-all ${
                mode === 'login'
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              LOGIN
            </button>
            <button
              onClick={() => { setMode('register'); setError(''); }}
              className={`flex-1 py-2 rounded-md font-mono text-sm transition-all ${
                mode === 'register'
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              REGISTER
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-400 font-mono text-xs uppercase tracking-wider mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[#0d1117] border border-purple-500/20 rounded-lg px-4 py-3 text-white font-mono focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all"
                placeholder="Enter your username"
                required
                minLength={3}
              />
            </div>

            {mode === 'recover' && (
              <div>
                <label className="block text-gray-400 font-mono text-xs uppercase tracking-wider mb-2">
                  Recovery code
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full bg-[#0d1117] border border-purple-500/20 rounded-lg px-4 py-3 text-white font-mono tracking-widest uppercase focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all"
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  autoComplete="off"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-gray-400 font-mono text-xs uppercase tracking-wider mb-2">
                {mode === 'recover' ? 'New password' : 'Password'}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0d1117] border border-purple-500/20 rounded-lg px-4 py-3 text-white font-mono focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all"
                placeholder="Enter your password"
                required
                minLength={6}
              />
            </div>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm font-mono"
              >
                {error}
              </motion.div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-display font-bold py-3 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/25"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  PROCESSING...
                </span>
              ) : (
                mode === 'login' ? 'ENTER SYSTEM' : mode === 'recover' ? 'RESET PASSWORD' : 'CREATE ACCOUNT'
              )}
            </button>
          </form>

          {mode !== 'register' && (
            <button
              type="button"
              onClick={() => { setMode(mode === 'login' ? 'recover' : 'login'); setError(''); }}
              className="block mx-auto mt-4 text-xs font-mono text-gray-400 hover:text-purple-300"
            >
              {mode === 'login' ? 'Forgot password? Use your recovery code' : '← Back to login'}
            </button>
          )}

        </div>

        {/* Footer */}
        <p className="text-center text-gray-400 font-mono text-xs mt-6">
          Hunter System · free to play
        </p>
      </motion.div>
      </div>
    </main>
  );
}
