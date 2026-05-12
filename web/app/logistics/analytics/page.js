"use client";

import { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, TrendingDown, Package, 
  BarChart3, Calendar, Download,
  Truck, Activity, Zap, Filter, 
  ArrowDownLeft, ArrowUpLeft,
  RefreshCw, MapPin, Shield,
  ArrowUpRight
} from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

export const dynamic = 'force-dynamic';

export default function LogisticsAnalyticsPage() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [shipments, setShipments] = useState([]);
  const [range, setRange] = useState('30');
  const [hoveredBlock, setHoveredBlock] = useState(null);

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

  // Transform shipment data into shipment flux (Histogram)
  const histogramData = useMemo(() => {
    if (!shipments.length) return Array(30).fill({ count: 0, intensity: 0 });
    
    const now = new Date();
    const data = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const count = shipments.filter(s => {
        const sd = new Date(s.createdAt);
        return sd.toDateString() === d.toDateString();
      }).length;
      
      data.push({
        date: d,
        count: count,
        label: d.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        intensity: Math.min(count * 20, 100)
      });
    }
    return data;
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
      {/* Mobile header */}
      <div className="sticky top-0 z-40 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/90 px-3 py-3 backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-[1600px] min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[var(--accent)]/20 bg-[var(--accent)]/10">
              <BarChart3 className="size-5 text-[var(--accent)]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-balance text-base font-bold tracking-tight">Logistics Intelligence</h1>
              <p className="text-[10px] font-semibold text-[var(--text-secondary)] opacity-50">Analytics</p>
            </div>
          </div>
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
        </div>
      </div>

      {/* Desktop header */}
      <div className="sticky top-0 z-30 hidden border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 px-4 py-6 backdrop-blur-xl md:block md:px-8 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center border border-[var(--accent)]/20 shadow-sm transition-transform hover:rotate-3">
              <BarChart3 className="w-6 h-6 text-[var(--accent)]" />
            </div>
            <div>
              <h1 className="text-2xl  font-bold tracking-tight">Logistics Intelligence</h1>
              <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] tracking-tight opacity-40">Operational Analytics</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            {['7', '30', '90'].map(t => (
              <button
                type="button"
                key={t}
                onClick={() => setRange(t)}
                className={`px-5 py-2 rounded-full text-[11px] lg:text-[12px]  font-semibold  transition-all tracking-tight ${
                  range === t ? 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/20' : 'text-[var(--text-secondary)] hover:bg-white/5 border border-transparent hover:border-[var(--glass-border)]'
                }`}
              >
                {t}D
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] space-y-6 px-3 py-5 sm:space-y-8 sm:px-4 sm:py-6 md:p-8">
        
        {/* Shipment Flux Histogram */}
        <section className="relative rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/10 p-4 sm:rounded-[2rem] sm:p-6 md:p-8">
          <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-bold sm:text-xl">Shipment Flux</h3>
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
                <h3 className="text-lg  font-bold">Regional Efficiency</h3>
                <p className="text-xs text-[var(--text-secondary)] opacity-60">Transit Time Accuracy</p>
              </div>
              <MapPin className="w-5 h-5 text-[var(--accent)] opacity-20" />
            </div>
            
            <div className="space-y-6">
              {[
                { label: 'Littoral (Douala)', perf: 98, color: 'bg-emerald-500' },
                { label: 'Centre (Yaoundé)', perf: 92, color: 'bg-[var(--accent)]' },
                { label: 'West (Bafoussam)', perf: 85, color: 'bg-indigo-500' },
                { label: 'South West', perf: 72, color: 'bg-rose-500' }
              ].map((reg, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between text-[11px] lg:text-[12px]  font-semibold tracking-tight">
                    <span>{reg.label}</span>
                    <span>{reg.perf}%</span>
                  </div>
                  <div className="h-1 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${reg.perf}%` }}
                      className={`h-full ${reg.color}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="flex flex-col items-center justify-center rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/10 p-6 text-center shadow-sm sm:rounded-[2rem] sm:p-8 md:p-8">
            <div className="w-16 h-16 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mb-6">
              <Zap className="w-8 h-8 text-[var(--accent)]" />
            </div>
            <h3 className="text-2xl  font-bold tracking-tight mb-2">Automated Insights</h3>
            <p className="text-sm text-[var(--text-secondary)] opacity-60 mb-8 max-w-[280px]">
              Regional load in <span className="text-[var(--text-primary)]  font-bold">Douala</span> is peaking. Reallocate assets to Zone 04.
            </p>
            <button type="button" className="min-h-11 touch-manipulation rounded-full bg-[var(--text-primary)] px-6 py-3 text-[11px] font-semibold tracking-[0.15em] text-[var(--bg-primary)] shadow-xl shadow-[var(--accent)]/10 transition-all hover:bg-[var(--accent)] hover:text-white active:scale-95 sm:px-8 sm:tracking-[0.2em]">
              Execute Rebalance
            </button>
          </section>
        </div>

      </div>
    </div>
  );
}
