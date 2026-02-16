import Stripe from 'stripe';
import { config } from '../config';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2023-10-16',
});

export async function createCheckoutSession(
  customerId: string | null,
  priceId: string,
  userId: string,
  email: string,
  successUrl: string,
  cancelUrl: string
): Promise<Stripe.Checkout.Session> {
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: userId,
    customer_email: customerId ? undefined : email,
    customer: customerId || undefined,
    subscription_data: {
      metadata: { userId },
    },
  };
  return stripe.checkout.sessions.create(params);
}

export function constructWebhookEvent(payload: string | Buffer, signature: string): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET not set');
  return stripe.webhooks.constructEvent(payload, signature, secret);
}
