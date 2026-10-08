'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import {
  ShoppingCart, RefreshCw, Search, Package,
  Clock, Truck, CheckCircle2, XCircle, Filter,
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/services/api';

function fmtCurrency(n) { return Number(n || 0).toLocaleString('fr-CM'); }

const STATUSES = [
  { key: null,          label: 'All',        icon: Filter },
  { key: 'pending',     label: 'Pending',    icon: Clock },
  { key: 'processing',  label: 'Processing', icon: Package },
  { key: 'shipped',     label: 'Shipped',    icon: Truck },
  { key: 'delivered',   label: 'Delivered',  icon: CheckCircle2 },
];

const STATUS_COLORS = {
  pending:    { bg: 'bg-amber-500/10',   text: 'text-amber-400',   dot: 'bg-amber-400' },
  processing: { bg: 'bg-blue-500/10',    text: 'text-blue-400',    dot: 'bg-blue-400' },
  shipped:    { bg: 'bg-purple-500/10',  text: 'text-purple-400',  dot: 'bg-purple-400' },
  delivered:  { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  cancelled:  { bg: 'bg-rose-500/10',    text: 'text-rose-400',    dot: 'bg-rose-400' },
};

function truncateId(id) {
  if (!id) return '---';
  const s = String(id);
  return s.length > 10 ? `${s.slice(0, 4)}...${s.slice(-4)}` : s;
}

export default function ManagerOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState(null);

  const fetchOrders = useCallback(async (status) => {
    setLoading(true);
    try {
      const params = {};
      if (status) params.status = status;
      const res = await api.get('/manager/orders', { params });
      setOrders(res.data?.data || []);
    } catch (err) {
      console.error('[Manager/Orders] Failed to load orders:', err.message);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(activeStatus); }, [fetchOrders, activeStatus]);

  const handleStatusFilter = (key) => {
    setActiveStatus(key);
  };

  return (
    <div className="p-4 lg:p-6 xl:p-8 space-y-6 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-[var(--text-primary)] flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-blue-400" />
            Cross-Account Orders
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Orders across all managed vendor accounts
          </p>
        </div>
        <button
          onClick={() => fetchOrders(activeStatus)}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--glass-border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Status Filter Pills */}
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => {
          const active = activeStatus === s.key;
          return (
            <button
              key={s.key ?? 'all'}
              onClick={() => handleStatusFilter(s.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                active
                  ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                  : 'bg-[var(--bg-card)] border-[var(--glass-border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)]'
              }`}
            >
              <s.icon className="w-3.5 h-3.5" />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Orders Table */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-[var(--bg-card)] border border-[var(--glass-border)] rounded-xl backdrop-blur-sm overflow-hidden"
      >
        {/* Table Header */}
        <div className="hidden sm:grid sm:grid-cols-[1fr_1.5fr_1fr_1fr_1fr] gap-4 px-5 py-3 border-b border-[var(--glass-border)] text-xs uppercase tracking-wider text-[var(--text-muted)]">
          <span>Order ID</span>
          <span>Account</span>
          <span>Status</span>
          <span className="text-right">Total</span>
          <span className="text-right">Date</span>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-5 h-5 animate-spin text-[var(--text-muted)]" />
            <span className="ml-2 text-sm text-[var(--text-muted)]">Loading orders...</span>
          </div>
        )}

        {/* Empty State */}
        {!loading && orders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="w-8 h-8 text-[var(--text-muted)] mb-3" />
            <p className="text-sm text-[var(--text-muted)]">
              {activeStatus ? `No ${activeStatus} orders found` : 'No orders found'}
            </p>
          </div>
        )}

        {/* Order Rows */}
        <AnimatePresence mode="wait">
          {!loading && orders.length > 0 && (
            <motion.div
              key={activeStatus ?? 'all'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {orders.map((item, i) => {
                const colors = STATUS_COLORS[item.status] || STATUS_COLORS.pending;
                return (
                  <motion.div
                    key={item._id || item.id || i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <Link
                      href={item.href || '#'}
                      className="grid grid-cols-1 sm:grid-cols-[1fr_1.5fr_1fr_1fr_1fr] gap-2 sm:gap-4 px-5 py-3.5 border-b border-[var(--glass-border)] hover:bg-[var(--bg-secondary)] transition-colors group"
                    >
                      {/* Order ID */}
                      <div className="flex items-center gap-2">
                        <span className="sm:hidden text-xs text-[var(--text-muted)]">ID:</span>
                        <span className="text-sm font-mono text-[var(--text-primary)] group-hover:text-blue-400 transition-colors">
                          {truncateId(item._id || item.id)}
                        </span>
                      </div>

                      {/* Account Name */}
                      <div className="flex items-center gap-2">
                        <span className="sm:hidden text-xs text-[var(--text-muted)]">Account:</span>
                        <span className="text-sm text-[var(--text-primary)] truncate">
                          {item.accountName || item.account || '---'}
                        </span>
                      </div>

                      {/* Status Badge */}
                      <div className="flex items-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                          {item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1) : 'Unknown'}
                        </span>
                      </div>

                      {/* Total Amount */}
                      <div className="flex items-center sm:justify-end">
                        <span className="sm:hidden text-xs text-[var(--text-muted)] mr-2">Total:</span>
                        <span className="text-sm font-medium text-[var(--text-primary)]">
                          {fmtCurrency(item.total || item.totalAmount)} FCFA
                        </span>
                      </div>

                      {/* Date */}
                      <div className="flex items-center sm:justify-end">
                        <span className="sm:hidden text-xs text-[var(--text-muted)] mr-2">Date:</span>
                        <span className="text-xs text-[var(--text-muted)]">
                          {item.createdAt ? new Date(item.createdAt).toLocaleDateString('fr-CM') : '---'}
                        </span>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Footer count */}
      {!loading && orders.length > 0 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-xs text-[var(--text-muted)] text-center"
        >
          Showing {orders.length} order{orders.length !== 1 ? 's' : ''}
          {activeStatus ? ` with status "${activeStatus}"` : ''}
        </motion.p>
      )}
    </div>
  );
}
