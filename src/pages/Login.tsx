import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';

export default function Login() {
  const navigate = useNavigate();
  const { login, user } = useAuthStore();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect to dashboard
  if (user) {
    navigate('/');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const response = await api.login(username, password);
        login(response.user);
        navigate('/');
      } else {
        const response = await api.register(username, password);
        login(response.user);
        navigate('/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center p-4">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/30 via-transparent to-transparent" />
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'linear-gradient(rgba(139, 92, 246, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(139, 92, 246, 0.3) 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }} />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-md"
      >
        {/* Card */}
        <div className="bg-[#161b22]/90 backdrop-blur-xl rounded-2xl border border-purple-500/30 p-8 shadow-2xl shadow-purple-500/20">
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
              {mode === 'login' ? 'ENTER THE DUNGEON' : 'JOIN THE HUNTERS'}
            </p>
          </div>

          {/* Mode Toggle */}
          <div className="flex bg-[#0d1117] rounded-lg p-1 mb-6">
            <button
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 py-2 rounded-md font-mono text-sm transition-all ${
                mode === 'login'
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              LOGIN
            </button>
            <button
              onClick={() => { setMode('register'); setError(''); }}
              className={`flex-1 py-2 rounded-md font-mono text-sm transition-all ${
                mode === 'register'
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'text-gray-500 hover:text-gray-300'
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

            <div>
              <label className="block text-gray-400 font-mono text-xs uppercase tracking-wider mb-2">
                Password
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
                mode === 'login' ? 'ENTER SYSTEM' : 'CREATE ACCOUNT'
              )}
            </button>
          </form>

          {/* Demo Credentials */}
          {mode === 'login' && (
            <div className="mt-6 pt-6 border-t border-purple-500/10">
              <p className="text-gray-500 font-mono text-xs text-center mb-3">DEMO CREDENTIALS</p>
              <div className="bg-[#0d1117] rounded-lg p-3 text-center">
                <p className="text-purple-400 font-mono text-sm">Username: <span className="text-white">alien</span></p>
                <p className="text-purple-400 font-mono text-sm mt-1">Password: <span className="text-white">Alien@123</span></p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-gray-600 font-mono text-xs mt-6">
          Solo Leveling Hunter System v1.0
        </p>
      </motion.div>
    </div>
  );
}
