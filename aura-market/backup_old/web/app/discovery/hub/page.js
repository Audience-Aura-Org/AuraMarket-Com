"use client";
import HubContent from '@/components/hub/HubContent';
import TopNav from '@/components/layout/TopNav';

export default function DiscoveryHubPage() {
  return (
    <div className="flex flex-col h-screen">
      <TopNav />
      <HubContent />
    </div>
  );
}
