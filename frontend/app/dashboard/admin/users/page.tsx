'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Search, ChevronLeft, ChevronRight, Shield, User, CreditCard, Ban, Trash2 } from 'lucide-react';

interface AdminUser {
  id: string;
  email: string;
  storageUsed: number;
  createdAt: string;
  isAdmin: boolean;
  disabledAt: string | null;
  planId: string | null;
  planName: string | null;
  storageLimitBytes: number;
  fileCount: number;
}

interface Plan {
  id: string;
  name: string;
  storageLimitBytes: number;
  stripePriceId: string;
  subscriberCount: number;
}

export default function AdminUsersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, pages: 0 });
  const [error, setError] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [actionUser, setActionUser] = useState<AdminUser | null>(null);
  const [changePlanId, setChangePlanId] = useState<string | null>(null);
  const [viewUser, setViewUser] = useState<AdminUser | null>(null);
  const [disableUser, setDisableUser] = useState<AdminUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null);
  const [viewDetail, setViewDetail] = useState<{ fileCount: number; apiKeyCount: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = useCallback(async () => {
    if (!user) return;
    setLoadingUsers(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (search.trim()) params.set('search', search.trim());
      if (planFilter) params.set('planId', planFilter);
      const { data } = await api.get(`/api/admin/users?${params}`);
      setUsers(data.users);
      setPagination(data.pagination);
      setError('');
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  }, [user, page, search, planFilter]);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (!user) return;
    api
      .get<{ plans: Plan[] }>('/api/admin/plans')
      .then((r) => setPlans(r.data.plans))
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!viewUser) { setViewDetail(null); return; }
    api.get(`/api/admin/users/${viewUser.id}`).then((r) => setViewDetail(r.data)).catch(() => setViewDetail(null));
  }, [viewUser]);

  const handleChangePlan = async () => {
    if (!actionUser) return;
    setSubmitting(true);
    try {
      await api.patch(`/api/admin/users/${actionUser.id}/plan`, { planId: changePlanId || null });
      setActionUser(null);
      setChangePlanId(null);
      fetchUsers();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to update plan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisable = async () => {
    if (!disableUser) return;
    setSubmitting(true);
    try {
      await api.patch(`/api/admin/users/${disableUser.id}/disable`, { disabled: !disableUser.disabledAt });
      setDisableUser(null);
      fetchUsers();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    setSubmitting(true);
    try {
      await api.delete(`/api/admin/users/${deleteUser.id}`);
      setDeleteUser(null);
      fetchUsers();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleAdmin = async (targetUser: AdminUser) => {
    if (!targetUser) return;
    try {
      await api.patch(`/api/admin/users/${targetUser.id}/admin`, { isAdmin: !targetUser.isAdmin });
      fetchUsers();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to update admin status');
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
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
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-muted-foreground">Manage users, plans, and admin status</p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setPage(1) && fetchUsers()}
                className="pl-9"
              />
            </div>
            <select
              value={planFilter}
              onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">All plans</option>
              <option value="none">No plan</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <Button onClick={() => { setPage(1); fetchUsers(); }}>Search</Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingUsers ? (
            <p className="text-muted-foreground py-8 text-center">Loading...</p>
          ) : users.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">No users found</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 font-medium">Email</th>
                      <th className="text-left py-3 px-2 font-medium">Plan</th>
                      <th className="text-left py-3 px-2 font-medium">Storage</th>
                      <th className="text-left py-3 px-2 font-medium">Files</th>
                      <th className="text-left py-3 px-2 font-medium">Admin</th>
                      <th className="text-left py-3 px-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-2">
                          {u.email}
                          {u.disabledAt && <Badge variant="destructive" className="ml-1">Disabled</Badge>}
                        </td>
                        <td className="py-3 px-2">{u.planName ?? '—'}</td>
                        <td className="py-3 px-2">{formatBytes(u.storageUsed)} / {formatBytes(u.storageLimitBytes)}</td>
                        <td className="py-3 px-2">{u.fileCount}</td>
                        <td className="py-3 px-2">
                          {u.isAdmin ? <Badge variant="secondary"><Shield className="h-3 w-3 inline mr-1" /> Admin</Badge> : '—'}
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setViewUser(u)} title="View">
                              <User className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setActionUser(u); setChangePlanId(u.planId); }}
                              title="Change plan"
                            >
                              <CreditCard className="h-4 w-4" />
                            </Button>
                            {u.id !== user.id && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDisableUser(u)}
                                  title={u.disabledAt ? 'Re-enable' : 'Disable'}
                                >
                                  <Ban className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleToggleAdmin(u)}
                                  title={u.isAdmin ? 'Remove admin' : 'Make admin'}
                                >
                                  <Shield className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive"
                                  onClick={() => setDeleteUser(u)}
                                  title="Delete user"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
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
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page >= pagination.pages}
                      onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
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

      <Dialog open={!!viewUser} onOpenChange={(open) => !open && setViewUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>User detail</DialogTitle>
            <DialogDescription>{viewUser?.email}</DialogDescription>
          </DialogHeader>
          {viewUser && (
            <div className="space-y-2 text-sm">
              <p><span className="font-medium">Plan:</span> {viewUser.planName ?? 'None'}</p>
              <p><span className="font-medium">Storage:</span> {formatBytes(viewUser.storageUsed)} / {formatBytes(viewUser.storageLimitBytes)}</p>
              {viewDetail && (
                <>
                  <p><span className="font-medium">Files:</span> {viewDetail.fileCount}</p>
                  <p><span className="font-medium">API keys:</span> {viewDetail.apiKeyCount}</p>
                </>
              )}
              <p><span className="font-medium">Admin:</span> {viewUser.isAdmin ? 'Yes' : 'No'}</p>
              <p><span className="font-medium">Joined:</span> {new Date(viewUser.createdAt).toLocaleDateString()}</p>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setViewUser(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!disableUser} onOpenChange={(open) => !open && setDisableUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{disableUser?.disabledAt ? 'Re-enable user' : 'Disable user'}</DialogTitle>
            <DialogDescription>
              {disableUser?.disabledAt
                ? `Re-enable ${disableUser.email}? They will be able to log in again.`
                : `Disable ${disableUser?.email}? They will not be able to log in until re-enabled.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisableUser(null)}>Cancel</Button>
            <Button onClick={handleDisable} disabled={submitting}>
              {submitting ? 'Saving...' : disableUser?.disabledAt ? 'Re-enable' : 'Disable'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteUser} onOpenChange={(open) => !open && setDeleteUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete user</DialogTitle>
            <DialogDescription>
              Permanently delete {deleteUser?.email}? This will remove all files, shares, and API keys. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUser(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={submitting}>
              {submitting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!actionUser} onOpenChange={(open) => !open && setActionUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change plan</DialogTitle>
            <DialogDescription>
              Assign a plan to {actionUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <select
              value={changePlanId ?? ''}
              onChange={(e) => setChangePlanId(e.target.value || null)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">No plan</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionUser(null)}>Cancel</Button>
            <Button onClick={handleChangePlan} disabled={submitting}>
              {submitting ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
