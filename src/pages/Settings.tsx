import { motion } from 'framer-motion';
import { useThemeStore, THEMES, applyTheme } from '../store/themeStore';
import { useSoundStore } from '../store/soundStore';
import { sfx } from '../utils/sounds';

export default function Settings() {
  const currentTheme = useThemeStore(s => s.theme);
  const setTheme = useThemeStore(s => s.setTheme);
  const muted = useSoundStore(s => s.muted);
  const toggleMuted = useSoundStore(s => s.toggleMuted);
  const celebrateSound = useSoundStore(s => s.celebrateSound);
  const toggleCelebrateSound = useSoundStore(s => s.toggleCelebrateSound);
  const themeMusic = useSoundStore(s => s.themeMusic);
  const toggleThemeMusic = useSoundStore(s => s.toggleThemeMusic);
  const soundPack = useSoundStore(s => s.soundPack);
  const setSoundPack = useSoundStore(s => s.setSoundPack);

  const handleThemeChange = (themeId: string) => {
    sfx.click();
    setTheme(themeId);
    applyTheme(themeId, true);
  };

  const currentColors = THEMES[currentTheme as keyof typeof THEMES];

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-display text-white font-bold tracking-wider">
            SETTINGS
          </h1>
          <p className="text-sm text-gray-500 font-mono mt-1">
            Personalize your hunter system
          </p>
        </div>
        <div className="w-12 h-12 rounded-lg accent-gradient flex items-center justify-center text-xl shadow-lg shadow-accent/30">
          ⚙️
        </div>
      </motion.div>

      {/* Appearance Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-[#0d1117]/80 backdrop-blur-xl rounded-xl border border-accent-border p-5"
      >
        <div className="flex items-center space-x-3 mb-5">
          <div className="w-8 h-8 rounded-lg accent-gradient flex items-center justify-center text-sm">
            🎨
          </div>
          <div>
            <h2 className="text-white font-display font-bold tracking-wider">
              APPEARANCE
            </h2>
            <p className="text-xs text-gray-500 font-mono">
              Customize the look of your system
            </p>
          </div>
        </div>

        {/* Theme Selector */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400 font-mono">THEME</span>
            <span className="text-sm text-accent-text font-mono">
              {currentColors.name}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {Object.values(THEMES).map(theme => {
              const isSelected = theme.id === currentTheme;
              return (
                <button
                  key={theme.id}
                  onClick={() => handleThemeChange(theme.id)}
                  className={`
                    relative group flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left
                    ${isSelected
                      ? 'border-accent bg-accent-bg/30 shadow-[0_0_20px_var(--accent-glow)/20]'
                      : 'border-transparent bg-[#1a1f2e]/50 hover:bg-[#1a1f2e]/80 hover:border-gray-700'
                    }
                  `}
                >
                  {/* Theme preview */}
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-transform ${isSelected ? 'scale-110' : 'group-hover:scale-105'}`}
                    style={{
                      background: `linear-gradient(135deg, ${theme.gradientStart}, ${theme.gradientEnd})`,
                      boxShadow: isSelected ? `0 0 20px ${theme.accentGlow}` : 'none',
                    }}
                  >
                    {theme.icon}
                  </div>

                  {/* Theme info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-display font-bold ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                        {theme.name}
                      </span>
                      {isSelected && (
                        <motion.span
                          layoutId="activeBadge"
                          className="text-[10px] font-mono text-accent px-2 py-0.5 bg-accent-bg rounded-full"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                        >
                          ACTIVE
                        </motion.span>
                      )}
                    </div>
                    <div className="flex gap-1.5 mt-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: theme.accent }}
                      />
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: theme.accentLight }}
                      />
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: theme.gradientEnd }}
                      />
                    </div>
                  </div>

                  {/* Checkmark */}
                  {isSelected && (
                    <div className="text-accent text-lg">✓</div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Theme preview bar */}
          <div className="mt-4 p-3 rounded-lg" style={{ 
            background: `linear-gradient(135deg, ${currentColors.gradientStart}, ${currentColors.gradientEnd})`,
            opacity: 0.3
          }}>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-white/70">CURRENT ACCENT</span>
              <span className="text-white font-bold">{currentColors.name}</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Sound Settings Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-[#0d1117]/80 backdrop-blur-xl rounded-xl border border-accent-border p-5"
      >
        <div className="flex items-center space-x-3 mb-5">
          <div className="w-8 h-8 rounded-lg accent-gradient flex items-center justify-center text-sm">
            🔊
          </div>
          <div>
            <h2 className="text-white font-display font-bold tracking-wider">
              SOUND
            </h2>
            <p className="text-xs text-gray-500 font-mono">
              Audio preferences
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {/* Master Sound */}
          <button
            onClick={() => {
              sfx.click();
              toggleMuted();
            }}
            className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-white/5 transition-colors group"
          >
            <div className="flex items-center space-x-3">
              <span className="text-xl">{muted ? '🔇' : '🔊'}</span>
              <div>
                <span className="text-sm text-white font-mono">All Sounds</span>
                <p className="text-xs text-gray-500 font-mono">Master volume toggle</p>
              </div>
            </div>
            <motion.span
              key={muted ? 'off' : 'on'}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className={`w-10 h-5 rounded-full transition-colors ${muted ? 'bg-gray-700' : 'bg-accent'}`}
            >
              <motion.span
                key={muted ? 'off' : 'on'}
                initial={{ x: muted ? 0 : 16 }}
                animate={{ x: muted ? 0 : 16 }}
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow"
              />
            </motion.span>
          </button>

          {/* Milestone Chime */}
          <button
            onClick={() => {
              sfx.click();
              toggleCelebrateSound();
              if (!celebrateSound && !muted) sfx.levelUp();
            }}
            disabled={muted}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors group ${muted ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/5'}`}
          >
            <div className="flex items-center space-x-3">
              <span className="text-xl">🎺</span>
              <div>
                <span className="text-sm text-white font-mono">Milestone Chime</span>
                <p className="text-xs text-gray-500 font-mono">Level-up / rank-up fanfare</p>
              </div>
            </div>
            <div className={`w-10 h-5 rounded-full transition-colors ${celebrateSound && !muted ? 'bg-accent' : 'bg-gray-700'}`}>
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${celebrateSound && !muted ? 'left-[16px]' : 'left-0.5'}`} />
            </div>
          </button>

          {/* Theme Music */}
          <button
            onClick={() => {
              sfx.click();
              toggleThemeMusic();
              if (themeMusic) sfx.stopTheme();
              else if (!muted) sfx.startTheme();
            }}
            disabled={muted}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors group ${muted ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/5'}`}
          >
            <div className="flex items-center space-x-3">
              <span className="text-xl">🎵</span>
              <div>
                <span className="text-sm text-white font-mono">Theme Music</span>
                <p className="text-xs text-gray-500 font-mono">Background soundtrack</p>
              </div>
            </div>
            <div className={`w-10 h-5 rounded-full transition-colors ${themeMusic && !muted ? 'bg-accent' : 'bg-gray-700'}`}>
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${themeMusic && !muted ? 'left-[16px]' : 'left-0.5'}`} />
            </div>
          </button>

          {/* Sound Pack Selector */}
          <div className={`pt-3 border-t border-gray-800 ${muted ? 'opacity-50' : ''}`}>
            <div className="flex items-center space-x-3 mb-3">
              <span className="text-xl">🎶</span>
              <span className="text-sm text-white font-mono">Sound Pack</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {['solo-leveling', 'cyberpunk', 'fantasy'].map(pack => (
                <button
                  key={pack}
                  onClick={() => {
                    setSoundPack(pack);
                    sfx.click();
                    if (themeMusic && !muted) {
                      sfx.stopTheme();
                      setTimeout(() => sfx.startTheme(), 100);
                    }
                  }}
                  disabled={muted}
                  className={`
                    px-4 py-3 rounded-lg text-left transition-all border
                    ${soundPack === pack
                      ? 'bg-accent-bg border-accent border-accent-border text-white'
                      : 'bg-[#1a1f2e]/50 border-gray-800 text-gray-400 hover:bg-[#1a1f2e]/80'
                    }
                  `}
                >
                  <span className="text-lg block">
                    {pack === 'solo-leveling' ? '⚔️' : pack === 'cyberpunk' ? '🌆' : '🐉'}
                  </span>
                  <span className="text-xs font-mono block mt-1 capitalize">
                    {pack.replace('-', ' ')}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* About Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-[#0d1117]/80 backdrop-blur-xl rounded-xl border border-accent-border p-5"
      >
        <div className="flex items-center space-x-3 mb-5">
          <div className="w-8 h-8 rounded-lg accent-gradient flex items-center justify-center text-sm">
            ℹ️
          </div>
          <div>
            <h2 className="text-white font-display font-bold tracking-wider">
              ABOUT
            </h2>
            <p className="text-xs text-gray-500 font-mono">
              System information
            </p>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400 font-mono">Version</span>
            <span className="text-white font-mono">v1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400 font-mono">Theme</span>
            <span className="text-accent-text font-mono">{currentColors.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400 font-mono">Sound Pack</span>
            <span className="text-white font-mono capitalize">{soundPack.replace('-', ' ')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400 font-mono">Audio Status</span>
            <span className={`font-mono ${muted ? 'text-red-400' : 'text-green-400'}`}>
              {muted ? 'Muted' : 'Enabled'}
            </span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-800">
          <p className="text-xs text-gray-600 font-mono text-center">
            Hunter System • Solo Leveling Quest Tracker
          </p>
          <p className="text-xs text-gray-600 font-mono text-center mt-1">
            Built with React + TypeScript + Tailwind CSS
          </p>
        </div>
      </motion.div>
    </div>
  );
}
