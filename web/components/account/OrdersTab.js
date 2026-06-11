"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShoppingBag, RefreshCw, Search, ChevronRight, Clock,
} from 'lucide-react';
import api from '@/services/api';
import Pagination from '@/components/common/Pagination';
import { formatVariantLabel } from '@/utils/variants';
import { useLanguage } from '@/context/LanguageContext';

const ORDER_STATUS_STYLES = {
  amber: {
    rail: 'bg-amber-500',
    badge: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400',
  },
  blue: {
    rail: 'bg-blue-500',
    badge: 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400',
  },
  emerald: {
    rail: 'bg-emerald-500',
    badge: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400',
  },
  rose: {
    rail: 'bg-rose-500',
    badge: 'bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400',
  },
};

const STATUS_FILTERS = [
  { id: 'all', labelKey: 'status.all' },
  { id: 'placed', labelKey: 'status.placed' },
  { id: 'processing', labelKey: 'status.processing' },
  { id: 'shipped', labelKey: 'status.shipped' },
  { id: 'completed', labelKey: 'status.completed' },
  { id: 'failed', labelKey: 'status.failed' },
  { id: 'cancelled', labelKey: 'status.cancelled' },
  { id: 'refunded', labelKey: 'status.refunded' },
];

function getStatusColor(status) {
  switch (status) {
    case 'completed':
    case 'delivered':
    case 'refunded':
      return 'emerald';
    case 'shipped':
      return 'blue';
    case 'cancelled':
      return 'rose';
    default:
      return 'amber';
  }
}

function matchesStatusFilter(order, filter) {
  if (filter === 'all') return true;
  if (filter === 'completed') {
    return ['completed', 'delivered'].includes(order.order_status);
  }
  if (filter === 'failed') return order.payment_status === 'failed';
  if (filter === 'cancelled') return order.order_status === 'cancelled';
  if (filter === 'refunded') return order.order_status === 'refunded' || order.payment_status === 'refunded';
  return order.order_status === filter;
}

function getDisplayStatus(order, t) {
  if (order.payment_status === 'refunded' || order.order_status === 'refunded') {
    return t('status.refundedToWallet');
  }
  if (order.order_status === 'refund_pending') {
    return t('status.refundPending');
  }
  if (order.order_status === 'cancelled') {
    return t('status.cancelled');
  }
  if (
    order.shipment &&
    ['assigned', 'picked_up', 'in_transit', 'out_for_delivery'].includes(order.shipment.status)
  ) {
    return order.shipment.status.replace('_', ' ');
  }
  return t(`status.${order.order_status || 'pending'}`, order.order_status || t('status.pending'));
}

function getPaymentMeta(order, t) {
  if (order.payment_status === 'refunded' || order.order_status === 'refunded') {
    return {
      label: t('status.walletCredited'),
      classes: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    };
  }
  if (order.order_status === 'refund_pending') {
    return {
      label: t('status.refundPending'),
      classes: 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400',
    };
  }
  if (order.payment_method === 'pay_on_delivery') {
    return {
      label: t('status.payOnDelivery'),
      classes: 'border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400',
    };
  }
  if (order.payment_status === 'paid') {
    return {
      label: t('status.paid'),
      classes: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    };
  }
  if (order.payment_status === 'failed') {
    return {
      label: t('status.failed'),
      classes: 'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400',
    };
  }
  return {
    label: t('status.pending'),
    classes: 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  };
}

function MetricItem({ label, value }) {
  return (
    <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 px-2 py-2.5">
      <span className="text-[10px] font-medium text-[var(--text-secondary)]">{label}</span>
      <span className="text-[12px] font-semibold">{value}</span>
    </div>
  );
}

export default function OrdersTab({ user, onViewOrder }) {
  const { t } = useLanguage();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [orderView, setOrderView] = useState(user?.role === 'vendor' ? 'purchases' : 'purchases');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const endpoint = orderView === 'sales' ? '/orders/vendor-orders' : '/orders/my-orders';
      const res = await api.get(endpoint);
      if (res.data.success) {
        const sorted = (res.data.data.orders || []).sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );
        setOrders(sorted);
      }
    } catch (err) {
      console.error('Orders fetch failed', err);
    } finally {
      setLoading(false);
    }
  }, [user, orderView]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    setCurrentPage(1);
  }, [orderView, statusFilter, search]);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return orders.filter((order) => {
      if (!matchesStatusFilter(order, statusFilter)) return false;
      if (!query) return true;
      const firstItem = order.products?.[0] || order.items?.[0];
      const title = (firstItem?.name || firstItem?.product?.name || '').toLowerCase();
      const variant = formatVariantLabel(firstItem?.variant).toLowerCase();
      return order._id.toLowerCase().includes(query) || title.includes(query) || variant.includes(query);
    });
  }, [orders, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / itemsPerPage));
  const pageOrders = filteredOrders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const activeCount = orders.filter(
    (o) => o.payment_status !== 'failed' && !['completed', 'delivered', 'cancelled', 'refunded', 'refund_pending'].includes(o.order_status)
  ).length;
  const completedCount = orders.filter((o) =>
    ['completed', 'delivered'].includes(o.order_status)
  ).length;
  const issueCount = orders.filter((o) =>
    o.payment_status === 'failed' || ['cancelled', 'refunded', 'refund_pending'].includes(o.order_status)
  ).length;

  return (
    <div className="space-y-4 font-[Poppins]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">{t('orders.title')}</h2>
          <p className="text-[11px] text-[var(--text-secondary)]">
            {user?.role === 'vendor'
              ? t('orders.vendorHelp')
              : t('orders.customerHelp')}
          </p>
        </div>
        <button
          type="button"
          onClick={fetchOrders}
          className="inline-flex h-9 items-center justify-center gap-2 self-start rounded-lg border border-[var(--glass-border)] bg-[var(--bg-secondary)]/50 px-3 text-[11px] font-medium text-[var(--text-secondary)] transition hover:text-[var(--accent)] sm:self-auto"
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          {t('orders.refresh')}
        </button>
      </div>

      {user?.role === 'vendor' && (
        <div className="inline-flex w-full gap-1 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-secondary)]/45 p-1 sm:w-auto">
          <button
            type="button"
            onClick={() => setOrderView('purchases')}
            className={`flex-1 rounded-md px-3 py-2 text-[11px] font-semibold transition sm:flex-initial ${
              orderView === 'purchases'
                ? 'bg-[var(--accent)] text-white shadow-sm'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            {t('orders.myPurchases')}
          </button>
          <button
            type="button"
            onClick={() => setOrderView('sales')}
            className={`flex-1 rounded-md px-3 py-2 text-[11px] font-semibold transition sm:flex-initial ${
              orderView === 'sales'
                ? 'bg-[var(--accent)] text-white shadow-sm'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            {t('orders.mySales')}
          </button>
        </div>
      )}

      <div className="flex w-full items-center divide-x divide-[var(--glass-border)] overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)]">
        <MetricItem label={t('orders.total')} value={orders.length} />
        <MetricItem label={t('orders.active')} value={activeCount} />
        <MetricItem label={t('orders.completed')} value={completedCount} />
        <MetricItem label={t('orders.issues')} value={issueCount} />
      </div>

      <section className="overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] shadow-sm">
        <div className="space-y-3 border-b border-[var(--glass-border)] p-3 sm:p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--text-secondary)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('search.ordersPlaceholder')}
              className="h-10 w-full rounded-lg border border-[var(--glass-border)] bg-[var(--bg-secondary)]/50 pl-9 pr-3 text-[12px] outline-none transition focus:border-[var(--accent)]/45"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-medium transition ${
                  statusFilter === f.id
                    ? 'bg-[var(--accent)] text-white'
                    : 'border border-[var(--glass-border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                }`}
              >
                {t(f.labelKey)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-b border-[var(--glass-border)] px-3 py-2 sm:px-4">
          <p className="text-[12px] font-semibold text-[var(--text-primary)]">{t('orders.history')}</p>
          <span className="rounded-full bg-[var(--bg-secondary)] px-2 py-1 text-[10px] font-medium text-[var(--text-secondary)]">
            {t('orders.shown', undefined, { count: filteredOrders.length })}
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <div className="size-9 animate-spin rounded-full border-2 border-[var(--accent)]/20 border-t-[var(--accent)]" />
            <p className="text-[11px] text-[var(--text-secondary)]">{t('orders.loading')}</p>
          </div>
        ) : pageOrders.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <ShoppingBag className="mx-auto mb-3 size-8 text-[var(--text-secondary)]/40" />
            <p className="text-sm font-medium text-[var(--text-secondary)]">{t('orders.none')}</p>
          </div>
        ) : (
          <div className="space-y-2 p-3 sm:space-y-2.5 sm:p-4">
            {pageOrders.map((order) => {
              const firstItem = order.products?.[0] || order.items?.[0];
              const imageUrl =
                firstItem?.image ||
                firstItem?.product?.image ||
                (Array.isArray(firstItem?.product?.images)
                  ? firstItem.product.images[0]
                  : firstItem?.product?.images) ||
                '/logo-white-main.png';
              const title =
                firstItem?.name ||
                firstItem?.product?.name ||
                `Order #${order._id.slice(-8).toUpperCase()}`;
              const variantLabel = formatVariantLabel(firstItem?.variant);
              const sColor = getStatusColor(order.order_status);
              const statusStyle = ORDER_STATUS_STYLES[sColor] || ORDER_STATUS_STYLES.amber;
              const paymentMeta = getPaymentMeta(order, t);

              return (
                <button
                  key={order._id}
                  type="button"
                  onClick={() => onViewOrder(order._id)}
                  className="group relative w-full overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] text-left transition hover:border-[var(--accent)]/35"
                >
                  <div
                    className={`absolute left-0 top-0 h-full w-1 ${statusStyle.rail} opacity-50 group-hover:opacity-100`}
                  />

                  <div className="flex flex-col gap-3 p-3.5 pl-4 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                    <div className="flex min-w-0 items-start gap-3 sm:items-center">
                      <div className="size-12 shrink-0 overflow-hidden rounded-lg border border-[var(--glass-border)] bg-[var(--bg-secondary)] sm:size-14">
                        <img
                          src={imageUrl}
                          alt=""
                          className="size-full object-cover transition duration-300 group-hover:scale-105"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${statusStyle.badge}`}
                          >
                            {getDisplayStatus(order, t)}
                          </span>
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${paymentMeta.classes}`}
                          >
                            {paymentMeta.label}
                          </span>
                        </div>
                        <h4 className="mt-1 line-clamp-2 text-[12px] font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] sm:line-clamp-1">
                          {title}
                        </h4>
                        {variantLabel && (
                          <p className="mt-0.5 truncate text-[10px] font-semibold text-[var(--accent)]/80">
                            {variantLabel}
                          </p>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-[var(--text-secondary)]">
                          <span>#{order._id.slice(-8).toUpperCase()}</span>
                          <span className="hidden sm:inline">•</span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="size-3" />
                            {new Date(order.createdAt).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-[var(--glass-border)] pt-2.5 sm:border-t-0 sm:pt-0 sm:pl-2">
                      <div className="sm:text-right">
                        <p className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">
                          {(order.total_amount || 0).toLocaleString()}{' '}
                          <span className="text-[10px] font-medium text-[var(--text-secondary)]">XAF</span>
                        </p>
                        <p className="text-[10px] text-[var(--text-secondary)]">
                          {(order.products?.length || order.items?.length || 1)}{' '}
                          {(order.products?.length || order.items?.length || 1) > 1 ? t('orders.items') : t('orders.item')}
                        </p>
                      </div>
                      <div className="ml-3 flex size-8 items-center justify-center rounded-lg border border-[var(--glass-border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] transition group-hover:text-[var(--accent)]">
                        <ChevronRight className="size-4" />
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {!loading && filteredOrders.length > 0 && (
          <div className="border-t border-[var(--glass-border)] px-3 py-3 sm:px-4">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </section>
    </div>
  );
}
