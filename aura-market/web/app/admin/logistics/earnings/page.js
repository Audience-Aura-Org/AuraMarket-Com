"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import api from "@/services/api";
import { toast } from "react-hot-toast";

export const dynamic = "force-dynamic";

export default function AdminLogisticsEarningsPage() {
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState([]);
  const [partners, setPartners] = useState([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get("/admin/logistics/earnings");
        if (res.data.success) {
          setVendors(res.data.data.vendors || []);
          setPartners(res.data.data.logistics_partners || []);
        }
      } catch (err) {
        toast.error("Failed to load earnings report");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-10 space-y-8">
      <div>
        <h1 className="text-lg lg:text-2xl font-black uppercase tracking-tight">Logistics Earnings Report</h1>
        <p className="text-[10px] lg:text-xs font-bold uppercase tracking-wider opacity-60">
          Vendor totals and logistics partner shipping totals
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-black uppercase tracking-widest">Vendors</h2>
        <div className="overflow-x-auto rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/40">
          <table className="w-full min-w-[680px]">
            <thead className="border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/40">
              <tr className="text-left text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Orders</th>
                <th className="px-4 py-3">Gross Sales</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--glass-border)]/40">
              {vendors.map((v) => (
                <tr key={v._id?._id || v._id}>
                  <td className="px-4 py-3 text-xs font-black uppercase">{v._id?.store_name || "Unknown Vendor"}</td>
                  <td className="px-4 py-3 text-xs font-black">{v.total_orders || 0}</td>
                  <td className="px-4 py-3 text-xs font-black">{(v.gross_sales || 0).toLocaleString()} XAF</td>
                </tr>
              ))}
              {!vendors.length && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-[10px] font-black uppercase opacity-40">No vendor totals yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-black uppercase tracking-widest">Logistics Partners</h2>
        <div className="overflow-x-auto rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/40">
          <table className="w-full min-w-[680px]">
            <thead className="border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/40">
              <tr className="text-left text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                <th className="px-4 py-3">Partner</th>
                <th className="px-4 py-3">Shipments</th>
                <th className="px-4 py-3">Shipping Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--glass-border)]/40">
              {partners.map((p) => (
                <tr key={p._id?._id || p._id}>
                  <td className="px-4 py-3 text-xs font-black uppercase">{p._id?.company_name || "Unknown Partner"}</td>
                  <td className="px-4 py-3 text-xs font-black">{p.total_shipments || 0}</td>
                  <td className="px-4 py-3 text-xs font-black">{(p.total_shipping_value || 0).toLocaleString()} XAF</td>
                </tr>
              ))}
              {!partners.length && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-[10px] font-black uppercase opacity-40">No logistics totals yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
