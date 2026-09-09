import { create } from 'zustand';

// Theme color configurations
const THEMES = {
  'purple-monarch': {
    id: 'purple-monarch',
    name: 'Purple Monarch',
    icon: '👑',
    accent: '#8E2DE2',
    accentLight: '#a855f7',
    accentGlow: '#8E2DE2',
    accentBg: 'rgba(142, 45, 226, 0.1)',
    accentBorder: 'rgba(142, 45, 226, 0.4)',
    textAccent: '#D6A2E8',
    gradientStart: '#7E14FF',
    gradientEnd: '#3b82f6',
    scrollbar: '#8E2DE2',
  },
  'gold': {
    id: 'gold',
    name: 'Gold',
    icon: '🏆',
    accent: '#F1C40F',
    accentLight: '#F5D76E',
    accentGlow: '#F1C40F',
    accentBg: 'rgba(241, 196, 15, 0.1)',
    accentBorder: 'rgba(241, 196, 15, 0.4)',
    textAccent: '#F1C40F',
    gradientStart: '#F1C40F',
    gradientEnd: '#f59e0b',
    scrollbar: '#F1C40F',
  },
  'crimson': {
    id: 'crimson',
    name: 'Crimson',
    icon: '❤️‍🔥',
    accent: '#DC143C',
    accentLight: '#FF4D6D',
    accentGlow: '#DC143C',
    accentBg: 'rgba(220, 20, 60, 0.1)',
    accentBorder: 'rgba(220, 20, 60, 0.4)',
    textAccent: '#FF6B8A',
    gradientStart: '#DC143C',
    gradientEnd: '#8B0000',
    scrollbar: '#DC143C',
  },
};

const THEME_KEY = 'hunter_theme';
type ThemeId = keyof typeof THEMES;

// Theme store
const useThemeStore = create<{ theme: ThemeId; setTheme: (theme: ThemeId) => void }>((set) => ({
  theme: (localStorage.getItem(THEME_KEY) as ThemeId) || 'purple-monarch',
  setTheme: (theme: ThemeId) => {
    localStorage.setItem(THEME_KEY, theme);
    set({ theme });
  },
}));

// Apply theme colors to CSS variables with animation effects
function applyTheme(themeId: ThemeId, animate = true) {
  const colors = THEMES[themeId];
  if (!colors) return;

  const root = document.documentElement;
  
  // Apply the new colors
  root.style.setProperty('--accent', colors.accent);
  root.style.setProperty('--accent-light', colors.accentLight);
  root.style.setProperty('--accent-glow', colors.accentGlow);
  root.style.setProperty('--accent-bg', colors.accentBg);
  root.style.setProperty('--accent-border', colors.accentBorder);
  root.style.setProperty('--text-accent', colors.textAccent);
  root.style.setProperty('--gradient-start', colors.gradientStart);
  root.style.setProperty('--gradient-end', colors.gradientEnd);
  root.style.setProperty('--scrollbar-color', colors.scrollbar);
  root.setAttribute('data-theme', themeId);

  // Trigger animation effects
  if (animate) {
    triggerThemeAnimation(colors.accentGlow);
  }
}

// Create flash and ripple effects for theme changes
function triggerThemeAnimation(accentGlow: string) {
  // Remove any existing effects
  const existingFlash = document.querySelector('.theme-flash-overlay');
  const existingRipple = document.querySelector('.theme-ripple');
  
  if (existingFlash) existingFlash.remove();
  if (existingRipple) existingRipple.remove();

  // Create flash overlay
  const flashOverlay = document.createElement('div');
  flashOverlay.className = 'theme-flash-overlay active';
  flashOverlay.style.background = `radial-gradient(circle at center, ${accentGlow} 0%, transparent 60%)`;
  document.body.appendChild(flashOverlay);

  // Trigger fade out after brief moment
  requestAnimationFrame(() => {
    flashOverlay.classList.remove('active');
    flashOverlay.classList.add('fade-out');
    
    // Remove after animation completes
    setTimeout(() => flashOverlay.remove(), 700);
  });

  // Create ripple effect
  const ripple = document.createElement('div');
  ripple.className = 'theme-ripple active';
  ripple.style.background = `radial-gradient(circle at center, ${accentGlow} 0%, transparent 70%)`;
  document.body.appendChild(ripple);

  // Remove ripple after animation
  setTimeout(() => ripple.remove(), 900);
}

export { useThemeStore, THEMES, applyTheme };
