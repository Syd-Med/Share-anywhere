/**
 * Seed plans - run manually: npx tsx src/scripts/seedPlans.ts
 * Replace stripePriceId with your actual Stripe Price IDs.
 */
import mongoose from 'mongoose';
import { Plan } from '../models/Plan';

const plans = [
  { name: 'Free', stripePriceId: 'price_free', storageLimitBytes: 5 * 1024 * 1024 * 1024 },
  { name: 'Pro', stripePriceId: 'price_xxx', storageLimitBytes: 50 * 1024 * 1024 * 1024 },
  { name: 'Business', stripePriceId: 'price_yyy', storageLimitBytes: 500 * 1024 * 1024 * 1024 },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/share-anywhere');
  for (const p of plans) {
    await Plan.findOneAndUpdate(
      { stripePriceId: p.stripePriceId },
      { $set: p },
      { upsert: true }
    );
  }
  console.log('Plans seeded');
  process.exit(0);
}

seed().catch(console.error);
