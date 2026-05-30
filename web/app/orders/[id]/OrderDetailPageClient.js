"use client";

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function OrderDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user) return;

    // Direct to the correct dashboard context
    if (user.role === 'admin') {
      router.replace(`/admin/orders?orderId=${id}`);
    } else if (user.role === 'vendor') {
      router.replace(`/vendor/orders?orderId=${id}`);
    } else {
      router.replace(`/profile?tab=orders&orderId=${id}`);
    }
  }, [id, user, router]);

  return <LoadingSpinner fullScreen />;
}
