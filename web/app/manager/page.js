'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users, ClipboardList, ShoppingCart, TrendingUp,
  Wallet, AlertCircle, RefreshCw, ChevronRight, Clock,
  ArrowUpRight, BarChart3, CircleDot,
} from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import api from '@/services/api';

function fmt(n) { return Number(n || 0).toLocaleString(); }
function fmtCurrency(n) {
  const val = Number(n || 0);
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return val.toLocaleString('fr-CM');
}

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

const TYPE_STYLES = {
  order:    { color: 'text-blue-400',    bg: 'bg-blue-500/10',    dot: 'bg-blue-400',    label: 'Order' },
  shipment: { color: 'text-purple-400',  bg: 'bg-purple-500/10',  dot: 'bg-purple-400',  label: 'Shipment' },
  message:  { color: 'text-emerald-400', bg: 'bg-emerald-500/10', dot: 'bg-emerald-400', label: 'Message' },
  kyc:      { color: 'text-amber-400',   bg: 'bg-amber-500/10',   dot: 'bg-amber-400',   label: 'KYC' },
  dispute:  { color: 'text-rose-400',    bg: 'bg-rose-500/10',    dot: 'bg-rose-400',    label: 'Dispute' },
};

const ROLE_AVATAR = {
  vendor:    'bg-pink-500/12 text-pink-400',
  logistics: 'bg-purple-500/12 text-purple-400',
  customer:  'bg-teal-500/12 text-teal-400',
};

export default function ManagerOverview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasFetched = useRef(false);

  const fetchOverview = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else if (!hasFetched.current) setLoading(true);

    try {
      const res = await api.get('/manager/overview');
      if (res.data?.success) setData(res.data.data);
    } catch (err) {
      console.error('[Manager] Failed to load overview:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
      hasFetched.current = true;
    }
  }, []);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);

  const totals = data?.totals || {};
  const byType = data?.byType || {};
  const attention = data?.attention || [];
  const recent = data?.recent || [];
  const hasData = !!data;

  const kpis = [
    { label: 'Accounts',     value: fmt(totals.accounts),           icon: Users,         accent: 'blue' },
    { label: 'Pending',      value: fmt(totals.tasks),              icon: ClipboardList, accent: 'amber' },
    { label: 'Orders (30d)', value: fmt(totals.orders30d),          icon: ShoppingCart,  accent: 'emerald' },
    { label: 'Revenue',      value: fmtCurrency(totals.revenue30d), icon: TrendingUp,    accent: 'indigo' },
    { label: 'Balance',      value: fmtCurrency(totals.balance),    icon: Wallet,        accent: 'violet' },
  ];

  const accentMap = {
    blue:    'bg-blue-500/10 text-blue-400',
    amber:   'bg-amber-500/10 text-amber-400',
    emerald: 'bg-emerald-500/10 text-emerald-400',
    indigo:  'bg-indigo-500/10 text-indigo-400',
    violet:  'bg-violet-500/10 text-violet-400',
  };

  // Loading skeleton
  if (loading && !hasData) {
    return (
      <div className="p-4 md:p-6 space-y-4 w-full animate-pulse">
        <div className="h-7 w-40 rounded-lg bg-[var(--bg-card)]" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[92px] rounded-2xl bg-[var(--bg-card)] border border-[var(--glass-border)]" />
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="h-[260px] rounded-2xl bg-[var(--bg-card)] border border-[var(--glass-border)]" />
          <div className="h-[260px] rounded-2xl bg-[var(--bg-card)] border border-[var(--glass-border)]" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5 w-full max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg md:text-xl font-display font-bold text-[var(--text-primary)] tracking-tight">
            Overview
          </h1>
          <p className="text-[11px] md:text-xs text-[var(--text-muted)] mt-0.5 tracking-tight">
            Cross-account operations at a glance
          </p>
        </div>
        <button
          onClick={() => fetchOverview(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] border border-transparent hover:border-[var(--glass-border)] transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-2.5">
        {kpis.map((kpi, i) => {
          const accent = accentMap[kpi.accent];
          return (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="relative overflow-hidden rounded-2xl bg-[var(--bg-card)] border border-[var(--glass-border)] p-3 md:p-4"
            >
              <div className={`inline-flex items-center justify-center size-7 md:size-8 rounded-lg md:rounded-xl ${accent} mb-2`}>
                <kpi.icon className="size-3.5 md:size-4" />
              </div>
              <p className="text-[9px] md:text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-0.5">
                {kpi.label}
              </p>
              <p className="text-base md:text-xl font-bold text-[var(--text-primary)] tracking-tight leading-none">
                {kpi.value}
              </p>
            </motion.div>
          );
        })}
      </div>

      {/* Two Column Layout */}
      <div className="grid md:grid-cols-2 gap-3 md:gap-4">
        {/* Attention Required */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="rounded-2xl bg-[var(--bg-card)] border border-[var(--glass-border)] overflow-hidden"
        >
          <div className="flex items-center justify-between px-3.5 md:px-4 py-2.5 md:py-3 border-b border-[var(--glass-border)]">
            <h2 className="text-[12px] md:text-[13px] font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
              <AlertCircle className="size-3.5 text-amber-400" />
              Needs Attention
            </h2>
            <Link href="/manager/accounts" className="text-[10px] font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-0.5 transition-colors">
              All <ArrowUpRight className="size-2.5" />
            </Link>
          </div>

          <div className="divide-y divide-[var(--glass-border)]/50">
            {hasData && attention.length === 0 && (
              <div className="py-8 md:py-10 text-center">
                <CircleDot className="size-7 md:size-8 text-emerald-400/30 mx-auto mb-2" />
                <p className="text-[11px] md:text-xs text-[var(--text-muted)]">All accounts in good shape</p>
              </div>
            )}

            {attention.map((a) => (
              <Link
                key={a.id}
                href={`/manager/as/${a.id}/dashboard`}
                className="flex items-center gap-2.5 md:gap-3 px-3.5 md:px-4 py-2.5 md:py-3 hover:bg-[var(--bg-secondary)]/40 transition-colors active:bg-[var(--bg-secondary)]/60 group"
              >
                <div className={`size-8 md:size-9 rounded-lg md:rounded-xl flex items-center justify-center text-[11px] md:text-[12px] font-bold shrink-0 ${ROLE_AVATAR[a.role] || ROLE_AVATAR.customer}`}>
                  {(a.name || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] md:text-[12px] font-semibold text-[var(--text-primary)] truncate leading-tight">
                    {a.name || 'Unknown'}
                  </p>
                  <p className="text-[9px] md:text-[10px] text-[var(--text-muted)] capitalize mt-0.5">{a.role}</p>
                </div>
                <span className="px-1.5 md:px-2 py-0.5 rounded-md md:rounded-lg bg-amber-500/10 text-amber-400 text-[9px] md:text-[10px] font-bold shrink-0">
                  {a.tasks}
                </span>
                <ChevronRight className="size-3.5 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0 hidden sm:block" />
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Recent Tasks */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="rounded-2xl bg-[var(--bg-card)] border border-[var(--glass-border)] overflow-hidden"
        >
          <div className="flex items-center justify-between px-3.5 md:px-4 py-2.5 md:py-3 border-b border-[var(--glass-border)]">
            <h2 className="text-[12px] md:text-[13px] font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
              <Clock className="size-3.5 text-blue-400" />
              Recent Tasks
            </h2>
            <Link href="/manager/tasks" className="text-[10px] font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-0.5 transition-colors">
              All <ArrowUpRight className="size-2.5" />
            </Link>
          </div>

          <div className="divide-y divide-[var(--glass-border)]/50">
            {hasData && recent.length === 0 && (
              <div className="py-8 md:py-10 text-center">
                <ClipboardList className="size-7 md:size-8 text-blue-400/20 mx-auto mb-2" />
                <p className="text-[11px] md:text-xs text-[var(--text-muted)]">No pending tasks</p>
              </div>
            )}

            {recent.map((t, i) => {
              const style = TYPE_STYLES[t.type] || TYPE_STYLES.order;
              return (
                <Link
                  key={`${t.id}-${i}`}
                  href={t.href || '/manager/tasks'}
                  className="flex items-center gap-2.5 md:gap-3 px-3.5 md:px-4 py-2.5 md:py-3 hover:bg-[var(--bg-secondary)]/40 transition-colors active:bg-[var(--bg-secondary)]/60"
                >
                  <div className={`size-2 rounded-full shrink-0 ${style.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[11px] md:text-[12px] font-semibold text-[var(--text-primary)] truncate leading-tight">
                        {t.title}
                      </p>
                      <span className={`shrink-0 px-1 py-px rounded text-[7px] md:text-[8px] font-bold uppercase tracking-wider ${style.bg} ${style.color}`}>
                        {style.label}
                      </span>
                    </div>
                    <p className="text-[9px] md:text-[10px] text-[var(--text-muted)] mt-0.5 truncate">{t.account}</p>
                  </div>
                  <span className="text-[9px] md:text-[10px] text-[var(--text-muted)] shrink-0 tabular-nums">
                    {timeAgo(t.at)}
                  </span>
                </Link>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* Summary Strip */}
      {Object.keys(byType).length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-2 px-3.5 md:px-4 py-2.5 rounded-2xl bg-[var(--bg-card)] border border-[var(--glass-border)] overflow-x-auto no-scrollbar"
        >
          <BarChart3 className="size-3.5 text-[var(--text-muted)] shrink-0" />
          <div className="flex items-center gap-3 md:gap-4">
            {Object.entries(byType).map(([type, count]) => {
              const style = TYPE_STYLES[type] || TYPE_STYLES.order;
              return (
                <div key={type} className="flex items-center gap-1.5 shrink-0">
                  <span className={`size-1.5 rounded-full ${style.dot}`} />
                  <span className="text-[10px] md:text-[11px] font-semibold text-[var(--text-secondary)] whitespace-nowrap">
                    {count} {style.label}{count !== 1 ? 's' : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}
