import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Share Anywhere
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Zero-knowledge cloud storage. Your files, encrypted. Share securely with anyone.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" asChild>
              <Link href="/register">Get started</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <Link href="/pricing" className="underline hover:text-foreground">
              View pricing
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
