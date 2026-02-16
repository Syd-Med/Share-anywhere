import SharePageClient from './SharePageClient';

export function generateStaticParams() {
  return [{ token: 'default' }];
}

export default function SharePage() {
  return <SharePageClient />;
}
