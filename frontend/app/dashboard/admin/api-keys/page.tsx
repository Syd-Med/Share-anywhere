'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';

interface ApiKeyRow {
  id: string;
  name: string;
  keyPrefix: string;
  userEmail: string | null;
  scopes: string[];
  lastUsedAt: string | null;
  createdAt: string;
}

export default function AdminApiKeysPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, pages: 0 });
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  const [revoking, setRevoking] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoadingData(true);
    try {
      const params = new URLSearchParams({ page: String(pagination.page), limit: '25' });
      const { data } = await api.get(`/api/admin/api-keys?${params}`);
      setKeys(data.apiKeys);
      setPagination(data.pagination);
      setError('');
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to load');
    } finally {
      setLoadingData(false);
    }
  }, [user, pagination.page]);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRevoke = async (id: string) => {
    setRevoking(id);
    try {
      await api.delete(`/api/admin/api-keys/${id}`);
      fetchData();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to revoke');
    } finally {
      setRevoking(null);
    }
  };

  if (loading || !user) return <div className="flex-1 flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">API keys</h1><p className="text-muted-foreground">All API keys across users</p></div>
      {error && <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</div>}
      <Card>
        <CardContent className="pt-6">
          {loadingData ? <p className="py-8 text-center text-muted-foreground">Loading...</p> :
          keys.length === 0 ? <p className="py-8 text-center text-muted-foreground">No API keys</p> : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Name</th>
                    <th className="text-left py-3 px-2 font-medium">Prefix</th>
                    <th className="text-left py-3 px-2 font-medium">User</th>
                    <th className="text-left py-3 px-2 font-medium">Scopes</th>
                    <th className="text-left py-3 px-2 font-medium">Last used</th>
                    <th className="text-left py-3 px-2 font-medium">Actions</th>
                  </tr></thead>
                  <tbody>
                    {keys.map((k) => (
                      <tr key={k.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-2">{k.name}</td>
                        <td className="py-3 px-2 font-mono text-xs">{k.keyPrefix}...</td>
                        <td className="py-3 px-2">{k.userEmail ?? '—'}</td>
                        <td className="py-3 px-2">{k.scopes?.join(', ') ?? '—'}</td>
                        <td className="py-3 px-2">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'Never'}</td>
                        <td className="py-3 px-2">
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleRevoke(k.id)} disabled={revoking === k.id}>
                            <Trash2 className="h-4 w-4" aria-label="Revoke" />
                          </Button>
                        </td>
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
