"use client";

import { useState, useEffect } from 'react';
import { TrendingUp, Users, Store, Scale, Sparkles, Package, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/hooks/useAuth';
import api from '@/services/api';

export const dynamic = 'force-dynamic';

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
      if (res.data.success) {
        setStats(res.data.data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch admin stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const statCards = stats ? [
    { label: 'Active Users', value: stats.users?.toLocaleString(), icon: Users, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
    { label: 'Pending KYC', value: stats.pending_vendors?.toLocaleString(), icon: Store, color: 'text-[var(--accent)]', bg: 'bg-[var(--accent)]/10' },
    { label: 'Product Queue', value: stats.pending_products?.toLocaleString(), icon: Package, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { label: 'Total Revenue', value: `${(stats.revenue || 0).toLocaleString()} XAF`, icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  ] : [];

  const recentAlerts = [
    { title: 'System Status', desc: 'All platform systems operating normally.', time: 'Just now', type: 'info' },
    { title: 'Category Update', desc: 'New sub-categories added to Electronics.', time: '2 hours ago', type: 'warning' },
    { title: 'Payment Check', desc: 'All escrow payments are verified and secure.', time: '5 hours ago', type: 'info' },
  ];

  if (!mounted) return null;

  return (
    <>
      <header className="h-16 lg:h-20 flex items-center justify-between px-6 lg:px-10 glass-panel border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/70 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-4 lg:gap-6">
          <h2 className="text-fluid-lg lg:text-fluid-xl font-black text-[var(--text-primary)] tracking-tight uppercase">Admin <span className="text-[var(--accent)]">Dashboard</span></h2>
          <div className="hidden sm:block h-6 w-px bg-[var(--glass-border)] opacity-30"></div>
          <p className="hidden md:block text-[var(--text-secondary)] text-[8px] lg:text-[10px] font-black tracking-[0.3em] uppercase opacity-60">System Admin: <span className="text-[var(--text-primary)]">{user?.name || 'Admin'}</span></p>
        </div>
        <div className="flex items-center gap-3 lg:gap-6">
           <div className="hidden lg:flex items-center glass-panel px-6 py-2.5 border border-[var(--glass-border)] focus-within:border-[var(--accent)]/50 transition-all rounded-[12px] bg-[var(--bg-primary)]/30 backdrop-blur-sm group shadow-sm">
              <span className="material-symbols-outlined text-[var(--text-secondary)] text-xl group-focus-within:text-[var(--accent)] transition-colors">search</span>
              <input type="text" placeholder="Search..." className="bg-transparent border-none focus:ring-0 text-[var(--text-primary)] text-sm w-40 xl:w-56 placeholder:text-[var(--text-secondary)]/40 outline-none pl-3 font-bold uppercase tracking-widest" />
           </div>
           <button className="size-10 lg:size-12 rounded-[14px] glass-panel border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all relative group shadow-sm">
              <span className="material-symbols-outlined text-xl lg:text-2xl group-hover:scale-110 transition-transform">notifications</span>
              <span className="absolute top-2.5 lg:top-3 right-2.5 lg:right-3 size-2 lg:size-2.5 bg-[var(--accent)] rounded-full border-2 border-[var(--bg-primary)] shadow-[0_0_8px_var(--accent)]"></span>
           </button>
           <div className="flex items-center gap-4 pl-3 lg:pl-6 border-l border-[var(--glass-border)]/30">
              <div className="size-10 lg:size-12 rounded-[14px] border border-[var(--accent)]/30 bg-gradient-to-tr from-[var(--accent)]/20 to-indigo-600/10 flex items-center justify-center font-black text-[var(--accent)] shadow-sm transition-all uppercase text-sm lg:text-base">
                {user?.name?.[0] || 'A'}
              </div>
           </div>
        </div>
      </header>

      <div className="p-4 lg:p-10 space-y-8">
        {/* Admin Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="h-32 glass-panel rounded-[24px] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 animate-pulse" />
            ))
          ) : (
            statCards.map((stat) => (
              <div key={stat.label} className="glass-panel p-4 lg:p-6 rounded-[24px] lg:rounded-[40px] hover:translate-y-[-4px] transition-all duration-500 group border border-[var(--glass-border)] bg-[var(--bg-primary)]/50 shadow-sm hover:shadow-xl relative overflow-hidden">
                <div className="flex justify-between items-start mb-4">
                  <div className={`size-9 lg:size-12 rounded-xl lg:rounded-2xl flex items-center justify-center shadow-inner ${stat.bg} ${stat.color}`}>
                    <stat.icon className="size-5 group-hover:scale-110 transition-transform" />
                  </div>
                </div>
                <p className="text-[var(--text-secondary)] text-[7px] lg:text-[9px] font-black tracking-[0.25em] uppercase opacity-50 mb-1">{stat.label}</p>
                <h3 className="text-fluid-base lg:text-fluid-2xl font-black text-[var(--text-primary)] tracking-tight font-mono whitespace-nowrap">{stat.value}</h3>
              </div>
            ))
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          <div className="xl:col-span-8 space-y-8">
             <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 {[
                  { title: 'Users', desc: 'Manage user accounts', icon: 'person', count: stats?.users || 0, color: 'text-blue-400', bg: 'bg-blue-400/10', href: '/admin/users' },
                  { title: 'Tribunal', desc: 'Resolve active disputes', icon: 'gavel', count: stats?.active_disputes || 0, color: 'text-rose-500', bg: 'bg-rose-500/10', href: '/admin/disputes' },
                  { title: 'Approvals', desc: 'Review pending queue', icon: 'verified_user', count: (stats?.pending_vendors || 0) + (stats?.pending_products || 0), color: 'text-indigo-500', bg: 'bg-indigo-500/10', href: '/admin/approvals' },
                  { title: 'Logistics', desc: 'Monitor active shipments', icon: 'local_shipping', count: stats?.active_shipments || 0, color: 'text-cyan-500', bg: 'bg-cyan-500/10', href: '/admin/logistics' },
                ].map((card) => (
                  <Link key={card.title} href={card.href} className="glass-panel rounded-[24px] p-6 border border-[var(--glass-border)] hover:border-[var(--accent)]/40 transition-all flex items-center justify-between group bg-[var(--bg-primary)]/50 hover:shadow-xl">
                     <div className="space-y-4">
                        <div className={`p-3 rounded-xl ${card.bg} ${card.color} w-fit shadow-inner group-hover:rotate-3 transition-transform`}>
                           <span className="material-symbols-outlined text-xl">{card.icon}</span>
                        </div>
                        <div>
                          <h4 className="text-fluid-base font-black text-[var(--text-primary)] tracking-tight uppercase group-hover:text-[var(--accent)] transition-colors">{card.title}</h4>
                          <p className="text-[7px] lg:text-[8px] font-bold text-[var(--text-secondary)] opacity-50 mt-1 uppercase tracking-widest">{card.desc}</p>
                        </div>
                     </div>
                     <div className="text-right flex flex-col justify-between h-full pt-1">
                        <p className={`text-sm font-black font-mono ${card.color}`}>{card.count}</p>
                        <span className="material-symbols-outlined text-[var(--text-secondary)] text-lg mt-6 group-hover:translate-x-1.5 group-hover:text-[var(--accent)] transition-all">arrow_forward</span>
                     </div>
                  </Link>
                ))}
             </section>

             <section className="glass-panel p-6 lg:p-10 rounded-[32px] lg:rounded-[48px] border border-[var(--glass-border)] bg-[var(--bg-primary)]/50 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 size-64 bg-[var(--accent)]/5 rounded-full blur-[80px] pointer-events-none" />
                <div className="flex items-center justify-between mb-10 relative z-10">
                  <div>
                    <h2 className="text-fluid-lg lg:text-fluid-xl font-black text-[var(--text-primary)] tracking-tight uppercase">System Overview</h2>
                    <p className="text-[8px] lg:text-[10px] font-black text-[var(--text-secondary)] tracking-[0.4em] uppercase opacity-40 mt-1">Real-time platform activity</p>
                  </div>
                  <div className="size-12 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] shadow-sm">
                     <span className="material-symbols-outlined">query_stats</span>
                  </div>
                </div>
                <div className="h-64 flex flex-col items-center justify-center bg-[var(--bg-secondary)]/50 rounded-[32px] border border-[var(--glass-border)] text-[var(--text-secondary)] font-black tracking-[0.5em] text-[10px] uppercase shadow-inner relative z-10 gap-4">
                    <div className="flex items-center gap-6">
                       <div className="flex flex-col items-center gap-2">
                          <span className="text-[var(--text-primary)] text-xl font-mono">{stats?.active_products || 0}</span>
                          <span className="opacity-40">Products</span>
                       </div>
                       <div className="w-px h-10 bg-[var(--glass-border)]" />
                       <div className="flex flex-col items-center gap-2">
                           <span className="text-[var(--accent)] text-xl font-mono">{stats?.orders || 0}</span>
                           <span className="opacity-40">Orders</span>
                       </div>
                    </div>
                    <div className="flex items-center gap-2 mt-4 opacity-30 animate-pulse">
                       <Sparkles className="size-4" /> Updating system data...
                    </div>
                </div>
             </section>
          </div>

          <div className="xl:col-span-4 space-y-10">
             <section className="glass-panel p-6 lg:p-10 rounded-[32px] lg:rounded-[48px] border border-[var(--glass-border)] bg-[var(--bg-primary)]/60 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 size-32 bg-indigo-600/5 rounded-full blur-[60px] pointer-events-none" />
                <h2 className="text-2xl font-black text-[var(--text-primary)] tracking-tight uppercase mb-10">Activity Logs</h2>
                <div className="space-y-8">
                   {recentAlerts.map((alert, i) => (
                      <div key={i} className="flex gap-6 group">
                         <div className={`w-1.5 rounded-full transition-all group-hover:h-12 ${alert.type === 'info' ? 'bg-blue-500' : alert.type === 'warning' ? 'bg-indigo-500' : 'bg-rose-500'}`}></div>
                         <div className="flex-1">
                            <h4 className="text-base font-black text-[var(--text-primary)] tracking-tight group-hover:text-[var(--accent)] transition-colors">{alert.title}</h4>
                            <p className="text-sm font-bold text-[var(--text-secondary)] mt-1 opacity-60 leading-relaxed">{alert.desc}</p>
                            <span className="text-[10px] text-[var(--text-secondary)] font-black tracking-[0.3em] mt-3 block uppercase opacity-40">{alert.time}</span>
                         </div>
                      </div>
                   ))}
                </div>
                <Link href="/admin/logs" className="w-full mt-12 py-5 rounded-[24px] bg-[var(--bg-secondary)] text-[var(--text-secondary)] font-black text-[10px] tracking-[0.3em] flex items-center justify-center gap-3 hover:bg-[var(--accent)]/5 hover:text-[var(--text-primary)] hover:border-[var(--accent)]/30 transition-all border border-[var(--glass-border)] uppercase shadow-sm">
                   View Activity History <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                </Link>
             </section>

             <section className="p-8 lg:p-10 rounded-[40px] lg:rounded-[56px] bg-gradient-to-br from-[var(--bg-primary)] to-[var(--accent)]/5 border border-[var(--accent)]/10 shadow-2xl relative overflow-hidden min-h-[340px] flex flex-col justify-between group">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-700">
                   <span className="material-symbols-outlined text-[100px] lg:text-[140px] -rotate-12 font-thin">terminal</span>
                </div>
                <div className="relative z-10 space-y-6">
                  <div className="size-14 lg:size-16 rounded-[20px] lg:rounded-[24px] bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] shadow-sm">
                    <span className="material-symbols-outlined text-3xl lg:text-4xl">terminal</span>
                  </div>
                  <div>
                    <h3 className="text-2xl lg:text-3xl font-black text-[var(--text-primary)] tracking-tight uppercase">Security</h3>
                    <p className="text-[var(--text-secondary)] text-sm mt-3 font-bold leading-relaxed opacity-60">Control system security and user permissions.</p>
                  </div>
                </div>
                <Link href="/admin/security" className="w-full mt-8 py-4 lg:py-5 rounded-[20px] lg:rounded-[24px] bg-[var(--accent)] text-white font-black text-[10px] tracking-[0.4em] shadow-2xl shadow-[var(--accent)]/30 hover:shadow-[var(--accent)]/50 hover:-translate-y-1 transition-all uppercase relative z-10 text-center">
                   Manage Security
                </Link>
             </section>
          </div>
        </div>
      </div>
    </>
  );
}


