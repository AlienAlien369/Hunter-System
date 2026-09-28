import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';

let warned = false;
/**
 * The JWT signing secret, read on every call (env is loaded after imports).
 * Prefer JWT_SECRET. Without it, derive a secret from DATABASE_URL — private
 * to the deployment and stable across restarts — rather than falling back to
 * a constant that is visible in the public repository. The constant remains
 * only for local development with neither variable set.
 */
export function jwtSecret(): string {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.DATABASE_URL) {
    if (!warned) {
      warned = true;
      console.warn('JWT_SECRET is not set — using a secret derived from DATABASE_URL. Set JWT_SECRET explicitly.');
    }
    return createHash('sha256').update(`hunter-jwt:${process.env.DATABASE_URL}`).digest('hex');
  }
  return 'hunter-system-local-dev-secret';
}

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
      };
    }
  }
}

interface JwtPayload {
  id: number;
  username: string;
}

/**
 * Middleware to verify JWT from HttpOnly cookie
 * Attach user info to request if valid
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    // Must match the secret used when signing tokens in routes/auth.ts
    const secret = jwtSecret();
    const verified = jwt.verify(token, secret) as JwtPayload;

    req.user = verified;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
}

/**
 * Optional auth - doesn't fail if no token
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token;

  if (!token) {
    return next();
  }

  try {
    const secret = jwtSecret();
    const verified = jwt.verify(token, secret) as JwtPayload;
    req.user = verified;
    next();
  } catch (error) {
    // Invalid token, continue without user
    next();
  }
}
