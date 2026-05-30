import StorePageClient from './StorePageClient';

export const dynamicParams = false;

export function generateStaticParams() {
  return [{ id: '__placeholder__' }];
}

export default function StorePage() {
  return <StorePageClient />;
}
