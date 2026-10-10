import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { referralStatus } from '../referrals.js';

const router = Router();
router.use(authenticateToken);

// GET /api/referrals/me — progress toward the next free month of Pro
router.get('/me', async (req: Request, res: Response) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json(await referralStatus(req.user!.id));
  } catch (error) {
    console.error('Referral status error:', error);
    res.status(500).json({ error: 'Failed to load referrals' });
  }
});

export default router;
