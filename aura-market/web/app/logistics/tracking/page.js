"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import api from "@/services/api";
import { toast } from "react-hot-toast";

export const dynamic = "force-dynamic";

export default function LogisticsTrackingPage() {
  const [loading, setLoading] = useState(true);
  const [shipments, setShipments] = useState([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get("/logistics/shipments/firm");
        if (res.data.success) setShipments(res.data.data.shipments || []);
      } catch (err) {
        toast.error("Failed to load live tracking");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const grouped = useMemo(() => {
    return {
      pending: shipments.filter((s) => ["pending", "assigned"].includes(s.status)),
      transit: shipments.filter((s) => ["picked_up", "in_transit", "out_for_delivery"].includes(s.status)),
      done: shipments.filter((s) => s.status === "delivered"),
      failed: shipments.filter((s) => s.status === "failed"),
    };
  }, [shipments]);

  const cards = [
    ["Pending", grouped.pending.length],
    ["In Transit", grouped.transit.length],
    ["Delivered", grouped.done.length],
    ["Failed", grouped.failed.length],
  ];

  return (
    <div className="p-4 lg:p-10 space-y-6">
      <div>
        <h1 className="text-lg lg:text-2xl font-black uppercase tracking-tight">Live Tracking</h1>
        <p className="text-[10px] lg:text-xs font-bold uppercase tracking-wider opacity-60">
          Shipment flow by current status
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-[var(--accent)]" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {cards.map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 p-4">
                <p className="text-[9px] font-black uppercase tracking-widest opacity-50">{label}</p>
                <p className="text-xl font-black">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 p-4 lg:p-6">
            <p className="mb-3 text-[10px] font-black uppercase tracking-widest opacity-60">Recent activity</p>
            <div className="space-y-2">
              {shipments.slice(0, 12).map((s) => (
                <div key={s._id} className="flex items-center justify-between rounded-xl border border-[var(--glass-border)] px-3 py-2">
                  <div>
                    <p className="text-xs font-black">{s.tracking_code}</p>
                    <p className="text-[10px] font-bold opacity-60">
                      {s.delivery_address?.quartier || s.delivery_address?.city || "Unknown destination"}
                    </p>
                  </div>
                  <span className="text-[10px] font-black uppercase">{(s.status || "").replace(/_/g, " ")}</span>
                </div>
              ))}
              {!shipments.length && <p className="text-[10px] font-black uppercase opacity-40">No shipment activity yet</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
