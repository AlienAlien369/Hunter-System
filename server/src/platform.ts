import { pool } from './db.js';
import { setInrPriceOverrides } from './pricing.js';

// Platform settings the owner (super admin) changes at runtime without a
// deploy: the product's name and the prices. Stored in app_settings under the
// 'platform.' prefix, cached in memory, and served publicly through
// GET /api/public/config so the website, emails and checkout all show the same
// name and the same price.

export interface PlatformSettings {
  brandName: string;
  tagline: string;
  supportEmail: string;
  /** Individual (B2C) Pro, India, in paise. */
  proYearInr: number;
  proMonthInr: number;
  /** Institution (B2B) price per student seat per year, in paise. */
  orgSeatYearInr: number;
  /** A new institution's free trial. */
  orgTrialDays: number;
  orgTrialSeats: number;
}

export const DEFAULT_SETTINGS: PlatformSettings = {
  brandName: process.env.APP_NAME || 'Hunter System',
  tagline: 'Turn every timetable into quests, XP and ranks',
  supportEmail: process.env.SUPPORT_EMAIL || '',
  proYearInr: 60000,
  proMonthInr: 7900,
  orgSeatYearInr: 60000,
  orgTrialDays: 30,
  orgTrialSeats: 30,
};

const KEY = 'platform.settings';
let cache: PlatformSettings = { ...DEFAULT_SETTINGS };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const money = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null;

/**
 * Validate a partial update against the current settings. Returns the merged
 * settings, or an error message. Pure; unit-tested.
 */
export function mergeSettings(current: PlatformSettings, patch: Record<string, unknown>): PlatformSettings | string {
  const next = { ...current };
  if (patch.brandName !== undefined) {
    const name = typeof patch.brandName === 'string' ? patch.brandName.trim().replace(/\s+/g, ' ') : '';
    if (name.length < 2 || name.length > 40) return 'The website name must be 2 to 40 characters.';
    if (/[<>]/.test(name)) return 'The website name cannot contain < or >.';
    next.brandName = name;
  }
  if (patch.tagline !== undefined) {
    const tagline = typeof patch.tagline === 'string' ? patch.tagline.trim().replace(/\s+/g, ' ') : '';
    if (tagline.length > 120 || /[<>]/.test(tagline)) return 'The tagline must be at most 120 characters, without < or >.';
    next.tagline = tagline;
  }
  if (patch.supportEmail !== undefined) {
    const email = typeof patch.supportEmail === 'string' ? patch.supportEmail.trim() : '';
    if (email && (!EMAIL_RE.test(email) || email.length > 254)) return 'Enter a valid support email (or leave it empty).';
    next.supportEmail = email;
  }
  // Prices in paise: ₹1 to ₹1,00,000.
  for (const k of ['proYearInr', 'proMonthInr', 'orgSeatYearInr'] as const) {
    if (patch[k] === undefined) continue;
    const v = money(patch[k], 100, 10_000_000);
    if (v === null) return `${k} must be a whole number of paise between 100 and 10000000.`;
    next[k] = v;
  }
  if (patch.orgTrialDays !== undefined) {
    const v = money(patch.orgTrialDays, 0, 365);
    if (v === null) return 'Trial days must be between 0 and 365.';
    next.orgTrialDays = v;
  }
  if (patch.orgTrialSeats !== undefined) {
    const v = money(patch.orgTrialSeats, 0, 10_000);
    if (v === null) return 'Trial seats must be between 0 and 10000.';
    next.orgTrialSeats = v;
  }
  return next;
}

function applyToPricing(s: PlatformSettings) {
  setInrPriceOverrides({ proYear: s.proYearInr, proMonth: s.proMonthInr, orgSeatYear: s.orgSeatYearInr });
}

/** Load the stored settings into memory (at boot, and after every change). */
export async function loadPlatformSettings(): Promise<PlatformSettings> {
  const row = (await pool.query('SELECT value FROM app_settings WHERE key = $1', [KEY])).rows[0];
  let stored: Record<string, unknown> = {};
  try { stored = row ? JSON.parse(row.value) : {}; } catch { stored = {}; }
  const merged = mergeSettings(DEFAULT_SETTINGS, stored);
  cache = typeof merged === 'string' ? { ...DEFAULT_SETTINGS } : merged;
  applyToPricing(cache);
  return cache;
}

export const platformSettings = (): PlatformSettings => cache;
export const brandName = (): string => cache.brandName;

export async function updatePlatformSettings(patch: Record<string, unknown>): Promise<PlatformSettings | string> {
  const next = mergeSettings(cache, patch);
  if (typeof next === 'string') return next;
  await pool.query(
    `INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [KEY, JSON.stringify(next)],
  );
  cache = next;
  applyToPricing(cache);
  return cache;
}

/** What any visitor may see: name, tagline, support contact and the public prices. */
export function publicConfig() {
  const s = cache;
  return {
    brand: { name: s.brandName, tagline: s.tagline, supportEmail: s.supportEmail || null },
    pricing: {
      currency: 'INR',
      individual: { yearMinor: s.proYearInr, monthMinor: s.proMonthInr },
      organization: { seatYearMinor: s.orgSeatYearInr, trialDays: s.orgTrialDays, trialSeats: s.orgTrialSeats },
    },
  };
}
