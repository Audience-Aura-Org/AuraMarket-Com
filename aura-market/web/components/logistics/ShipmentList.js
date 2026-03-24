"use client";

import { Truck } from "lucide-react";

export default function ShipmentList({ shipments = [], onSelectShipment }) {
  if (!shipments.length) {
    return (
      <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 p-10 text-center">
        <p className="text-[10px] font-black uppercase tracking-widest opacity-40">No shipments assigned yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/40">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left">
          <thead className="border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/50">
            <tr className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">
              <th className="px-5 py-4">Tracking</th>
              <th className="px-5 py-4">Route</th>
              <th className="px-5 py-4">Amount</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--glass-border)]/40">
            {shipments.map((s) => (
              <tr key={s._id} className="hover:bg-[var(--accent)]/5">
                <td className="px-5 py-4">
                  <p className="text-xs font-black uppercase tracking-tight">{s.tracking_code}</p>
                  <p className="text-[10px] font-bold opacity-50">{new Date(s.createdAt).toLocaleString()}</p>
                </td>
                <td className="px-5 py-4">
                  <p className="text-xs font-bold uppercase">
                    {(s.pickup_address?.quartier || s.pickup_address?.city || "Pickup")} -{">"}{" "}
                    {(s.delivery_address?.quartier || s.delivery_address?.city || "Delivery")}
                  </p>
                  <p className="text-[10px] font-bold opacity-50">
                    Vendor: {s.vendor_id?.store_name || "Unknown"}
                  </p>
                </td>
                <td className="px-5 py-4 text-xs font-black">{(s.price || 0).toLocaleString()} XAF</td>
                <td className="px-5 py-4">
                  <span className="rounded-full border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-2 py-1 text-[9px] font-black uppercase">
                    {(s.status || "pending").replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-5 py-4 text-right">
                  <button
                    onClick={() => onSelectShipment?.(s)}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--glass-border)] px-3 py-2 text-[10px] font-black uppercase"
                  >
                    <Truck className="size-3" />
                    Update
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
