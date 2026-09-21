import StorePageClient from './StorePageClient';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.auradime.com/api/v1';

export function generateStaticParams() {
  return [{ id: '__placeholder__' }];
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  if (!id || id === '__placeholder__') return {};
  try {
    const res = await fetch(`${apiUrl}/vendors/stores/${id}`, { next: { revalidate: 3600 } });
    if (!res.ok) return {};
    const json = await res.json();
    const store = json?.data?.store;
    const vendor = store?.vendor_id;
    if (!vendor) return {};

    const name = vendor.store_name || 'Store';
    const description = vendor.description
      ? vendor.description.slice(0, 160)
      : `Shop products from ${name} on Auradime. Trusted seller in Cameroon.`;
    const image = store?.logo || vendor.user_id?.branding?.logo || '/icon-512.png';

    return {
      title: `${name} — Store on Auradime`,
      description,
      openGraph: {
        title: `${name} — Store on Auradime`,
        description,
        images: [{ url: image, alt: name }],
        type: 'website',
      },
      twitter: {
        card: 'summary',
        title: `${name} — Store on Auradime`,
        description,
        images: [image],
      },
    };
  } catch {
    return {};
  }
}

export default function StorePage() {
  return <StorePageClient />;
}
