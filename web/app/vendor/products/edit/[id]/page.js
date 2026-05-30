import EditProductPageClient from './EditProductPageClient';

export const dynamicParams = false;

export function generateStaticParams() {
  return [{ id: '__placeholder__' }];
}

export default function EditProductPage() {
  return <EditProductPageClient />;
}
