'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface Health {
  mongo: boolean;
  redis: boolean;
  s3: boolean;
  ok: boolean;
}

interface Jobs {
  thumbnail: { waiting: number; active: number; completed: number; failed: number };
}

export default function AdminSystemPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [health, setHealth] = useState<Health | null>(null);
  const [jobs, setJobs] = useState<Jobs | null>(null);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [configKey, setConfigKey] = useState('');
  const [configValue, setConfigValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      api.get<Health>('/api/admin/health').then((r) => setHealth(r.data)).catch(() => setHealth({ mongo: false, redis: false, s3: false, ok: false })),
      api.get<Jobs>('/api/admin/jobs').then((r) => setJobs(r.data)).catch(() => setJobs(null)),
      api.get<{ config: Record<string, string> }>('/api/admin/config').then((r) => { setConfig(r.data.config || {}); }).catch(() => {}),
    ]);
  }, [user]);

  const handleSaveConfig = async () => {
    if (!configKey.trim()) return;
    setSaving(true);
    try {
      await api.patch('/api/admin/config', { key: configKey.trim(), value: configValue });
      setConfig((c) => ({ ...c, [configKey.trim()]: configValue }));
      setConfigKey('');
      setConfigValue('');
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const setMaintenance = async (value: boolean) => {
    setSaving(true);
    try {
      await api.patch('/api/admin/config', { key: 'maintenanceMode', value: value ? 'true' : 'false' });
      setConfig((c) => ({ ...c, maintenanceMode: value ? 'true' : 'false' }));
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) return <div className="flex-1 flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;

  const maintenanceOn = config.maintenanceMode === 'true';

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">System</h1><p className="text-muted-foreground">Health, config, and maintenance</p></div>
      {error && <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</div>}

      <Card>
        <CardHeader><CardTitle>Health status</CardTitle></CardHeader>
        <CardContent>
          {health ? (
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                {health.mongo ? <CheckCircle className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-destructive" />}
                <span>MongoDB</span>
              </div>
              <div className="flex items-center gap-2">
                {health.redis ? <CheckCircle className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-destructive" />}
                <span>Redis</span>
              </div>
              <div className="flex items-center gap-2">
                {health.s3 ? <CheckCircle className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-destructive" />}
                <span>S3</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /><span>Checking...</span></div>
          )}
        </CardContent>
      </Card>

      {jobs && (
        <Card>
          <CardHeader><CardTitle>Queue status</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm">Thumbnail: waiting {jobs.thumbnail.waiting}, active {jobs.thumbnail.active}, completed {jobs.thumbnail.completed}, failed {jobs.thumbnail.failed}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Maintenance mode</CardTitle>
          <p className="text-sm text-muted-foreground">When enabled, non-admin users may be blocked from access</p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Badge variant={maintenanceOn ? 'destructive' : 'secondary'}>{maintenanceOn ? 'ON' : 'OFF'}</Badge>
            <Button variant="outline" size="sm" onClick={() => setMaintenance(!maintenanceOn)} disabled={saving}>
              {maintenanceOn ? 'Disable' : 'Enable'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Config / Feature flags</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {Object.keys(config).length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Current keys</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(config).map(([k, v]) => (
                  <Badge key={k} variant="outline">{k}: {v}</Badge>
                ))}
              </div>
            </div>
          )}
          <div className="grid gap-2 max-w-md">
            <Label>Add or update key</Label>
            <div className="flex gap-2">
              <Input placeholder="key" value={configKey} onChange={(e) => setConfigKey(e.target.value)} />
              <Input placeholder="value" value={configValue} onChange={(e) => setConfigValue(e.target.value)} />
            </div>
            <Button onClick={handleSaveConfig} disabled={saving || !configKey.trim()}>Save</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
