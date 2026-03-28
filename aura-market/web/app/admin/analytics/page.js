"use client";

import { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, Users, ShoppingBag, 
  DollarSign, Activity, BarChart3, PieChart,
  RefreshCw, MousePointer2, Zap
} from 'lucide-react';
import RoleSidebar from '@/components/layout/RoleSidebar';
import api from '@/services/api';
import { toast } from 'react-hot-toast';

export const dynamic = 'force-dynamic';

export default function AdminAnalytics() {
  const [mounted, setMounted] = useState(false);
  const [basicStats, setBasicStats] = useState({});
  const [advancedData, setAdvancedData] = useState({
    sales_over_time: [],
    top_vendors: [],
    top_products: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const respBasic = await api.get('/admin/analytics');
      const respAdv = await api.get('/admin/analytics/advanced');
      
      if (respBasic.data?.success) setBasicStats(respBasic.data.data.stats || {});
      if (respAdv.data?.success) setAdvancedData(respAdv.data.data || {});
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      toast.error('Platform data synchronization failed');
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-secondary)] text-[var(--text-primary)]">
      <RoleSidebar role="admin" />

      <main className="flex-1 flex flex-col overflow-hidden relative z-10 w-full no-scrollbar">
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-10 glass-panel border-b border-[var(--glass-border)] bg-[var(--bg-primary)] text-[var(--text-primary)]">
          <div className="flex items-center gap-6">
            <h2 className="text-xl font-black text-[var(--text-primary)] tracking-tight uppercase">Platform <span className="text-[var(--accent)]">Intelligence</span></h2>
            <div className="h-4 w-px bg-[var(--glass-border)]" />
            <div className="px-4 py-1.5 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 text-[9px] font-black tracking-widest uppercase flex items-center gap-2">
                <Activity className="size-3" /> Live Data Stream active
             </div>
          </div>
          <button onClick={fetchAnalytics} className="p-2 rounded-lg border border-[var(--glass-border)] hover:bg-[var(--accent)]/10 transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-4">
             {loading && <RefreshCw className="w-3 h-3 animate-spin" />}
             Refresh Metrics
          </button>
        </header>

        <div className="flex-1 overflow-y-auto w-full p-10 space-y-12 no-scrollbar pb-32">
           <div className="max-w-[1400px] mx-auto space-y-12">
              
              {/* KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                 {[
                   { label: 'Platform Revenue', value: `${(basicStats.revenue || 0).toLocaleString()} XAF`, icon: DollarSign, color: 'text-emerald-500', trend: '+12%' },
                   { label: 'Global Userbase', value: (basicStats.users || 0).toLocaleString(), icon: Users, color: 'text-[var(--accent)]', trend: '+45' },
                   { label: 'Transaction Vol', value: (basicStats.orders || 0).toLocaleString(), icon: ShoppingBag, color: 'text-indigo-500', trend: '+22' },
                   { label: 'Held Liquidity', value: `${(basicStats.escrow_vault || 0).toLocaleString()} XAF`, icon: Zap, color: 'text-amber-500', trend: 'STABLE' }
                 ].map(k => (
                   <div key={k.label} className="glass-panel p-6 rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 group hover:shadow-2xl transition-all shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                         <div className={`p-3 rounded-2xl bg-${k.color.split('-')[1]}-500/10 ${k.color}`}>
                            <k.icon className="size-5" />
                         </div>
                         <span className={`text-[10px] font-black tracking-widest ${k.trend.includes('+') ? 'text-emerald-500' : 'text-indigo-500'}`}>
                            {k.trend}
                         </span>
                      </div>
                      <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] mb-1">{k.label}</p>
                      <h3 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">{k.value}</h3>
                   </div>
                 ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Sales Chart (Simplified mockup or list) */}
                <div className="md:col-span-2 glass-panel p-8 rounded-[40px] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 space-y-6">
                   <div className="flex items-center justify-between border-b border-[var(--glass-border)] pb-6 mb-6">
                      <h4 className="text-sm font-black uppercase tracking-widest text-[var(--text-primary)]">Velocity Snapshot (Last 30 Days)</h4>
                      <div className="flex gap-2">
                         <button className="size-8 rounded-lg bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center transition-all hover:bg-[var(--accent)]/10"><BarChart3 className="size-3" /></button>
                         <button className="size-8 rounded-lg bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center transition-all hover:bg-[var(--accent)]/10 opacity-40"><PieChart className="size-3" /></button>
                      </div>
                   </div>
                   
                   <div className="h-64 flex items-end gap-2 pb-8">
                      {advancedData.sales_over_time.length > 0 ? advancedData.sales_over_time.map((d, i) => (
                        <div key={d._id} className="flex-1 group relative">
                           <div 
                              className="w-full bg-[var(--accent)]/20 hover:bg-[var(--accent)] rounded-t-lg transition-all" 
                              style={{ height: `${(d.dailyRevenue / Math.max(...advancedData.sales_over_time.map(s=>s.dailyRevenue))) * 100}%` }}
                           />
                           <div className="absolute bottom-[-24px] left-1/2 translate-x-[-50%] opacity-0 group-hover:opacity-100 transition-opacity bg-[var(--bg-primary)] text-[8px] font-black uppercase whitespace-nowrap px-2 py-1 rounded shadow-lg border border-[var(--glass-border)] z-10 pointer-events-none">
                              {d._id}: {d.dailyRevenue.toLocaleString()}
                           </div>
                        </div>
                      )) : (
                        <div className="size-full flex flex-col items-center justify-center gap-4 opacity-10">
                           <TrendingUp className="size-16" />
                           <p className="font-black text-xs uppercase tracking-[0.3em]">Building Chrono-Datasets...</p>
                        </div>
                      )}
                   </div>
                </div>

                {/* Top Performers */}
                <div className="glass-panel p-8 rounded-[40px] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 flex flex-col">
                   <h4 className="text-sm font-black uppercase tracking-widest text-[var(--text-primary)] border-b border-[var(--glass-border)] pb-6 mb-8">Node Leaders</h4>
                   <div className="flex-1 space-y-6">
                      {advancedData.top_vendors.map((v, i) => (
                        <div key={v._id} className="flex items-center justify-between group">
                           <div className="flex items-center gap-4">
                              <div className="size-10 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center font-black text-[var(--text-primary)] group-hover:bg-[var(--accent)] group-hover:text-white transition-all text-sm font-mono italic shadow-lg">
                                 {i + 1}
                              </div>
                              <div>
                                 <p className="text-xs font-black text-[var(--text-primary)]">{v.store_name}</p>
                                 <p className="text-[10px] text-[var(--text-secondary)] font-bold opacity-60 uppercase">{v.rating} PLATFORM Score</p>
                              </div>
                           </div>
                           <p className="text-xs font-black text-[var(--text-primary)] font-mono">{v.total_revenue?.toLocaleString()} <span className="text-[8px] opacity-40">XAF</span></p>
                        </div>
                      ))}
                      {advancedData.top_vendors.length === 0 && (
                        <div className="size-full flex flex-col items-center justify-center gap-4 opacity-10 py-12">
                           <Users className="size-12" />
                           <p className="font-black text-xs uppercase tracking-[0.2em] text-center px-4 leading-relaxed">Top performing nodes not yet indexed.</p>
                        </div>
                      )}
                   </div>
                   <button className="w-full mt-8 py-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[9px] font-black uppercase tracking-[0.3em] hover:bg-[var(--accent)]/10 transition-all">
                      Export Full Intelligence
                   </button>
                </div>
              </div>

           </div>
        </div>
      </main>
    </div>
  );
}
