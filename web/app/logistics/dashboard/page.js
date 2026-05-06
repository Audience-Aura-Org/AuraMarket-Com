"use client";

import { useState, useEffect } from 'react';
import { 
  Package, Truck, MapPin, Globe, 
  Activity, Zap, Clock, CheckCircle2,
  TrendingUp, AlertCircle, Search, Filter,
  ArrowUpRight, BarChart3, Users, ExternalLink,
  ChevronRight, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function LogisticsDashboard() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const [shipments, setShipments] = useState([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active');

  const fetchStats = async () => {
    try {
      setLoading(true);
      const [resShip, resWallet] = await Promise.all([
        api.get('/logistics/shipments'),
        api.get('/wallet')
      ]);
      
      if (resShip.data.success) {
        setShipments(resShip.data.data?.shipments || resShip.data.shipments || []);
      }
      if (resWallet.data.success) {
        setBalance(resWallet.data.data.balance || 0);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || user.role !== 'logistics') return;
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Derived Metrics
  const activeCount = shipments.filter(s => ['assigned', 'picked_up', 'in_transit', 'out_for_delivery', 'at_source', 'arrived_at_destination'].includes(s.status)).length;
  const pendingCount = shipments.filter(s => s.status === 'pending').length;
  const totalDelivered = shipments.filter(s => s.status === 'delivered').length;
  const networkYield = shipments.length > 0 
    ? ((totalDelivered / shipments.length) * 100).toFixed(1) 
    : '100';

  if (user?.role !== 'logistics') return null;

  return (
    <div className="w-full min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] pb-20">
      {/* Premium Glass Header */}
      <header className="px-4 md:px-8 py-4 md:py-6 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 backdrop-blur-xl sticky top-0 md:top-16 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="size-10 md:size-12 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center border border-[var(--accent)]/20 shrink-0">
               <Truck className="w-5 h-5 md:w-6 md:h-6 text-[var(--accent)]" />
            </div>
            <div>
              <h1 className="text-lg md:text-2xl font-bold tracking-tighter">Logistics <span className="text-[var(--accent)]">Hub</span></h1>
              <div className="flex items-center gap-2">
                <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-[10px] md:text-[11px] lg:text-[12px] font-semibold text-[var(--text-secondary)] tracking-tight opacity-40 uppercase">Network Nominal</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={fetchStats}
              className="size-10 rounded-xl border border-[var(--glass-border)] hover:bg-white/5 text-[var(--text-secondary)] transition-all flex items-center justify-center active:scale-90"
            >
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <div className="hidden sm:flex flex-col items-end opacity-40">
              <p className="text-[10px] font-bold uppercase tracking-tight">{new Date().toLocaleDateString([], { month: 'short', day: 'numeric' })}</p>
              <p className="text-[9px] font-semibold uppercase">Logistics_{user.name?.replace(/\s/g, '_')}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-8">
        
        {/* Core Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {[
            { label: 'Settlement', value: `${balance.toLocaleString()} XAF`, sub: 'Available Balance', icon: BarChart3, color: 'fuchsia', href: '/wallet' },
            { label: 'Yield', value: `${networkYield}%`, sub: 'Success vs Failed', icon: Zap, color: 'amber' },
            { label: 'Pending', value: pendingCount, sub: 'Awaiting dispatch', icon: Clock, color: 'indigo' },
            { label: 'Delivered', value: totalDelivered, sub: 'Success finalization', icon: CheckCircle2, color: 'emerald' }
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -5 }}
              onClick={() => stat.href && router.push(stat.href)}
              className={`p-4 md:p-6 rounded-2xl md:rounded-3xl bg-[var(--bg-secondary)]/30 border border-[var(--glass-border)] group hover:border-[var(--accent)]/50 transition-all ${stat.href ? 'cursor-pointer active:scale-95' : 'cursor-default'}`}
            >
              <div className={`p-2.5 md:p-3 rounded-xl md:rounded-2xl bg-${stat.color}-500/10 w-fit mb-3 md:mb-4 group-hover:rotate-12 transition-transform`}>
                <stat.icon className={`w-4 h-4 md:w-5 md:h-5 text-${stat.color}-500`} />
              </div>
              <p className="text-[9px] md:text-[11px] lg:text-[12px] font-semibold text-[var(--text-secondary)] tracking-tight mb-1">{stat.label}</p>
              <h4 className="text-xl md:text-3xl font-bold tracking-tighter mb-0.5 md:mb-1">{stat.value}</h4>
              <p className="text-[9px] md:text-[11px] lg:text-[12px] font-semibold opacity-30 tracking-tight">{stat.sub}</p>
            </motion.div>
          ))}
        </div>

        {/* Dynamic Operational Overview */}
        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* Node Saturation / Tracking Map Placeholder */}
          <div className="lg:col-span-2 p-8 rounded-3xl bg-[var(--bg-primary)] border border-[var(--glass-border)] relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
              <Globe className="w-64 h-64 text-[var(--accent)]" />
            </div>
            
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl  font-bold tracking-tighter">Node Saturation</h3>
                <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight text-[var(--text-secondary)] opacity-60">Regional manifest distribution</p>
              </div>
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-[11px] lg:text-[12px]  font-semibold tracking-tight hover:shadow-[0_0_20px_rgba(var(--accent-rgb),0.4)] transition-all">
                Full Map <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>

            {/* Mock Visualization Bars */}
            <div className="space-y-6">
              {[
                { location: 'Douala - Bonabéri', load: 85, color: 'bg-emerald-500' },
                { location: 'Yaoundé - Bastos', load: 62, color: 'bg-[var(--accent)]' },
                { location: 'Bafoussam - Central', load: 38, color: 'bg-amber-500' },
                { location: 'Garoua - Hub', load: 15, color: 'bg-blue-500' }
              ].map((node, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between text-[11px] lg:text-[12px]  font-semibold tracking-tight">
                    <span className="text-[var(--text-secondary)]">{node.location}</span>
                    <span className="text-[var(--text-primary)]">{node.load}%</span>
                  </div>
                  <div className="h-1.5 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${node.load}%` }}
                      transition={{ duration: 1, delay: i * 0.1 }}
                      className={`h-full ${node.color} shadow-[0_0_10px_rgba(0,0,0,0.1)]`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions & Recent Updates */}
          <div className="space-y-4">
            <div className="p-6 rounded-3xl bg-[var(--bg-secondary)]/30 border border-[var(--glass-border)]">
              <h3 className="text-[11px] lg:text-[12px]  font-semibold tracking-tight mb-4">Quick Command</h3>
              <div className="grid grid-cols-2 gap-3">
                <button className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] hover:border-[var(--accent)] transition-all flex flex-col items-center gap-2 group">
                  <Package className="w-5 h-5 text-[var(--accent)] group-hover:scale-110 transition-transform" />
                  <span className="text-[11px] lg:text-[12px]  font-semibold tracking-tight">New Manifest</span>
                </button>
                <button className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] hover:border-[var(--accent)] transition-all flex flex-col items-center gap-2 group">
                  <MapPin className="w-5 h-5 text-blue-500 group-hover:scale-110 transition-transform" />
                  <span className="text-[11px] lg:text-[12px]  font-semibold tracking-tight">Manage Nodes</span>
                </button>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-[var(--bg-primary)] border border-[var(--glass-border)]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[11px] lg:text-[12px]  font-semibold tracking-tight">Recent Alarms</h3>
                <AlertCircle className="w-4 h-4 text-rose-500 animate-pulse" />
              </div>
              <div className="space-y-4">
                {[
                  { msg: 'Weather delay at Node A', time: '2m ago' },
                  { msg: 'System check complete', time: '1h ago' }
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px] lg:text-[12px]">
                    <span className=" font-bold tracking-tight opacity-60">{item.msg}</span>
                    <span className="opacity-30 whitespace-nowrap  font-bold tracking-tight">{item.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        {/* Active Shipments Live Table */}
        <section className="p-5 md:p-8 rounded-[2rem] md:rounded-3xl bg-[var(--bg-secondary)]/10 border border-[var(--glass-border)]">
          <div className="flex items-center justify-between mb-6 md:mb-8">
            <div className="flex items-center gap-2 md:gap-3">
              <Activity className="w-4 h-4 md:w-5 md:h-5 text-[var(--accent)]" />
              <h3 className="text-lg md:text-xl font-bold tracking-tighter">Shipment Stream</h3>
            </div>
            
            <button className="px-3 md:px-4 py-1.5 md:py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[10px] md:text-[11px] lg:text-[12px] font-semibold tracking-tight flex items-center gap-2 hover:bg-white/5 transition-all">
              <Filter className="w-3 h-3" /> <span className="hidden sm:inline">Filter</span>
            </button>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[11px] lg:text-[12px] font-semibold tracking-tight text-[var(--text-secondary)] opacity-40 uppercase">
                  <th className="pb-4 pr-4">Shipment ID</th>
                  <th className="pb-4 pr-4">Destination</th>
                  <th className="pb-4 pr-4">Status</th>
                  <th className="pb-4 pr-4">Priority</th>
                  <th className="pb-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--glass-border)]">
                {shipments.slice(0, 8).map((s) => (
                  <tr key={s._id} className="group hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 pr-4">
                      <p className="text-[11px] lg:text-[12px] font-semibold tracking-tighter">#{s._id?.slice(-8).toUpperCase()}</p>
                      <p className="text-[10px] lg:text-[12px] opacity-40 font-semibold tracking-tight">{s.tracking_number || 'TRK-PENDING'}</p>
                    </td>
                    <td className="py-4 pr-4">
                      <p className="text-xs font-bold truncate max-w-[150px]">{s.destination_address?.city || 'Unknown'}</p>
                      <p className="text-[10px] lg:text-[12px] opacity-40 font-semibold">{s.destination_address?.region || 'N/A'}</p>
                    </td>
                    <td className="py-4 pr-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] lg:text-[12px] font-semibold tracking-tight ${
                        s.status === 'delivered' ? 'bg-emerald-500/10 text-emerald-500' : 
                        s.status === 'pending' ? 'bg-amber-500/10 text-amber-500' :
                        s.status === 'assigned' ? 'bg-purple-500/10 text-purple-500' :
                        s.status === 'picked_up' ? 'bg-blue-500/10 text-blue-500' :
                        s.status === 'in_transit' ? 'bg-indigo-500/10 text-indigo-400' :
                        s.status === 'out_for_delivery' ? 'bg-cyan-500/10 text-cyan-400' :
                        s.status === 'failed' ? 'bg-red-500/10 text-red-500' :
                        'bg-blue-500/10 text-blue-500'
                      }`}>
                        {s.status?.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="py-4 pr-4 text-[10px] md:text-xs font-bold italic opacity-60">High</td>
                    <td className="py-4 text-right">
                      <button className="p-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--glass-border)] opacity-0 group-hover:opacity-100 transition-opacity">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {shipments.slice(0, 8).map((s) => (
              <div key={s._id} className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] space-y-3 active:scale-[0.98] transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold tracking-tighter">#{s._id?.slice(-8).toUpperCase()}</p>
                    <p className="text-[9px] opacity-40 font-semibold uppercase">{s.tracking_number || 'TRK-PENDING'}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold tracking-tight ${
                    s.status === 'delivered' ? 'bg-emerald-500/10 text-emerald-500' : 
                    s.status === 'pending' ? 'bg-amber-500/10 text-amber-500' :
                    s.status === 'assigned' ? 'bg-purple-500/10 text-purple-500' :
                    s.status === 'picked_up' ? 'bg-blue-500/10 text-blue-500' :
                    s.status === 'in_transit' ? 'bg-indigo-500/10 text-indigo-400' :
                    s.status === 'out_for_delivery' ? 'bg-cyan-500/10 text-cyan-400' :
                    s.status === 'failed' ? 'bg-red-500/10 text-red-500' :
                    'bg-blue-500/10 text-blue-500'
                  }`}>
                    {s.status?.replace(/_/g, ' ').toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-[var(--glass-border)] pt-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3 h-3 text-[var(--accent)]" />
                    <div>
                      <p className="text-[10px] font-bold">{s.destination_address?.city || 'Unknown'}</p>
                      <p className="text-[9px] opacity-40 font-semibold">{s.destination_address?.region || 'N/A'}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-20" />
                </div>
              </div>
            ))}
          </div>
        </section>


      </div>
    </div>
  );
}
