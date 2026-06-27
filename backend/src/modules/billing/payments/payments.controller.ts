import { Request, Response, NextFunction } from 'express';
import { validatePaymongoSignature, processPaymentPaid } from './payments.service';

/**
 * POST /api/v1/billing/webhooks/paymongo
 *
 * PayMongo sends a raw JSON body. Express must NOT parse it before this handler
 * so we can validate the HMAC signature against the raw bytes.
 *
 * The route must be registered with express.raw() middleware, NOT express.json().
 */
export async function paymongoWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawBody = (req as Request & { rawBody?: string }).rawBody ?? req.body?.toString() ?? '';
    const signatureHeader = req.headers['paymongo-signature'] as string | undefined;

    // 1. Validate signature — rejects forged requests
    validatePaymongoSignature(rawBody, signatureHeader);

    // 2. Parse event
    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const eventType: string = event?.data?.attributes?.type ?? event?.type ?? '';

    // 3. Route to correct handler
    if (eventType === 'payment.paid') {
      const result = await processPaymentPaid(event.data);
      res.json({ received: true, alreadyProcessed: result.alreadyProcessed });
      return;
    }

    // Acknowledge all other events without processing (prevents PayMongo retries)
    res.json({ received: true });
  } catch (err) {
    next(err);
  }
}
