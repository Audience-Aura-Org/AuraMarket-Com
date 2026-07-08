"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import {
  Loader2,
  Cuboid,
  Search,
  RefreshCw,
  Package,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  LayoutDashboard,
  LineChart,
  Activity,
  MapPin,
} from "lucide-react";
import api from "@/services/api";
import { useAuthStore } from "@/hooks/useAuth";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import StatCard from "@/components/layout/StatCard";
import ShipmentStatusModal from "@/components/logistics/ShipmentStatusModal";
import { summarizeLineItems, destinationLine } from "@/lib/logistics";
import {
  LogisticsSubpageHeader,
  LogisticsShortcutsRow,
} from "@/components/logistics/LogisticsSubpageShell";

const PAGE_SIZE = 10;

const isRecord = (value) => value && typeof value === "object";

const displayName = (value, fields = ["name"], fallback = "—") => {
  if (!isRecord(value)) return fallback;
  for (const field of fields) {
    const candidate = value[field];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return fallback;
};

const STATUS_BADGE = {
  pending:          "bg-amber-500/10 text-amber-600",
  assigned:         "bg-purple-500/10 text-purple-600",
  picked_up:        "bg-blue-500/10 text-blue-600",
  in_transit:       "bg-indigo-500/10 text-indigo-500",
  out_for_delivery: "bg-cyan-500/10 text-cyan-600",
  delivered:        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  failed:           "bg-rose-500/10 text-rose-600",
  cancelled:        "bg-rose-500/10 text-rose-600",
};


export default function LogisticsManifestsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const { displayedBalance: balance } = useWalletBalance();

  const [loading, setLoading]               = useState(true);
  const [updating, setUpdating]             = useState(false);
  const [shipments, setShipments]           = useState([]);
  const [total, setTotal]                   = useState(0);
  const [pages, setPages]                   = useState(1);
  const [currentPage, setCurrentPage]       = useState(1);
  const [counts, setCounts]                 = useState({ pending: 0, active: 0, delivered: 0 });
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [viewingShipmentId, setViewingShipmentId] = useState(null);
  const [detailLoading, setDetailLoading]   = useState(false);
  const [searchInput, setSearchInput]       = useState("");
  const [search, setSearch]                 = useState("");
  const [statusFilter, setStatusFilter]     = useState("all");
  const [sortBy, setSortBy]                 = useState("order_placed");
  const [updateData, setUpdateData]         = useState({
    status: "pending", note: "", proof_image: "", failure_reason: "", receiver_name: "",
  });

  const fetchManifests = useCallback(async (opts = {}) => {
    const page = opts.page ?? currentPage;
    try {
      setLoading(true);
      const shipRes = await api.get("/logistics/shipments/firm", {
        params: { page, limit: PAGE_SIZE, status: statusFilter, sortBy, search: opts.search ?? search },
      });
      if (shipRes.data.success) {
        const list = shipRes.data.data?.shipments ?? shipRes.data.shipments ?? [];
        setShipments(list);
        setTotal(shipRes.data.total ?? list.length);
        setPages(shipRes.data.pages ?? 1);
        const m = shipRes.data.meta?.counts;
        setCounts({ pending: m?.pending ?? 0, active: m?.active ?? 0, delivered: m?.delivered ?? 0 });
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load manifests");
    } finally {
      setLoading(false);
    }
  }, [currentPage, statusFilter, sortBy, search]);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("shipmentId");
    if (id) setViewingShipmentId(id);
  }, []);

  useEffect(() => {
    const onPop = () => {
      const id = new URLSearchParams(window.location.search).get("shipmentId");
      setViewingShipmentId(id || null);
      if (!id) setSelectedShipment(null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const seedUpdateForm = useCallback((shipment) => {
    if (!shipment) return;
    setUpdateData({
      status: shipment.status || "pending",
      note: shipment.proof_of_delivery?.note || "",
      proof_image: shipment.proof_of_delivery?.image_url || "",
      failure_reason: shipment.failure_reason || "",
      receiver_name: shipment.proof_of_delivery?.receiver_name || "",
    });
  }, []);

  const handleBack = useCallback(() => {
    setViewingShipmentId(null);
    setSelectedShipment(null);
    setDetailLoading(false);
    const url = new URL(window.location.href);
    url.searchParams.delete("shipmentId");
    window.history.pushState({}, "", url);
  }, []);

  useEffect(() => {
    if (!viewingShipmentId) return;
    const vid = String(viewingShipmentId);
    if (selectedShipment && String(selectedShipment._id) === vid) return;
    const fromList = shipments.find((s) => String(s._id) === vid);
    if (fromList) { setSelectedShipment(fromList); seedUpdateForm(fromList); return; }
    let cancelled = false;
    setDetailLoading(true);
    api.get(`/logistics/shipments/${vid}`)
      .then((res) => {
        if (cancelled) return;
        if (res.data.success && res.data.data?.shipment) {
          const s = res.data.data.shipment;
          setSelectedShipment(s);
          seedUpdateForm(s);
        } else { toast.error("Shipment not found."); handleBack(); }
      })
      .catch((err) => { if (!cancelled) { toast.error(err?.response?.data?.message || "Failed to load shipment."); handleBack(); } })
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [viewingShipmentId, shipments, selectedShipment, handleBack, seedUpdateForm]);

  useEffect(() => {
    if (user?.role === "logistics") fetchManifests();
  }, [user, fetchManifests]);

  const handleSearchKey = (e) => {
    if (e.key === "Enter") { setSearch(searchInput.trim()); setCurrentPage(1); }
  };

  const openShipmentDetail = (shipment) => {
    setViewingShipmentId(shipment._id);
    setSelectedShipment(shipment);
    seedUpdateForm(shipment);
    const url = new URL(window.location.href);
    url.searchParams.set("shipmentId", shipment._id);
    window.history.pushState({}, "", url);
  };

  const handleStatusUpdate = async (e) => {
    e.preventDefault();
    if (!selectedShipment?._id) return;
    setUpdating(true);
    try {
      const res = await api.patch(`/logistics/shipments/${selectedShipment._id}/status`, updateData);
      if (res.data.success) { toast.success("Shipment updated"); handleBack(); fetchManifests(); }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Update failed");
    } finally {
      setUpdating(false);
    }
  };

  if (user?.role !== "logistics") return null;

  return (
    <div className="flex w-full min-w-0 flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] pb-[max(5.5rem,env(safe-area-inset-bottom,1.25rem))] lg:pb-10">

      {/* ── Header ── */}
      <LogisticsSubpageHeader
        Icon={Cuboid}
        title="Manifests"
        accentTitle="Ledger"
        tag="Live Ledger"
        hint={`${total} total tickets`}
        actions={
          <>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--text-secondary)] opacity-40" />
              <input
                type="text"
                placeholder="Find tracking code…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleSearchKey}
                className="h-9 w-full rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] pl-9 pr-3 text-[11px] font-semibold placeholder:text-[11px] placeholder:font-normal placeholder:opacity-50 outline-none focus:border-[var(--accent)]/50 focus:ring-1 focus:ring-[var(--accent)]/20 transition-all"
              />
            </div>
            <button
              type="button"
              onClick={() => fetchManifests()}
              className="flex size-11 min-h-[2.75rem] min-w-[2.75rem] touch-manipulation items-center justify-center rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] transition-all hover:bg-white/5 active:scale-95"
              aria-label="Refresh"
            >
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </>
        }
      />

      {/* ── Detail view ── */}
      {viewingShipmentId ? (
        <div className="flex h-full min-h-0 w-full flex-1 flex-col px-3 py-5 sm:px-5 sm:py-6 md:px-8 md:py-8">
          {detailLoading && !selectedShipment ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 py-12">
              <Loader2 className="size-8 animate-spin text-[var(--accent)] opacity-60" />
              <p className="text-[11px] font-medium text-[var(--text-secondary)]">Loading shipment…</p>
            </div>
          ) : selectedShipment ? (
            <div className="flex h-full min-h-0 flex-1 flex-col animate-in fade-in slide-in-from-bottom-3 duration-500">
              <ShipmentStatusModal
                embedded open
                shipment={selectedShipment}
                updateData={updateData}
                setUpdateData={setUpdateData}
                updating={updating}
                onBack={handleBack}
                onClose={handleBack}
                onSubmit={handleStatusUpdate}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="w-full min-w-0 space-y-6 px-3 py-5 sm:space-y-8 sm:px-5 sm:py-6 md:px-8 md:py-8">

          {/* ── KPI cards — same StatCard grid as dashboard ── */}
          {(() => {
            const totalShipments = counts.active + counts.pending + counts.delivered || 1;
            const activePct  = Math.round((counts.active    / totalShipments) * 100);
            const pendingPct = Math.round((counts.pending   / totalShipments) * 100);
            const delivPct   = Math.round((counts.delivered / totalShipments) * 100);
            return (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
                <StatCard label="Wallet" value={`${balance.toLocaleString()} XAF`} sub="Available balance" icon="account_balance_wallet" color="purple" href="/logistics/wallet" footer="Tap to manage funds" />
                <StatCard label="In transit" value={String(counts.active)} sub="Pickup → delivery" icon="local_shipping" color="indigo" progress={activePct} footer={`${activePct}% of workload`} />
                <StatCard label="Awaiting pickup" value={String(counts.pending)} sub="Open assignments" icon="schedule" color="amber" progress={pendingPct} footer={`${pendingPct}% of workload`} />
                <StatCard label="Delivered" value={String(counts.delivered)} sub="Closed successfully" icon="verified" color="emerald" progress={delivPct} footer={`${delivPct}% success rate`} />
              </div>
            );
          })()}

          {/* ── Quick nav ── */}
          <LogisticsShortcutsRow
            links={[
              { label: "Dashboard", sub: "Ops overview",   icon: LayoutDashboard, href: "/logistics/dashboard" },
              { label: "Pricing",   sub: "Zones & rates",  icon: LineChart,        href: "/logistics/pricing"   },
              { label: "Analytics", sub: "Performance",    icon: Activity,         href: "/logistics/analytics" },
            ]}
          />

          {/* ── Shipment ledger ── */}
          <section className="rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/10 p-3 sm:p-4 md:p-8">
            <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between">
              <div className="flex items-center gap-2 md:gap-3">
                <Cuboid className="size-5 shrink-0 text-[var(--accent)]" strokeWidth={1.4} />
                <div>
                  <h2 className="text-sm font-bold tracking-tight md:text-base">Active Assignments</h2>
                  <p className="mt-0.5 text-[10px] font-medium text-[var(--text-secondary)] opacity-70 md:text-[11px]">
                    {sortBy === "order_placed" ? "Sorted by customer order date (newest first)." : "Sorted by assignment time (newest first)."}
                  </p>
                </div>
              </div>

              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                <select
                  value={sortBy}
                  onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
                  className="min-h-11 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 py-2.5 text-[10px] font-semibold text-[var(--text-primary)] outline-none transition focus:ring-2 focus:ring-[var(--accent)]/40 sm:w-auto sm:min-h-10"
                >
                  <option value="order_placed">📅 Recent orders</option>
                  <option value="assignment">🚚 Recent assignments</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                  className="min-h-11 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 py-2.5 text-[10px] font-semibold text-[var(--text-primary)] outline-none transition focus:ring-2 focus:ring-[var(--accent)]/40 sm:w-auto sm:min-h-10"
                >
                  <option value="all">📦 All statuses</option>
                  <option value="pending">⏳ Pending</option>
                  <option value="active">🔄 In transit (active)</option>
                  <option value="assigned">✓ Assigned</option>
                  <option value="picked_up">📤 Picked up</option>
                  <option value="in_transit">🚗 In transit</option>
                  <option value="out_for_delivery">🏃 Out for delivery</option>
                  <option value="delivered">✅ Delivered</option>
                  <option value="failed">❌ Failed</option>
                  <option value="cancelled">🛑 Cancelled / vendor</option>
                </select>
              </div>
            </div>

            {/* Loading */}
            {loading && shipments.length === 0 ? (
              <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 py-12">
                <Loader2 className="size-8 animate-spin text-[var(--accent)] opacity-60" />
                <p className="text-[11px] font-medium text-[var(--text-secondary)]">Synchronising ledger…</p>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)] opacity-45 md:text-[11px]">
                        <th className="pb-3 pr-3">Tracking</th>
                        <th className="pb-3 pr-3">Vendor</th>
                        <th className="pb-3 pr-3">Receiver</th>
                        <th className="pb-3 pr-3">Items</th>
                        <th className="pb-3 pr-3">Route</th>
                        <th className="pb-3 pr-3">Date</th>
                        <th className="pb-3 pr-3">Fee</th>
                        <th className="pb-3 pr-3">Status</th>
                        <th className="pb-3 text-right">Open</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--glass-border)]">
                      {shipments.map((s) => {
                        const order = s.order_id;
                        const vendor = s.vendor_id;
                        const customer = order?.customer_id;
                        const dest  = destinationLine(s);
                        const placed = order?.createdAt
                          ? new Date(order.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
                          : "—";
                        const fee = typeof s.price === "number" ? `${s.price.toLocaleString()} XAF` : "—";
                        const badgeCls = STATUS_BADGE[s.status] || "bg-[var(--bg-secondary)] text-[var(--text-secondary)]";
                        const vendorName = displayName(vendor, ["store_name", "name"]);
                        const customerName = displayName(customer, ["name"]);
                        const receiverName = s.proof_of_delivery?.receiver_name || customerName || "—";
                        return (
                          <tr key={s._id} className="group hover:bg-white/[0.02]">
                            <td className="py-3 pr-3 align-top">
                              <p className="font-mono text-[11px] font-semibold tracking-tight">{s.tracking_code || "—"}</p>
                              <p className="text-[10px] font-medium opacity-40">#{s._id?.slice(-8).toUpperCase()}</p>
                            </td>
                            <td className="py-3 pr-3 align-top">
                              <p className="truncate text-[11px] font-semibold text-[var(--text-primary)]">{vendorName}</p>
                            </td>
                            <td className="py-3 pr-3 align-top">
                              <p className="truncate text-[11px] text-[var(--text-primary)]">{receiverName}</p>
                            </td>
                            <td className="max-w-[220px] py-3 pr-3 align-top">
                              <p className="line-clamp-2 text-[11px] leading-snug text-[var(--text-primary)]">{summarizeLineItems(order)}</p>
                              {order?.products?.length ? (
                                <p className="mt-0.5 text-[10px] font-medium text-[var(--text-secondary)] opacity-55">
                                  {order.products.length} line{order.products.length === 1 ? "" : "s"}
                                </p>
                              ) : null}
                            </td>
                            <td className="py-3 pr-3 align-top">
                              <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                                <span className="truncate max-w-[80px]">{s.pickup_address?.quartier || "Pickup"}</span>
                                <ArrowRight className="size-3 shrink-0 text-[var(--accent)] opacity-50" />
                                <span className="truncate max-w-[80px]">{dest.main}</span>
                              </div>
                              {dest.sub && <p className="truncate text-[10px] opacity-50">{dest.sub}</p>}
                            </td>
                            <td className="whitespace-nowrap py-3 pr-3 align-top text-[11px] text-[var(--text-secondary)]">{placed}</td>
                            <td className="py-3 pr-3 align-top font-mono text-[11px] font-semibold">{fee}</td>
                            <td className="py-3 pr-3 align-top">
                              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-tight ${badgeCls}`}>
                                {s.status === "cancelled" ? "Vendor managed" : s.status?.replace(/_/g, " ")}
                              </span>
                            </td>
                            <td className="py-3 text-right align-top">
                              <button
                                type="button"
                                onClick={() => openShipmentDetail(s)}
                                className="inline-flex items-center gap-1 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-primary)] px-2 py-1 text-[10px] font-semibold opacity-80 transition hover:border-[var(--accent)]/40 hover:opacity-100"
                              >
                                View <ChevronRight className="size-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards — same style as dashboard shipment cards */}
                <div className="space-y-3 md:hidden">
                  {shipments.map((s) => {
                    const order = s.order_id;
                    const vendor = s.vendor_id;
                    const customer = order?.customer_id;
                    const dest  = destinationLine(s);
                    const badgeCls = STATUS_BADGE[s.status] || "bg-[var(--bg-secondary)] text-[var(--text-secondary)]";
                    const vendorName = displayName(vendor, ["store_name", "name"]);
                    const customerName = displayName(customer, ["name"]);
                    const receiverName = s.proof_of_delivery?.receiver_name || customerName || "—";
                    const placedDate = order?.createdAt
                      ? new Date(order.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                      : "—";
                    return (
                      <div
                        key={s._id}
                        onClick={() => openShipmentDetail(s)}
                        className="cursor-pointer space-y-0 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/40 backdrop-blur-sm transition active:scale-95 active:opacity-75"
                      >
                        {/* Top bar: Tracking + Status + Open Button */}
                        <div className="flex items-center justify-between gap-2 border-b border-[var(--glass-border)] px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-mono text-[12px] font-semibold tracking-tight">{s.tracking_code || "—"}</p>
                            <p className="text-[9px] opacity-40">ID: {s._id?.slice(-6).toUpperCase()}</p>
                          </div>
                          <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[9px] font-semibold tracking-tight whitespace-nowrap ${badgeCls}`}>
                            {s.status === "cancelled" ? "Vendor" : s.status?.replace(/_/g, " ")}
                          </span>
                        </div>

                        {/* Main content grid */}
                        <div className="space-y-3 px-4 py-3">
                          {/* Row 1: Vendor & Receiver */}
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                              <p className="text-[9px] font-semibold uppercase tracking-wide text-[var(--text-secondary)] opacity-50">Vendor</p>
                              <p className="mt-1 truncate text-[12px] font-semibold text-[var(--text-primary)]">{vendorName}</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-semibold uppercase tracking-wide text-[var(--text-secondary)] opacity-50">Receiver</p>
                              <p className="mt-1 truncate text-[12px] font-semibold text-[var(--text-primary)]">{receiverName}</p>
                            </div>
                          </div>

                          {/* Row 2: Items Summary */}
                          <div>
                            <p className="text-[9px] font-semibold uppercase tracking-wide text-[var(--text-secondary)] opacity-50">Items</p>
                            <p className="mt-1 line-clamp-2 text-[12px] font-medium leading-snug text-[var(--text-primary)]">
                              {summarizeLineItems(order)}
                            </p>
                          </div>

                          {/* Row 3: Route */}
                          <div>
                            <p className="text-[9px] font-semibold uppercase tracking-wide text-[var(--text-secondary)] opacity-50">Route</p>
                            <div className="mt-1 flex items-center gap-1.5">
                              <span className="truncate text-[12px] font-semibold">{s.pickup_address?.quartier || "Pickup"}</span>
                              <ArrowRight className="size-3 shrink-0 text-[var(--accent)] opacity-50" />
                              <span className="truncate text-[12px] font-semibold">{dest.main}</span>
                            </div>
                            {dest.sub && <p className="mt-0.5 truncate text-[10px] opacity-50">{dest.sub}</p>}
                          </div>

                          {/* Row 4: Meta — Date & Fee */}
                          <div className="grid grid-cols-2 gap-3 border-t border-[var(--glass-border)] pt-3">
                            <div>
                              <p className="text-[9px] font-semibold uppercase tracking-wide text-[var(--text-secondary)] opacity-50">Date</p>
                              <p className="mt-1 text-[11px] font-semibold">{placedDate}</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-semibold uppercase tracking-wide text-[var(--text-secondary)] opacity-50">Fee</p>
                              <p className="mt-1 font-mono text-[11px] font-semibold">
                                {typeof s.price === "number" ? `${s.price.toLocaleString()} XAF` : "—"}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Footer: Open button */}
                        <div className="border-t border-[var(--glass-border)] px-4 py-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openShipmentDetail(s);
                            }}
                            className="w-full min-h-11 touch-manipulation rounded-xl border border-[var(--accent)]/20 bg-[var(--accent)]/10 py-2.5 text-[12px] font-semibold text-[var(--accent)] transition active:scale-95"
                          >
                            View Full Details
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {shipments.length === 0 && !loading ? (
                  <div className="py-14 text-center">
                    <Package className="mx-auto mb-3 size-10 opacity-25" />
                    <p className="text-[12px] font-medium text-[var(--text-secondary)] opacity-70">
                      No shipments match this filter.
                    </p>
                  </div>
                ) : null}

                {/* Pagination */}
                {total > 0 ? (
                  <div className="mt-6 flex flex-col items-center justify-between gap-4 border-t border-[var(--glass-border)] pt-6 sm:flex-row">
                    <p className="text-center text-[10px] font-medium text-[var(--text-secondary)] opacity-70 sm:text-left">
                      Showing <span className="font-bold text-[var(--text-primary)]">{(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, total)}</span> of <span className="font-bold text-[var(--text-primary)]">{total}</span> tickets
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={currentPage <= 1 || loading}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-[var(--glass-border)] px-2 py-2 text-[10px] font-semibold transition enabled:hover:bg-[var(--bg-secondary)] disabled:cursor-not-allowed disabled:opacity-40 sm:px-3"
                      >
                        <ChevronLeft className="size-4" /> <span className="hidden sm:inline">Previous</span>
                      </button>
                      <div className="flex items-center gap-1">
                        <span className="min-w-[3rem] text-center font-mono text-[11px] font-semibold opacity-70">
                          {currentPage} <span className="opacity-50">/</span> {pages}
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={currentPage >= pages || loading}
                        onClick={() => setCurrentPage((p) => (p < pages ? p + 1 : p))}
                        className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-[var(--glass-border)] px-2 py-2 text-[10px] font-semibold transition enabled:hover:bg-[var(--bg-secondary)] disabled:cursor-not-allowed disabled:opacity-40 sm:px-3"
                      >
                        Next <ChevronRight className="size-4" />
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
