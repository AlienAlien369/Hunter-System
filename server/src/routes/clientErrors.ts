import { Router, Request, Response } from 'express';
import { hit } from '../middleware/security.js';

// Client crash reports → server logs (visible in Render). No auth required so
// crashes on the login page are captured too; rate-limited per network and
// size-capped, and only technical fields are kept (no user content).
const router = Router();

const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : undefined);

// POST /api/client-errors { message, stack?, componentStack?, url?, kind? }
router.post('/', (req: Request, res: Response) => {
  if (hit(`client-error:${req.ip}`, 20, 10 * 60_000)) return res.status(429).end();
  const message = clip(req.body?.message, 500);
  if (!message) return res.status(400).end();
  console.error('[client-error]', JSON.stringify({
    kind: clip(req.body.kind, 20) ?? 'error',
    message,
    url: clip(req.body.url, 300),
    stack: clip(req.body.stack, 2000),
    componentStack: clip(req.body.componentStack, 1500),
    userAgent: clip(req.headers['user-agent'], 200),
  }));
  res.status(204).end();
});

export default router;
