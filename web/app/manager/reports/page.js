'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { BarChart3, RefreshCw, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '@/services/api';

function fmtCurrency(n) { return Number(n || 0).toLocaleString('fr-CM'); }
function fmt(n) { return Number(n || 0).toLocaleString(); }

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

export default function ManagerReports() {
  const [rows, setRows] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(daysAgo(0));
  const [accountFilter, setAccountFilter] = useState('');

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await api.get('/manager/accounts');
      setAccounts(res.data?.data || []);
    } catch {}
  }, []);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/manager/reports?from=${from}&to=${to}`;
      if (accountFilter) url += `&account=${accountFilter}`;
      const res = await api.get(url);
      setRows(res.data?.data || []);
    } catch (err) {
      console.error('[Manager] Failed to load reports:', err.message);
    } finally {
      setLoading(false);
    }
  }, [from, to, accountFilter]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);
  useEffect(() => { fetchReports(); }, [fetchReports]);

  const totals = rows.reduce(
    (acc, r) => ({
      orders: acc.orders + Number(r.orders || 0),
      revenue: acc.revenue + Number(r.revenue || 0),
      delivered: acc.delivered + Number(r.delivered || 0),
      cancelled: acc.cancelled + Number(r.cancelled || 0),
    }),
    { orders: 0, revenue: 0, delivered: 0, cancelled: 0 }
  );

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-[var(--text-primary)]">
            Performance Reports
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Revenue and order metrics across accounts
          </p>
        </div>
        <button
          onClick={fetchReports}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--glass-border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[var(--bg-card)] border border-[var(--glass-border)] rounded-xl p-4 backdrop-blur-sm flex flex-wrap items-end gap-4"
      >
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">From</label>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">To</label>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">Account</label>
          <select
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            className="bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none min-w-[160px]"
          >
            <option value="">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name || a.shop_name || a.id}</option>
            ))}
          </select>
        </div>
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-[var(--bg-card)] border border-[var(--glass-border)] rounded-xl overflow-hidden backdrop-blur-sm"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--glass-border)]">
                <th className="text-left px-4 py-3 text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">Account</th>
                <th className="text-right px-4 py-3 text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">Orders</th>
                <th className="text-right px-4 py-3 text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">Revenue</th>
                <th className="text-right px-4 py-3 text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">Delivered</th>
                <th className="text-right px-4 py-3 text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">Cancelled</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-[var(--text-muted)]">Loading...</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-[var(--text-muted)]">No data for selected range</td></tr>
              )}
              {!loading && rows.map((item, i) => (
                <motion.tr
                  key={item.id || i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b border-[var(--glass-border)] last:border-0 hover:bg-[var(--bg-secondary)] transition-colors"
                >
                  <td className="px-4 py-3 text-[var(--text-primary)] font-medium">{item.account_name || item.accountName || '—'}</td>
                  <td className="px-4 py-3 text-right text-[var(--text-secondary)]">{fmt(item.orders)}</td>
                  <td className="px-4 py-3 text-right text-[var(--text-secondary)] font-mono">{fmtCurrency(item.revenue)}</td>
                  <td className="px-4 py-3 text-right text-emerald-400">{fmt(item.delivered)}</td>
                  <td className="px-4 py-3 text-right text-rose-400">{fmt(item.cancelled)}</td>
                </motion.tr>
              ))}
              {/* Summary Row */}
              {!loading && rows.length > 0 && (
                <tr className="bg-[var(--bg-secondary)] font-semibold">
                  <td className="px-4 py-3 text-[var(--text-primary)]">Total</td>
                  <td className="px-4 py-3 text-right text-[var(--text-primary)]">{fmt(totals.orders)}</td>
                  <td className="px-4 py-3 text-right text-[var(--text-primary)] font-mono">{fmtCurrency(totals.revenue)}</td>
                  <td className="px-4 py-3 text-right text-emerald-400">{fmt(totals.delivered)}</td>
                  <td className="px-4 py-3 text-right text-rose-400">{fmt(totals.cancelled)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
