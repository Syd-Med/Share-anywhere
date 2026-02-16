'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Upload } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { UnlockPrompt } from '@/components/UnlockPrompt';
import { api } from '@/lib/api';
import { generateFileKey, encryptFileKey, encryptFile } from '@/lib/crypto';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

async function readDroppedItems(dataTransfer: DataTransfer): Promise<File[]> {
  const files: File[] = [];
  const items = dataTransfer.items;

  if (items) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const entry = item.webkitGetAsEntry?.();
      if (entry?.isDirectory) {
        const dirFiles = await readDirectoryRecursive(entry as FileSystemDirectoryEntry, '');
        files.push(...dirFiles);
      } else {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
  } else {
    const dtFiles = dataTransfer.files;
    for (let i = 0; i < dtFiles.length; i++) {
      files.push(dtFiles[i]);
    }
  }

  return files;
}

async function readDirectoryRecursive(
  dir: FileSystemDirectoryEntry,
  path: string
): Promise<File[]> {
  const files: File[] = [];
  const reader = dir.createReader();

  const readEntries = (): Promise<FileSystemEntry[]> =>
    new Promise((resolve, reject) => reader.readEntries(resolve, reject));

  let entries: FileSystemEntry[] = [];
  do {
    entries = await readEntries();
    for (const entry of entries) {
      const fullPath = path ? `${path}/${entry.name}` : entry.name;
      if (entry.isDirectory) {
        const subFiles = await readDirectoryRecursive(
          entry as FileSystemDirectoryEntry,
          fullPath
        );
        files.push(...subFiles);
      } else {
        const file = await new Promise<File>((resolve, reject) =>
          (entry as FileSystemFileEntry).file(resolve, reject)
        );
        (file as File & { webkitRelativePath?: string }).webkitRelativePath = fullPath;
        files.push(file);
      }
    }
  } while (entries.length > 0);

  return files;
}

function getUniqueFileName(existingNames: string[], baseName: string): string {
  if (!existingNames.includes(baseName)) return baseName;
  const lastDot = baseName.lastIndexOf('.');
  const base = lastDot > 0 ? baseName.slice(0, lastDot) : baseName;
  const ext = lastDot > 0 ? baseName.slice(lastDot) : '';
  let n = 1;
  while (existingNames.includes(`${base} (${n})${ext}`)) n++;
  return `${base} (${n})${ext}`;
}

interface FolderItem {
  id: string;
  name: string;
  parentId: string | null;
  path: string;
  createdAt: string;
}

interface UploadQueueItem {
  file: File;
  folderPath: string[];
  fileName: string;
}

export default function UploadPage() {
  const { user, loading, needsUnlock, masterKey } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const folderIdFromUrl = searchParams.get('folderId');
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [queueIndex, setQueueIndex] = useState(0);
  const [queueTotal, setQueueTotal] = useState(0);
  const [error, setError] = useState('');
  const [cancelled, setCancelled] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const folderIdRef = useRef<string | null>(folderIdFromUrl);
  const [folderId, setFolderId] = useState<string | null>(folderIdFromUrl);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [duplicateDialog, setDuplicateDialog] = useState<{ fileName: string; file: File } | null>(
    null
  );
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (folderIdFromUrl) {
      setFolderId(folderIdFromUrl);
      folderIdRef.current = folderIdFromUrl;
    }
  }, [folderIdFromUrl]);

  useEffect(() => {
    folderIdRef.current = folderId;
  }, [folderId]);

  useEffect(() => {
    if (user) {
      api
        .get<{ folders: FolderItem[] }>('/api/folders')
        .then((res) => setFolders(res.data.folders))
        .catch(() => setFolders([]));
    }
  }, [user]);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  const handleCancel = () => {
    setCancelled(true);
    if (abortRef.current) abortRef.current.abort();
  };

  const getOrCreateFolder = async (
    parentId: string | null,
    name: string
  ): Promise<string> => {
    try {
      const { data } = await api.post<{ id: string }>('/api/folders', {
        name,
        parentId: parentId || undefined,
      });
      return data.id;
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'response' in err &&
        (err as { response?: { status?: number } }).response?.status === 409
      ) {
        const { data: foldersData } = await api.get<{ folders: FolderItem[] }>('/api/folders');
        const found = foldersData.folders.find(
          (f) => f.parentId === parentId && f.name === name
        );
        if (found) return found.id;
      }
      throw err;
    }
  };

  const doUploadSingle = async (
    fileToUpload: File,
    resolvedFileName: string,
    targetFolderId: string | null
  ) => {
    const useEncryption = !!masterKey;
    const controller = new AbortController();
    abortRef.current = controller;

    let body: Blob;
    let payload: {
      fileName: string;
      size: number;
      mimeType: string;
      encryptedFileKey?: string;
    };

    if (useEncryption) {
      const fileKey = await generateFileKey();
      body = await encryptFile(fileToUpload, fileKey);
      const encryptedFileKey = await encryptFileKey(fileKey, masterKey!);
      payload = {
        fileName: resolvedFileName,
        size: body.size,
        mimeType: 'application/octet-stream',
        encryptedFileKey,
      };
    } else {
      body = fileToUpload;
      payload = {
        fileName: resolvedFileName,
        size: fileToUpload.size,
        mimeType: fileToUpload.type || 'application/octet-stream',
      };
    }

    const { data: urlData } = await api.post<{
      fileId: string;
      uploadUrl: string;
    }>('/api/files/upload-url', {
      ...payload,
      folderId: targetFolderId || undefined,
    });

    if (cancelled) throw new Error('Cancelled');

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) {
          const pct = 10 + Math.round((evt.loaded / evt.total) * 80);
          setProgressPercent(pct);
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error('Upload failed'));
      };
      xhr.onerror = () => reject(new Error('Upload failed'));
      xhr.onabort = () => reject(new Error('Cancelled'));
      xhr.open('PUT', urlData.uploadUrl);
      xhr.setRequestHeader('Content-Type', payload.mimeType);
      if (controller.signal.aborted) reject(new Error('Cancelled'));
      controller.signal.addEventListener('abort', () => xhr.abort());
      xhr.send(body);
    });

    if (cancelled) throw new Error('Cancelled');
    await api.post('/api/files/complete', { fileId: urlData.fileId });
  };

  const doUpload = async (fileToUpload: File, resolvedFileName: string) => {
    await doUploadSingle(fileToUpload, resolvedFileName, folderIdRef.current);
  };

  const processQueue = async (queue: UploadQueueItem[]) => {
    setError('');
    setUploading(true);
    setCancelled(false);
    setProgressPercent(0);
    setQueueTotal(queue.length);

    const controller = new AbortController();
    abortRef.current = controller;

    const folderCache = new Map<string, string>();
    const existingNamesByFolder = new Map<string, Set<string>>();

    const getTargetFolderId = async (folderPath: string[]): Promise<string | null> => {
      if (folderPath.length === 0) return folderIdRef.current;
      const key = (folderIdRef.current ?? 'root') + '/' + folderPath.join('/');
      const cached = folderCache.get(key);
      if (cached) return cached;

      let parentId: string | null = folderIdRef.current;
      for (const part of folderPath) {
        const pkey = parentId ?? 'root';
        const cacheKey = `${pkey}/${part}`;
        const subCached = folderCache.get(cacheKey);
        if (subCached) {
          parentId = subCached;
          continue;
        }
        const id = await getOrCreateFolder(parentId, part);
        folderCache.set(cacheKey, id);
        parentId = id;
      }
      folderCache.set(key, parentId!);
      return parentId;
    };

    const getResolvedName = async (
      targetFolderId: string | null,
      fileName: string
    ): Promise<string> => {
      const key = targetFolderId ?? 'root';
      let names = existingNamesByFolder.get(key);
      if (!names) {
        const params = new URLSearchParams();
        if (targetFolderId) params.set('folderId', targetFolderId);
        const { data } = await api.get<{ names: string[] }>(
          `/api/files/names?${params.toString()}`
        );
        names = new Set(data.names);
        existingNamesByFolder.set(key, names);
      }
      const resolved = getUniqueFileName(Array.from(names), fileName);
      names.add(resolved);
      return resolved;
    };

    try {
      for (let i = 0; i < queue.length; i++) {
        if (cancelled || controller.signal.aborted) throw new Error('Cancelled');

        const item = queue[i];
        setQueueIndex(i + 1);
        setProgress(`Uploading ${i + 1} of ${queue.length}: ${item.fileName}`);
        setProgressPercent(Math.round((i / queue.length) * 100));

        const targetFolderId = await getTargetFolderId(item.folderPath);
        const resolvedName = await getResolvedName(targetFolderId, item.fileName);

        setProgress(`Uploading ${i + 1} of ${queue.length}: ${resolvedName}`);
        const basePct = (i / queue.length) * 100;
        setProgressPercent(Math.round(basePct));

        await doUploadSingle(item.file, resolvedName, targetFolderId);

        setProgressPercent(Math.round(((i + 1) / queue.length) * 100));
      }

      setProgress('Done!');
      setProgressPercent(100);
      setFiles([]);
      setDuplicateDialog(null);
      setTimeout(() => router.push('/dashboard'), 1000);
    } catch (err: unknown) {
      if (cancelled || (err instanceof Error && err.message === 'Cancelled')) {
        setError('Upload cancelled.');
      } else {
        const msg =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
            : err instanceof Error
              ? err.message
              : 'Upload failed';
        setError(String(msg));
      }
    } finally {
      setUploading(false);
    }
  };

  const buildQueue = (fileList: File[]): UploadQueueItem[] => {
    return fileList.map((file) => {
      const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
      if (rel) {
        const parts = rel.split('/').filter(Boolean);
        if (parts.length <= 1) {
          return { file, folderPath: [], fileName: file.name };
        }
        return {
          file,
          folderPath: parts.slice(0, -1),
          fileName: parts[parts.length - 1],
        };
      }
      return { file, folderPath: [], fileName: file.name };
    });
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) return;

    if (files.length === 1 && files[0]) {
      const file = files[0];
      const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
      const fileName = rel ? rel.split('/').pop() || file.name : file.name;

      const params = new URLSearchParams();
      params.set('fileName', fileName);
      if (folderId) params.set('folderId', folderId);

      const { data: check } = await api.get<{ exists: boolean }>(
        `/api/files/check-name?${params.toString()}`
      );

      if (check.exists) {
        setDuplicateDialog({ fileName, file });
        return;
      }
    }

    const queue = buildQueue(files);
    await processQueue(queue);
  };

  const handleUploadAnyway = async () => {
    if (!duplicateDialog) return;
    const { file: fileToUpload, fileName } = duplicateDialog;

    const params = new URLSearchParams();
    if (folderId) params.set('folderId', folderId);
    const { data: namesData } = await api.get<{ names: string[] }>(
      `/api/files/names?${params.toString()}`
    );
    const resolvedName = getUniqueFileName(namesData.names, fileName);
    setDuplicateDialog(null);
    await doUpload(fileToUpload, resolvedName);
  };

  if (loading || !user) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <main className="container max-w-xl mx-auto px-4 py-8">
      {needsUnlock && <UnlockPrompt />}
      <Dialog open={!!duplicateDialog} onOpenChange={(open) => !open && setDuplicateDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>File already exists</DialogTitle>
            <DialogDescription>
              A file named &quot;{duplicateDialog?.fileName}&quot; already exists in this folder.
              Upload anyway with a unique name (e.g. &quot;
              {duplicateDialog?.fileName?.includes('.')
                ? duplicateDialog?.fileName.replace(/(\.[^.]+)$/, ' (1)$1')
                : `${duplicateDialog?.fileName ?? ''} (1)`}
              &quot;) or cancel?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateDialog(null)}>
              Cancel
            </Button>
            <Button onClick={handleUploadAnyway}>
              Upload anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Button variant="link" className="mb-6 -ml-2" asChild>
        <Link href="/dashboard">← Back to dashboard</Link>
      </Button>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload File
          </CardTitle>
          <CardDescription>
            Select one or more files, or an entire folder. Encrypted if you have unlocked.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpload} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Destination folder</label>
              <select
                value={folderId ?? ''}
                onChange={(e) => setFolderId(e.target.value || null)}
                disabled={uploading}
                className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Root</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.path.replace(/\/$/, '') || f.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Files or folder</label>
              <div
                className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors cursor-pointer ${
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(false);
                }}
                onDrop={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(false);
                  if (uploading || !e.dataTransfer) return;
                  const dropped = await readDroppedItems(e.dataTransfer);
                  setFiles((prev) => [...prev, ...dropped]);
                }}
                onClick={(e) => {
                  if (uploading || (e.target as HTMLElement).closest('button')) return;
                  document.getElementById('file-input')?.click();
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    document.getElementById('file-input')?.click();
                  }
                }}
              >
                <p className="text-sm text-muted-foreground mb-3">
                  Drag files or folders here, or click to browse
                </p>
                <div className="flex gap-2 flex-wrap justify-center">
                <input
                  id="file-input"
                  type="file"
                  multiple
                  onChange={(e) => {
                    const selected = Array.from(e.target.files || []);
                    setFiles((prev) => [...prev, ...selected]);
                    e.target.value = '';
                  }}
                  disabled={uploading}
                  className="hidden"
                />
                <input
                  id="folder-input"
                  type="file"
                  {...({ webkitdirectory: true } as React.HTMLAttributes<HTMLInputElement>)}
                  onChange={(e) => {
                    const selected = Array.from(e.target.files || []);
                    setFiles((prev) => [...prev, ...selected]);
                    e.target.value = '';
                  }}
                  disabled={uploading}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('file-input')?.click()}
                  disabled={uploading}
                >
                  Select files
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('folder-input')?.click()}
                  disabled={uploading}
                >
                  Select folder
                </Button>
                {files.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFiles([])}
                    disabled={uploading}
                  >
                    Clear ({files.length})
                  </Button>
                )}
              </div>
              </div>
              {files.length > 0 && (
                <div className="text-sm text-muted-foreground max-h-32 overflow-y-auto space-y-1">
                  {files.slice(0, 10).map((f, i) => (
                    <p key={i} className="truncate">
                      {(f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name}{' '}
                      ({(f.size / 1024).toFixed(1)} KB)
                    </p>
                  ))}
                  {files.length > 10 && (
                    <p>...and {files.length - 10} more</p>
                  )}
                </div>
              )}
            </div>
            {progress && (
              <p className="text-sm">
                {progress}
                {queueTotal > 1 && ` (${queueIndex} of ${queueTotal})`}
              </p>
            )}
            {uploading && (
              <div className="space-y-1">
                <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}
            {error && (
              <div className="flex items-center gap-2">
                <p className="text-sm text-destructive flex-1">{error}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setError('')}
                >
                  Retry
                </Button>
              </div>
            )}
            <div className="flex gap-2">
              <Button type="submit" disabled={files.length === 0 || uploading} className="flex-1">
                {uploading ? 'Uploading...' : 'Upload'}
              </Button>
              {uploading && (
                <Button type="button" variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
