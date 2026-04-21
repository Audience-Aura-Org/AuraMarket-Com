"use client";
import HubContent from '@/components/hub/HubContent';
import TopNav from '@/components/layout/TopNav';
import { useAuthStore } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function DiscoveryHubPage() {
  const { user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (user && (user.role === 'admin' || user.role === 'vendor' || user.role === 'logistics')) {
      const dashboard = user.role === 'admin' ? '/admin/dashboard' : user.role === 'vendor' ? '/vendor/dashboard' : '/logistics/dashboard';
      router.replace(dashboard);
    }
  }, [user, router]);

  if (user && (user.role === 'admin' || user.role === 'vendor' || user.role === 'logistics')) {
    return null; // Don't even flash the content
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[var(--bg-primary)]">
      <TopNav />
      <HubContent />
    </div>
  );
}
