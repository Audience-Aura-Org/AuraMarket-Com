"use client";

/**
 * Rider → Earnings: today, this week and month, what the agency has paid and still
 * owes, cash being held for the agency, and the link to every delivery.
 */
import { Wallet } from "lucide-react";
import RiderSummary from "@/components/rider/RiderSummary";
import { useRiderJobs } from "@/components/rider/RiderJobsContext";

export default function RiderEarningsPage() {
  const jobs = useRiderJobs();
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-5 pb-28 text-[var(--text-primary)]">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)]"><Wallet className="size-5" /></div>
        <div>
          <h1 className="text-[17px] font-bold">Earnings</h1>
          <p className="text-[11px] text-[var(--text-secondary)]">What you earned, what your agency paid and what it still owes you.</p>
        </div>
      </div>
      <RiderSummary refreshKey={jobs?.data?.recent?.[0]?.assignment_id} showCash />
    </div>
  );
}
