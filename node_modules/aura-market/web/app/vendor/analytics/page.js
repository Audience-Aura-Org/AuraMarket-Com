"use client";

import { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, Package, 
  DollarSign, BarChart3, Calendar, Download,
  ShoppingBag, Users, ArrowUpRight, Star,
  Activity, Zap, Filter
} from 'lucide-react';
import api from '@/services/api';
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

  // Status breakdown
  const statusBreakdown = ['placed', 'processing', 'shipped', 'delivered', 'cancelled'].map(s => ({
    label: s,
    count: orders.filter(o => o.order_status === s).length,
  }));

  if (user?.role !== 'vendor' || !user.onboarded) return null;

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
        <div className="size-12 rounded-full border-4 border-[var(--accent)]/10 border-t-[var(--accent)] animate-spin" />
        <p className="mt-4 text-[var(--accent)] font-bold text-[9px] uppercase tracking-widest animate-pulse">Loading business data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] py-12 px-6 md:px-12 transition-all duration-300">
      <div className="max-w-5xl mx-auto space-y-12">
        
        {/* Slim Header */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-[var(--glass-border)]">
           <div className="flex items-center gap-4">
              <div className="size-12 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center">
                 <Activity className="size-6" />
              </div>
              <div className="space-y-0.5">
                  <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight uppercase">Business <span className="text-[var(--accent)] font-black italic">Performance</span></h1>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-40">Merchant Hub</p>
               </div>
           </div>

           <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="bg-[var(--bg-primary)] px-3 py-1.5 rounded-xl border border-[var(--glass-border)] flex items-center gap-2">
                 <Calendar className="size-3 text-[var(--text-secondary)] opacity-40" />
                 <select 
                   value={range} 
                   onChange={(e) => setRange(e.target.value)}
                   className="bg-transparent text-[9px] font-black uppercase tracking-widest text-[var(--text-primary)] outline-none"
                 >
                    <option value="7">Last 7 Days</option>
                    <option value="30">Last 30 Days</option>
                    <option value="all">All Time</option>
                 </select>
              </div>
              <button className="h-10 px-4 rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] hover:bg-white/5 transition-all">
                 <Download className="size-4" />
              </button>
           </div>
        </div>

        {/* Slim KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
           {[
              { label: 'Total Sales', value: totalRevenue.toLocaleString(), unit: 'XAF', icon: DollarSign, color: 'text-emerald-500' },
              { label: 'Delivered Orders', value: deliveredOrders, unit: 'Orders', icon: ShoppingBag, color: 'text-[var(--accent)]' },
              { label: 'Store Views', value: totalViews.toLocaleString(), unit: 'Views', icon: Users, color: 'text-indigo-500' },
              { label: 'Average Order', value: avgOrderValue.toLocaleString(), unit: 'XAF', icon: TrendingUp, color: 'text-amber-500' }
           ].map(stat => (
              <div key={stat.label} className="p-5 rounded-2xl bg-[var(--bg-primary)]/50 border border-[var(--glass-border)] hover:border-[var(--accent)]/30 transition-all flex flex-col gap-4 group">
                 <div className="size-8 rounded-lg bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-secondary)] group-hover:text-[var(--accent)] transition-colors">
                    <stat.icon className="size-4" />
                 </div>
                 <div>
                    <h4 className="text-[9px] font-black tracking-widest text-[var(--text-secondary)] opacity-30 uppercase">{stat.label}</h4>
                    <p className="text-xl font-bold text-[var(--text-primary)] tracking-tight">{stat.value} <span className="text-[9px] opacity-20 font-mono italic">{stat.unit}</span></p>
                 </div>
              </div>
           ))}
        </div>

        {/* Integrated Intelligence Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-32">
           
           {/* Order Stats Overview */}
           <div className="p-8 rounded-[2rem] bg-[var(--bg-primary)] border border-[var(--glass-border)] flex flex-col h-full relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent)]/5 blur-2xl rounded-full translate-x-12 -translate-y-12" />
              <div className="flex justify-between items-center mb-8 relative z-10">
                 <div className="space-y-1">
                    <h3 className="text-sm font-black uppercase tracking-widest text-[var(--text-primary)]">Order Summary</h3>
                    <p className="text-[9px] font-medium text-[var(--text-secondary)] opacity-40 uppercase tracking-widest">Sales Cycle</p>
                 </div>
                 <Zap className="size-4 text-[var(--accent)] opacity-40 animate-pulse" />
              </div>
              
              <div className="space-y-5 relative z-10">
                 {statusBreakdown.map(({ label, count }) => (
                    <div key={label} className="space-y-2">
                       <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-30">
                          <span>{label}</span>
                          <span className="text-[var(--text-primary)] opacity-100">{count}</span>
                       </div>
                       <div className="h-1 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                          <div 
                             className="h-full bg-[var(--accent)] transition-all duration-1000" 
                             style={{ width: `${orders.length > 0 ? (count / orders.length) * 100 : 0}%` }} 
                          />
                       </div>
                    </div>
                 ))}
              </div>
           </div>

           {/* Popular Products */}
           <div className="md:col-span-2 p-8 rounded-[2rem] bg-[var(--bg-primary)] border border-[var(--glass-border)] flex flex-col h-full bg-grid-white/[0.01]">
              <div className="flex justify-between items-center mb-8">
                 <div className="space-y-1">
                    <h3 className="text-sm font-black uppercase tracking-widest text-[var(--text-primary)]">Popular Products</h3>
                    <p className="text-[9px] font-medium text-[var(--text-secondary)] opacity-40 uppercase tracking-widest">Buyer Interest</p>
                 </div>
                 <ArrowUpRight className="size-4 text-[var(--text-secondary)] opacity-20" />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                 {[...products]
                   .sort((a,b) => (b.view_count || 0) - (a.view_count || 0))
                   .slice(0, 4)
                   .map((p, i) => (
                    <div key={p._id} className="p-3 rounded-xl bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] flex items-center justify-between group/node hover:bg-[var(--bg-secondary)] transition-all">
                       <div className="flex items-center gap-3">
                          <div className="size-10 rounded-xl bg-[var(--bg-primary)] border border-[var(--glass-border)] overflow-hidden shrink-0">
                             <img src={p.images?.[0]?.url || `https://api.dicebear.com/7.x/shapes/svg?seed=${p._id}`} className="size-full object-cover grayscale group-hover/node:grayscale-0 transition-all duration-500" alt="" />
                          </div>
                          <div>
                             <p className="text-[11px] font-bold text-[var(--text-primary)] uppercase truncate w-24">{p.name}</p>
                             <p className="text-[8px] font-black text-[var(--accent)] uppercase tracking-tighter">{p.view_count || 0} Views</p>
                          </div>
                       </div>
                       <Star className="size-3 text-amber-500 fill-amber-500 opacity-40" />
                    </div>
                 ))}
              </div>
           </div>

        </div>

        {/* Global Registry Footer */}
        <div className="text-center opacity-30 pb-12">
           <p className="text-[8px] font-black tracking-[0.5em] text-[var(--text-secondary)] uppercase">
              Business Profile // Shop Analytics 
           </p>
        </div>

      </div>
    </div>
  );
}
