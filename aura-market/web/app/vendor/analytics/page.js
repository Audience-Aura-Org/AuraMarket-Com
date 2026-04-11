"use client";

import { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, Package, 
  DollarSign, BarChart3, Calendar, Download,
  ShoppingBag, Users, ArrowUpRight, Star,
  Activity, Zap, Filter, ArrowDownLeft, ArrowUpLeft
} from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';

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

  // Compute stats
  const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const deliveredOrders = orders.filter(o => o.order_status === 'delivered').length;
  const activeOrders = orders.filter(o => ['placed','processing','shipped'].includes(o.order_status)).length;
  const pendingOrders = orders.filter(o => o.order_status === 'placed').length;
  const avgOrderValue = orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0;
  const totalViews = products.reduce((sum, p) => sum + (p.view_count || 0), 0);
  const totalWishlists = products.reduce((sum, p) => sum + (p.wishlist_count || 0), 0);

  // Status breakdown
  const statusBreakdown = [
    { label: 'Placed', count: orders.filter(o => o.order_status === 'placed').length, color: 'bg-blue-500' },
    { label: 'Processing', count: orders.filter(o => o.order_status === 'processing').length, color: 'bg-amber-500' },
    { label: 'Shipped', count: orders.filter(o => o.order_status === 'shipped').length, color: 'bg-purple-500' },
    { label: 'Delivered', count: orders.filter(o => o.order_status === 'delivered').length, color: 'bg-emerald-500' },
    { label: 'Cancelled', count: orders.filter(o => o.order_status === 'cancelled').length, color: 'bg-red-500' },
  ];

  if (user?.role !== 'vendor' || !user.onboarded) return null;

  return (
    <DashboardLayout role="vendor">
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Page Header */}
        <header className="hidden md:flex items-center justify-between px-4 md:px-8 py-6 border-b border-[var(--glass-border)] bg-[var(--bg-primary)] backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center">
              <Activity className="w-6 h-6 text-[var(--accent)]" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[var(--text-primary)]">Analytics</h1>
              <p className="text-sm text-[var(--text-secondary)] opacity-60">Your business performance</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select 
              value={range} 
              onChange={(e) => setRange(e.target.value)}
              className="bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl px-4 py-2 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
            >
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="all">All Time</option>
            </select>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-10 space-y-6 lg:space-y-10 pb-32">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-40">
            <div className="size-14 rounded-full border-4 border-[var(--accent)]/10 border-t-[var(--accent)] animate-spin" />
            <p className="mt-6 text-[var(--text-secondary)] font-bold text-xs uppercase tracking-widest opacity-40">Loading...</p>
          </div>
        ) : (
          <div className="space-y-12">
            
            {/* Main Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                  <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Total Sales</span>
                </div>
                <p className="text-2xl md:text-3xl font-black text-emerald-500">{totalRevenue.toLocaleString()}</p>
                <p className="text-[9px] text-emerald-500/60 mt-1">XAF earned</p>
              </div>
              
              <div className="p-5 rounded-2xl bg-[var(--accent)]/5 border border-[var(--accent)]/20">
                <div className="flex items-center gap-2 mb-3">
                  <ShoppingBag className="w-4 h-4 text-[var(--accent)]" />
                  <span className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-wider">Total Orders</span>
                </div>
                <p className="text-2xl md:text-3xl font-black text-[var(--accent)]">{orders.length}</p>
                <p className="text-[9px] text-[var(--accent)]/60 mt-1">{deliveredOrders} delivered</p>
              </div>
              
              <div className="p-5 rounded-2xl bg-blue-500/5 border border-blue-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-blue-500" />
                  <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Store Views</span>
                </div>
                <p className="text-2xl md:text-3xl font-black text-blue-500">{totalViews.toLocaleString()}</p>
                <p className="text-[9px] text-blue-500/60 mt-1">{totalWishlists} wishlists</p>
              </div>
              
              <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-amber-500" />
                  <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Avg Order</span>
                </div>
                <p className="text-2xl md:text-3xl font-black text-amber-500">{avgOrderValue.toLocaleString()}</p>
                <p className="text-[9px] text-amber-500/60 mt-1">XAF per order</p>
              </div>
            </div>

            {/* Secondary Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--glass-border)]">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
                  <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase">Active</span>
                </div>
                <p className="text-xl font-black text-[var(--text-primary)]">{activeOrders}</p>
                <p className="text-[8px] text-[var(--text-secondary)] opacity-60">Processing + Shipped</p>
              </div>
              
              <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--glass-border)]">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowUpRight className="w-4 h-4 text-amber-500" />
                  <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase">Pending</span>
                </div>
                <p className="text-xl font-black text-amber-500">{pendingOrders}</p>
                <p className="text-[8px] text-[var(--text-secondary)] opacity-60">Awaiting processing</p>
              </div>
              
              <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--glass-border)]">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-4 h-4 text-purple-500" />
                  <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase">Products</span>
                </div>
                <p className="text-xl font-black text-purple-500">{products.length}</p>
                <p className="text-[8px] text-[var(--text-secondary)] opacity-60">Listed items</p>
              </div>
            </div>

            {/* Order Status Breakdown */}
            <div className="p-6 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)]">
              <div className="flex items-center gap-3 mb-6">
                <BarChart3 className="w-5 h-5 text-[var(--accent)]" />
                <h2 className="text-lg font-black text-[var(--text-primary)]">Order Status</h2>
              </div>
              
              <div className="space-y-4">
                {statusBreakdown.map(({ label, count, color }) => (
                  <div key={label} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[var(--text-secondary)] uppercase">{label}</span>
                      <span className="text-sm font-black text-[var(--text-primary)]">{count}</span>
                    </div>
                    <div className="h-2 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${color} transition-all duration-700`}
                        style={{ width: `${orders.length > 0 ? (count / orders.length) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Products */}
            <div className="p-6 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)]">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-5 h-5 text-[var(--accent)]" />
                  <h2 className="text-lg font-black text-[var(--text-primary)]">Top Products</h2>
                </div>
                <span className="text-xs font-bold text-[var(--text-secondary)] opacity-60">By views</span>
              </div>
              
              {products.length === 0 ? (
                <div className="py-12 flex flex-col items-center">
                  <Package className="w-12 h-12 text-[var(--text-secondary)]/20 mb-4" />
                  <p className="text-sm font-bold text-[var(--text-secondary)] opacity-40">No products yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {[...products]
                    .sort((a,b) => (b.view_count || 0) - (a.view_count || 0))
                    .slice(0, 5)
                    .map((p, i) => (
                    <div key={p._id} className="flex items-center gap-4 p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] hover:border-[var(--accent)]/20 transition-all">
                      <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] font-black text-sm">
                        {i + 1}
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-[var(--bg-primary)] border border-[var(--glass-border)] overflow-hidden shrink-0">
                        <img 
                          src={p.images?.[0]?.url || `https://api.dicebear.com/7.x/shapes/svg?seed=${p._id}`} 
                          className="size-full object-cover" 
                          alt={p.name} 
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-[var(--text-primary)] truncate">{p.name}</p>
                        <p className="text-[10px] text-[var(--text-secondary)]">{p.view_count || 0} views · {p.wishlist_count || 0} wishlists</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-[var(--accent)]">{p.price?.toLocaleString()}</p>
                        <p className="text-[9px] text-[var(--text-secondary)] opacity-60">XAF</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
        </div>
      </div>
    </DashboardLayout>
  );
}
