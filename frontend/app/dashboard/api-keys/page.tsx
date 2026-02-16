'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Key, Copy, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface ApiKeyRow {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  rateLimit: number;
  lastUsedAt: string | null;
  createdAt: string;
}

export default function APIKeysPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (user) {
      api.get<{ keys: ApiKeyRow[] }>('/api/api-keys').then((r) => setKeys(r.data.keys)).catch(console.error);
    }
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const { data } = await api.post<{ key: string; name: string; id?: string }>('/api/api-keys', {
        name: newName.trim(),
      });
      setCreatedKey(data.key);
      setNewName('');
      api.get<{ keys: ApiKeyRow[] }>('/api/api-keys').then((r) => setKeys(r.data.keys));
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/api-keys/${id}`);
      setKeys((k) => k.filter((x) => x.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const copyKey = () => {
    if (createdKey) navigator.clipboard.writeText(createdKey);
  };

  const apiBase = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? window.location.origin : '');

  if (loading || !user) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <main className="container max-w-2xl mx-auto px-4 py-8">
      <Button variant="link" className="mb-6 -ml-2" asChild>
        <Link href="/dashboard">← Back to dashboard</Link>
      </Button>
      {createdKey && (
        <Card className="mb-6 border-green-500/50 bg-green-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">New key created</CardTitle>
            <CardDescription>
              Save this key now — it won&apos;t be shown again!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <code className="block break-all text-sm bg-muted px-3 py-2 rounded">{createdKey}</code>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={copyKey}>
                <Copy className="h-4 w-4 mr-1" />
                Copy
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setCreatedKey(null)}>
                Done
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Keys
          </CardTitle>
          <CardDescription>Create keys to access the API programmatically</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleCreate} className="flex gap-2">
            <Input
              placeholder="Key name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={creating || !newName.trim()}>
              Create key
            </Button>
          </form>
          <div>
            <h3 className="font-medium mb-3">Your keys</h3>
            <div className="space-y-2">
              {keys.map((k) => (
                <div
                  key={k.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{k.name}</p>
                    <p className="text-sm text-muted-foreground">{k.keyPrefix}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(k.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              {keys.length === 0 && (
                <p className="text-sm text-muted-foreground py-4">No API keys yet</p>
              )}
            </div>
          </div>
          <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground space-y-1">
            <p>
              <strong>API base URL:</strong> {apiBase}/api/v1
            </p>
            <p>
              <a href={`${apiBase}/api-docs`} target="_blank" rel="noreferrer" className="underline hover:text-foreground">
                Docs: /api-docs
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
