import ProductDetailsPageClient from './ProductDetailsPageClient';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.auradime.com/api/v1';

export function generateStaticParams() {
  return [{ id: '__placeholder__' }];
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  if (!id || id === '__placeholder__') return {};
  try {
    const res = await fetch(`${apiUrl}/products/${id}`, { next: { revalidate: 3600 } });
    if (!res.ok) return {};
    const json = await res.json();
    const product = json?.data?.product || json?.product;
    if (!product) return {};

    const title = product.name;
    const price = product.sale_price || product.price;
    const description = product.description
      ? product.description.replace(/<[^>]*>/g, '').slice(0, 160)
      : `Buy ${product.name} on Auradime`;
    const image = product.images?.[0]?.url || '/icon-512.png';

    return {
      title,
      description: `${description} — ${price?.toLocaleString()} XAF`,
      openGraph: {
        title: `${title} — ${price?.toLocaleString()} XAF`,
        description,
        images: [{ url: image, alt: title }],
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${title} — ${price?.toLocaleString()} XAF`,
        description,
        images: [image],
      },
    };
  } catch {
    return {};
  }
}

export default function ProductDetailsPage() {
  return <ProductDetailsPageClient />;
}
