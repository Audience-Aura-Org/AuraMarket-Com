"use client";

import DashboardLayout from '@/components/layout/DashboardLayout';
import StatusManager from '@/components/status/StatusManager';

export default function VendorStoriesPage() {
  return (
    <DashboardLayout role="vendor">
      <div className="p-4 sm:p-8 lg:p-12 space-y-8">
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-black text-[var(--text-primary)] tracking-tight uppercase">
            Aura <span className="text-[var(--accent)]">Stories</span>
          </h2>
          <p className="text-[11px] font-black tracking-[0.2em] text-[var(--text-secondary)] uppercase opacity-50">
            Social Content & Real-time Engagement Hub
          </p>
        </div>

        <StatusManager />
      </div>
    </DashboardLayout>
  );
}
