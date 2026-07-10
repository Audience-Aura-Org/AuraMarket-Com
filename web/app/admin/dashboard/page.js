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
import { useLanguage } from '@/context/LanguageContext';

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
  const { t } = useLanguage();
  const { user } = useAuthStore();
  const [stats, setStats] = useState({});      // default {} so fmt() shows 0 immediately
  const [loading, setLoading] = useState(true);
  const [subStats, setSubStats] = useState({ revenue: null, total: 0, active: 0 });
  const earnings = stats?.admin_earnings || {};

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [analyticsRes, subRes] = await Promise.all([
        api.get('/admin/analytics'),
        api.get('/subscriptions/admin/overview', { skipClientCache: true }),
      ]);
      setStats(analyticsRes.data.success ? analyticsRes.data.data.stats : {});
      const subData = subRes.data?.data || {};
      const subs = subData.subscriptions || [];
      const active = subs.filter(s => s.status === 'active').length;
      const rev = subData.stats?.revenue ?? subs.reduce((sum, s) => sum + Number(s.amount_paid || 0), 0);
      setSubStats({ revenue: rev, total: subs.length, active });
    } catch (err) {
      console.error('Failed to fetch admin stats:', err);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="w-full min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-display">
      {/* Surgical Header */}
      <div className="relative border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/10 backdrop-blur-2xl sticky top-0 z-50">
        {/* Accent gradient line */}
        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--accent)]/40 to-transparent" />
        <div className="px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 md:size-11 rounded-2xl bg-gradient-to-br from-[var(--accent)]/20 to-indigo-600/10 flex items-center justify-center text-[var(--accent)] border border-[var(--accent)]/20 shrink-0 shadow-lg shadow-[var(--accent)]/5">
                 <LayoutDashboard className="size-5" />
              </div>
              <div>
                <h1 className="text-base md:text-lg font-bold tracking-tight font-[Poppins]">{t('admin.platformCommand', 'Platform Command')}</h1>
                <p className="text-[10px] font-semibold text-[var(--text-secondary)] opacity-40 tracking-tight font-[Poppins]">{t('admin.globalHub', 'Global Administrative Hub')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 md:gap-3">
               <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/5 border border-emerald-500/10">
                  <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-semibold text-emerald-500 font-[Poppins]">{t('admin.systemsNominal', 'Systems Nominal')}</span>
               </div>
               <button onClick={fetchStats} className="size-10 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/50 text-[var(--text-secondary)] flex items-center justify-center hover:text-[var(--accent)] hover:border-[var(--accent)]/30 transition-all active:scale-95">
                  <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
               </button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-8 space-y-8 font-sans">
        
        {/* KPI Row */}
        {(() => {
          const userPct   = Math.min(Math.round((stats?.users || 0) / 10), 100);
          const vendorPct = Math.min((stats?.pending_vendors || 0) * 10, 100);
          const prodPct   = Math.min((stats?.pending_products || 0) * 5, 100);
          return (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label={t('admin.actives', 'Actives')} value={fmt(stats?.users)} sub={t('admin.registeredAccounts', 'Registered Accounts')} icon={Users} color="blue" href="/admin/users" progress={userPct} footer={`${fmt(stats?.users || 0)} total accounts`} />
              <StatCard label={t('admin.merchantQueue', 'Merchant Queue')} value={fmt(stats?.pending_vendors)} sub={t('admin.awaitingKyc', 'Awaiting KYC')} icon={Store} color="amber" href="/admin/vendors" progress={vendorPct} footer="Awaiting review" />
              <StatCard label={t('admin.assetPipeline', 'Asset Pipeline')} value={fmt(stats?.pending_products)} sub={t('admin.pendingApproval', 'Pending Approval')} icon={Package} color="primary" href="/admin/products" progress={prodPct} footer="Pending approval" />
              <StatCard label={t('admin.globalVolume', 'Global Volume')} value={`${fmt(stats?.revenue)} XAF`} sub={t('admin.grossRevenue', 'Gross Platform Revenue')} icon={TrendingUp} color="emerald" href="/admin/analytics" progress={100} footer="Gross platform revenue" />
            </div>
          );
        })()}

        <section className="rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4 shadow-sm md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold tracking-tight">{t('admin.adminEarnings', 'Admin Earnings')}</h2>
              <p className="text-[10px] font-semibold text-[var(--text-secondary)] opacity-60">{t('admin.incomeSplit', 'Platform income split by source.')}</p>
            </div>
            <Link href="/admin/transactions" className="rounded-full border border-[var(--glass-border)] px-3 py-1.5 text-[10px] font-bold text-[var(--accent)]">
              {t('admin.viewLedger', 'View Ledger')}
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {[
              { title: t('admin.commission', 'Commission'), value: earnings.commission, desc: t('admin.productSaleFee', 'Product sale fee'), icon: TrendingUp, color: 'emerald' },
              { title: t('admin.escrowFees', 'Escrow Fees'), value: earnings.escrow, desc: t('admin.escrowProtectionFee', 'Escrow protection fee'), icon: ShieldCheck, color: 'blue' },
              { title: t('admin.collectionFees', 'Collection Fees'), value: earnings.collection, desc: t('admin.mobileMoneyCharges', 'Mobile money charges'), icon: Activity, color: 'amber' },
              { title: t('admin.subscriptions', 'Subscriptions'), value: subStats.revenue ?? earnings.subscription ?? 0, desc: `${subStats.active} active · ${subStats.total} total`, icon: Zap, color: 'indigo' },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/25 p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className={`size-8 rounded-xl flex items-center justify-center border ${COLOR_BOX_STYLES[item.color] || COLOR_BOX_STYLES.blue}`}>
                    <item.icon className="size-3.5" />
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--text-secondary)] opacity-60">XAF</span>
                </div>
                <p className={`truncate text-sm font-bold tabular-nums transition-all ${loading ? 'animate-pulse text-[var(--text-secondary)] opacity-40' : ''}`}>
                  {loading ? '——' : fmt(item.value)}
                </p>
                <p className="mt-1 text-[10px] font-bold text-[var(--text-primary)]">{item.title}</p>
                <p className="text-[9px] font-semibold text-[var(--text-secondary)] opacity-55">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="grid lg:grid-cols-3 gap-6">
          
          {/* Entity Management List */}
          <section className="lg:col-span-2 bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-3xl md:rounded-[2.5rem] p-5 md:p-8 shadow-sm">
             <div className="flex items-center justify-between mb-6 md:mb-8">
                <div>
                  <h3 className="text-[10px] md:text-[12px] font-semibold tracking-[0.2em] opacity-40 uppercase">{t('admin.operationalEntities', 'Operational Entities')}</h3>
                  <p className="text-[10px] md:text-[11px] lg:text-[12px] font-semibold text-[var(--text-secondary)] opacity-30 mt-1">{t('admin.managementMatrix', 'High-Density Management Matrix')}</p>
                </div>
                <Zap className="size-4 opacity-20 hidden sm:block" />
             </div>

             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { title: t('admin.userDirectory', 'User Directory'), desc: t('admin.authProfileControl', 'Auth & Profile Control'), count: fmt(stats?.users || 0), icon: Users, color: 'blue', href: '/admin/users' },
                  { title: t('admin.merchantRegistry', 'Merchant Registry'), desc: t('admin.kycStoreOversight', 'KYC & Store Oversight'), count: fmt(stats?.vendors || 0), icon: Store, color: 'amber', href: '/admin/vendors' },
                  { title: t('admin.productLedger', 'Product Ledger'), desc: t('admin.catalogModeration', 'Catalog Moderation'), count: fmt(stats?.products || 0), icon: Package, color: 'accent', href: '/admin/products' },
                  { title: t('admin.escrowVault', 'Escrow Vault'), desc: t('admin.platformLiquidity', 'Active Custody'), count: `${fmt(stats?.escrow_vault)} XAF`, icon: ShieldCheck, color: 'emerald', href: '/admin/escrow' },
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

             <div className="mt-6 pt-5 border-t border-[var(--glass-border)]">
                <div className="mb-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--text-secondary)] opacity-50">Ops Signals</p>
                  </div>
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-500">Live</span>
                </div>
                <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/50 divide-y divide-[var(--glass-border)] overflow-hidden">
                  {[
                    { title: 'Volume', desc: 'Marketplace flow', count: `${fmt(stats?.revenue || 0)} XAF`, icon: Activity, color: 'blue', signal: 'Flow', href: '/admin/analytics' },
                    { title: 'KYC Queue', desc: 'Pending review', count: fmt(stats?.pending_vendors || 0), icon: ShieldAlert, color: 'rose', signal: 'Review', href: '/admin/approvals' },
                    { title: 'Escrow', desc: 'Protected funds', count: `${fmt(stats?.escrow_vault || 0)} XAF`, icon: ShieldCheck, color: 'emerald', signal: 'Vault', href: '/admin/escrow' },
                    { title: 'Uptime', desc: 'API health', count: '99.98%', icon: Zap, color: 'amber', signal: 'Stable', href: '/admin/logs' },
                  ].map((item, i) => {
                    const colorClass = COLOR_BOX_STYLES[item.color] || COLOR_BOX_STYLES.blue;
                    const textColor = colorClass.split(' ')[0];
                    return (
                      <Link key={i} href={item.href} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--bg-secondary)]/40 transition-colors">
                        <div className={`size-7 rounded-xl flex items-center justify-center border shrink-0 ${colorClass}`}>
                          <item.icon className="size-3" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-[var(--text-primary)] leading-tight">{item.title}</p>
                          <p className="text-[10px] font-semibold text-[var(--text-secondary)] opacity-45 leading-tight">{item.desc}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[12px] font-bold tabular-nums text-[var(--text-primary)]">{item.count}</p>
                          <p className={`text-[9px] font-bold uppercase tracking-[0.12em] ${textColor}`}>{item.signal}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
             </div>
          </section>

          {/* System Security & Logs */}
          <section className="lg:col-span-1 space-y-6">
             <div className="bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-[2rem] md:rounded-[2.5rem] p-5 md:p-8 shadow-sm">
                <h3 className="text-[11px] lg:text-[12px] font-semibold tracking-[0.3em] opacity-40 mb-6 md:mb-8">Security Terminal</h3>
                <div className="space-y-4">
                   <div className="p-5 rounded-3xl bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] group hover:border-[var(--accent)]/30 transition-all">
                      <div className="mb-4 flex items-center justify-between gap-4">
                        <div className="size-11 rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center">
                          <Terminal className="size-5" />
                        </div>
                        <span className="rounded-full bg-amber-500/10 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-amber-500">KYC Gate</span>
                      </div>
                      <h4 className="text-base font-bold tracking-tight mb-1">Authorization Layer</h4>
                      <p className="text-[12px] font-semibold text-[var(--text-secondary)] opacity-60 leading-relaxed mb-5">Request user verification, review pending KYC, and restore access after approval.</p>
                      <Link href="/admin/users?verification=held" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-white transition-all hover:brightness-110 active:scale-[0.98] sm:w-auto">
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
