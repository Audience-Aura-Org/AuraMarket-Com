"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function SettingsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/profile?tab=general');
  }, [router]);

  return <LoadingSpinner fullScreen />;
}
