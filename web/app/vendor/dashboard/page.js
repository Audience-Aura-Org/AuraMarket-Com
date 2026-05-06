"use client";

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/hooks/useAuth';
import Link from 'next/link';
import api from '@/services/api';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function VendorDashboard() {
  const { user, token, logout } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [pendingEscrow, setPendingEscrow] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let isMounted = true;

    if (!mounted) {
      return;
    }

    // Get token from Zustand state or localStorage directly (in case hydration is slow)
    let authToken = token;
    if (!authToken && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('aura-auth-storage');
        if (stored) {
          const parsed = JSON.parse(stored);
          authToken = parsed?.state?.token;

        }
      } catch (e) {
        console.error('[VendorDashboard] Failed to parse localStorage:', e);
      }
    }


    
    if (!authToken) {
      setLoading(false);
      setError(null);
      return;
    }

    setError(null);

    const fetchData = async () => {
      try {
        // Verify vendor profile first

        const vendorRes = await api.get('/vendor/me');

        
        if (!vendorRes.data.success) {
          setError('Vendor profile not found or unauthorized.');
          setLoading(false);
          return;
        }

        // Fetch products, orders and finance data in parallel

        const [productsRes, ordersRes, walletRes, vendorProfileRes] = await Promise.all([
          api.get('/vendor/products'),
          api.get('/vendor/orders'),
          api.get('/wallet'),
          api.get('/vendor/me'),
        ]);

        if (isMounted) {
          if (productsRes.data.success) {
            const prods = productsRes.data.data.products || [];

            setProducts(prods);
          }
          if (ordersRes.data.success) {
            const ordrs = ordersRes.data.data.orders || [];

            setOrders(ordrs);
          }
          if (walletRes.data.success) {
            setWalletBalance(walletRes.data.data.balance || 0);
            setPendingEscrow(walletRes.data.data.pending_escrow || 0);
          }
          if (vendorProfileRes.data.success) {
            setPendingEscrow(vendorProfileRes.data.data.escrow_balance || 0);
          }
          setLoading(false);
        }
      } catch (err) {
        console.error('[VendorDashboard] Error:', err.response?.status, err.response?.data?.message || err.message);
        if (isMounted) {
          setError(err.response?.data?.message || err.message || 'Failed to fetch data');
          setLoading(false);
        }
      }
    };

    fetchData();
    const timer = setInterval(fetchData, 15000);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [token, mounted]);

  const paidOrders = orders.filter((o) => o.payment_status === 'paid');
  const completedOrders = orders.filter((o) => ['delivered', 'completed'].includes(o.order_status));
  const openOrders = orders.filter((o) => !['delivered', 'completed', 'cancelled', 'refunded'].includes(o.order_status));
  const totalSales = paidOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  const recentPaid = paidOrders.slice(0, 5).reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

  const stats = [
    { label: 'Total Sales', value: `${totalSales.toLocaleString()} XAF`, icon: 'payments', color: 'emerald', pct: `${completedOrders.length} done` },
    { label: 'Open Orders', value: String(openOrders.length || 0), icon: 'shopping_bag', color: 'primary', pct: `${orders.length} total` },
    { label: 'Products', value: String(products.length || 0), icon: 'category', color: 'blue', pct: `${products.filter((p) => Number(p.stock || 0) > 0).length} in stock` },
    { label: 'Available', value: `${walletBalance.toLocaleString()} XAF`, icon: 'account_balance_wallet', color: 'purple', pct: null },
  ];

  const colorMap = {
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', bar: 'bg-emerald-500', badgeBg: 'bg-emerald-500/10', badgeText: 'text-emerald-600', glow: '#10b981', w: '70%' },
    primary: { bg: 'bg-[var(--accent)]/10', text: 'text-[var(--accent)]', bar: 'bg-[var(--accent)]', badgeBg: 'bg-[var(--accent)]/10', badgeText: 'text-[var(--accent)]', glow: 'var(--accent)', w: '55%' },
    blue: { bg: 'bg-indigo-600/10', text: 'text-indigo-600', bar: 'bg-indigo-600', badgeBg: 'bg-indigo-600/10', badgeText: 'text-indigo-600', glow: '#4f46e5', w: '85%' },
    purple: { bg: 'bg-[var(--accent)]/10', text: 'text-[var(--accent)]', bar: '', badgeBg: '', badgeText: '', glow: 'var(--accent)', w: '60%' },
  };

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  if (!mounted) return null;

  return (
    <div className="relative min-h-full bg-[var(--bg-secondary)] text-[var(--text-primary)] transition-colors duration-500 overflow-x-hidden">
        {/* Background blobs */}
        <div className="absolute top-[-10%] right-[-10%] size-[500px] bg-[var(--accent)]/5 blur-[120px] rounded-full pointer-events-none -z-0 transition-all duration-1000" />
        <div className="absolute bottom-[-10%] left-[20%] size-[400px] bg-indigo-600/5 blur-[100px] rounded-full pointer-events-none -z-0 transition-all duration-1000" />

        {/* Top Header */}
        <header className="min-h-16 py-3 sm:h-16 flex flex-col sm:flex-row items-center justify-between px-4 sm:px-8 border-b border-[var(--glass-border)] relative z-20 bg-[var(--bg-primary)] backdrop-blur-2xl gap-3 sm:gap-2 min-w-0 text-[var(--text-primary)] sticky top-0 md:top-16">
          <div className="flex items-center justify-between w-full sm:w-auto gap-4">
            <h2 className="text-lg sm:text-xl font-bold text-[var(--text-primary)] tracking-tighter truncate">Vendor <span className="text-[var(--accent)]">Dashboard</span></h2>
            <div className="flex sm:hidden items-center gap-3">
               <button className="size-9 rounded-full glass-panel flex items-center justify-center text-[var(--text-secondary)] border border-[var(--glass-border)]">
                 <span className="material-symbols-outlined text-xl">notifications</span>
               </button>
               <div className="size-9 rounded-full border border-[var(--accent)]/30 bg-gradient-to-tr from-[var(--accent)]/20 to-indigo-600/10 flex items-center justify-center font-bold text-[var(--accent)] overflow-hidden">
                 {user?.avatar ? <img src={user.avatar} className="size-full object-cover" alt={user.name} /> : <span>{user?.name?.[0]?.toUpperCase() || 'M'}</span>}
               </div>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="relative flex-1 group sm:w-72">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] text-lg group-focus-within:text-[var(--accent)] transition-colors">search</span>
              <input 
                className="w-full glass-panel border border-[var(--glass-border)] rounded-full py-2.5 pl-11 pr-6 text-[11px] lg:text-[12px] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 transition-all bg-[var(--bg-primary)]/50 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/40 font-bold tracking-tight" 
                placeholder="Find anything..." 
                type="text" 
              />
            </div>
            
            <div className="hidden sm:flex items-center gap-3 pl-4 border-l border-[var(--glass-border)]/30">
              <div className="text-right">
                <p className="text-sm font-bold text-[var(--text-primary)] tracking-tighter">{user?.name || 'Vendor'}</p>
                <p className="text-[10px] lg:text-[12px] text-[var(--accent)] font-semibold tracking-tight opacity-80 uppercase">Store Owner</p>
              </div>
              <div className="size-10 rounded-full border border-[var(--accent)]/30 bg-gradient-to-tr from-[var(--accent)]/20 to-indigo-600/10 flex items-center justify-center font-bold text-[var(--accent)] overflow-hidden shadow-sm hover:rotate-3 transition-transform">
                {user?.avatar ? <img src={user.avatar} className="size-full object-cover" alt={user.name} /> : <span>{user?.name?.[0]?.toUpperCase() || 'M'}</span>}
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6 space-y-6 no-scrollbar relative z-10">
          {error && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className=" font-bold">Authentication / Authorization Error</p>
                  <p className="text-sm mt-1">{error}</p>
                </div>
                <div className="flex items-center gap-2">
      {/* Surgical Header */}
      <div className="px-4 md:px-6 py-4 md:py-6 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/10 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] border border-[var(--accent)]/20 shrink-0">
              <span className="material-symbols-outlined">dashboard</span>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Platform Command</h1>
              <p className="text-[10px] md:text-[11px] lg:text-[12px] font-semibold text-[var(--text-secondary)] opacity-40 tracking-tight">Global Administrative Hub</p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
             <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/5 border border-emerald-500/10">
                <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] md:text-[11px] lg:text-[12px] font-semibold text-emerald-500 uppercase">Systems Nominal</span>
             </div>
             <button className="p-2 md:p-2.5 rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all active:scale-90">
                <span className="material-symbols-outlined">refresh</span>
             </button>
          </div>
        </div>
      </div>
                <Link href="/login" className="text-sm  font-bold bg-red-600 text-white px-3 py-1 rounded">Sign In</Link>
                <button onClick={() => logout()} className="text-sm  font-bold border border-red-600 text-red-600 px-3 py-1 rounded">Clear Session</button>
                </div>
              </div>
            </div>
          )}
          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, idx) => {
              const c = colorMap[stat.color];
              return (
                <div key={stat.label} className="glass-panel p-4 md:p-5 rounded-2xl md:rounded-[2rem] hover:-translate-y-1 transition-all duration-500 bg-[var(--bg-primary)]/60 border border-[var(--glass-border)] shadow-sm hover:shadow-xl group">
                  <div className="flex justify-between items-start mb-3 md:mb-4">
                    <div className={`size-8 md:size-10 rounded-xl md:rounded-2xl ${c.bg} flex items-center justify-center ${c.text} shadow-inner`}>
                      <span className="material-symbols-outlined text-lg md:text-xl group-hover:scale-110 transition-transform">{stat.icon}</span>
                    </div>
                    {stat.pct ? (
                      <span className={`text-[9px] md:text-[11px] lg:text-[12px] font-semibold px-2 md:px-3 py-0.5 md:py-1 rounded-full ${c.badgeBg} ${c.badgeText} tracking-tight`}>{stat.pct}</span>
                    ) : (
                      <Link href="/wallet" className="text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all">
                        <span className="material-symbols-outlined text-lg group-hover:translate-x-1 transition-transform">arrow_forward_ios</span>
                      </Link>
                    )}
                  </div>
                  <p className="text-[var(--text-secondary)] text-[9px] md:text-[11px] lg:text-[12px] font-semibold tracking-tight opacity-40 mb-1 capitalize">{stat.label}</p>
                  <h3 className="text-lg md:text-2xl font-bold text-[var(--text-primary)] tracking-tighter font-mono">{stat.value}</h3>
                  {stat.color !== 'purple' ? (
                    <div className="mt-3 md:mt-4 h-1 w-full bg-[var(--bg-secondary)] rounded-full overflow-hidden shadow-inner">
                      <div className={`${c.bar} h-full transition-all duration-1000`} style={{ width: c.w, boxShadow: `0 0 10px ${c.glow}` }} />
                    </div>
                  ) : (
                    <div className="mt-3 md:mt-4 flex gap-2">
                      <Link href="/wallet" className="flex-1 bg-[var(--accent)] hover:opacity-90 text-white text-[9px] md:text-[11px] lg:text-[12px] font-semibold py-2 rounded-xl shadow-lg shadow-[var(--accent)]/20 transition-all tracking-tight active:scale-95 text-center flex items-center justify-center">Withdraw</Link>
                      <Link href="/wallet" className="flex-1 glass-panel hover:bg-[var(--accent)]/5 text-[var(--text-primary)] text-[9px] md:text-[11px] lg:text-[12px] font-semibold py-2 rounded-xl transition-all text-center border border-[var(--glass-border)] tracking-tight active:scale-95 flex items-center justify-center">Wallet</Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="glass-panel p-6 rounded-[2rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/50">
            <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight  text-[var(--text-secondary)] mb-4">Finance Intelligence</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="rounded-2xl border border-[var(--glass-border)] p-4 bg-[var(--bg-secondary)]/20">
                <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight text-[var(--text-secondary)] opacity-50 mb-1">Available</p>
                <p className=" font-bold text-[var(--text-primary)] text-lg tracking-tighter">{walletBalance.toLocaleString()} XAF</p>
              </div>
              <div className="rounded-2xl border border-[var(--glass-border)] p-4 bg-[var(--bg-secondary)]/20">
                <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight text-[var(--text-secondary)] opacity-50 mb-1">In Escrow</p>
                <p className=" font-bold text-[var(--text-primary)] text-lg tracking-tighter">{pendingEscrow.toLocaleString()} XAF</p>
              </div>
              <div className="rounded-2xl border border-[var(--glass-border)] p-4 bg-[var(--bg-secondary)]/20">
                <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight text-[var(--text-secondary)] opacity-50 mb-1">Recent Paid</p>
                <p className=" font-bold text-[var(--text-primary)] text-lg tracking-tighter">{recentPaid.toLocaleString()} XAF</p>
              </div>
            </div>
          </div>
          
          {/* Aura Stories Quick Action */}
          <div className="glass-panel p-6 rounded-[2rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/50 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] border border-[var(--accent)]/20 shadow-lg">
                <span className="material-symbols-outlined text-2xl">auto_awesome</span>
              </div>
              <div>
                <h3 className="text-sm  font-bold text-[var(--text-primary)]  tracking-tighter">Aura Stories Manager</h3>
                <p className="text-[10px] lg:text-[12px] text-[var(--text-secondary)]  font-semibold opacity-50 tracking-tight">Share updates & engage with your followers</p>
              </div>
            </div>
            <Link href="/vendor/stories" className="px-6 py-3 bg-[var(--accent)] text-white rounded-full text-[11px] lg:text-[12px]  font-semibold tracking-tight shadow-lg shadow-[var(--accent)]/20 hover:scale-105 transition-all">
              Launch Story Hub
            </Link>
          </div>

          {/* Middle: Chart + Orders */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Sales Chart */}
            <div className="lg:col-span-2 glass-panel rounded-[2rem] p-6 border border-[var(--glass-border)] bg-[var(--bg-primary)]/50 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-sm  font-bold text-[var(--text-primary)] tracking-tighter ">Sales Growth</h3>
                  <p className="text-[10px] lg:text-[12px] text-[var(--text-secondary)]  font-semibold opacity-50 tracking-tight">Monthly sales trends</p>
                </div>
                <select className="bg-[var(--bg-primary)] border border-[var(--glass-border)] text-[var(--text-primary)] text-[11px] lg:text-[12px]  font-semibold rounded-full px-4 py-2 focus:outline-none tracking-tight">
                  <option>Last 6 Months</option>
                  <option>Last Year</option>
                </select>
              </div>
              <div className="relative h-48 w-full flex items-end gap-1.5 pt-8">
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-5">
                  {[0,1,2,3].map(i => <div key={i} className="w-full border-t border-[var(--text-secondary)] h-px" />)}
                </div>
                {[40, 65, 50, 85, 70, 95].map((h, i) => (
                  <div key={i} className={`flex-1 rounded-t-md transition-all cursor-crosshair ${i === 5 ? 'bg-[var(--accent)] hover:bg-[var(--accent)]/80' : 'bg-[var(--accent)]/20 hover:bg-[var(--accent)]/40'}`}
                    style={{ height: `${h}%` }}
                    title={['Jan','Feb','Mar','Apr','May','Jun'][i]}
                  />
                ))}
              </div>
              <div className="flex justify-between mt-3 px-1 text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] tracking-tight  opacity-40">
                {['Jan','Feb','Mar','Apr','May','Jun'].map(m => <span key={m}>{m}</span>)}
              </div>
            </div>

            {/* Recent Orders */}
            <div className="glass-panel rounded-[2rem] p-6 flex flex-col border border-[var(--glass-border)] bg-[var(--bg-primary)]/50">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm  font-bold text-[var(--text-primary)]  tracking-tighter">Recent Activity</h3>
                <Link href="/vendor/orders" className="text-[var(--accent)] text-[11px] lg:text-[12px]  font-semibold tracking-tight hover:underline">View All</Link>
              </div>
              <div className="space-y-5 flex-1">
                {orders.slice(0, 4).map((order, i) => (
                   <Link 
                      key={order._id || i} 
                      href={`/vendor/orders?orderId=${order._id}`}
                      className="flex items-center gap-4 group cursor-pointer hover:bg-[var(--accent)]/5 p-2 rounded-xl transition-all"
                   >
                    <div className="size-10 rounded-full glass-panel overflow-hidden border border-[var(--glass-border)] flex items-center justify-center text-[var(--accent)]  font-bold text-sm bg-[var(--bg-secondary)]">
                      {order.customer_id?.name?.[0] || 'C'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm  font-bold text-[var(--text-primary)] truncate tracking-tighter">{order.products?.[0]?.name || 'Order Item'}</p>
                      <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight text-[var(--text-secondary)] opacity-40">
                        #{order._id?.slice(-5) || i} • {order.createdAt ? new Date(order.createdAt).toLocaleTimeString() : '—'}
                      </p>
                    </div>
                    <p className="text-sm  font-bold text-[var(--text-primary)]">{order.total_amount ? `${Number(order.total_amount).toLocaleString()} XAF` : '—'}</p>
                  </Link>
                ))}
                {orders.length === 0 && (
                  <div className="flex-1 flex items-center justify-center text-[var(--text-secondary)] text-sm">No orders yet</div>
                )}
              </div>
            </div>
          </div>

          {/* Live Order Tracking Table */}
          <div className="glass-panel rounded-[2rem] overflow-hidden border border-[var(--glass-border)] bg-[var(--bg-primary)]/50 shadow-sm">
            <div className="p-5 md:p-6 border-b border-[var(--glass-border)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="text-sm font-bold text-[var(--text-primary)] tracking-tighter">Active Transmissions</h3>
              <div className="flex gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto pb-1 sm:pb-0">
                <button className="bg-[var(--accent)]/10 text-[var(--accent)] text-[10px] lg:text-[12px] px-4 py-1.5 rounded-full font-semibold tracking-tight whitespace-nowrap">ALL</button>
                <button className="text-[var(--text-secondary)] text-[10px] lg:text-[12px] px-4 py-1.5 rounded-full font-semibold tracking-tight hover:bg-[var(--accent)]/5 whitespace-nowrap uppercase">Processing</button>
                <button className="text-[var(--text-secondary)] text-[10px] lg:text-[12px] px-4 py-1.5 rounded-full font-semibold tracking-tight hover:bg-[var(--accent)]/5 whitespace-nowrap uppercase">Shipped</button>
              </div>
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[11px] lg:text-[12px] font-semibold tracking-tight text-[var(--text-secondary)] bg-[var(--bg-secondary)]/50 uppercase">
                    <th className="px-6 py-4">Product</th>
                    <th className="px-6 py-4">Order ID</th>
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Amount</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--glass-border)]">
                  {orders.slice(0, 5).map((order, i) => {
                    const status = order.order_status || 'processing';
                    const statusStyles = {
                      processing: 'bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/20',
                      shipped: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
                      delivered: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
                    };
                    return (
                      <tr 
                        key={order._id || i} 
                        className="hover:bg-[var(--accent)]/5 transition-colors cursor-pointer"
                        onClick={() => window.location.href = `/vendor/orders?orderId=${order._id}`}
                      >
                        <td className="px-6 py-4 flex items-center gap-3">
                          <div className="size-8 rounded bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--accent)] font-bold text-xs uppercase">
                            {order.products?.[0]?.name?.[0] || 'P'}
                          </div>
                          <span className="text-sm text-[var(--text-primary)] font-medium truncate max-w-[200px]">{order.products?.[0]?.name || 'Product'}</span>
                        </td>
                        <td className="px-6 py-4 text-xs text-[var(--text-secondary)] font-mono">#{order._id?.slice(-6) || i}</td>
                        <td className="px-6 py-4 text-sm text-[var(--text-primary)]">{order.customer_id?.name || '—'}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-[10px] lg:text-[12px] font-semibold tracking-tight capitalize border ${statusStyles[status] || statusStyles.processing}`}>
                            <span className="size-1.5 rounded-full bg-current animate-pulse" />
                            {status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-[var(--text-primary)] tabular-nums">{order.total_amount ? `${Number(order.total_amount).toLocaleString()} XAF` : '—'}</td>
                        <td className="px-6 py-4 text-right">
                          <button className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                            <span className="material-symbols-outlined">more_horiz</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-[var(--text-secondary)] text-xs font-bold opacity-30">NO_ACTIVE_TRANSMISSIONS</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-[var(--glass-border)]">
              {orders.slice(0, 5).map((order, i) => {
                const status = order.order_status || 'processing';
                const statusStyles = {
                  processing: 'bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/20',
                  shipped: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
                  delivered: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
                };
                return (
                  <div 
                    key={order._id || i} 
                    className="p-5 flex flex-col gap-4 active:bg-[var(--accent)]/5 transition-colors"
                    onClick={() => window.location.href = `/vendor/orders?orderId=${order._id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--accent)] font-bold text-sm uppercase">
                          {order.products?.[0]?.name?.[0] || 'P'}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[var(--text-primary)] truncate max-w-[180px]">{order.products?.[0]?.name || 'Product'}</p>
                          <p className="text-[10px] font-mono text-[var(--text-secondary)] opacity-40">#{order._id?.slice(-6) || i}</p>
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-[9px] font-semibold tracking-tight capitalize border ${statusStyles[status] || statusStyles.processing}`}>
                        <span className="size-1 rounded-full bg-current animate-pulse" />
                        {status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-[var(--glass-border)]/30">
                       <p className="text-[10px] font-semibold text-[var(--text-secondary)] opacity-60">{order.customer_id?.name || 'Unknown Customer'}</p>
                       <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums">{order.total_amount ? `${Number(order.total_amount).toLocaleString()} XAF` : '—'}</p>
                    </div>
                  </div>
                );
              })}
              {orders.length === 0 && (
                <div className="p-10 text-center text-[var(--text-secondary)] text-[10px] font-bold opacity-30">NO_ACTIVE_TRANSMISSIONS</div>
              )}
            </div>
          </div>
        </div>
    </div>
  );
}
