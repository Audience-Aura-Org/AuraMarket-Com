"use client";

import StatusManager from '@/components/status/StatusManager';

export default function VendorStoriesPage() {
  return (
    <div className="min-h-screen w-full bg-[var(--bg-secondary)] text-[var(--text-primary)] pt-[env(safe-area-inset-top)]">
      <div className="w-full px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
        <StatusManager />
      </div>
    </div>
  );
}
