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
    <div className="w-full min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] pb-20">
      {/* Header */}
      <div className="hidden md:block px-4 md:px-8 lg:px-8 py-6 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center border border-[var(--accent)]/20 shadow-sm transition-transform hover:rotate-3">
              <BarChart3 className="w-6 h-6 text-[var(--accent)]" />
            </div>
            <div>
              <h1 className="text-2xl font-quicksand font-bold tracking-tight">Logistics Intelligence</h1>
              <p className="text-[11px] lg:text-[12px] font-quicksand font-bold text-[var(--text-secondary)] tracking-tight opacity-40">Operational Analytics</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            {['7', '30', '90'].map(t => (
              <button
                key={t}
                onClick={() => setRange(t)}
                className={`px-5 py-2 rounded-full text-[11px] lg:text-[12px] font-quicksand font-bold  transition-all tracking-tight ${
                  range === t ? 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/20' : 'text-[var(--text-secondary)] hover:bg-white/5 border border-transparent hover:border-[var(--glass-border)]'
                }`}
              >
                {t}D
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-8">
        
        {/* Shipment Flux Histogram */}
        <section className="relative p-8 rounded-[2rem] bg-[var(--bg-secondary)]/10 border border-[var(--glass-border)]">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h3 className="text-xl font-quicksand font-bold">Shipment Flux</h3>
              <p className="text-xs text-[var(--text-secondary)] opacity-60 font-quicksand font-bold tracking-tight mt-1">Daily Volume Trends</p>
            </div>
            <div className="flex gap-4">
               <div className="flex flex-col items-end">
                  <span className="text-[11px] lg:text-[12px] font-quicksand font-bold opacity-30 ">Peak Pulse</span>
                  <span className="text-sm font-quicksand font-bold text-emerald-500">Normal Range</span>
               </div>
            </div>
          </div>

          <div className="relative h-48 flex items-end gap-1.5 px-2">
            {histogramData.map((d, i) => (
              <motion.div
                key={i}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: `${Math.max(8, d.intensity)}%`, opacity: 1 }}
                transition={{ delay: i * 0.015, duration: 0.6 }}
                className="group relative flex-1 min-w-[6px] rounded-t-md"
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
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-6 px-4 py-2 rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] text-[11px] lg:text-[12px] font-quicksand font-bold whitespace-nowrap z-50 shadow-2xl border border-[var(--glass-border)]"
                    >
                      {d.count} SHIPMENTS
                      <span className="block text-[11px] lg:text-[12px] font-quicksand font-bold opacity-60 ">{d.label}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>

          <div className="flex justify-between mt-6 px-2">
            <span className="text-[11px] lg:text-[12px] font-quicksand font-bold text-[var(--text-secondary)] opacity-30 tracking-tight">{histogramData[0]?.label}</span>
            <span className="text-[11px] lg:text-[12px] font-quicksand font-bold text-[var(--text-secondary)] opacity-30 tracking-tight">{histogramData[29]?.label}</span>
          </div>
        </section>

        {/* Intelligence Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Network Health', value: networkStatus, sub: `${deliverySuccess}% Success`, icon: Shield, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
            { label: 'Active Manifests', value: activeShipments, sub: 'In pipeline', icon: Activity, color: 'text-blue-500', bg: 'bg-blue-500/10' },
            { label: 'Inbound Load', value: pendingPickup, sub: 'Awaiting intake', icon: Truck, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
            { label: 'Efficiency Yield', value: `${efficiencyTrend}%`, sub: 'vs last window', icon: TrendingUp, color: 'text-amber-500', bg: 'bg-amber-500/10' }
          ].map((stat, i) => (
            <motion.div
              key={i}
              whileHover={{ scale: 1.02 }}
              className="p-6 rounded-[2rem] bg-[var(--bg-primary)] border border-[var(--glass-border)] group cursor-default shadow-sm hover:shadow-xl transition-all"
            >
              <div className={`p-3 rounded-2xl ${stat.bg} w-fit mb-4 group-hover:scale-110 transition-transform shadow-inner`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <p className="text-[11px] lg:text-[12px] font-quicksand font-bold text-[var(--text-secondary)] tracking-tight mb-1">{stat.label}</p>
              <h4 className="text-3xl font-quicksand font-bold tracking-tight mb-1">{stat.value}</h4>
              <p className="text-[11px] lg:text-[12px] font-quicksand font-bold opacity-40 ">{stat.sub}</p>
            </motion.div>
          ))}
        </div>

        {/* Regional Efficiency */}
        <div className="grid lg:grid-cols-2 gap-8">
          <section className="p-8 rounded-[2rem] bg-[var(--bg-primary)] border border-[var(--glass-border)] shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-quicksand font-bold">Regional Efficiency</h3>
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
                  <div className="flex justify-between text-[11px] lg:text-[12px] font-quicksand font-bold tracking-tight">
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

          <section className="p-8 rounded-[2rem] bg-[var(--bg-secondary)]/10 border border-[var(--glass-border)] flex flex-col justify-center items-center text-center shadow-sm">
            <div className="w-16 h-16 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mb-6">
              <Zap className="w-8 h-8 text-[var(--accent)]" />
            </div>
            <h3 className="text-2xl font-quicksand font-bold tracking-tight mb-2">Automated Insights</h3>
            <p className="text-sm text-[var(--text-secondary)] opacity-60 mb-8 max-w-[280px]">
              Regional load in <span className="text-[var(--text-primary)] font-quicksand font-bold">Douala</span> is peaking. Reallocate assets to Node 04.
            </p>
            <button className="px-8 py-3 rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] text-[11px] lg:text-[12px] font-quicksand font-bold  tracking-[0.2em] hover:bg-[var(--accent)] hover:text-white transition-all shadow-xl shadow-[var(--accent)]/10 active:scale-95">
              Execute Rebalance
            </button>
          </section>
        </div>

      </div>
    </div>
  );
}
