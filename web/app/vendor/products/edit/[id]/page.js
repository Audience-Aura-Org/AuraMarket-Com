import { Suspense } from 'react';
import EditProductPageClient from './EditProductPageClient';

export function generateStaticParams() {
  return [{ id: '__placeholder__' }];
}

export default function EditProductPage() {
  return (
    <Suspense>
      <EditProductPageClient />
    </Suspense>
  );
}
