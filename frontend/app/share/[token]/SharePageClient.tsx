'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Download, Lock } from 'lucide-react';
import { decryptFileKeyFromShare, decryptFile } from '@/lib/crypto';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function SharePageClient() {
  const params = useParams();
  const token = params.token as string;
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<{
    name: string;
    mimeType: string;
    size: number;
    downloadUrl: string;
    shareEncryptedFileKey: string;
    hasPassword?: boolean;
  } | null>(null);
  const [usedPassword, setUsedPassword] = useState('');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? window.location.origin : '');

  useEffect(() => {
    if (!token) return;
    const fetchData = async () => {
      try {
        const url = `${API_URL}/api/shares/public/${token}`;
        const res = await fetch(url);
        const json = await res.json();
        if (res.status === 401 && json.requiresPassword) {
          setData(null);
          setLoading(false);
          return;
        }
        if (!res.ok) throw new Error(json.message || 'Failed to load');
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token, API_URL]);

  const handleAccessWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const url = `${API_URL}/api/shares/public/${token}?password=${encodeURIComponent(password)}`;
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Invalid password');
      setData(json);
      setUsedPassword(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid password');
    }
  };

  const handleDownload = async () => {
    if (!data) return;
    try {
      const secret = data.hasPassword ? usedPassword : token;
      const fileKey = await decryptFileKeyFromShare(data.shareEncryptedFileKey, secret);
      const encBlob = await fetch(data.downloadUrl).then((r) => r.blob());
      const decBlob = await decryptFile(encBlob, fileKey);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(decBlob);
      a.download = data.name;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!data && !error) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Password required
              </CardTitle>
              <CardDescription>This share is protected. Enter the password to access the file.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAccessWithPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="share-password">Password</Label>
                  <Input
                    id="share-password"
                    type="password"
                    placeholder="Enter share password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full">Access</Button>
              </form>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4 py-12 text-center">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Share not found or expired</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
          </Card>
        </main>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Shared file</CardTitle>
            <CardDescription>{data.name}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{(data.size / 1024).toFixed(1)} KB</p>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={handleDownload} className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
