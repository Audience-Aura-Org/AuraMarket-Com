"use client";

import { useParams, useSearchParams } from 'next/navigation';
import ProductEditor from '@/components/vendor/ProductEditor';

export default function EditProductPageClient() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = searchParams?.get('id') || params?.id;
  return <ProductEditor key={id || 'missing'} productId={id} editing />;
}
