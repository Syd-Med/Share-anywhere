'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { decryptFileKey, encryptFileKeyForShare } from '@/lib/crypto';
import { useAuth } from '@/contexts/AuthContext';
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

interface ShareModalProps {
  fileId: string;
  fileName: string;
  onClose: () => void;
  onCreated: () => void;
}

export function ShareModal({ fileId, fileName, onClose, onCreated }: ShareModalProps) {
  const { masterKey } = useAuth();
  const [password, setPassword] = useState('');
  const [expiresIn, setExpiresIn] = useState(7);
  const [permission, setPermission] = useState<'read' | 'full'>('full');
  const [loading, setLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [error, setError] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterKey) {
      setError('Unlock to create share');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { data: fileData } = await api.get<{ encryptedFileKey?: string; downloadUrl: string }>(
        `/api/files/${fileId}/download-url`
      );
      if (!fileData.encryptedFileKey) {
        setError('Encrypted files only can be shared');
        return;
      }

      const fileKey = await decryptFileKey(fileData.encryptedFileKey, masterKey);
      const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '');
      const secret = password.trim() || token;
      const shareEncryptedFileKey = await encryptFileKeyForShare(fileKey, secret);

      const expDate = new Date();
      expDate.setDate(expDate.getDate() + expiresIn);

      const { data } = await api.post<{ shareUrl: string }>('/api/shares', {
        fileId,
        expiresAt: expDate.toISOString(),
        password: password.trim() || undefined,
        token,
        shareEncryptedFileKey,
        permission,
      });
      setShareUrl(data.shareUrl);
      onCreated();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'Failed to create share';
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share: {fileName}</DialogTitle>
          <DialogDescription>
            Create a secure share link. Recipients will need the password if you set one.
          </DialogDescription>
        </DialogHeader>
        {shareUrl ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Share link</Label>
              <Input readOnly value={shareUrl} className="font-mono text-sm" />
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigator.clipboard.writeText(shareUrl)}
            >
              Copy link
            </Button>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="expires">Expires in (days)</Label>
              <select
                id="expires"
                value={expiresIn}
                onChange={(e) => setExpiresIn(parseInt(e.target.value, 10))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value={1}>1 day</option>
                <option value={7}>7 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="permission">Permission</Label>
              <select
                id="permission"
                value={permission}
                onChange={(e) => setPermission(e.target.value as 'read' | 'full')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="read">Read-only (download only)</option>
                <option value="full">Full access</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="share-password">Password (optional)</Label>
              <Input
                id="share-password"
                type="password"
                placeholder="Leave empty for no password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create share'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
