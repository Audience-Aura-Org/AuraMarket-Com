import RestaurantMenuPageClient from './RestaurantMenuPageClient';

export function generateStaticParams() {
  return [{ vendor_id: '__placeholder__' }];
}

export default function Page() {
  return <RestaurantMenuPageClient />;
}
