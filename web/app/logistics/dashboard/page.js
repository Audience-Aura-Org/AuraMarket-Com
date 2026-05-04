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
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active');

  const fetchShipments = async () => {
    try {
      setLoading(true);
      const res = await api.get('/logistics/shipments');
      if (res.data.success) {
        setShipments(res.data.data?.shipments || res.data.shipments || []);
      }
    } catch (err) {
      console.error('Failed to fetch shipments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || user.role !== 'logistics') return;
    fetchShipments();
    const interval = setInterval(fetchShipments, 15000);
    return () => clearInterval(interval);
  }, [user]);

  // Derived Metrics
  const activeCount = shipments.filter(s => ['at_source', 'in_transit', 'arrived_at_destination'].includes(s.status)).length;
  const pendingCount = shipments.filter(s => s.status === 'pending').length;
  const totalDelivered = shipments.filter(s => s.status === 'delivered').length;
  const networkYield = shipments.length > 0 
    ? ((totalDelivered / shipments.length) * 100).toFixed(1) 
    : '100';

  if (user?.role !== 'logistics') return null;

  return (
    <div className="w-full min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] pb-20">
      {/* Premium Glass Header */}
      <header className="px-4 md:px-8 py-6 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center border border-[var(--accent)]/20">
              <Truck className="w-6 h-6 text-[var(--accent)]" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter">Logistics Hub</h1>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-[9px] font-black text-[var(--text-secondary)] tracking-wide opacity-60">Network Operational</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={fetchShipments}
              className="p-2.5 rounded-xl border border-[var(--glass-border)] hover:bg-white/5 text-[var(--text-secondary)] transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <div className="hidden md:flex flex-col items-end">
              <p className="text-xs font-black">{new Date().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</p>
              <p className="text-[10px] text-[var(--text-secondary)] opacity-40  font-black">GMT +1</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-8">
        
        {/* Core Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Active Fleet', value: activeCount, sub: 'Shipments in transit', icon: Truck, color: 'blue' },
            { label: 'Network Yield', value: `${networkYield}%`, sub: 'Success vs Failed', icon: Zap, color: 'amber' },
            { label: 'Pending Load', value: pendingCount, sub: 'Awaiting dispatch', icon: Clock, color: 'indigo' },
            { label: 'Total Delivered', value: totalDelivered, sub: 'Success finalization', icon: CheckCircle2, color: 'emerald' }
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -5 }}
              className="p-6 rounded-3xl bg-[var(--bg-secondary)]/30 border border-[var(--glass-border)] group hover:border-[var(--accent)]/50 transition-all cursor-default"
            >
              <div className={`p-3 rounded-2xl bg-${stat.color}-500/10 w-fit mb-4 group-hover:rotate-12 transition-transform`}>
                <stat.icon className={`w-5 h-5 text-${stat.color}-500`} />
              </div>
              <p className="text-[9px] font-black text-[var(--text-secondary)] tracking-wide mb-1">{stat.label}</p>
              <h4 className="text-3xl font-black tracking-tighter mb-1">{stat.value}</h4>
              <p className="text-[9px] font-black opacity-40 tracking-wide">{stat.sub}</p>
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
                <h3 className="text-xl font-black tracking-tighter">Node Saturation</h3>
                <p className="text-[9px] font-black tracking-wide text-[var(--text-secondary)] opacity-60">Regional manifest distribution</p>
              </div>
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-[9px] font-black tracking-wide hover:shadow-[0_0_20px_rgba(var(--accent-rgb),0.4)] transition-all">
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
                  <div className="flex justify-between text-[9px] font-black tracking-wide">
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
              <h3 className="text-[9px] font-black tracking-wide mb-4">Quick Command</h3>
              <div className="grid grid-cols-2 gap-3">
                <button className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] hover:border-[var(--accent)] transition-all flex flex-col items-center gap-2 group">
                  <Package className="w-5 h-5 text-[var(--accent)] group-hover:scale-110 transition-transform" />
                  <span className="text-[9px] font-black tracking-wide">New Manifest</span>
                </button>
                <button className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] hover:border-[var(--accent)] transition-all flex flex-col items-center gap-2 group">
                  <MapPin className="w-5 h-5 text-blue-500 group-hover:scale-110 transition-transform" />
                  <span className="text-[9px] font-black tracking-wide">Manage Nodes</span>
                </button>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-[var(--bg-primary)] border border-[var(--glass-border)]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[9px] font-black tracking-wide">Recent Alarms</h3>
                <AlertCircle className="w-4 h-4 text-rose-500 animate-pulse" />
              </div>
              <div className="space-y-4">
                {[
                  { msg: 'Weather delay at Node A', time: '2m ago' },
                  { msg: 'System check complete', time: '1h ago' }
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-[9px]">
                    <span className="font-black tracking-wide opacity-60">{item.msg}</span>
                    <span className="opacity-30 whitespace-nowrap font-black tracking-wide">{item.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Active Shipments Live Table */}
        <section className="p-8 rounded-3xl bg-[var(--bg-secondary)]/10 border border-[var(--glass-border)]">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-[var(--accent)]" />
              <h3 className="text-xl font-black tracking-tighter ">Shipment Stream</h3>
            </div>
            
            <div className="flex gap-2">
              <button className="px-4 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[9px] font-black tracking-wide flex items-center gap-2 hover:bg-white/5 transition-all">
                <Filter className="w-3 h-3" /> Filter
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[9px] font-black tracking-wide text-[var(--text-secondary)] opacity-40">
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
                      <p className="text-[11px] font-black tracking-tighter ">#{s._id?.slice(-8).toUpperCase()}</p>
                      <p className="text-[9px] opacity-40  font-black tracking-widest">{s.tracking_number || 'TRK-PENDING'}</p>
                    </td>
                    <td className="py-4 pr-4">
                      <p className="text-xs font-bold truncate max-w-[150px]">{s.destination_address?.city || 'Unknown'}</p>
                      <p className="text-[9px] opacity-40  font-black">{s.destination_address?.region || 'N/A'}</p>
                    </td>
                    <td className="py-4 pr-4">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black tracking-wide ${
                        s.status === 'delivered' ? 'bg-emerald-500/10 text-emerald-500' : 
                        s.status === 'pending' ? 'bg-amber-500/10 text-amber-500' :
                        'bg-blue-500/10 text-blue-500'
                      }`}>
                        {s.status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-4 pr-4 text-xs font-bold italic opacity-60">High</td>
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
        </section>

      </div>
    </div>
  );
}
