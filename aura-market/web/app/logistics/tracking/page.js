"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import api from "@/services/api";
import { toast } from "react-hot-toast";

export const dynamic = "force-dynamic";

import Pagination from '@/components/common/Pagination';

export default function LogisticsTrackingPage() {
  const [loading, setLoading] = useState(true);
  const [shipments, setShipments] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

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

  const totalPages = Math.ceil(shipments.length / itemsPerPage);
  const currentShipments = shipments.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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

          <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 p-4 lg:p-6 min-h-[400px] flex flex-col">
            <div className="flex items-center justify-between mb-6">
               <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Recent activity</p>
               <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">{shipments.length} Total Logs</p>
            </div>
            
            <div className="space-y-2 flex-1">
              {currentShipments.map((s) => (
                <div key={s._id} className="flex items-center justify-between rounded-xl border border-[var(--glass-border)] px-3 py-2 hover:bg-[var(--accent)]/5 transition-colors">
                  <div>
                    <p className="text-xs font-black">{s.tracking_code}</p>
                    <p className="text-[10px] font-black text-[var(--accent)] uppercase">
                      Order #{(s.order_id?._id || s.order_id || "").toString().slice(-8).toUpperCase()}
                    </p>
                    <p className="text-[10px] font-bold opacity-60 truncate max-w-[200px]">
                      {s.delivery_address?.quartier || s.delivery_address?.city || "Unknown destination"}
                    </p>
                  </div>
                  <span className="text-[10px] font-black uppercase bg-[var(--bg-secondary)] border border-[var(--glass-border)] px-2.5 py-1 rounded-lg">{(s.status || "").replace(/_/g, " ")}</span>
                </div>
              ))}
              {!shipments.length && <p className="text-[10px] font-black uppercase opacity-40 py-20 text-center">No shipment activity yet</p>}
            </div>

            <div className="mt-8 pt-6 border-t border-[var(--glass-border)]/50">
               <Pagination 
                 currentPage={currentPage}
                 totalPages={totalPages}
                 onPageChange={setCurrentPage}
               />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
