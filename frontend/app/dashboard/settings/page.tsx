'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shield, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function SettingsPage() {
  const [deletedRetentionDays, setDeletedRetentionDays] = useState(30);
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [retentionMessage, setRetentionMessage] = useState('');
  const [twoFaMessage, setTwoFaMessage] = useState('');
  const [twoFaQr, setTwoFaQr] = useState<string | null>(null);
  const [twoFaCode, setTwoFaCode] = useState('');
  const [twoFaLoading, setTwoFaLoading] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableLoading, setDisableLoading] = useState(false);

  useEffect(() => {
    api
      .get<{ deletedRetentionDays?: number; totpEnabled?: boolean }>('/api/auth/me')
      .then((res) => {
        const data = res.data as { user?: unknown; deletedRetentionDays?: number; totpEnabled?: boolean };
        if (data.deletedRetentionDays !== undefined) {
          setDeletedRetentionDays(data.deletedRetentionDays);
        }
        if (data.totpEnabled !== undefined) {
          setTotpEnabled(data.totpEnabled);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setRetentionMessage('');
    try {
      await api.patch('/api/auth/me', { deletedRetentionDays });
      setRetentionMessage('Settings saved.');
    } catch {
      setRetentionMessage('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="container max-w-xl mx-auto px-4 py-8">
        <p className="text-muted-foreground">Loading...</p>
      </main>
    );
  }

  return (
    <main className="container max-w-xl mx-auto px-4 py-8">
      <Button variant="link" className="mb-6 -ml-2" asChild>
        <Link href="/dashboard">← Back to dashboard</Link>
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>Account settings</CardTitle>
          <CardDescription>Configure your account preferences.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="retention">Keep deleted files for</Label>
              <select
                id="retention"
                value={deletedRetentionDays}
                onChange={(e) => setDeletedRetentionDays(parseInt(e.target.value, 10))}
                disabled={saving}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Deleted files are moved to the rubbish bin and permanently removed after this period.
              </p>
            </div>
            {retentionMessage && (
              <p className={retentionMessage.includes('Failed') ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
                {retentionMessage}
              </p>
            )}
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {totpEnabled ? <ShieldCheck className="h-5 w-5" /> : <Shield className="h-5 w-5" />}
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            {totpEnabled ? '2FA is enabled. Enter your password to disable.' : 'Add an extra layer of security with an authenticator app.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {totpEnabled ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setDisableLoading(true);
                setTwoFaMessage('');
                try {
                  await api.post('/api/auth/2fa/disable', { password: disablePassword });
                  setTotpEnabled(false);
                  setTwoFaMessage('2FA disabled.');
                  setDisablePassword('');
                } catch {
                  setTwoFaMessage('Failed to disable 2FA. Check your password.');
                } finally {
                  setDisableLoading(false);
                }
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="disable-password">Password</Label>
                <Input
                  id="disable-password"
                  type="password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  placeholder="Enter password to disable 2FA"
                  required
                />
              </div>
              <Button type="submit" variant="destructive" disabled={disableLoading}>
                {disableLoading ? 'Disabling...' : 'Disable 2FA'}
              </Button>
            </form>
          ) : twoFaQr ? (
            <div className="space-y-4">
              <p className="text-sm">Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.):</p>
              <div className="flex justify-center">
                <img src={twoFaQr} alt="QR code" className="w-48 h-48" />
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setTwoFaLoading(true);
                  setTwoFaMessage('');
                  try {
                    await api.post('/api/auth/2fa/verify', { code: twoFaCode });
                    setTotpEnabled(true);
                    setTwoFaQr(null);
                    setTwoFaCode('');
                    setTwoFaMessage('2FA enabled successfully.');
                  } catch {
                    setTwoFaMessage('Invalid code. Please try again.');
                  } finally {
                    setTwoFaLoading(false);
                  }
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="totp-code">Enter the 6-digit code</Label>
                  <Input
                    id="totp-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={twoFaCode}
                    onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={twoFaLoading || twoFaCode.length !== 6}>
                    {twoFaLoading ? 'Verifying...' : 'Enable 2FA'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setTwoFaQr(null);
                      setTwoFaCode('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            <Button
              onClick={async () => {
                setTwoFaLoading(true);
                setTwoFaMessage('');
                try {
                  const { data } = await api.post<{ qrDataUrl: string }>('/api/auth/2fa/setup');
                  setTwoFaQr(data.qrDataUrl);
                } catch {
                  setTwoFaMessage('Failed to start 2FA setup.');
                } finally {
                  setTwoFaLoading(false);
                }
              }}
              disabled={twoFaLoading}
            >
              {twoFaLoading ? 'Loading...' : 'Enable 2FA'}
            </Button>
          )}
          {twoFaMessage && (
            <p className={`mt-4 text-sm ${twoFaMessage.includes('Failed') || twoFaMessage.includes('Invalid') ? 'text-destructive' : 'text-muted-foreground'}`}>
              {twoFaMessage}
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
