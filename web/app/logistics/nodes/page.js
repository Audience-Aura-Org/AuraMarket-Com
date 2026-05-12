"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import {
  Loader2,
  Network,
  RefreshCw,
  LayoutDashboard,
  LineChart,
  MapPin,
} from "lucide-react";
import Link from "next/link";
import api from "@/services/api";
import { toast } from "react-hot-toast";
import { useAuthStore } from "@/hooks/useAuth";
import Pagination from "@/components/common/Pagination";
import StatCard from "@/components/layout/StatCard";
import {
  LogisticsSubpageHeader,
  LogisticsShortcutsRow,
} from "@/components/logistics/LogisticsSubpageShell";

export default function LogisticsNodesPage() {
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(true);
  const [firm, setFirm] = useState(null);
  const [zones, setZones] = useState([]);
  const [balance, setBalance] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [profileRes, zonesRes, walletRes] = await Promise.all([
        api.get("/logistics/profile"),
        api.get("/logistics/zones"),
        api.get("/wallet"),
      ]);
      if (profileRes.data.success) setFirm(profileRes.data.data.firm);
      if (zonesRes.data.success) setZones(zonesRes.data.data.zones || []);
      if (walletRes.data.success) {
        setBalance(walletRes.data.data?.balance ?? 0);
      }
    } catch (err) {
      toast.error("Failed to load relay hubs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user || user.role !== "logistics") return;
    load();
  }, [user, load]);

  const totalPages = Math.ceil(zones.length / itemsPerPage) || 1;
  const currentZones = zones.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const regionCount = zones.filter((z) => z.type === "region").length;
  const quartierCount = zones.filter((z) => z.type === "quartier").length;
  const pricedCount = firm?.quartier_prices?.length ?? 0;

  if (!user || user.role !== "logistics") return null;

  if (loading && !firm && zones.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center bg-[var(--bg-primary)]">
        <Loader2 className="size-8 animate-spin text-[var(--accent)] opacity-50" />
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-col bg-[var(--bg-primary)] pb-[max(6rem,env(safe-area-inset-bottom,1.25rem))] text-[var(--text-primary)] lg:pb-12">
      <LogisticsSubpageHeader
        Icon={Network}
        title="Relay"
        accentTitle="nodes"
        tag="Zone registry"
        hint="Coverage from the master zone list. Configure rates under Route pricing."
        actions={
          <button
            type="button"
            onClick={() => load()}
            className="flex size-11 min-h-[2.75rem] min-w-[2.75rem] touch-manipulation items-center justify-center rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] transition hover:bg-white/5"
            aria-label="Refresh"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        }
      />

      <div className="mx-auto w-full min-w-0 max-w-[1600px] space-y-6 px-3 py-5 sm:space-y-8 sm:px-5 sm:py-6 md:px-8 md:py-8">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <StatCard
            label="Wallet"
            value={`${balance.toLocaleString()} XAF`}
            sub="Balance"
            icon="account_balance_wallet"
            color="purple"
            href="/wallet"
          />
          <StatCard
            label="Regions"
            value={String(regionCount)}
            sub="Catalog regions"
            icon="public"
            color="indigo"
          />
          <StatCard
            label="Quartiers"
            value={String(quartierCount)}
            sub="Network nodes"
            icon="hub"
            color="amber"
          />
          <StatCard
            label="Priced"
            value={String(pricedCount)}
            sub="Active rate cards"
            icon="payments"
            color="emerald"
          />
        </div>

        <LogisticsShortcutsRow
          links={[
            {
              label: "Dashboard",
              sub: "Overview",
              href: "/logistics/dashboard",
              icon: LayoutDashboard,
            },
            {
              label: "Route pricing",
              sub: "Fees & zones",
              href: "/logistics/pricing",
              icon: LineChart,
            },
            {
              label: "Live tracking",
              sub: "Shipments",
              href: "/logistics/tracking",
              icon: MapPin,
            },
          ]}
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/50 p-5 lg:col-span-2 lg:p-6">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)] opacity-50">
              Logistics company
            </p>
            <p className="mt-2 text-lg font-bold">
              {firm?.company_name || "Not onboarded"}
            </p>
            <p className="mt-1 text-xs font-semibold opacity-70">
              {firm?.contact_email || "—"}
            </p>
            <p className="text-xs font-semibold opacity-70">
              {firm?.contact_phone || "—"}
            </p>
            <p className="mt-3 text-[11px] font-semibold">
              Verification:{" "}
              <span
                className={
                  firm?.is_verified ? "text-emerald-600" : "text-amber-600"
                }
              >
                {firm?.is_verified ? "Verified" : "Pending"}
              </span>
            </p>
          </div>
          <div className="rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/50 p-5 lg:p-6">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)] opacity-50">
              Pricing link
            </p>
            <p className="mt-2 text-2xl font-bold">{pricedCount}</p>
            <p className="text-[11px] font-semibold opacity-60">
              Quartiers with your fee
            </p>
            <Link
              href="/logistics/pricing"
              className="mt-5 inline-flex min-h-10 items-center justify-center rounded-xl bg-[var(--text-primary)] px-4 py-2 text-[11px] font-semibold text-[var(--bg-primary)] transition hover:opacity-90"
            >
              Manage pricing
            </Link>
          </div>
        </div>

        <section className="overflow-hidden rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/10">
          <div className="flex flex-col gap-1 border-b border-[var(--glass-border)] px-4 py-4 md:flex-row md:items-center md:justify-between md:px-8">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-primary)]">
              Towns & quartiers
            </h2>
            <p className="font-mono text-[10px] font-semibold text-[var(--text-secondary)] opacity-50">
              {zones.length} signals
            </p>
          </div>

          <div className="p-4 md:p-6">
            <div className="grid min-h-[200px] grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
              {currentZones.map((z) => (
                <div
                  key={z._id}
                  className="rounded-xl border border-[var(--glass-border)] px-3 py-2.5 transition-colors hover:bg-[var(--accent)]/5"
                >
                  <p className="text-xs font-bold">{z.name}</p>
                  <p className="text-[11px] font-semibold capitalize opacity-60">
                    {z.type}
                  </p>
                </div>
              ))}
              {!zones.length && (
                <p className="col-span-full py-12 text-center text-[11px] font-semibold opacity-40">
                  No zones found
                </p>
              )}
            </div>
          </div>

          {zones.length > 0 ? (
            <div className="border-t border-[var(--glass-border)] px-4 py-6 md:px-8">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
