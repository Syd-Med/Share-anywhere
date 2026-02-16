'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface AuditLogEntry {
  id: string;
  adminEmail: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export default function AdminAuditPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, pages: 0 });
  const [actionFilter, setActionFilter] = useState('');
  const [targetTypeFilter, setTargetTypeFilter] = useState('');
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [error, setError] = useState('');

  const fetchLogs = useCallback(async (pageOverride?: number) => {
    if (!user) return;
    setLoadingLogs(true);
    const page = pageOverride ?? pagination.page;
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (actionFilter.trim()) params.set('action', actionFilter.trim());
      if (targetTypeFilter.trim()) params.set('targetType', targetTypeFilter.trim());
      const { data } = await api.get(`/api/admin/audit?${params}`);
      setLogs(data.logs);
      setPagination(data.pagination);
      setError('');
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to load audit log');
    } finally {
      setLoadingLogs(false);
    }
  }, [user, pagination.page, actionFilter, targetTypeFilter]);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handlePageChange = (newPage: number) => {
    setPagination((p) => ({ ...p, page: newPage }));
  };

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
        <h1 className="text-2xl font-bold">Audit log</h1>
        <p className="text-muted-foreground">Admin actions and changes</p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <Input
              placeholder="Filter by action..."
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setPagination((p) => ({ ...p, page: 1 })) && fetchLogs()}
              className="max-w-xs"
            />
            <Input
              placeholder="Filter by target type..."
              value={targetTypeFilter}
              onChange={(e) => setTargetTypeFilter(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setPagination((p) => ({ ...p, page: 1 })) && fetchLogs()}
              className="max-w-xs"
            />
            <Button onClick={() => { setPagination((p) => ({ ...p, page: 1 })); fetchLogs(1); }}>Apply</Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingLogs ? (
            <p className="text-muted-foreground py-8 text-center">Loading...</p>
          ) : logs.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">No audit events</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 font-medium">Time</th>
                      <th className="text-left py-3 px-2 font-medium">Admin</th>
                      <th className="text-left py-3 px-2 font-medium">Action</th>
                      <th className="text-left py-3 px-2 font-medium">Target</th>
                      <th className="text-left py-3 px-2 font-medium">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-2">{new Date(log.createdAt).toLocaleString()}</td>
                        <td className="py-3 px-2">{log.adminEmail ?? '—'}</td>
                        <td className="py-3 px-2">{log.action}</td>
                        <td className="py-3 px-2">{log.targetType}{log.targetId ? ` ${log.targetId}` : ''}</td>
                        <td className="py-3 px-2">{log.metadata ? JSON.stringify(log.metadata) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pagination.pages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.pages} ({pagination.total} total)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page <= 1}
                      onClick={() => handlePageChange(Math.max(1, pagination.page - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page >= pagination.pages}
                      onClick={() => handlePageChange(Math.min(pagination.pages, pagination.page + 1))}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
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
