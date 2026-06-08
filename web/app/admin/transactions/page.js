'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/services/api';
import {
  CreditCard, Clock, User, RotateCcw, ChevronDown,
  Mail, Phone, Database, Loader2, Zap, Globe,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import Pagination from '@/components/common/Pagination';
import { fmt, STATUS_CONFIG, TYPE_CONFIG } from '@/utils/adminFinance';
import {
  AmountDateColumn,
  GatewayBrand,
  PartyAvatar,
  getTransactionParty,
} from '@/components/admin/FinanceRowDisplay';
import {
  AdminFinancePage,
  AdminFinanceHeader,
  AdminFinanceBody,
  AdminMetricGrid,
  AdminFilterToolbar,
  AdminFilterSearch,
  AdminFilterSelect,
  AdminFilterPills,
  AdminFilterButton,
  AdminFilterRow,
  AdminListPanel,
  AdminLedgerTableHeader,
} from '@/components/admin/AdminFinanceLayout';

const GATEWAYS = ['eversend', 'mesomb', 'wallet', 'manual', 'paystack'];
const STATUS_FILTERS = ['all', 'completed', 'pending', 'failed'];

const shortId = (value, length = 8) => String(value?._id || value || '').slice(-length).toUpperCase();

const getLinkedOrders = (tx) => {
  const orders = [];
  const seen = new Set();
  [tx.order_id, ...(tx.order_ids || [])].forEach((order) => {
    const id = String(order?._id || order || '');
    if (!id || seen.has(id)) return;
    seen.add(id);
    orders.push(order);
  });
  return orders;
};

const isObjectRecord = (value) => value && typeof value === 'object';

const firstFilled = (...values) =>
  values.find((value) => value !== undefined && value !== null && String(value).trim() !== '');

const formatGatewayId = (tx) => {
  if (tx?.gateway_transaction_id) return tx.gateway_transaction_id;
  if (tx?.gateway === 'platform') return 'Internal platform ledger';
  if (tx?.gateway === 'wallet') return 'Auradime wallet ledger';
  if (tx?.reference) return `Ref ${tx.reference}`;
  return 'Not recorded';
};

const formatTracking = (order) => {
  if (order?.tracking_number) return order.tracking_number;
  if (order?.shipping_method === 'vendor_managed') return 'Vendor managed delivery';
  if (order?.shipping_method === 'logistics' || order?.shipping_method === 'logistics_partner') return 'Awaiting logistics tracking';
  return 'Tracking not assigned';
};

const getOrderItemImage = (item) => {
  if (item?.image) return item.image;
  const image = item?.product_id?.images?.[0];
  return typeof image === 'string' ? image : image?.url;
};

const getOrderItemName = (item) =>
  firstFilled(item?.name, item?.product_id?.name, item?.product_name, `Item #${shortId(item?.product_id)}`);

const formatVariant = (variant) => {
  if (!variant) return null;
  if (typeof variant === 'string') return variant;
  if (Array.isArray(variant)) return variant.filter(Boolean).join(' / ');
  if (typeof variant === 'object') {
    return Object.entries(variant)
      .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
      .map(([key, value]) => `${key}: ${value}`)
      .join(' / ');
  }
  return String(variant);
};

const buildLogisticsInfo = (order) => {
  const logistics = order?.logistics_company_id;
  const usesLogistics = order?.shipping_method === 'logistics' || order?.shipping_method === 'logistics_partner' || logistics;

  if (!usesLogistics) {
    return {
      method: 'Vendor managed',
      partner: 'Vendor handles delivery',
      contact: null,
      tracking: formatTracking(order),
    };
  }

  return {
    method: 'Logistics partner',
    partner: isObjectRecord(logistics) ? firstFilled(logistics.company_name, `Logistics #${shortId(logistics)}`) : 'Partner not assigned',
    contact: isObjectRecord(logistics) ? firstFilled(logistics.contact_phone, logistics.contact_email) : null,
    tracking: formatTracking(order),
  };
};

const buildTransactionAccount = (tx) => {
  if (isObjectRecord(tx?.user_id)) {
    return {
      ...tx.user_id,
      name: firstFilled(tx.user_id.name, tx.user_id.email, `Account #${shortId(tx.user_id)}`),
      email: firstFilled(tx.user_id.email, 'No email on transaction'),
      phone: firstFilled(tx.user_id.phone, 'No phone on transaction'),
    };
  }

  if (tx?.gateway === 'platform') {
    return {
      name: 'Auradime Platform',
      email: 'support@auradime.com',
      phone: 'Internal ledger',
    };
  }

  return {
    name: tx?.user_id ? `Account #${shortId(tx.user_id)}` : 'System account',
    email: 'No email on transaction',
    phone: 'No phone on transaction',
  };
};

const buildCustomerPerson = (order) => {
  const customer = order?.customer_id;
  const shipping = order?.shipping_address || {};

  if (isObjectRecord(customer)) {
    return {
      ...customer,
      name: firstFilled(customer.name, shipping.full_name, shipping.name, customer.email, `Customer #${shortId(customer)}`),
      email: firstFilled(customer.email, shipping.email, 'No email on order'),
      phone: firstFilled(customer.phone, shipping.phone, 'No phone on order'),
    };
  }

  return {
    name: firstFilled(shipping.full_name, shipping.name, customer ? `Customer #${shortId(customer)}` : null, 'Order customer'),
    email: firstFilled(shipping.email, 'No email on order'),
    phone: firstFilled(shipping.phone, 'No phone on order'),
  };
};

const buildVendorPerson = (order) => {
  const vendor = order?.vendor_id;
  const vendorUser = isObjectRecord(vendor?.user_id) ? vendor.user_id : null;

  if (isObjectRecord(vendor)) {
    return {
      ...(vendorUser || {}),
      avatar: firstFilled(vendor.logo_url, vendor.logo, vendor.branding?.logo, vendorUser?.avatar),
      name: firstFilled(vendor.store_name, vendorUser?.name, `Vendor #${shortId(vendor)}`),
      email: firstFilled(vendorUser?.email, 'No vendor email on order'),
      phone: firstFilled(vendorUser?.phone, 'No vendor phone on order'),
    };
  }

  return {
    name: vendor ? `Vendor #${shortId(vendor)}` : 'Vendor store',
    email: 'No vendor email on order',
    phone: 'No vendor phone on order',
  };
};

const formatGatewayName = (gateway) => {
  const labels = {
    paystack: 'Paystack',
    eversend: 'Eversend',
    mesomb: 'MeSomb',
    wallet: 'Auradime wallet',
    manual: 'Manual admin entry',
    platform: 'Auradime platform',
    escrow: 'Escrow vault',
  };
  return labels[gateway] || gateway || 'Internal ledger';
};

const formatWalletName = (person, fallback = 'User wallet') => {
  const account = isObjectRecord(person) ? person : null;
  const name = firstFilled(account?.name, account?.email, fallback);
  const suffix = account?._id ? ` #${shortId(account, 6)}` : '';
  return `${name} wallet${suffix}`;
};

const getWithdrawalDestination = (tx) => {
  const details = tx?.gateway_response?.details || tx?.metadata?.recipientDetails || {};
  if (details.phoneNumber || details.phone) return `Mobile wallet ${details.phoneNumber || details.phone}`;
  if (details.accountNumber || details.account_number) return `Bank account ${details.accountNumber || details.account_number}`;
  if (details.eversendTag) return `Eversend tag ${details.eversendTag}`;
  if (details.beneficiaryId) return `Beneficiary ${details.beneficiaryId}`;
  const match = tx?.description?.match(/\b(?:to|via)\s+(.+)$/i);
  return match?.[1] || 'Payout account awaiting gateway details';
};

const buildMoneyRoute = (tx, linkedOrders = []) => {
  const account = buildTransactionAccount(tx);
  const primaryOrder = linkedOrders[0];
  const customer = primaryOrder ? buildCustomerPerson(primaryOrder) : null;
  const vendor = primaryOrder ? buildVendorPerson(primaryOrder) : null;
  const walletBalance = isObjectRecord(tx?.user_id) && Number.isFinite(Number(tx.user_id.wallet_balance))
    ? `${fmt(tx.user_id.wallet_balance)} ${tx.currency || 'XAF'} current balance`
    : null;
  const orderLabel = primaryOrder ? `Order #${shortId(primaryOrder)}` : 'No order linked';

  if (tx?.type === 'deposit') {
    const isCheckout = linkedOrders.length > 0;
    return {
      title: isCheckout ? 'Checkout funding route' : 'Deposit route',
      rows: [
        ['From', `${formatGatewayName(tx.gateway)} collection${tx.gateway_transaction_id ? ` (${tx.gateway_transaction_id})` : ''}`],
        ['Into', isCheckout ? `${account.name} checkout payment for ${linkedOrders.length} order(s)` : formatWalletName(tx.user_id, account.name)],
        ['Wallet', isCheckout ? 'Applied to linked order payment, not kept as wallet balance' : walletBalance],
      ],
    };
  }

  if ((tx?.type === 'payment' || tx?.type === 'checkout') && linkedOrders.length > 0) {
    const orderCount = linkedOrders.length;
    const receiver = vendor?.name || 'Vendor order account';
    const heldInEscrow = linkedOrders.some((order) => order?.payment_method === 'escrow' || order?.payment_method === 'mesomb' || order?.payment_method === 'eversend');
    return {
      title: 'Payment route',
      rows: [
        ['From', `${customer?.name || account.name} via ${formatGatewayName(tx.gateway)}${tx.gateway_transaction_id ? ` (${tx.gateway_transaction_id})` : ''}`],
        ['To', heldInEscrow ? `Escrow/order wallet for ${orderCount} order(s)` : `${receiver} wallet`],
        ['Receiver', receiver],
        ['Purpose', `Checkout payment for ${orderCount} order(s)`],
      ],
    };
  }

  if (tx?.type === 'refund') {
    return {
      title: 'Refund route',
      rows: [
        ['From', primaryOrder ? `${formatGatewayName(tx.gateway || 'escrow')} for ${orderLabel}` : formatGatewayName(tx.gateway || 'manual')],
        ['Refunded to', formatWalletName(tx.user_id, customer?.name || account.name)],
        ['Wallet', walletBalance],
      ],
    };
  }

  if (tx?.type === 'withdrawal' || tx?.type === 'payout') {
    return {
      title: tx.type === 'payout' ? 'Payout route' : 'Withdrawal route',
      rows: [
        ['From', formatWalletName(tx.user_id, account.name)],
        ['To', getWithdrawalDestination(tx)],
        ['Gateway', `${formatGatewayName(tx.gateway)}${tx.gateway_transaction_id ? ` (${tx.gateway_transaction_id})` : ''}`],
      ],
    };
  }

  if (tx?.gateway === 'platform') {
    return {
      title: 'Platform commission route',
      rows: [
        ['From', primaryOrder ? `Escrow settlement on ${orderLabel}` : 'Marketplace settlement'],
        ['Into', 'Auradime platform wallet'],
        ['Related store', vendor?.name || null],
      ],
    };
  }

  if (tx?.gateway === 'escrow') {
    return {
      title: 'Escrow route',
      rows: [
        ['From', formatWalletName(tx.user_id, customer?.name || account.name)],
        ['Into', primaryOrder ? `Escrow vault for ${orderLabel}` : 'Escrow vault'],
        ['Release target', vendor?.name ? `${vendor.name} wallet after delivery` : null],
      ],
    };
  }

  if (tx?.type === 'escrow_release') {
    return {
      title: 'Escrow release route',
      rows: [
        ['From', primaryOrder ? `Escrow vault for ${orderLabel}` : 'Escrow vault'],
        ['Into', formatWalletName(tx.user_id, vendor?.name || account.name)],
        ['Receiver', vendor?.name || account.name],
      ],
    };
  }

  return {
    title: 'Money route',
    rows: [
      ['From', `${account.name || 'System account'} ${tx.gateway ? `via ${formatGatewayName(tx.gateway)}` : ''}`.trim()],
      ['To', primaryOrder ? (vendor?.name || customer?.name || 'Linked order account') : formatWalletName(tx.user_id, account.name)],
      ['Purpose', primaryOrder ? `Transaction for ${orderLabel}` : `${tx.type || 'Ledger'} movement`],
    ],
  };
};

const getAdminFeeSplit = (tx) => {
  const metadata = tx?.metadata || {};
  const breakdown = metadata.platform_fee_breakdown || metadata.fee_breakdown || {};
  const values = {
    commission: Number(breakdown.commission_fee ?? breakdown.commission ?? metadata.commission_fee ?? 0),
    escrow: Number(breakdown.escrow_fee ?? breakdown.escrow ?? metadata.escrow_fee ?? 0),
    collection: Number(metadata.collection_fee ?? metadata.collectionFee ?? 0),
    subscription: Number(metadata.subscription_fee ?? metadata.subscriptionFee ?? 0),
  };
  const total = Object.values(values).reduce((sum, value) => sum + (Number.isFinite(value) && value > 0 ? value : 0), 0);
  return { ...values, total };
};

function OrderItemsList({ order }) {
  const items = order?.products || [];
  if (!items.length) return null;

  return (
    <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/70 p-2.5">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
        Order item(s)
      </p>
      <div className="space-y-2">
        {items.map((item, idx) => {
          const productId = item?.product_id?._id || item?.product_id;
          const image = getOrderItemImage(item);
          const variant = formatVariant(item?.variant);
          const qty = Number(item?.quantity || 1);
          const price = Number(item?.price || item?.product_id?.price || 0);
          const content = (
            <>
              <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--glass-border)] bg-[var(--bg-secondary)]">
                {image ? <img src={image} alt="" className="size-full object-cover" /> : <Database className="size-4 text-[var(--text-secondary)]" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-semibold text-[var(--text-primary)]">{getOrderItemName(item)}</p>
                {variant && <p className="mt-0.5 truncate text-[10px] text-[var(--text-secondary)]">{variant}</p>}
                <p className="mt-0.5 text-[10px] font-mono text-[var(--text-secondary)]">
                  {fmt(price)} XAF x {qty}
                </p>
              </div>
              <p className="shrink-0 text-right text-[10px] font-semibold text-[var(--text-primary)]">
                {fmt(price * qty)} XAF
              </p>
            </>
          );

          return productId ? (
            <a
              key={`${productId}-${idx}`}
              href={`/products/${productId}`}
              className="flex items-center gap-2 rounded-lg p-1.5 transition hover:bg-[var(--bg-secondary)]"
            >
              {content}
            </a>
          ) : (
            <div key={idx} className="flex items-center gap-2 rounded-lg p-1.5">
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AdminFeeSplitCard({ tx }) {
  const split = getAdminFeeSplit(tx);
  if (!split.total && tx?.gateway !== 'platform') return null;

  const rows = [
    ['Admin commission', split.commission],
    ['Escrow commission', split.escrow],
    ['Collection fee', split.collection],
    ['Subscription', split.subscription],
  ];

  return (
    <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.06] p-3">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
        <Database className="size-3.5" /> Admin earning split
      </p>
      <div className="space-y-1.5">
        {rows.map(([label, value]) => (
          <InfoLine key={label} label={label} value={`${fmt(value)} XAF`} />
        ))}
      </div>
    </div>
  );
}

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

function MoneyRouteCard({ route }) {
  const rows = (route?.rows || []).filter(([, value]) => value);
  if (!rows.length) return null;

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3 space-y-2">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
        <CreditCard className="size-3.5" /> {route.title || 'Money route'}
      </p>
      {rows.map(([label, value]) => (
        <InfoLine key={label} label={label} value={value} />
      ))}
    </div>
  );
}

function PersonSummary({ title, person, fallbackName }) {
  const name = person?.name || fallbackName || 'Not recorded';
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-[var(--glass-border)] p-3">
      <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--glass-border)] bg-[var(--bg-secondary)]">
        {person?.avatar ? (
          <img src={person.avatar} alt="" className="size-full object-cover" />
        ) : (
          <User className="size-4 text-[var(--text-secondary)]" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">{title}</p>
        <p className="truncate text-[12px] font-semibold">{name}</p>
        <div className="mt-1 flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)]">
          <Mail className="size-3 shrink-0" />
          <span className="truncate">{person?.email || 'No email recorded'}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)]">
          <Phone className="size-3 shrink-0" />
          <span>{person?.phone || 'No phone recorded'}</span>
        </div>
      </div>
    </div>
  );
}

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [gatewayFilter, setGatewayFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [syncing, setSyncing] = useState(null);
  const [stats, setStats] = useState(null);
  const [gatewaySyncing, setGatewaySyncing] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [recoveringId, setRecoveringId] = useState(null);
  const earnings = stats?.admin_earnings || {};

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        status: statusFilter,
        type: typeFilter,
        search,
        ...(gatewayFilter !== 'all' && { gateway: gatewayFilter }),
      };
      const res = await api.get('/admin/transactions', { params });
      if (res.data?.success) {
        setTransactions(res.data.data.transactions || []);
        setTotalPages(Math.max(1, Math.ceil((res.data.total || 0) / 50)));
      }
    } catch {
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [currentPage, statusFilter, typeFilter, gatewayFilter, search]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/admin/analytics');
      if (res.data.success) {
        const d = res.data.data;
        setStats(d?.stats || d?.payout_intel || d || null);
      }
    } catch {
      console.error('Failed to fetch platform metrics');
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleSearchSubmit = () => {
    setCurrentPage(1);
    fetchTransactions();
  };

  const handleGatewaySync = async () => {
    setGatewaySyncing(true);
    try {
      const res = await api.post('/admin/transactions/sync-gateways');
      if (res.data.success) {
        const { eversendImported = 0, mesombUpdated = 0, eversendUpdated = 0 } = res.data;
        toast.success(
          res.data.message ||
            `Sync done — Eversend: ${eversendImported} imported, ${eversendUpdated} updated; MeSomb: ${mesombUpdated} updated.`
        );
        fetchTransactions();
        fetchStats();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gateway sync failed');
    } finally {
      setGatewaySyncing(false);
    }
  };

  const handleUpdateStatus = async (txId, newStatus) => {
    const admin_note = window.prompt(
      `Mark as ${newStatus}? Enter reason (wallet/order effects may apply):`,
      'Administrative correction'
    );
    if (admin_note === null) return;

    setUpdatingStatus(txId);
    try {
      const res = await api.patch(`/admin/transactions/manual-fix/${txId}`, {
        status: newStatus,
        admin_note,
      });
      if (res.data.success) {
        toast.success(`Updated to ${newStatus}`);
        fetchTransactions();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Status update failed');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleFulfillOrders = async (txId) => {
    setSyncing(txId);
    try {
      const res = await api.post(`/admin/transactions/${txId}/fulfill`);
      if (res.data.success) {
        toast.success(res.data.message || 'Orders fulfilled');
        fetchTransactions();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Fulfillment failed');
    } finally {
      setSyncing(null);
    }
  };

  const handleRecoverPayment = async (tx) => {
    const confirmed = window.confirm(
      `Recover payment for ${tx.reference}?\n\nThis re-checks the gateway and credits ${fmt(tx.amount)} XAF if confirmed.`
    );
    if (!confirmed) return;

    setRecoveringId(tx._id);
    try {
      const res = await api.post(`/payments/eversend/recover/${tx.reference}`);
      if (res.data.success) {
        toast.success(res.data.message);
        fetchTransactions();
      } else {
        const forceIt = window.confirm(
          `${res.data.message}\n\nForce recover anyway? Only if you confirmed receipt in Eversend.`
        );
        if (forceIt) {
          const forceRes = await api.post(`/payments/eversend/recover/${tx.reference}`, { force: true });
          if (forceRes.data.success) {
            toast.success(forceRes.data.message);
            fetchTransactions();
          } else {
            toast.error(forceRes.data.message || 'Force recovery failed');
          }
        }
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Recovery failed';
      if (err.response?.status === 400) {
        const forceIt = window.confirm(`${msg}\n\nForce recover anyway?`);
        if (forceIt) {
          try {
            const forceRes = await api.post(`/payments/eversend/recover/${tx.reference}`, { force: true });
            if (forceRes.data.success) {
              toast.success(forceRes.data.message);
              fetchTransactions();
            } else {
              toast.error(forceRes.data.message || 'Force recovery failed');
            }
          } catch (forceErr) {
            toast.error(forceErr.response?.data?.message || 'Force recovery failed');
          }
        }
      } else {
        toast.error(msg);
      }
    } finally {
      setRecoveringId(null);
    }
  };

  return (
    <AdminFinancePage theme="transactions">
      <AdminFinanceHeader
        theme="transactions"
        icon={CreditCard}
        title="Payment ledger"
        description="Escrow, deposits, and platform revenue"
        badge={
          <>
            <span className="sm:hidden">{transactions.length}</span>
            <span className="hidden sm:inline">{transactions.length} on page</span>
          </>
        }
        onRefresh={fetchTransactions}
        loading={loading}
      />

      <AdminFinanceBody>
        <AdminMetricGrid
          theme="transactions"
          metrics={[
            { label: 'Commission', value: stats ? `${fmt(earnings.commission)}` : '…', hint: 'Product sales XAF' },
            { label: 'Escrow fees', value: stats ? `${fmt(earnings.escrow)}` : '…', hint: 'Escrow protection XAF' },
            { label: 'Collection fees', value: stats ? `${fmt(earnings.collection)}` : '…', hint: 'Mobile money XAF' },
            { label: 'Subscriptions', value: stats ? `${fmt(earnings.subscription)}` : '…', hint: 'Future revenue XAF' },
          ]}
        />

        <AdminListPanel
          theme="transactions"
          variant="ledger"
          title="Ledger entries"
          countLabel={
            <>
              <span className="sm:hidden">Pg {currentPage}</span>
              <span className="hidden sm:inline">Page {currentPage} · 50 per page</span>
            </>
          }
          loading={loading}
          loadingMessage="Loading ledger…"
          isEmpty={!loading && transactions.length === 0}
          emptyIcon={CreditCard}
          emptyMessage="No transactions match your filters."
          listHeader={
            <AdminLedgerTableHeader columns={['Transaction', 'Amount & date', 'Gateway', '']} />
          }
          footer={
            !loading && transactions.length > 0 ? (
              <Pagination
                compact
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            ) : null
          }
          filterSlot={
            <>
              <AdminFilterToolbar>
                <AdminFilterSearch
                  theme="transactions"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onSubmit={handleSearchSubmit}
                  placeholder="Reference or gateway ID"
                />
                <AdminFilterRow>
                  <AdminFilterSelect
                    theme="transactions"
                    value={typeFilter}
                    onChange={(e) => {
                      setTypeFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                  >
                    <option value="all">All types</option>
                    {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </AdminFilterSelect>
                  <AdminFilterSelect
                    theme="transactions"
                    value={gatewayFilter}
                    onChange={(e) => {
                      setGatewayFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                  >
                    <option value="all">All gateways</option>
                    {GATEWAYS.map((g) => (
                      <option key={g} value={g}>
                        {g.charAt(0).toUpperCase() + g.slice(1)}
                      </option>
                    ))}
                  </AdminFilterSelect>
                </AdminFilterRow>
                <AdminFilterButton
                  theme="transactions"
                  onClick={handleGatewaySync}
                  disabled={gatewaySyncing}
                  variant="primary"
                >
                  {gatewaySyncing ? <Loader2 className="size-3.5 animate-spin" /> : <Globe className="size-3.5" />}
                  Sync gateways
                </AdminFilterButton>
              </AdminFilterToolbar>
              <AdminFilterPills
                theme="transactions"
                items={STATUS_FILTERS}
                value={statusFilter}
                onChange={(s) => {
                  setStatusFilter(s);
                  setCurrentPage(1);
                }}
              />
            </>
          }
        >
          {transactions.map((tx, idx) => {
            const status = STATUS_CONFIG[tx.status] || STATUS_CONFIG.pending;
            const type = TYPE_CONFIG[tx.type] || TYPE_CONFIG.payment;
            const isExpanded = expandedId === tx._id;
            const TypeIcon = type.icon;
            const party = getTransactionParty(tx);
            const linkedOrders = getLinkedOrders(tx);
            const transactionAccount = buildTransactionAccount(tx);
            const moneyRoute = buildMoneyRoute(tx, linkedOrders);

            return (
              <div
                key={tx._id}
                className={`transition ${
                  isExpanded ? 'bg-indigo-500/[0.06]' : idx % 2 === 1 ? 'bg-[var(--bg-secondary)]/15' : ''
                }`}
              >
                <button
                  type="button"
                  className="w-full text-left active:bg-[var(--bg-secondary)]/30"
                  onClick={() => setExpandedId(isExpanded ? null : tx._id)}
                >
                  {/* Mobile: compact single-row card */}
                  <div className="flex items-center gap-2.5 px-2.5 py-2.5 sm:hidden">
                    <PartyAvatar
                      src={party.logo}
                      initial={party.initial}
                      alt={party.name}
                      badge={
                        <GatewayBrand
                          gateway={tx.gateway}
                          className="ring-2 ring-[var(--bg-primary)]"
                        />
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[11px] font-semibold capitalize">
                          {tx.type?.replace(/_/g, ' ')}
                        </span>
                        <span
                          className={`shrink-0 rounded-md px-1.5 py-0.5 text-[8px] font-semibold uppercase ${status.bg} ${status.color}`}
                        >
                          {status.label}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate font-mono text-[9px] text-indigo-600 dark:text-indigo-400">
                        #{tx.reference?.slice(-8).toUpperCase()}
                      </p>
                      <p className="mt-0.5 truncate text-[9px] text-[var(--text-secondary)]">{party.name}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <AmountDateColumn
                        compact
                        amount={tx.amount}
                        currency={tx.currency || 'XAF'}
                        createdAt={tx.createdAt}
                        amountClassName="text-indigo-900 dark:text-indigo-200"
                      />
                      <ChevronDown
                        className={`size-4 text-[var(--text-secondary)] transition ${isExpanded ? 'rotate-180 text-indigo-600' : ''}`}
                      />
                    </div>
                  </div>

                  {/* Desktop: ledger grid */}
                  <div className="hidden sm:grid sm:grid-cols-[minmax(0,1fr)_120px_110px_36px] sm:items-center sm:gap-3 sm:px-4 sm:py-2.5">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <PartyAvatar
                        src={party.logo}
                        initial={party.initial}
                        alt={party.name}
                        badge={
                          <GatewayBrand
                            gateway={tx.gateway}
                            className="ring-2 ring-[var(--bg-primary)]"
                          />
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[12px] font-semibold capitalize">
                            {tx.type?.replace(/_/g, ' ')}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase ${status.bg} ${status.color}`}
                          >
                            <TypeIcon className="size-3" />
                            {status.label}
                          </span>
                        </div>
                        <p className="mt-0.5 font-mono text-[10px] text-indigo-600 dark:text-indigo-400">
                          #{tx.reference?.slice(-10).toUpperCase()}
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-[10px] text-[var(--text-secondary)]">
                          {party.name} · {tx.description || '—'}
                        </p>
                      </div>
                    </div>

                    <AmountDateColumn
                      amount={tx.amount}
                      currency={tx.currency || 'XAF'}
                      createdAt={tx.createdAt}
                      amountClassName="text-indigo-900 dark:text-indigo-200"
                    />

                    <div className="flex items-center justify-center">
                      <GatewayBrand gateway={tx.gateway} size="md" />
                    </div>

                    <div className="flex items-center justify-center">
                      <ChevronDown
                        className={`size-4 text-[var(--text-secondary)] transition ${isExpanded ? 'rotate-180 text-indigo-600' : ''}`}
                      />
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
                      <div className="grid gap-2.5 p-2.5 lg:grid-cols-[1fr_1.15fr] sm:gap-3 sm:p-4">
                        <div className="space-y-3">
                          <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/20 p-3 space-y-2">
                          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                            <Database className="size-3.5" /> Transaction data
                          </p>
                            <InfoLine label="Reference" value={tx.reference} mono />
                            <InfoLine label="Gateway ID" value={formatGatewayId(tx)} mono />
                            <InfoLine label="Gateway" value={tx.gateway || 'internal'} />
                            <InfoLine label="Type" value={tx.type?.replace(/_/g, ' ')} />
                            <InfoLine label="Status" value={tx.status} />
                            <InfoLine label="Amount" value={`${fmt(tx.amount)} ${tx.currency || 'XAF'}`} />
                            <InfoLine label="Created" value={new Date(tx.createdAt).toLocaleString()} />
                            {tx.description && (
                              <div className="rounded-lg bg-[var(--bg-primary)]/70 p-2 text-[10px] leading-relaxed text-[var(--text-secondary)]">
                                {tx.description}
                              </div>
                            )}
                          </div>

                          <PersonSummary title="Transaction account" person={transactionAccount} fallbackName="System account" />
                          <AdminFeeSplitCard tx={tx} />
                          <MoneyRouteCard route={moneyRoute} />
                        </div>

                        <div className="space-y-3">
                          {linkedOrders.length > 0 ? (
                            linkedOrders.map((order) => {
                              const customer = buildCustomerPerson(order);
                              const vendor = buildVendorPerson(order);
                              const logistics = buildLogisticsInfo(order);
                              return (
                                <div key={String(order?._id || order)} className="rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/20 p-3 space-y-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                                      Order #{shortId(order)}
                                    </p>
                                    <span className="rounded-md bg-indigo-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase text-indigo-600 dark:text-indigo-300">
                                      {order?.payment_status || '—'} / {order?.order_status || '—'}
                                    </span>
                                  </div>
                                  <div className="grid gap-2 sm:grid-cols-2">
                                    <InfoLine label="Order total" value={order?.total_amount ? `${fmt(order.total_amount)} XAF` : null} />
                                    <InfoLine label="Payment" value={order?.payment_method} />
                                    <InfoLine label="Shipping" value={logistics.method} />
                                    <InfoLine label="Logistics partner" value={logistics.partner} />
                                    <InfoLine label="Logistics contact" value={logistics.contact} />
                                    <InfoLine label="Tracking" value={logistics.tracking} mono />
                                  </div>
                                  <OrderItemsList order={order} />
                                  <div className="grid gap-2 sm:grid-cols-2">
                                    <PersonSummary title="Customer" person={customer} fallbackName="Order customer" />
                                    <PersonSummary title="Vendor store" person={vendor} fallbackName="Vendor" />
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/20 p-3">
                              <p className="text-[11px] font-semibold text-[var(--text-primary)]">No linked order</p>
                              <p className="mt-1 text-[10px] text-[var(--text-secondary)]">
                                This transaction is a wallet, payout, gateway, or platform-level movement without an order record attached.
                              </p>
                            </div>
                          )}

                          <div className="rounded-xl border border-[var(--glass-border)] p-3">
                            <p className="mb-2 text-[11px] font-semibold text-[var(--text-secondary)]">
                              Update status
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {['completed', 'pending', 'failed'].map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={() => handleUpdateStatus(tx._id, s)}
                                  disabled={updatingStatus === tx._id || tx.status === s}
                                  className="rounded-lg border border-[var(--glass-border)] px-2.5 py-1.5 text-[10px] font-medium capitalize hover:border-indigo-500/30 disabled:opacity-40"
                                >
                                  {updatingStatus === tx._id ? (
                                    <Loader2 className="size-3 animate-spin" />
                                  ) : (
                                    s
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>

                          {tx.gateway === 'eversend' &&
                            ['failed', 'pending'].includes(tx.status) &&
                            tx.type === 'deposit' && (
                              <button
                                type="button"
                                onClick={() => handleRecoverPayment(tx)}
                                disabled={recoveringId === tx._id}
                                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-amber-500 text-[11px] font-semibold text-white disabled:opacity-50"
                              >
                                {recoveringId === tx._id ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <RotateCcw className="size-3.5" />
                                )}
                                Recover {fmt(tx.amount)} XAF
                              </button>
                            )}

                          {tx.status === 'completed' && tx.order_ids?.length > 0 && (
                            <button
                              type="button"
                              onClick={() => handleFulfillOrders(tx._id)}
                              disabled={syncing === tx._id}
                              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-[11px] font-semibold text-white disabled:opacity-50"
                            >
                              {syncing === tx._id ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Zap className="size-3.5" />
                              )}
                              Fulfill linked orders
                            </button>
                          )}
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
