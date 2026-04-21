"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, Users, ShoppingBag, 
  DollarSign, Activity, BarChart3, PieChart,
  RefreshCw, MousePointer2, Zap, ArrowUpRight,
  Package, Truck, Shield, Layout, Globe,
  Cpu, HardDrive, Network, Layers, ChevronRight,
  Filter, Calendar, Download, Eye, AlertTriangle,
  Briefcase, Wallet, CreditCard, Box,
  ChevronDown, Search, MoreHorizontal
} from 'lucide-react';
import api from '@/services/api';
import { toast } from 'react-hot-toast';

export default function GlobalIntelligenceHub() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('ecosystem'); // ecosystem, nodes, assets, finance
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    sales_over_time: [],
    top_vendors: [],
    top_products: [],
    role_breakdown: [],
    category_stats: [],
    order_matrix: [],
    payout_intel: { total_revenue: 0, total_escrow: 0 },
    platform_summary: {}
  });

  useEffect(() => {
    setMounted(true);
    fetchGlobalIntelligence();
  }, []);

  const fetchGlobalIntelligence = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/analytics/advanced');
      if (res.data?.success) {
        console.log('[Admin Analytics] Data received:', {
          sales_over_time_count: res.data.data?.sales_over_time?.length || 0,
          top_vendors_count: res.data.data?.top_vendors?.length || 0,
          platform_summary: res.data.data?.platform_summary
        });
        setData(res.data.data);
      } else {
        console.warn('[Admin Analytics] API returned success:false');
        toast.error('Analytics data unavailable');
      }
    } catch (err) {
      console.error('[Admin Analytics] API Error:', {
        status: err.response?.status,
        message: err.response?.data?.message || err.message,
        stack: err.stack
      });
      toast.error(`Failed to load analytics: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="w-full min-h-full p-4 md:p-8 lg:px-8 space-y-6 lg:space-y-8">
        
        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-4">
           <div className="flex items-center gap-4">
              <div className="size-12 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)]">
                 <Globe className="size-6" />
              </div>
              <div>
                 <h1 className="text-xl font-black text-[var(--text-primary)] uppercase">Analytics</h1>
                 <p className="text-[10px] text-[var(--text-secondary)] opacity-60">Platform Intelligence</p>
              </div>
           </div>

           <div className="flex flex-wrap items-center gap-4">
            <div className="flex bg-[var(--bg-primary)] p-1 rounded-2xl border border-[var(--glass-border)]">
               {['ecosystem', 'nodes', 'assets', 'finance'].map(tab => (
                  <button 
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)] opacity-40 hover:opacity-100'}`}
                  >
                     {tab}
                  </button>
               ))}
            </div>
              
               <button 
                 onClick={fetchGlobalIntelligence}
                 className="size-10 rounded-full bg-[var(--bg-primary)] border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all flex items-center justify-center shadow-sm active:scale-90"
               >
                  <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
               </button>
           </div>
        </div>

        {loading ? (
          <div className="py-40 flex flex-col items-center justify-center gap-6">
             <div className="w-20 h-20 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin shadow-2xl" />
             <p className="text-[10px] font-black uppercase tracking-[0.5em] text-[var(--accent)] animate-pulse">Recalibrating Platform Matrix...</p>
          </div>
        ) : (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
             
             {/* 🌎 ECOSYSTEM TAB: Sales Velocity & Overview */}
             {activeTab === 'ecosystem' && (
                <div className="space-y-8">
                   <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      {/* Live Transaction Flux (Big Chart) */}
                      <div className="lg:col-span-2 p-10 rounded-[3rem] bg-[var(--bg-primary)] border border-[var(--glass-border)] shadow-2xl relative overflow-hidden group">
                         <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--accent)]/5 blur-[100px] rounded-full translate-x-32 -translate-y-32" />
                         <div className="flex justify-between items-center mb-12">
                            <h3 className="text-sm font-black uppercase tracking-[0.3em] text-[var(--text-primary)]">Transaction Flux <span className="opacity-20 ml-2">// 30D Velocity</span></h3>
                            <TrendingUp className="size-5 text-emerald-500" />
                         </div>
                         
                         <div className="h-72 flex items-end gap-1.5 pt-10">
                            {data.sales_over_time.length > 0 ? (
                              data.sales_over_time.map((day, i) => (
                                 <div key={i} className="flex-1 group/bar relative">
                                    <div 
                                      className="w-full bg-gradient-to-t from-[var(--accent)]/20 to-[var(--accent)] group-hover/bar:brightness-125 transition-all rounded-t-lg shadow-inner"
                                      style={{ height: `${(day.dailyRevenue / Math.max(...data.sales_over_time.map(d=>d.dailyRevenue))) * 100}%` }}
                                    />
                                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 scale-0 group-hover/bar:scale-100 transition-all bg-[var(--bg-primary)] border border-[var(--glass-border)] text-[8px] font-black uppercase px-3 py-1.5 rounded-full shadow-2xl z-20 pointer-events-none whitespace-nowrap">
                                       {day._id}: {day.dailyRevenue.toLocaleString()}
                                    </div>
                                 </div>
                              ))
                            ) : (
                              <div className="w-full h-full flex items-center justify-center opacity-10">
                                 <Activity className="size-12 animate-pulse" />
                              </div>
                            )}
                         </div>
                      </div>

                      {/* Right Panel: Platform Vitals */}
                      <div className="space-y-6">
                         <StatTile icon={Users} color="indigo" label="Platform Nodes" value={data.platform_summary?.total_users || 0} sub="Global Network Clusters" />
                         <StatTile icon={ShoppingBag} color="amber" label="Est. Revenue" value={`${(data.payout_intel?.total_revenue || 0).toLocaleString()} XAF`} sub="Settled Liquidity" />
                         <StatTile icon={Package} color="emerald" label="Asset Count" value={data.top_products.length} sub="Synchronized Listings" />
                      </div>
                   </div>

                   {/* Secondary Summary */}
                   <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                      <MiniMetric label="Orders Matrix" value={data.order_matrix.reduce((acc,o)=>acc+o.count,0)} icon={Layers} />
                      <MiniMetric label="Live Dispatches" value={data.platform_summary?.live_shipments || 0} icon={Truck} color="emerald" />
                      <MiniMetric label="Stock Criticality" value={data.platform_summary?.stock_alerts || 0} icon={AlertTriangle} color="red" />
                      <MiniMetric label="Active Hubs" value={data.platform_summary?.total_vendors || 0} icon={Layout} />
                   </div>
                </div>
             )}

             {/* 👥 NODES TAB: Users & Roles */}
             {activeTab === 'nodes' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                   {/* Role Distribution */}
                   <div className="p-10 rounded-[3rem] bg-[var(--bg-primary)] border border-[var(--glass-border)] shadow-xl">
                      <h3 className="text-sm font-black uppercase tracking-[0.3em] text-[var(--text-primary)] mb-10">Role Distribution Matrix</h3>
                      <div className="space-y-6">
                         {data.role_breakdown.map(role => (
                            <div key={role._id} className="space-y-2">
                               <div className="flex justify-between text-[11px] font-black uppercase tracking-widest text-[var(--text-secondary)] italic">
                                  <span>{role._id}</span>
                                  <span>{role.count} NODES</span>
                               </div>
                               <div className="h-2 w-full bg-[var(--bg-secondary)] rounded-full overflow-hidden border border-white/5">
                                  <div 
                                    className="h-full bg-[var(--accent)] shadow-[0_0_15px_rgba(var(--accent-rgb),0.5)] transition-all duration-1000" 
                                    style={{ width: `${(role.count / data.platform_summary.total_users) * 100}%` }} 
                                  />
                               </div>
                            </div>
                         ))}
                      </div>
                   </div>

                   {/* Top Performance Hubs */}
                   <div className="p-10 rounded-[3rem] bg-[var(--bg-primary)] border border-[var(--glass-border)] shadow-xl">
                      <h3 className="text-sm font-black uppercase tracking-[0.3em] text-[var(--text-primary)] mb-10">High-Performance Clusters (Vendors)</h3>
                      <div className="space-y-4">
                         {data.top_vendors.map((v, i) => (
                            <div key={v._id} className="p-4 rounded-[1.5rem] bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] flex items-center justify-between group hover:bg-[var(--accent)]/5 transition-all">
                               <div className="flex items-center gap-4">
                                  <div className="size-10 rounded-2xl bg-[var(--bg-primary)] text-[10px] font-black flex items-center justify-center border border-[var(--glass-border)] italic group-hover:bg-[var(--accent)] group-hover:text-white transition-all">{i+1}</div>
                                  <p className="text-xs font-black text-[var(--text-primary)] uppercase">{v.store_name}</p>
                               </div>
                               <div className="text-right">
                                  <p className="text-[10px] font-black text-[var(--text-primary)] font-mono">{v.revenue.toLocaleString()} <span className="opacity-20 italic">XAF</span></p>
                                  <p className="text-[8px] font-black text-[var(--text-secondary)] opacity-30 uppercase tracking-widest">{v.orders} Orders</p>
                               </div>
                            </div>
                         ))}
                      </div>
                   </div>
                </div>
             )}

             {/* 📦 ASSETS TAB: Products & Categories */}
             {activeTab === 'assets' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                   {/* Top Global Products */}
                   <div className="p-10 rounded-[3rem] bg-[var(--bg-primary)] border border-[var(--glass-border)] shadow-xl">
                      <h3 className="text-sm font-black uppercase tracking-[0.3em] text-[var(--text-primary)] mb-10">High-Velocity Assets</h3>
                      <div className="space-y-4">
                         {data.top_products.map((p, i) => (
                            <div key={p._id} className="p-4 rounded-[1.5rem] bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] flex items-center justify-between group hover:bg-indigo-500/5 transition-colors">
                               <div className="flex items-center gap-4">
                                  <div className="size-12 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] overflow-hidden flex items-center justify-center p-1">
                                     <Box className="size-6 text-[var(--accent)]/40" />
                                  </div>
                                  <div>
                                     <p className="text-[11px] font-black text-[var(--text-primary)] uppercase truncate w-40">{p.name}</p>
                                     <p className="text-[8px] font-black text-[var(--text-secondary)] opacity-30 uppercase italic">{p.category || 'General'} NODE</p>
                                  </div>
                               </div>
                               <div className="text-right">
                                  <div className="flex items-center gap-4">
                                     <div className="flex flex-col items-end">
                                        <p className="text-[10px] font-black text-[var(--text-primary)]">{p.purchase_count} Sales</p>
                                        <div className={`h-1.5 rounded-full mt-1 ${p.stock <= 5 ? 'bg-red-500 animate-pulse w-8' : 'bg-emerald-500/20 w-12'}`} />
                                     </div>
                                     <ChevronRight className="size-4 opacity-10" />
                                  </div>
                               </div>
                            </div>
                         ))}
                      </div>
                   </div>

                   {/* Category Entropy */}
                   <div className="p-10 rounded-[3rem] bg-[var(--bg-primary)] border border-[var(--glass-border)] shadow-xl">
                      <h3 className="text-sm font-black uppercase tracking-[0.3em] text-[var(--text-primary)] mb-10">Global Category Entropy</h3>
                      <div className="space-y-6">
                         {data.category_stats.map(cat => (
                            <div key={cat._id} className="p-5 rounded-[1.5rem] bg-[var(--bg-secondary)]/30 border border-dashed border-[var(--glass-border)] flex items-center justify-between">
                               <div>
                                  <h4 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-tighter">{cat._id || 'UNCATEGORIZED'}</h4>
                                  <p className="text-[9px] font-black text-[var(--text-secondary)] opacity-30 uppercase tracking-widest">{cat.count} Individual Assets</p>
                               </div>
                               <div className="text-right">
                                  <p className="text-sm font-black text-[var(--accent)] font-mono">{cat.totalValue.toLocaleString()}</p>
                                  <span className="text-[7px] font-black opacity-20 italic">XAF TOTAL VALUE</span>
                               </div>
                            </div>
                         ))}
                      </div>
                   </div>
                </div>
             )}

             {/* 💰 FINANCE TAB: Liquidity & Flow */}
             {activeTab === 'finance' && (
                <div className="space-y-8">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Global Liquidity Card */}
                      <div className="p-12 rounded-[3.5rem] bg-gradient-to-br from-[var(--bg-primary)] to-[var(--bg-secondary)] border border-[var(--glass-border)] shadow-2xl relative overflow-hidden group">
                         <div className="absolute -bottom-24 -left-24 size-80 bg-emerald-500/5 blur-[120px] rounded-full" />
                         <div className="relative z-10 space-y-8">
                            <div className="flex items-center gap-4 text-[var(--text-secondary)] opacity-40">
                               <Wallet className="size-6" />
                               <span className="text-[10px] font-black uppercase tracking-[0.4em]">Settled Liquid Flow</span>
                            </div>
                            <h2 className="text-6xl font-black text-[var(--text-primary)] tracking-tighter italic">{(data.payout_intel?.total_revenue || 0).toLocaleString()} <span className="text-2xl not-italic opacity-20 font-mono italic">XAF</span></h2>
                            <div className="pt-4 flex items-center gap-3">
                               <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50" />
                               <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Node Payouts Ready</span>
                            </div>
                         </div>
                      </div>

                      {/* Escrow Lockdown Card */}
                      <div className="p-12 rounded-[3.5rem] bg-gradient-to-br from-[var(--bg-primary)] to-[var(--bg-secondary)] border border-[var(--glass-border)] shadow-2xl relative overflow-hidden group">
                         <div className="absolute -bottom-24 -right-24 size-80 bg-indigo-500/5 blur-[120px] rounded-full" />
                         <div className="relative z-10 space-y-8">
                            <div className="flex items-center gap-4 text-[var(--text-secondary)] opacity-40">
                               <Shield className="size-6" />
                               <span className="text-[10px] font-black uppercase tracking-[0.4em]">Escrow Lockdown</span>
                            </div>
                            <h2 className="text-6xl font-black text-[var(--text-primary)] tracking-tighter italic">{(data.payout_intel?.total_escrow || 0).toLocaleString()} <span className="text-2xl not-italic opacity-20 font-mono italic">XAF</span></h2>
                            <div className="pt-4 flex items-center gap-3">
                               <div className="h-2 w-2 rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/50" />
                               <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Verification in Progress</span>
                            </div>
                         </div>
                      </div>
                   </div>

                   {/* Order Matrix Breakdown */}
                   <div className="p-10 rounded-[3rem] bg-[var(--bg-primary)] border border-[var(--glass-border)] shadow-xl">
                      <h3 className="text-sm font-black uppercase tracking-[0.3em] text-[var(--text-primary)] mb-10">Transactional State Matrix</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                         {data.order_matrix.map(status => (
                            <div key={status._id} className="p-6 rounded-[1.5rem] bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] group hover:scale-105 transition-all">
                               <p className="text-[8px] font-black text-[var(--text-secondary)] opacity-30 uppercase tracking-[0.2em] mb-2">{status._id}</p>
                               <p className="text-xl font-black text-[var(--text-primary)] font-mono mb-1">{status.count}</p>
                               <p className="text-[10px] font-black text-[var(--accent)]">{(status.total_volume || 0).toLocaleString()} XAF</p>
                            </div>
                         ))}
                      </div>
                   </div>
                </div>
             )}

          </div>
        )}

      </div>
  );
}

function StatTile({ icon: Icon, color, label, value, sub }) {
   const colors = {
      indigo: 'bg-indigo-500/10 text-indigo-500',
      amber: 'bg-amber-500/10 text-amber-500',
      emerald: 'bg-emerald-500/10 text-emerald-500',
   };
   return (
      <div className="p-8 rounded-[2.5rem] bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-start gap-6 group hover:scale-[1.02] transition-all shadow-lg hover:shadow-2xl">
         <div className={`size-14 rounded-2xl ${colors[color]} flex items-center justify-center group-hover:scale-110 transition-all`}>
            <Icon className="size-7" />
         </div>
         <div>
            <p className="text-[9px] font-black text-[var(--text-secondary)] opacity-30 uppercase tracking-[0.3em] mb-2">{label}</p>
            <h4 className="text-2xl font-black text-[var(--text-primary)] tracking-tight mb-1">{value}</h4>
            <p className="text-[8px] font-black text-[var(--text-secondary)] opacity-20 uppercase tracking-widest italic">{sub}</p>
         </div>
      </div>
   );
}

function MiniMetric({ label, value, icon: Icon, color = 'indigo' }) {
  const colorMap = {
    indigo: 'bg-indigo-500/10 text-indigo-500',
    emerald: 'bg-emerald-500/10 text-emerald-500',
    red: 'bg-red-500/10 text-red-500',
  };
  
  return (
    <div className="p-6 rounded-[2rem] bg-[var(--bg-primary)]/50 border border-[var(--glass-border)] flex items-center gap-4 group hover:bg-[var(--bg-primary)] transition-all">
      <div className={`size-10 rounded-2xl flex items-center justify-center shrink-0 ${colorMap[color] || colorMap.indigo}`}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[8px] font-black text-[var(--text-secondary)] opacity-30 uppercase tracking-widest mb-0.5">{label}</p>
        <p className="text-sm font-black text-[var(--text-primary)] truncate">{value}</p>
      </div>
    </div>
  );
}
