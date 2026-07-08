"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import {
  Loader2,
  MapPin,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  LayoutDashboard,
  List,
  LineChart,
} from "lucide-react";
import { useRouter } from "next/navigation";
import api from "@/services/api";
import { toast } from "react-hot-toast";
import { useAuthStore } from "@/hooks/useAuth";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import StatCard from "@/components/layout/StatCard";
import {
  LogisticsSubpageHeader,
  LogisticsShortcutsRow,
} from "@/components/logistics/LogisticsSubpageShell";
import { summarizeLineItems, destinationLine } from "@/lib/logistics";

const PAGE_SIZE = 10;

export default function LogisticsTrackingPage() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const { displayedBalance: balance } = useWalletBalance();
  const [loading, setLoading] = useState(true);
  const [shipments, setShipments] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("order_placed");
  const [counts, setCounts] = useState({
    pending: 0,
    active: 0,
    delivered: 0,
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const shipRes = await api.get("/logistics/shipments/firm", {
        params: { page, limit: PAGE_SIZE, status: filterStatus, sortBy },
      });
      if (shipRes.data.success) {
        const list = shipRes.data.data?.shipments ?? shipRes.data.shipments ?? [];
        setShipments(list);
        setTotal(shipRes.data.total ?? list.length);
        setPages(shipRes.data.pages ?? 1);
        const m = shipRes.data.meta?.counts;
        setCounts({
          pending:   m?.pending   ?? 0,
          active:    m?.active    ?? 0,
          delivered: m?.delivered ?? 0,
        });
      }
    } catch (err) {
      toast.error("Failed to load live tracking");
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, sortBy]);

  useEffect(() => {
    if (!user || user.role !== "logistics") return;
    fetchData();
  }, [user, fetchData]);

  if (user?.role !== "logistics") return null;

  return (
    <div className="flex w-full min-w-0 flex-col bg-[var(--bg-primary)] pb-[max(6rem,env(safe-area-inset-bottom,1.25rem))] text-[var(--text-primary)] lg:pb-12">
      <LogisticsSubpageHeader
        Icon={MapPin}
        title="Live"
        accentTitle="tracking"
        tag="Signal stream"
        hint="Newest customer orders first, or switch to assignment time. Tap a row to open tracking detail."
        fullWidth
        actions={
          <button
            type="button"
            onClick={() => fetchData()}
            className="flex size-11 min-h-[2.75rem] min-w-[2.75rem] touch-manipulation items-center justify-center rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] transition hover:bg-white/5"
            aria-label="Refresh"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        }
      />

      <div className="w-full min-w-0 space-y-6 px-3 py-5 sm:space-y-8 sm:px-5 sm:py-6 md:px-8 md:py-8">
        {(() => {
          const totalShipments = counts.active + counts.pending + counts.delivered || 1;
          const activePct  = Math.round((counts.active    / totalShipments) * 100);
          const pendingPct = Math.round((counts.pending   / totalShipments) * 100);
          const delivPct   = Math.round((counts.delivered / totalShipments) * 100);
          return (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
              <StatCard label="Wallet" value={`${balance.toLocaleString()} XAF`} sub="Settlement balance" icon="account_balance_wallet" color="purple" href="/logistics/wallet" footer="Tap to manage funds" />
              <StatCard label="In transit" value={String(counts.active)} sub="Pickup → delivery" icon="local_shipping" color="indigo" progress={activePct} footer={`${activePct}% of workload`} />
              <StatCard label="Awaiting pickup" value={String(counts.pending)} sub="New tickets" icon="schedule" color="amber" progress={pendingPct} footer={`${pendingPct}% of workload`} />
              <StatCard label="Delivered" value={String(counts.delivered)} sub="Completed" icon="verified" color="emerald" progress={delivPct} footer={`${delivPct}% success rate`} />
            </div>
          );
        })()}

        <LogisticsShortcutsRow
          links={[
            {
              label: "Dashboard",
              sub: "Overview",
              href: "/logistics/dashboard",
              icon: LayoutDashboard,
            },
            {
              label: "Manifests",
              sub: "Update status",
              href: "/logistics/manifests",
              icon: List,
            },
            {
              label: "Route pricing",
              sub: "Zones & fees",
              href: "/logistics/pricing",
              icon: LineChart,
            },
          ]}
        />

        <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setPage(1);
            }}
            className="min-h-11 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 py-2.5 text-[11px] font-semibold outline-none sm:w-auto sm:min-h-10 sm:text-[10px] md:text-[11px]"
          >
            <option value="order_placed">Recent orders first</option>
            <option value="assignment">Recent assignments first</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPage(1);
            }}
            className="min-h-11 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 py-2.5 text-[11px] font-semibold outline-none sm:w-auto sm:min-h-10 sm:text-[10px] md:text-[11px]"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="active">In transit (active)</option>
            <option value="assigned">Assigned</option>
            <option value="picked_up">Picked up</option>
            <option value="in_transit">In transit</option>
            <option value="out_for_delivery">Out for delivery</option>
            <option value="delivered">Delivered</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled / vendor</option>
          </select>
        </div>

        <section className="overflow-hidden rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/10">
          <div className="border-b border-[var(--glass-border)] px-4 py-4 md:px-8">
            <p className="font-mono text-[10px] font-semibold text-[var(--text-secondary)] opacity-50">
              {total} log{total === 1 ? "" : "s"} · page {page}/{pages || 1}
            </p>
          </div>

          <div className="p-3 md:p-6">
            {loading && shipments.length === 0 ? (
              <div className="flex justify-center py-20">
                <Loader2 className="size-8 animate-spin text-[var(--accent)] opacity-50" />
              </div>
            ) : shipments.length === 0 ? (
              <p className="py-16 text-center text-[12px] font-medium text-[var(--text-secondary)] opacity-60">
                No shipment activity for this filter.
              </p>
            ) : (
              <div className="space-y-2">
                {shipments.map((s) => {
                  const order = s.order_id;
                  const dest = destinationLine(s);
                  const placed = order?.createdAt
                    ? new Date(order.createdAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "—";
                  return (
                    <button
                      key={s._id}
                      type="button"
                      onClick={() =>
                        router.push(`/logistics/tracking?shipment=${s._id}`)
                      }
                      className="flex w-full touch-manipulation flex-col gap-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/50 p-4 text-left transition hover:border-[var(--accent)]/30 active:scale-[0.99] md:flex-row md:items-center md:justify-between"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="font-mono text-[12px] font-bold text-[var(--accent)]">
                          {s.tracking_code}
                        </p>
                        <p className="text-[11px] text-[var(--text-secondary)] opacity-70">
                          {dest.main}
                          {dest.sub ? ` · ${dest.sub}` : ""}
                        </p>
                        <p className="line-clamp-2 text-[11px] text-[var(--text-secondary)]">
                          {summarizeLineItems(order)}
                        </p>
                        <p className="text-[10px] font-medium opacity-45">
                          Order placed {placed}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-2.5 py-1 text-[10px] font-semibold capitalize">
                        {(s.status || "").replace(/_/g, " ")}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {total > 0 ? (
            <div className="flex flex-col items-center justify-between gap-3 border-t border-[var(--glass-border)] px-4 py-5 md:flex-row md:px-8">
              <p className="text-[11px] font-medium text-[var(--text-secondary)] opacity-70">
                Showing {(page - 1) * PAGE_SIZE + 1}–
                {Math.min(page * PAGE_SIZE, total)} of {total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-[var(--glass-border)] px-3 py-2 text-[11px] font-semibold transition enabled:hover:bg-[var(--bg-secondary)] disabled:opacity-40"
                >
                  <ChevronLeft className="size-4" /> Previous
                </button>
                <span className="min-w-[4rem] text-center font-mono text-[11px] opacity-70">
                  {page} / {pages || 1}
                </span>
                <button
                  type="button"
                  disabled={page >= pages || loading}
                  onClick={() => setPage((p) => (p < pages ? p + 1 : p))}
                  className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-[var(--glass-border)] px-3 py-2 text-[11px] font-semibold transition enabled:hover:bg-[var(--bg-secondary)] disabled:opacity-40"
                >
                  Next <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
