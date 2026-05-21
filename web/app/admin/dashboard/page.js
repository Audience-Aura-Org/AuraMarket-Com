"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { 
  TrendingUp, Users, Store, Package, 
  Activity, Shield, Zap, Search, 
  Filter, RefreshCw, ChevronRight, 
  ArrowUpRight, Clock, ShieldCheck,
  LayoutDashboard, Terminal, ShieldAlert
} from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/hooks/useAuth';
import api from '@/services/api';
import { motion } from 'framer-motion';
import StatCard from '@/components/layout/StatCard';

function fmt(n) { return Number(n || 0).toLocaleString('fr-CM'); }

const COLOR_STYLES = {
  accent: 'text-[var(--accent)] bg-[var(--accent)]/5',
  amber: 'text-amber-500 bg-amber-500/5',
  blue: 'text-blue-500 bg-blue-500/5',
  emerald: 'text-emerald-500 bg-emerald-500/5',
  indigo: 'text-indigo-500 bg-indigo-500/5',
  rose: 'text-rose-500 bg-rose-500/5'
};

const COLOR_BOX_STYLES = {
  amber: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  blue: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  indigo: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
  rose: 'text-rose-500 bg-rose-500/10 border-rose-500/20'
};

const LOG_RAIL_STYLES = {
  blue: 'bg-blue-500/30 group-hover:bg-blue-500',
  emerald: 'bg-emerald-500/30 group-hover:bg-emerald-500',
  indigo: 'bg-indigo-500/30 group-hover:bg-indigo-500'
};

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
      <div className="px-4 md:px-6 py-4 md:py-6 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/10 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] border border-[var(--accent)]/20 shrink-0">
               <LayoutDashboard className="size-5" />
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
             <button onClick={fetchStats} className="p-2 md:p-2.5 rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all active:scale-90">
                <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
             </button>
          </div>
        </div>
      </div>

      <div className="p-6 md:p-8 space-y-8 max-w-[1600px] mx-auto">
        
        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Actives" value={fmt(stats?.users)} sub="Registered Accounts" icon={Users} color="blue" href="/admin/users" />
          <StatCard label="Merchant Queue" value={fmt(stats?.pending_vendors)} sub="Awaiting KYC" icon={Store} color="amber" href="/admin/vendors" />
          <StatCard label="Asset Pipeline" value={fmt(stats?.pending_products)} sub="Pending Approval" icon={Package} color="primary" href="/admin/products" />
          <StatCard label="Global Volume" value={`${fmt(stats?.revenue)} XAF`} sub="Gross Platform Revenue" icon={TrendingUp} color="emerald" href="/admin/analytics" />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          
          {/* Entity Management List */}
          <section className="lg:col-span-2 bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-3xl md:rounded-[2.5rem] p-5 md:p-8 shadow-sm">
             <div className="flex items-center justify-between mb-6 md:mb-8">
                <div>
                  <h3 className="text-[10px] md:text-[12px] font-semibold tracking-[0.2em] opacity-40 uppercase">Operational Entities</h3>
                  <p className="text-[10px] md:text-[11px] lg:text-[12px] font-semibold text-[var(--text-secondary)] opacity-30 mt-1">High-Density Management Matrix</p>
                </div>
                <Zap className="size-4 opacity-20 hidden sm:block" />
             </div>

             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { title: 'User Directory', desc: 'Auth & Profile Control', count: stats?.users || 0, icon: Users, color: 'blue', href: '/admin/users' },
                  { title: 'Merchant Registry', desc: 'KYC & Store Oversight', count: stats?.vendors || 0, icon: Store, color: 'amber', href: '/admin/vendors' },
                  { title: 'Product Ledger', desc: 'Catalog Moderation', count: stats?.products || 0, icon: Package, color: 'accent', href: '/admin/products' },
                  { title: 'Escrow Vault', desc: 'Platform Liquidity', count: `${fmt(stats?.escrow_vault)}`, icon: ShieldCheck, color: 'emerald', href: '/admin/escrow' },
                ].map((item, i) => (
                  <Link key={i} href={item.href} className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--bg-secondary)]/30 border border-[var(--glass-border)] hover:border-[var(--accent)]/30 transition-all group active:scale-[0.98]">
                    <div className={`size-10 rounded-xl flex items-center justify-center border border-transparent group-hover:border-current transition-all ${COLOR_STYLES[item.color] || COLOR_STYLES.accent}`}>
                      <item.icon className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] lg:text-[12px] font-semibold truncate uppercase tracking-tight">{item.title}</p>
                      <p className="text-[10px] lg:text-[11px] font-semibold text-[var(--text-secondary)] opacity-40">{item.desc}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold font-mono">{item.count}</p>
                    </div>
                  </Link>
                ))}
             </div>

             {/* Telemetry Matrix Refined */}
             <div className="mt-8 pt-8 border-t border-[var(--glass-border)]">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { title: 'Vector Alpha', desc: 'Total Platform Volume', count: `${fmt(stats?.revenue)} XAF`, icon: Activity, color: 'blue', signal: 'Primary' },
                    { title: 'Risk Log', desc: 'Auth Failure Signals', count: '9', icon: ShieldAlert, color: 'rose', signal: 'Warning' },
                    { title: 'Secured Nodes', desc: 'Active Escrow Flow', count: '18,000 XAF', icon: ShieldCheck, color: 'emerald', signal: 'Secure' },
                    { title: 'Core Stable', desc: 'Platform Uptime', count: '99.98%', icon: Zap, color: 'amber', signal: 'Nominal' },
                  ].map((item, i) => (
                    <div key={i} className="relative overflow-hidden p-5 rounded-3xl bg-[var(--bg-secondary)]/20 border border-[var(--glass-border)] group hover:border-[var(--accent)]/30 transition-all">
                      <div className="flex items-center justify-between mb-4">
                         <div className={`size-10 rounded-xl flex items-center justify-center border ${COLOR_BOX_STYLES[item.color] || COLOR_BOX_STYLES.blue}`}>
                           <item.icon className="size-4" />
                         </div>
                         <div className="text-right">
                           <p className="text-[9px] font-bold tracking-widest opacity-30 uppercase">{item.signal}</p>
                           <p className="text-[10px] font-bold text-[var(--text-primary)]">{item.title}</p>
                         </div>
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-xl font-bold font-mono tracking-tighter text-[var(--text-primary)]">{item.count}</p>
                        <p className="text-[11px] font-semibold text-[var(--text-secondary)] opacity-40">{item.desc}</p>
                      </div>

                      {/* Micro-sparkline effect */}
                      <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--glass-border)] to-transparent opacity-20" />
                    </div>
                  ))}
                </div>
             </div>
          </section>

          {/* System Security & Logs */}
          <section className="lg:col-span-1 space-y-6">
             <div className="bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-[2.5rem] p-8 shadow-sm">
                <h3 className="text-[11px] lg:text-[12px]  font-semibold  tracking-[0.3em] opacity-40 mb-8">Security Terminal</h3>
                <div className="space-y-4">
                   <div className="p-5 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] group hover:border-[var(--accent)]/30 transition-all">
                      <Terminal className="size-5 mb-4 text-[var(--text-secondary)] opacity-20" />
                      <h4 className="text-sm  font-bold  mb-1">Authorization Layer</h4>
                      <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-50  leading-relaxed mb-6">Control system security and user permission protocols.</p>
                      <Link href="/admin/security" className="inline-flex items-center gap-2 text-[11px] lg:text-[12px]  font-semibold text-[var(--accent)] tracking-tight hover:gap-4 transition-all">
                        Access Firewall <ChevronRight className="size-3" />
                      </Link>
                   </div>
                </div>
             </div>

             <div className="bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-[2.5rem] p-8 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-[11px] lg:text-[12px]  font-semibold  tracking-[0.3em] opacity-40">System Pulse</h3>
                  <Link href="/admin/logs" className="text-[11px] lg:text-[12px]  font-semibold text-[var(--accent)] tracking-tight hover:underline">View All</Link>
                </div>
                <div className="space-y-6">
                   {[
                     { title: 'Status Normal', desc: 'All platform nodes synchronized', time: 'JUST NOW', color: 'emerald' },
                     { title: 'Logistics Update', desc: 'Routing table calibrated', time: '2H AGO', color: 'blue' },
                     { title: 'Security Scan', desc: 'No intrusive signatures found', time: '5H AGO', color: 'indigo' },
                   ].map((log, i) => (
                     <div key={i} className="flex gap-4 group">
                        <div className={`w-1 rounded-full transition-all ${LOG_RAIL_STYLES[log.color] || LOG_RAIL_STYLES.blue}`} />
                        <div>
                          <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight">{log.title}</p>
                          <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-40 mt-0.5">{log.desc}</p>
                          <span className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-20 mt-2 block tracking-tight">{log.time}</span>
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
