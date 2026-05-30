import OrderDetailPageClient from './OrderDetailPageClient';

export const dynamicParams = false;

export function generateStaticParams() {
  return [{ id: '__placeholder__' }];
}

export default function OrderDetailPage() {
  return <OrderDetailPageClient />;
}
