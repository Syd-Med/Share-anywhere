/**
 * Plan definitions for Share Anywhere.
 * Storage limits and IDs align with backend Plan model.
 * Payment integration (Stripe) will be added later.
 */

export interface PlanDefinition {
  id: string;
  name: string;
  storageLimitBytes: number;
  priceId: string;
  isFree: boolean;
  priceDisplay: string;
  features: string[];
  highlighted?: boolean;
}

export const PLANS: PlanDefinition[] = [
  {
    id: 'free',
    name: 'Free',
    storageLimitBytes: 5 * 1024 ** 3, // 5 GB
    priceId: 'price_free',
    isFree: true,
    priceDisplay: '$0',
    features: [
      '5 GB storage',
      'Unlimited file shares',
      'Folder sharing',
      'File request links',
      'End-to-end encryption',
      'API access',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    storageLimitBytes: 50 * 1024 ** 3, // 50 GB
    priceId: 'price_pro',
    isFree: false,
    priceDisplay: 'Coming soon',
    features: [
      '50 GB storage',
      'Everything in Free',
      'Priority support',
      'Advanced sharing options',
    ],
    highlighted: true,
  },
  {
    id: 'business',
    name: 'Business',
    storageLimitBytes: 500 * 1024 ** 3, // 500 GB
    priceId: 'price_business',
    isFree: false,
    priceDisplay: 'Coming soon',
    features: [
      '500 GB storage',
      'Everything in Pro',
      'Team collaboration',
      'Admin controls',
      'Audit logs',
    ],
  },
];

export function formatStorage(bytes: number): string {
  const gb = bytes / 1024 ** 3;
  return gb >= 1 ? `${gb} GB` : `${Math.round(bytes / 1024 ** 2)} MB`;
}
