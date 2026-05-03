"use client";
import HubContent from '@/components/hub/HubContent';
import TopNav from '@/components/layout/TopNav';
import { useAuthStore } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function DiscoveryHubPage() {
  const { user } = useAuthStore();
  const router = useRouter();

  // Unified discovery access: professional roles (vendor, admin, logistics) 
  // can now browse the hub without forced redirection to their dashboards.
  // This allows for seamless transitions between operational and consumer views.
  
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[var(--bg-primary)]">
      <TopNav />
      <HubContent />
    </div>
  );
}
