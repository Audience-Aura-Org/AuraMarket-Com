"use client";

import StatusManager from '@/components/status/StatusManager';

export default function VendorStoriesPage() {
  return (
    <div className="min-h-screen w-full bg-[var(--bg-secondary)] font-[Poppins] text-[var(--text-primary)] pt-[env(safe-area-inset-top)]">
      <div className="w-full px-3 py-3 sm:px-5 sm:py-5 lg:px-6">
        <StatusManager />
      </div>
    </div>
  );
}
