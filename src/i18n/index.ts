import { useCallback } from 'react';
import { create } from 'zustand';
import { en, type MessageKey } from './messages/en';

// A small i18n layer: one source-of-truth English file, typed translations,
// ICU-style plurals via Intl.PluralRules, locale-aware formatting through
// Intl, and RTL readiness (add a language with `dir: 'rtl'` and it flips).
//
// To add a language: create messages/<code>.ts typed as Messages, add one row
// to LOCALES below. Nothing else changes.

export type LocaleCode = 'en' | 'hi' | 'hi-Latn';

export interface LocaleInfo {
  code: LocaleCode;
  /** Name in its own language, shown in the picker. */
  label: string;
  /** BCP 47 tag for the <html lang> attribute and screen readers. */
  lang: string;
  /** Tag handed to Intl for numbers/dates/plurals. Hinglish has no CLDR data, so it borrows Indian English. */
  intl: string;
  dir: 'ltr' | 'rtl';
  /** English until the language is loaded (see loadLocale), so a gap never blanks the UI. */
  messages: Record<MessageKey, string>;
  /** Fetches this language's messages on demand, keeping other languages out of the first download. */
  load?: () => Promise<Record<MessageKey, string>>;
}

export const LOCALES: LocaleInfo[] = [
  { code: 'en', label: 'English', lang: 'en', intl: 'en', dir: 'ltr', messages: en },
  { code: 'hi', label: 'हिन्दी', lang: 'hi', intl: 'hi', dir: 'ltr', messages: en, load: () => import('./messages/hi').then(m => m.hi) },
  { code: 'hi-Latn', label: 'Hinglish', lang: 'hi-Latn', intl: 'en-IN', dir: 'ltr', messages: en, load: () => import('./messages/hinglish').then(m => m.hinglish) },
];

const pending = new Map<LocaleCode, Promise<void>>();

/** Load a language's messages once. Safe to call repeatedly; resolves immediately for English. */
export function loadLocale(code: LocaleCode): Promise<void> {
  const info = LOCALES.find(l => l.code === code);
  if (!info?.load) return Promise.resolve();
  let p = pending.get(code);
  if (!p) {
    p = info.load().then(m => { info.messages = m; info.load = undefined; });
    p.catch(() => pending.delete(code)); // a failed download can be retried
    pending.set(code, p);
  }
  return p;
}

const STORAGE_KEY = 'hunter.locale';
const byCode = (code: string | null | undefined) => LOCALES.find(l => l.code === code);

/**
 * Best locale for a visitor: their saved choice, else the first language in
 * the browser's list that we support (Hinglish is never auto-picked — it is a
 * deliberate choice), else English.
 */
export function detectLocale(saved: string | null, browserLanguages: readonly string[]): LocaleCode {
  const chosen = byCode(saved);
  if (chosen) return chosen.code;
  for (const tag of browserLanguages) {
    const base = tag.toLowerCase().split('-')[0];
    if (base === 'hi') return 'hi';
    if (base === 'en') return 'en';
  }
  return 'en';
}

function initialLocale(): LocaleCode {
  let saved: string | null = null;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* storage unavailable */ }
  const langs = typeof navigator !== 'undefined' ? (navigator.languages?.length ? navigator.languages : [navigator.language]) : [];
  return detectLocale(saved, langs.filter(Boolean));
}

interface LocaleState {
  locale: LocaleCode;
  setLocale: (code: LocaleCode) => void;
}

export const useLocaleStore = create<LocaleState>(set => ({
  locale: initialLocale(),
  setLocale: code => {
    if (!byCode(code)) return;
    try { localStorage.setItem(STORAGE_KEY, code); } catch { /* storage unavailable */ }
    // Switch once the language has arrived; if the download fails, still switch (English fills the gaps).
    void loadLocale(code).catch(() => undefined).then(() => set({ locale: code }));
  },
}));

/** Offer a locale to a visitor who has never chosen one, without remembering it as their choice. */
export function suggestLocale(code: LocaleCode) {
  try { if (localStorage.getItem(STORAGE_KEY)) return; } catch { /* storage unavailable */ }
  void loadLocale(code).catch(() => undefined).then(() => useLocaleStore.setState({ locale: code }));
}

export const localeInfo = (code: LocaleCode): LocaleInfo => byCode(code) ?? LOCALES[0];

/** Reflect the locale on <html> so screen readers, hyphenation and RTL layout follow it. */
export function applyLocaleToDocument(code: LocaleCode, root: HTMLElement = document.documentElement) {
  const info = localeInfo(code);
  root.lang = info.lang;
  root.dir = info.dir;
}

export type Vars = Record<string, string | number>;

// The product's name is not fixed: the super admin can rename the website at
// any time (GET /api/public/config). Every message may use {app} ("Hunter
// System") or {APP} ("HUNTER SYSTEM"); they are filled in automatically.
export const DEFAULT_APP_NAME: string = (import.meta.env?.VITE_APP_NAME as string | undefined) || 'Hunter System';
export const useAppName = create<{ name: string }>(() => ({ name: DEFAULT_APP_NAME }));
export function setAppName(name: string) {
  const clean = name.trim();
  if (clean && clean !== useAppName.getState().name) useAppName.setState({ name: clean });
}
export const appName = () => useAppName.getState().name;
const brandVars = (name: string): Vars => ({ app: name, APP: name.toLocaleUpperCase() });

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name) => (name in vars ? String(vars[name]) : whole));
}

/** Translate `key` for `code`. Falls back to English, then to the key itself, so a gap never blanks the UI. */
export function translate(code: LocaleCode, key: MessageKey, vars?: Vars): string {
  const info = localeInfo(code);
  const direct = info.messages[key];
  const all = { ...brandVars(appName()), ...vars };
  if (direct !== undefined && direct !== '') return interpolate(direct, all);
  // Empty-string is a legitimate translation (see parent.intro.before); only undefined falls back.
  if (direct === '') return '';
  return interpolate(en[key] ?? key, all);
}

/** Plural-aware lookup: picks `${key}_one`, `${key}_few`… by the locale's CLDR rules, `_other` as the fallback. */
export function translatePlural(code: LocaleCode, key: string, count: number, vars?: Vars): string {
  const info = localeInfo(code);
  const category = new Intl.PluralRules(info.intl).select(count);
  const table = info.messages as Record<string, string>;
  const english = en as Record<string, string>;
  const template = table[`${key}_${category}`] ?? table[`${key}_other`] ?? english[`${key}_${category}`] ?? english[`${key}_other`] ?? key;
  return interpolate(template, { ...brandVars(appName()), count, ...vars });
}

/** React hook: `const t = useT(); t('auth.username')`. Re-renders on language change. */
export function useT() {
  const locale = useLocaleStore(s => s.locale);
  const name = useAppName(s => s.name); // re-render when the super admin renames the product
  // Stable between renders (until the language or name changes), so effects
  // that list `t` as a dependency do not re-run — and re-fetch — on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback((key: MessageKey, vars?: Vars) => translate(locale, key, vars), [locale, name]);
}

/** React hook for the current product name. */
export const useBrand = () => useAppName(s => s.name);

/** Non-React callers (stores, utilities). */
export function t(key: MessageKey, vars?: Vars): string {
  return translate(useLocaleStore.getState().locale, key, vars);
}

// ── Formatting ──────────────────────────────────────────────────────────────
// Always format through these so numbers, dates, money and the start of the
// week follow the reader's locale instead of the hard-coded en-US habits.

export const formatNumber = (code: LocaleCode, n: number, opts?: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat(localeInfo(code).intl, opts).format(n);

export const formatDate = (code: LocaleCode, d: Date | string | number, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }) =>
  new Intl.DateTimeFormat(localeInfo(code).intl, opts).format(typeof d === 'string' || typeof d === 'number' ? new Date(d) : d);

/** Currency amounts in *major* units (e.g. 49 for ₹49), shown with the right symbol and grouping (₹1,00,000 vs $100,000). */
export const formatCurrency = (code: LocaleCode, amount: number, currency: string) =>
  new Intl.NumberFormat(localeInfo(code).intl, {
    style: 'currency',
    currency,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);

// First day of the week by region (1 = Monday … 7 = Sunday), CLDR data.
// Used when the browser has no Intl.Locale weekInfo (older Safari/Firefox).
const SUNDAY_FIRST = new Set(['US', 'CA', 'MX', 'BR', 'IN', 'JP', 'KR', 'PH', 'ZA', 'IL', 'SA']);
const SATURDAY_FIRST = new Set(['AF', 'BH', 'DZ', 'EG', 'IQ', 'IR', 'JO', 'KW', 'LY', 'OM', 'QA', 'SD', 'SY']);

/** 1 = Monday … 7 = Sunday. `region` is an ISO country code if known (e.g. from the hunter's profile). */
export function firstDayOfWeek(code: LocaleCode, region?: string | null): number {
  const tag = region ? `${localeInfo(code).intl.split('-')[0]}-${region}` : localeInfo(code).intl;
  try {
    const loc = new Intl.Locale(tag) as Intl.Locale & { getWeekInfo?: () => { firstDay: number }; weekInfo?: { firstDay: number } };
    const info = loc.getWeekInfo?.() ?? loc.weekInfo;
    if (info?.firstDay) return info.firstDay;
  } catch { /* fall through to the table */ }
  const r = (region ?? '').toUpperCase();
  if (SATURDAY_FIRST.has(r)) return 6;
  if (SUNDAY_FIRST.has(r)) return 7;
  return 1;
}
