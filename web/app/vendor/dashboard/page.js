"use client";

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/hooks/useAuth';
import Link from 'next/link';
import api from '@/services/api';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import StatCard from '@/components/layout/StatCard';
import { useRouter } from 'next/navigation';
import { ShieldAlert, Sparkles, LogOut, ArrowRight, RefreshCw, Search, Dashboard as DashboardIcon } from 'lucide-react';

export default function VendorDashboard() {
  const router = useRouter();
  const { user, token, logout, updateUser } = useAuthStore();
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
        setLoading(true);
        setError(null);
        
        // Helper to safely handle individual requests and detect 403 onboarding
        const safeGet = async (url) => {
          try {
            return await api.get(url);
          } catch (err) {
            if (err.response?.status === 403 || err.response?.status === 404) {
              const msg = err.response?.data?.message?.toLowerCase() || '';
              if (msg.includes('onboarding') || msg.includes('profile not found') || msg.includes('vendor profile not found')) {
                console.warn('[Dashboard] Authorization failed (Profile/Onboarding), redirecting...', url);
                updateUser({ ...user, onboarded: false }); // Break potential redirect loops
                router.replace('/onboarding');
                throw new Error('ONBOARDING_REQUIRED');
              }
            }
            throw err;
          }
        };

        const [productsRes, ordersRes, walletRes, vendorProfileRes] = await Promise.all([
          safeGet('/vendor/products'),
          safeGet('/vendor/orders'),
          safeGet('/wallet'),
          safeGet('/vendor/me'),
        ]);

        if (isMounted) {
          if (productsRes.data.success) {
            setProducts(productsRes.data.data.products || []);
          }
          if (ordersRes.data.success) {
            setOrders(ordersRes.data.data.orders || []);
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
        if (err.message === 'ONBOARDING_REQUIRED') return; // Handled above

        console.error('[VendorDashboard] Error:', err);
        if (isMounted) {
          setError(err.response?.data?.message || err.message || 'Failed to fetch data');
          setLoading(false);
        }
      }
    };

    if (mounted && authToken) {
      fetchData();
      const timer = setInterval(fetchData, 30000); // Polling every 30s
      return () => {
        isMounted = false;
        clearInterval(timer);
      };
    }
  }, [token, mounted]);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const [productsRes, ordersRes, walletRes, vendorProfileRes] = await Promise.all([
        api.get('/vendor/products'),
        api.get('/vendor/orders'),
        api.get('/wallet'),
        api.get('/vendor/me'),
      ]);

      if (productsRes.data.success) setProducts(productsRes.data.data.products || []);
      if (ordersRes.data.success) setOrders(ordersRes.data.data.orders || []);
      if (walletRes.data.success) {
        setWalletBalance(walletRes.data.data.balance || 0);
        setPendingEscrow(walletRes.data.data.pending_escrow || 0);
      }
      if (vendorProfileRes.data.success) setPendingEscrow(vendorProfileRes.data.data.escrow_balance || 0);
      
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const paidOrders = orders.filter((o) => o.payment_status === 'paid');
  const completedOrders = orders.filter((o) => ['delivered', 'completed'].includes(o.order_status));
  const openOrders = orders.filter((o) => !['delivered', 'completed', 'cancelled', 'refunded'].includes(o.order_status));
  const totalSales = paidOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  const recentPaid = paidOrders.slice(0, 5).reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

  const stats = [
    { label: 'Total Sales', value: `${totalSales.toLocaleString()} XAF`, icon: 'payments', color: 'emerald', pct: `${completedOrders.length} done`, sub: `+${recentPaid.toLocaleString()} recent` },
    { label: 'Open Orders', value: String(openOrders.length || 0), icon: 'shopping_bag', color: 'primary', pct: `${orders.length} total`, sub: `${orders.filter(o => o.order_status === 'processing').length} processing` },
    { label: 'Inventory', value: String(products.length || 0), icon: 'category', color: 'blue', pct: `${products.filter((p) => Number(p.stock || 0) > 0).length} in stock`, sub: `${products.filter(p => Number(p.stock || 0) === 0).length} out of stock` },
    { label: 'Wallet Balance', value: `${walletBalance.toLocaleString()} XAF`, icon: 'account_balance_wallet', color: 'purple', pct: null, sub: `${pendingEscrow.toLocaleString()} in escrow` },
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

    // Calculate monthly sales data for the chart
    const monthlySales = Array(6).fill(0).map((_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      const month = d.getMonth();
      const year = d.getFullYear();
      
      const monthSales = paidOrders.filter(o => {
        const od = new Date(o.createdAt);
        return od.getMonth() === month && od.getFullYear() === year;
      }).reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
      
      return {
        month: d.toLocaleString('default', { month: 'short' }),
        value: monthSales
      };
    });

    const maxMonthlySales = Math.max(...monthlySales.map(m => m.value), 1);

    return (
    <div className="relative bg-[var(--bg-secondary)] text-[var(--text-primary)] transition-colors duration-500">
        {/* Background blobs */}
        <div className="fixed top-[-10%] right-[-10%] size-[500px] bg-[var(--accent)]/5 blur-[120px] rounded-full pointer-events-none -z-0 transition-all duration-1000" />
        <div className="fixed bottom-[-10%] left-[20%] size-[400px] bg-indigo-600/5 blur-[100px] rounded-full pointer-events-none -z-0 transition-all duration-1000" />

        {/* Top Header */}
        <header className="min-h-20 py-4 flex flex-col md:flex-row md:h-24 items-center justify-between px-4 md:px-10 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-xl sticky top-14 lg:top-0 z-40 gap-4 md:gap-0">
          <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center gap-4">
              <div className="size-10 md:size-12 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] shadow-inner border border-[var(--accent)]/20 shrink-0">
                 <span className="material-symbols-outlined text-xl md:text-2xl">dashboard</span>
              </div>
              <div>
                <h2 className="text-lg md:text-xl font-bold text-[var(--text-primary)] tracking-tight">Vendor <span className="text-[var(--accent)]">Command</span></h2>
                <div className="flex items-center gap-2 mt-0.5">
                   <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                   <p className="text-[10px] md:text-[11px] lg:text-[12px] font-semibold text-[var(--text-secondary)] tracking-tight opacity-50 uppercase">Systems Nominal</p>
                </div>
              </div>
            </div>
            <button 
              onClick={handleRefresh} 
              className="md:hidden size-10 rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] flex items-center justify-center active:scale-95 disabled:opacity-50"
              disabled={loading}
            >
               <span className={`material-symbols-outlined text-xl ${loading ? 'animate-spin' : ''}`}>refresh</span>
            </button>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative flex-1 group md:w-80">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] text-lg opacity-20">search</span>
              <input 
                className="w-full h-11 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl pl-11 pr-4 text-[11px] lg:text-[12px] font-semibold outline-none focus:border-[var(--accent)] transition-all" 
                placeholder="Find anything..." 
                type="text" 
              />
            </div>
            
            <div className="hidden md:flex items-center gap-3 pl-6 border-l border-[var(--glass-border)]/30">
               <div className="text-right">
                 <p className="text-sm font-bold text-[var(--text-primary)] tracking-tight">{user?.name || 'Vendor'}</p>
                 <p className="text-[10px] font-semibold text-[var(--accent)] uppercase tracking-tight opacity-50">Store Info</p>
               </div>
               <div className="size-10 rounded-full bg-gradient-to-tr from-[var(--accent)] to-indigo-600 p-0.5 shadow-xl shadow-[var(--accent)]/10 hover:scale-110 transition-all cursor-pointer">
                 <div className="size-full rounded-full bg-[var(--bg-primary)] flex items-center justify-center overflow-hidden">
                   {user?.avatar ? (
                     <img src={user.avatar} className="size-full object-cover" alt={user.name} />
                   ) : (
                     <span className="text-[11px] font-bold text-[var(--text-primary)] uppercase">
                       {user?.name?.[0] || 'V'}
                     </span>
                   )}
                 </div>
               </div>
            </div>
          </div>
        </header>

        <div className="p-3 sm:p-6 space-y-6 relative z-10 pb-32">
          {error && (
            <div className="relative overflow-hidden p-6 rounded-[2rem] bg-[var(--bg-primary)]/40 backdrop-blur-2xl border border-white/5 shadow-2xl animate-in fade-in slide-in-from-top-4 flex flex-col md:flex-row items-center justify-between gap-6">
              {/* Background accent for onboarding */}
              {error.toLowerCase().includes('onboarding') || error.toLowerCase().includes('profile not found') ? (
                <div className="absolute inset-0 bg-gradient-to-r from-[var(--accent)]/5 to-transparent pointer-events-none" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-r from-rose-500/5 to-transparent pointer-events-none" />
              )}

              <div className="flex items-center gap-5 relative">
                 <div className={`size-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${error.toLowerCase().includes('onboarding') || error.toLowerCase().includes('profile not found') ? 'bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 shadow-[var(--accent)]/10' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20 shadow-rose-500/10'}`}>
                    {error.toLowerCase().includes('onboarding') || error.toLowerCase().includes('profile not found') ? <Sparkles className="size-6" /> : <ShieldAlert className="size-6" />}
                 </div>
                 <div className="space-y-1">
                   <p className="text-lg font-bold tracking-tight text-[var(--text-primary)]">
                     {error.toLowerCase().includes('onboarding') || error.toLowerCase().includes('profile not found') ? 'Onboarding Required' : 'Security Alert'}
                   </p>
                   <p className="text-[11px] lg:text-[12px] font-medium opacity-50 tracking-tight leading-relaxed max-w-md">
                     {error.toLowerCase().includes('onboarding') || error.toLowerCase().includes('profile not found') 
                       ? 'Your vendor profile is incomplete. Finish setup to access the marketplace and start selling.' 
                       : `Security verification required: ${error}`}
                   </p>
                 </div>
              </div>
              
              <div className="flex items-center gap-3 w-full md:w-auto relative">
                 {error.toLowerCase().includes('onboarding') || error.toLowerCase().includes('profile not found') ? (
                   <Link 
                     href="/onboarding" 
                     className="flex-1 md:flex-none px-8 py-3 bg-[var(--accent)] text-white rounded-xl text-xs font-bold tracking-tight hover:opacity-90 active:scale-95 transition-all shadow-xl shadow-[var(--accent)]/20 flex items-center justify-center gap-2"
                   >
                     Setup Store <ArrowRight className="size-4" />
                   </Link>
                 ) : (
                   <Link 
                     href="/login" 
                     className="flex-1 md:flex-none px-8 py-3 bg-rose-500 text-white rounded-xl text-xs font-bold tracking-tight hover:opacity-90 active:scale-95 transition-all shadow-xl shadow-rose-500/20 flex items-center justify-center gap-2"
                   >
                     Re-Authenticate
                   </Link>
                 )}
                 <button 
                   onClick={() => logout()} 
                   className="flex-1 md:flex-none px-6 py-3 border border-white/10 text-[var(--text-secondary)] hover:text-rose-500 rounded-xl text-xs font-bold tracking-tight hover:bg-rose-500/5 transition-all flex items-center justify-center gap-2"
                 >
                   <LogOut className="size-4" /> Sign Out
                 </button>
              </div>
            </div>
          )}

          {/* Operational Matrix — 4 Core KPIs */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Net Revenue */}
            <div className="relative overflow-hidden rounded-[2rem] bg-[var(--bg-primary)]/70 border border-[var(--glass-border)] backdrop-blur-xl p-5 flex flex-col gap-3 shadow-sm hover:shadow-xl transition-all group">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent pointer-events-none rounded-[2rem]" />
              <div className="flex items-center justify-between">
                <div className="size-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20 shrink-0">
                  <span className="material-symbols-outlined text-xl">payments</span>
                </div>
                <span className="text-[10px] font-medium tracking-wide text-[var(--text-secondary)] opacity-70">Revenue</span>
              </div>
              <div>
                <p className="mb-1 text-[10px] font-medium tracking-wide text-[var(--text-secondary)] opacity-65">Net sales</p>
                <p className="text-xl md:text-2xl font-bold text-[var(--text-primary)] tracking-tighter leading-none truncate">{totalSales.toLocaleString()} <span className="text-sm opacity-50">XAF</span></p>
              </div>
              <div className="h-1 w-full bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: '70%' }} />
              </div>
              <p className="text-[10px] font-medium tracking-tight text-emerald-600/80 dark:text-emerald-400/90">{completedOrders.length} orders fulfilled</p>
            </div>

            {/* Open Orders */}
            <div className="relative overflow-hidden rounded-[2rem] bg-[var(--bg-primary)]/70 border border-[var(--glass-border)] backdrop-blur-xl p-5 flex flex-col gap-3 shadow-sm hover:shadow-xl transition-all group">
              <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/5 via-transparent to-transparent pointer-events-none rounded-[2rem]" />
              <div className="flex items-center justify-between">
                <div className="size-10 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] border border-[var(--accent)]/20 shrink-0">
                  <span className="material-symbols-outlined text-xl">shopping_bag</span>
                </div>
                <span className="text-[10px] font-medium tracking-wide text-[var(--text-secondary)] opacity-70">Live</span>
              </div>
              <div>
                <p className="mb-1 text-[10px] font-medium tracking-wide text-[var(--text-secondary)] opacity-65">Open orders</p>
                <p className="text-xl md:text-2xl font-bold text-[var(--text-primary)] tracking-tighter leading-none">{openOrders.length}</p>
              </div>
              <div className="h-1 w-full bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                <div className="h-full bg-[var(--accent)] rounded-full transition-all duration-1000" style={{ width: orders.length ? `${Math.min((openOrders.length / orders.length) * 100, 100)}%` : '0%' }} />
              </div>
              <p className="text-[10px] font-medium tracking-tight text-[var(--accent)]/80">{orders.filter(o => o.order_status === 'processing').length} processing now</p>
            </div>

            {/* Inventory */}
            <div className="relative overflow-hidden rounded-[2rem] bg-[var(--bg-primary)]/70 border border-[var(--glass-border)] backdrop-blur-xl p-5 flex flex-col gap-3 shadow-sm hover:shadow-xl transition-all group">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/5 via-transparent to-transparent pointer-events-none rounded-[2rem]" />
              <div className="flex items-center justify-between">
                <div className="size-10 rounded-2xl bg-indigo-600/10 flex items-center justify-center text-indigo-500 border border-indigo-600/20 shrink-0">
                  <span className="material-symbols-outlined text-xl">category</span>
                </div>
                {products.filter(p => Number(p.stock || 0) <= 5).length > 0 && (
                  <span className="text-[10px] font-medium tracking-wide text-rose-500/90">
                    {products.filter(p => Number(p.stock || 0) <= 5).length} low stock
                  </span>
                )}
              </div>
              <div>
                <p className="mb-1 text-[10px] font-medium tracking-wide text-[var(--text-secondary)] opacity-65">Inventory</p>
                <p className="text-xl md:text-2xl font-bold text-[var(--text-primary)] tracking-tighter leading-none">{products.length} <span className="text-sm opacity-50">SKUs</span></p>
              </div>
              <div className="h-1 w-full bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000" style={{ width: products.length ? `${Math.min((products.filter(p => Number(p.stock || 0) > 0).length / products.length) * 100, 100)}%` : '0%' }} />
              </div>
              <p className="text-[10px] font-medium tracking-tight text-indigo-600/80 dark:text-indigo-400/90">{products.filter(p => Number(p.stock || 0) > 0).length} in stock · {products.filter(p => Number(p.stock || 0) === 0).length} out</p>
            </div>

            {/* Wallet Balance */}
            <div className="relative overflow-hidden rounded-[2rem] bg-[var(--bg-primary)]/70 border border-[var(--glass-border)] backdrop-blur-xl p-5 flex flex-col gap-3 shadow-sm hover:shadow-xl transition-all group">
              <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/5 via-transparent to-transparent pointer-events-none rounded-[2rem]" />
              <div className="flex items-center justify-between">
                <div className="size-10 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] border border-[var(--accent)]/20 shrink-0">
                  <span className="material-symbols-outlined text-xl">account_balance_wallet</span>
                </div>
                <Link href="/vendor/wallet" className="text-[10px] font-medium tracking-wide text-[var(--text-secondary)] opacity-70 transition-colors hover:text-[var(--accent)] hover:opacity-100">
                  Withdraw
                </Link>
              </div>
              <div>
                <p className="mb-1 text-[10px] font-medium tracking-wide text-[var(--text-secondary)] opacity-65">Wallet balance</p>
                <p className="text-xl md:text-2xl font-bold text-[var(--text-primary)] tracking-tighter leading-none truncate">{walletBalance.toLocaleString()} <span className="text-sm opacity-50">XAF</span></p>
              </div>
              <div className="h-1 w-full bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                <div className="h-full bg-[var(--accent)] rounded-full" style={{ width: '60%' }} />
              </div>
              <p className="text-[10px] font-medium tracking-tight text-[var(--accent)]/80">{pendingEscrow.toLocaleString()} XAF in escrow</p>
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
                  <p className="text-[10px] lg:text-[12px] text-[var(--text-secondary)]  font-semibold opacity-50 tracking-tight">Monthly revenue trends</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--glass-border)] bg-[var(--bg-primary)]/80 text-[10px] font-medium text-[var(--text-secondary)] opacity-80">
                  <span className="size-1.5 shrink-0 rounded-full bg-[var(--accent)] opacity-80" /> Live analysis
                </div>
              </div>
              <div className="relative h-48 w-full flex items-end gap-3 pt-8">
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-5">
                  {[0,1,2,3].map(i => <div key={i} className="w-full border-t border-[var(--text-secondary)] h-px" />)}
                </div>
                {monthlySales.map((m, i) => {
                  const h = (m.value / maxMonthlySales) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-3 group">
                      <div className="relative w-full flex-1 flex items-end justify-center">
                         <div 
                           className={`w-full max-w-[40px] rounded-t-xl transition-all duration-1000 ${i === 5 ? 'bg-[var(--accent)] shadow-[0_0_20px_rgba(var(--accent-rgb),0.3)]' : 'bg-[var(--accent)]/20 hover:bg-[var(--accent)]/40'}`}
                           style={{ height: `${Math.max(h, 5)}%` }}
                         />
                         {/* Tooltip */}
                         <div className="absolute -top-8 bg-[var(--bg-primary)] border border-[var(--glass-border)] px-2 py-1 rounded-lg text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl">
                            {m.value.toLocaleString()} XAF
                         </div>
                      </div>
                      <span className="text-[10px] font-bold text-[var(--text-secondary)] opacity-40 uppercase tracking-tighter">{m.month}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Recent Orders */}
            <div className="glass-panel rounded-[2rem] p-6 flex flex-col border border-[var(--glass-border)] bg-[var(--bg-primary)]/50">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm  font-bold text-[var(--text-primary)]  tracking-tighter">Recent Activity</h3>
                <Link href="/vendor/orders" className="text-[var(--accent)] text-[11px] lg:text-[12px]  font-semibold tracking-tight hover:underline">View All</Link>
              </div>
            <div className="space-y-5 flex-1">
                {orders.slice(0, 5).map((order, i) => (
                   <Link 
                      key={order._id || i} 
                      href={`/vendor/orders?orderId=${order._id}`}
                      className="flex items-center gap-4 group cursor-pointer hover:bg-[var(--accent)]/5 p-2 rounded-xl transition-all"
                   >
                    <div className="size-10 rounded-full glass-panel overflow-hidden border border-[var(--glass-border)] flex items-center justify-center text-[var(--accent)]  font-bold text-sm bg-[var(--bg-secondary)] shrink-0">
                      {order.customer_id?.name?.[0] || 'C'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm  font-bold text-[var(--text-primary)] truncate tracking-tighter">{order.products?.[0]?.name || 'Order Item'}</p>
                      <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight text-[var(--text-secondary)] opacity-40">
                        #{order._id?.slice(-5) || i} • {order.createdAt ? new Date(order.createdAt).toLocaleTimeString() : '—'}
                      </p>
                    </div>
                    <p className="text-sm  font-bold text-[var(--text-primary)] shrink-0">{order.total_amount ? `${Number(order.total_amount).toLocaleString()} XAF` : '—'}</p>
                  </Link>
                ))}
                {orders.length === 0 && (
                  <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-secondary)] opacity-30 py-10 text-center">
                    <span className="material-symbols-outlined text-4xl mb-2">inbox</span>
                    <p className="text-[11px] font-bold tracking-[0.2em] uppercase">No Activity</p>
                  </div>
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
                  {orders.slice(0, 10).map((order, i) => {
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
                          <Link href={`/vendor/orders?orderId=${order._id}`} className="size-8 rounded-lg bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all">
                             <span className="material-symbols-outlined text-sm">visibility</span>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {orders.length === 0 && (
                <div className="px-6 py-20 flex flex-col items-center justify-center text-[var(--text-secondary)] opacity-20 text-center">
                  <span className="material-symbols-outlined text-6xl mb-4">analytics</span>
                  <p className="text-[11px] font-bold tracking-[0.4em] uppercase">No Data Transmission</p>
                </div>
              )}
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-[var(--glass-border)]">
              {orders.slice(0, 10).map((order, i) => {
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
                <div className="p-20 flex flex-col items-center justify-center text-[var(--text-secondary)] opacity-20 text-center">
                  <span className="material-symbols-outlined text-5xl mb-4">analytics</span>
                  <p className="text-[11px] font-bold tracking-[0.3em] uppercase">No Data Transmission</p>
                </div>
              )}
            </div>
          </div>
        </div>
    </div>
  );
}
