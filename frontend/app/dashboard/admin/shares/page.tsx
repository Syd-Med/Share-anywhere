'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Ban } from 'lucide-react';

interface Share {
  id: string;
  token: string;
  userEmail: string | null;
  fileName: string | null;
  fileSize: number | null;
  permission: string;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
}

export default function AdminSharesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [shares, setShares] = useState<Share[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, pages: 0 });
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  const [revoking, setRevoking] = useState<string | null>(null);

  const fetchShares = useCallback(async () => {
    if (!user) return;
    setLoadingData(true);
    try {
      const params = new URLSearchParams({ page: String(pagination.page), limit: '25' });
      const { data } = await api.get(`/api/admin/shares?${params}`);
      setShares(data.shares);
      setPagination(data.pagination);
      setError('');
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed');
    } finally {
      setLoadingData(false);
    }
  }, [user, pagination.page]);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);
  useEffect(() => { fetchShares(); }, [fetchShares]);

  const handleRevoke = async (token: string) => {
    setRevoking(token);
    try {
      await api.patch(`/api/admin/shares/${token}/revoke`);
      fetchShares();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed');
    } finally {
      setRevoking(null);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  };

  if (loading || !user) return <div className="flex-1 flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Shares</h1><p className="text-muted-foreground">File share links</p></div>
      {error && <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</div>}
      <Card>
        <CardContent className="pt-6">
          {loadingData ? <p className="py-8 text-center text-muted-foreground">Loading...</p> : shares.length === 0 ? <p className="py-8 text-center text-muted-foreground">No shares</p> : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b"><th className="text-left py-3 px-2 font-medium">Token</th><th className="text-left py-3 px-2 font-medium">User</th><th className="text-left py-3 px-2 font-medium">File</th><th className="text-left py-3 px-2 font-medium">Status</th><th className="text-left py-3 px-2 font-medium">Expires</th><th className="text-left py-3 px-2 font-medium">Actions</th></tr></thead>
                  <tbody>
                    {shares.map((s) => (
                      <tr key={s.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-2 font-mono text-xs">{s.token.slice(0, 12)}...</td>
                        <td className="py-3 px-2">{s.userEmail ?? '-'}</td>
                        <td className="py-3 px-2">{s.fileName ?? '-'}{s.fileSize != null ? ' (' + formatBytes(s.fileSize) + ')' : ''}</td>
                        <td className="py-3 px-2">{s.revokedAt ? <Badge variant="destructive">Revoked</Badge> : <Badge variant="secondary">Active</Badge>}</td>
                        <td className="py-3 px-2">{new Date(s.expiresAt).toLocaleDateString()}</td>
                        <td className="py-3 px-2">{!s.revokedAt && <Button variant="ghost" size="sm" onClick={() => handleRevoke(s.token)} disabled={revoking === s.token}><Ban className="h-4 w-4" /></Button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pagination.pages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">Page {pagination.page} of {pagination.pages}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => setPagination((p) => ({ ...p, page: Math.max(1, p.page - 1) }))}><ChevronLeft className="h-4 w-4" /></Button>
                    <Button variant="outline" size="sm" disabled={pagination.page >= pagination.pages} onClick={() => setPagination((p) => ({ ...p, page: Math.min(pagination.pages, p.page + 1) }))}><ChevronRight className="h-4 w-4" /></Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
