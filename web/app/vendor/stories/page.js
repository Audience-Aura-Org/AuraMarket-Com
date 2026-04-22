"use client";

import StatusManager from '@/components/status/StatusManager';

export default function VendorStoriesPage() {
  return (
    <div className="w-full min-h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)] pt-[env(safe-area-inset-top)]">
      <div className="w-full px-6 py-10 md:px-12 md:py-16">
        <StatusManager />
      </div>
    </div>
  );
}
