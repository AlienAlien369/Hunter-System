import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api';

interface HunterNameEntryProps {
  onComplete: (name: string) => void;
}

export default function HunterNameEntry({ onComplete }: HunterNameEntryProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter your hunter name');
      return;
    }

    if (name.trim().length < 2) {
      setError('Name must be at least 2 characters');
      return;
    }

    if (name.trim().length > 30) {
      setError('Name must be 30 characters or less');
      return;
    }

    if (!confirmed) {
      setError('You must confirm that your name cannot be changed');
      return;
    }

    setLoading(true);
    try {
      const response = await api.setHunterName(name.trim());
      onComplete(response.name);
    } catch (err: any) {
      setError(err.message || 'Failed to set hunter name');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl animate-pulse" style={{ background: 'var(--aurora-1)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full blur-3xl animate-pulse" style={{ background: 'var(--aurora-2)', animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-2xl animate-pulse" style={{ background: 'var(--aurora-3)', animationDelay: '0.5s' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        {/* Card */}
        <div className="backdrop-blur-xl rounded-2xl p-8 shadow-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--accent-border)' }}>
          {/* Header */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-4xl shadow-lg shadow-purple-500/30"
            >
              ⚔️
            </motion.div>
            <h1 className="text-2xl font-display text-white font-bold tracking-wider mb-2">
              HUNTER REGISTRATION
            </h1>
            <p className="text-sm text-gray-400 font-mono">
              Choose your hunter name wisely
            </p>
          </div>

          {/* Warning Banner */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6"
          >
            <div className="flex items-start space-x-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="text-red-400 font-display font-bold text-sm tracking-wider">
                  WARNING: PERMANENT NAME
                </p>
                <p className="text-red-300/80 text-xs mt-1 font-mono">
                  Your hunter name will be permanently set and CANNOT be changed later. Choose a name you'll be proud of — it will be used throughout the entire system.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Name Input */}
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="block text-xs text-gray-500 font-mono tracking-wider mb-2">
                HUNTER NAME
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError('');
                }}
                placeholder="Enter your hunter name..."
                maxLength={30}
                className="w-full px-4 py-3 bg-[#161b22] border border-gray-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all placeholder-gray-600"
                autoFocus
              />
              <div className="flex justify-between mt-1">
                <span className="text-xs text-gray-600 font-mono">
                  {name.length}/30 characters
                </span>
              </div>
            </div>

            {/* Confirmation Checkbox */}
            <div className="mb-6">
              <label className="flex items-start space-x-3 cursor-pointer group">
                <div className="relative mt-0.5">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => {
                      setConfirmed(e.target.checked);
                      setError('');
                    }}
                    className="sr-only"
                  />
                  <div className={`w-5 h-5 rounded border-2 transition-all flex items-center justify-center ${
                    confirmed
                      ? 'bg-purple-500 border-purple-500'
                      : 'bg-transparent border-gray-600 group-hover:border-gray-500'
                  }`}>
                    {confirmed && (
                      <motion.svg
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-3 h-3 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </motion.svg>
                    )}
                  </div>
                </div>
                <span className="text-xs text-gray-400 font-mono leading-relaxed">
                  I understand that my hunter name is <span className="text-red-400 font-bold">permanent</span> and will be used across the entire system. It <span className="text-red-400 font-bold">cannot</span> be changed after this.
                </span>
              </label>
            </div>

            {/* Error Message */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg"
                >
                  <p className="text-red-400 text-xs font-mono">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit Button */}
            <motion.button
              type="submit"
              disabled={loading || !name.trim() || !confirmed}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-display font-bold tracking-wider rounded-xl shadow-lg shadow-purple-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {loading ? (
                <span className="flex items-center justify-center space-x-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>SETTING NAME...</span>
                </span>
              ) : (
                'ENTER THE SYSTEM'
              )}
            </motion.button>
          </form>

          {/* Footer */}
          <p className="text-center text-[10px] text-gray-600 font-mono mt-6">
            This name will be your identity in the Hunter System
          </p>
        </div>
      </motion.div>
    </div>
  );
}
