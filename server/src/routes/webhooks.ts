import { Router, Request, Response } from 'express';
import { applyProviderEvent } from '../billing.js';
import { getProvider } from '../payments/index.js';
import { WebhookSignatureError } from '../payments/types.js';
import type { Provider } from '../pricing.js';

// Payment-provider webhooks: the only way a subscription changes. Signed raw
// bodies are verified before anything is parsed; deliveries are idempotent.
const router = Router();

router.post('/:provider', async (req: Request, res: Response) => {
  const name = req.params.provider as Provider;
  if (name !== 'stripe' && name !== 'razorpay') return res.status(404).end();
  const provider = getProvider(name);
  // 503 (not 200): until configured we cannot verify, so the provider should keep retrying.
  if (!provider) return res.status(503).json({ error: 'not configured' });
  const raw: Buffer | undefined = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!raw) return res.status(400).json({ error: 'no body' });
  try {
    const { event, payload } = provider.parseWebhook(raw, req.headers);
    const result = await applyProviderEvent(event, payload);
    res.json({ received: true, result });
  } catch (error) {
    if (error instanceof WebhookSignatureError) return res.status(400).json({ error: 'invalid signature' });
    console.error(`Webhook ${name} error:`, error);
    res.status(500).json({ error: 'processing failed' }); // the provider retries
  }
});

export default router;
