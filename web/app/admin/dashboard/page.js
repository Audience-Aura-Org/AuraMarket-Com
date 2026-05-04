"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { 
  TrendingUp, Users, Store, Package, 
  Activity, Shield, Zap, Search, 
  Filter, RefreshCw, ChevronRight, 
  ArrowUpRight, Clock, ShieldCheck,
  LayoutDashboard, Terminal
} from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/hooks/useAuth';
import api from '@/services/api';
import { motion } from 'framer-motion';

function fmt(n) { return Number(n || 0).toLocaleString('fr-CM'); }

function CompactStat({ title, value, sub, icon: Icon, color, href }) {
  const colors = {
    emerald: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    indigo: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
    accent: 'bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/20',
  };

  const content = (
    <div className="bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-2xl p-4 hover:border-[var(--accent)]/30 transition-all group cursor-pointer">
      <div className="flex items-center gap-3 mb-3">
        <div className={`size-8 rounded-lg flex items-center justify-center border ${colors[color] || colors.blue}`}>
          <Icon className="size-4" />
        </div>
        <p className="text-[11px] font-bold text-[var(--text-secondary)] tracking-tight opacity-50">{title}</p>
      </div>
      <h3 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">{value}</h3>
      {sub && <p className="text-[11px] font-bold text-[var(--text-secondary)] opacity-40 mt-1 ">{sub}</p>}
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await api.get('/admin/analytics');
      if (res.data.success) setStats(res.data.data.stats);
    } catch (err) {
      console.error('Failed to fetch admin stats:', err);
    } finally { setLoading(false); }
  };

  if (!mounted) return null;

  return (
    <div className="w-full min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-display">
      {/* Surgical Header */}
      <div className="px-6 py-6 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/10 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] border border-[var(--accent)]/20">
              <LayoutDashboard className="size-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Platform Command</h1>
              <p className="text-[11px] font-bold text-[var(--text-secondary)] opacity-40 tracking-tight">Global Administrative Hub</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/5 border border-emerald-500/10">
                <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-bold text-emerald-500 ">Systems Nominal</span>
             </div>
             <button onClick={fetchStats} className="p-2.5 rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all">
                <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
             </button>
          </div>
        </div>
      </div>

      <div className="p-6 md:p-8 space-y-8 max-w-[1600px] mx-auto">
        
        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <CompactStat title="Active Nodes" value={fmt(stats?.users)} sub="Registered Accounts" icon={Users} color="blue" href="/admin/users" />
          <CompactStat title="Merchant Queue" value={fmt(stats?.pending_vendors)} sub="Awaiting KYC" icon={Store} color="amber" href="/admin/vendors" />
          <CompactStat title="Asset Pipeline" value={fmt(stats?.pending_products)} sub="Pending Approval" icon={Package} color="accent" href="/admin/products" />
          <CompactStat title="Global Volume" value={`${fmt(stats?.revenue)} XAF`} sub="Gross Platform Revenue" icon={TrendingUp} color="emerald" href="/admin/analytics" />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          
          {/* Entity Management List */}
          <section className="lg:col-span-2 bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-[2.5rem] p-8 shadow-sm">
             <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-[11px] font-bold  tracking-[0.3em] opacity-40">Operational Entities</h3>
                  <p className="text-[11px] font-bold text-[var(--text-secondary)] opacity-30 mt-1 ">High-Density Management Matrix</p>
                </div>
                <Zap className="size-4 opacity-20" />
             </div>

             <div className="grid md:grid-cols-2 gap-3">
                {[
                  { title: 'User Directory', desc: 'Auth & Profile Control', count: stats?.users || 0, icon: Users, color: 'blue', href: '/admin/users' },
                  { title: 'Merchant Registry', desc: 'KYC & Store Oversight', count: stats?.vendors || 0, icon: Store, color: 'amber', href: '/admin/vendors' },
                  { title: 'Product Ledger', desc: 'Catalog Moderation', count: stats?.products || 0, icon: Package, color: 'accent', href: '/admin/products' },
                  { title: 'Escrow Vault', desc: 'Platform Liquidity', count: `${fmt(stats?.escrow_vault)}`, icon: ShieldCheck, color: 'emerald', href: '/admin/escrow' },
                ].map((item, i) => (
                  <Link key={i} href={item.href} className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--bg-secondary)]/30 border border-[var(--glass-border)] hover:border-[var(--accent)]/30 transition-all group">
                    <div className={`size-10 rounded-xl flex items-center justify-center border border-transparent group-hover:border-current transition-all text-${item.color === 'accent' ? '[var(--accent)]' : item.color + '-500'}`}>
                      <item.icon className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold  truncate">{item.title}</p>
                      <p className="text-[11px] font-bold text-[var(--text-secondary)] opacity-40 ">{item.desc}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold">{item.count}</p>
                      <ChevronRight className="size-3 opacity-0 group-hover:opacity-20 transition-opacity ml-auto" />
                    </div>
                  </Link>
                ))}
             </div>

             {/* Telemetry Matrix */}
             <div className="mt-8 pt-8 border-t border-[var(--glass-border)]">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Live Nodes', value: stats?.online_users || 0, icon: Activity },
                    { label: 'Active 24H', value: stats?.active_users_24h || 0, icon: Clock },
                    { label: 'Market Depth', value: stats?.active_products || 0, icon: Hub },
                    { label: 'Order Velocity', value: stats?.orders || 0, icon: TrendingUp },
                  ].map((item, i) => (
                    <div key={i} className="p-4 rounded-xl bg-[var(--bg-secondary)]/20 border border-[var(--glass-border)] text-center group hover:bg-[var(--bg-primary)] transition-all">
                      <item.icon className="size-3 mx-auto mb-2 opacity-20 group-hover:opacity-100 transition-opacity" />
                      <p className="text-lg font-bold tracking-tighter leading-none mb-1">{item.value}</p>
                      <p className="text-[11px] font-bold tracking-tight text-[var(--text-secondary)] opacity-40">{item.label}</p>
                    </div>
                  ))}
                </div>
             </div>
          </section>

          {/* System Security & Logs */}
          <section className="lg:col-span-1 space-y-6">
             <div className="bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-[2.5rem] p-8 shadow-sm">
                <h3 className="text-[11px] font-bold  tracking-[0.3em] opacity-40 mb-8">Security Terminal</h3>
                <div className="space-y-4">
                   <div className="p-5 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] group hover:border-[var(--accent)]/30 transition-all">
                      <Terminal className="size-5 mb-4 text-[var(--text-secondary)] opacity-20" />
                      <h4 className="text-sm font-bold  mb-1">Authorization Layer</h4>
                      <p className="text-[11px] font-bold text-[var(--text-secondary)] opacity-50  leading-relaxed mb-6">Control system security and user permission protocols.</p>
                      <Link href="/admin/security" className="inline-flex items-center gap-2 text-[11px] font-bold text-[var(--accent)] tracking-tight hover:gap-4 transition-all">
                        Access Firewall <ChevronRight className="size-3" />
                      </Link>
                   </div>
                </div>
             </div>

             <div className="bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-[2.5rem] p-8 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-[11px] font-bold  tracking-[0.3em] opacity-40">System Pulse</h3>
                  <Link href="/admin/logs" className="text-[11px] font-bold text-[var(--accent)] tracking-tight hover:underline">View All</Link>
                </div>
                <div className="space-y-6">
                   {[
                     { title: 'Status Normal', desc: 'All platform nodes synchronized', time: 'JUST NOW', color: 'emerald' },
                     { title: 'Logistics Update', desc: 'Routing table calibrated', time: '2H AGO', color: 'blue' },
                     { title: 'Security Scan', desc: 'No intrusive signatures found', time: '5H AGO', color: 'indigo' },
                   ].map((log, i) => (
                     <div key={i} className="flex gap-4 group">
                        <div className={`w-1 rounded-full bg-${log.color}-500/30 group-hover:bg-${log.color}-500 transition-all`} />
                        <div>
                          <p className="text-[11px] font-bold tracking-tight">{log.title}</p>
                          <p className="text-[11px] font-bold text-[var(--text-secondary)] opacity-40 mt-0.5">{log.desc}</p>
                          <span className="text-[11px] font-bold text-[var(--text-secondary)] opacity-20 mt-2 block tracking-tight">{log.time}</span>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
          </section>

        </div>
      </div>
    </div>
  );
}

function Hub({ className }) {
  return <Activity className={className} />;
}
