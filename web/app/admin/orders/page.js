"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import {
  Package,
  RefreshCw,
  ChevronDown,
  Database,
  ShoppingBag,
  Zap,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import api from '@/services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

import Pagination from '@/components/common/Pagination';
import {
  AdminFinancePage,
  AdminFinanceHeader,
  AdminFinanceBody,
  AdminMetricGrid,
  AdminFilterToolbar,
  AdminFilterSearch,
  AdminFilterPills,
  AdminFilterButton,
  AdminListPanel,
  AdminLedgerTableHeader,
} from '@/components/admin/AdminFinanceLayout';

const STATUS_CONFIG = {
  placed:         { label: 'Placed',      color: 'text-purple-600',  bg: 'bg-purple-500/10' },
  processing:     { label: 'Processing',  color: 'text-blue-500',    bg: 'bg-blue-500/10' },
  shipped:        { label: 'Shipped',     color: 'text-indigo-600',  bg: 'bg-indigo-500/10' },
  delivered:      { label: 'Delivered',   color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
  completed:      { label: 'Completed',   color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
  cancelled:      { label: 'Cancelled',   color: 'text-red-600',     bg: 'bg-red-500/10' },
  refund_pending: { label: 'Refund',      color: 'text-amber-600',   bg: 'bg-amber-500/10' },
  refunded:       { label: 'Refunded',    color: 'text-sky-600',     bg: 'bg-sky-500/10' },
};

const PAYMENT_STATUS = {
  pending:  { label: 'Unpaid',   color: 'text-amber-500',  bg: 'bg-amber-500/10' },
  paid:     { label: 'Paid',     color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  completed:{ label: 'Paid',     color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  failed:   { label: 'Failed',   color: 'text-rose-500',    bg: 'bg-rose-500/10' },
  refunded: { label: 'Refunded', color: 'text-sky-500',     bg: 'bg-sky-500/10' },
};

const fmt = (value) => Number(value || 0).toLocaleString();
const shortId = (value, length = 8) => String(value?._id || value || '').slice(-length).toUpperCase();
const productName = (order) => {
  const item = order?.products?.[0];
  return item?.name || item?.product_name || item?.product_id?.name || 'Order item';
};

function InfoLine({ label, value, mono = false }) {
  return (
    <div className="flex items-start justify-between gap-3 text-[11px]">
      <span className="shrink-0 text-[var(--text-secondary)]">{label}</span>
      <span className={`min-w-0 text-right font-semibold text-[var(--text-primary)] ${mono ? 'font-mono' : ''}`}>
        {value || 'Not recorded'}
      </span>
    </div>
  );
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [logisticsFirms, setLogisticsFirms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);
  const [savingOrderId, setSavingOrderId] = useState(null);
  const [orderEdits, setOrderEdits] = useState({});
  const [stats, setStats] = useState(null);
  const itemsPerPage = 10;

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const orderId = searchParams.get('orderId');
    if (orderId) setExpandedId(orderId);
  }, []);

  const fetchStats = async () => {
    try {
      const res = await api.get('/admin/analytics');
      if (res.data.success) setStats(res.data.data.stats);
    } catch (err) {
      console.error('Failed to fetch platform metrics:', err);
    }
  };

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = activeTab !== 'all' ? { status: activeTab } : {};
      const res = await api.get('/admin/orders', { params });
      if (res.data.success) setOrders(res.data.data.orders || []);
    } catch (err) {
      console.error('Failed to fetch admin orders:', err);
      toast.error(err.response?.data?.message || 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchOrders();
    fetchStats();
    setCurrentPage(1);
  }, [fetchOrders]);

  useEffect(() => {
    const fetchLogistics = async () => {
      try {
        const res = await api.get('/admin/logistics/firms');
        if (res.data.success) setLogisticsFirms(res.data.data.firms || []);
      } catch (err) {
        console.error('Failed to fetch logistics firms:', err);
      }
    };
    fetchLogistics();
  }, []);

  const setOrderEditField = (orderId, key, value) => {
    setOrderEdits((prev) => ({
      ...prev,
      [orderId]: {
        ...(prev[orderId] || {}),
        [key]: value,
      },
    }));
  };

  const saveOrderControl = async (order) => {
    const patch = orderEdits[order._id];
    if (!patch) return;
    setSavingOrderId(order._id);
    try {
      const res = await api.patch(`/admin/orders/${order._id}`, patch);
      if (res.data.success) {
        setOrders((prev) =>
          prev.map((o) => (o._id === order._id ? { ...o, ...res.data.data.order } : o))
        );
        setOrderEdits((prev) => {
          const next = { ...prev };
          delete next[order._id];
          return next;
        });
        toast.success('Order sequence updated');
      }
    } catch (err) {
      console.error('Failed to update order:', err);
      toast.error(err.response?.data?.message || 'Failed to update order');
    } finally {
      setSavingOrderId(null);
    }
  };

  const filtered = orders.filter((order) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      order._id?.toLowerCase().includes(q) ||
      order.customer_id?.name?.toLowerCase().includes(q) ||
      order.customer_id?.email?.toLowerCase().includes(q) ||
      order.vendor_id?.store_name?.toLowerCase().includes(q) ||
      order.products?.some((item) => (
        item.name || item.product_name || item.product_id?.name || ''
      ).toLowerCase().includes(q))
    );
  });

  const totalPages = Math.max(Math.ceil(filtered.length / itemsPerPage), 1);
  const currentOrders = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const tabs = ['all', 'placed', 'processing', 'shipped', 'delivered', 'failed', 'cancelled', 'refund_pending'];

  return (
    <AdminFinancePage theme="transactions">
      <AdminFinanceHeader
        theme="transactions"
        icon={Package}
        title="Order Manifest"
        description="Operational pipeline and order controls."
        badge={`${filtered.length} orders`}
        onRefresh={fetchOrders}
        loading={loading}
        embedRefreshInToolbar
      >
        <AdminFilterToolbar>
          <AdminFilterSearch
            theme="transactions"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            placeholder="Reference, customer, store, product"
          />
          <AdminFilterButton theme="transactions" onClick={fetchOrders}>
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </AdminFilterButton>
        </AdminFilterToolbar>
        <AdminFilterPills
          theme="transactions"
          values={tabs}
          activeValue={activeTab}
          onChange={(tab) => {
            setActiveTab(tab);
            setExpandedId(null);
            setCurrentPage(1);
          }}
        />
      </AdminFinanceHeader>

      <AdminFinanceBody>
        <AdminMetricGrid
          theme="transactions"
          metrics={[
            { label: 'Active', value: stats ? stats.active_orders : '...', hint: 'in progress' },
            { label: 'Attention', value: orders.filter(o => o.order_status === 'refund_pending' || o.payment_status === 'failed').length, hint: 'needs review' },
            { label: 'Resolved', value: stats ? stats.delivered_orders || '0' : '...', hint: 'cycle complete' },
            { label: 'Closed', value: stats ? stats.orders : '...', hint: 'archive total' },
          ]}
        />

        <AdminListPanel
          theme="transactions"
          variant="ledger"
          title="Order ledger"
          countLabel={
            <>
              <span className="sm:hidden">Pg {currentPage}</span>
              <span className="hidden sm:inline">Page {currentPage} · {itemsPerPage} per page</span>
            </>
          }
          loading={loading}
          loadingMessage="Loading order ledger..."
          isEmpty={!currentOrders.length}
          emptyIcon={Database}
          emptyMessage="No operational manifests detected in this node."
          listHeader={<AdminLedgerTableHeader columns={['Order', 'Amount & date', 'Status', '']} />}
          footer={
            totalPages > 1 ? (
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
            ) : null
          }
        >
          {currentOrders.map((order) => {
            const isExpanded = expandedId === order._id;
            const status = STATUS_CONFIG[order.order_status] || STATUS_CONFIG.placed;
            const payment = PAYMENT_STATUS[order.payment_status] || PAYMENT_STATUS.pending;
            const customer = order.customer_id;
            const product = productName(order);

            return (
              <div
                key={order._id}
                className={`transition ${isExpanded ? 'bg-indigo-500/[0.06]' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : order._id)}
                  className="block w-full text-left transition hover:bg-indigo-500/[0.04]"
                >
                  <div className="flex items-center gap-2.5 px-2.5 py-2.5 sm:hidden">
                    <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl border border-current/10 ${status.bg} ${status.color}`}>
                      <Package className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[11px] font-semibold">{product}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${payment.bg} ${payment.color}`}>
                          {payment.label}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate font-mono text-[9px] text-indigo-600 dark:text-indigo-400">
                        #{shortId(order)}
                      </p>
                      <p className="mt-0.5 truncate text-[9px] text-[var(--text-secondary)]">
                        {customer?.name || 'Guest'} · {order.vendor_id?.store_name || 'Unknown store'}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end">
                      <span className="text-[11px] font-semibold tabular-nums">{fmt(order.total_amount)} XAF</span>
                      <span className="text-[9px] text-[var(--text-secondary)]">{new Date(order.createdAt).toLocaleDateString()}</span>
                    </div>
                    <ChevronDown className={`size-4 text-[var(--text-secondary)] transition ${isExpanded ? 'rotate-180 text-indigo-600' : ''}`} />
                  </div>

                  <div className="hidden sm:grid sm:grid-cols-[minmax(0,1fr)_120px_110px_36px] sm:items-center sm:gap-3 sm:px-4 sm:py-2.5">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl border border-current/10 ${status.bg} ${status.color}`}>
                        <Package className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[12px] font-semibold">{product}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${status.bg} ${status.color}`}>
                            {status.label}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${payment.bg} ${payment.color}`}>
                            {payment.label}
                          </span>
                        </div>
                        <p className="mt-0.5 font-mono text-[10px] text-indigo-600 dark:text-indigo-400">
                          #{shortId(order, 10)}
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-[10px] text-[var(--text-secondary)]">
                          {customer?.name || 'Guest'} · {order.vendor_id?.store_name || 'Unknown store'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-[12px] font-semibold tabular-nums text-indigo-900 dark:text-indigo-200">{fmt(order.total_amount)} XAF</p>
                      <p className="mt-0.5 text-[10px] text-[var(--text-secondary)]">{new Date(order.createdAt).toLocaleDateString()}</p>
                    </div>

                    <div className="flex items-center justify-center">
                      <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${status.bg} ${status.color}`}>
                        {status.label}
                      </span>
                    </div>

                    <div className="flex items-center justify-center">
                      <ChevronDown className={`size-4 text-[var(--text-secondary)] transition ${isExpanded ? 'rotate-180 text-indigo-600' : ''}`} />
                    </div>
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-indigo-500/15 bg-[var(--bg-primary)]/50"
                    >
                      <div className="grid gap-2.5 p-2.5 lg:grid-cols-3 sm:gap-3 sm:p-4">
                        <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/20 p-3 space-y-2">
                          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                            <Database className="size-3.5" /> Order data
                          </p>
                          <InfoLine label="Order ID" value={`#${shortId(order, 10)}`} mono />
                          <InfoLine label="Customer" value={customer?.name || 'Guest'} />
                          <InfoLine label="Email" value={customer?.email || 'No email'} />
                          <InfoLine label="Phone" value={customer?.phone || 'No phone'} />
                          <InfoLine label="Payment" value={`${payment.label} / ${order.payment_method?.replace(/_/g, ' ') || 'Not recorded'}`} />
                        </div>

                        <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/20 p-3 space-y-2">
                          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                            <ShoppingBag className="size-3.5" /> Cargo items ({order.products?.length || 0})
                          </p>
                          <div className="space-y-1.5">
                            {order.products?.map((p, idx) => (
                              <div key={idx} className="flex justify-between gap-3 rounded-lg bg-[var(--bg-primary)]/70 px-2.5 py-2 text-[11px]">
                                <span className="truncate font-semibold">{p.name || p.product_name || p.product_id?.name || 'Product'}</span>
                                <span className="shrink-0 text-indigo-600 dark:text-indigo-300">x{p.quantity || 1}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/20 p-3 space-y-3">
                          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                            <Zap className="size-3.5" /> Pipeline override
                          </p>
                          <select
                            value={orderEdits[order._id]?.order_status ?? order.order_status}
                            onChange={(e) => setOrderEditField(order._id, 'order_status', e.target.value)}
                            className="h-11 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 text-[11px] font-semibold outline-none focus:border-indigo-500"
                          >
                            {Object.keys(STATUS_CONFIG).map((s) => (
                              <option key={s} value={s}>{STATUS_CONFIG[s].label.toUpperCase()}</option>
                            ))}
                          </select>
                          <select
                            value={orderEdits[order._id]?.logistics_company_id ?? order.logistics_company_id?._id ?? order.logistics_company_id ?? ''}
                            onChange={(e) => setOrderEditField(order._id, 'logistics_company_id', e.target.value || null)}
                            className="h-11 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 text-[11px] font-semibold outline-none focus:border-indigo-500"
                          >
                            <option value="">MANUAL SHIPMENT</option>
                            {logisticsFirms.map((f) => (
                              <option key={f._id} value={f._id}>{f.company_name.toUpperCase()}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => saveOrderControl(order)}
                            disabled={savingOrderId === order._id || !orderEdits[order._id]}
                            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 text-[11px] font-semibold text-white shadow-lg shadow-indigo-500/15 transition active:scale-[0.98] disabled:opacity-50"
                          >
                            {savingOrderId === order._id ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                            Patch sequence
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </AdminListPanel>
      </AdminFinanceBody>
    </AdminFinancePage>
  );
}
