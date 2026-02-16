'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { DashboardHeader } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { PLANS, formatStorage, type PlanDefinition } from '@/lib/plans';

interface ApiPlan {
  id: string;
  name: string;
  storageLimitBytes: number;
  priceId: string;
}

function mergePlans(apiPlans: ApiPlan[]): (PlanDefinition & { apiId?: string })[] {
  return PLANS.map((config) => {
    const match = apiPlans.find(
      (p) => p.priceId === config.priceId || p.name.toLowerCase() === config.name.toLowerCase()
    );
    return {
      ...config,
      storageLimitBytes: match?.storageLimitBytes ?? config.storageLimitBytes,
      apiId: match?.id,
    };
  });
}

export default function PricingPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [plans, setPlans] = useState<(PlanDefinition & { apiId?: string })[]>(PLANS);
  const [currentPlanName, setCurrentPlanName] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (user) {
      Promise.all([
        api.get<{ plans: ApiPlan[] }>('/api/billing/plans').catch(() => ({ data: { plans: [] } })),
        api.get<{ plan: { name: string } | null }>('/api/billing/subscription').catch(() => ({
          data: { plan: null },
        })),
      ])
        .then(([plansRes, subRes]) => {
          const apiPlans = plansRes.data?.plans ?? [];
          setPlans(apiPlans.length > 0 ? mergePlans(apiPlans) : PLANS);
          setCurrentPlanName(subRes.data?.plan?.name ?? 'Free');
        })
        .catch(() => {
          setPlans(PLANS);
          setCurrentPlanName('Free');
        });
    }
  }, [user]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <DashboardHeader userEmail={user.email} onLogout={logout} />
      <main className="flex-1 container max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Plans</h1>
          <p className="text-muted-foreground mt-1">
            Choose a plan that fits your storage needs. Payment options coming soon.
          </p>
        </div>
        <Button variant="link" className="mb-6 -ml-2" asChild>
          <Link href="/dashboard">← Back to dashboard</Link>
        </Button>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = currentPlanName?.toLowerCase() === plan.name.toLowerCase();
            return (
              <Card
                key={plan.id}
                className={`flex flex-col ${plan.highlighted ? 'border-primary shadow-lg' : ''}`}
              >
                <CardHeader>
                  {plan.highlighted && (
                    <span className="text-xs font-medium text-primary mb-1">Most popular</span>
                  )}
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>{formatStorage(plan.storageLimitBytes)} storage</CardDescription>
                  <div className="mt-2">
                    <span className="text-2xl font-bold">{plan.priceDisplay}</span>
                    {!plan.isFree && plan.priceDisplay === 'Coming soon' && (
                      <span className="text-sm text-muted-foreground font-normal"> / month</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-3">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={plan.highlighted && !plan.isFree ? 'default' : 'outline'}
                    disabled={plan.isFree || true}
                  >
                    {plan.isFree
                      ? isCurrent
                        ? 'Current plan'
                        : 'Free forever'
                      : 'Coming soon'}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
