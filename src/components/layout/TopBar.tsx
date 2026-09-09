import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useRef, useState } from 'react';
import { useSoundStore } from '../../store/soundStore';
import { useThemeStore } from '../../store/themeStore';
import { sfx } from '../../utils/sounds';
import { SOUND_PACK_LIST } from '../../data/soundPacks';
import NotificationBell from '../NotificationBell';
import { useNavigate } from 'react-router-dom';

interface TopBarProps {
  onMenuToggle?: () => void;
}

function Switch({ on }: { on: boolean }) {
  return (
    <span
      className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${on ? 'bg-purple-500' : 'bg-gray-700'}`}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${on ? 'left-[18px]' : 'left-0.5'}`}
      />
    </span>
  );
}

export default function TopBar({ onMenuToggle }: TopBarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentTheme = useThemeStore(s => s.theme);
  const muted = useSoundStore(s => s.muted);
  const toggleMuted = useSoundStore(s => s.toggleMuted);
  const celebrateSound = useSoundStore(s => s.celebrateSound);
  const toggleCelebrateSound = useSoundStore(s => s.toggleCelebrateSound);
  const themeMusic = useSoundStore(s => s.themeMusic);
  const toggleThemeMusic = useSoundStore(s => s.toggleThemeMusic);
  const soundPack = useSoundStore(s => s.soundPack);
  const setSoundPack = useSoundStore(s => s.setSoundPack);
  const [soundMenuOpen, setSoundMenuOpen] = useState(false);
  const [soundPosition, setSoundPosition] = useState({ top: 0, right: 8 });
  const soundBtnRef = useRef<HTMLButtonElement>(null);
  const pageTitle = location.pathname.replace('/', '') || 'Dashboard';

  const toggleSoundMenu = () => {
    const soundRect = soundBtnRef.current?.getBoundingClientRect();
    if (soundRect) {
      setSoundPosition({
        top: soundRect.bottom + 8,
        right: Math.max(8, window.innerWidth - soundRect.right),
      });
    }
    setSoundMenuOpen(value => !value);
  };

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="relative z-30 bg-[#0d1117]/95 backdrop-blur-xl border-b border-border-color px-4 sm:px-6 py-3 sm:py-4"
    >
      <div className="flex items-center justify-between gap-3">
        {/* Mobile Menu Button */}
        <button
          onClick={onMenuToggle}
          className="md:hidden p-2 -ml-2 text-gray-400 hover:text-white transition-colors"
          aria-label="Open menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Breadcrumb (desktop) / Page title (mobile) */}
        <nav className="flex items-center min-w-0 flex-1">              <span className="hidden md:inline text-gray-500">Home</span>
          <span className="hidden md:inline text-gray-600 mx-2">/</span>
          <span className="text-accent-text font-mono uppercase tracking-wider text-sm truncate">
            {pageTitle}
          </span>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center space-x-2.5 sm:space-x-4 flex-shrink-0">
          {/* Sound Settings */}
          <div className="relative flex-shrink-0">
            <motion.button
              ref={soundBtnRef}
              onClick={() => {
                sfx.click();
                toggleSoundMenu();
              }}
              whileTap={{ scale: 0.8 }}
              className="relative p-2 text-gray-400 hover:text-white transition-colors"
              title="Sound settings"
              aria-label="Sound settings"
            >
              <motion.span
                key={muted ? 'muted' : 'on'}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                className="block text-lg leading-none"
              >
                {muted ? '🔇' : '🔊'}
              </motion.span>
              {!muted && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--accent)' }} />
              )}
            </motion.button>

            {/* Popover (portaled to <body> so the header's backdrop-blur can't trap it) */}
            {soundMenuOpen &&
              createPortal(
                <>
                  <div
                    className="fixed inset-0 z-[60]"
                    onClick={() => setSoundMenuOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.15 }}
                    className="fixed z-[61] w-64 bg-[#0d1117]/95 backdrop-blur-xl border border-accent-border rounded-xl p-3 shadow-2xl shadow-accent/10"
                    style={{ top: soundPosition.top, right: soundPosition.right }}
                  >
                    <p className="text-[10px] text-gray-500 font-mono tracking-widest mb-2">SOUND SETTINGS</p>

                    {/* Master sound */}
                    <button
                      onClick={() => {
                        sfx.click();
                        toggleMuted();
                      }}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      <span className="flex items-center space-x-2.5">
                        <span className="text-base">{muted ? '🔇' : '🔊'}</span>
                        <span className="text-sm font-mono text-gray-300">All sounds</span>
                      </span>
                      <Switch on={!muted} />
                    </button>

                    {/* Milestone chime */}
                    <button
                      onClick={() => {
                        sfx.click();
                        toggleCelebrateSound();
                        if (!celebrateSound) sfx.levelUp(); // preview the chime when enabling
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${
                        muted ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/5'
                      }`}
                      disabled={muted}
                    >
                      <span className="flex items-center space-x-2.5">
                        <span className="text-base">🎺</span>
                        <span className="text-left">
                          <span className="text-sm font-mono text-gray-300 block">Milestone chime</span>
                          <span className="text-[10px] font-mono text-gray-500 block">Level-up / rank-up fanfare</span>
                        </span>
                      </span>
                      <Switch on={celebrateSound} />
                    </button>

                    {/* Theme music */}
                    <button
                      onClick={() => {
                        sfx.click();
                        toggleThemeMusic();
                        if (themeMusic) {
                          sfx.stopTheme();
                        } else {
                          sfx.startTheme();
                        }
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${
                        muted ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/5'
                      }`}
                      disabled={muted}
                    >
                      <span className="flex items-center space-x-2.5">
                        <span className="text-base">🎵</span>
                        <span className="text-left">
                          <span className="text-sm font-mono text-gray-300 block">Theme music</span>
                          <span className="text-[10px] font-mono text-gray-500 block">Background soundtrack</span>
                        </span>
                      </span>
                      <Switch on={themeMusic} />
                    </button>

                    {/* Sound pack selector */}
                    <div className={`px-3 py-2.5 rounded-lg ${muted ? 'opacity-40' : ''}`}>
                      <div className="flex items-center space-x-2.5 mb-2">
                        <span className="text-base">🎶</span>
                        <span className="text-sm font-mono text-gray-300">Sound Pack</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {SOUND_PACK_LIST.map(pack => (
                          <button
                            key={pack.id}
                            onClick={() => {
                              setSoundPack(pack.id);
                              sfx.click();
                              // Restart theme if it was playing to apply new pack
                              if (themeMusic && !muted) {
                                sfx.stopTheme();
                                setTimeout(() => sfx.startTheme(), 100);
                              }
                            }}
                            disabled={muted}
                            className={`
                              px-2.5 py-2 rounded-lg text-left transition-all border
                              ${soundPack === pack.id
                                ? 'bg-accent-bg border-accent-border text-white'
                                : 'bg-gray-800/30 border-gray-700/20 text-gray-400 hover:bg-gray-800/50'
                              }
                            `}
                          >
                            <span className="text-sm block">{pack.icon}</span>
                            <span className="text-[10px] font-mono block mt-0.5">{pack.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                </>,
                document.body
              )}
          </div>

          {/* System Status */}
          <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 bg-green-500/10 rounded-full border border-green-500/20">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-green-400 font-mono">SYSTEM ONLINE</span>
          </div>

          {/* Mobile-only status dot */}
          <div className="sm:hidden flex items-center justify-center w-8 h-8 rounded-full bg-green-500/10 border border-green-500/20" title="System online">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          </div>

          {/* Notifications */}
          <NotificationBell />

          {/* Settings Button - shows current theme icon */}
          <button
            onClick={() => {
              sfx.click();
              navigate('/settings');
            }}
            className="relative p-2 text-gray-400 hover:text-white transition-colors"
            title="Settings"
            aria-label="Settings"
          >
            <motion.span
              key={currentTheme}
              initial={{ scale: 0.4, opacity: 0, rotate: -20 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
              className="block text-lg leading-none"
            >
              {currentTheme === 'purple-monarch' ? '👑' : currentTheme === 'gold' ? '🏆' : '❤️‍🔥'}
            </motion.span>
          </button>
        </div>
      </div>
    </motion.header>
  );
}