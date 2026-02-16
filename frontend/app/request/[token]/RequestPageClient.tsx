'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Upload } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const getApiUrl = () =>
  process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? window.location.origin : '');

export default function RequestPageClient() {
  const params = useParams();
  const token = params.token as string;
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [meta, setMeta] = useState<{ expiresAt: string; maxFiles?: number } | null>(null);

  useEffect(() => {
    if (!token) return;
    const fetchMeta = async () => {
      try {
        const res = await fetch(`${getApiUrl()}/api/file-requests/public/${token}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || 'Failed to load');
        setMeta({ expiresAt: json.expiresAt, maxFiles: json.maxFiles });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    fetchMeta();
  }, [token]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    const API_URL = getApiUrl();
    setError('');
    setUploading(true);
    try {
      setProgress('Requesting upload...');
      const urlRes = await fetch(`${API_URL}/api/file-requests/public/${token}/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
        }),
      });
      const urlData = await urlRes.json();
      if (!urlRes.ok) throw new Error(urlData.message || 'Failed to get upload URL');

      setProgress('Uploading...');
      await fetch(urlData.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
      });

      setProgress('Finalizing...');
      const completeRes = await fetch(`${API_URL}/api/file-requests/public/${token}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: urlData.fileId }),
      });
      const completeData = await completeRes.json();
      if (!completeRes.ok) throw new Error(completeData.message || 'Failed to complete');

      setProgress('Done!');
      setSuccess(true);
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
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

  if (error && !meta) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4 py-12 text-center">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>File request not found or expired</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload files
            </CardTitle>
            <CardDescription>
              {meta?.maxFiles
                ? `Upload up to ${meta.maxFiles} file(s). Files will be saved to the requester's folder.`
                : 'Upload your files. They will be saved to the requester\'s folder.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Upload complete! You can upload more files if needed.</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSuccess(false);
                  }}
                >
                  Upload another
                </Button>
              </div>
            ) : (
              <form onSubmit={handleUpload} className="space-y-4">
                <div className="space-y-2">
                  <input
                    type="file"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    disabled={uploading}
                    className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:font-medium"
                  />
                  {file && (
                    <p className="text-sm text-muted-foreground">
                      {file.name} ({(file.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </div>
                {progress && <p className="text-sm">{progress}</p>}
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" disabled={!file || uploading} className="w-full">
                  {uploading ? 'Uploading...' : 'Upload'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
