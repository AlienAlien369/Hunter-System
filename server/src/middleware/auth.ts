import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

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
    const secret = process.env.JWT_SECRET || 'hunter-system-secret-key-2024';
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
    const secret = process.env.JWT_SECRET || 'hunter-system-secret-key-2024';
    const verified = jwt.verify(token, secret) as JwtPayload;
    req.user = verified;
    next();
  } catch (error) {
    // Invalid token, continue without user
    next();
  }
}
