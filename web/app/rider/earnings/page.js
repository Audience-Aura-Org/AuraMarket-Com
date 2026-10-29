"use client";

/**
 * Rider → Earnings: today, this week and month, what the agency has paid and still
 * owes, cash being held for the agency, and the link to every delivery.
 */
import { Wallet } from "lucide-react";
import RiderSummary from "@/components/rider/RiderSummary";
import { useRiderJobs } from "@/components/rider/RiderJobsContext";
import RiderPageHeader, { RIDER_PAGE } from "@/components/rider/RiderPageHeader";

export default function RiderEarningsPage() {
  const jobs = useRiderJobs();
  return (
    <div className={RIDER_PAGE}>
      <RiderPageHeader icon={Wallet} title="Earnings" subtitle="What you earned, paid and still owed" />
      <RiderSummary refreshKey={jobs?.data?.recent?.[0]?.assignment_id} showCash />
    </div>
  );
}
