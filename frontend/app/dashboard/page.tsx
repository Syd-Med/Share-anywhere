'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { DashboardContent } from './DashboardContent';

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

export default function DashboardPage() {
  const { user, loading, logout, needsUnlock, masterKey } = useAuth();
  const router = useRouter();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [storageUsed, setStorageUsed] = useState(0);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<{ page: number; limit: number; total: number; pages: number } | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: string; name: string }>>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [shareFileId, setShareFileId] = useState<string | null>(null);
  const [shareFileName, setShareFileName] = useState('');
  const [folderPermission, setFolderPermission] = useState<string | null>(null);
  const [sharedWithMe, setSharedWithMe] = useState<Array<{ id: string; name: string; sharedBy?: string; permission: string }>>([]);
  const [shareFolderId, setShareFolderId] = useState<string | null>(null);

  const fetchData = async () => {
    if (!user) return;
    try {
      const params = new URLSearchParams();
      if (currentFolderId) params.set('folderId', currentFolderId);
      if (showDeleted) params.set('includeDeleted', 'true');
      if (search) params.set('search', search);
      params.set('page', String(page));
      params.set('sort', sortBy);
      params.set('order', sortOrder);
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await api.get<{ files: FileItem[]; folders: FolderItem[]; folderPermission?: string; pagination?: { page: number; limit: number; total: number; pages: number } }>(`/api/files${query}`);
      setFiles(res.data.files);
      setFolders(res.data.folders);
      setFolderPermission(res.data.folderPermission || null);
      if (res.data.pagination) setPagination(res.data.pagination);
      const sharedRes = await api.get<{ folders: Array<{ id: string; name: string; sharedBy?: string; permission: string }> }>('/api/folders/shared-with-me');
      setSharedWithMe(sharedRes.data.folders || []);
      if (currentFolderId) {
        const bcRes = await api.get<{ breadcrumbs: Array<{ id: string; name: string }> }>(`/api/folders/breadcrumbs?folderId=${currentFolderId}`);
        setBreadcrumbs(bcRes.data.breadcrumbs);
      } else {
        setBreadcrumbs([]);
      }
      const usageRes = await api.get<{ storageUsed: number }>('/api/files/storage/usage');
      setStorageUsed(usageRes.data.storageUsed);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, currentFolderId, showDeleted, search, page, sortBy, sortOrder]);

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      await api.post('/api/folders', { name: newFolderName.trim(), parentId: currentFolderId });
      setNewFolderName('');
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleDelete = async (id: string) => { try { await api.patch(`/api/files/${id}/delete`); fetchData(); } catch (err) { console.error(err); } };
  const handleRestore = async (id: string) => { try { await api.patch(`/api/files/${id}/restore`); fetchData(); } catch (err) { console.error(err); } };
  const handleMove = async (id: string, targetFolderId: string | null) => { try { await api.patch(`/api/files/${id}/move`, { folderId: targetFolderId }); fetchData(); } catch (err) { console.error(err); } };
  const handleRenameFile = async (id: string) => { if (!editName.trim()) return; try { await api.patch(`/api/files/${id}/rename`, { name: editName.trim() }); setEditingId(null); setEditName(''); fetchData(); } catch (err) { console.error(err); } };
  const handleRenameFolder = async (id: string) => { if (!editName.trim()) return; try { await api.patch(`/api/folders/${id}/rename`, { name: editName.trim() }); setEditingId(null); setEditName(''); fetchData(); } catch (err) { console.error(err); } };

  const handleDownload = async (id: string) => {
    try {
      const res = await api.get<{ downloadUrl: string; name: string; encryptedFileKey?: string }>(`/api/files/${id}/download-url`);
      if (res.data.encryptedFileKey && masterKey) {
        const { decryptFileKey, decryptFile } = await import('@/lib/crypto');
        const encBlob = await fetch(res.data.downloadUrl).then((r) => r.blob());
        const fileKey = await decryptFileKey(res.data.encryptedFileKey, masterKey);
        const decBlob = await decryptFile(encBlob, fileKey);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(decBlob);
        a.download = res.data.name;
        a.click();
        URL.revokeObjectURL(a.href);
      } else {
        window.open(res.data.downloadUrl, '_blank');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) return <div style={{ padding: '2rem' }}>Loading...</div>;
  if (!user) return null;

  return (
    <DashboardContent
      user={user}
      files={files}
      folders={folders}
      storageUsed={storageUsed}
      breadcrumbs={breadcrumbs}
      pagination={pagination}
      needsUnlock={needsUnlock}
      shareFileId={shareFileId}
      shareFileName={shareFileName}
      folderPermission={folderPermission}
      sharedWithMe={sharedWithMe}
      shareFolderId={shareFolderId}
      onShareFolderClose={() => setShareFolderId(null)}
      onShareFolder={(id) => setShareFolderId(id)}
      showDeleted={showDeleted}
      search={search}
      sortBy={sortBy}
      sortOrder={sortOrder}
      newFolderName={newFolderName}
      creatingFolder={creatingFolder}
      editingId={editingId}
      editName={editName}
      currentFolderId={currentFolderId}
      onShareClose={() => { setShareFileId(null); setShareFileName(''); }}
      onShareCreated={fetchData}
      onShare={(id, name) => { setShareFileId(id); setShareFileName(name); }}
      onSetSearch={setSearch}
      onSetShowDeleted={setShowDeleted}
      onSetSortBy={setSortBy}
      onSetSortOrder={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
      onSetCurrentFolderId={setCurrentFolderId}
      onSetNewFolderName={setNewFolderName}
      onSetEditingId={setEditingId}
      onSetEditName={setEditName}
      onCreateFolder={handleCreateFolder}
      onDelete={handleDelete}
      onRestore={handleRestore}
      onMove={handleMove}
      onRenameFile={handleRenameFile}
      onRenameFolder={handleRenameFolder}
      onDownload={handleDownload}
      onSetPage={setPage}
      page={page}
      formatBytes={formatBytes}
    />
  );
}
