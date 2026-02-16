'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<{
    userCount: number;
    fileCount: number;
    shareCount: number;
    fileRequestsCount?: number;
    folderSharesCount?: number;
    storageTotalUsed?: number;
    storageByPlan?: { planId: string | null; planName: string | null; storageBytes: number }[];
    recentSignups?: { email: string; createdAt: string }[];
  } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (user) {
      api
        .get('/api/admin/stats')
        .then((r) => setStats(r.data))
        .catch((err) => setError(err.response?.data?.message || 'Access denied'));
    }
  }, [user]);

  if (loading || !user) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <main className="container max-w-xl mx-auto px-4 py-8">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error}</p>
            <Button variant="link" className="mt-4 -ml-2" asChild>
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">Overview of your Share Anywhere instance</p>
      </div>
      {stats && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <p className="text-sm font-medium text-muted-foreground">Users</p>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.userCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <p className="text-sm font-medium text-muted-foreground">Files</p>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.fileCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <p className="text-sm font-medium text-muted-foreground">File shares</p>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.shareCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <p className="text-sm font-medium text-muted-foreground">Total storage</p>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {stats.storageTotalUsed != null
                    ? (stats.storageTotalUsed / 1024 / 1024 / 1024).toFixed(2) + ' GB'
                    : '—'}
                </p>
              </CardContent>
            </Card>
          </div>
          {(stats.fileRequestsCount != null || stats.folderSharesCount != null) && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <p className="text-sm font-medium text-muted-foreground">File requests</p>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{stats.fileRequestsCount ?? 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <p className="text-sm font-medium text-muted-foreground">Folder shares</p>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{stats.folderSharesCount ?? 0}</p>
                </CardContent>
              </Card>
            </div>
          )}
          {stats.storageByPlan && stats.storageByPlan.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Storage by plan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stats.storageByPlan.map((s) => (
                    <div key={s.planId ?? 'none'} className="flex justify-between text-sm">
                      <span>{s.planName ?? 'No plan'}</span>
                      <span>{(s.storageBytes / 1024 / 1024 / 1024).toFixed(2)} GB</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {stats.recentSignups && stats.recentSignups.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent signups</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {stats.recentSignups.map((u) => (
                    <li key={u.email} className="flex justify-between">
                      <span>{u.email}</span>
                      <span className="text-muted-foreground">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </main>
  );
}
