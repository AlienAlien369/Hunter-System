import { create } from "zustand";

// Theme color configurations
const THEMES = {
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

const THEME_KEY = "hunter_theme";
type ThemeId = keyof typeof THEMES;

// Theme store
const useThemeStore = create<{
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}>((set) => ({
  theme: (localStorage.getItem(THEME_KEY) as ThemeId) || "purple-monarch",
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

export { useThemeStore, THEMES, applyTheme };
