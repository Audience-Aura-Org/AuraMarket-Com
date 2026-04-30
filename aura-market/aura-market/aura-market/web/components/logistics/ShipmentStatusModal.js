"use client";

import { Loader2, Truck } from "lucide-react";

const FAILURE_OPTIONS = [
  { value: "unreachable", label: "Customer Unreachable" },
  { value: "wrong address", label: "Wrong Address" },
  { value: "other", label: "Other" },
];

export default function ShipmentStatusModal({
  open,
  shipment,
  updateData,
  setUpdateData,
  updating,
  onClose,
  onSubmit,
}) {
  if (!open || !shipment) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-8">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-6 lg:p-8 shadow-2xl">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h3 className="text-base font-black uppercase tracking-tight">Update Shipment</h3>
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--accent)]">
              {shipment.tracking_code}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--glass-border)] px-3 py-1 text-[10px] font-black uppercase"
          >
            Close
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-wider text-[var(--text-secondary)]">
              Status
            </label>
            <div className="relative">
              <select
                value={updateData.status}
                onChange={(e) => setUpdateData({ ...updateData, status: e.target.value })}
                className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-4 py-3 text-xs font-black uppercase outline-none"
              >
                <option value="pending">Pending</option>
                <option value="assigned">Assigned</option>
                <option value="picked_up">Picked Up</option>
                <option value="in_transit">In Transit</option>
                <option value="out_for_delivery">Out For Delivery</option>
                <option value="delivered">Delivered</option>
                <option value="failed">Failed</option>
              </select>
              <Truck className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 opacity-40" />
            </div>
          </div>

          {updateData.status === "delivered" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                placeholder="Receiver Name"
                value={updateData.receiver_name}
                onChange={(e) => setUpdateData({ ...updateData, receiver_name: e.target.value })}
                className="rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-4 py-3 text-xs font-bold outline-none"
              />
              <input
                placeholder="Proof image URL (optional)"
                value={updateData.proof_image}
                onChange={(e) => setUpdateData({ ...updateData, proof_image: e.target.value })}
                className="rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-4 py-3 text-xs font-bold outline-none"
              />
            </div>
          )}

          {updateData.status === "failed" && (
            <select
              value={updateData.failure_reason}
              onChange={(e) => setUpdateData({ ...updateData, failure_reason: e.target.value })}
              className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-4 py-3 text-xs font-black outline-none"
            >
              <option value="">Select failure reason</option>
              {FAILURE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}

          <textarea
            rows={3}
            placeholder="Operational note"
            value={updateData.note}
            onChange={(e) => setUpdateData({ ...updateData, note: e.target.value })}
            className="w-full resize-none rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-4 py-3 text-xs font-bold outline-none"
          />

          <button
            disabled={updating}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--bg-primary)] disabled:opacity-50"
          >
            {updating ? <Loader2 className="size-4 animate-spin" /> : "Save Status"}
          </button>
        </form>
      </div>
    </div>
  );
}
