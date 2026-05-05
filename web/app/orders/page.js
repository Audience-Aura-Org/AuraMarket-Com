"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function OrdersRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/profile?tab=orders');
  }, [router]);

  return <LoadingSpinner fullScreen />;
}
