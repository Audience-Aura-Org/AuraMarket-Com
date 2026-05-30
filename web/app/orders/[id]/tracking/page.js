import OrderTrackingPageClient from './OrderTrackingPageClient';

export const dynamicParams = false;

export function generateStaticParams() {
  return [{ id: '__placeholder__' }];
}

export default function OrderTrackingPage() {
  return <OrderTrackingPageClient />;
}
