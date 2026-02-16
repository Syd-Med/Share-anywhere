import RequestPageClient from './RequestPageClient';

export function generateStaticParams() {
  return [{ token: 'default' }];
}

export default function FileRequestPage() {
  return <RequestPageClient />;
}
