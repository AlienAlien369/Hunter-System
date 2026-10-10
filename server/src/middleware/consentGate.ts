import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { jwtSecret } from './auth.js';
import { canUseApp } from '../age.js';
import { consentStatusOf } from '../consent.js';

// Until a hunter has stated their age (existing accounts) or a minor's parent
// has consented, the API refuses everything except what is needed to sign in,
// sort out consent, or log out. Enforced here, not in the UI.
const ALWAYS_OPEN = ['/api/auth', '/api/consent', '/api/events', '/api/public', '/api/health', '/api/client-errors'];

export async function consentGate(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'OPTIONS' || !req.path.startsWith('/api') || ALWAYS_OPEN.some(p => req.path === p || req.path.startsWith(p + '/'))) return next();
  const token = req.cookies?.token;
  if (!token) return next(); // the route's own auth answers 401
  try {
    const { id } = jwt.verify(token, jwtSecret()) as { id: number };
    const status = await consentStatusOf(id);
    if (status && !canUseApp(status)) {
      return res.status(403).json({ error: 'Consent required before using Hunter System.', code: 'consent_required', consentStatus: status });
    }
  } catch {
    // invalid token: the route's own auth answers
  }
  next();
}
