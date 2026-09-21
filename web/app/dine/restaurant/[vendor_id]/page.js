import RestaurantMenuPageClient from './RestaurantMenuPageClient';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.auradime.com/api/v1';

export function generateStaticParams() {
  return [{ vendor_id: '__placeholder__' }];
}

export async function generateMetadata({ params }) {
  const { vendor_id } = await params;
  if (!vendor_id || vendor_id === '__placeholder__') return {};
  try {
    const res = await fetch(`${apiUrl}/dine/restaurant/${vendor_id}`, { next: { revalidate: 3600 } });
    if (!res.ok) return {};
    const json = await res.json();
    const vendor = json?.data?.vendor;
    if (!vendor) return {};

    const name = vendor.store_name || 'Restaurant';
    const cuisines = vendor.cuisine_types?.map(c => c.name).join(', ') || '';
    const description = cuisines
      ? `Order ${cuisines} from ${name} on Auradime. Browse the menu and get food delivered.`
      : `Order food from ${name} on Auradime. Browse the menu and get meals delivered.`;
    const image = vendor.store?.logo || vendor.user_id?.branding?.logo || '/icon-512.png';

    return {
      title: `${name} — Menu & Delivery`,
      description,
      openGraph: {
        title: `${name} — Menu & Delivery`,
        description,
        images: [{ url: image, alt: name }],
        type: 'website',
      },
      twitter: {
        card: 'summary',
        title: `${name} — Menu & Delivery`,
        description,
        images: [image],
      },
    };
  } catch {
    return {};
  }
}

export default function Page() {
  return <RestaurantMenuPageClient />;
}
