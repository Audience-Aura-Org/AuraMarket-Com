"use client";

import { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, TrendingDown, Package, 
  BarChart3, Calendar, Download,
  Truck, Activity, Zap, Filter, 
  ArrowDownLeft, ArrowUpLeft,
  RefreshCw, MapPin, Shield,
  ArrowUpRight, LayoutDashboard, List, LineChart,
} from 'lucide-react';
import api from '@/services/api';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '@/hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LogisticsSubpageHeader,
  LogisticsShortcutsRow,
} from '@/components/logistics/LogisticsSubpageShell';

export const dynamic = 'force-dynamic';

export default function LogisticsAnalyticsPage() {
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(true);
  const [shipments, setShipments] = useState([]);
  const [range, setRange] = useState('30');
  const [hoveredBlock, setHoveredBlock] = useState(null);
  const [rebalancing, setRebalancing] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'logistics') return;

    const fetchData = async () => {
      try {
        const res = await api.get('/logistics/shipments');
        if (res.data.success) {
          setShipments(res.data.data?.shipments || res.data.shipments || []);
        }
      } catch (err) {
        console.error('Logistics Analytics fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const handleRebalance = async () => {
    setRebalancing(true);
    try {
      await api.post('/logistics/rebalance');
      toast.success('Rebalance triggered successfully');
    } catch {
      toast.error('Rebalance failed — please try again');
    } finally {
      setRebalancing(false);
    }
  };

  // Pre-bucket shipments by date for O(n) histogram
  const shipmentDateMap = useMemo(() => {
    const m = {};
    shipments.forEach((s) => {
      const k = (s.createdAt || s.created_at)?.slice(0, 10);
      if (k) m[k] = (m[k] || 0) + 1;
    });
    return m;
  }, [shipments]);

  // Transform shipment data into shipment flux (Histogram)
  const histogramData = useMemo(() => {
    const now = new Date();
    const data = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const count = shipmentDateMap[key] || 0;
      data.push({
        date: d,
        count,
        label: d.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        intensity: Math.min(count * 20, 100),
      });
    }
    return data;
  }, [shipmentDateMap]);

  // Compute regional stats from real shipment data
  const regionStats = useMemo(() => {
    const counts = {};
    shipments.forEach((s) => {
      const r = s.delivery_address?.region || s.destination_region || 'Other';
      counts[r] = (counts[r] || 0) + 1;
    });
    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    const COLORS = ['bg-emerald-500', 'bg-[var(--accent)]', 'bg-indigo-500', 'bg-rose-500'];
    return Object.entries(counts)
      .map(([name, n]) => ({ name, pct: Math.round((n / total) * 100) }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 4)
      .map((r, i) => ({ ...r, color: COLORS[i] || 'bg-gray-500' }));
  }, [shipments]);

  // Stats
  const activeShipments = shipments.filter(s => ['assigned', 'picked_up', 'in_transit', 'out_for_delivery', 'at_source', 'arrived_at_destination'].includes(s.status)).length;
  const totalDelivered = shipments.filter(s => s.status === 'delivered').length;
  const deliverySuccess = shipments.length > 0 
    ? Math.round((totalDelivered / shipments.length) * 100) 
    : 100;
  const pendingPickup = shipments.filter(s => s.status === 'pending').length;
  const networkStatus = deliverySuccess > 90 ? 'Optimal' : deliverySuccess > 70 ? 'Stable' : 'Degraded';

  // Calculate Efficiency Trend (Delivered last 7 days vs previous 7)
  const histogramEfficiency = histogramData.slice(-7).reduce((acc, d) => acc + d.count, 0);
  const prevEfficiency = histogramData.slice(-14, -7).reduce((acc, d) => acc + d.count, 0);
  const efficiencyTrend = prevEfficiency > 0 
    ? ((histogramEfficiency - prevEfficiency) / prevEfficiency * 100).toFixed(1)
    : '0.0';

  if (user?.role !== 'logistics') return null;

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col bg-[var(--bg-primary)] pb-[max(5.5rem,env(safe-area-inset-bottom,1.25rem))] text-[var(--text-primary)]">

      <LogisticsSubpageHeader
        Icon={BarChart3}
        title="Logistics"
        accentTitle="Intelligence"
        tag="Operational Analytics"
        hint="Shipment trends, regional efficiency & network performance"
        actions={
          <div className="flex shrink-0 gap-1.5">
            {['7', '30', '90'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setRange(t)}
                className={`touch-manipulation rounded-full px-3 py-2 text-[10px] font-semibold tracking-tight transition-all ${
                  range === t
                    ? 'bg-[var(--accent)] text-white shadow-md shadow-[var(--accent)]/20'
                    : 'border border-[var(--glass-border)] text-[var(--text-secondary)] active:bg-white/5'
                }`}
              >
                {t}D
              </button>
            ))}
          </div>
        }
      />

      <div className="mx-auto max-w-[1600px] w-full space-y-6 px-3 py-5 sm:space-y-8 sm:px-4 sm:py-6 md:p-8">

        {/* Navigation shortcuts */}
        <LogisticsShortcutsRow
          links={[
            { label: 'Dashboard',  sub: 'Ops overview',  icon: LayoutDashboard, href: '/logistics/dashboard'  },
            { label: 'Manifests',  sub: 'Shipments',     icon: List,             href: '/logistics/manifests'  },
            { label: 'Pricing',    sub: 'Zone rates',    icon: LineChart,        href: '/logistics/pricing'    },
          ]}
        />
        
        {/* Shipment Flux Histogram */}
        <section className="relative rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/10 p-4 sm:rounded-[2rem] sm:p-6 md:p-8">
          <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-bold tracking-tight md:text-base">Shipment Flux</h3>
              <p className="mt-1 text-[11px] font-bold tracking-tight text-[var(--text-secondary)] opacity-60 sm:text-xs">Daily Volume Trends</p>
            </div>
            <div className="flex gap-4">
               <div className="flex flex-col items-start sm:items-end">
                  <span className="text-[10px] font-semibold opacity-30 sm:text-[11px]">Peak Pulse</span>
                  <span className="text-xs font-bold text-emerald-500 sm:text-sm">Normal Range</span>
               </div>
            </div>
          </div>

          <div className="relative flex h-40 items-end gap-1 px-1 sm:h-48 sm:gap-1.5 sm:px-2">
            {histogramData.map((d, i) => (
              <motion.div
                key={i}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: `${Math.max(8, d.intensity)}%`, opacity: 1 }}
                transition={{ delay: i * 0.015, duration: 0.6 }}
                className="group relative flex min-w-[5px] flex-1 touch-manipulation rounded-t-md"
                onMouseEnter={() => setHoveredBlock(d)}
                onMouseLeave={() => setHoveredBlock(null)}
              >
                <div 
                  className={`w-full h-full rounded-t-lg transition-all duration-300 ${
                    d.count > 0 
                      ? 'bg-[var(--accent)] hover:bg-white shadow-[0_0_25px_rgba(var(--accent-rgb),0.2)]' 
                      : 'bg-[var(--text-secondary)]/5 hover:bg-[var(--text-secondary)]/20'
                  }`}
                />
                
                <AnimatePresence>
                  {hoveredBlock === d && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 10 }}
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-6 px-4 py-2 rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] text-[11px] lg:text-[12px]  font-semibold whitespace-nowrap z-50 shadow-2xl border border-[var(--glass-border)]"
                    >
                      {d.count} SHIPMENTS
                      <span className="block text-[11px] lg:text-[12px]  font-semibold opacity-60 ">{d.label}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>

          <div className="flex justify-between mt-6 px-2">
            <span className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-30 tracking-tight">{histogramData[0]?.label}</span>
            <span className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-30 tracking-tight">{histogramData[29]?.label}</span>
          </div>
        </section>

        {/* Intelligence Stats Grid */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {[
            { label: 'Network Health', value: networkStatus, sub: `${deliverySuccess}% Success`, icon: Shield, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
            { label: 'Active Manifests', value: activeShipments, sub: 'In pipeline', icon: Activity, color: 'text-blue-500', bg: 'bg-blue-500/10' },
            { label: 'Inbound Load', value: pendingPickup, sub: 'Awaiting intake', icon: Truck, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
            { label: 'Efficiency Yield', value: `${efficiencyTrend}%`, sub: 'vs last window', icon: TrendingUp, color: 'text-amber-500', bg: 'bg-amber-500/10' }
          ].map((stat, i) => (
            <motion.div
              key={i}
              whileHover={{ scale: 1.02 }}
              className="cursor-default rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4 shadow-sm transition-all hover:shadow-xl sm:p-6 md:rounded-[2rem] md:p-6"
            >
              <div className={`p-3 rounded-2xl ${stat.bg} w-fit mb-4 group-hover:scale-110 transition-transform shadow-inner`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] tracking-tight mb-1">{stat.label}</p>
              <h4 className="mb-1 text-2xl font-bold tracking-tight sm:text-3xl">{stat.value}</h4>
              <p className="text-[11px] lg:text-[12px]  font-semibold opacity-40 ">{stat.sub}</p>
            </motion.div>
          ))}
        </div>

        {/* Regional Efficiency */}
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
          <section className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4 shadow-sm sm:rounded-[2rem] sm:p-6 md:p-8">
            <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-bold tracking-tight md:text-base">Regional Efficiency</h3>
                <p className="text-xs text-[var(--text-secondary)] opacity-60">Transit Time Accuracy</p>
              </div>
              <MapPin className="w-5 h-5 text-[var(--accent)] opacity-20" />
            </div>
            
            <div className="space-y-6">
              {regionStats.length > 0 ? regionStats.map((reg, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between text-[11px] lg:text-[12px]  font-semibold tracking-tight">
                    <span>{reg.name}</span>
                    <span>{reg.pct}%</span>
                  </div>
                  <div className="h-1 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${reg.pct}%` }}
                      className={`h-full ${reg.color}`}
                    />
                  </div>
                </div>
              )) : (
                <p className="text-[11px] text-[var(--text-secondary)] opacity-60">No shipment data yet.</p>
              )}
            </div>
          </section>

          <section className="flex flex-col items-center justify-center rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/10 p-6 text-center shadow-sm sm:rounded-[2rem] sm:p-8 md:p-8">
            <div className="w-16 h-16 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mb-6">
              <Zap className="w-8 h-8 text-[var(--accent)]" />
            </div>
            <h3 className="text-base font-bold tracking-tight mb-2 md:text-lg">Automated Insights</h3>
            <p className="text-sm text-[var(--text-secondary)] opacity-60 mb-8 max-w-[280px]">
              Regional load in <span className="text-[var(--text-primary)]  font-bold">Douala</span> is peaking. Reallocate assets to Zone 04.
            </p>
            <button
              type="button"
              onClick={handleRebalance}
              disabled={rebalancing}
              className="min-h-11 touch-manipulation rounded-full bg-[var(--text-primary)] px-6 py-3 text-[11px] font-semibold tracking-[0.15em] text-[var(--bg-primary)] shadow-xl shadow-[var(--accent)]/10 transition-all hover:bg-[var(--accent)] hover:text-white active:scale-95 sm:px-8 sm:tracking-[0.2em] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {rebalancing && <RefreshCw className="size-3.5 animate-spin" />}
              Execute Rebalance
            </button>
          </section>
        </div>

      </div>
    </div>
  );
}
