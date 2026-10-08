'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { Package, RefreshCw, Filter, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import api from '@/services/api';

const STATUS_STYLES = {
  pending:    { color: 'text-amber-400',   bg: 'bg-amber-500/10',   label: 'Pending' },
  assigned:   { color: 'text-blue-400',    bg: 'bg-blue-500/10',    label: 'Assigned' },
  'in-transit': { color: 'text-purple-400', bg: 'bg-purple-500/10', label: 'In Transit' },
  delivered:  { color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Delivered' },
};

export default function ManagerShipments() {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const fetchShipments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/manager/shipments');
      setShipments(res.data?.data || []);
    } catch (err) {
      console.error('[Manager] Failed to load shipments:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchShipments(); }, [fetchShipments]);

  const filtered = filter === 'all'
    ? shipments
    : shipments.filter((s) => s.status === filter);

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-[var(--text-primary)]">
            Cross-Account Shipments
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Track shipments across all managed accounts
          </p>
        </div>
        <button
          onClick={fetchShipments}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--glass-border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Status Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-[var(--text-muted)]" />
        {['all', 'pending', 'assigned', 'in-transit', 'delivered'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === s
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            {s === 'all' ? 'All' : (STATUS_STYLES[s]?.label || s)}
          </button>
        ))}
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[var(--bg-card)] border border-[var(--glass-border)] rounded-xl overflow-hidden backdrop-blur-sm"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--glass-border)]">
                <th className="text-left px-4 py-3 text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">Shipment ID</th>
                <th className="text-left px-4 py-3 text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">Account</th>
                <th className="text-left px-4 py-3 text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">Status</th>
                <th className="text-left px-4 py-3 text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">Date</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-[var(--text-muted)]">Loading...</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-[var(--text-muted)]">No shipments found</td></tr>
              )}
              {!loading && filtered.map((item, i) => {
                const style = STATUS_STYLES[item.status] || STATUS_STYLES.pending;
                return (
                  <motion.tr
                    key={item.id || i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-[var(--glass-border)] last:border-0 hover:bg-[var(--bg-secondary)] transition-colors"
                  >
                    <td className="px-4 py-3 text-[var(--text-primary)] font-mono text-xs">{item.id}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{item.account_name || item.accountName || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.color}`}>
                        {style.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)] text-xs">
                      {item.date ? new Date(item.date).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.href && (
                        <Link href={item.href} className="text-blue-400 hover:text-blue-300 transition-colors">
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      )}
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
