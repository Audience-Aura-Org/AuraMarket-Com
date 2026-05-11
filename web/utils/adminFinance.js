/**
 * utils/adminFinance.js
 * Shared constants and helpers for Admin Transactions and Withdrawals pages.
 */

import {
  CheckCircle2, Clock, XCircle, AlertCircle,
  Zap, ArrowUpRight, ShoppingBag, Globe,
  RefreshCw, CreditCard, Phone, Building2, Tag, Wallet
} from 'lucide-react';

// ── Number formatter (Cameroon locale) ───────────────────────────────────────
export const fmt = (n) => Number(n || 0).toLocaleString('fr-CM');

// ── Transaction Status Config ─────────────────────────────────────────────────
export const STATUS_CONFIG = {
  completed:        { label: 'Completed',  color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: CheckCircle2 },
  success:          { label: 'Success',    color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: CheckCircle2 },
  pending:          { label: 'Pending',    color: 'text-amber-500',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20',  icon: Clock },
  processing:       { label: 'Processing', color: 'text-blue-400',    bg: 'bg-blue-400/10',    border: 'border-blue-400/20',   icon: Clock },
  approved:         { label: 'Approved',   color: 'text-blue-500',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20',   icon: Zap },
  failed:           { label: 'Failed',     color: 'text-rose-500',    bg: 'bg-rose-500/10',    border: 'border-rose-500/20',   icon: XCircle },
  rejected:         { label: 'Rejected',   color: 'text-rose-600',    bg: 'bg-rose-600/10',    border: 'border-rose-600/20',   icon: XCircle },
  cancelled:        { label: 'Cancelled',  color: 'text-gray-500',    bg: 'bg-gray-500/10',    border: 'border-gray-500/20',   icon: XCircle },
  processing_error: { label: 'Error',      color: 'text-orange-500',  bg: 'bg-orange-500/10',  border: 'border-orange-500/20', icon: AlertCircle },
};

export const getStatusConfig = (status) =>
  STATUS_CONFIG[status] || STATUS_CONFIG.pending;

// ── Transaction Type Config ───────────────────────────────────────────────────
export const TYPE_CONFIG = {
  deposit:           { label: 'Deposit',          icon: Zap,          color: 'text-blue-500' },
  payment:           { label: 'Order Pay',         icon: ShoppingBag,  color: 'text-purple-500' },
  withdrawal:        { label: 'Withdrawal',        icon: ArrowUpRight, color: 'text-orange-500' },
  refund:            { label: 'Refund',             icon: RefreshCw,    color: 'text-rose-500' },
  escrow_release:    { label: 'Escrow Release',    icon: Globe,        color: 'text-emerald-500' },
  payout:            { label: 'Vendor Payout',     icon: CreditCard,   color: 'text-indigo-500' },
  commission:        { label: 'Platform Fee',      icon: Tag,          color: 'text-pink-500' },
  logistics_credit:  { label: 'Logistics Credit',  icon: Building2,    color: 'text-cyan-500' },
  wallet_debit:      { label: 'Wallet Debit',      icon: Wallet,       color: 'text-amber-500' },
  wallet_credit:     { label: 'Wallet Credit',     icon: Wallet,       color: 'text-teal-500' },
};

// ── Withdrawal Method Icon Map ────────────────────────────────────────────────
export const METHOD_ICON = {
  momo:     Phone,
  bank:     Building2,
  eversend: Tag,
};

export const getMethodIcon = (method) => METHOD_ICON[method] || Wallet;
