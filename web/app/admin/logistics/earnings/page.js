"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import {
  Loader2, DollarSign, TrendingUp, Truck,
  User, Calendar, ArrowUpRight, Search,
  Filter, Download, ChevronRight, Activity, Zap
} from "lucide-react";
import api from "@/services/api";
import { toast } from "react-hot-toast";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import StatCard from "@/components/layout/StatCard";

export default function AdminLogisticsEarningsPage() {
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState([]);
  const [partners, setPartners] = useState([]);
  const [timeframe, setTimeframe] = useState('current'); // current, past

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
    return <LoadingSpinner fullScreen />;
  }

  const totalRev = vendors.reduce((acc, v) => acc + (v.gross_sales || 0), 0);
  const totalShip = partners.reduce((acc, p) => acc + (p.total_shipping_value || 0), 0);

  return (
    <div className="w-full p-4 lg:p-8 space-y-6">
      <div className="space-y-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-[var(--glass-border)]">
           <div className="flex items-center gap-4">
              <div className="size-12 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center">
                 <DollarSign className="size-6" />
              </div>
              <div className="space-y-0.5">
                 <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Logistics <span className="text-[var(--accent)]">Earnings</span></h1>
                 <p className="text-[11px] lg:text-[12px] font-semibold tracking-[0.2em] text-[var(--text-secondary)] opacity-40">Settlement report · {new Date().getFullYear()}</p>
              </div>
           </div>

           <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="bg-[var(--bg-primary)] px-3 py-1.5 rounded-xl border border-[var(--glass-border)] flex items-center gap-2">
                 <select 
                   value={timeframe} 
                   onChange={(e) => setTimeframe(e.target.value)}
                   className="bg-transparent text-[11px] lg:text-[12px]  font-semibold tracking-tight text-[var(--text-secondary)] outline-none"
                 >
                    <option value="current">Current Cycle</option>
                    <option value="past">Archived Cycles</option>
                 </select>
              </div>
              <button className="h-10 px-6 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] text-[11px] lg:text-[12px]  font-semibold tracking-tight flex items-center gap-3 hover:bg-[var(--accent)] hover:text-white transition-all">
                 <Download className="size-3" /> Export CSV
              </button>
           </div>
        </div>

        {/* KPI Stats */}
        {(() => {
          const logisticsPct = totalRev > 0 ? Math.min(Math.round((totalShip / totalRev) * 100), 100) : 0;
          const vendorPct = 100;
          return (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Marketplace Volume" value={`${totalRev.toLocaleString()} XAF`} icon="storefront" color="emerald" sub="Gross merchant sales" progress={vendorPct} footer={`${vendors.length} active merchants`} />
              <StatCard label="Logistics Burn" value={`${totalShip.toLocaleString()} XAF`} icon="local_shipping" color="indigo" sub="Total shipping value" progress={logisticsPct} footer={`${logisticsPct}% of revenue`} />
              <StatCard label="Active Merchants" value={String(vendors.length)} icon="store" color="amber" sub="Vendors with sales" progress={vendors.length > 0 ? Math.min(vendors.length * 5, 100) : 0} footer="Generating revenue" />
              <StatCard label="Partner Firms" value={String(partners.length)} icon="hub" color="primary" sub="Logistics carriers" progress={partners.length > 0 ? Math.min(partners.length * 10, 100) : 0} footer="Active carriers" />
            </div>
          );
        })()}

        {/* Dense Data Grid (Vendors & Partners Linked) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           
           {/* Vendor Matrix */}
           <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                 <h2 className="text-xs  font-bold  tracking-[0.3em] text-[var(--text-secondary)] opacity-40">Merchant Items</h2>
                 <span className="text-[11px] lg:text-[12px]  font-semibold text-[var(--accent)] ">{vendors.length} Live</span>
              </div>
              <div className="space-y-2">
                 {vendors.map((v) => (
                    <div key={v._id?._id || v._id} className="p-4 rounded-2xl bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] hover:border-[var(--accent)]/30 transition-all flex items-center justify-between group">
                       <div className="flex items-center gap-4">
                          <div className="size-9 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)]  font-semibold text-[10px] lg:text-[12px] group-hover:bg-[var(--accent)] group-hover:text-white transition-all">
                             {v._id?.store_name?.[0] || 'V'}
                          </div>
                          <div>
                             <h3 className="text-xs  font-bold text-[var(--text-primary)]  truncate w-32">{v.store_name || "Unknown Merchant"}</h3>
                             <p className="text-[10px] lg:text-[12px] font-medium text-[var(--text-secondary)] opacity-40 tracking-tight">{v.total_orders || 0} Successful Transmissions</p>
                          </div>
                       </div>
                       <div className="text-right">
                          <p className="text-xs  font-bold text-[var(--text-primary)] font-mono">{(v.gross_sales || 0).toLocaleString()} <span className="text-[10px] lg:text-[12px] opacity-20">XAF</span></p>
                          <div className="h-1 w-16 bg-white/5 rounded-full mt-1 overflow-hidden">
                             <div className="h-full bg-[var(--accent)]" style={{ width: `${(v.gross_sales / totalRev) * 100}%` }} />
                          </div>
                       </div>
                    </div>
                 ))}
                 {!vendors.length && <EmptyState label="merchants" />}
              </div>
           </div>

           {/* Logistics Matrix */}
           <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                 <h2 className="text-xs  font-bold  tracking-[0.3em] text-[var(--text-secondary)] opacity-40">Logistics Partners</h2>
                 <span className="text-[11px] lg:text-[12px]  font-semibold text-indigo-500 ">{partners.length} Active</span>
              </div>
              <div className="space-y-2">
                 {partners.map((p) => (
                    <div key={p._id?._id || p._id} className="p-4 rounded-2xl bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] hover:border-indigo-500/30 transition-all flex items-center justify-between group">
                       <div className="flex items-center gap-4">
                          <div className="size-9 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)]  font-semibold text-[10px] lg:text-[12px] group-hover:bg-indigo-500 group-hover:text-white transition-all">
                             {p._id?.company_name?.[0] || 'L'}
                          </div>
                          <div>
                             <h3 className="text-xs  font-bold text-[var(--text-primary)]  truncate w-32">{p.company_name || "Unknown Partner"}</h3>
                             <p className="text-[10px] lg:text-[12px] font-medium text-[var(--text-secondary)] opacity-40 tracking-tight">{p.total_shipments || 0} Global Dispatches</p>
                          </div>
                       </div>
                       <div className="text-right">
                          <p className="text-xs  font-bold text-[var(--text-primary)] font-mono">{(p.total_shipping_value || 0).toLocaleString()} <span className="text-[10px] lg:text-[12px] opacity-20">XAF</span></p>
                          <div className="h-1 w-16 bg-white/5 rounded-full mt-1 overflow-hidden">
                             <div className="h-full bg-indigo-500" style={{ width: `${(p.total_shipping_value / totalShip) * 100}%` }} />
                          </div>
                       </div>
                    </div>
                 ))}
                 {!partners.length && <EmptyState label="partners" />}
              </div>
           </div>
        </div>

        {/* Global Registry Footer */}
        <div className="pt-12 text-center opacity-30">
           <p className="text-[11px] lg:text-[12px]  font-semibold tracking-[0.5em] text-[var(--text-secondary)] ">
              Aura Fiscal Systems // Consolidated Earnings Hub v2.1.0
           </p>
        </div>

      </div>
    </div>
  );
}

function EmptyState({ label }) {
   return (
      <div className="py-12 border border-dashed border-[var(--glass-border)] rounded-2xl flex flex-col items-center justify-center opacity-20">
         <Zap className="size-6 mb-3" />
         <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight">No active {label} detected</p>
      </div>
   );
}
