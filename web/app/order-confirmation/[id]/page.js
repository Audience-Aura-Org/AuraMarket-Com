import OrderConfirmationPageClient from './OrderConfirmationPageClient';

export const dynamicParams = false;

export function generateStaticParams() {
  return [{ id: '__placeholder__' }];
}

export default function OrderConfirmationPage() {
  return <OrderConfirmationPageClient />;
}
