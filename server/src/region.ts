import type { Request } from 'express';

// Coarse market detection. Used to segment analytics now, and to pick the
// default language / currency / price later — always a *default* the hunter
// can override, never a gate.
//
// No IP geolocation: the browser calls this API directly, so there is no
// trustworthy edge geo header, and we do not want to process IPs for it.
// Signals, in order: an explicit country the client chose, the region subtag
// of Accept-Language ("en-IN"), then the IANA timezone (India has exactly one).

const INDIA_ZONES = new Set(['Asia/Kolkata', 'Asia/Calcutta']);
const REGION = /^[A-Z]{2}$/;

/** First region subtag found in an Accept-Language header, e.g. "hi-IN,en;q=0.8" → "IN". */
export function regionFromAcceptLanguage(header: string | undefined): string | null {
  if (!header) return null;
  for (const part of header.split(',')) {
    const tag = part.split(';')[0].trim();
    const region = tag.split('-').slice(1).find(s => /^[A-Za-z]{2}$/.test(s));
    if (region && REGION.test(region.toUpperCase())) return region.toUpperCase();
  }
  return null;
}

export function detectRegion(req: Request): string | null {
  const explicit = String(req.headers['x-region'] || '').toUpperCase();
  if (REGION.test(explicit)) return explicit;
  const fromLang = regionFromAcceptLanguage(req.headers['accept-language']);
  if (fromLang) return fromLang;
  const tz = String(req.headers['x-timezone'] || '');
  if (INDIA_ZONES.has(tz)) return 'IN';
  return null;
}
