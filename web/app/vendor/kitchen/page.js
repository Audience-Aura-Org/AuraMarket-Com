"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Utensils, Clock, RefreshCw, Bell, Eye, Settings, Save, X, CalendarDays } from 'lucide-react';

const PREP_UNITS = [
  { value: 'minutes', label: 'Mins',  factor: 1     },
  { value: 'hours',   label: 'Hours', factor: 60    },
  { value: 'days',    label: 'Days',  factor: 1440  },
  { value: 'weeks',   label: 'Weeks', factor: 10080 },
];

function minutesToDisplay(mins) {
  if (!mins) return { value: '', unit: 'minutes' };
  if (mins % 10080 === 0) return { value: String(mins / 10080), unit: 'weeks' };
  if (mins % 1440  === 0) return { value: String(mins / 1440),  unit: 'days'  };
  if (mins % 60    === 0) return { value: String(mins / 60),    unit: 'hours' };
  return { value: String(mins), unit: 'minutes' };
}

const DAYS = [
  { idx: 1, label: 'Mon' }, { idx: 2, label: 'Tue' }, { idx: 3, label: 'Wed' },
  { idx: 4, label: 'Thu' }, { idx: 5, label: 'Fri' }, { idx: 6, label: 'Sat' },
  { idx: 0, label: 'Sun' },
];

const DEFAULT_HOURS = [0,1,2,3,4,5,6].map(d => ({ day: d, opens: '08:00', closes: '22:00', is_closed: false }));
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/services/api';
import socketService from '@/services/socket';
import { useAuthStore } from '@/hooks/useAuth';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

const FOOD_STATUS_CONFIG = {
  pending_acceptance: {
    label:  'New',
    color:  'text-purple-600',
    bg:     'bg-purple-500/10',
    border: 'border-purple-500/30',
    dot:    'bg-purple-500',
  },
  preparing: {
    label:  'Preparing',
    color:  'text-amber-600',
    bg:     'bg-amber-500/10',
    border: 'border-amber-500/30',
    dot:    'bg-amber-500',
  },
  ready: {
    label:  'Ready',
    color:  'text-emerald-600',
    bg:     'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    dot:    'bg-emerald-500',
  },
  picked_up: {
    label:  'Picked Up',
    color:  'text-blue-600',
    bg:     'bg-blue-500/10',
    border: 'border-blue-500/30',
    dot:    'bg-blue-500',
  },
};

const LOGISTICS_OVERRIDE_MS = 10 * 60_000; // 10 minutes

function getReadyElapsedMs(order) {
  if (order.food_status !== 'ready') return null;
  const log = [...(order.status_logs || [])].reverse().find(l => l.status === 'ready');
  if (!log) return null;
  return Date.now() - new Date(log.timestamp).getTime();
}

function isLogisticsTimedOut(order) {
  if (order.shipping_method !== 'logistics_partner') return false;
  const elapsed = getReadyElapsedMs(order);
  return elapsed !== null && elapsed >= LOGISTICS_OVERRIDE_MS;
}

function getNextFoodStatus(order) {
  const vm = order.shipping_method === 'vendor_managed';
  const timedOut = isLogisticsTimedOut(order);
  return ({
    pending_acceptance: 'preparing',
    preparing:          'ready',
    ready:              (vm || timedOut) ? 'picked_up' : null,
    // Once vendor overrides a logistics order and marks picked_up, they finish delivery too
    picked_up:          (vm || order.shipping_method === 'logistics_partner') ? 'delivered' : null,
  })[order.food_status] ?? null;
}

function getActionLabel(order) {
  if (order.food_status === 'pending_acceptance') return 'Accept & Start Cooking';
  if (order.food_status === 'preparing')          return 'Mark Ready for Pickup';
  if (order.food_status === 'ready' && order.shipping_method === 'vendor_managed') return 'Rider Picked Up';
  if (order.food_status === 'ready' && isLogisticsTimedOut(order))                 return 'No Rider — Take Over';
  if (order.food_status === 'picked_up') return 'Mark as Delivered';
  return null;
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

function OrderCard({ order, onAction, onDecline, updating }) {
  const cfg = FOOD_STATUS_CONFIG[order.food_status] || FOOD_STATUS_CONFIG.pending_acceptance;
  const nextStatus  = getNextFoodStatus(order);
  const actionLabel = getActionLabel(order);
  const isNew = order.food_status === 'pending_acceptance';
  const isVendorManaged = order.shipping_method === 'vendor_managed';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`rounded-2xl border ${cfg.border} ${
        isNew ? 'shadow-lg shadow-purple-500/10 ring-1 ring-purple-500/20' : ''
      } bg-[var(--bg-primary)] overflow-hidden`}
    >
      {/* Status header */}
      <div className={`flex items-center justify-between px-4 py-3 ${cfg.bg}`}>
        <div className="flex items-center gap-2">
          <div className={`size-1.5 rounded-full ${cfg.dot} ${isNew ? 'animate-pulse' : ''}`} />
          <span className={`text-[11px] font-bold uppercase tracking-wider ${cfg.color} font-[Poppins]`}>
            {cfg.label}
          </span>
          {isNew && (
            <span className="rounded-full bg-purple-500 text-white text-[9px] font-bold px-1.5 py-0.5">
              NEW
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="size-3 text-[var(--text-secondary)] opacity-50" />
          <span className="text-[10px] text-[var(--text-secondary)]">{timeAgo(order.createdAt)}</span>
        </div>
      </div>

      {/* Order body */}
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-bold text-[var(--text-primary)] font-[Poppins]">
              Order #{order._id.slice(-8).toUpperCase()}
            </p>
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
              {order.customer_id?.name || 'Customer'}
              {' · '}
              {order.shipping_address?.quartier || order.shipping_address?.city || 'Unknown area'}
            </p>
            <span className={`mt-1 inline-block text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
              isVendorManaged
                ? 'bg-orange-500/10 text-orange-600'
                : 'bg-blue-500/10 text-blue-600'
            }`}>
              {isVendorManaged ? 'Your Rider' : 'Partner Logistics'}
            </span>
          </div>
          <p className="text-[14px] font-bold text-[var(--text-primary)] shrink-0">
            {order.total_amount?.toLocaleString()}{' '}
            <span className="text-[10px] font-normal text-[var(--text-secondary)]">XAF</span>
          </p>
        </div>

        {/* Items list */}
        <div className="mt-3 space-y-1.5">
          {(order.products || []).map((item, i) => (
            <div key={i} className="flex items-start gap-2 text-[11px]">
              <span className="rounded-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] size-5 flex items-center justify-center text-[10px] font-bold text-[var(--text-secondary)] shrink-0">
                {item.quantity}
              </span>
              <div className="min-w-0">
                <p className="font-medium text-[var(--text-primary)] truncate">{item.name}</p>
                {item.selected_options?.length > 0 && (
                  <p className="text-[var(--text-secondary)] truncate">
                    {item.selected_options.map(o => o.option_label).join(', ')}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Special instructions */}
        {order.special_instructions && (
          <p className="mt-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 px-2.5 py-2 text-[11px] text-amber-700 dark:text-amber-400 italic">
            Note: {order.special_instructions}
          </p>
        )}
      </div>

      {/* Action area */}
      {nextStatus ? (
        <div className={`border-t border-[var(--glass-border)] px-4 py-3 ${isNew ? 'flex gap-2' : ''}`}>
          {/* Decline button — only shown for new (pending_acceptance) orders */}
          {isNew && (
            <button
              onClick={() => onDecline(order._id)}
              disabled={updating === order._id}
              className="flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-3 text-[11px] font-bold text-rose-600 dark:text-rose-400 transition-all active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
              title="Decline order"
            >
              <X className="size-3.5" />
              Decline
            </button>
          )}
          <button
            onClick={() => onAction(order._id, nextStatus)}
            disabled={updating === order._id}
            className={`rounded-xl py-3 text-[12px] font-bold font-[Poppins] transition-all active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed ${isNew ? 'flex-1' : 'w-full'} ${
              isNew
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25'
                : order.food_status === 'picked_up'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                  : isLogisticsTimedOut(order)
                    ? 'bg-amber-500 text-white shadow-md shadow-amber-500/25'
                    : 'bg-orange-500 text-white shadow-md shadow-orange-500/25'
            }`}
          >
            {updating === order._id ? 'Updating...' : actionLabel}
          </button>
        </div>
      ) : order.food_status === 'ready' ? (
        <div className="border-t border-[var(--glass-border)] px-4 py-2.5">
          <p className="text-[10px] text-blue-500 font-semibold text-center">
            {(() => {
              const elapsed = getReadyElapsedMs(order);
              if (elapsed === null) return 'Awaiting logistics rider...';
              const remaining = Math.max(0, Math.ceil((LOGISTICS_OVERRIDE_MS - elapsed) / 60_000));
              return remaining > 0
                ? `Awaiting logistics rider — override in ${remaining}m`
                : 'Awaiting logistics rider...';
            })()}
          </p>
        </div>
      ) : null}
    </motion.div>
  );
}

export default function KitchenDashboardPage() {
  const router = useRouter();
  const user = useAuthStore(s => s.user);
  const hasHydrated = useAuthStore(s => s.hasHydrated);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [alertEnabled, setAlertEnabled] = useState(false);
  const [vendorId, setVendorId] = useState(null);
  const audioRef = useRef(null);
  const prevNewCountRef = useRef(0);
  // Track pending_acceptance order IDs so we can detect customer cancellations
  const prevPendingIdsRef = useRef(new Set());

  // Store-level prep time
  const [prepTimeValue, setPrepTimeValue] = useState('');
  const [prepTimeUnit, setPrepTimeUnit] = useState('minutes');
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Opening hours
  const [hours, setHours] = useState(DEFAULT_HOURS);
  const [hoursSaving, setHoursSaving] = useState(false);
  const [hoursOpen, setHoursOpen] = useState(false);

  // Accepting orders toggle
  const [isAccepting, setIsAccepting] = useState(true);
  const [acceptingToggling, setAcceptingToggling] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await api.get('/vendors/orders', { skipClientCache: true });
      if (res.data.success) {
        const allOrders = res.data.data.orders || [];
        const foodOrders = allOrders.filter(o =>
          o.food_status &&
          ['pending_acceptance', 'preparing', 'ready', 'picked_up'].includes(o.food_status)
        );

        // Sound alert when new orders arrive
        const pendingOrders = foodOrders.filter(o => o.food_status === 'pending_acceptance');
        const newCount = pendingOrders.length;
        if (newCount > prevNewCountRef.current) {
          if (alertEnabled && audioRef.current) {
            audioRef.current.play().catch(() => {});
          }
          if (prevNewCountRef.current > 0 || newCount > 0) {
            toast('New order received!', { icon: '🔔' });
          }
        }

        // Detect orders that disappeared from the pending queue due to cancellation.
        // Only fires after the initial load (prevPendingIdsRef has entries).
        // IMPORTANT: must check against ALL active food orders, not just pending ones —
        // an accepted order moves to 'preparing' and leaves pendingOrders but is NOT cancelled.
        if (prevPendingIdsRef.current.size > 0) {
          const currentAllActiveIds = new Set(foodOrders.map(o => o._id));
          for (const id of prevPendingIdsRef.current) {
            if (!currentAllActiveIds.has(id)) {
              // Order is completely gone from the kanban — cancelled or timed out
              const shortId = id.slice(-6).toUpperCase();
              toast(`Order #${shortId} was cancelled`, { icon: '⚠️' });
            }
          }
        }
        prevPendingIdsRef.current = new Set(pendingOrders.map(o => o._id));

        prevNewCountRef.current = newCount;
        setOrders(foodOrders);
      }
    } catch (err) {
      if (err.response?.status === 404) router.push('/onboarding');
    } finally {
      setLoading(false);
    }
  }, [router, alertEnabled]);

  useEffect(() => {
    if (!user || user.role !== 'vendor') return;
    fetchOrders();
    api.get('/vendors/me').then(res => {
      if (res.data?.data?.vendor?._id) setVendorId(res.data.data.vendor._id);
    }).catch(() => {});
    api.get('/restaurant/profile').then(res => {
      const profile = res.data?.data?.profile;
      if (profile?.prep_time_minutes) {
        const { value, unit } = minutesToDisplay(profile.prep_time_minutes);
        setPrepTimeValue(value);
        setPrepTimeUnit(unit);
      }
      if (profile?.opening_hours?.length) {
        setHours(profile.opening_hours);
      }
      if (profile?.is_accepting_orders !== undefined) {
        setIsAccepting(profile.is_accepting_orders);
      }
    }).catch(() => {});
  }, [fetchOrders, user]);

  const handleSaveSettings = async () => {
    if (!prepTimeValue || Number(prepTimeValue) <= 0) return toast.error('Enter a valid prep time.');
    const factor = PREP_UNITS.find(u => u.value === prepTimeUnit)?.factor ?? 1;
    const mins = Number(prepTimeValue) * factor;
    setSettingsSaving(true);
    try {
      await api.patch('/restaurant/profile', { prep_time_minutes: mins });
      toast.success('Store prep time updated');
      setSettingsOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save settings');
    } finally {
      setSettingsSaving(false);
    }
  };

  const updateHourRow = (dayIdx, field, value) => {
    setHours(prev => prev.map(h => h.day === dayIdx ? { ...h, [field]: value } : h));
  };

  const handleSaveHours = async () => {
    setHoursSaving(true);
    try {
      await api.patch('/restaurant/profile', { opening_hours: hours });
      toast.success('Opening hours saved');
      setHoursOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save opening hours');
    } finally {
      setHoursSaving(false);
    }
  };

  const handleToggleAccepting = async () => {
    setAcceptingToggling(true);
    const next = !isAccepting;
    try {
      await api.patch('/restaurant/profile', { is_accepting_orders: next });
      setIsAccepting(next);
      toast.success(next ? 'Now accepting orders' : 'Orders paused');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update status');
    } finally {
      setAcceptingToggling(false);
    }
  };

  // Socket: real-time order updates
  useEffect(() => {
    const handleUpdate = () => fetchOrders();
    socketService.on('order_update', handleUpdate);
    socketService.on('notification', handleUpdate);
    return () => {
      socketService.off('order_update', handleUpdate);
      socketService.off('notification', handleUpdate);
    };
  }, [fetchOrders]);

  // Poll every 30s as socket fallback
  useEffect(() => {
    if (!user || user.role !== 'vendor') return;
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, [fetchOrders, user]);

  const handleAction = async (orderId, newStatus) => {
    setUpdating(orderId);
    try {
      const res = await api.patch(`/orders/${orderId}/food-status`, { food_status: newStatus });
      if (res.data.success) {
        const toastMessages = {
          preparing: 'Order accepted — cooking!',
          ready:     'Order marked ready for pickup',
          picked_up: 'Rider dispatched — order in transit',
          delivered: 'Order delivered!',
        };
        toast.success(toastMessages[newStatus] || 'Status updated');
        await fetchOrders();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update order status');
    } finally {
      setUpdating(null);
    }
  };

  const handleDecline = async (orderId) => {
    if (!window.confirm('Decline this order? The customer will be notified and any payment refunded.')) return;
    setUpdating(orderId);
    try {
      await api.patch(`/orders/${orderId}/food-status`, { food_status: 'rejected' });
      toast.success('Order declined — customer notified');
      await fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not decline order');
    } finally {
      setUpdating(null);
    }
  };

  if (!hasHydrated || !user || user.role !== 'vendor') return null;

  const newOrders      = orders.filter(o => o.food_status === 'pending_acceptance');
  const cookingOrders  = orders.filter(o => o.food_status === 'preparing');
  const readyOrders    = orders.filter(o => o.food_status === 'ready');
  const pickedUpOrders = orders.filter(o => o.food_status === 'picked_up');

  const columns = [
    {
      key:    'new',
      label:  'New',
      count:  newOrders.length,
      color:  'text-purple-600',
      dot:    'bg-purple-500',
      pulse:  true,
      orders: newOrders,
      empty:  'Waiting for orders...',
    },
    {
      key:    'cooking',
      label:  'Cooking',
      count:  cookingOrders.length,
      color:  'text-amber-600',
      dot:    'bg-amber-500',
      pulse:  false,
      orders: cookingOrders,
      empty:  'No orders cooking yet',
    },
    {
      key:    'ready',
      label:  'Ready',
      count:  readyOrders.length,
      color:  'text-emerald-600',
      dot:    'bg-emerald-500',
      pulse:  false,
      orders: readyOrders,
      empty:  'No orders ready yet',
    },
    {
      key:    'transit',
      label:  'In Transit',
      count:  pickedUpOrders.length,
      color:  'text-blue-600',
      dot:    'bg-blue-500',
      pulse:  false,
      orders: pickedUpOrders,
      empty:  'No orders in transit',
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--bg-primary)]">
      {/* Hidden audio for new order alert */}
      <audio ref={audioRef} src="/sounds/order-alert.mp3" preload="none" />

      {/* Header */}
      <header className="relative sticky top-0 md:top-16 lg:top-0 z-40 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-2xl">
        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-orange-500/40 to-transparent" />
        <div className="mx-auto max-w-[1400px] px-4 py-3 sm:px-5 md:px-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-600/10 flex items-center justify-center text-orange-500 border border-orange-500/20 shrink-0">
                <Utensils className="size-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[var(--text-primary)] font-[Poppins]">
                  Kitchen
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  {newOrders.length > 0 ? (
                    <span className="flex items-center gap-1">
                      <span className="size-1.5 rounded-full bg-purple-500 animate-pulse" />
                      <p className="text-[10px] font-semibold text-purple-600 font-[Poppins]">
                        {newOrders.length} new order{newOrders.length > 1 ? 's' : ''}
                      </p>
                    </span>
                  ) : (
                    <p className="text-[10px] text-[var(--text-secondary)] opacity-50 font-[Poppins]">
                      Live order queue
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {vendorId && (
                <Link
                  href={`/dine/restaurant/${vendorId}`}
                  className="flex items-center gap-1.5 rounded-xl border border-[var(--glass-border)] px-3 py-2 text-[11px] font-semibold text-[var(--text-secondary)] hover:text-orange-500 hover:border-orange-500/30 transition-all font-[Poppins]"
                >
                  <Eye className="size-3.5" />
                  View restaurant
                </Link>
              )}
              {/* Accept orders toggle — most important control, shown prominently */}
              <button
                onClick={handleToggleAccepting}
                disabled={acceptingToggling}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-bold transition-all font-[Poppins] disabled:opacity-60 ${
                  isAccepting
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600'
                    : 'border-rose-500/50 bg-rose-500/10 text-rose-600'
                }`}
                title={isAccepting ? 'Click to pause orders' : 'Click to accept orders'}
              >
                <span className={`size-1.5 rounded-full shrink-0 ${isAccepting ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                {acceptingToggling ? '...' : isAccepting ? 'Open' : 'Paused'}
              </button>
              <button
                onClick={() => setAlertEnabled(v => !v)}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-semibold transition-all font-[Poppins] ${
                  alertEnabled
                    ? 'border-orange-500/50 bg-orange-500/10 text-orange-600'
                    : 'border-[var(--glass-border)] text-[var(--text-secondary)]'
                }`}
              >
                <Bell className="size-3.5" />
                {alertEnabled ? 'Alert On' : 'Alert Off'}
              </button>
              <button
                onClick={fetchOrders}
                className="size-9 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/50 text-[var(--text-secondary)] flex items-center justify-center hover:text-orange-500 hover:border-orange-500/30 active:scale-95 transition-all"
              >
                <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Store Settings */}
      <div className="mx-auto w-full max-w-[1400px] px-4 pt-4 sm:px-6 md:px-8 space-y-3">
        {/* Prep time */}
        <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/60 overflow-hidden">
          <button
            type="button"
            onClick={() => setSettingsOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[var(--bg-secondary)]/40 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Settings className="size-4 text-orange-500" />
              <span className="text-[12px] font-bold font-[Poppins] text-[var(--text-primary)]">Store Prep Time</span>
              {prepTimeValue && (
                <span className="text-[11px] text-[var(--text-secondary)]">
                  — <span className="text-orange-500 font-semibold">{prepTimeValue} {PREP_UNITS.find(u => u.value === prepTimeUnit)?.label}</span> default
                </span>
              )}
            </div>
            <Clock className={`size-3.5 text-[var(--text-secondary)] transition-transform ${settingsOpen ? 'rotate-180' : ''}`} />
          </button>

          {settingsOpen && (
            <div className="px-4 pb-4 pt-1 border-t border-[var(--glass-border)] space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <p className="text-[10px] text-[var(--text-secondary)] opacity-70 leading-relaxed">
                Default kitchen-to-ready time for your store. Meals with their own prep time will override this.
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="number"
                  min="1"
                  value={prepTimeValue}
                  onChange={e => setPrepTimeValue(e.target.value)}
                  placeholder="e.g. 20"
                  className="w-24 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl px-3 py-2.5 text-[12px] font-medium outline-none focus:ring-2 focus:ring-orange-500/30 transition-all"
                />
                <div className="flex gap-1.5 flex-wrap">
                  {PREP_UNITS.map(u => (
                    <button
                      key={u.value}
                      type="button"
                      onClick={() => setPrepTimeUnit(u.value)}
                      className={`px-3 py-2.5 rounded-xl text-[11px] font-bold font-[Poppins] transition-all active:scale-95 ${
                        prepTimeUnit === u.value
                          ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/30'
                          : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--glass-border)] hover:border-orange-500/30'
                      }`}
                    >
                      {u.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={settingsSaving}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-orange-500 text-white text-[11px] font-bold font-[Poppins] shadow-sm shadow-orange-500/30 hover:brightness-105 active:scale-95 transition-all disabled:opacity-60"
                >
                  <Save className="size-3.5" />
                  {settingsSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Opening Hours */}
        <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/60 overflow-hidden">
          <button
            type="button"
            onClick={() => setHoursOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[var(--bg-secondary)]/40 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <CalendarDays className="size-4 text-orange-500" />
              <span className="text-[12px] font-bold font-[Poppins] text-[var(--text-primary)]">Opening Hours</span>
            </div>
            <Clock className={`size-3.5 text-[var(--text-secondary)] transition-transform ${hoursOpen ? 'rotate-180' : ''}`} />
          </button>

          {hoursOpen && (
            <div className="px-4 pb-4 pt-2 border-t border-[var(--glass-border)] animate-in fade-in slide-in-from-top-2 duration-200">
              <p className="text-[10px] text-[var(--text-secondary)] opacity-70 mb-3 leading-relaxed">
                Set your daily open and close times. Customers cannot place orders outside these hours.
              </p>
              <div className="space-y-2">
                {DAYS.map(({ idx, label }) => {
                  const row = hours.find(h => h.day === idx) || { day: idx, opens: '08:00', closes: '22:00', is_closed: false };
                  return (
                    <div key={idx} className={`flex items-center gap-2 transition-opacity ${row.is_closed ? 'opacity-40' : ''}`}>
                      <span className="w-8 text-[11px] font-bold text-[var(--text-secondary)] font-[Poppins] shrink-0">{label}</span>
                      <input
                        type="time"
                        value={row.opens}
                        disabled={row.is_closed}
                        onChange={e => updateHourRow(idx, 'opens', e.target.value)}
                        className="flex-1 min-w-0 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl px-2 py-1.5 text-[11px] outline-none focus:ring-2 focus:ring-orange-500/30 transition-all disabled:cursor-not-allowed"
                      />
                      <span className="text-[10px] text-[var(--text-secondary)] shrink-0">—</span>
                      <input
                        type="time"
                        value={row.closes}
                        disabled={row.is_closed}
                        onChange={e => updateHourRow(idx, 'closes', e.target.value)}
                        className="flex-1 min-w-0 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl px-2 py-1.5 text-[11px] outline-none focus:ring-2 focus:ring-orange-500/30 transition-all disabled:cursor-not-allowed"
                      />
                      <button
                        type="button"
                        onClick={() => updateHourRow(idx, 'is_closed', !row.is_closed)}
                        className={`shrink-0 px-2.5 py-1.5 rounded-xl text-[10px] font-bold transition-all active:scale-95 ${
                          row.is_closed
                            ? 'bg-rose-500/20 text-rose-600 border border-rose-500/30'
                            : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                        }`}
                      >
                        {row.is_closed ? 'Closed' : 'Open'}
                      </button>
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={handleSaveHours}
                disabled={hoursSaving}
                className="mt-4 flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-orange-500 text-white text-[11px] font-bold font-[Poppins] shadow-sm shadow-orange-500/30 hover:brightness-105 active:scale-95 transition-all disabled:opacity-60"
              >
                <Save className="size-3.5" />
                {hoursSaving ? 'Saving...' : 'Save Hours'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Kanban board */}
      <div className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6 md:px-8 pb-32">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="size-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="size-16 rounded-2xl bg-orange-500/10 flex items-center justify-center mb-4">
              <Utensils className="size-8 text-orange-500 opacity-50" />
            </div>
            <h3 className="text-[15px] font-bold text-[var(--text-primary)] font-[Poppins] mb-1">
              No active orders
            </h3>
            <p className="text-[12px] text-[var(--text-secondary)]">
              New orders will appear here in real-time.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            {columns.map(col => (
              <div key={col.key}>
                <h3 className={`text-[11px] font-bold uppercase tracking-widest ${col.color} mb-3 flex items-center gap-2`}>
                  <span className={`size-1.5 rounded-full ${col.dot} ${col.pulse ? 'animate-pulse' : ''}`} />
                  {col.label} ({col.count})
                </h3>
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {col.orders.map(o => (
                      <OrderCard
                        key={o._id}
                        order={o}
                        onAction={handleAction}
                        onDecline={handleDecline}
                        updating={updating}
                      />
                    ))}
                  </AnimatePresence>
                  {col.orders.length === 0 && (
                    <div className="rounded-xl border border-dashed border-[var(--glass-border)] p-4 text-center text-[11px] text-[var(--text-secondary)] opacity-50">
                      {col.empty}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
