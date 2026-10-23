"use client";

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useState } from "react";
import {
  Loader2, DollarSign, TrendingUp, Truck,
  User, Calendar, ArrowUpRight, Search,
  Filter, Download, ChevronRight, Activity, Zap
} from "lucide-react";
import api from "@/services/api";
import { toast } from "react-hot-toast";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import StatCard from "@/components/layout/StatCard";
import { AdminFinancePage, AdminFinanceHeader, AdminFinanceBody } from "@/components/admin/AdminFinanceLayout";
import financeStyles from "@/components/admin/AdminFinance.module.css";
import { earningsCsv } from "@/lib/financeCsv";

export default function AdminLogisticsEarningsPage() {
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState([]);
  const [partners, setPartners] = useState([]);

  const load = useCallback(async () => {
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
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  const totalRev = vendors.reduce((acc, v) => acc + (v.gross_sales || 0), 0);
  const totalShip = partners.reduce((acc, p) => acc + (p.total_shipping_value || 0), 0);

  const exportReport = () => {
    const blob = new Blob([earningsCsv(vendors, partners)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'logistics-earnings.csv';
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <AdminFinancePage theme="earnings">
      <AdminFinanceHeader icon={DollarSign} title="Earnings report" description="All-time merchant sales and logistics settlement totals." onRefresh={load} loading={loading}
        actions={<button type="button" aria-label="Export CSV" onClick={exportReport} className={`${financeStyles.button} text-[11px]`}><Download className="size-4" /><span className="hidden sm:inline">Export CSV</span></button>} />
      <AdminFinanceBody>
        {/* KPI Stats */}
        {(() => {
          const logisticsPct = totalRev > 0 ? Math.min(Math.round((totalShip / totalRev) * 100), 100) : 0;
          const vendorPct = 100;
          return (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Marketplace Volume" value={`${totalRev.toLocaleString()} XAF`} icon="storefront" color="emerald" sub="Gross merchant sales" progress={vendorPct} footer={`${vendors.length} active merchants`} />
              <StatCard label="Logistics Burn" value={`${totalShip.toLocaleString()} XAF`} icon="local_shipping" color="indigo" sub="Total shipping value" progress={logisticsPct} footer={`${logisticsPct}% of revenue`} />
              <StatCard label="Active Merchants" value={String(vendors.length)} icon="store" color="amber" sub="Vendors with sales" footer="Generating revenue" />
              <StatCard label="Partner Firms" value={String(partners.length)} icon="hub" color="primary" sub="Logistics carriers" footer="Active carriers" />
            </div>
          );
        })()}

        {/* Dense Data Grid (Vendors & Partners Linked) */}
        <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-2">
           
           {/* Vendor Matrix */}
           <div className={`${financeStyles.panel} p-5 md:p-6 space-y-5`}>
              <div className="flex items-center justify-between px-2">
                 <h2 className="text-xs  font-bold  tracking-[0.3em] text-[var(--text-secondary)] opacity-40">Merchant sales</h2>
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
                             <p className="text-[10px] lg:text-[12px] font-medium text-[var(--text-secondary)] opacity-40 tracking-tight">{v.total_orders || 0} completed orders</p>
                          </div>
                       </div>
                       <div className="text-right">
                          <p className="text-xs  font-bold text-[var(--text-primary)] font-mono">{(v.gross_sales || 0).toLocaleString()} <span className="text-[10px] lg:text-[12px] opacity-20">XAF</span></p>
                          <div className="h-1 w-16 bg-white/5 rounded-full mt-1 overflow-hidden">
                             <div className="h-full bg-[var(--accent)]" style={{ width: `${totalRev > 0 ? (v.gross_sales / totalRev) * 100 : 0}%` }} />
                          </div>
                       </div>
                    </div>
                 ))}
                 {!vendors.length && <EmptyState label="merchants" />}
              </div>
           </div>

           {/* Logistics Matrix */}
           <div className={`${financeStyles.panel} p-5 md:p-6 space-y-5`}>
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
                             <p className="text-[10px] lg:text-[12px] font-medium text-[var(--text-secondary)] opacity-40 tracking-tight">{p.total_shipments || 0} shipments</p>
                          </div>
                       </div>
                       <div className="text-right">
                          <p className="text-xs  font-bold text-[var(--text-primary)] font-mono">{(p.total_shipping_value || 0).toLocaleString()} <span className="text-[10px] lg:text-[12px] opacity-20">XAF</span></p>
                          <div className="h-1 w-16 bg-white/5 rounded-full mt-1 overflow-hidden">
                             <div className="h-full bg-indigo-500" style={{ width: `${totalShip > 0 ? (p.total_shipping_value / totalShip) * 100 : 0}%` }} />
                          </div>
                       </div>
                    </div>
                 ))}
                 {!partners.length && <EmptyState label="partners" />}
              </div>
           </div>
        </div>

      </AdminFinanceBody>
    </AdminFinancePage>
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
