'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardHeader } from '@/components/layout/Header';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <DashboardHeader userEmail={user.email} onLogout={logout} isAdmin={user.isAdmin} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
