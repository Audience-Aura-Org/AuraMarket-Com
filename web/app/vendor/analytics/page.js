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
        
        {/* Surgical Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="size-2 rounded-full bg-[var(--accent)] animate-pulse shadow-[0_0_8px_var(--accent)]" />
              <h1 className="text-xl font-bold tracking-tight">Merchant Intelligence</h1>
            </div>
            <p className="text-[11px] font-bold text-[var(--text-secondary)] opacity-40 tracking-tight">Real-Time Operational Pulse</p>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={fetchAnalytics} className="h-10 px-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[11px] font-bold tracking-tight hover:bg-[var(--accent)] hover:text-white transition-all flex items-center gap-2">
               <Activity className="size-3.5" /> Synchronize
            </button>
            <button className="h-10 px-6 rounded-xl bg-[var(--accent)] text-white text-[11px] font-bold tracking-tight shadow-lg shadow-[var(--accent)]/20">
               Export Data
            </button>
          </div>
        </div>

        {/* Micro-Stat Grid (Surgical Precision) */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Revenue', value: `FCFA ${fmt(stats?.total_revenue)}`, icon: DollarSign, color: 'emerald' },
            { label: 'Escrow', value: `FCFA ${fmt(stats?.pending_escrow)}`, icon: Wallet, color: 'amber' },
            { label: 'Orders', value: stats?.total_sales, icon: ShoppingBag, color: 'blue' },
            { label: 'Inventory', value: stats?.total_products, icon: Package, color: 'indigo' },
            { label: 'Views', value: fmt(stats?.total_views), icon: Users, color: 'rose' }
          ].map((s, i) => (
            <div key={i} className="p-4 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] group hover:border-[var(--accent)]/30 transition-all">
              <div className={`size-8 rounded-lg mb-3 flex items-center justify-center bg-${s.color}-500/10 text-${s.color}-500 border border-${s.color}-500/20`}>
                <s.icon className="size-4" />
              </div>
              <p className="text-[11px] font-bold mb-0.5">{s.value}</p>
              <p className="text-[7px] font-bold text-[var(--text-secondary)] opacity-30 tracking-tight">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Main intelligence Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Revenue Velocity Chart */}
          <div className="lg:col-span-2 p-6 rounded-[2.5rem] bg-[var(--bg-secondary)]/20 border border-[var(--glass-border)]">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-[11px] font-bold tracking-tight opacity-40">Revenue Velocity (30D)</h3>
              <div className="flex items-center gap-4">
                 <div className="flex items-center gap-1.5">
                    <div className="size-1.5 rounded-full bg-[var(--accent)]" />
                    <span className="text-[11px] font-bold  opacity-40">Revenue Stream</span>
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
                  <p className="text-[11px] font-bold tracking-tight">No Intelligence Data Available</p>
                </div>
              )}
            </div>
          </div>

          {/* Top Asset Matrix */}
          <div className="p-6 rounded-[2.5rem] bg-[var(--bg-secondary)]/20 border border-[var(--glass-border)]">
             <h3 className="text-[11px] font-bold tracking-tight opacity-40 mb-6">Asset Conversion</h3>
             <div className="space-y-4">
                {top_products?.map((p, i) => (
                   <div key={p._id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--bg-primary)]/50 transition-all border border-transparent hover:border-[var(--glass-border)]">
                      <div className="size-10 rounded-lg overflow-hidden bg-[var(--bg-secondary)] shrink-0 shadow-sm border border-[var(--glass-border)] flex items-center justify-center">
                         {p.images?.[0]?.url ? (
                            <img src={p.images[0].url} className="size-full object-cover" />
                          ) : (
                            <div className="size-full bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--accent)]/5 flex items-center justify-center text-[11px] font-bold opacity-20 ">
                               {p.name?.charAt(0)}
                            </div>
                          )}
                      </div>
                      <div className="flex-1 min-w-0">
                         <p className="text-[11px] font-bold  truncate">{p.name}</p>
                         <p className="text-[11px] font-bold text-[var(--text-secondary)] opacity-30 mt-0.5">{p.purchase_count || 0} CONVERSIONS</p>
                      </div>
                      <div className="text-right shrink-0">
                         <p className="text-[11px] font-bold">FCFA {fmt(p.price)}</p>
                      </div>
                   </div>
                ))}
             </div>
          </div>
        </div>

        {/* Operational Ledger */}
        <div className="p-6 rounded-[2.5rem] bg-[var(--bg-secondary)]/20 border border-[var(--glass-border)]">
           <div className="flex items-center justify-between mb-8">
              <h3 className="text-[11px] font-bold tracking-tight opacity-40">Recent Transaction Ledger</h3>
              <button className="text-[11px] font-bold text-[var(--accent)] tracking-tight flex items-center gap-1 group">
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
                    <p className="text-[11px] font-bold tracking-tight">Order #{o._id.toString().slice(-6).toUpperCase()}</p>
                    <p className="text-[11px] font-bold text-[var(--text-secondary)] opacity-30  mt-0.5">{new Date(o.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="hidden md:flex flex-col items-end px-8 border-r border-[var(--glass-border)]">
                    <span className={`px-2 py-0.5 rounded-full text-[7px] font-bold tracking-tight border ${
                      o.order_status === 'delivered' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                      o.order_status === 'cancelled' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
                      'bg-amber-500/10 text-amber-500 border-amber-500/20'
                    }`}>
                      {o.order_status}
                    </span>
                  </div>
                  <div className="text-right min-w-[100px]">
                    <p className="text-[11px] font-bold">FCFA {fmt(o.total_amount)}</p>
                    <p className="text-[7px] font-bold text-[var(--text-secondary)] opacity-20 tracking-tight mt-0.5">Total Settlement</p>
                  </div>
                </div>
              ))}
           </div>
        </div>

      </div>
    </div>
  );
}
