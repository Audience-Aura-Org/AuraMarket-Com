"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Package,
  Truck,
  MapPin,
  Activity,
  ChevronRight,
  RefreshCw,
  ChevronLeft,
  FileStack,
  LineChart,
  Wallet,
  Clock,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import api from "@/services/api";
import { useAuthStore } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import StatCard from "@/components/layout/StatCard";
import { formatVariantLabel } from "@/utils/variants";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

function summarizeLineItems(order) {
  if (!order?.products?.length) return "—";
  const parts = order.products.slice(0, 2).map((p) => {
    const name =
      (typeof p.product_id === "object" && p.product_id?.name) ||
      p.name ||
      "Item";
    const variant = formatVariantLabel(p.variant);
    return `${name}${variant ? ` (${variant})` : ""} x${p.quantity ?? 1}`;
  });
  const extra = order.products.length > 2 ? ` +${order.products.length - 2}` : "";
  return parts.join(" · ") + extra;
}

function destinationLine(s) {
  const d = s.delivery_address;
  if (!d || (!d.city && !d.region && !d.quartier))
    return { main: "—", sub: "" };
  const main = d.city || d.quartier || d.region || "—";
  const sub = [d.quartier, d.region].filter(Boolean).join(" · ") || "";
  return { main, sub };
}

export default function LogisticsDashboard() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const [shipments, setShipments] = useState([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
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

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const [shipRes, walletRes] = await Promise.all([
        api.get("/logistics/shipments", {
          params: {
            page,
            limit: PAGE_SIZE,
            status: filterStatus,
            sortBy,
          },
        }),
        api.get("/wallet"),
      ]);

      if (shipRes.data.success) {
        const payload = shipRes.data.data?.shipments ?? shipRes.data.shipments ?? [];
        setShipments(payload);
        setTotal(shipRes.data.total ?? payload.length);
        setPages(shipRes.data.pages ?? 1);
        const m = shipRes.data.meta?.counts;
        if (m) {
          setCounts({
            pending: m.pending ?? 0,
            active: m.active ?? 0,
            delivered: m.delivered ?? 0,
          });
        }
      }
      if (walletRes.data.success) {
        setBalance(walletRes.data.data?.balance ?? 0);
      }
    } catch (err) {
      console.error("Failed to fetch logistics dashboard:", err);
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, sortBy]);

  useEffect(() => {
    if (!user || user.role !== "logistics") return;
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 45000);
    return () => clearInterval(interval);
  }, [user, fetchDashboard]);

  useEffect(() => {
    setPage(1);
  }, [filterStatus, sortBy]);

  if (user?.role !== "logistics") return null;

  return (
    <div className="flex w-full min-w-0 flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] pb-[max(5.5rem,env(safe-area-inset-bottom,1.25rem))] lg:pb-10">
      {/* Hero header — first visual block */}
      <header className="relative z-20 min-w-0 max-w-[100vw] border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/40 backdrop-blur-xl">
        <div className="mx-auto flex min-w-0 max-w-[1600px] flex-col gap-4 px-3 py-4 sm:px-5 sm:py-5 md:flex-row md:items-center md:justify-between md:px-8 md:py-6">
          <div className="flex min-w-0 items-center gap-3 md:gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--accent)]/25 bg-[var(--accent)]/10 md:size-12">
              <Truck className="size-5 text-[var(--accent)] md:size-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-balance text-xl font-bold tracking-tight md:text-2xl">
                Logistics <span className="text-[var(--accent)]">Hub</span>
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)] opacity-50">
                    Network nominal
                  </span>
                </span>
                <span className="hidden text-[var(--text-secondary)] opacity-30 sm:inline">·</span>
                <span className="text-[10px] font-medium text-[var(--text-secondary)] opacity-60 line-clamp-3 md:line-clamp-none">
                  Vendor-managed fulfilment keeps the shipping fee with the vendor when they take over delivery.
                </span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 md:gap-3">
            <button
              type="button"
              onClick={() => fetchDashboard()}
              className="flex size-11 min-h-[2.75rem] min-w-[2.75rem] touch-manipulation items-center justify-center rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] transition-all hover:bg-white/5 active:scale-95"
              aria-label="Refresh"
            >
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <div className="hidden text-right sm:block">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)] opacity-40">
                {new Date().toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </p>
              <p className="truncate text-[10px] font-semibold text-[var(--text-secondary)] opacity-50">
                {user.name?.replace(/\s/g, "_") || "Partner"}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full min-w-0 max-w-[1600px] space-y-6 px-3 py-5 sm:space-y-8 sm:px-5 sm:py-6 md:px-8 md:py-8">
        {/* Exactly 4 KPI cards */}
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
            sub="New assignments"
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

        {/* Compact shortcuts — replaces mock “node saturation” */}
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-3 sm:grid-cols-3">
          {[
            {
              label: "Manifests",
              sub: "Ledger & batches",
              icon: FileStack,
              href: "/logistics/manifests",
            },
            {
              label: "Pricing",
              sub: "Zones & rates",
              icon: LineChart,
              href: "/logistics/pricing",
            },
            {
              label: "Analytics",
              sub: "Performance",
              icon: Activity,
              href: "/logistics/analytics",
            },
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
                <p className="text-[11px] font-bold tracking-tight text-[var(--text-primary)]">
                  {item.label}
                </p>
                <p className="text-[10px] font-medium text-[var(--text-secondary)] opacity-60">
                  {item.sub}
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0 opacity-30" />
            </button>
          ))}
        </div>

        {/* Shipment stream */}
        <section className="rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/10 p-3 sm:p-4 md:p-8">
          <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between">
            <div className="flex items-center gap-2 md:gap-3">
              <Activity className="size-5 shrink-0 text-[var(--accent)]" />
              <div>
                <h2 className="text-lg font-bold tracking-tight md:text-xl">
                  Shipment stream
                </h2>
                <p className="mt-0.5 text-[10px] font-medium text-[var(--text-secondary)] opacity-70 md:text-[11px]">
                  {sortBy === "order_placed"
                    ? "Sorted by customer order date (newest first)."
                    : "Sorted by assignment time (newest first)."}
                </p>
              </div>
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setPage(1);
                }}
                className="min-h-11 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 py-2.5 text-[11px] font-semibold text-[var(--text-primary)] outline-none sm:w-auto sm:min-h-10 sm:text-[10px] md:text-[11px]"
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
              <button
                type="button"
                onClick={() => router.push("/logistics/manifests")}
                className="inline-flex min-h-11 w-full touch-manipulation items-center justify-center gap-1.5 rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/10 px-3 text-[11px] font-semibold text-[var(--accent)] sm:w-auto sm:min-h-10 sm:text-[10px] md:text-[11px]"
              >
                Full ledger <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>

          {loading && shipments.length === 0 ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 py-12">
              <Loader2 className="size-8 animate-spin text-[var(--accent)] opacity-60" />
              <p className="text-[11px] font-medium text-[var(--text-secondary)]">
                Loading shipments…
              </p>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)] opacity-45 md:text-[11px]">
                      <th className="pb-3 pr-3">Tracking</th>
                      <th className="pb-3 pr-3">Items</th>
                      <th className="pb-3 pr-3">Destination</th>
                      <th className="pb-3 pr-3">Order placed</th>
                      <th className="pb-3 pr-3">Your fee</th>
                      <th className="pb-3 pr-3">Status</th>
                      <th className="pb-3 text-right">Open</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--glass-border)]">
                    {shipments.map((s) => {
                      const order = s.order_id;
                      const placed = order?.createdAt
                        ? new Date(order.createdAt).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : "—";
                      const dest = destinationLine(s);
                      const fee =
                        typeof s.price === "number"
                          ? `${s.price.toLocaleString()} XAF`
                          : "—";
                      return (
                        <tr
                          key={s._id}
                          className="group hover:bg-white/[0.02]"
                        >
                          <td className="py-3 pr-3 align-top">
                            <p className="font-mono text-[11px] font-semibold tracking-tight">
                              {s.tracking_code || "—"}
                            </p>
                            <p className="text-[10px] font-medium opacity-40">
                              #{s._id?.slice(-8).toUpperCase()}
                            </p>
                          </td>
                          <td className="max-w-[220px] py-3 pr-3 align-top">
                            <p className="line-clamp-2 text-[11px] leading-snug text-[var(--text-primary)]">
                              {summarizeLineItems(order)}
                            </p>
                            {order?.products?.length ? (
                              <p className="mt-0.5 text-[10px] font-medium text-[var(--text-secondary)] opacity-55">
                                {order.products.length} line
                                {order.products.length === 1 ? "" : "s"}
                              </p>
                            ) : null}
                          </td>
                          <td className="py-3 pr-3 align-top">
                            <p className="truncate text-[11px] font-semibold">
                              {dest.main}
                            </p>
                            {dest.sub ? (
                              <p className="truncate text-[10px] opacity-50">
                                {dest.sub}
                              </p>
                            ) : null}
                          </td>
                          <td className="whitespace-nowrap py-3 pr-3 align-top text-[11px] text-[var(--text-secondary)]">
                            {placed}
                          </td>
                          <td className="py-3 pr-3 align-top font-mono text-[11px] font-semibold">
                            {fee}
                          </td>
                          <td className="py-3 pr-3 align-top">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-tight ${
                                s.status === "delivered"
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                  : s.status === "pending"
                                    ? "bg-amber-500/10 text-amber-600"
                                    : s.status === "assigned"
                                      ? "bg-purple-500/10 text-purple-600"
                                      : s.status === "picked_up"
                                        ? "bg-blue-500/10 text-blue-600"
                                        : s.status === "in_transit"
                                          ? "bg-indigo-500/10 text-indigo-500"
                                          : s.status === "out_for_delivery"
                                            ? "bg-cyan-500/10 text-cyan-600"
                                            : s.status === "failed"
                                              ? "bg-rose-500/10 text-rose-600"
                                              : s.status === "cancelled"
                                                ? "bg-rose-500/10 text-rose-600"
                                                : "bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
                              }`}
                            >
                              {s.status === "cancelled"
                                ? "Vendor managed"
                                : s.status?.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="py-3 text-right align-top">
                            <button
                              type="button"
                              onClick={() =>
                                router.push(
                                  `/logistics/tracking?shipment=${s._id}`
                                )
                              }
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

              <div className="space-y-3 md:hidden">
                {shipments.map((s) => {
                  const order = s.order_id;
                  const dest = destinationLine(s);
                  return (
                    <div
                      key={s._id}
                      className="space-y-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-mono text-[11px] font-semibold">
                            {s.tracking_code}
                          </p>
                          <p className="text-[10px] opacity-45">
                            #{s._id?.slice(-8).toUpperCase()}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            router.push(
                              `/logistics/tracking?shipment=${s._id}`
                            )
                          }
                          className="min-h-11 shrink-0 touch-manipulation rounded-xl border border-[var(--glass-border)] px-3 py-2 text-[11px] font-semibold"
                        >
                          Open
                        </button>
                      </div>
                      <div className="border-t border-[var(--glass-border)] pt-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)] opacity-50">
                          Items
                        </p>
                        <p className="mt-1 text-[12px] font-medium leading-snug">
                          {summarizeLineItems(order)}
                        </p>
                      </div>
                      <div className="flex items-start gap-2 border-t border-[var(--glass-border)] pt-3">
                        <MapPin className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />
                        <div className="min-w-0">
                          <p className="text-[12px] font-semibold">{dest.main}</p>
                          {dest.sub ? (
                            <p className="text-[10px] opacity-55">{dest.sub}</p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--glass-border)] pt-3 text-[11px]">
                        <span className="font-mono font-semibold">
                          {typeof s.price === "number"
                            ? `${s.price.toLocaleString()} XAF`
                            : "—"}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            s.status === "delivered"
                              ? "bg-emerald-500/10 text-emerald-600"
                              : "bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
                          }`}
                        >
                          {s.status === "cancelled"
                            ? "Vendor managed"
                            : s.status?.replace(/_/g, " ")}
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
                    Showing {(page - 1) * PAGE_SIZE + 1}–
                    {Math.min(page * PAGE_SIZE, total)} of {total}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={page <= 1 || loading}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-[var(--glass-border)] px-3 py-2 text-[11px] font-semibold transition enabled:hover:bg-[var(--bg-secondary)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronLeft className="size-4" /> Previous
                    </button>
                    <span className="min-w-[4rem] text-center font-mono text-[11px] font-semibold opacity-70">
                      {page} / {pages}
                    </span>
                    <button
                      type="button"
                      disabled={page >= pages || loading}
                      onClick={() =>
                        setPage((p) => (p < pages ? p + 1 : p))
                      }
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
    </div>
  );
}
