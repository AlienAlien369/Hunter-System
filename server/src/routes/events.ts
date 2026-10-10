import { Router, Request, Response } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { hit } from '../middleware/security.js';
import { detectRegion } from '../region.js';
import { isClientEvent, sanitizeProps, track } from '../analytics.js';

// POST /api/events { name, props? } — page-level events from the browser.
// Anonymous by default (no id of any kind); linked to the hunter only when
// they are signed in. Honors Do Not Track and Global Privacy Control.
// The client cannot report upgrades — those come from the payment webhook.
const router = Router();

export const optedOut = (req: Request) => req.headers['dnt'] === '1' || req.headers['sec-gpc'] === '1';

router.post('/', optionalAuth, async (req: Request, res: Response) => {
  if (optedOut(req)) return res.status(204).end();
  // The IP is used only as an in-memory rate-limit key; it is never stored.
  if (hit(`events:${req.ip}`, 60, 60_000)) return res.status(429).json({ error: 'Too many requests' });
  if (!isClientEvent(req.body?.name)) return res.status(400).json({ error: 'Unknown event' });
  await track(req.user?.id ?? null, req.body.name, detectRegion(req), sanitizeProps(req.body.props));
  res.status(204).end();
});

export default router;
