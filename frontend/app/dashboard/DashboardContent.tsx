'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Folder, File, Download, Share2, Trash2, RotateCcw, Pencil, Move, Upload, Link2 } from 'lucide-react';
import { UnlockPrompt } from '@/components/UnlockPrompt';
import { ShareModal } from '@/components/ShareModal';
import { FolderShareModal } from '@/components/FolderShareModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface FileItem {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  folderId: string | null;
  deletedAt: string | null;
  createdAt: string;
}

interface FolderItem {
  id: string;
  name: string;
  parentId: string | null;
  path: string;
  createdAt: string;
}

interface DashboardContentProps {
  user: { email: string };
  files: FileItem[];
  folders: FolderItem[];
  storageUsed: number;
  breadcrumbs: Array<{ id: string; name: string }>;
  pagination: { page: number; pages: number; total: number } | null;
  needsUnlock: boolean;
  shareFileId: string | null;
  shareFileName: string;
  folderPermission: string | null;
  sharedWithMe: Array<{ id: string; name: string; sharedBy?: string; permission: string }>;
  shareFolderId: string | null;
  onShareFolderClose: () => void;
  onShareFolder: (id: string) => void;
  showDeleted: boolean;
  search: string;
  sortBy: string;
  sortOrder: string;
  newFolderName: string;
  creatingFolder: boolean;
  editingId: string | null;
  editName: string;
  currentFolderId: string | null;
  onShareClose: () => void;
  onShareCreated: () => void;
  onShare: (id: string, name: string) => void;
  onSetSearch: (v: string) => void;
  onSetShowDeleted: (v: boolean) => void;
  onSetSortBy: (v: string) => void;
  onSetSortOrder: () => void;
  onSetCurrentFolderId: (id: string | null) => void;
  onSetNewFolderName: (v: string) => void;
  onSetEditingId: (id: string | null) => void;
  onSetEditName: (v: string) => void;
  onCreateFolder: (e: React.FormEvent) => void;
  onDelete: (id: string) => void;
  onRestore: (id: string) => void;
  onMove: (id: string, folderId: string | null) => void;
  onRenameFile: (id: string) => void;
  onRenameFolder: (id: string) => void;
  onDownload: (id: string) => void;
  onSetPage: (v: number | ((p: number) => number)) => void;
  page: number;
  formatBytes: (b: number) => string;
}

export function DashboardContent(props: DashboardContentProps) {
  const p = props;
  const [moveFileId, setMoveFileId] = useState<string | null>(null);
  const [moveTargetFolderId, setMoveTargetFolderId] = useState<string | null>(null);
  const [allFolders, setAllFolders] = useState<FolderItem[]>([]);
  const [fileRequestOpen, setFileRequestOpen] = useState(false);
  const [fileRequestUrl, setFileRequestUrl] = useState('');
  const [fileRequestExpiresIn, setFileRequestExpiresIn] = useState(7);
  const [fileRequestMaxFiles, setFileRequestMaxFiles] = useState('');
  const [fileRequestLoading, setFileRequestLoading] = useState(false);
  const canWrite = !p.folderPermission || p.folderPermission === 'owner' || p.folderPermission === 'read_write' || p.folderPermission === 'full';
  const canDelete = !p.folderPermission || p.folderPermission === 'owner' || p.folderPermission === 'full';
  const canShare = !p.folderPermission || p.folderPermission === 'owner' || p.folderPermission === 'full';
  const sharedBy = p.currentFolderId ? p.sharedWithMe.find((f) => f.id === p.currentFolderId)?.sharedBy : null;

  useEffect(() => {
    if (moveFileId) {
      api
        .get<{ folders: FolderItem[] }>('/api/folders')
        .then((res) => setAllFolders(res.data.folders))
        .catch(() => setAllFolders([]));
    }
  }, [moveFileId]);

  const handleCloseMove = () => {
    setMoveFileId(null);
    setMoveTargetFolderId(null);
  };

  const handleConfirmMove = () => {
    if (moveFileId) {
      p.onMove(moveFileId, moveTargetFolderId);
      handleCloseMove();
    }
  };

  const handleCreateFileRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setFileRequestLoading(true);
    try {
      const { data } = await api.post<{ requestUrl: string }>('/api/file-requests', {
        folderId: p.currentFolderId || undefined,
        expiresInDays: fileRequestExpiresIn,
        maxFiles: fileRequestMaxFiles ? parseInt(fileRequestMaxFiles, 10) : undefined,
      });
      setFileRequestUrl(data.requestUrl);
    } catch {
      setFileRequestUrl('');
    } finally {
      setFileRequestLoading(false);
    }
  };

  const handleCloseFileRequest = () => {
    setFileRequestOpen(false);
    setFileRequestUrl('');
  };

  const moveFile = moveFileId ? p.files.find((file) => file.id === moveFileId) : null;
  const moveFileCurrentFolderId = moveFile?.folderId ?? null;

  const buildFolderOptions = (parentId: string | null, indent: number): JSX.Element[] => {
    return allFolders
      .filter((f) => (f.parentId ?? null) === parentId)
      .filter((f) => f.id !== moveFileCurrentFolderId)
      .flatMap((f) => [
        <option key={f.id} value={f.id}>
          {'\u00A0'.repeat(indent * 2)}{indent > 0 ? '↳ ' : ''}{f.name}
        </option>,
        ...buildFolderOptions(f.id, indent + 1),
      ]);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {p.needsUnlock && <UnlockPrompt />}
      {p.shareFileId && (
        <ShareModal
          fileId={p.shareFileId}
          fileName={p.shareFileName}
          onClose={p.onShareClose}
          onCreated={p.onShareCreated}
        />
      )}
      {p.shareFolderId && (
        <FolderShareModal
          folderId={p.shareFolderId}
          folderName={p.folders.find((f) => f.id === p.shareFolderId)?.name || 'Folder'}
          onClose={p.onShareFolderClose}
          onSuccess={p.onShareCreated}
        />
      )}
      <Dialog open={fileRequestOpen} onOpenChange={(open) => !open && handleCloseFileRequest()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create file request</DialogTitle>
            <DialogDescription>
              Generate a link that lets anyone upload files to your folder. No account required.
            </DialogDescription>
          </DialogHeader>
          {fileRequestUrl ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Upload link</label>
                <Input readOnly value={fileRequestUrl} className="font-mono text-sm" />
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigator.clipboard.writeText(fileRequestUrl)}
              >
                Copy link
              </Button>
            </div>
          ) : (
            <form onSubmit={handleCreateFileRequest} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Expires in (days)</label>
                <select
                  value={fileRequestExpiresIn}
                  onChange={(e) => setFileRequestExpiresIn(parseInt(e.target.value, 10))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value={1}>1 day</option>
                  <option value={7}>7 days</option>
                  <option value={30}>30 days</option>
                  <option value={90}>90 days</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Max files (optional)</label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  placeholder="No limit"
                  value={fileRequestMaxFiles}
                  onChange={(e) => setFileRequestMaxFiles(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseFileRequest}>
                  Cancel
                </Button>
                <Button type="submit" disabled={fileRequestLoading}>
                  {fileRequestLoading ? 'Creating...' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!moveFileId} onOpenChange={(open) => !open && handleCloseMove()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move file</DialogTitle>
            <DialogDescription>Select the destination folder.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={moveTargetFolderId ?? ''}
              onChange={(e) => setMoveTargetFolderId(e.target.value || null)}
            >
              <option value="">Root</option>
              {buildFolderOptions(null, 0)}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseMove}>
              Cancel
            </Button>
            <Button onClick={handleConfirmMove}>Move</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <main className="flex-1 container px-4 py-6 sm:px-6 sm:py-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold">Files & Folders</h1>
          <div className="flex items-center gap-2">
            <Checkbox
              id="show-deleted"
              checked={p.showDeleted}
              onCheckedChange={(checked) => p.onSetShowDeleted(checked === true)}
            />
            <label htmlFor="show-deleted" className="text-sm cursor-pointer">
              Show deleted
            </label>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Browse</CardTitle>
            {sharedBy && (
              <p className="text-sm text-muted-foreground mb-2">Shared by {sharedBy}</p>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Button variant="outline" size="sm" onClick={() => p.onSetCurrentFolderId(null)}>
                Root
              </Button>
              {p.breadcrumbs.map((b) => (
                <span key={b.id} className="flex items-center gap-1">
                  <span className="text-muted-foreground">/</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => p.onSetCurrentFolderId(b.id)}
                    className="h-auto py-1 px-2"
                  >
                    {b.name}
                  </Button>
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {canWrite && (
                <>
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard/upload">Upload</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link
                  href={
                    p.currentFolderId
                      ? `/dashboard/upload?folderId=${p.currentFolderId}`
                      : '/dashboard/upload'
                  }
                >
                  <Upload className="h-4 w-4 mr-1" />
                  Upload here
                </Link>
              </Button>
              <Button variant="outline" size="sm" onClick={() => setFileRequestOpen(true)}>
                <Link2 className="h-4 w-4 mr-1" />
                Create file request
              </Button>
                </>
              )}
            </div>
            {p.sharedWithMe.length > 0 && (
              <div className="mt-3 space-y-1">
                <p className="text-sm font-medium">Shared with me</p>
                {p.sharedWithMe.map((f) => (
                  <div key={f.id} className="flex items-center gap-2">
                    <Folder className="h-4 w-4" />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto py-1"
                      onClick={() => p.onSetCurrentFolderId(f.id)}
                    >
                      {f.name}
                    </Button>
                    {f.sharedBy && <span className="text-xs text-muted-foreground">by {f.sharedBy}</span>}
                  </div>
                ))}
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {canWrite && (
            <form
              onSubmit={p.onCreateFolder}
              className="flex gap-2 pb-3 border-b"
            >
              <Input
                placeholder="New folder name"
                value={p.newFolderName}
                onChange={(e) => p.onSetNewFolderName(e.target.value)}
                disabled={p.creatingFolder}
                className="flex-1"
              />
              <Button type="submit" disabled={!p.newFolderName.trim() || p.creatingFolder}>
                {p.creatingFolder ? 'Creating...' : 'Create folder'}
              </Button>
            </form>
            )}
            {p.folders.map((f) => (
              <div
                key={f.id}
                className={cn(
                  'flex items-center gap-3 rounded-lg border p-3 transition-colors',
                  'hover:bg-accent/50'
                )}
              >
                <Folder className="h-5 w-5 text-primary shrink-0" />
                {p.editingId === f.id ? (
                  <>
                    <Input
                      value={p.editName}
                      onChange={(e) => p.onSetEditName(e.target.value)}
                      className="flex-1"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') p.onRenameFolder(f.id);
                        if (e.key === 'Escape') {
                          p.onSetEditingId(null);
                          p.onSetEditName('');
                        }
                      }}
                    />
                    <Button size="sm" onClick={() => p.onRenameFolder(f.id)}>
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        p.onSetEditingId(null);
                        p.onSetEditName('');
                      }}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="font-medium flex-1 truncate">{f.name}</span>
                    <Button size="sm" onClick={() => p.onSetCurrentFolderId(f.id)}>
                      Open
                    </Button>
                    {canWrite && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          p.onSetEditingId(f.id);
                          p.onSetEditName(f.name);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canShare && (
                      <Button size="sm" variant="ghost" onClick={() => p.onShareFolder(f.id)}>
                        <Share2 className="h-4 w-4" />
                      </Button>
                    )}
                  </>
                )}
              </div>
            ))}
            {p.files.map((f) => (
              <div
                key={f.id}
                className={cn(
                  'flex items-center gap-3 rounded-lg border p-3 transition-colors',
                  f.deletedAt ? 'bg-destructive/10 border-destructive/30' : 'hover:bg-accent/50'
                )}
              >
                <File className="h-5 w-5 text-muted-foreground shrink-0" />
                <span className="flex-1 truncate">{f.name}</span>
                <span className="text-sm text-muted-foreground shrink-0">
                  {p.formatBytes(f.size)}
                </span>
                {f.deletedAt ? (
                  <Badge variant="destructive">Deleted</Badge>
                ) : (
                  <Badge variant="secondary">Active</Badge>
                )}
                <div className="flex gap-1 shrink-0">
                  {f.deletedAt ? (
                    <Button size="sm" variant="outline" onClick={() => p.onRestore(f.id)}>
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Restore
                    </Button>
                  ) : (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => p.onDownload(f.id)}>
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => p.onShare(f.id, f.name)}>
                        <Share2 className="h-4 w-4" />
                      </Button>
                      {canWrite && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setMoveFileId(f.id);
                            setMoveTargetFolderId(f.folderId);
                          }}
                        >
                          <Move className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button size="sm" variant="ghost" onClick={() => p.onDelete(f.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
            {p.folders.length === 0 && p.files.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No files or folders yet</p>
            )}
          </CardContent>
        </Card>

        <Button variant="link" className="mt-6" asChild>
          <Link href="/">Back to home</Link>
        </Button>
      </main>
    </div>
  );
}
