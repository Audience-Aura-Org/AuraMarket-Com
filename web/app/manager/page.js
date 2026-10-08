'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import {
  Users, ClipboardList, ShoppingCart, TrendingUp,
  Wallet, AlertCircle, RefreshCw, ChevronRight, Clock,
} from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import api from '@/services/api';

function fmt(n) { return Number(n || 0).toLocaleString(); }
function fmtCurrency(n) { return Number(n || 0).toLocaleString('fr-CM'); }

const TYPE_STYLES = {
  order:    { color: 'text-blue-400',    bg: 'bg-blue-500/10',    label: 'Order' },
  shipment: { color: 'text-purple-400',  bg: 'bg-purple-500/10',  label: 'Shipment' },
  message:  { color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Message' },
  kyc:      { color: 'text-amber-400',   bg: 'bg-amber-500/10',   label: 'KYC' },
  dispute:  { color: 'text-rose-400',    bg: 'bg-rose-500/10',    label: 'Dispute' },
};

export default function ManagerOverview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/manager/overview');
      if (res.data?.success) setData(res.data.data);
    } catch (err) {
      console.error('[Manager] Failed to load overview:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);

  const totals = data?.totals || {};
  const byType = data?.byType || {};
  const attention = data?.attention || [];
  const recent = data?.recent || [];

  return (
    <div className="p-4 lg:p-6 xl:p-8 space-y-6 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-[var(--text-primary)]">
            Operations Hub
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Cross-account overview
          </p>
        </div>
        <button
          onClick={fetchOverview}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--glass-border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Accounts', value: fmt(totals.accounts), icon: Users, color: 'text-blue-400' },
          { label: 'Tasks Waiting', value: fmt(totals.tasks), icon: ClipboardList, color: 'text-amber-400' },
          { label: '30d Orders', value: fmt(totals.orders30d), icon: ShoppingCart, color: 'text-emerald-400' },
          { label: '30d Revenue', value: fmtCurrency(totals.revenue30d), icon: TrendingUp, color: 'text-indigo-400' },
          { label: 'Total Balance', value: fmtCurrency(totals.balance), icon: Wallet, color: 'text-purple-400' },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-[var(--bg-card)] border border-[var(--glass-border)] rounded-xl p-4 backdrop-blur-sm"
          >
            <div className="flex items-center gap-2 mb-2">
              <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">{kpi.label}</span>
            </div>
            <p className="text-xl font-bold text-[var(--text-primary)]">
              {loading ? '...' : kpi.value}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Two Column */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Attention Required */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-[var(--bg-card)] border border-[var(--glass-border)] rounded-xl p-5 backdrop-blur-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              Attention Required
            </h2>
            <Link href="/manager/accounts" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
              All accounts <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {!loading && attention.length === 0 && (
            <p className="text-sm text-[var(--text-muted)] py-8 text-center">All clear - no accounts need attention</p>
          )}

          <div className="space-y-2">
            {attention.map((a) => (
              <Link
                key={a.id}
                href={`/manager/as/${a.id}`}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-sm font-bold text-blue-400">
                    {(a.name || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{a.name || 'Unknown'}</p>
                    <p className="text-xs text-[var(--text-muted)]">{a.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-xs font-medium">
                    {a.tasks} task{a.tasks !== 1 ? 's' : ''}
                  </span>
                  <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Task Timeline */}
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-[var(--bg-card)] border border-[var(--glass-border)] rounded-xl p-5 backdrop-blur-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              Task Timeline
            </h2>
            <Link href="/manager/tasks" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
              All tasks <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {!loading && recent.length === 0 && (
            <p className="text-sm text-[var(--text-muted)] py-8 text-center">No pending tasks</p>
          )}

          <div className="space-y-2">
            {recent.map((t, i) => {
              const style = TYPE_STYLES[t.type] || TYPE_STYLES.order;
              return (
                <Link
                  key={`${t.id}-${i}`}
                  href={t.href || '/manager/tasks'}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.color}`}>
                      {style.label}
                    </span>
                    <div>
                      <p className="text-sm text-[var(--text-primary)]">{t.title}</p>
                      <p className="text-xs text-[var(--text-muted)]">{t.account}</p>
                    </div>
                  </div>
                  <span className="text-xs text-[var(--text-muted)]">
                    {t.at ? new Date(t.at).toLocaleDateString() : ''}
                  </span>
                </Link>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* By the Numbers */}
      {Object.keys(byType).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-[var(--bg-card)] border border-[var(--glass-border)] rounded-xl p-5 backdrop-blur-sm"
        >
          <h2 className="font-display font-semibold text-[var(--text-primary)] mb-3">By the Numbers</h2>
          <div className="flex flex-wrap gap-4">
            {Object.entries(byType).map(([type, count]) => {
              const style = TYPE_STYLES[type] || TYPE_STYLES.order;
              return (
                <div key={type} className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${style.bg.replace('/10', '')}`} />
                  <span className="text-sm text-[var(--text-secondary)]">
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
