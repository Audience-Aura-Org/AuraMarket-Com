"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, DollarSign, 
  ShoppingBag, Users, Star, ArrowUpRight, 
  ChevronRight, Calendar, Filter, Download,
  Loader2, Package, Activity, Wallet, ShieldCheck
} from 'lucide-react';
import api from '@/services/api';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import {
  AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';

function fmt(n) { return Number(n || 0).toLocaleString('fr-CM'); }

export default function VendorAnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await api.get('/vendor/analytics');
      if (res.data?.success) {
        setData(res.data.data);
      }
    } catch (err) {
      toast.error('Failed to synchronize intelligence hub');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  const { stats, top_products, recent_orders, sales_history } = data || {};

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--bg-primary)] text-[var(--text-primary)] font-display">
      <div className="p-6 md:p-8 space-y-8 max-w-[1600px] mx-auto pb-32">
        
      <header className="min-h-20 py-4 flex flex-col md:flex-row md:h-24 items-center justify-between px-4 md:px-10 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-xl sticky top-0 md:top-16 z-40 gap-4 md:gap-0">
        <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-4">
            <div className="size-10 md:size-12 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] shadow-inner border border-[var(--accent)]/20 shrink-0">
               <Activity className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-[var(--text-primary)] tracking-tight">Merchant <span className="text-[var(--accent)]">Intel</span></h2>
              <div className="flex items-center gap-2 mt-0.5">
                 <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                 <p className="text-[10px] md:text-[11px] lg:text-[12px] font-semibold text-[var(--text-secondary)] tracking-tight opacity-50 uppercase">Synched Hub</p>
              </div>
            </div>
          </div>
          <button onClick={fetchAnalytics} className="md:hidden size-10 rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] flex items-center justify-center active:scale-95">
             <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
           <button onClick={fetchAnalytics} className="hidden md:flex h-11 px-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[11px] font-bold tracking-tight hover:bg-[var(--accent)] hover:text-white transition-all items-center gap-2">
              <Activity className="size-4" /> Synchronize
           </button>
           <button className="flex-1 md:flex-none h-11 px-6 rounded-xl bg-[var(--accent)] text-white text-[11px] font-bold tracking-tight shadow-lg shadow-[var(--accent)]/20 active:scale-95 transition-all">
              Export Intelligence
           </button>
        </div>
      </header>

        {/* Micro-Stat Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 px-4 md:px-0">
          {[
            { label: 'Revenue', value: `${fmt(stats?.total_revenue)}`, icon: DollarSign, color: 'emerald' },
            { label: 'Escrow', value: `${fmt(stats?.pending_escrow)}`, icon: Wallet, color: 'amber' },
            { label: 'Orders', value: stats?.total_sales, icon: ShoppingBag, color: 'blue' },
            { label: 'Inventory', value: stats?.total_products, icon: Package, color: 'indigo' },
            { label: 'Views', value: fmt(stats?.total_views), icon: Users, color: 'rose' }
          ].map((s, i) => (
            <div key={i} className="p-5 rounded-3xl bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] group hover:border-[var(--accent)]/30 transition-all shadow-sm">
              <div className={`size-8 rounded-lg mb-4 flex items-center justify-center bg-${s.color}-500/10 text-${s.color}-500 border border-${s.color}-500/20`}>
                <s.icon className="size-4" />
              </div>
              <p className="text-base font-bold mb-1 tracking-tight">{s.value}</p>
              <p className="text-[10px] md:text-[11px] font-semibold text-[var(--text-secondary)] opacity-40 tracking-tight uppercase">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Main intelligence Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Revenue Velocity Chart */}
          <div className="lg:col-span-2 p-6 rounded-[2.5rem] bg-[var(--bg-secondary)]/20 border border-[var(--glass-border)]">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-[11px] lg:text-[12px]  font-semibold tracking-tight opacity-40">Revenue Velocity (30D)</h3>
              <div className="flex items-center gap-4">
                 <div className="flex items-center gap-1.5">
                    <div className="size-1.5 rounded-full bg-[var(--accent)]" />
                    <span className="text-[11px] lg:text-[12px]  font-semibold  opacity-40">Revenue Stream</span>
                 </div>
              </div>
            </div>
            
            <div className="h-[300px] w-full">
              {sales_history && sales_history.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sales_history}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                    <XAxis 
                      dataKey="_id" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 8, fontWeight: 900, fill: 'var(--text-secondary)', opacity: 0.3}} 
                      tickFormatter={(val) => val.split('-').slice(1).join('/')}
                    />
                    <YAxis hide />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '12px', fontSize: '10px' }}
                      itemStyle={{ fontWeight: 900, textTransform: '' }}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="var(--accent)" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full flex items-center justify-center border border-dashed border-[var(--glass-border)] rounded-3xl bg-[var(--bg-primary)]/5 opacity-20">
                  <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight">No Intelligence Data Available</p>
                </div>
              )}
            </div>
          </div>

          {/* Top Asset Matrix */}
          <div className="p-6 rounded-[2.5rem] bg-[var(--bg-secondary)]/20 border border-[var(--glass-border)]">
             <h3 className="text-[11px] lg:text-[12px]  font-semibold tracking-tight opacity-40 mb-6">Asset Conversion</h3>
             <div className="space-y-4">
                {top_products?.map((p, i) => (
                   <div key={p._id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--bg-primary)]/50 transition-all border border-transparent hover:border-[var(--glass-border)]">
                      <div className="size-10 rounded-lg overflow-hidden bg-[var(--bg-secondary)] shrink-0 shadow-sm border border-[var(--glass-border)] flex items-center justify-center">
                         {p.images?.[0]?.url ? (
                            <img src={p.images[0].url} className="size-full object-cover" />
                          ) : (
                            <div className="size-full bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--accent)]/5 flex items-center justify-center text-[11px] lg:text-[12px]  font-semibold opacity-20 ">
                               {p.name?.charAt(0)}
                            </div>
                          )}
                      </div>
                      <div className="flex-1 min-w-0">
                         <p className="text-[11px] lg:text-[12px]  font-semibold  truncate">{p.name}</p>
                         <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-30 mt-0.5">{p.purchase_count || 0} CONVERSIONS</p>
                      </div>
                      <div className="text-right shrink-0">
                         <p className="text-[11px] lg:text-[12px]  font-semibold">FCFA {fmt(p.price)}</p>
                      </div>
                   </div>
                ))}
             </div>
          </div>
        </div>

        {/* Operational Ledger */}
        <div className="p-6 rounded-[2.5rem] bg-[var(--bg-secondary)]/20 border border-[var(--glass-border)]">
           <div className="flex items-center justify-between mb-8">
              <h3 className="text-[11px] lg:text-[12px]  font-semibold tracking-tight opacity-40">Recent Transaction Ledger</h3>
              <button className="text-[11px] lg:text-[12px]  font-semibold text-[var(--accent)] tracking-tight flex items-center gap-1 group">
                 View All Ledger <ChevronRight className="size-3 group-hover:translate-x-1 transition-transform" />
              </button>
           </div>
           
           <div className="space-y-2">
              {recent_orders?.map(o => (
                <div key={o._id} className="flex items-center gap-4 p-3 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] hover:border-[var(--accent)]/30 transition-all">
                  <div className="size-10 rounded-xl bg-[var(--bg-secondary)] flex items-center justify-center border border-[var(--glass-border)] shrink-0">
                    <ShoppingBag className="size-4 opacity-40" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight">Order #{o._id.toString().slice(-6).toUpperCase()}</p>
                    <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-30  mt-0.5">{new Date(o.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="hidden md:flex flex-col items-end px-8 border-r border-[var(--glass-border)]">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] lg:text-[12px]  font-semibold tracking-tight border ${
                      o.order_status === 'delivered' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                      o.order_status === 'cancelled' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
                      'bg-amber-500/10 text-amber-500 border-amber-500/20'
                    }`}>
                      {o.order_status}
                    </span>
                  </div>
                  <div className="text-right min-w-[100px]">
                    <p className="text-[11px] lg:text-[12px]  font-semibold">FCFA {fmt(o.total_amount)}</p>
                    <p className="text-[10px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-20 tracking-tight mt-0.5">Total Settlement</p>
                  </div>
                </div>
              ))}
           </div>
        </div>

      </div>
    </div>
  );
}
