'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function UnlockPrompt() {
  const { unlock } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await unlock(password);
      setPassword('');
    } catch (err) {
      setError('Invalid password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Unlock to access files</DialogTitle>
          <DialogDescription>
            Enter your password to decrypt your files.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="unlock-password">Password</Label>
            <Input
              id="unlock-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Unlocking...' : 'Unlock'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
