import ProductDetailsPageClient from './ProductDetailsPageClient';

export function generateStaticParams() {
  return [{ id: '__placeholder__' }];
}

export default function ProductDetailsPage() {
  return <ProductDetailsPageClient />;
}
