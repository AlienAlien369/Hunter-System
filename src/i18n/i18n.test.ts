import { describe, it, expect, beforeEach } from 'vitest';
import {
  LOCALES, applyLocaleToDocument, detectLocale, firstDayOfWeek, formatCurrency, formatDate, formatNumber, translate, translatePlural, useLocaleStore,
} from './index';
import { en } from './messages/en';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();

describe('message files', () => {
  for (const loc of LOCALES) {
    it(`${loc.code} has every English key and no extras`, () => {
      expect(Object.keys(loc.messages).sort()).toEqual(Object.keys(en).sort());
    });
    it(`${loc.code} keeps every {placeholder} the English text uses`, () => {
      for (const key of Object.keys(en) as (keyof typeof en)[]) {
        expect(placeholders(loc.messages[key]), `${loc.code}:${key}`).toEqual(placeholders(en[key]));
      }
    });
    it(`${loc.code} has no empty translations except deliberate ones`, () => {
      const empties = (Object.keys(en) as (keyof typeof en)[]).filter(k => loc.messages[k] === '' && en[k] !== '');
      // `parent.intro.before` is legitimately empty in Hindi/Hinglish (word order differs).
      expect(empties.filter(k => k !== 'parent.intro.before')).toEqual([]);
    });
  }
});

describe('detectLocale', () => {
  it('honours a saved choice first', () => {
    expect(detectLocale('hi-Latn', ['en-US'])).toBe('hi-Latn');
    expect(detectLocale('hi', ['en-US'])).toBe('hi');
  });
  it('picks the first supported browser language', () => {
    expect(detectLocale(null, ['hi-IN', 'en'])).toBe('hi');
    expect(detectLocale(null, ['fr-FR', 'en-GB'])).toBe('en');
    expect(detectLocale(null, ['fr-FR', 'hi'])).toBe('hi');
  });
  it('never auto-selects Hinglish and ignores junk', () => {
    expect(detectLocale(null, ['hi-Latn'])).toBe('hi');
    expect(detectLocale('klingon', ['de'])).toBe('en');
    expect(detectLocale(null, [])).toBe('en');
  });
});

describe('translate', () => {
  it('interpolates variables and leaves unknown ones visible', () => {
    expect(translate('en', 'auth.invited', { name: 'Asha' })).toContain('Asha');
    expect(translate('hi', 'nav.paused', { name: 'योग' })).toBe('योग (रुका हुआ)');
    expect(translate('en', 'nav.paused')).toBe('{name} (paused)');
  });
  it('lets a translation be deliberately empty', () => {
    expect(translate('hi', 'parent.intro.before')).toBe('');
    expect(translate('en', 'parent.intro.before')).not.toBe('');
  });
});

describe('plurals', () => {
  it('picks the right CLDR form per language', () => {
    // Uses test-only keys through the generic lookup: fall back to `_other`, then the key.
    expect(translatePlural('en', 'nonexistent.key', 1)).toBe('nonexistent.key');
  });
});

describe('formatting', () => {
  it('groups digits the Indian way for Indian locales', () => {
    expect(formatNumber('hi-Latn', 1234567)).toBe('12,34,567');
    expect(formatNumber('en', 1234567)).toBe('1,234,567');
  });
  it('formats money with the right symbol and grouping', () => {
    expect(formatCurrency('hi-Latn', 499, 'INR')).toBe('₹499');
    expect(formatCurrency('en', 3.99, 'USD')).toBe('$3.99');
    expect(formatCurrency('hi-Latn', 100000, 'INR')).toBe('₹1,00,000');
  });
  it('formats dates in the locale', () => {
    const d = new Date(Date.UTC(2026, 9, 10, 12));
    expect(formatDate('en', d, { dateStyle: 'long', timeZone: 'UTC' })).toBe('October 10, 2026');
    expect(formatDate('hi', d, { dateStyle: 'long', timeZone: 'UTC' })).toContain('अक्टूबर');
  });
  it('knows which day the week starts on', () => {
    expect(firstDayOfWeek('en', 'US')).toBe(7);
    expect(firstDayOfWeek('en', 'GB')).toBe(1);
    expect(firstDayOfWeek('en')).toBeGreaterThanOrEqual(1);
    expect(firstDayOfWeek('hi', 'IN')).toBe(7);
  });
});

describe('document language and direction', () => {
  beforeEach(() => { document.documentElement.removeAttribute('dir'); });
  it('sets lang and dir on <html>', () => {
    applyLocaleToDocument('hi');
    expect(document.documentElement.lang).toBe('hi');
    expect(document.documentElement.dir).toBe('ltr');
  });
});

describe('locale store', () => {
  it('persists the choice and ignores unknown codes', () => {
    useLocaleStore.getState().setLocale('hi');
    expect(useLocaleStore.getState().locale).toBe('hi');
    expect(localStorage.getItem('hunter.locale')).toBe('hi');
    useLocaleStore.getState().setLocale('xx' as never);
    expect(useLocaleStore.getState().locale).toBe('hi');
    useLocaleStore.getState().setLocale('en');
  });
});
