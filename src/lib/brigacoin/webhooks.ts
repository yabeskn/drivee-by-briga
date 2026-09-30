// ─────────────────────────────────────────────────────────────
// brigacoin/webhooks.ts — Outbox & HMAC Signature Verification
//
// Secures webhook communication between Drifee and briga.id
// using HMAC SHA-256 signatures with header `X-Briga-Signature`.
// ─────────────────────────────────────────────────────────────

import crypto from 'crypto';

export interface WebhookEventPayload {
  eventId: string;
  eventType: 'brigacoin.earned' | 'brigacoin.spent' | 'redemption.completed';
  timestamp: string;
  actor: 'drifee' | 'briga' | 'system' | 'admin';
  data: Record<string, unknown>;
}

export function generateWebhookSignature(body: string, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(body);
  return `sha256=${hmac.digest('hex')}`;
}

export function verifyWebhookSignature(body: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false;
  const expectedSignature = generateWebhookSignature(body, secret);

  if (signature.length !== expectedSignature.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'utf-8'),
      Buffer.from(expectedSignature, 'utf-8')
    );
  } catch {
    return false;
  }
}

export async function dispatchWebhookEvent(
  eventType: WebhookEventPayload['eventType'],
  data: Record<string, unknown>,
  actor: WebhookEventPayload['actor'] = 'drifee',
  targetUrl?: string,
  secret?: string,
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const url = targetUrl || process.env.BRIGA_WEBHOOK_URL;
  const webhookSecret = secret || process.env.WEBHOOK_SECRET;

  if (!url || !webhookSecret) {
    // If webhook destination is not configured, safely return without throwing
    return { success: true, error: 'WEBHOOK_NOT_CONFIGURED' };
  }

  const payload: WebhookEventPayload = {
    eventId: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    eventType,
    timestamp: new Date().toISOString(),
    actor,
    data,
  };

  const body = JSON.stringify(payload);
  const signature = generateWebhookSignature(body, webhookSecret);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Briga-Signature': signature,
        'X-Briga-Event': eventType,
        'X-Briga-Event-Id': payload.eventId,
      },
      body,
    });

    return {
      success: res.ok,
      statusCode: res.status,
    };
  } catch (err) {
    console.warn(`[Webhook] Failed to dispatch ${eventType}:`, err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown webhook dispatch error',
    };
  }
}
