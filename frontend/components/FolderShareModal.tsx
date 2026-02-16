'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface FolderShareModalProps {
  folderId: string;
  folderName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function FolderShareModal({ folderId, folderName, onClose, onSuccess }: FolderShareModalProps) {
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<'read' | 'read_write' | 'full'>('read');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError('');
    setLoading(true);
    try {
      await api.post(`/api/folders/${folderId}/share`, { email: email.trim(), permission });
      setEmail('');
      onSuccess();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'Failed to share';
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share folder: {folderName}</DialogTitle>
          <DialogDescription>Invite someone by email to access this folder.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleShare} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="share-email">Email</Label>
            <Input
              id="share-email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="share-permission">Permission</Label>
            <select
              id="share-permission"
              value={permission}
              onChange={(e) => setPermission(e.target.value as 'read' | 'read_write' | 'full')}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="read">Read only (view and download)</option>
              <option value="read_write">Read &amp; write (upload, create, rename)</option>
              <option value="full">Full access (delete, share, move)</option>
            </select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !email.trim()}>
              {loading ? 'Sharing...' : 'Share'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
