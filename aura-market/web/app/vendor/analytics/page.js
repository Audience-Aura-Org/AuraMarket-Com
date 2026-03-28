"use client";

import { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, Package, 
  DollarSign, BarChart3, Calendar, Download,
  ShoppingBag, Users, ArrowUpRight, Star
} from 'lucide-react';
import api from '@/services/api';
import RoleSidebar from '@/components/layout/RoleSidebar';
import { useAuthStore } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function VendorAnalyticsPage() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [range, setRange] = useState('30');

  useEffect(() => {
    if (!user || user.role !== 'vendor' || !user.onboarded) return;

    const fetchData = async () => {
      try {
        const [ordersRes, productsRes] = await Promise.all([
          api.get('/vendors/orders'),
          api.get('/vendors/products'),
        ]);
        if (ordersRes.data.success) setOrders(ordersRes.data.data.orders || []);
        if (productsRes.data.success) setProducts(productsRes.data.data.products || []);
      } catch (err) {
        if (err.response?.status === 404) {
          if (updateUser) updateUser({ onboarded: false });
          router.push('/onboarding');
          return;
        }
        console.error('Analytics fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  // Compute stats
  const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const deliveredOrders = orders.filter(o => o.order_status === 'delivered').length;
  const activeOrders = orders.filter(o => ['placed','processing','shipped'].includes(o.order_status)).length;
  const avgOrderValue = orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0;
  const totalViews = products.reduce((sum, p) => sum + (p.view_count || 0), 0);
  const totalWishlists = products.reduce((sum, p) => sum + (p.wishlist_count || 0), 0);

  // Revenue by day (last 7 days)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });
  const revenueByDay = last7Days.map(day => {
    const dayStr = day.toDateString();
    return orders
      .filter(o => new Date(o.createdAt).toDateString() === dayStr)
      .reduce((sum, o) => sum + (o.total_amount || 0), 0);
  });
  const maxRev = Math.max(...revenueByDay, 1);

  // Top products by view_count
  const topProducts = [...products].sort((a, b) => (b.view_count || 0) - (a.view_count || 0)).slice(0, 5);

  // Status breakdown
  const statusBreakdown = ['placed', 'processing', 'shipped', 'delivered', 'cancelled'].map(s => ({
    label: s,
    count: orders.filter(o => o.order_status === s).length,
  }));

  if (user?.role !== 'vendor' || !user.onboarded) return null;

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 rounded-full border-4 border-[var(--accent)]/30 border-t-[var(--accent)] animate-spin" />
        <p className="mt-4 text-[var(--accent)] font-black text-[10px] uppercase tracking-widest animate-pulse">Decrypting Analytics...</p>
      </div>
    );
  }

  return (
    <>
      <header className="h-20 lg:h-24 flex flex-col lg:flex-row lg:items-center justify-between px-6 lg:px-10 border-b border-[var(--glass-border)] bg-[var(--bg-primary)] shrink-0 z-10 py-4 lg:py-0 gap-4 lg:gap-0 text-[var(--text-primary)]">
        <div className="flex items-center gap-4 lg:gap-6">
          <h2 className="text-lg lg:text-xl font-black text-[var(--text-primary)] tracking-tight uppercase">Economic <span className="text-[var(--accent)]">Intelligence</span></h2>
          <div className="hidden sm:block h-6 w-px bg-[var(--glass-border)] opacity-30" />
          <p className="text-[var(--text-secondary)] text-[9px] font-black uppercase tracking-[0.3em] opacity-40">Live Matrix Scan</p>
        </div>

        <div className="flex items-center gap-4 self-end lg:self-auto">
          <div className="bg-[var(--bg-secondary)] rounded-xl px-3 py-1.5 lg:px-4 lg:py-2 flex items-center gap-2 border border-[var(--glass-border)] shadow-sm">
            <Calendar className="w-3 h-3 lg:w-4 lg:h-4 text-[var(--text-secondary)] opacity-40" />
            <select 
              value={range}
              onChange={e => setRange(e.target.value)}
              className="bg-transparent border-none text-[8px] lg:text-[10px] font-black text-[var(--text-primary)] focus:ring-0 outline-none cursor-pointer appearance-none uppercase tracking-widest"
            >
              <option value="7">Last 7 Node Cycles</option>
              <option value="30">Monthly Horizon</option>
              <option value="all">Full Archive</option>
            </select>
          </div>
        </div>
      </header>

      <div className="p-4 lg:p-10 space-y-6 lg:space-y-10 pb-32">
            {/* Economic Nodes Matrix */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
              <KPICard title="Revenue Volume" value={`${totalRevenue.toLocaleString()}`} icon={DollarSign} color="fuchsia" sub={`XAF Archive`} />
              <KPICard title="Market Success" value={deliveredOrders} icon={ShoppingBag} color="emerald" sub={`${activeOrders} In-Transit`} />
              <KPICard title="Node Visiblity" value={totalViews.toLocaleString()} icon={Users} color="blue" sub={`${totalWishlists} Saved`} />
              <KPICard title="Mean Trx Node" value={`${avgOrderValue.toLocaleString()}`} icon={TrendingUp} color="amber" sub={`XAF Ledger`} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-10">
              {/* Revenue Flow Chart */}
              <div className="lg:col-span-2 glass-panel border border-[var(--glass-border)] rounded-[28px] lg:rounded-[48px] p-6 lg:p-10 relative overflow-hidden bg-[var(--bg-primary)]/40 shadow-2xl">
                <div className="flex items-center justify-between mb-8 lg:mb-12">
                  <div>
                    <h3 className="text-sm lg:text-xl font-black text-[var(--text-primary)] uppercase tracking-tight">Revenue Stream</h3>
                    <p className="text-[7px] lg:text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-[0.3em] opacity-40 mt-1">Daily Economic Pulse</p>
                  </div>
                  <BarChart3 className="size-4 lg:size-6 text-[var(--accent)] opacity-40" />
                </div>
                
                <div className="h-40 lg:h-64 flex items-end gap-2 lg:gap-4 relative px-2">
                  {revenueByDay.map((rev, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-3 group/bar h-full justify-end" title={`${rev.toLocaleString()} XAF`}>
                      <div 
                        className="w-full bg-gradient-to-t from-[var(--accent)]/10 via-[var(--accent)]/40 to-[var(--accent)]/80 rounded-t-lg lg:rounded-t-2xl transition-all hover:to-[var(--accent)] border-b-2 border-[var(--accent)] relative shadow-lg shadow-[var(--accent)]/10"
                        style={{ height: `${Math.max((rev / maxRev) * 100, 4)}%` }}
                      >
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-[var(--bg-primary)] text-[var(--accent)] text-[7px] lg:text-[9px] px-2 py-1.5 rounded-lg opacity-0 group-hover/bar:opacity-100 transition-all font-black shadow-2xl border border-[var(--glass-border)] whitespace-nowrap z-20 scale-90 group-hover/bar:scale-100 uppercase tracking-tighter">
                          {rev.toLocaleString()} XAF
                        </div>
                      </div>
                      <span className="text-[6px] lg:text-[9px] font-black tracking-widest text-[var(--text-secondary)] uppercase opacity-30 group-hover/bar:opacity-100 transition-opacity">
                        {last7Days[i].toLocaleDateString('en', { weekday: 'short' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Protocol Status Partition */}
              <div className="glass-panel border border-[var(--glass-border)] rounded-[28px] lg:rounded-[48px] p-6 lg:p-10 flex flex-col bg-[var(--bg-primary)]/40 shadow-2xl">
                <div className="mb-8">
                   <h3 className="text-sm lg:text-xl font-black text-[var(--text-primary)] uppercase tracking-tight">Protocol Status</h3>
                   <p className="text-[7px] lg:text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-[0.3em] opacity-40 mt-1">Lifecycle Matrix</p>
                </div>
                <div className="space-y-4 lg:space-y-6 flex-1">
                  {statusBreakdown.map(({ label, count }) => (
                    <div key={label} className="group/row">
                       <div className="flex items-center justify-between mb-2">
                         <span className="text-[7px] lg:text-[9px] font-black tracking-widest uppercase text-[var(--text-secondary)] opacity-40 group-hover/row:opacity-100 transition-opacity">{label}</span>
                         <span className="text-[9px] lg:text-xs font-black text-[var(--text-primary)] font-mono">{count}</span>
                       </div>
                       <div className="h-1.5 lg:h-2 rounded-full bg-[var(--bg-secondary)] overflow-hidden border border-[var(--glass-border)] shadow-inner">
                         <div 
                           className="h-full bg-gradient-to-r from-[var(--accent)]/40 to-[var(--accent)] transition-all duration-1000 group-hover/row:shadow-[0_0_10px_rgba(var(--accent-rgb),0.5)]"
                           style={{ width: `${orders.length > 0 ? (count / orders.length) * 100 : 0}%` }}
                         />
                       </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* High-Velocity Nodes */}
            {topProducts.length > 0 && (
              <div className="glass-panel border border-[var(--glass-border)] rounded-[28px] lg:rounded-[48px] p-6 lg:p-10 bg-[var(--bg-primary)]/40 shadow-2xl">
                <div className="mb-8">
                   <h3 className="text-sm lg:text-xl font-black text-[var(--text-primary)] uppercase tracking-tight">High-Velocity Nodes</h3>
                   <p className="text-[7px] lg:text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-[0.3em] opacity-40 mt-1">Inbound Traffic Leaderboard</p>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                  {topProducts.map((p, i) => (
                    <div key={p._id} className="flex items-center gap-4 p-4 lg:p-6 rounded-[20px] lg:rounded-[32px] bg-[var(--bg-secondary)]/30 border border-[var(--glass-border)] hover:bg-[var(--accent)]/5 transition-all group/node relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover/node:opacity-20 transition-opacity">
                         <TrendingUp className="size-12 lg:size-20" />
                      </div>
                      <div className="size-10 lg:size-16 rounded-xl lg:rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--accent)] font-black text-xs lg:text-base shadow-xl shrink-0 group-hover/node:scale-110 transition-transform">
                        0{i + 1}
                      </div>
                      <div className="size-12 lg:size-20 rounded-xl lg:rounded-3xl overflow-hidden bg-[var(--bg-primary)] flex-shrink-0 border border-[var(--glass-border)] shadow-inner">
                        {p.images?.[0]?.url ? (
                          <img src={p.images[0].url} className="w-full h-full object-cover group-hover/node:scale-110 transition-transform duration-700" alt={p.name} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><Package className="size-6 lg:size-10 opacity-10" /></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-[var(--text-primary)] text-xs lg:text-sm truncate uppercase tracking-tighter">{p.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                           <span className="text-[7px] lg:text-[9px] text-[var(--text-secondary)] font-black uppercase tracking-widest opacity-40">{p.category}</span>
                           <span className="size-1 rounded-full bg-[var(--glass-border)]" />
                           <span className="text-[7px] lg:text-[9px] text-[var(--accent)] font-black uppercase tracking-widest">{p.stock} Units</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 lg:pl-6 border-l border-[var(--glass-border)]/50">
                        <div className="flex items-center gap-1.5 text-[var(--text-primary)] text-[9px] lg:text-xs font-black">
                          <ArrowUpRight className="size-3 text-emerald-500" /> {p.view_count || 0} <span className="text-[7px] opacity-30">PX</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-amber-500 text-[9px] lg:text-xs font-black justify-end mt-1">
                          <Star className="size-3 fill-current" /> {p.rating?.toFixed(1) || '0.0'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
    </>
  );
}

function KPICard({ title, value, icon: Icon, color, sub }) {
  const colorMap = {
    fuchsia: 'bg-fuchsia-500/10 text-fuchsia-500 border-fuchsia-500/20',
    blue:    'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    amber:   'bg-amber-500/10 text-amber-500 border-amber-500/20',
  };

  return (
    <div className="glass-panel border border-[var(--glass-border)] rounded-[24px] lg:rounded-[40px] p-4 lg:p-8 hover:-translate-y-1 transition-all group/card bg-[var(--bg-primary)]/40 shadow-sm overflow-hidden relative">
      <div className={`absolute -right-4 -top-4 size-16 lg:size-32 rounded-full blur-3xl opacity-[0.03] group-hover/card:opacity-10 transition-opacity ${colorMap[color]?.split(' ')[0]}`} />
      <div className="flex justify-between items-start mb-4 lg:mb-8 relative z-10">
        <div className={`size-10 lg:size-16 rounded-xl lg:rounded-2xl flex items-center justify-center border shadow-xl group-hover/card:scale-110 transition-transform ${colorMap[color]}`}>
          <Icon className="size-5 lg:size-8" />
        </div>
      </div>
      <div className="relative z-10">
        <p className="text-[7px] lg:text-[10px] font-black tracking-[0.25em] uppercase text-[var(--text-secondary)] opacity-50 mb-1 lg:mb-2">{title}</p>
        <div className="flex items-baseline gap-2">
           <h3 className="text-base lg:text-3xl font-black text-[var(--text-primary)] font-mono tracking-tighter">{value}</h3>
           {sub && !sub.includes('XAF') && <p className="text-[7px] lg:text-[11px] text-[var(--text-secondary)] font-black uppercase tracking-widest opacity-30">{sub}</p>}
        </div>
        {sub?.includes('XAF') && <p className="text-[7px] lg:text-[11px] text-[var(--text-secondary)] font-black uppercase tracking-widest opacity-30 mt-1 lg:mt-2">{sub}</p>}
      </div>
    </div>
  );
}


