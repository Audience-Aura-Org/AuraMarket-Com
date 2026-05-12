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
  User,
  ChevronRight,
  ChevronLeft,
  LayoutDashboard,
  Activity,
  LineChart,
  ArrowRight,
  Calendar,
  Wallet,
  TrendingUp,
} from "lucide-react";
import api from "@/services/api";
import { useAuthStore } from "@/hooks/useAuth";
import ShipmentStatusModal from "@/components/logistics/ShipmentStatusModal";

const PAGE_SIZE = 10;

const STATUS_THEMES = {
  pending: {
    icon: Clock,
    color: "var(--accent)",
    bg: "rgba(var(--accent-rgb), 0.1)",
    border: "rgba(var(--accent-rgb), 0.2)",
    label: "Awaiting pickup",
  },
  assigned: {
    icon: Package,
    color: "#a855f7",
    bg: "rgba(168, 85, 247, 0.1)",
    border: "rgba(168, 85, 247, 0.2)",
    label: "Assigned",
  },
  picked_up: {
    icon: Package,
    color: "#3b82f6",
    bg: "rgba(59, 130, 246, 0.1)",
    border: "rgba(59, 130, 246, 0.2)",
    label: "Picked up",
  },
  in_transit: {
    icon: Truck,
    color: "#6366f1",
    bg: "rgba(99, 102, 241, 0.1)",
    border: "rgba(99, 102, 241, 0.2)",
    label: "In transit",
  },
  out_for_delivery: {
    icon: Truck,
    color: "#06b6d4",
    bg: "rgba(6, 182, 212, 0.1)",
    border: "rgba(6, 182, 212, 0.2)",
    label: "Out for delivery",
  },
  delivered: {
    icon: CheckCircle2,
    color: "#10b981",
    bg: "rgba(16, 185, 129, 0.1)",
    border: "rgba(16, 185, 129, 0.2)",
    label: "Delivered",
  },
  failed: {
    icon: AlertCircle,
    color: "#ef4444",
    bg: "rgba(239, 68, 68, 0.1)",
    border: "rgba(239, 68, 68, 0.2)",
    label: "Failed",
  },
};

function summarizeLineItems(order) {
  if (!order?.products?.length) return null;
  const parts = order.products.slice(0, 2).map((p) => {
    const name = (typeof p.product_id === "object" && p.product_id?.name) || p.name || "Item";
    return `${name} x${p.quantity ?? 1}`;
  });
  const extra = order.products.length > 2 ? ` +${order.products.length - 2}` : "";
  return parts.join(", ") + extra;
}

export default function LogisticsManifestsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [shipments, setShipments] = useState([]);
  const [balance, setBalance] = useState(0);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [counts, setCounts] = useState({ pending: 0, active: 0, delivered: 0 });

  const [selectedShipment, setSelectedShipment] = useState(null);
  const [viewingShipmentId, setViewingShipmentId] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("order_placed");

  const [updateData, setUpdateData] = useState({
    status: "pending",
    note: "",
    proof_image: "",
    failure_reason: "",
    receiver_name: "",
  });

  const fetchManifests = useCallback(async (opts = {}) => {
    const page = opts.page ?? currentPage;
    try {
      setLoading(true);
      const [shipRes, walletRes] = await Promise.all([
        api.get("/logistics/shipments/firm", {
          params: {
            page,
            limit: PAGE_SIZE,
            status: statusFilter,
            sortBy,
            search: opts.search ?? search,
          },
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
    if (fromList) {
      setSelectedShipment(fromList);
      seedUpdateForm(fromList);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    api
      .get(`/logistics/shipments/${vid}`)
      .then((res) => {
        if (cancelled) return;
        if (res.data.success && res.data.data?.shipment) {
          const s = res.data.data.shipment;
          setSelectedShipment(s);
          seedUpdateForm(s);
        } else {
          toast.error("Shipment not found.");
          handleBack();
        }
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err?.response?.data?.message || "Failed to load shipment.");
          handleBack();
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [viewingShipmentId, shipments, selectedShipment, handleBack, seedUpdateForm]);

  useEffect(() => {
    if (user?.role === "logistics") fetchManifests();
  }, [user, fetchManifests]);

  const handleSearchKey = (e) => {
    if (e.key === "Enter") {
      setSearch(searchInput.trim());
      setCurrentPage(1);
    }
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
      if (res.data.success) {
        toast.success("Shipment updated");
        handleBack();
        fetchManifests();
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Update failed");
    } finally {
      setUpdating(false);
    }
  };

  if (user?.role !== "logistics") return null;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-[var(--bg-primary)] pb-[max(6rem,env(safe-area-inset-bottom,1.25rem))] text-[var(--text-primary)] lg:pb-8">
      
      {/* Header Container */}
      <header className="sticky top-0 z-30 shrink-0 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:px-5 sm:py-5 md:px-8 md:py-6">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-[1.1rem] bg-gradient-to-br from-[var(--accent)] to-[var(--accent)]/60 shadow-[0_8px_16px_-4px_rgba(var(--accent-rgb),0.3)] sm:size-14 sm:rounded-[1.25rem]">
              <Cuboid className="size-6 text-[var(--bg-primary)] sm:size-7" strokeWidth={1.35} aria-hidden />
            </div>
            <div className="min-w-0">
              <h1 className="text-balance text-xl font-black tracking-tight sm:text-2xl md:text-3xl">Manifests</h1>
              <div className="mt-1 flex items-center gap-2">
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 border border-emerald-500/20">
                  <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Live Ledger</span>
                </span>
                <span className="text-[11px] font-medium text-[var(--text-secondary)] opacity-40">#{total} tickets</span>
              </div>
            </div>
          </div>

          <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:shrink-0 sm:gap-3">
            <div className="relative min-w-0 flex-1 sm:flex-initial md:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-secondary)] opacity-40 sm:left-4" />
              <input
                type="text"
                placeholder="Find tracking code…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleSearchKey}
                className="h-11 min-h-11 w-full rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/50 pl-10 pr-3 text-xs font-bold outline-none ring-[var(--accent)]/20 focus:ring-4 sm:h-12 sm:pl-11 sm:pr-4"
              />
            </div>
            <button
              type="button"
              onClick={() => fetchManifests()}
              className="flex size-11 min-h-11 min-w-11 shrink-0 touch-manipulation items-center justify-center rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 hover:bg-[var(--bg-secondary)] transition-colors active:scale-95 sm:size-12"
            >
              <RefreshCw className={`size-5 text-[var(--text-secondary)] ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      {viewingShipmentId ? (
        <div className="mx-auto flex h-full min-h-0 w-full max-w-[1400px] flex-1 flex-col px-4 py-5 sm:px-6 sm:py-6 lg:px-10 lg:py-8">
          {detailLoading && !selectedShipment ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 rounded-[2.5rem] border border-dashed border-[var(--glass-border)] py-12">
              <Loader2 className="size-10 animate-spin text-[var(--accent)] opacity-40" />
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-50">Loading shipment…</p>
            </div>
          ) : selectedShipment ? (
            <div className="flex h-full min-h-0 flex-1 flex-col animate-in fade-in slide-in-from-bottom-3 duration-500">
              <ShipmentStatusModal
                embedded
                open
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
      <main className="mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 flex-col space-y-8 px-3 py-6 sm:space-y-10 sm:px-5 sm:py-8 md:px-8">
        
        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Fleet Wallet", value: balance.toLocaleString(), unit: "XAF", icon: Wallet, color: "var(--accent)" },
            { label: "Active Routes", value: counts.active, sub: "Pickup → Delivery", icon: Truck, color: "#6366f1" },
            { label: "Open Tickets", value: counts.pending, sub: "Awaiting Action", icon: Clock, color: "#f59e0b" },
            { label: "Completed", value: counts.delivered, sub: "Closed Today", icon: CheckCircle2, color: "#10b981" },
          ].map((stat, i) => (
            <div key={i} className="group relative overflow-hidden rounded-[2rem] border border-[var(--glass-border)] bg-gradient-to-br from-[var(--bg-secondary)]/40 to-transparent p-6 shadow-sm transition-all hover:shadow-xl hover:border-[var(--accent)]/10">
              <stat.icon className="absolute -right-4 -top-4 size-24 rotate-12 opacity-[0.03] transition-transform group-hover:scale-110 group-hover:rotate-0" />
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-xl" style={{ backgroundColor: `${stat.color}15`, color: stat.color }}>
                    <stat.icon className="size-4" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-60">{stat.label}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black tracking-tight">{stat.value}</span>
                  {stat.unit && <span className="text-xs font-bold opacity-30">{stat.unit}</span>}
                </div>
                {stat.sub && <p className="text-[11px] font-medium text-[var(--text-secondary)] opacity-50">{stat.sub}</p>}
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-3 sm:grid-cols-3 sm:gap-3">
          {[
            { label: "Dashboard", icon: LayoutDashboard, href: "/logistics/dashboard" },
            { label: "Live Tracking", icon: Activity, href: "/logistics/tracking" },
            { label: "Zone Rates", icon: LineChart, href: "/logistics/pricing" },
          ].map((act, i) => (
            <button
              key={i}
              type="button"
              onClick={() => router.push(act.href)}
              className="flex min-h-[3.25rem] touch-manipulation flex-col items-center justify-center gap-2 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 px-2 py-3.5 transition-all hover:bg-[var(--bg-secondary)] active:scale-[0.98] min-[380px]:flex-row min-[380px]:gap-3 min-[380px]:py-4"
            >
              <act.icon className="size-4 text-[var(--accent)]" />
              <span className="text-[11px] font-bold tracking-tight">{act.label}</span>
            </button>
          ))}
        </div>

        {/* Ledger Section */}
        <section className="flex min-h-0 flex-1 flex-col space-y-6">
          <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between sm:px-2">
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <h2 className="text-lg font-bold tracking-tight sm:text-xl">Active Assignments</h2>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                className="min-h-11 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/40 px-3 py-2 text-[11px] font-bold text-[var(--text-primary)] outline-none sm:hidden"
              >
                <option value="all">All Records</option>
                <option value="pending">Pending</option>
                <option value="active">In Transit</option>
                <option value="delivered">Delivered</option>
                <option value="failed">Failed</option>
              </select>
              <div className="hidden h-5 w-px bg-[var(--glass-border)] sm:block" />
              <div className="hidden items-center gap-4 sm:flex">
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                  className="bg-transparent text-[11px] font-bold text-[var(--text-secondary)] outline-none hover:text-[var(--accent)]"
                >
                  <option value="all">All Records</option>
                  <option value="pending">Pending</option>
                  <option value="active">In Transit</option>
                  <option value="delivered">Delivered</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
            </div>
            <p className="shrink-0 font-mono text-[11px] font-bold text-[var(--text-secondary)] opacity-40">
              Page {currentPage} of {pages || 1}
            </p>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 content-start gap-4">
            {loading && shipments.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 py-32 rounded-[2.5rem] border border-dashed border-[var(--glass-border)]">
                <Loader2 className="size-10 animate-spin text-[var(--accent)] opacity-20" />
                <p className="text-xs font-bold text-[var(--text-secondary)] opacity-40 uppercase tracking-widest">Synchronizing Ledger…</p>
              </div>
            ) : shipments.length > 0 ? (
              shipments.map((shipment) => {
                const theme = STATUS_THEMES[shipment.status] || STATUS_THEMES.pending;
                const Icon = theme.icon;
                const items = summarizeLineItems(shipment.order_id);
                
                return (
                  <button
                    type="button"
                    key={shipment._id}
                    onClick={() => openShipmentDetail(shipment)}
                    className="group relative flex w-full touch-manipulation flex-col overflow-hidden rounded-[2rem] border border-[var(--glass-border)] bg-gradient-to-r from-[var(--bg-secondary)]/30 to-transparent p-1 transition-all hover:border-[var(--accent)]/30 hover:shadow-2xl hover:shadow-[var(--accent)]/5 active:scale-[0.99] sm:rounded-[2.5rem] md:flex-row"
                  >
                    <div className="flex flex-1 flex-col gap-6 p-6 sm:p-8 md:flex-row md:items-center">
                      
                      {/* Status Icon */}
                      <div className="flex size-16 shrink-0 items-center justify-center rounded-3xl border border-[var(--glass-border)] shadow-inner transition-transform group-hover:scale-105" style={{ backgroundColor: theme.bg, borderColor: theme.border }}>
                        <Icon className="size-8" style={{ color: theme.color }} />
                      </div>

                      {/* Info Body */}
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[12px] font-black tracking-tighter text-[var(--accent)] uppercase">
                            {shipment.tracking_code}
                          </span>
                          <span className="size-1 rounded-full bg-[var(--text-secondary)] opacity-20" />
                          <div className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider" style={{ backgroundColor: theme.bg, color: theme.color }}>
                            {theme.label}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-[var(--text-primary)]">
                            {shipment.pickup_address?.quartier || "Merchant"}
                          </span>
                          <ArrowRight className="size-4 text-[var(--accent)] opacity-40" />
                          <span className="text-sm font-bold text-[var(--text-primary)]">
                            {shipment.delivery_address?.quartier || "Recipient"}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                          {items && (
                            <div className="flex items-center gap-1.5 opacity-50">
                              <Package className="size-3.5" />
                              <span className="text-[11px] font-bold truncate max-w-[200px]">{items}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 opacity-50">
                            <Calendar className="size-3.5" />
                            <span className="text-[11px] font-bold">
                              {new Date(shipment.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Pricing & CTA */}
                      <div className="flex shrink-0 flex-row items-center justify-between border-t border-[var(--glass-border)] pt-6 md:flex-col md:items-end md:border-l md:border-t-0 md:pl-10 md:pt-0">
                        <div className="text-left md:text-right">
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-40">Payout</p>
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black tracking-tighter">{(shipment.price || 0).toLocaleString()}</span>
                            <span className="text-[10px] font-bold opacity-30">XAF</span>
                          </div>
                        </div>
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)] transition-all group-hover:bg-[var(--accent)] group-hover:text-[var(--bg-primary)] group-hover:translate-x-1">
                          <ChevronRight className="size-5" />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-32 opacity-30">
                <Cuboid className="mb-4 size-16" strokeWidth={1.15} aria-hidden />
                <p className="text-sm font-bold uppercase tracking-widest">No matching records found</p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-center gap-4 py-8">
              <button
                disabled={currentPage <= 1 || loading}
                onClick={() => setCurrentPage(p => p - 1)}
                className="flex size-12 items-center justify-center rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 disabled:opacity-20"
              >
                <ChevronLeft className="size-5" />
              </button>
              <div className="flex h-12 items-center rounded-2xl border border-[var(--glass-border)] px-6 font-mono text-[11px] font-black">
                {currentPage} / {pages}
              </div>
              <button
                disabled={currentPage >= pages || loading}
                onClick={() => setCurrentPage(p => p + 1)}
                className="flex size-12 items-center justify-center rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 disabled:opacity-20"
              >
                <ChevronRight className="size-5" />
              </button>
            </div>
          )}
        </section>
      </main>
      )}
    </div>
  );
}
