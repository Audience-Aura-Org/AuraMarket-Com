"use client";

export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ProductDetailsPageClient from './[id]/ProductDetailsPageClient';
import LoadingSpinner from '@/components/common/LoadingSpinner';

function ProductQueryContent() {
  const searchParams = useSearchParams();
  const productId = searchParams?.get('id');

  if (productId) {
    return <ProductDetailsPageClient productId={productId} />;
  }

  return <LoadingSpinner fullScreen />;
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<LoadingSpinner fullScreen />}>
      <ProductQueryContent />
    </Suspense>
  );
}
