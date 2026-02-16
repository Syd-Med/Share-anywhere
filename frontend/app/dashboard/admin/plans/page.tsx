'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  stripePriceId: string;
  storageLimitBytes: number;
  checkoutUrl?: string | null;
  createdAt: string;
  subscriberCount: number;
}

const DEFAULT_STORAGE_GB = 5;

export default function AdminPlansPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState('');
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', storageLimitBytes: DEFAULT_STORAGE_GB * 1024 ** 3, stripePriceId: '', checkoutUrl: '' });
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Plan | null>(null);

  const fetchPlans = () => {
    if (!user) return;
    setLoadingPlans(true);
    api
      .get<{ plans: Plan[] }>('/api/admin/plans')
      .then((r) => { setPlans(r.data.plans); setError(''); })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load plans'))
      .finally(() => setLoadingPlans(false));
  };

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  useEffect(() => {
    fetchPlans();
  }, [user]);

  const openCreate = () => {
    setCreating(true);
    setForm({ name: '', storageLimitBytes: DEFAULT_STORAGE_GB * 1024 ** 3, stripePriceId: '', checkoutUrl: '' });
  };

  const openEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setForm({
      name: plan.name,
      storageLimitBytes: plan.storageLimitBytes,
      stripePriceId: plan.stripePriceId,
      checkoutUrl: plan.checkoutUrl || '',
    });
  };

  const handleCreate = async () => {
    setSubmitting(true);
    try {
      await api.post('/api/admin/plans', {
        name: form.name.trim(),
        storageLimitBytes: form.storageLimitBytes,
        stripePriceId: form.stripePriceId.trim(),
        checkoutUrl: form.checkoutUrl.trim() || undefined,
      });
      setCreating(false);
      fetchPlans();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create plan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingPlan) return;
    setSubmitting(true);
    try {
      await api.patch(`/api/admin/plans/${editingPlan.id}`, {
        name: form.name.trim(),
        storageLimitBytes: form.storageLimitBytes,
        stripePriceId: form.stripePriceId.trim(),
        checkoutUrl: form.checkoutUrl.trim() || undefined,
      });
      setEditingPlan(null);
      fetchPlans();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to update plan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setSubmitting(true);
    try {
      await api.delete(`/api/admin/plans/${deleteConfirm.id}`);
      setDeleteConfirm(null);
      fetchPlans();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to delete plan');
    } finally {
      setSubmitting(false);
    }
  };

  const formatBytes = (bytes: number) => {
    const gb = bytes / 1024 / 1024 / 1024;
    return `${gb} GB`;
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Plans</h1>
          <p className="text-muted-foreground">Manage storage plans and Stripe integration</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Create plan
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All plans</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingPlans ? (
            <p className="text-muted-foreground py-8 text-center">Loading...</p>
          ) : plans.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">No plans yet. Create one to get started.</p>
          ) : (
            <div className="space-y-4">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div>
                    <p className="font-medium">{plan.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatBytes(plan.storageLimitBytes)} • Stripe: {plan.stripePriceId}
                      {plan.checkoutUrl && ` • Checkout: ${plan.checkoutUrl}`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {plan.subscriberCount} subscriber{plan.subscriberCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(plan)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteConfirm(plan)}
                      disabled={plan.subscriberCount > 0}
                      title={plan.subscriberCount > 0 ? 'Cannot delete plan with subscribers' : 'Delete plan'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create plan</DialogTitle>
            <DialogDescription>Add a new storage plan</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="create-name">Name</Label>
              <Input
                id="create-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Pro"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-storage">Storage (GB)</Label>
              <Input
                id="create-storage"
                type="number"
                min={1}
                value={form.storageLimitBytes / 1024 / 1024 / 1024}
                onChange={(e) => setForm((f) => ({ ...f, storageLimitBytes: parseInt(e.target.value || '0', 10) * 1024 ** 3 }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-stripe">Stripe Price ID</Label>
              <Input
                id="create-stripe"
                value={form.stripePriceId}
                onChange={(e) => setForm((f) => ({ ...f, stripePriceId: e.target.value }))}
                placeholder="price_xxx"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-checkout">Checkout URL (optional)</Label>
              <Input
                id="create-checkout"
                value={form.checkoutUrl}
                onChange={(e) => setForm((f) => ({ ...f, checkoutUrl: e.target.value }))}
                placeholder="https://..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={submitting || !form.name.trim() || !form.stripePriceId.trim()}>
              {submitting ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingPlan} onOpenChange={(open) => !open && setEditingPlan(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit plan</DialogTitle>
            <DialogDescription>Update {editingPlan?.name}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-storage">Storage (GB)</Label>
              <Input
                id="edit-storage"
                type="number"
                min={1}
                value={form.storageLimitBytes / 1024 / 1024 / 1024}
                onChange={(e) => setForm((f) => ({ ...f, storageLimitBytes: parseInt(e.target.value || '0', 10) * 1024 ** 3 }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-stripe">Stripe Price ID</Label>
              <Input
                id="edit-stripe"
                value={form.stripePriceId}
                onChange={(e) => setForm((f) => ({ ...f, stripePriceId: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-checkout">Checkout URL (optional)</Label>
              <Input
                id="edit-checkout"
                value={form.checkoutUrl}
                onChange={(e) => setForm((f) => ({ ...f, checkoutUrl: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPlan(null)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={submitting || !form.name.trim() || !form.stripePriceId.trim()}>
              {submitting ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete plan</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteConfirm?.name}&quot;? This cannot be undone.
              {deleteConfirm && deleteConfirm.subscriberCount > 0 && ' Cannot delete: plan has active subscribers.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={submitting || (deleteConfirm?.subscriberCount ?? 0) > 0}>
              {submitting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
