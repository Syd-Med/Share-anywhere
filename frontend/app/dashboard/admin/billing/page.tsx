'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PlanDistribution {
  planId: string;
  planName: string;
  subscriberCount: number;
}

interface BillingOverview {
  activeSubscriptions: number;
  planDistribution: PlanDistribution[];
  mrr: number | null;
  revenue: number | null;
}

export default function AdminBillingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<BillingOverview | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    api.get<BillingOverview>('/api/admin/billing/overview')
      .then((r) => setData(r.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load'));
  }, [user]);

  if (loading || !user) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Billing overview</h1>
        <p className="text-muted-foreground">Subscription and revenue summary</p>
      </div>
      {error && <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</div>}
      {data && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2"><p className="text-sm font-medium text-muted-foreground">Active subscriptions</p></CardHeader>
              <CardContent><p className="text-2xl font-bold">{data.activeSubscriptions}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><p className="text-sm font-medium text-muted-foreground">MRR</p></CardHeader>
              <CardContent><p className="text-2xl font-bold">{data.mrr != null ? '$' + data.mrr.toFixed(2) : '—'}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><p className="text-sm font-medium text-muted-foreground">Revenue</p></CardHeader>
              <CardContent><p className="text-2xl font-bold">{data.revenue != null ? '$' + data.revenue.toFixed(2) : '—'}</p></CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader><CardTitle>Plan distribution</CardTitle></CardHeader>
            <CardContent>
              {data.planDistribution.length === 0 ? (
                <p className="text-muted-foreground">No plans with subscribers</p>
              ) : (
                <div className="space-y-2">
                  {data.planDistribution.map((p) => (
                    <div key={p.planId} className="flex justify-between text-sm">
                      <span>{p.planName}</span>
                      <span>{p.subscriberCount} subscriber{p.subscriberCount !== 1 ? 's' : ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
