export const STATUS_CONFIG = {
  placed:         { label: 'Placed',      color: 'text-purple-600',  bg: 'bg-purple-500/10',  border: 'border-purple-500/20',  dot: 'bg-purple-500' },
  pending:        { label: 'Pending',     color: 'text-amber-600',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   dot: 'bg-amber-500' },
  processing:     { label: 'Processing',  color: 'text-blue-500',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    dot: 'bg-blue-500' },
  confirmed:      { label: 'Confirmed',   color: 'text-blue-500',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    dot: 'bg-blue-500' },
  shipped:        { label: 'Shipped',     color: 'text-indigo-600',  bg: 'bg-indigo-500/10',  border: 'border-indigo-500/20',  dot: 'bg-indigo-500' },
  in_transit:     { label: 'In Transit',  color: 'text-indigo-600',  bg: 'bg-indigo-500/10',  border: 'border-indigo-500/20',  dot: 'bg-indigo-500' },
  delivered:      { label: 'Delivered',   color: 'text-emerald-600', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', dot: 'bg-emerald-500' },
  completed:      { label: 'Completed',   color: 'text-emerald-600', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', dot: 'bg-emerald-500' },
  cancelled:      { label: 'Cancelled',   color: 'text-red-600',     bg: 'bg-red-500/10',     border: 'border-red-500/20',     dot: 'bg-red-500' },
  refund_pending: { label: 'Refund',      color: 'text-amber-600',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   dot: 'bg-amber-500' },
  refunded:       { label: 'Refunded',    color: 'text-sky-600',     bg: 'bg-sky-500/10',     border: 'border-sky-500/20',     dot: 'bg-sky-500' },
  failed:         { label: 'Failed',      color: 'text-rose-600',    bg: 'bg-rose-500/10',    border: 'border-rose-500/20',    dot: 'bg-rose-500' },
};

export const PAYMENT_STATUS = {
  pending:  { label: 'Unpaid',    color: 'text-amber-600',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
  paid:     { label: 'Paid',      color: 'text-emerald-600', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  failed:   { label: 'Failed',    color: 'text-rose-600',    bg: 'bg-rose-500/10',    border: 'border-rose-500/20' },
  refunded: { label: 'Refunded',  color: 'text-sky-600',     bg: 'bg-sky-500/10',     border: 'border-sky-500/20' },
};

export function getStatusConfig(status) {
  return STATUS_CONFIG[status] || { label: status, color: 'text-[var(--text-secondary)]', bg: 'bg-[var(--bg-secondary)]', border: 'border-[var(--glass-border)]', dot: 'bg-gray-400' };
}
