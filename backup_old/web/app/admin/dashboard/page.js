"use client";

import { useState, useEffect } from 'react';
import { TrendingUp, Users, Store, Sparkles, Package } from 'lucide-react';
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
    <div className="w-full min-h-screen px-3 md:px-8 py-8 space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="h-32 glass-panel rounded-[24px] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 animate-pulse" />
          ))
        ) : (
          statCards.map((stat) => (
            <div key={stat.label} className="glass-panel p-4 lg:p-6 rounded-[24px] lg:rounded-[40px] hover:-translate-y-1 transition-all duration-500 group border border-[var(--glass-border)] bg-[var(--bg-primary)]/50 shadow-sm hover:shadow-xl relative overflow-hidden">
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
              { title: 'Users', desc: 'Manage user accounts', icon: 'person', count: stats?.users || 0, color: 'text-blue-500', bg: 'bg-blue-500/10', href: '/admin/users' },
              { title: 'Vendors', desc: 'Manage seller stores', icon: 'store', count: stats?.vendors || 0, color: 'text-amber-500', bg: 'bg-amber-500/10', href: '/admin/vendors' },
              { title: 'Products', desc: 'Approve and manage products', icon: 'inventory', count: stats?.products || 0, color: 'text-[var(--accent)]', bg: 'bg-[var(--accent)]/10', href: '/admin/products' },
              { title: 'Escrow', desc: 'Secure funds in holding', icon: 'account_balance', count: `${(stats?.escrow_vault || 0).toLocaleString()} XAF`, color: 'text-emerald-500', bg: 'bg-emerald-500/10', href: '/admin/escrow' },
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
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
              {[
                { label: 'Live Nodes', value: stats?.online_users || 0, icon: 'wifi', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                { label: 'Active Today', value: stats?.active_users_24h || 0, icon: 'bolt', color: 'text-amber-500', bg: 'bg-amber-500/10' },
                { label: 'Products Map', value: stats?.active_products || 0, icon: 'hub', color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
                { label: 'Order Volume', value: stats?.orders || 0, icon: 'rebase_edit', color: 'text-[var(--accent)]', bg: 'bg-[var(--accent)]/10' },
              ].map((item, idx) => (
                <div key={idx} className="flex flex-col items-center p-6 bg-[var(--bg-secondary)]/50 rounded-[24px] border border-[var(--glass-border)] shadow-inner group/item hover:bg-[var(--bg-primary)] transition-all">
                  <div className={`p-2.5 rounded-xl ${item.bg} ${item.color} mb-4 group-hover/item:scale-110 transition-transform`}>
                    <span className="material-symbols-outlined text-lg">{item.icon}</span>
                  </div>
                  <span className="text-[var(--text-primary)] text-2xl font-black font-mono leading-none tracking-tighter mb-2">{item.value}</span>
                  <span className="text-[8px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-40">{item.label}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-center gap-2 mt-10 opacity-30 animate-pulse relative z-10">
              <Sparkles className="size-4" />
              <span className="text-[9px] font-black uppercase tracking-[0.3em]">Synchronizing system telemetry...</span>
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
                  <div className={`w-1.5 rounded-full transition-all group-hover:h-12 ${alert.type === 'info' ? 'bg-blue-500' : alert.type === 'warning' ? 'bg-indigo-500' : 'bg-rose-500'}`} />
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
  );
}
