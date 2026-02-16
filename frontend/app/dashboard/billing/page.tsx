'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function BillingContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [subscription, setSubscription] = useState<{
    plan: { id: string; name: string; storageLimitBytes: number } | null;
    storageUsed: number;
  } | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (user) {
      api.get('/api/billing/subscription').then((r) => setSubscription(r.data)).catch(console.error);
    }
  }, [user]);

  const success = searchParams.get('success');
  const canceled = searchParams.get('canceled');

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const { data } = await api.get<{ url: string }>('/api/billing/portal');
      if (data.url) window.location.href = data.url;
    } catch (err) {
      console.error(err);
    } finally {
      setPortalLoading(false);
    }
  };

  const formatBytes = (b: number) => {
    const gb = b / (1024 ** 3);
    return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(b / (1024 ** 2)).toFixed(0)} MB`;
  };

  if (loading || !user) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <main className="container max-w-xl mx-auto px-4 py-8">
      <Button variant="link" className="mb-6 -ml-2" asChild>
        <Link href="/dashboard">← Back to dashboard</Link>
      </Button>
      {success && (
        <div className="mb-6 rounded-lg bg-green-500/10 border border-green-500/20 px-4 py-3 text-green-700 dark:text-green-400">
          Subscription activated!
        </div>
      )}
      {canceled && (
        <div className="mb-6 rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-amber-700 dark:text-amber-400">
          Checkout canceled.
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Billing</CardTitle>
          <CardDescription>Manage your subscription and storage</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {subscription && (
            <>
              <div>
                <p className="text-sm font-medium">Plan</p>
                <p className="text-muted-foreground">{subscription.plan?.name ?? 'Free'}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Storage</p>
                <p className="text-muted-foreground">
                  {formatBytes(subscription.storageUsed)} used
                  {subscription.plan && ` / ${formatBytes(subscription.plan.storageLimitBytes)}`}
                </p>
              </div>
              <Button onClick={handlePortal} disabled={portalLoading}>
                {portalLoading ? 'Opening...' : 'Manage subscription'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
      <Button variant="link" className="mt-6" asChild>
        <Link href="/pricing">View plans</Link>
      </Button>
    </main>
  );
}

export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <BillingContent />
    </Suspense>
  );
}
