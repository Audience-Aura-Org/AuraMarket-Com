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
import StatCard from '@/components/layout/StatCard';
import {
  AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

function fmt(n) { return Number(n || 0).toLocaleString('fr-CM'); }

export default function AdminAnalyticsPage() {
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) {
      router.replace('/login?from=admin-analytics');
    } else if (user.role !== 'admin') {
      router.replace('/wallet');
    }
  }, [user, router, hasHydrated]);

  const fetchAnalytics = async () => {
    if (!hasHydrated || user?.role !== 'admin') return;
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

  useEffect(() => {
    if (!hasHydrated || user?.role !== 'admin') return;
    fetchAnalytics();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHydrated, user?.role]);

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  if (!data) return null;

  const { top_products, role_breakdown, category_stats, order_matrix, payout_intel, sales_over_time, platform_summary } = data;
  const distribution = activeTab === 'inventory' ? category_stats : role_breakdown;
  const distributionTotal = activeTab === 'inventory'
    ? category_stats?.reduce((sum, item) => sum + Number(item.count || 0), 0)
    : platform_summary?.total_users || 0;

  return (
    <div className="w-full min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-display">
      
      {/* Surgical Header */}
      <div className="px-6 py-6 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/10 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] border border-[var(--accent)]/20">
              <Layers className="size-5" />
            </div>
            <div>
              <h1 className="text-lg  font-bold tracking-tight">Intelligence Matrix</h1>
              <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-40 tracking-tight">Global Platform Insight</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl p-0.5">
              {['overview', 'revenue', 'inventory'].map(t => (
                <button
                  key={t} onClick={() => setActiveTab(t)}
                  className={`px-4 py-1.5 rounded-lg text-[11px] lg:text-[12px]  font-semibold tracking-tight transition-all ${activeTab === t ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)] opacity-40 hover:opacity-100'}`}
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

      <div className="p-6 md:p-8 space-y-8 pb-32">
        
        {/* Metric Grid - High Density */}
        {(() => {
          const rev      = payout_intel?.total_revenue || 0;
          const escrow   = payout_intel?.total_escrow  || 0;
          const users    = platform_summary?.total_users   || 0;
          const vendors  = platform_summary?.total_vendors || 0;
          const escrowPct = rev > 0 ? Math.min(Math.round((escrow / rev) * 100), 100) : 0;
          return (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Global Flow" value={`XAF ${fmt(rev)}`} sub="Settled sales volume" icon="payments" color="emerald" progress={100} footer="Paid orders only" />
              <StatCard label="Escrow Pool" value={`XAF ${fmt(escrow)}`} sub="Held / disputed custody" icon="lock_clock" color="amber" progress={escrowPct} footer={`${escrowPct}% of settled sales`} />
              <StatCard label="Entity Count" value={fmt(users)} sub="Registered Items" icon="groups" color="blue" progress={Math.min(Math.round(users / 10), 100)} footer={`${fmt(users)} accounts`} />
              <StatCard label="Merchant Base" value={fmt(vendors)} sub="Registered Stores" icon="store" color="purple" progress={Math.min(vendors * 2, 100)} footer={`${fmt(vendors)} merchants`} />
            </div>
          );
        })()}

        {/* Intelligence Matrix */}
        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* Revenue Velocity (Sparkline Style) */}
          <div className="lg:col-span-2 p-8 rounded-[2.5rem] bg-[var(--bg-secondary)]/20 border border-[var(--glass-border)] relative overflow-hidden">
             <div className="flex items-center justify-between mb-8 relative z-10">
                <div>
                   <h3 className="text-[11px] lg:text-[12px]  font-semibold tracking-tight opacity-40">Revenue Velocity (30D)</h3>
                   <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--accent)] tracking-tight mt-1">Real-Time Market Pulse</p>
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
                         itemStyle={{ fontWeight: 900, textTransform: '' }}
                      />
                      <Area type="monotone" dataKey="dailyRevenue" stroke="var(--accent)" strokeWidth={3} fillOpacity={1} fill="url(#colorAdminRev)" />
                   </AreaChart>
                </ResponsiveContainer>
             </div>
             <div className="absolute top-0 right-0 p-40 blur-[100px] bg-[var(--accent)]/5 rounded-full -z-0" />
          </div>

          {/* Market Share Distribution / Category Distribution */}
          <div className="p-8 rounded-[2.5rem] bg-[var(--bg-secondary)]/20 border border-[var(--glass-border)]">
             <h3 className="text-[11px] lg:text-[12px]  font-semibold tracking-tight opacity-40 mb-8">
               {activeTab === 'inventory' ? 'Category Density' : 'Node Distribution'}
             </h3>
             <div className="space-y-6">
                {distribution?.map((item, i) => (
                   <div key={i} className="space-y-2">
                      <div className="flex items-center justify-between">
                         <span className="text-[11px] lg:text-[12px]  font-semibold ">{item._id || 'Standard'}</span>
                         <span className="text-[11px] lg:text-[12px]  font-semibold">{item.count}</span>
                      </div>
                      <div className="h-1 w-full bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                         <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${distributionTotal > 0 ? Math.min((Number(item.count || 0) / distributionTotal) * 100, 100) : 0}%` }}
                            className="h-full bg-[var(--accent)] opacity-40"
                         />
                      </div>
                   </div>
                ))}
             </div>

             <div className="mt-12 pt-8 border-t border-[var(--glass-border)]">
                <h4 className="text-[11px] lg:text-[12px]  font-semibold tracking-tight opacity-20 mb-6">Inventory Health</h4>
                <div className="flex items-center justify-between p-4 rounded-2xl bg-red-500/5 border border-red-500/10">
                   <div className="flex items-center gap-3">
                      <Zap className="size-4 text-red-500" />
                      <span className="text-[11px] lg:text-[12px]  font-semibold ">Stock Alerts</span>
                   </div>
                   <span className="text-sm  font-bold text-red-500">{platform_summary?.stock_alerts}</span>
                </div>
             </div>
          </div>
        </div>

        {/* Asset Performance Table */}
        <div className="p-8 rounded-[2.5rem] bg-[var(--bg-secondary)]/20 border border-[var(--glass-border)]">
           <div className="flex items-center justify-between mb-8">
              <h3 className="text-[11px] lg:text-[12px]  font-semibold tracking-tight opacity-40">Asset Conversion Performance</h3>
              <Activity className="size-4 opacity-20" />
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {top_products?.slice(0, 6).map((p, i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] hover:border-[var(--accent)]/30 transition-all group">
                    <div className="size-12 rounded-xl overflow-hidden bg-[var(--bg-secondary)] shrink-0 border border-[var(--glass-border)] flex items-center justify-center">
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
                      <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--accent)]  mt-0.5">XAF {fmt(p.price)}</p>
                   </div>
                   <div className="text-right">
                      <p className="text-[11px] lg:text-[12px]  font-semibold">{p.purchase_count || 0}</p>
                      <p className="text-[10px] lg:text-[12px]  font-semibold opacity-30 ">Sold</p>
                   </div>
                </div>
              ))}
           </div>
        </div>

      </div>
    </div>
  );
}
