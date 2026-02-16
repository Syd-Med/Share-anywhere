'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Users, CreditCard, DollarSign, FileText, Link2, Inbox, Key, Settings } from 'lucide-react';

const navItems = [
  { href: '/dashboard/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/admin/users', label: 'Users', icon: Users },
  { href: '/dashboard/admin/plans', label: 'Plans', icon: CreditCard },
  { href: '/dashboard/admin/billing', label: 'Billing', icon: DollarSign },
  { href: '/dashboard/admin/audit', label: 'Audit', icon: FileText },
  { href: '/dashboard/admin/shares', label: 'Shares', icon: Link2 },
  { href: '/dashboard/admin/file-requests', label: 'File requests', icon: Inbox },
  { href: '/dashboard/admin/api-keys', label: 'API keys', icon: Key },
  { href: '/dashboard/admin/system', label: 'System', icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-1 min-h-0">
      <aside className="w-56 shrink-0 border-r bg-muted/30 p-4 hidden sm:block">
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard/admin' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
