'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Copy, Trash2, Share2, FileText } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface FileShareRow {
  id: string;
  fileId: string | { _id: string };
  fileName?: string;
  token: string;
  shareUrl: string;
  expiresAt: string;
  hasPassword: boolean;
  permission: string;
  createdAt: string;
}

interface FolderShareRow {
  id: string;
  folderId: string;
  folderName: string;
  folderPath: string;
  sharedWithEmail: string;
  sharedWithUserId: string;
  permission: string;
  createdAt: string;
}

export default function SharingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<'files' | 'folders'>('files');
  const [fileShares, setFileShares] = useState<FileShareRow[]>([]);
  const [folderShares, setFolderShares] = useState<FolderShareRow[]>([]);
  const [loadingShares, setLoadingShares] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  const fetchFileShares = () =>
    api.get<{ shares: FileShareRow[] }>('/api/shares').then((r) => setFileShares(r.data.shares));

  const fetchFolderShares = () =>
    api
      .get<{ shares: FolderShareRow[] }>('/api/folders/shared-by-me')
      .then((r) => setFolderShares(r.data.shares));

  useEffect(() => {
    if (user) {
      setLoadingShares(true);
      Promise.all([fetchFileShares(), fetchFolderShares()]).finally(() => setLoadingShares(false));
    }
  }, [user]);

  const handleRevokeFile = async (token: string) => {
    try {
      await api.patch(`/api/shares/${token}/revoke`);
      setFileShares((s) => s.filter((x) => x.token !== token));
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateFilePermission = async (token: string, permission: 'read' | 'full') => {
    try {
      await api.patch(`/api/shares/${token}`, { permission });
      setFileShares((s) =>
        s.map((x) => (x.token === token ? { ...x, permission } : x))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleRevokeFolder = async (folderId: string, sharedWithUserId: string) => {
    try {
      await api.delete(`/api/folders/${folderId}/share/${sharedWithUserId}`);
      setFolderShares((s) =>
        s.filter((x) => x.folderId !== folderId || x.sharedWithUserId !== sharedWithUserId)
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateFolderPermission = async (
    folderId: string,
    sharedWithUserId: string,
    permission: 'read' | 'read_write' | 'full'
  ) => {
    try {
      await api.patch(`/api/folders/${folderId}/share/${sharedWithUserId}`, { permission });
      setFolderShares((s) =>
        s.map((x) =>
          x.folderId === folderId && x.sharedWithUserId === sharedWithUserId
            ? { ...x, permission }
            : x
        )
      );
    } catch (err) {
      console.error(err);
    }
  };

  const copyLink = (url: string) => navigator.clipboard.writeText(url);

  const formatDate = (d: string) => new Date(d).toLocaleDateString();

  if (loading || !user) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <main className="container max-w-4xl mx-auto px-4 py-8">
      <Button variant="link" className="mb-6 -ml-2" asChild>
        <Link href="/dashboard">← Back to dashboard</Link>
      </Button>

      <div className="flex gap-2 mb-6">
        <Button
          variant={tab === 'files' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTab('files')}
        >
          <FileText className="h-4 w-4 mr-2" />
          File links
        </Button>
        <Button
          variant={tab === 'folders' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTab('folders')}
        >
          <Share2 className="h-4 w-4 mr-2" />
          Folder shares
        </Button>
      </div>

      {tab === 'files' && (
        <Card>
          <CardHeader>
            <CardTitle>File share links</CardTitle>
            <CardDescription>Manage your shared file links. Change permission or revoke access.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingShares ? (
              <p className="text-sm text-muted-foreground py-4">Loading...</p>
            ) : fileShares.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No file share links yet</p>
            ) : (
              <div className="space-y-3">
                {fileShares.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{s.fileName || 'Untitled'}</p>
                      <p className="text-sm text-muted-foreground truncate font-mono">{s.shareUrl}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="secondary">{s.permission || 'full'}</Badge>
                        {s.hasPassword && <Badge variant="outline">Password protected</Badge>}
                        <span className="text-xs text-muted-foreground">
                          Expires {formatDate(s.expiresAt)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={s.permission || 'full'}
                        onChange={(e) =>
                          handleUpdateFilePermission(s.token, e.target.value as 'read' | 'full')
                        }
                        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                      >
                        <option value="read">Read-only</option>
                        <option value="full">Full access</option>
                      </select>
                      <Button size="sm" variant="outline" onClick={() => copyLink(s.shareUrl)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleRevokeFile(s.token)}
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
      )}

      {tab === 'folders' && (
        <Card>
          <CardHeader>
            <CardTitle>Folder shares</CardTitle>
            <CardDescription>Manage folders you shared with others. Change permission or revoke access.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingShares ? (
              <p className="text-sm text-muted-foreground py-4">Loading...</p>
            ) : folderShares.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No folder shares yet</p>
            ) : (
              <div className="space-y-3">
                {folderShares.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{s.folderName}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        Shared with {s.sharedWithEmail || s.sharedWithUserId}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="secondary">{s.permission}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={s.permission}
                        onChange={(e) =>
                          handleUpdateFolderPermission(
                            s.folderId,
                            s.sharedWithUserId,
                            e.target.value as 'read' | 'read_write' | 'full'
                          )
                        }
                        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                      >
                        <option value="read">Read only</option>
                        <option value="read_write">Read & write</option>
                        <option value="full">Full access</option>
                      </select>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleRevokeFolder(s.folderId, s.sharedWithUserId)}
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
      )}
    </main>
  );
}
