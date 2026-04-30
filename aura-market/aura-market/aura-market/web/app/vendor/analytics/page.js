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
          {/* Order Distribution */}
          <div className="p-8 rounded-3xl bg-[var(--bg-primary)] border border-[var(--glass-border)] relative overflow-hidden">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-black">Lifecycle Velocity</h3>
                <p className="text-xs text-[var(--text-secondary)] opacity-60">Fulfillment Efficiency</p>
              </div>
              <BarChart3 className="w-5 h-5 text-[var(--accent)] opacity-20" />
            </div>

            <div className="space-y-6">
              {[
                { label: 'Processing', count: orders.filter(o => o.order_status === 'processing').length, color: 'bg-indigo-500' },
                { label: 'In Transit', count: orders.filter(o => o.order_status === 'shipped').length, color: 'bg-amber-500' },
                { label: 'Delivered', count: orders.filter(o => o.order_status === 'delivered').length, color: 'bg-emerald-500' }
              ].map((item, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                    <span className="text-[var(--text-secondary)]">{item.label}</span>
                    <span>{item.count}</span>
                  </div>
                  <div className="h-1.5 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(item.count / orders.length) * 100 || 0}%` }}
                      className={`h-full ${item.color} shadow-[0_0_10px_rgba(0,0,0,0.2)]`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rapid Pulse Feed */}
          <div className="p-8 rounded-3xl bg-[var(--bg-primary)] border border-[var(--glass-border)]">
             <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-lg font-black">Top Performers</h3>
                  <p className="text-xs text-[var(--text-secondary)] opacity-60">High Engagement Items</p>
                </div>
                <ArrowUpRight className="w-5 h-5 text-[var(--accent)]" />
              </div>

              <div className="space-y-4">
                {products.slice(0, 4).map((p, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--bg-secondary)]/30 border border-[var(--glass-border)] hover:bg-[var(--bg-secondary)]/50 transition-all cursor-pointer">
                    <div className="w-12 h-12 rounded-xl bg-[var(--bg-primary)] border border-[var(--glass-border)] overflow-hidden shrink-0">
                      <img src={p.images?.[0]?.url || '/placeholder.png'} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{p.name}</p>
                      <p className="text-[9px] font-black text-[var(--accent)] uppercase">{p.price?.toLocaleString()} XAF</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black">{((p.view_count || 0) / 100).toFixed(1)}K</p>
                      <p className="text-[8px] font-bold text-[var(--text-secondary)] opacity-40 uppercase">Views</p>
                    </div>
                  </div>
                ))}
              </div>
          </div>
        </div>

      </div>
    </div>
  );
}
