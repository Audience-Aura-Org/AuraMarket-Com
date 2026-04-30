"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, Users, ShoppingBag, 
  DollarSign, BarChart3, Package,
  ArrowUpRight, ArrowDownLeft, Zap,
  Activity, Search, Filter, RefreshCw,
  Clock, ShieldCheck, ChevronRight, Lock,
  Store, Wallet,
  Layers
} from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import {
  AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

function fmt(n) { return Number(n || 0).toLocaleString('fr-CM'); }

function CompactStat({ title, value, sub, icon: Icon, color }) {
  const colors = {
    emerald: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    red: 'bg-red-500/10 text-red-500 border-red-500/20',
  };

  return (
    <div className="bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-2xl p-4 hover:border-[var(--accent)]/30 transition-all group">
      <div className="flex items-center gap-3 mb-3">
        <div className={`size-8 rounded-lg flex items-center justify-center border ${colors[color] || colors.blue}`}>
          <Icon className="size-4" />
        </div>
        <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest opacity-50">{title}</p>
      </div>
      <h3 className="text-xl font-black text-[var(--text-primary)] tracking-tight">{value}</h3>
      {sub && <p className="text-[9px] font-bold text-[var(--text-secondary)] opacity-40 mt-1 uppercase">{sub}</p>}
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (!user) {
      router.replace('/login?from=admin-analytics');
    } else if (user.role !== 'admin') {
      router.replace('/wallet');
    }
  }, [user, router]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/analytics/advanced');
      if (res.data.success) setData(res.data.data);
    } catch (err) {
      console.error('Analytics Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAnalytics(); }, []);

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  if (!data) return null;

  const { top_products, role_breakdown, category_stats, order_matrix, payout_intel, sales_over_time, platform_summary } = data;

  return (
    <div className="w-full min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-display">
      
      {/* Surgical Header */}
      <div className="px-6 py-6 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/10 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] border border-[var(--accent)]/20">
              <Layers className="size-5" />
            </div>
            <div>
              <h1 className="text-lg font-black uppercase tracking-tight">Intelligence Matrix</h1>
              <p className="text-[9px] font-bold text-[var(--text-secondary)] opacity-40 uppercase tracking-widest">Global Platform Insight</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl p-0.5">
              {['overview', 'revenue', 'inventory'].map(t => (
                <button
                  key={t} onClick={() => setActiveTab(t)}
                  className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === t ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)] opacity-40 hover:opacity-100'}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <button onClick={fetchAnalytics} className="size-9 rounded-xl border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all">
              <RefreshCw className="size-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 md:p-8 space-y-8 max-w-[1600px] mx-auto pb-32">
        
        {/* Metric Grid - High Density */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <CompactStat title="Global Flow" value={`XAF ${fmt(payout_intel?.total_revenue)}`} sub="Total Processed" icon={Wallet} color="emerald" />
          <CompactStat title="Escrow Pool" value={`XAF ${fmt(payout_intel?.total_escrow)}`} sub="Held Liquidity" icon={Lock} color="amber" />
          <CompactStat title="Entity count" value={fmt(platform_summary?.total_users)} sub="Registered Nodes" icon={Users} color="blue" />
          <CompactStat title="Merchant Base" value={fmt(platform_summary?.total_vendors)} sub="Active Stores" icon={Store} color="purple" />
          <CompactStat title="Shipment Flow" value={fmt(platform_summary?.live_shipments)} sub="In-Transit Nodes" icon={Package} color="red" />
        </div>

        {/* Intelligence Matrix */}
        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* Revenue Velocity (Sparkline Style) */}
          <div className="lg:col-span-2 p-8 rounded-[2.5rem] bg-[var(--bg-secondary)]/20 border border-[var(--glass-border)] relative overflow-hidden">
             <div className="flex items-center justify-between mb-8 relative z-10">
                <div>
                   <h3 className="text-[10px] font-black uppercase tracking-widest opacity-40">Revenue Velocity (30D)</h3>
                   <p className="text-[9px] font-black text-[var(--accent)] uppercase tracking-widest mt-1">Real-Time Market Pulse</p>
                </div>
                <TrendingUp className="size-5 text-[var(--accent)] opacity-20" />
             </div>

             <div className="h-[300px] w-full relative z-10">
                <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={sales_over_time}>
                      <defs>
                         <linearGradient id="colorAdminRev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                         </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                      <XAxis 
                        dataKey="_id" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fontSize: 8, fontWeight: 900, fill: 'var(--text-secondary)', opacity: 0.3}} 
                        tickFormatter={(v) => v.split('-').slice(2).join('/')}
                      />
                      <YAxis hide />
                      <Tooltip 
                         contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '12px', fontSize: '10px' }}
                         itemStyle={{ fontWeight: 900, textTransform: 'uppercase' }}
                      />
                      <Area type="monotone" dataKey="dailyRevenue" stroke="var(--accent)" strokeWidth={3} fillOpacity={1} fill="url(#colorAdminRev)" />
                   </AreaChart>
                </ResponsiveContainer>
             </div>
             <div className="absolute top-0 right-0 p-40 blur-[100px] bg-[var(--accent)]/5 rounded-full -z-0" />
          </div>

          {/* Market Share Distribution / Category Distribution */}
          <div className="p-8 rounded-[2.5rem] bg-[var(--bg-secondary)]/20 border border-[var(--glass-border)]">
             <h3 className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-8">
               {activeTab === 'inventory' ? 'Category Density' : 'Node Distribution'}
             </h3>
             <div className="space-y-6">
                {(activeTab === 'inventory' ? category_stats : role_breakdown)?.map((item, i) => (
                   <div key={i} className="space-y-2">
                      <div className="flex items-center justify-between">
                         <span className="text-[10px] font-black uppercase">{item._id || 'Standard'}</span>
                         <span className="text-[10px] font-black">{item.count}</span>
                      </div>
                      <div className="h-1 w-full bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                         <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(item.count / (platform_summary.total_users || 100)) * 100}%` }}
                            className="h-full bg-[var(--accent)] opacity-40"
                         />
                      </div>
                   </div>
                ))}
             </div>

             <div className="mt-12 pt-8 border-t border-[var(--glass-border)]">
                <h4 className="text-[9px] font-black uppercase tracking-widest opacity-20 mb-6">Inventory Health</h4>
                <div className="flex items-center justify-between p-4 rounded-2xl bg-red-500/5 border border-red-500/10">
                   <div className="flex items-center gap-3">
                      <Zap className="size-4 text-red-500" />
                      <span className="text-[9px] font-black uppercase">Stock Alerts</span>
                   </div>
                   <span className="text-sm font-black text-red-500">{platform_summary?.stock_alerts}</span>
                </div>
             </div>
          </div>
        </div>

        {/* Asset Performance Table */}
        <div className="p-8 rounded-[2.5rem] bg-[var(--bg-secondary)]/20 border border-[var(--glass-border)]">
           <div className="flex items-center justify-between mb-8">
              <h3 className="text-[10px] font-black uppercase tracking-widest opacity-40">Asset Conversion Performance</h3>
              <Activity className="size-4 opacity-20" />
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {top_products?.slice(0, 6).map((p, i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] hover:border-[var(--accent)]/30 transition-all group">
                    <div className="size-12 rounded-xl overflow-hidden bg-[var(--bg-secondary)] shrink-0 border border-[var(--glass-border)] flex items-center justify-center">
                       {p.images?.[0]?.url ? (
                         <img src={p.images[0].url} className="size-full object-cover" />
                       ) : (
                         <div className="size-full bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--accent)]/5 flex items-center justify-center text-[10px] font-black opacity-20 uppercase">
                           {p.name?.charAt(0)}
                         </div>
                       )}
                    </div>
                   <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black uppercase truncate">{p.name}</p>
                      <p className="text-[8px] font-black text-[var(--accent)] uppercase mt-0.5">XAF {fmt(p.price)}</p>
                   </div>
                   <div className="text-right">
                      <p className="text-[11px] font-black">{p.purchase_count || 0}</p>
                      <p className="text-[7px] font-black opacity-30 uppercase">Sold</p>
                   </div>
                </div>
              ))}
           </div>
        </div>

      </div>
    </div>
  );
}
