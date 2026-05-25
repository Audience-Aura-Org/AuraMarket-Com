"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import {
  Loader2,
  Truck,
  Cuboid,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Package,
  MapPin,
  ChevronRight,
  ChevronLeft,
  Activity,
  LineChart,
  LayoutDashboard,
  Calendar,
  Wallet,
  ArrowRight,
} from "lucide-react";
import api from "@/services/api";
import { useAuthStore } from "@/hooks/useAuth";
import StatCard from "@/components/layout/StatCard";
import ShipmentStatusModal from "@/components/logistics/ShipmentStatusModal";

const PAGE_SIZE = 10;

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

function summarizeLineItems(order) {
  if (!order?.products?.length) return "—";
  const parts = order.products.slice(0, 2).map((p) => {
    const name = (typeof p.product_id === "object" && p.product_id?.name) || p.name || "Item";
    return `${name} ×${p.quantity ?? 1}`;
  });
  const extra = order.products.length > 2 ? ` +${order.products.length - 2}` : "";
  return parts.join(" · ") + extra;
}

function destinationLine(s) {
  const d = s.delivery_address;
  if (!d || (!d.city && !d.region && !d.quartier)) return { main: "—", sub: "" };
  const main = d.city || d.quartier || d.region || "—";
  const sub = [d.quartier, d.region].filter(Boolean).join(" · ") || "";
  return { main, sub };
}

export default function LogisticsManifestsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [loading, setLoading]               = useState(true);
  const [updating, setUpdating]             = useState(false);
  const [shipments, setShipments]           = useState([]);
  const [balance, setBalance]               = useState(0);
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
      const [shipRes, walletRes] = await Promise.all([
        api.get("/logistics/shipments/firm", {
          params: { page, limit: PAGE_SIZE, status: statusFilter, sortBy, search: opts.search ?? search },
        }),
        api.get("/wallet"),
      ]);
      if (shipRes.data.success) {
        const list = shipRes.data.data?.shipments ?? shipRes.data.shipments ?? [];
        setShipments(list);
        setTotal(shipRes.data.total ?? list.length);
        setPages(shipRes.data.pages ?? 1);
        const m = shipRes.data.meta?.counts;
        if (m) setCounts({ pending: m.pending ?? 0, active: m.active ?? 0, delivered: m.delivered ?? 0 });
      }
      if (walletRes.data.success) setBalance(walletRes.data.data?.balance ?? 0);
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
      <header className="relative z-20 min-w-0 max-w-[100vw] border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/40 backdrop-blur-xl">
        <div className="mx-auto flex min-w-0 max-w-[1600px] flex-col gap-4 px-3 py-4 sm:px-5 sm:py-5 md:flex-row md:items-center md:justify-between md:px-8 md:py-6">
          <div className="flex min-w-0 items-center gap-3 md:gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--accent)]/25 bg-[var(--accent)]/10 md:size-12">
              <Cuboid className="size-5 text-[var(--accent)] md:size-6" strokeWidth={1.4} />
            </div>
            <div className="min-w-0">
              <h1 className="text-balance text-xl font-bold tracking-tight md:text-2xl">
                Manifests <span className="text-[var(--accent)]">Ledger</span>
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)] opacity-50">
                    Live Ledger
                  </span>
                </span>
                <span className="hidden text-[var(--text-secondary)] opacity-30 sm:inline">·</span>
                <span className="text-[10px] font-medium text-[var(--text-secondary)] opacity-60">
                  {total} total tickets
                </span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 md:gap-3">
            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--text-secondary)] opacity-40" />
              <input
                type="text"
                placeholder="Find tracking code…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleSearchKey}
                className="h-11 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] pl-9 pr-3 text-[11px] font-semibold outline-none ring-[var(--accent)]/20 focus:ring-4"
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
          </div>
        </div>
      </header>

      {/* ── Detail view ── */}
      {viewingShipmentId ? (
        <div className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-1 flex-col px-3 py-5 sm:px-5 sm:py-6 md:px-8 md:py-8">
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
        <div className="mx-auto w-full min-w-0 max-w-[1600px] space-y-6 px-3 py-5 sm:space-y-8 sm:px-5 sm:py-6 md:px-8 md:py-8">

          {/* ── KPI cards — same StatCard grid as dashboard ── */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <StatCard
              label="Wallet"
              value={`${balance.toLocaleString()} XAF`}
              sub="Available balance"
              icon="account_balance_wallet"
              color="purple"
              href="/wallet"
            />
            <StatCard
              label="In transit"
              value={String(counts.active)}
              sub="Pickup → delivery"
              icon="local_shipping"
              color="indigo"
            />
            <StatCard
              label="Awaiting pickup"
              value={String(counts.pending)}
              sub="Open assignments"
              icon="schedule"
              color="amber"
            />
            <StatCard
              label="Delivered"
              value={String(counts.delivered)}
              sub="Closed successfully"
              icon="verified"
              color="emerald"
            />
          </div>

          {/* ── Quick nav — same style as dashboard shortcuts ── */}
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-3 sm:grid-cols-3">
            {[
              { label: "Dashboard",    sub: "Overview",      icon: LayoutDashboard, href: "/logistics/dashboard" },
              { label: "Pricing",      sub: "Zones & rates", icon: LineChart,        href: "/logistics/pricing"   },
              { label: "Analytics",    sub: "Performance",   icon: Activity,         href: "/logistics/analytics" },
            ].map((item) => (
              <button
                key={item.href}
                type="button"
                onClick={() => router.push(item.href)}
                className="flex min-h-[3.25rem] touch-manipulation items-center gap-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/60 px-4 py-3 text-left transition hover:border-[var(--accent)]/35 active:scale-[0.99]"
              >
                <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
                  <item.icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold tracking-tight text-[var(--text-primary)]">{item.label}</p>
                  <p className="text-[10px] font-medium text-[var(--text-secondary)] opacity-60">{item.sub}</p>
                </div>
                <ChevronRight className="size-4 shrink-0 opacity-30" />
              </button>
            ))}
          </div>

          {/* ── Shipment ledger ── */}
          <section className="rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/10 p-3 sm:p-4 md:p-8">
            <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between">
              <div className="flex items-center gap-2 md:gap-3">
                <Cuboid className="size-5 shrink-0 text-[var(--accent)]" strokeWidth={1.4} />
                <div>
                  <h2 className="text-lg font-bold tracking-tight md:text-xl">Active Assignments</h2>
                  <p className="mt-0.5 text-[10px] font-medium text-[var(--text-secondary)] opacity-70 md:text-[11px]">
                    {sortBy === "order_placed" ? "Sorted by customer order date (newest first)." : "Sorted by assignment time (newest first)."}
                  </p>
                </div>
              </div>

              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                <select
                  value={sortBy}
                  onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
                  className="min-h-11 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 py-2.5 text-[11px] font-semibold text-[var(--text-primary)] outline-none sm:w-auto sm:min-h-10 sm:text-[10px] md:text-[11px]"
                >
                  <option value="order_placed">Recent orders first</option>
                  <option value="assignment">Recent assignments first</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                  className="min-h-11 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 py-2.5 text-[11px] font-semibold text-[var(--text-primary)] outline-none sm:w-auto sm:min-h-10 sm:text-[10px] md:text-[11px]"
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
                        const vendorName = typeof vendor === "object" ? vendor.store_name || vendor.name : "—";
                        const customerName = typeof customer === "object" ? customer.name : "—";
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
                    const vendorName = typeof vendor === "object" ? vendor.store_name || vendor.name : "—";
                    const receiverName = customer?.name || s.proof_of_delivery?.receiver_name || "—";
                    return (
                      <div
                        key={s._id}
                        className="space-y-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-mono text-[11px] font-semibold">{s.tracking_code}</p>
                            <p className="text-[10px] opacity-45">#{s._id?.slice(-8).toUpperCase()}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => openShipmentDetail(s)}
                            className="min-h-11 shrink-0 touch-manipulation rounded-xl border border-[var(--glass-border)] px-3 py-2 text-[11px] font-semibold"
                          >
                            Open
                          </button>
                        </div>
                        <div className="border-t border-[var(--glass-border)] pt-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)] opacity-50">Vendor & Receiver</p>
                          <p className="mt-1 text-[11px] font-semibold text-[var(--text-primary)]">{vendorName}</p>
                          <p className="text-[11px] text-[var(--text-primary)] opacity-75">{receiverName}</p>
                        </div>
                        <div className="border-t border-[var(--glass-border)] pt-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)] opacity-50">Items</p>
                          <p className="mt-1 text-[12px] font-medium leading-snug">{summarizeLineItems(order)}</p>
                        </div>
                        <div className="flex items-start gap-2 border-t border-[var(--glass-border)] pt-3">
                          <MapPin className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />
                          <div className="min-w-0">
                            <p className="text-[12px] font-semibold">{dest.main}</p>
                            {dest.sub ? <p className="text-[10px] opacity-55">{dest.sub}</p> : null}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--glass-border)] pt-3 text-[11px]">
                          <span className="font-mono font-semibold">
                            {typeof s.price === "number" ? `${s.price.toLocaleString()} XAF` : "—"}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeCls}`}>
                            {s.status === "cancelled" ? "Vendor managed" : s.status?.replace(/_/g, " ")}
                          </span>
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
                  <div className="mt-6 flex flex-col items-center justify-between gap-3 border-t border-[var(--glass-border)] pt-6 sm:flex-row">
                    <p className="text-[11px] font-medium text-[var(--text-secondary)] opacity-70">
                      Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, total)} of {total}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={currentPage <= 1 || loading}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-[var(--glass-border)] px-3 py-2 text-[11px] font-semibold transition enabled:hover:bg-[var(--bg-secondary)] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ChevronLeft className="size-4" /> Previous
                      </button>
                      <span className="min-w-[4rem] text-center font-mono text-[11px] font-semibold opacity-70">
                        {currentPage} / {pages}
                      </span>
                      <button
                        type="button"
                        disabled={currentPage >= pages || loading}
                        onClick={() => setCurrentPage((p) => (p < pages ? p + 1 : p))}
                        className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-[var(--glass-border)] px-3 py-2 text-[11px] font-semibold transition enabled:hover:bg-[var(--bg-secondary)] disabled:cursor-not-allowed disabled:opacity-40"
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
