import StorePageClient from './StorePageClient';

export function generateStaticParams() {
  return [{ id: '__placeholder__' }];
}

export default function StorePage() {
  return <StorePageClient />;
}
