import type { Metadata } from 'next';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/components/ThemeProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Share Anywhere',
  description: 'Zero-knowledge cloud storage',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <ThemeProvider defaultTheme="system" storageKey="share-anywhere-theme">
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
