import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useThemeStore, THEMES, applyTheme } from '../store/themeStore';

type ThemeId = 'purple-monarch' | 'gold' | 'crimson';
import { sfx } from '../utils/sounds';
import { createPortal } from 'react-dom';

export default function ThemeSelector() {
  const currentTheme = useThemeStore(s => s.theme);
  const setTheme = useThemeStore(s => s.setTheme);
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Apply theme on mount and when it changes
  useEffect(() => {
    applyTheme(currentTheme);
  }, [currentTheme]);

  const currentColors = THEMES[currentTheme];

  const handleSelect = (themeId: ThemeId) => {
    sfx.click();
    setTheme(themeId);
    setOpen(false);
  };

  const themeList = Object.values(THEMES);

  const btnRect = btnRef.current?.getBoundingClientRect();
  const popoverTop = (btnRect?.bottom ?? 0) + 8;
  const popoverRight = Math.max(8, window.innerWidth - (btnRect?.right ?? window.innerWidth));

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => {
          sfx.click();
          setOpen(v => !v);
        }}
        className="relative p-2 text-gray-400 hover:text-white transition-colors"
        title="Theme settings"
        aria-label="Theme settings"
      >
        <motion.span
          key={currentTheme}
          initial={{ scale: 0.4, opacity: 0, rotate: -30 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 20 }}
          className="block text-lg leading-none"
        >
          {currentColors.icon}
        </motion.span>
        {open && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-accent rounded-full" />
        )}
      </button>

      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[70]" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.15 }}
              className="fixed z-[71] w-64 bg-[#0d1117]/95 backdrop-blur-xl border border-accent-border rounded-xl p-3 shadow-2xl shadow-accent/10"
              style={{ top: popoverTop, right: popoverRight }}
            >
              <p className="text-[10px] text-gray-500 font-mono tracking-widest mb-2.5">
                HUNTER THEME
              </p>

              {/* Current theme preview bar */}
              <div className="h-10 rounded-lg mb-3 flex items-center justify-center text-lg opacity-80" style={{ background: `linear-gradient(135deg, ${currentColors.gradientStart}, ${currentColors.gradientEnd})` }}>
                {currentColors.icon}
              </div>

              <div className="space-y-1.5">
                {themeList.map(theme => {
                  const isSelected = theme.id === currentTheme;
                  return (
                    <button
                      key={theme.id}
                      onClick={() => handleSelect(theme.id as ThemeId)}
                      className={`
                        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all border text-left
                        ${isSelected
                          ? 'bg-accent-bg border-accent-border shadow-[0_0_15px_var(--accent-glow)/20]'
                          : 'bg-transparent border-transparent hover:bg-white/5'
                        }
                      `}
                    >
                      {/* Theme preview dot */}
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-base transition-transform ${isSelected ? 'scale-110' : ''}`}
                        style={{
                          background: `linear-gradient(135deg, ${theme.gradientStart}, ${theme.gradientEnd})`,
                          boxShadow: isSelected ? `0 0 15px ${theme.accentGlow}` : 'none',
                        }}
                      >
                        {theme.icon}
                      </div>

                      {/* Theme info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-mono ${isSelected ? 'text-white font-bold' : 'text-gray-300'}`}>
                            {theme.name}
                          </span>
                          {isSelected && (
                            <span className="text-[10px] font-mono text-accent px-1.5 py-0.5 bg-accent-bg/50 rounded">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1 mt-1">
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ background: theme.accent }}
                            title={theme.accent}
                          />
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ background: theme.accentLight }}
                            title={theme.accentLight}
                          />
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ background: theme.gradientEnd }}
                            title={theme.gradientEnd}
                          />
                        </div>
                      </div>

                      {/* Selection indicator */}
                      {isSelected && (
                        <motion.div
                          layoutId="themeCheckmark"
                          className="text-accent"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                        >
                          ✓
                        </motion.div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Footer hint */}
              <p className="mt-3 pt-2 border-t border-gray-800 text-[10px] text-gray-600 font-mono text-center">
                Your accent color across the system
              </p>
            </motion.div>
          </>,
          document.body
        )}
    </>
  );
}
