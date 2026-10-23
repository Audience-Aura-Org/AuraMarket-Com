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
import TrendChart from '@/components/kit/TrendChart';
import { AdminFinancePage, AdminFinanceHeader, AdminFinanceBody, AdminContentTabs } from '@/components/admin/AdminFinanceLayout';
import financeStyles from '@/components/admin/AdminFinance.module.css';

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
    } else if (!['admin', 'manager'].includes(user.role)) {
      router.replace('/wallet');
    }
  }, [user, router, hasHydrated]);

  const fetchAnalytics = async () => {
    if (!hasHydrated || !['admin', 'manager'].includes(user?.role)) return;
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
    if (!hasHydrated || !['admin', 'manager'].includes(user?.role)) return;
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
    <AdminFinancePage theme="analytics">
      <AdminFinanceHeader icon={BarChart3} title="Financial analytics" description="Review platform revenue, inventory, and account activity." onRefresh={fetchAnalytics} loading={loading} />
      <AdminFinanceBody>
        {/* Metric Grid - High Density */}
        {(() => {
          const rev      = payout_intel?.total_revenue || 0;
          const escrow   = payout_intel?.total_escrow  || 0;
          const users    = platform_summary?.total_users   || 0;
          const vendors  = platform_summary?.total_vendors || 0;
          const escrowPct = rev > 0 ? Math.min(Math.round((escrow / rev) * 100), 100) : 0;
          return (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Global Flow" value={`XAF ${fmt(rev)}`} sub="Settled sales volume" icon="payments" color="emerald" footer="Earned orders only" />
              <StatCard label="Escrow Pool" value={`XAF ${fmt(escrow)}`} sub="Held / disputed custody" icon="lock_clock" color="amber" progress={escrowPct} footer={`${escrowPct}% of settled sales`} />
              <StatCard label="Entity Count" value={fmt(users)} sub="Registered Items" icon="groups" color="blue" footer={`${fmt(users)} accounts`} />
              <StatCard label="Merchant Base" value={fmt(vendors)} sub="Registered Stores" icon="store" color="purple" footer={`${fmt(vendors)} merchants`} />
            </div>
          );
        })()}

        <AdminContentTabs value={activeTab} onChange={setActiveTab} items={[{ id: 'overview', label: 'Overview', icon: Layers }, { id: 'revenue', label: 'Revenue', icon: TrendingUp }, { id: 'inventory', label: 'Inventory', icon: Package }]} />
        {/* Intelligence Matrix */}
        <div className={activeTab === 'overview' ? 'grid min-w-0 gap-5 lg:grid-cols-3' : 'grid min-w-0 gap-5'}>
          
          {/* Revenue Velocity (Sparkline Style) */}
          <div hidden={activeTab === 'inventory'} className={`${financeStyles.panel} relative p-5 md:p-6 ${activeTab === 'revenue' ? '' : 'lg:col-span-2'}`}>
             <div className="flex items-center justify-between mb-8 relative z-10">
                <div>
                   <h3 className="text-[11px] lg:text-[12px]  font-semibold tracking-tight opacity-40">Revenue over the last 30 days</h3>
                   <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--accent)] tracking-tight mt-1">Settled sales volume</p>
                </div>
                <TrendingUp className="size-5 text-[var(--accent)] opacity-20" />
             </div>

             <div className="relative z-10">
                {/* Lazy chart: recharts downloads after the cards have painted. */}
                <TrendChart
                  data={sales_over_time || []}
                  xKey="_id"
                  yKey="dailyRevenue"
                  height="h-[300px]"
                  seriesLabel="XAF"
                  formatTick={(v) => String(v).split('-').slice(2).join('/')}
                  emptyTitle="No revenue in this period"
                />
             </div>
             <div className="absolute top-0 right-0 p-40 blur-[100px] bg-[var(--accent)]/5 rounded-full -z-0" />
          </div>

          {/* Market Share Distribution / Category Distribution */}
          <div hidden={activeTab === 'revenue'} className={`${financeStyles.panel} p-5 md:p-6`}>
             <h3 className="text-[11px] lg:text-[12px]  font-semibold tracking-tight opacity-40 mb-8">
               {activeTab === 'inventory' ? 'Products by category' : 'Accounts by role'}
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
        <div hidden={activeTab === 'revenue'} className={`${financeStyles.panel} p-5 md:p-6`}>
           <div className="flex items-center justify-between mb-8">
              <h3 className="text-[11px] lg:text-[12px]  font-semibold tracking-tight opacity-40">Best-selling products</h3>
              <Activity className="size-4 opacity-20" />
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {top_products?.slice(0, 6).map((p, i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] hover:border-[var(--accent)]/30 transition-all group">
                    <div className="size-12 rounded-xl overflow-hidden bg-[var(--bg-secondary)] shrink-0 border border-[var(--glass-border)] flex items-center justify-center">
                       {p.images?.[0]?.url ? (
                         <img src={p.images[0].url} className="size-full object-cover" alt={p.name || 'Product'} />
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

      </AdminFinanceBody>
    </AdminFinancePage>
  );
}
