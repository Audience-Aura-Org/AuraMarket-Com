"use client";

export const dynamic = 'force-dynamic';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ProductDetailsPageClient from './[id]/ProductDetailsPageClient';
import LoadingSpinner from '@/components/common/LoadingSpinner';

function ProductQueryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const productId = searchParams?.get('id');

  // /products with no product chosen has nothing to show: open the shop instead of spinning forever.
  useEffect(() => {
    if (!productId) router.replace('/shop');
  }, [productId, router]);

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
