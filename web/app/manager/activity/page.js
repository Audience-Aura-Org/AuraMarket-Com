'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { Activity, RefreshCw, Filter } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '@/services/api';

const CATEGORY_STYLES = {
  products: { color: 'text-blue-400',    bg: 'bg-blue-500/10' },
  orders:   { color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  messages: { color: 'text-purple-400',  bg: 'bg-purple-500/10' },
  money:    { color: 'text-amber-400',   bg: 'bg-amber-500/10' },
  profile:  { color: 'text-indigo-400',  bg: 'bg-indigo-500/10' },
  other:    { color: 'text-gray-400',    bg: 'bg-gray-500/10' },
};

const CATEGORIES = ['products', 'orders', 'messages', 'money', 'profile', 'other'];

export default function ManagerActivity() {
  const [logs, setLogs] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accountFilter, setAccountFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await api.get('/manager/accounts');
      setAccounts(res.data?.data || []);
    } catch {}
  }, []);

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (accountFilter) params.set('account', accountFilter);
      if (categoryFilter) params.set('category', categoryFilter);
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await api.get(`/manager/activity${query}`);
      setLogs(res.data?.data || []);
    } catch (err) {
      console.error('[Manager] Failed to load activity:', err.message);
    } finally {
      setLoading(false);
    }
  }, [accountFilter, categoryFilter]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);
  useEffect(() => { fetchActivity(); }, [fetchActivity]);

  return (
    <div className="p-4 lg:p-6 xl:p-8 space-y-6 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-[var(--text-primary)]">
            Activity Log
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Audit trail across all managed accounts
          </p>
        </div>
        <button
          onClick={fetchActivity}
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
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">Category</label>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setCategoryFilter('')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                !categoryFilter
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              All
            </button>
            {CATEGORIES.map((cat) => {
              const style = CATEGORY_STYLES[cat];
              return (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    categoryFilter === cat
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              );
            })}
          </div>
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
                <th className="text-left px-4 py-3 text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">Timestamp</th>
                <th className="text-left px-4 py-3 text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">Account</th>
                <th className="text-left px-4 py-3 text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">Category</th>
                <th className="text-left px-4 py-3 text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">Action</th>
                <th className="text-left px-4 py-3 text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">Fields</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-[var(--text-muted)]">Loading...</td></tr>
              )}
              {!loading && logs.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-[var(--text-muted)]">No activity found</td></tr>
              )}
              {!loading && logs.map((item, i) => {
                const cat = item.category || 'other';
                const style = CATEGORY_STYLES[cat] || CATEGORY_STYLES.other;
                return (
                  <motion.tr
                    key={item.id || i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="border-b border-[var(--glass-border)] last:border-0 hover:bg-[var(--bg-secondary)] transition-colors"
                  >
                    <td className="px-4 py-3 text-[var(--text-muted)] text-xs whitespace-nowrap">
                      {item.timestamp ? new Date(item.timestamp).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {item.account_name || item.accountName || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.color}`}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-primary)] font-mono text-xs">
                      {item.action || `${item.method || ''} ${item.path || ''}`}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)] text-xs max-w-[200px] truncate">
                      {typeof item.fields === 'object'
                        ? Object.keys(item.fields || {}).join(', ')
                        : (item.fields || '—')}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
