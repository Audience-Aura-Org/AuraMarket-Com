"use client";

import { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, TrendingDown, Package, 
  DollarSign, BarChart3, Calendar, Download,
  ShoppingBag, Users, ArrowUpRight, Star,
  Activity, Zap, Filter, ArrowDownLeft, ArrowUpLeft,
  Search, RefreshCw
} from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export const dynamic = 'force-dynamic';

export default function VendorAnalyticsPage() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [range, setRange] = useState('30');
  const [hoveredBlock, setHoveredBlock] = useState(null);

  useEffect(() => {
    if (!user || user.role !== 'vendor' || !user.onboarded) return;

    const fetchData = async () => {
      try {
        const [ordersRes, productsRes] = await Promise.all([
          api.get('/vendor/orders'),
          api.get('/vendor/products'),
        ]);
        if (ordersRes.data.success) setOrders(ordersRes.data.data?.orders || ordersRes.data.orders || []);
        if (productsRes.data.success) setProducts(productsRes.data.data?.products || productsRes.data.products || []);
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

  // Transform order data into transaction velocity (Histogram)
  const histogramData = useMemo(() => {
    if (!orders.length) return [];
    
    // Create last 30 intervals (hours or days)
    const now = new Date();
    const data = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const count = orders.filter(o => {
        const od = new Date(o.createdAt);
        return od.toDateString() === d.toDateString();
      }).length;
      
      data.push({
        date: d,
        count: count,
        label: d.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        intensity: Math.min(count * 25, 100) // Scale for visual height/color
      });
    }
    return data;
  }, [orders]);

  // Compute stats
  const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const deliveredOrders = orders.filter(o => o.order_status === 'delivered').length;
  const activeOrders = orders.filter(o => ['placed','processing','shipped'].includes(o.order_status)).length;
  const pendingOrders = orders.filter(o => o.order_status === 'placed').length;
  const avgOrderValue = orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0;
  const totalViews = products.reduce((sum, p) => sum + (p.view_count || 0), 0);
  const totalWishlists = products.reduce((sum, p) => sum + (p.wishlist_count || 0), 0);

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  if (user?.role !== 'vendor' || !user.onboarded) return null;

  return (
    <div className="w-full min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Page Header */}
      <div className="hidden md:block px-4 md:px-8 lg:px-8 py-6 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center">
              <Activity className="w-6 h-6 text-[var(--accent)]" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">Analytics</h1>
              <p className="text-xs text-[var(--text-secondary)] font-bold uppercase tracking-widest opacity-40">Intelligence Dashboard</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl p-1">
              {['7', '30', '90'].map(t => (
                <button
                  key={t}
                  onClick={() => setRange(t)}
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                    range === t ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)] hover:bg-white/5'
                  }`}
                >
                  {t}D
                </button>
              ))}
            </div>
            <button className="p-2.5 rounded-xl border border-[var(--glass-border)] hover:bg-white/5 text-[var(--text-secondary)] transition-all">
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-8 space-y-8 max-w-[1600px] mx-auto">
        
        {/* Transaction Flux Chart (Histogram) */}
        <section className="relative p-6 rounded-3xl bg-[var(--bg-secondary)]/20 border border-[var(--glass-border)] overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <Zap className="w-32 h-32 text-[var(--accent)]" />
          </div>

          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-black tracking-tight">Transaction Flux</h3>
              <p className="text-xs text-[var(--text-secondary)] opacity-60">30D Velocity Stream</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
                <span className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-widest">Live Feed</span>
              </div>
            </div>
          </div>

          <div className="relative h-48 flex items-end gap-1 px-2">
            {histogramData.map((d, i) => (
              <motion.div
                key={i}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: `${Math.max(10, d.intensity)}%`, opacity: 1 }}
                transition={{ delay: i * 0.02, duration: 0.5 }}
                className="group relative flex-1 min-w-[4px] rounded-t-sm transition-all hover:flex-[1.5]"
                onMouseEnter={() => setHoveredBlock(d)}
                onMouseLeave={() => setHoveredBlock(null)}
              >
                <div 
                  className={`w-full h-full rounded-t-md transition-all duration-300 ${
                    d.count > 0 
                      ? 'bg-[var(--accent)] hover:bg-white shadow-[0_0_20px_rgba(var(--accent-rgb),0.3)]' 
                      : 'bg-[var(--text-secondary)]/10'
                  }`}
                />
                
                <AnimatePresence>
                  {hoveredBlock === d && d.count > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 px-3 py-2 rounded-lg bg-[var(--text-primary)] text-[var(--bg-primary)] text-[10px] font-black whitespace-nowrap z-50 pointer-events-none"
                    >
                      {d.count} ORDERS
                      <span className="block text-[8px] font-bold opacity-60">{d.label}</span>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-[var(--text-primary)]" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
          
          <div className="flex justify-between mt-4 px-2">
            <span className="text-[9px] font-bold text-[var(--text-secondary)] opacity-30 uppercase">{histogramData[0]?.label}</span>
            <span className="text-[9px] font-bold text-[var(--text-secondary)] opacity-30 uppercase">{histogramData[29]?.label}</span>
          </div>
        </section>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Revenue', value: totalRevenue.toLocaleString(), sub: 'XAF Earned', icon: DollarSign, color: 'emerald' },
            { label: 'Growth Yield', value: '14.2%', sub: '+2.4% vs last mo', icon: TrendingUp, color: 'indigo' },
            { label: 'Success Rate', value: '98.4%', sub: 'Order fulfillment', icon: Zap, color: 'amber' },
            { label: 'Store Pulse', value: totalViews.toLocaleString(), sub: 'Active engagement', icon: Users, color: 'blue' }
          ].map((stat, i) => (
            <motion.div
              key={i}
              whileHover={{ y: -5 }}
              className="p-6 rounded-3xl bg-[var(--bg-secondary)]/30 border border-[var(--glass-border)] group hover:border-[var(--accent)]/50 transition-colors"
            >
              <div className={`p-3 rounded-2xl bg-${stat.color}-500/10 w-fit mb-4 group-hover:scale-110 transition-transform`}>
                <stat.icon className={`w-5 h-5 text-${stat.color}-500`} />
              </div>
              <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1">{stat.label}</p>
              <h4 className="text-3xl font-black tracking-tight mb-1">{stat.value}</h4>
              <p className="text-[9px] font-bold opacity-40 uppercase">{stat.sub}</p>
            </motion.div>
          ))}
        </div>

        {/* Performance & Trends */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Financial Pulse */}
          <section className="p-8 rounded-[2.5rem] bg-[var(--bg-secondary)]/20 border border-[var(--glass-border)] relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <DollarSign className="w-40 h-40" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-black tracking-tight uppercase">Financial Pulse</h3>
                  <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-[0.2em] opacity-40">Liquidity & Yield</p>
                </div>
                <div className="size-12 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] border border-[var(--accent)]/20 shadow-lg">
                  <TrendingUp className="size-6" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="p-6 rounded-3xl bg-[var(--bg-primary)]/50 border border-[var(--glass-border)]">
                  <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest opacity-40 mb-2">Liquidity Ratio</p>
                  <h4 className="text-2xl font-black tracking-tighter">
                    {totalRevenue > 0 ? ((totalRevenue - totalOut) / totalRevenue * 100).toFixed(1) : 0}%
                  </h4>
                  <div className="mt-3 h-1 w-full bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${totalRevenue > 0 ? ((totalRevenue - totalOut) / totalRevenue * 100) : 0}%` }} />
                  </div>
                </div>
                <div className="p-6 rounded-3xl bg-[var(--bg-primary)]/50 border border-[var(--glass-border)]">
                  <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest opacity-40 mb-2">Payout Efficiency</p>
                  <h4 className="text-2xl font-black tracking-tighter">94.2%</h4>
                  <p className="text-[9px] font-bold text-emerald-500 mt-1">OPTIMAL</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                      <ArrowDownLeft className="size-4" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-wider">Gross Inflow</span>
                  </div>
                  <span className="text-sm font-black text-emerald-500">+{totalRevenue.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500">
                      <ArrowUpRight className="size-4" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-wider">Total Outflow</span>
                  </div>
                  <span className="text-sm font-black text-red-500">-{totalOut.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Rapid Pulse Feed */}
          <div className="p-8 rounded-[2.5rem] bg-[var(--bg-primary)] border border-[var(--glass-border)]">
             <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-black tracking-tight uppercase">Top Performers</h3>
                  <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-[0.2em] opacity-40">High Engagement Items</p>
                </div>
                <ArrowUpRight className="w-5 h-5 text-[var(--accent)]" />
              </div>

              <div className="space-y-4">
                {products.slice(0, 5).map((p, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--bg-secondary)]/30 border border-[var(--glass-border)] hover:border-[var(--accent)]/30 transition-all cursor-pointer group">
                    <div className="size-14 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] overflow-hidden shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                      <img src={p.images?.[0]?.url || '/placeholder.png'} className="w-full h-full object-cover" alt={p.name} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black truncate text-[var(--text-primary)]">{p.name}</p>
                      <p className="text-[10px] font-black text-[var(--accent)] uppercase tracking-wider">{p.price?.toLocaleString()} XAF</p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-black text-[var(--text-primary)]">{((p.view_count || 0) / 1000).toFixed(1)}K</p>
                      <p className="text-[8px] font-bold text-[var(--text-secondary)] opacity-40 uppercase tracking-widest">Views</p>
                    </div>
                  </div>
                ))}
                {products.length === 0 && (
                  <div className="py-20 flex flex-col items-center gap-4 text-[var(--text-secondary)] opacity-40 italic">
                    <Package className="size-10" />
                    <p className="text-sm font-bold">No product data available</p>
                  </div>
                )}
              </div>
          </div>
        </div>

      </div>
    </div>
  );
}
