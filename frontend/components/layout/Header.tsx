'use client';

import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center font-semibold">
          Share Anywhere
        </Link>
        <nav className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" asChild>
            <Link href="/login">Login</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Register</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}

export function DashboardHeader({ userEmail, onLogout, isAdmin }: { userEmail: string; onLogout: () => void; isAdmin?: boolean }) {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 flex-wrap items-center justify-between gap-2 px-4 sm:px-6">
        <Link href="/dashboard" className="flex items-center font-semibold">
          Share Anywhere
        </Link>
        <nav className="flex items-center gap-2">
          {isAdmin && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/admin">Admin</Link>
            </Button>
          )}
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/upload">Upload</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/sharing">Sharing</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/pricing">Pricing</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/billing">Billing</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/api-keys">API Keys</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/settings">Settings</Link>
          </Button>
          <span className="text-sm text-muted-foreground hidden sm:inline">{userEmail}</span>
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={onLogout}>
            Logout
          </Button>
        </nav>
      </div>
    </header>
  );
}
