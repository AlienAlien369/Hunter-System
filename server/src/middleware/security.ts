import type { Request, Response, NextFunction } from 'express';

// ─── Allowed origins ────────────────────────────────────────────────────────
// Only Hunter's own frontends may make credentialed cross-site requests.
// Extra origins can be added with FRONTEND_URL (comma-separated).
const STATIC_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://hunters-system.vercel.app',
  'https://hunter-system.vercel.app',
  'https://hunter-system-kss0.onrender.com',
];
// Vercel preview deployments of this project
const PREVIEW_ORIGIN = /^https:\/\/hunter-system-[a-z0-9-]+-lakshyas-projects-c97e54f6\.vercel\.app$/;

export function isAllowedOrigin(origin: string): boolean {
  const extra = (process.env.FRONTEND_URL || '').split(',').map(s => s.trim()).filter(Boolean);
  return STATIC_ORIGINS.includes(origin) || extra.includes(origin) || PREVIEW_ORIGIN.test(origin);
}

/**
 * CSRF guard. The auth cookie is SameSite=None (the frontend is on another
 * site), so browsers attach it to cross-site requests. Reject any
 * state-changing request whose Origin isn't one of ours. Requests without an
 * Origin header (curl, server-to-server, same-origin navigations) are allowed.
 */
export function originGuard(req: Request, res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (origin && !isAllowedOrigin(origin)) return res.status(403).json({ error: 'Origin not allowed' });
  next();
}

// ─── Rate limiting ─────────────────────────────────────────────────────────
// ponytail: in-memory fixed windows (single Render instance); move to Redis
// if the API is ever scaled to multiple instances.
const buckets = new Map<string, { count: number; resetAt: number }>();

/** Count one hit for `key`; returns seconds to wait if over `max` in `windowMs`, else 0. */
export function hit(key: string, max: number, windowMs: number, now = Date.now()): number {
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return 0;
  }
  b.count += 1;
  return b.count > max ? Math.ceil((b.resetAt - now) / 1000) : 0;
}

/** Peek without counting. */
export function blockedFor(key: string, max: number, now = Date.now()): number {
  const b = buckets.get(key);
  return b && b.resetAt > now && b.count >= max ? Math.ceil((b.resetAt - now) / 1000) : 0;
}

export function clearKey(key: string) {
  buckets.delete(key);
}

// Periodically drop expired windows so the map can't grow without bound.
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}, 10 * 60_000).unref();

export const LIMITS = {
  failedLogins: { max: Number(process.env.LOGIN_FAIL_LIMIT) || 10, windowMs: 15 * 60_000 },
  registrations: { max: Number(process.env.REGISTER_LIMIT) || 30, windowMs: 60 * 60_000 },
};

export function tooMany(res: Response, retryAfter: number, what: string) {
  res.setHeader('Retry-After', String(retryAfter));
  return res.status(429).json({ error: `Too many ${what}. Try again in ${Math.ceil(retryAfter / 60)} minute(s).` });
}
