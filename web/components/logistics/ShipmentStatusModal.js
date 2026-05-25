"use client";

import {
  Loader2,
  Truck,
  MapPin,
  Package,
  Phone,
  Store,
  Banknote,
  User,
  ExternalLink,
  ClipboardList,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";

const FAILURE_OPTIONS = [
  { value: "unreachable", label: "Customer Unreachable" },
  { value: "wrong address", label: "Wrong Address" },
  { value: "other", label: "Other" },
];

function formatAddress(addr) {
  if (!addr || typeof addr !== "object") {
    return { lines: [], phone: null };
  }
  const parts = [
    addr.street,
    addr.quartier,
    addr.city,
    addr.region,
    addr.country,
  ].filter(Boolean);
  const phone = addr.phone || null;
  const lines = parts.length ? parts : ["—"];
  return { lines, phone };
}

function orderRef(order) {
  const id = order?._id || order;
  if (!id) return "—";
  return String(id).slice(-8).toUpperCase();
}

/**
 * Premium Redesign of ShipmentStatusModal
 * Uses a more structured hierarchy and timeline flow.
 */
export default function ShipmentStatusModal({
  open,
  embedded = false,
  shipment,
  updateData,
  setUpdateData,
  updating,
  onClose,
  onBack,
  onSubmit,
}) {
  const visible = embedded ? !!shipment : open && !!shipment;
  if (!visible) return null;

  const order = shipment.order_id;
  const vendor = shipment.vendor_id;
  const customer = typeof order?.customer_id === "object" ? order.customer_id : null;
  const pickup = formatAddress(shipment.pickup_address);
  const drop = formatAddress(shipment.delivery_address);
  const noteBlock =
    shipment.delivery_description ||
    order?.delivery_description ||
    null;

  const shipAddr = order?.shipping_address;
  const recipientLabel =
    shipAddr?.full_name || shipAddr?.name || customer?.name || "Recipient (order)";
  const recipientLines = shipAddr
    ? [
        shipAddr.street,
        shipAddr.quartier,
        shipAddr.city,
        shipAddr.region,
        shipAddr.country,
      ].filter(Boolean)
    : [];

  const products = Array.isArray(order?.products) ? order.products : [];

  const cardShellClass = embedded
    ? "relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden rounded-[2.5rem] border border-[var(--glass-border)] bg-[var(--bg-primary)] shadow-[0_28px_90px_-28px_rgba(0,0,0,0.18)] ring-1 ring-black/5 dark:ring-white/10"
    : "relative z-10 flex h-[85dvh] max-h-[min(95dvh,1000px)] w-full max-w-2xl flex-col overflow-hidden rounded-t-[2.5rem] border border-[var(--glass-border)] bg-[var(--bg-primary)] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] sm:h-auto sm:rounded-[2rem]";

  const headerShell = embedded
    ? "shrink-0 border-b border-[var(--glass-border)] bg-gradient-to-br from-[var(--bg-secondary)]/50 via-[var(--bg-primary)] to-[var(--bg-secondary)]/30 px-4 py-5 sm:px-10 sm:py-8"
    : "shrink-0 bg-gradient-to-b from-[var(--bg-secondary)]/50 to-transparent px-6 py-6 sm:px-8 sm:py-7";

  const scrollPad = embedded ? "px-4 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-10 sm:pb-10 lg:px-12" : "px-4 pb-8 sm:px-8";
  const formShell = embedded
    ? "shrink-0 border-t border-[var(--glass-border)] bg-[var(--bg-secondary)]/40 p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:p-6 sm:pb-8 sm:px-10 lg:px-12"
    : "shrink-0 border-t border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-8 sm:pb-8";

  const panel = (
    <div className={cardShellClass}>
        
        {/* Header Section */}
        <div className={headerShell}>
          {embedded && onBack ? (
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
              <button
                type="button"
                onClick={onBack}
                className="group inline-flex w-fit min-h-[44px] shrink-0 items-center gap-2 rounded-xl py-2 text-[11px] font-semibold text-[var(--text-secondary)] transition active:opacity-80 sm:min-h-0 sm:py-1.5 sm:hover:text-[var(--text-primary)]"
              >
                <span className="flex size-10 items-center justify-center rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/80 transition group-active:border-[var(--accent)]/40 group-active:text-[var(--accent)] sm:size-9 sm:group-hover:border-[var(--accent)]/40 sm:group-hover:text-[var(--accent)]">
                  <ChevronLeft className="size-4" />
                </span>
                Back to manifests
              </button>
              <div className="min-w-0 flex-1 space-y-2 sm:text-right sm:space-y-1">
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <div className="flex h-6 items-center rounded-full bg-[var(--accent)]/10 px-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--accent)] border border-[var(--accent)]/20">
                    {String(shipment.status || "pending").replace(/_/g, " ")}
                  </div>
                  <span className="font-mono text-[11px] font-bold tracking-tight text-[var(--text-secondary)] opacity-70">
                    #{orderRef(order)}
                  </span>
                </div>
                <h3 className="text-2xl font-black tracking-tight text-[var(--text-primary)] sm:text-3xl md:text-[2rem] md:leading-tight">
                  {shipment.tracking_code}
                </h3>
                <p className="text-[11px] font-medium text-[var(--text-secondary)] opacity-60 sm:ml-auto sm:max-w-md">
                  Created{" "}
                  {new Date(shipment.createdAt || order?.createdAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 items-center rounded-full bg-[var(--accent)]/10 px-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--accent)] border border-[var(--accent)]/20">
                      {String(shipment.status || "pending").replace(/_/g, " ")}
                    </div>
                    <span className="text-[11px] font-medium text-[var(--text-secondary)] opacity-40">·</span>
                    <span className="font-mono text-[11px] font-bold tracking-tight text-[var(--text-secondary)]">
                      #{orderRef(order)}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold tracking-tight text-[var(--text-primary)] sm:text-2xl">
                    {shipment.tracking_code}
                  </h3>
                  <p className="text-[11px] font-medium text-[var(--text-secondary)] opacity-60">
                    Created{" "}
                    {new Date(shipment.createdAt || order?.createdAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                {!embedded && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--glass-border)] bg-[var(--bg-primary)] text-[var(--text-primary)] transition-all hover:bg-[var(--bg-secondary)] active:scale-95"
                  >
                    <ExternalLink className="size-4 opacity-60" />
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Scrollable Content */}
        <div className={`min-h-0 flex-1 overflow-y-auto ${scrollPad}`}>
          <div className={`space-y-8 ${embedded ? "mx-auto max-w-6xl lg:max-w-none" : ""}`}>
            
            {/* Quick Stats Grid */}
            {embedded ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                <div className="group relative overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 p-4 transition-all hover:border-[var(--accent)]/20 hover:bg-[var(--bg-secondary)]/50 md:p-5">
                  <Banknote className="absolute -right-2 -top-2 size-12 rotate-12 opacity-[0.04] transition-transform group-hover:scale-110" />
                  <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)] opacity-60">Your earnings</p>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-xl font-black tracking-tight text-[var(--text-primary)] md:text-2xl">{(shipment.price ?? 0).toLocaleString()}</span>
                    <span className="text-[10px] font-bold text-[var(--text-secondary)] opacity-40">XAF</span>
                  </div>
                </div>
                <div className="group relative overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 p-4 transition-all hover:border-[var(--accent)]/20 hover:bg-[var(--bg-secondary)]/50 md:p-5">
                  <Store className="absolute -right-2 -top-2 size-12 rotate-12 opacity-[0.04] transition-transform group-hover:scale-110" />
                  <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)] opacity-60">Vendor</p>
                  <p className="mt-1 line-clamp-2 text-[13px] font-bold leading-snug text-[var(--text-primary)] md:text-sm">{vendor?.store_name || "Merchant"}</p>
                </div>
                <div className="group relative overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 p-4 transition-all hover:border-[var(--accent)]/20 hover:bg-[var(--bg-secondary)]/50 md:p-5">
                  <Package className="absolute -right-2 -top-2 size-12 rotate-12 opacity-[0.04] transition-transform group-hover:scale-110" />
                  <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--accent)] opacity-80">Pickup</p>
                  <p className="mt-1 line-clamp-2 text-[13px] font-bold leading-snug text-[var(--text-primary)] md:text-sm">
                    {shipment.pickup_address?.quartier || pickup.lines[0] || "—"}
                  </p>
                </div>
                <div className="group relative overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 p-4 transition-all hover:border-[var(--accent)]/20 hover:bg-[var(--bg-secondary)]/50 md:p-5">
                  <MapPin className="absolute -right-2 -top-2 size-12 rotate-12 opacity-[0.04] transition-transform group-hover:scale-110" />
                  <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)] opacity-60">Drop-off</p>
                  <p className="mt-1 line-clamp-2 text-[13px] font-bold leading-snug text-[var(--text-primary)] md:text-sm">
                    {shipment.delivery_address?.quartier || drop.lines[0] || "—"}
                  </p>
                </div>
              </div>
            ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="group relative overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 p-4 transition-all hover:bg-[var(--bg-secondary)]/50">
                <Banknote className="absolute -right-2 -top-2 size-12 rotate-12 opacity-[0.03] transition-transform group-hover:scale-110" />
                <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)] opacity-60">Your Earnings</p>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-lg font-bold text-[var(--text-primary)]">{(shipment.price ?? 0).toLocaleString()}</span>
                  <span className="text-[10px] font-bold text-[var(--text-secondary)] opacity-40">XAF</span>
                </div>
              </div>
              <div className="group relative overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 p-4 transition-all hover:bg-[var(--bg-secondary)]/50">
                <Store className="absolute -right-2 -top-2 size-12 rotate-12 opacity-[0.03] transition-transform group-hover:scale-110" />
                <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)] opacity-60">Vendor</p>
                <p className="mt-1 truncate text-[13px] font-bold text-[var(--text-primary)]">{vendor?.store_name || "Merchant"}</p>
              </div>
            </div>
            )}

            {/* Shipment Timeline */}
            <div className={`relative space-y-6 before:absolute before:left-[11px] before:top-2 before:h-[calc(100%-16px)] before:w-px before:bg-gradient-to-b before:from-[var(--accent)] before:to-[var(--accent)]/10 ${embedded ? "lg:rounded-3xl lg:border lg:border-[var(--glass-border)] lg:bg-[var(--bg-secondary)]/15 lg:p-6 lg:pl-8 xl:p-8" : ""}`}>
              {/* Pickup Point */}
              <div className="relative pl-8">
                <div className="absolute left-0 top-1 size-[23px] rounded-full bg-[var(--bg-primary)] border-2 border-[var(--accent)] shadow-[0_0_12px_rgba(var(--accent-rgb),0.3)] flex items-center justify-center">
                  <div className="size-1.5 rounded-full bg-[var(--accent)]" />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">Pickup Location</p>
                  <div className="text-[13px] font-medium leading-relaxed text-[var(--text-primary)]">
                    {pickup.lines.map((l, i) => <span key={i}>{l}{i < pickup.lines.length - 1 ? ", " : ""}</span>)}
                  </div>
                  {pickup.phone && (
                    <a href={`tel:${pickup.phone}`} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">
                      <Phone className="size-3 opacity-60" />
                      {pickup.phone}
                    </a>
                  )}
                </div>
              </div>

              {/* Delivery Point */}
              <div className="relative pl-8">
                <div className="absolute left-0 top-1 size-[23px] rounded-full bg-[var(--bg-primary)] border-2 border-[var(--text-secondary)]/30 flex items-center justify-center">
                  <MapPin className="size-3 text-[var(--text-secondary)] opacity-60" />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] opacity-60">Delivery Destination</p>
                  <div className="text-[13px] font-medium leading-relaxed text-[var(--text-primary)]">
                    {drop.lines.map((l, i) => <span key={i}>{l}{i < drop.lines.length - 1 ? ", " : ""}</span>)}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-4">
                    {drop.phone && (
                      <a href={`tel:${drop.phone}`} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--accent)]">
                        <Phone className="size-3" />
                        {drop.phone}
                      </a>
                    )}
                    {shipAddr?.email && (
                      <span className="text-[11px] font-medium text-[var(--text-secondary)] opacity-50">{shipAddr.email}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Recipient & Notes Section */}
            <div className={`grid gap-4 ${embedded ? "lg:grid-cols-2 lg:gap-6" : "sm:grid-cols-2"}`}>
              <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/10 p-5 space-y-3">
                <div className="flex items-center gap-2 opacity-50">
                  <User className="size-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Recipient</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-[var(--text-primary)]">{recipientLabel}</p>
                  {customer?.name && customer.name !== recipientLabel && (
                    <p className="text-[11px] text-[var(--text-secondary)] opacity-60 mt-1">({customer.name})</p>
                  )}
                  {customer?.phone && (
                    <p className="text-[11px] text-[var(--text-secondary)] opacity-60 mt-1">📱 {customer.phone}</p>
                  )}
                </div>
                {recipientLines.length > 0 && (
                  <div className="text-[11px] leading-relaxed text-[var(--text-secondary)] opacity-70 pt-2 border-t border-[var(--glass-border)]">
                    {recipientLines.join(", ")}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-[var(--accent)]/10 bg-[var(--accent)]/[0.03] p-5 space-y-3">
                <div className="flex items-center gap-2 text-[var(--accent)]/60">
                  <ClipboardList className="size-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Delivery Notes</span>
                </div>
                <p className="text-[12px] leading-relaxed text-[var(--text-primary)] italic">
                  {noteBlock || "No specific instructions provided."}
                </p>
              </div>
            </div>

            {/* Products List Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 opacity-60">
                  <Package className="size-4" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Order Manifest ({products.length})</span>
                </div>
              </div>
              <div className="divide-y divide-[var(--glass-border)]/50 overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/20">
                {products.map((item, idx) => {
                  const pname = (typeof item.product_id === "object" && item.product_id?.name) || item.name || "Item";
                  return (
                    <div key={idx} className="flex items-center justify-between p-4 hover:bg-[var(--bg-secondary)]/40 transition-colors">
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-[var(--text-primary)] truncate">{pname}</p>
                        <p className="text-[10px] font-medium text-[var(--text-secondary)] opacity-60">Unit price: {(item.price || 0).toLocaleString()} XAF</p>
                      </div>
                      <div className="flex items-center gap-2 rounded-lg bg-[var(--bg-primary)] px-3 py-1.5 border border-[var(--glass-border)]">
                        <span className="text-[10px] font-bold text-[var(--text-secondary)]">Qty</span>
                        <span className="text-xs font-bold text-[var(--accent)]">{item.quantity ?? 1}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>

        {/* Update Form Section */}
        <div className={formShell}>
          <form onSubmit={onSubmit} className={`space-y-5 ${embedded ? "mx-auto max-w-4xl" : ""}`}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] opacity-50 ml-1">New Shipment Status</label>
                <div className="relative">
                  <select
                    value={updateData.status}
                    onChange={(e) => setUpdateData({ ...updateData, status: e.target.value })}
                    className="w-full appearance-none rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-4 py-3.5 text-[13px] font-bold outline-none ring-[var(--accent)]/20 focus:ring-4 transition-all"
                  >
                    <option value="pending">Pending Approval</option>
                    <option value="assigned">Assigned Courier</option>
                    <option value="picked_up">Picked Up</option>
                    <option value="in_transit">In Transit</option>
                    <option value="out_for_delivery">Out For Delivery</option>
                    <option value="delivered">Delivered Successfully</option>
                    <option value="failed">Delivery Failed</option>
                  </select>
                  <Truck className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 opacity-30" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] opacity-50 ml-1">Operational Note</label>
                <input
                  placeholder="e.g. Traffic delay, ready for pickup..."
                  value={updateData.note}
                  onChange={(e) => setUpdateData({ ...updateData, note: e.target.value })}
                  className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-4 py-3.5 text-[13px] font-bold outline-none ring-[var(--accent)]/20 focus:ring-4 transition-all placeholder:font-medium placeholder:opacity-30"
                />
              </div>
            </div>

            {updateData.status === "delivered" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <input
                  placeholder="Receiver name"
                  value={updateData.receiver_name}
                  onChange={(e) => setUpdateData({ ...updateData, receiver_name: e.target.value })}
                  className="rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-4 py-3.5 text-[13px] font-bold outline-none"
                />
                <input
                  placeholder="Proof image URL (optional)"
                  value={updateData.proof_image}
                  onChange={(e) => setUpdateData({ ...updateData, proof_image: e.target.value })}
                  className="rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-4 py-3.5 text-[13px] font-bold outline-none"
                />
              </div>
            )}

            {updateData.status === "failed" && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <select
                  value={updateData.failure_reason}
                  onChange={(e) => setUpdateData({ ...updateData, failure_reason: e.target.value })}
                  className="w-full appearance-none rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-4 py-3.5 text-[13px] font-bold outline-none"
                >
                  <option value="">Select failure reason</option>
                  {FAILURE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={updating}
              className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-[var(--text-primary)] px-6 py-4 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              {updating ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <>
                  <span className="text-[12px] font-black uppercase tracking-[0.2em] text-[var(--bg-primary)]">Update Shipment</span>
                  <ChevronRight className="size-4 text-[var(--bg-primary)] transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>
        </div>

      </div>
  );

  if (embedded) {
    return (
      <div className="mx-auto flex h-full w-full max-w-[1400px] min-h-0 flex-1 flex-col">
        {panel}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[620] flex items-end justify-center p-0 backdrop-blur-md sm:items-center sm:p-4 lg:p-8">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      {panel}
    </div>
  );
}
