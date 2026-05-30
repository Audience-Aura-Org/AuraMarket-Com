import ProductDetailsPageClient from './ProductDetailsPageClient';

export const dynamicParams = false;

export function generateStaticParams() {
  return [{ id: '__placeholder__' }];
}

export default function ProductDetailsPage() {
  return <ProductDetailsPageClient />;
}
