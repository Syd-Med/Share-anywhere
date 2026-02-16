import { Router, Request, Response } from 'express';
import type Stripe from 'stripe';
import { authMiddleware, AuthRequest } from '../middlewares/auth';
import { User } from '../models/User';
import { Plan } from '../models/Plan';
import { createCheckoutSession, constructWebhookEvent, stripe } from '../services/stripe';

const router = Router();

router.get('/plans', async (_req, res, next) => {
  try {
    const plans = await Plan.find().lean();
    res.json({
      plans: plans.map((p) => ({
        id: p._id,
        name: p.name,
        storageLimitBytes: p.storageLimitBytes,
        priceId: p.stripePriceId,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/create-checkout', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const { priceId } = req.body;

    if (!priceId || typeof priceId !== 'string') {
      return res.status(400).json({ message: 'priceId required' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(401).json({ message: 'User not found' });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const session = await createCheckoutSession(
      user.stripeCustomerId || null,
      priceId,
      userId,
      user.email,
      `${frontendUrl}/dashboard/billing?success=1`,
      `${frontendUrl}/dashboard/billing?canceled=1`
    );

    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
});

router.get('/portal', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const user = await User.findById(userId);
    if (!user || !user.stripeCustomerId) {
      return res.status(400).json({ message: 'No billing account' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/billing`,
    });

    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
});

router.get('/subscription', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const user = await User.findById(userId).populate('planId').lean();
    if (!user) return res.status(401).json({ message: 'User not found' });

    const plan = user.planId as unknown as { _id: string; name: string; storageLimitBytes: number } | null;
    res.json({
      plan: plan ? { id: plan._id, name: plan.name, storageLimitBytes: plan.storageLimitBytes } : null,
      storageUsed: user.storageUsed || 0,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  if (!sig) return res.status(400).send('No signature');

  const payload = (req as { rawBody?: Buffer }).rawBody || req.body;
  if (!payload) return res.status(400).send('No body');

  let event;
  try {
    event = constructWebhookEvent(payload, sig as string);
  } catch (err) {
    console.error('Webhook signature verification failed', err);
    return res.status(400).send('Invalid signature');
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id || (session as { metadata?: { userId?: string } }).metadata?.userId;
        if (userId && session.customer) {
          await User.findByIdAndUpdate(userId, {
            stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer.id,
          });
        }
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          const subUserId = sub.metadata?.userId || userId;
          const priceId = sub.items.data[0]?.price?.id;
          if (priceId && subUserId) {
            const plan = await Plan.findOne({ stripePriceId: priceId });
            if (plan) {
              await User.findByIdAndUpdate(subUserId, { planId: plan._id });
            }
          }
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (!userId) break;
        const priceId = sub.items.data[0]?.price?.id;
        if (priceId) {
          const plan = await Plan.findOne({ stripePriceId: priceId });
          if (plan) {
            await User.findByIdAndUpdate(userId, { planId: plan._id });
          }
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (userId) {
          await User.findByIdAndUpdate(userId, { $unset: { planId: 1 } });
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error('Webhook handler error', err);
    return res.status(500).send('Webhook handler failed');
  }

  res.json({ received: true });
});

export default router;
