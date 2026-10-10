import { create } from "zustand";

// Theme color configurations
const FREE_THEMES = {
  "purple-monarch": {
    id: "purple-monarch",
    name: "Purple Monarch",
    icon: "👑",
    accent: "#8E2DE2",
    accentLight: "#a855f7",
    accentGlow: "#8E2DE2",
    accentBg: "rgba(142, 45, 226, 0.1)",
    accentBorder: "rgba(142, 45, 226, 0.4)",
    textAccent: "#D6A2E8",
    gradientStart: "#7E14FF",
    gradientEnd: "#3b82f6",
    scrollbar: "#8E2DE2",
    // Background
    bgBase: "#0a0e1a",
    bgCard: "#161b22",
    aurora1: "rgba(126, 20, 255, 0.25)",
    aurora2: "rgba(59, 130, 246, 0.20)",
    aurora3: "rgba(168, 85, 247, 0.15)",
    particleColor: "#a855f7",
    particleGlow: "rgba(168, 85, 247, 0.8)",
    gridColor: "rgba(139, 92, 246, 0.12)",
    scanColor: "rgba(168, 85, 247, 0.10)",
  },
  gold: {
    id: "gold",
    name: "Gold",
    icon: "🏆",
    accent: "#F1C40F",
    accentLight: "#F5D76E",
    accentGlow: "#F1C40F",
    accentBg: "rgba(241, 196, 15, 0.1)",
    accentBorder: "rgba(241, 196, 15, 0.4)",
    textAccent: "#F1C40F",
    gradientStart: "#F1C40F",
    gradientEnd: "#f59e0b",
    scrollbar: "#F1C40F",
    // Background
    bgBase: "#0f0c06",
    bgCard: "#1a1508",
    aurora1: "rgba(241, 196, 15, 0.18)",
    aurora2: "rgba(245, 158, 11, 0.15)",
    aurora3: "rgba(251, 191, 36, 0.12)",
    particleColor: "#F5D76E",
    particleGlow: "rgba(241, 196, 15, 0.8)",
    gridColor: "rgba(241, 196, 15, 0.08)",
    scanColor: "rgba(245, 215, 110, 0.08)",
  },
  crimson: {
    id: "crimson",
    name: "Crimson",
    icon: "❤️‍🔥",
    accent: "#DC143C",
    accentLight: "#FF4D6D",
    accentGlow: "#DC143C",
    accentBg: "rgba(220, 20, 60, 0.1)",
    accentBorder: "rgba(220, 20, 60, 0.4)",
    textAccent: "#FF6B8A",
    gradientStart: "#DC143C",
    gradientEnd: "#8B0000",
    scrollbar: "#DC143C",
    // Background
    bgBase: "#0c0608",
    bgCard: "#1a0c10",
    aurora1: "rgba(220, 20, 60, 0.20)",
    aurora2: "rgba(139, 0, 0, 0.18)",
    aurora3: "rgba(255, 77, 109, 0.12)",
    particleColor: "#FF4D6D",
    particleGlow: "rgba(220, 20, 60, 0.8)",
    gridColor: "rgba(220, 20, 60, 0.10)",
    scanColor: "rgba(255, 77, 109, 0.08)",
  },
};

// Premium themes (Pro). Built from a handful of colours so they stay consistent
// with the free ones; the free themes above are untouched and stay free.
function premiumTheme(id: string, name: string, icon: string, c: { accent: string; light: string; text: string; end: string; rgb: string; bgBase: string; bgCard: string; rgb2: string }) {
  return {
    id, name, icon,
    accent: c.accent, accentLight: c.light, accentGlow: c.accent,
    accentBg: `rgba(${c.rgb}, 0.1)`, accentBorder: `rgba(${c.rgb}, 0.4)`, textAccent: c.text,
    gradientStart: c.accent, gradientEnd: c.end, scrollbar: c.accent,
    bgBase: c.bgBase, bgCard: c.bgCard,
    aurora1: `rgba(${c.rgb}, 0.22)`, aurora2: `rgba(${c.rgb2}, 0.18)`, aurora3: `rgba(${c.rgb}, 0.12)`,
    particleColor: c.light, particleGlow: `rgba(${c.rgb}, 0.8)`,
    gridColor: `rgba(${c.rgb}, 0.10)`, scanColor: `rgba(${c.rgb}, 0.08)`,
  };
}

const PREMIUM_THEMES = {
  aurora: premiumTheme("aurora", "Aurora", "🌌", { accent: "#14B8A6", light: "#5EEAD4", text: "#99F6E4", end: "#2563EB", rgb: "20, 184, 166", rgb2: "37, 99, 235", bgBase: "#04100f", bgCard: "#0b1a19" }),
  ember: premiumTheme("ember", "Ember", "🔥", { accent: "#F97316", light: "#FDBA74", text: "#FED7AA", end: "#DC2626", rgb: "249, 115, 22", rgb2: "220, 38, 38", bgBase: "#0f0804", bgCard: "#1c1209" }),
  glacier: premiumTheme("glacier", "Glacier", "🧊", { accent: "#38BDF8", light: "#BAE6FD", text: "#E0F2FE", end: "#6366F1", rgb: "56, 189, 248", rgb2: "99, 102, 241", bgBase: "#050d14", bgCard: "#0c1a26" }),
  sakura: premiumTheme("sakura", "Sakura", "🌸", { accent: "#F472B6", light: "#FBCFE8", text: "#FCE7F3", end: "#A855F7", rgb: "244, 114, 182", rgb2: "168, 85, 247", bgBase: "#10060b", bgCard: "#1f0c15" }),
};

type FreeThemeId = keyof typeof FREE_THEMES;
type PremiumThemeId = keyof typeof PREMIUM_THEMES;
export type ThemeId = FreeThemeId | PremiumThemeId;
type ThemeColors = (typeof FREE_THEMES)[FreeThemeId];

const ALL_THEMES: Record<ThemeId, ThemeColors> = { ...FREE_THEMES, ...PREMIUM_THEMES };
const DEFAULT_THEME: ThemeId = "purple-monarch";

export const isPremiumTheme = (id: string): id is PremiumThemeId => id in PREMIUM_THEMES;

/**
 * The theme to actually show. A premium theme is shown only to a hunter on a
 * paid plan; if Pro lapses they fall back to the default (their choice is kept,
 * so renewing restores it). Until billing has loaded we do not flash the default.
 * Cosmetic only: this is a UI courtesy, not access control.
 */
export function effectiveTheme(theme: ThemeId, premiumAllowed: boolean, billingLoaded: boolean): ThemeId {
  if (!(theme in ALL_THEMES)) return DEFAULT_THEME;
  if (isPremiumTheme(theme) && billingLoaded && !premiumAllowed) return DEFAULT_THEME;
  return theme;
}

const THEME_KEY = "hunter_theme";

// Theme store
const useThemeStore = create<{
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}>((set) => ({
  theme: ((): ThemeId => { const saved = localStorage.getItem(THEME_KEY); return saved && saved in ALL_THEMES ? (saved as ThemeId) : DEFAULT_THEME; })(),
  setTheme: (theme: ThemeId) => {
    localStorage.setItem(THEME_KEY, theme);
    set({ theme });
  },
}));

// Apply theme colors to CSS variables with animation effects
function applyTheme(themeId: ThemeId, animate = true) {
  const colors = ALL_THEMES[themeId];
  if (!colors) return;

  const root = document.documentElement;

  // Apply the new colors
  root.style.setProperty("--accent", colors.accent);
  root.style.setProperty("--accent-light", colors.accentLight);
  root.style.setProperty("--accent-glow", colors.accentGlow);
  root.style.setProperty("--accent-bg", colors.accentBg);
  root.style.setProperty("--accent-border", colors.accentBorder);
  root.style.setProperty("--text-accent", colors.textAccent);
  root.style.setProperty("--gradient-start", colors.gradientStart);
  root.style.setProperty("--gradient-end", colors.gradientEnd);
  root.style.setProperty("--scrollbar-color", colors.scrollbar);
  // Background colors
  root.style.setProperty("--bg-base", colors.bgBase);
  root.style.setProperty("--bg-card", colors.bgCard);
  root.style.setProperty("--aurora-1", colors.aurora1);
  root.style.setProperty("--aurora-2", colors.aurora2);
  root.style.setProperty("--aurora-3", colors.aurora3);
  root.style.setProperty("--particle-color", colors.particleColor);
  root.style.setProperty("--particle-glow", colors.particleGlow);
  root.style.setProperty("--grid-color", colors.gridColor);
  root.style.setProperty("--scan-color", colors.scanColor);
  root.setAttribute("data-theme", themeId);

  // Trigger animation effects
  if (animate) {
    triggerThemeAnimation(colors.accentGlow);
  }
}

// Create flash and ripple effects for theme changes
function triggerThemeAnimation(accentGlow: string) {
  // Remove any existing effects
  const existingFlash = document.querySelector(".theme-flash-overlay");
  const existingRipple = document.querySelector(".theme-ripple");

  if (existingFlash) existingFlash.remove();
  if (existingRipple) existingRipple.remove();

  // Create flash overlay
  const flashOverlay = document.createElement("div");
  flashOverlay.className = "theme-flash-overlay active";
  flashOverlay.style.background = `radial-gradient(circle at center, ${accentGlow} 0%, transparent 60%)`;
  document.body.appendChild(flashOverlay);

  // Trigger fade out after brief moment
  requestAnimationFrame(() => {
    flashOverlay.classList.remove("active");
    flashOverlay.classList.add("fade-out");

    // Remove after animation completes
    setTimeout(() => flashOverlay.remove(), 700);
  });

  // Create ripple effect
  const ripple = document.createElement("div");
  ripple.className = "theme-ripple active";
  ripple.style.background = `radial-gradient(circle at center, ${accentGlow} 0%, transparent 70%)`;
  document.body.appendChild(ripple);

  // Remove ripple after animation
  setTimeout(() => ripple.remove(), 900);
}

export { useThemeStore, ALL_THEMES as THEMES, applyTheme };
