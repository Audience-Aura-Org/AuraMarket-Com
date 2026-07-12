"use client";

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/hooks/useAuth';
import Link from 'next/link';
import api, { getCachedData } from '@/services/api';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  BarChart3,
  Boxes,
  CreditCard,
  Eye,
  Inbox,
  PlusSquare,
  RefreshCw,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  Wallet,
} from 'lucide-react';

const getResponseData = (res) => res?.data?.data || {};
const DASHBOARD_POLL_MS = 60_000;

const fulfilledValue = (result) => result?.status === 'fulfilled' ? result.value : null;

const getMonthBucketKey = (date) => {
  const safeDate = new Date(date);
  return `${safeDate.getFullYear()}-${String(safeDate.getMonth() + 1).padStart(2, '0')}`;
};

const buildMonthlySalesSeries = (analyticsHistory = [], paidOrders = []) => {
  const historyMap = new Map();

  analyticsHistory.forEach((entry) => {
    const rawKey = entry?._id || entry?.month || entry?.label || entry?.key;
    if (!rawKey) return;
    const key = String(rawKey).slice(0, 7);
    const revenue = Number(
      entry?.revenue ??
      entry?.value ??
      entry?.amount ??
      entry?.total ??
      0
    );
    historyMap.set(key, Number.isFinite(revenue) ? revenue : 0);
  });

  return Array.from({ length: 6 }, (_, i) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (5 - i));
    const key = getMonthBucketKey(date);
    const fallbackRevenue = paidOrders
      .filter((order) => getMonthBucketKey(order?.createdAt) === key)
      .reduce((sum, order) => sum + Number(order?.total_amount || 0), 0);
    const value = historyMap.has(key) ? historyMap.get(key) : fallbackRevenue;

    return {
      key,
      month: date.toLocaleString('default', { month: 'short' }).toUpperCase(),
      value: Number.isFinite(value) ? value : 0,
    };
  });
};

const getOrderProductName = (order) => {
  const item = order?.products?.[0];
  return item?.name || item?.product_name || item?.product_id?.name || 'Product';
};

const isPaidOrder = (order) => ['paid', 'completed'].includes(order?.payment_status);
const isCompletedOrder = (order) => ['delivered', 'completed'].includes(order?.order_status);
const isOpenOrder = (order) => !['delivered', 'completed', 'cancelled', 'refunded'].includes(order?.order_status);

export default function VendorDashboard() {
  const router = useRouter();
  const { t } = useLanguage();
  const { user, updateUser } = useAuthStore();
  const [orderFilter, setOrderFilter] = useState('all');
  const [mounted, setMounted] = useState(false);
  const [orders, setOrders] = useState([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [pendingEscrow, setPendingEscrow] = useState(0);
  const [analyticsStats, setAnalyticsStats] = useState(null);
  const [analyticsHistory, setAnalyticsHistory] = useState([]);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [signalCount, setSignalCount] = useState(null); // active live signals

  useEffect(() => {
    // Attempt instant render from local cache
    try {
      const cachedOrders = getCachedData('/vendor/orders');
      const cachedWallet = getCachedData('/wallet');
      const cachedAnalytics = getCachedData('/vendor/analytics');
      const cachedSubscription = getCachedData('/subscriptions/me', { role: 'vendor' });

      let foundCache = false;
      if (cachedOrders?.orders) {
        setOrders(cachedOrders.orders);
        foundCache = true;
      }
      if (cachedWallet) {
        setWalletBalance(cachedWallet.balance ?? 0);
        setPendingEscrow(cachedWallet.pending_escrow ?? 0);
        foundCache = true;
      }
      if (cachedAnalytics) {
        setAnalyticsStats(cachedAnalytics.stats || null);
        setAnalyticsHistory(cachedAnalytics.sales_history || []);
        foundCache = true;
      }
      if (cachedSubscription) {
        setSubscriptionStatus(cachedSubscription);
        foundCache = true;
      }
      if (foundCache) setLoading(false);
    } catch (e) {
      console.warn('Dashboard instant cache load failed:', e);
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    let isMounted = true;
    if (!mounted) return;
    setError(null);

    const fetchData = async (isBackground = false) => {
      try {
        const hasData = orders.length > 0 || analyticsStats !== null;
        if (!isBackground && !hasData) setLoading(true);
        setError(null);

        const safeGet = async (url) => {
          try {
            return await api.get(url);
          } catch (err) {
            if (err.response?.status === 403 || err.response?.status === 404) {
              const msg = err.response?.data?.message?.toLowerCase() || '';
              if (msg.includes('onboarding') || msg.includes('profile not found') || msg.includes('vendor profile not found')) {
                console.warn('[Dashboard] Authorization failed, redirecting...', url);
                updateUser({ ...user, onboarded: false });
                router.replace('/onboarding');
                throw new Error('ONBOARDING_REQUIRED');
              }
            }
            throw err;
          }
        };

        // Only 3 parallel requests instead of 5 — /vendor/products dropped;
        // analytics already returns all product stats + low_stock_count.
        const [ordersResult, walletResult, analyticsResult, subscriptionResult, signalResult] = await Promise.allSettled([
          safeGet('/vendor/orders'),
          safeGet('/wallet'),
          safeGet('/vendor/analytics'),
          api.get('/subscriptions/me', { params: { role: 'vendor' }, skipClientCache: true, silent: true }).catch(() => null),
          api.get('/statuses/my-statuses', { silent: true }).catch(() => null),
        ]);

        if (isMounted) {
          const ordersRes    = fulfilledValue(ordersResult);
          const walletRes    = fulfilledValue(walletResult);
          const analyticsRes = fulfilledValue(analyticsResult);
          const subscriptionRes = fulfilledValue(subscriptionResult);
          const signalRes    = fulfilledValue(signalResult);
          if (signalRes?.data?.success) {
            const now = new Date();
            const active = (signalRes.data.data || []).filter((s) => new Date(s.expires_at) > now);
            setSignalCount(active.length);
          }

          const ordersData    = getResponseData(ordersRes);
          const walletData    = getResponseData(walletRes);
          const analyticsData = getResponseData(analyticsRes);
          const subscriptionData = subscriptionRes?.data?.data || null;

          if (ordersRes?.data?.success) setOrders(ordersData.orders || analyticsData.recent_orders || []);
          if (walletRes?.data?.success) {
            setWalletBalance(walletData.balance ?? analyticsData.stats?.wallet_balance ?? 0);
            setPendingEscrow(walletData.pending_escrow ?? analyticsData.stats?.pending_escrow ?? 0);
          }
          if (analyticsRes?.data?.success) {
            setAnalyticsStats(analyticsData.stats || null);
            setAnalyticsHistory(analyticsData.sales_history || []);
            if (!ordersRes?.data?.success) setOrders(analyticsData.recent_orders || []);
            if (!walletRes?.data?.success) {
              setWalletBalance(analyticsData.stats?.wallet_balance ?? 0);
              setPendingEscrow(analyticsData.stats?.pending_escrow ?? 0);
            }
          }
          setSubscriptionStatus(subscriptionData);
          setLoading(false);
        }
      } catch (err) {
        if (err.message === 'ONBOARDING_REQUIRED') return;
        console.error('[VendorDashboard] Error:', err);
        if (isMounted) {
          setError(err.response?.data?.message || err.message || 'Failed to fetch data');
          setLoading(false);
        }
      }
    };

    const shouldPoll = () => typeof document === 'undefined' || document.visibilityState === 'visible';
    const poll = () => {
      if (shouldPoll()) fetchData(true);
    };
    const handleVisible = () => {
      if (document.visibilityState === 'visible') fetchData(true);
    };

    fetchData(true);
    const timer = setInterval(poll, DASHBOARD_POLL_MS);
    document.addEventListener('visibilitychange', handleVisible);
    return () => {
      isMounted = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisible);
    };
  }, [mounted, router, updateUser, user]);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const [ordersResult, walletResult, analyticsResult, subscriptionResult, signalResult] = await Promise.allSettled([
        api.get('/vendor/orders'),
        api.get('/wallet'),
        api.get('/vendor/analytics'),
        api.get('/subscriptions/me', { params: { role: 'vendor' }, skipClientCache: true, silent: true }).catch(() => null),
        api.get('/statuses/my-statuses', { silent: true }).catch(() => null),
      ]);

      const ordersRes    = fulfilledValue(ordersResult);
      const walletRes    = fulfilledValue(walletResult);
      const analyticsRes = fulfilledValue(analyticsResult);
      const subscriptionRes = fulfilledValue(subscriptionResult);
      const signalRes    = fulfilledValue(signalResult);
      const ordersData    = getResponseData(ordersRes);
      const walletData    = getResponseData(walletRes);
      const analyticsData = getResponseData(analyticsRes);
      const subscriptionData = subscriptionRes?.data?.data || null;

      if (ordersRes?.data?.success) setOrders(ordersData.orders || analyticsData.recent_orders || []);
      if (walletRes?.data?.success) {
        setWalletBalance(walletData.balance ?? analyticsData.stats?.wallet_balance ?? 0);
        setPendingEscrow(walletData.pending_escrow ?? analyticsData.stats?.pending_escrow ?? 0);
      }
      if (analyticsRes?.data?.success) {
        setAnalyticsStats(analyticsData.stats || null);
        setAnalyticsHistory(analyticsData.sales_history || []);
        if (!ordersRes?.data?.success) setOrders(analyticsData.recent_orders || []);
        if (!walletRes?.data?.success) {
          setWalletBalance(analyticsData.stats?.wallet_balance ?? 0);
          setPendingEscrow(analyticsData.stats?.pending_escrow ?? 0);
        }
      }
      if (signalRes?.data?.success) {
        const now = new Date();
        const active = (signalRes.data.data || []).filter((s) => new Date(s.expires_at) > now);
        setSignalCount(active.length);
      }
      setSubscriptionStatus(subscriptionData);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const paidOrders = orders.filter(isPaidOrder);
  const completedOrders = orders.filter(isCompletedOrder);
  const openOrders = orders.filter(isOpenOrder);
  const totalSales = analyticsStats?.total_revenue ?? paidOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  const totalProducts = analyticsStats?.total_products ?? 0;
  const inStockProducts = analyticsStats?.in_stock_products ?? 0;
  const outOfStockProducts = analyticsStats?.out_of_stock_products ?? 0;
  const lowStockCount = analyticsStats?.low_stock_count ?? 0;
  const processingOrders = analyticsStats?.processing_orders ?? orders.filter(o => o.order_status === 'processing').length;
  const openOrderCount = analyticsStats?.open_orders ?? openOrders.length;
  const fulfilledOrderCount = analyticsStats?.total_sales ?? completedOrders.length;
  const subscriptionRequired  = subscriptionStatus?.required;
  const subscriptionSubscribed = subscriptionStatus?.subscribed;
  const subscriptionGrace = subscriptionStatus?.grace || subscriptionStatus?.access_state === 'grace';
  const subscriptionLimited = subscriptionStatus?.limited || subscriptionStatus?.access_state === 'limited';
  const subscriptionUnsubscribed = !subscriptionSubscribed && !subscriptionGrace && !subscriptionLimited;

  // Build an accurate label: show plan name + expiry when active
  const activePlanName = subscriptionStatus?.subscription?.plan_id?.name || null;
  const expiresAt = subscriptionStatus?.subscription?.expires_at
    ? new Date(subscriptionStatus.subscription.expires_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  const subscriptionLabel = !subscriptionRequired
    ? t('subscription.storeActive', 'Store active')
    : subscriptionSubscribed
      ? activePlanName
        ? `${activePlanName}${expiresAt ? ` · exp. ${expiresAt}` : ''}`
        : t('subscription.packageActive', 'Package active')
      : subscriptionGrace
        ? t('subscription.graceShort', 'Grace period')
        : t('subscription.packageNeeded', 'Get a package');
  const subscriptionDotClass = !subscriptionRequired || subscriptionSubscribed
    ? 'bg-emerald-500'
    : subscriptionGrace
      ? 'bg-amber-500'
      : 'bg-rose-500';

  if (!mounted) return null;

    const monthlySales = buildMonthlySalesSeries(analyticsHistory, paidOrders);
    const hasMonthlySalesData = monthlySales.some((entry) => entry.value > 0);
    // Growth % vs previous month
    const currentMonthVal = monthlySales[5]?.value ?? 0;
    const prevMonthVal = monthlySales[4]?.value ?? 0;
    const growthPct = prevMonthVal > 0
      ? Math.round(((currentMonthVal - prevMonthVal) / prevMonthVal) * 100)
      : currentMonthVal > 0 ? 100 : 0;
    const isGrowthPositive = growthPct >= 0;

    return (
    <div className="relative bg-[var(--bg-secondary)] text-[var(--text-primary)] transition-colors duration-500">
        {/* Background blobs */}
        <div className="fixed top-[-10%] right-[-10%] size-[500px] bg-[var(--accent)]/5 blur-[120px] rounded-full pointer-events-none -z-0 transition-all duration-1000" />
        <div className="fixed bottom-[-10%] left-[20%] size-[400px] bg-indigo-600/5 blur-[100px] rounded-full pointer-events-none -z-0 transition-all duration-1000" />

        {/* Redesigned Header */}
        <header className="relative sticky top-14 lg:top-0 z-40 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-2xl">
          {/* Accent gradient line */}
          <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--accent)]/40 to-transparent" />
          <div className="mx-auto max-w-[1600px] px-4 py-3 sm:px-6 md:px-8">
            {/* Row 1: Logo + Title + Status + Actions */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 md:gap-4 min-w-0">
                <div className="size-10 md:size-11 rounded-2xl bg-gradient-to-br from-[var(--accent)]/20 to-indigo-600/10 flex items-center justify-center text-[var(--accent)] border border-[var(--accent)]/20 shrink-0 shadow-lg shadow-[var(--accent)]/5">
                   <img src="/icon-192.png" alt="Auradime" className="size-6 md:size-7 object-contain" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base md:text-lg font-bold text-[var(--text-primary)] tracking-tight font-[Poppins]">Vendor Dashboard</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                     <div className={`size-1.5 rounded-full ${subscriptionDotClass} animate-pulse`} />
                     <Link
                       href="/subscribe?role=vendor"
                       className="text-[10px] font-semibold text-[var(--text-secondary)] tracking-tight opacity-60 transition-colors hover:text-[var(--accent)] hover:opacity-100 font-[Poppins]"
                     >
                       {subscriptionLabel}
                     </Link>
                     <span className="hidden sm:inline text-[var(--text-secondary)] opacity-20">·</span>
                     <span className="hidden sm:inline text-[10px] font-medium text-[var(--text-secondary)] opacity-40 font-[Poppins]">{user?.name || 'Vendor'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 md:gap-3 shrink-0">
                <button 
                  onClick={handleRefresh} 
                  className="size-10 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/50 text-[var(--text-secondary)] flex items-center justify-center hover:text-[var(--accent)] hover:border-[var(--accent)]/30 active:scale-95 transition-all disabled:opacity-50"
                  disabled={loading}
                >
                   <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
                <Link href="/profile?tab=store" className="hidden md:flex items-center gap-3 pl-3 border-l border-[var(--glass-border)]/30">
                   <div className="text-right">
                     <p className="text-xs font-bold text-[var(--text-primary)] tracking-tight font-[Poppins]">{user?.name || 'Vendor'}</p>
                     <p className="text-[10px] font-semibold text-[var(--accent)]/60 tracking-tight font-[Poppins]">Store Info</p>
                   </div>
                   <div className="size-9 rounded-full bg-gradient-to-tr from-[var(--accent)] to-indigo-600 p-0.5 shadow-lg shadow-[var(--accent)]/10 hover:scale-105 transition-all">
                     <div className="size-full rounded-full bg-[var(--bg-primary)] flex items-center justify-center overflow-hidden">
                       {user?.avatar ? (
                         <img src={user.avatar} className="size-full object-cover" alt={user.name} />
                       ) : (
                         <span className="text-[10px] font-bold text-[var(--text-primary)] uppercase font-[Poppins]">
                           {user?.name?.[0] || 'V'}
                         </span>
                       )}
                     </div>
                   </div>
                </Link>
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
                  <CreditCard className="size-5" />
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
              <p className="text-[10px] font-medium tracking-tight text-emerald-600/80 dark:text-emerald-400/90">
                {fulfilledOrderCount} {t('dashboard.ordersFulfilled', 'orders fulfilled')}
              </p>
            </div>

            {/* Open Orders */}
            <Link href="/vendor/orders" className="relative overflow-hidden rounded-[2rem] bg-[var(--bg-primary)]/70 border border-[var(--glass-border)] backdrop-blur-xl p-5 flex flex-col gap-3 shadow-sm hover:shadow-xl hover:border-[var(--accent)]/30 transition-all group">
              <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/5 via-transparent to-transparent pointer-events-none rounded-[2rem]" />
              <div className="flex items-center justify-between">
                <div className="size-10 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] border border-[var(--accent)]/20 shrink-0">
                  <ShoppingBag className="size-5" />
                </div>
                <div className="flex items-center gap-1.5">
                  {openOrderCount > 0 && <span className="size-1.5 rounded-full bg-[var(--accent)] animate-pulse" />}
                  <span className="text-[10px] font-medium tracking-wide text-[var(--text-secondary)] opacity-70">Live</span>
                </div>
              </div>
              <div>
                <p className="mb-1 text-[10px] font-medium tracking-wide text-[var(--text-secondary)] opacity-65">Open orders</p>
                <p className="text-xl md:text-2xl font-bold text-[var(--text-primary)] tracking-tighter leading-none">{openOrderCount}</p>
              </div>
              <div className="h-1 w-full bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                <div className="h-full bg-[var(--accent)] rounded-full transition-all duration-1000" style={{ width: orders.length ? `${Math.min((openOrderCount / orders.length) * 100, 100)}%` : '0%' }} />
              </div>
              <p className="text-[10px] font-medium tracking-tight text-[var(--accent)]/80">{processingOrders} processing · tap to view →</p>
            </Link>

            {/* Inventory */}
            <div className="relative overflow-hidden rounded-[2rem] bg-[var(--bg-primary)]/70 border border-[var(--glass-border)] backdrop-blur-xl p-5 flex flex-col gap-3 shadow-sm hover:shadow-xl transition-all group">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/5 via-transparent to-transparent pointer-events-none rounded-[2rem]" />
              <div className="flex items-center justify-between">
                <div className="size-10 rounded-2xl bg-indigo-600/10 flex items-center justify-center text-indigo-500 border border-indigo-600/20 shrink-0">
                  <Boxes className="size-5" />
                </div>
                {lowStockCount > 0 && (
                  <span className="text-[10px] font-medium tracking-wide text-rose-500/90">
                    {lowStockCount} {t('dashboard.lowStock', 'low stock')}
                  </span>
                )}
              </div>
              <div>
                <p className="mb-1 text-[10px] font-medium tracking-wide text-[var(--text-secondary)] opacity-65">Inventory</p>
                <p className="text-xl md:text-2xl font-bold text-[var(--text-primary)] tracking-tighter leading-none">{totalProducts} <span className="text-sm opacity-50">SKUs</span></p>
              </div>
              <div className="h-1 w-full bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000" style={{ width: totalProducts ? `${Math.min((inStockProducts / totalProducts) * 100, 100)}%` : '0%' }} />
              </div>
              <p className="text-[10px] font-medium tracking-tight text-indigo-600/80 dark:text-indigo-400/90">
                {inStockProducts} {t('dashboard.inStock', 'in stock')} · {outOfStockProducts} {t('dashboard.outOfStockShort', 'out')}
              </p>
            </div>

            {/* Wallet Balance */}
            <div className="relative overflow-hidden rounded-[2rem] bg-[var(--bg-primary)]/70 border border-[var(--glass-border)] backdrop-blur-xl p-5 flex flex-col gap-3 shadow-sm hover:shadow-xl transition-all group">
              <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/5 via-transparent to-transparent pointer-events-none rounded-[2rem]" />
              <div className="flex items-center justify-between">
                <div className="size-10 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] border border-[var(--accent)]/20 shrink-0">
                  <Wallet className="size-5" />
                </div>
                <Link href="/vendor/wallet" className="text-[10px] font-medium tracking-wide text-[var(--text-secondary)] opacity-70 transition-colors hover:text-[var(--accent)] hover:opacity-100">
                  Withdraw
                </Link>
              </div>
              <div>
                <p className="mb-1 text-[10px] font-medium tracking-wide text-[var(--text-secondary)] opacity-65">{t('dashboard.walletBalance', 'Wallet balance')}</p>
                <p className="text-xl md:text-2xl font-bold text-[var(--text-primary)] tracking-tighter leading-none truncate">{walletBalance.toLocaleString()} <span className="text-sm opacity-50">XAF</span></p>
              </div>
              <div className="h-1 w-full bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                <div className="h-full bg-[var(--accent)] rounded-full" style={{ width: '60%' }} />
              </div>
              <p className="text-[10px] font-medium tracking-tight text-[var(--accent)]/80">{pendingEscrow.toLocaleString()} {t('dashboard.xafInEscrow', 'XAF in escrow')}</p>
            </div>
          </div>
          
          {/* Signal Center Quick Action */}
          <div className="glass-panel p-5 sm:p-6 rounded-[2rem] border border-[var(--accent)]/20 bg-gradient-to-br from-[var(--accent)]/5 to-[var(--bg-primary)]/80">
            <div className="flex flex-col md:flex-row items-center justify-between gap-5">
              {/* Icon + Text */}
              <div className="flex flex-col items-center text-center md:flex-row md:items-center md:text-left gap-3 md:gap-4 w-full md:w-auto">
                <div className="size-14 md:size-12 rounded-2xl bg-[var(--accent)]/15 flex items-center justify-center text-[var(--accent)] border border-[var(--accent)]/25 shadow-lg shadow-[var(--accent)]/10 shrink-0">
                  <Sparkles className="size-6" />
                </div>
                <div>
                  <div className="flex items-center justify-center md:justify-start gap-2">
                    <h3 className="text-sm font-bold text-[var(--text-primary)] tracking-tighter">{t('dashboard.storiesManager', 'Signal Center')}</h3>
                    {signalCount !== null && (
                      <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold border ${signalCount > 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-[var(--bg-secondary)] border-[var(--glass-border)] text-[var(--text-secondary)]'}`}>
                        <span className={`size-1.5 rounded-full ${signalCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-[var(--text-secondary)] opacity-40'}`} />
                        {signalCount > 0 ? `${signalCount} live` : 'No live signals'}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] lg:text-[12px] text-[var(--text-secondary)] font-semibold opacity-60 tracking-tight mt-0.5">{t('dashboard.storiesManagerSub', 'Broadcast updates · Engage followers · Drive sales')}</p>
                </div>
              </div>
              {/* Actions */}
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                <Link href="/vendor/products/add" className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-primary)] rounded-full text-[12px] font-semibold tracking-tight hover:border-[var(--accent)]/50 transition-all">
                  <PlusSquare className="size-4" />
                  Add Product
                </Link>
                <Link href="/vendor/stories" className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 bg-[var(--accent)] text-white rounded-full text-[12px] font-semibold tracking-tight shadow-lg shadow-[var(--accent)]/25 hover:scale-105 active:scale-95 transition-all">
                  <Sparkles className="size-4" />
                  Open Signal Center
                </Link>
              </div>
            </div>
          </div>

          {/* Middle: Chart + Orders */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Sales Chart */}
            <div className="lg:col-span-2 glass-panel rounded-[2rem] p-6 border border-[var(--glass-border)] bg-[var(--bg-primary)]/50 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)] tracking-tighter">{t('dashboard.salesGrowth', 'Sales Growth')}</h3>
                  <p className="text-[10px] lg:text-[12px] text-[var(--text-secondary)] font-semibold opacity-50 tracking-tight">{t('dashboard.monthlyRevenueTrends', 'Monthly revenue trends')}</p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Real growth % badge */}
                  <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full border text-[10px] font-bold tracking-tight ${
                    isGrowthPositive
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                  }`}>
                    <span>{isGrowthPositive ? '▲' : '▼'}</span>
                    <span>{Math.abs(growthPct)}% vs last month</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--glass-border)] bg-[var(--bg-primary)]/80 text-[10px] font-medium text-[var(--text-secondary)] opacity-80">
                    <span className="size-1.5 shrink-0 rounded-full bg-[var(--accent)] opacity-80" /> {t('dashboard.liveAnalysis', 'Live analysis')}
                  </div>
                </div>
              </div>
              <div className="h-48 w-full">
                {hasMonthlySalesData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlySales} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="dashboardRevenueFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.32} />
                          <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="rgba(148, 163, 184, 0.12)" />
                      <XAxis
                        dataKey="month"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--text-secondary)', opacity: 0.65 }}
                      />
                      <YAxis hide />
                      <Tooltip
                        cursor={{ stroke: 'rgba(255, 255, 255, 0.08)' }}
                        contentStyle={{
                          backgroundColor: 'var(--bg-primary)',
                          border: '1px solid var(--glass-border)',
                          borderRadius: '14px',
                          boxShadow: '0 18px 45px rgba(0, 0, 0, 0.18)',
                        }}
                        formatter={(value) => [`${Number(value).toLocaleString()} XAF`, 'Revenue']}
                        labelFormatter={(label) => `${label}`}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="var(--accent)"
                        strokeWidth={3}
                        fill="url(#dashboardRevenueFill)"
                        activeDot={{ r: 5, fill: 'var(--accent)', stroke: '#fff', strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center rounded-[1.5rem] border border-dashed border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 text-center">
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-[var(--text-primary)] tracking-tight">
                        {t('dashboard.noSalesData', 'No sales data yet')}
                      </p>
                      <p className="text-[10px] font-medium text-[var(--text-secondary)] opacity-60">
                        {t('dashboard.graphWillUpdate', 'The chart updates automatically when paid orders come in.')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {/* Recent Orders */}
            <div className="glass-panel rounded-[2rem] p-6 flex flex-col border border-[var(--glass-border)] bg-[var(--bg-primary)]/50">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm  font-bold text-[var(--text-primary)]  tracking-tighter">{t('dashboard.recentActivity', 'Recent Activity')}</h3>
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
                      <p className="text-sm  font-bold text-[var(--text-primary)] truncate tracking-tighter">{getOrderProductName(order)}</p>
                      <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight text-[var(--text-secondary)] opacity-40">
                        #{order._id?.slice(-5) || i} • {order.createdAt ? new Date(order.createdAt).toLocaleTimeString() : '—'}
                      </p>
                    </div>
                    <p className="text-sm  font-bold text-[var(--text-primary)] shrink-0">{order.total_amount ? `${Number(order.total_amount).toLocaleString()} XAF` : '—'}</p>
                  </Link>
                ))}
                {orders.length === 0 && (
                  <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-secondary)] opacity-30 py-10 text-center">
                    <Inbox className="mb-2 size-10" />
                    <p className="text-[11px] font-bold tracking-[0.2em] uppercase">{t('dashboard.noActivity', 'No Activity')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Live Order Tracking Table */}
          <div className="glass-panel rounded-[2rem] overflow-hidden border border-[var(--glass-border)] bg-[var(--bg-primary)]/50 shadow-sm">
            <div className="p-5 md:p-6 border-b border-[var(--glass-border)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="text-sm font-bold text-[var(--text-primary)] tracking-tighter">Recent Orders</h3>
              <div className="flex gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto pb-1 sm:pb-0">
                {['all', 'processing', 'shipped'].map(f => (
                  <button
                    key={f}
                    onClick={() => setOrderFilter(f)}
                    className={`text-[10px] lg:text-[12px] px-4 py-1.5 rounded-full font-semibold tracking-tight whitespace-nowrap uppercase transition-all font-[Poppins] ${
                      orderFilter === f
                        ? 'bg-[var(--accent)] text-white shadow-md shadow-[var(--accent)]/20'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--accent)]/5'
                    }`}
                  >
                    {f}
                  </button>
                ))}
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
                  {orders.filter(o => orderFilter === 'all' || o.order_status === orderFilter).slice(0, 10).map((order, i) => {
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
                        onClick={() => router.push(`/vendor/orders?orderId=${order._id}`)}
                      >
                        <td className="px-6 py-4 flex items-center gap-3">
                          <div className="size-8 rounded bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--accent)] font-bold text-xs uppercase">
                            {getOrderProductName(order)?.[0] || 'P'}
                          </div>
                          <span className="text-sm text-[var(--text-primary)] font-medium truncate max-w-[200px]">{getOrderProductName(order)}</span>
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
                             <Eye className="size-4" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {orders.length === 0 && (
                <div className="px-6 py-20 flex flex-col items-center justify-center text-[var(--text-secondary)] opacity-20 text-center">
                  <BarChart3 className="mb-4 size-14" />
                  <p className="text-[11px] font-bold tracking-[0.4em] uppercase">No orders yet</p>
                </div>
              )}
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-[var(--glass-border)]">
              {orders.filter(o => orderFilter === 'all' || o.order_status === orderFilter).slice(0, 10).map((order, i) => {
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
                    onClick={() => router.push(`/vendor/orders?orderId=${order._id}`)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--accent)] font-bold text-sm uppercase">
                          {getOrderProductName(order)?.[0] || 'P'}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[var(--text-primary)] truncate max-w-[180px]">{getOrderProductName(order)}</p>
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
                  <BarChart3 className="mb-4 size-12" />
                  <p className="text-[11px] font-bold tracking-[0.3em] uppercase">No orders yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
    </div>
  );
}
