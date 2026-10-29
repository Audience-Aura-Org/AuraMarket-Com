'use client';

/**
 * Admin: audit log — who changed what, when, newest first. Filtering and paging
 * happen on the server (GET /admin/audit?category=&page=), so filters cover the
 * whole history, not just the loaded page.
 */
import { useCallback, useEffect, useState } from 'react';
import api from '@/services/api';
import { Shield, Clock, User, RefreshCw, AlertTriangle, Database, Activity, Loader2, ChevronDown } from 'lucide-react';
import { toast } from 'react-hot-toast';

import Pagination from '@/components/common/Pagination';
import StatCard from '@/components/layout/StatCard';

const CATEGORIES = [
  ['all', 'All'],
  ['users', 'Users'],
  ['payments', 'Payments'],
  ['deliveries', 'Deliveries'],
  ['orders', 'Orders'],
  ['products', 'Products'],
  ['disputes', 'Disputes'],
];

// Plain-language names for recorded actions; anything else is humanised.
const ACTION_LABELS = {
  admin_direct_payout: 'Direct payout by admin',
  agency_package_created: 'Agency package registered',
  agency_remittance_recorded: 'Agency cash remittance recorded',
  demote_manager: 'Manager removed',
  promote_to_manager: 'Made a manager',
  payment_settled: 'Payment settled',
  price_change: 'Price changed',
  rider_cash_handover: 'Rider handed over cash',
  rider_invited: 'Rider invited',
  rider_reactivated: 'Rider reactivated',
  rider_deactivated: 'Rider deactivated',
  role_change: 'Role changed',
  subscription_activated: 'Subscription activated',
  verification_status_change: 'Verification status changed',
  wallet_credit: 'Wallet credited',
  wallet_debit: 'Wallet debited',
};
const TARGET_LABELS = {
  user: 'User', vendor: 'Vendor', transaction: 'Payment', usersubscription: 'Subscription', subscription: 'Subscription',
  shipment: 'Delivery', riderprofile: 'Rider', logisticscompany: 'Delivery agency', agencysettlement: 'Agency cash',
  order: 'Order', product: 'Product', dispute: 'Dispute', wallet: 'Wallet', withdrawal: 'Withdrawal',
};
const HIGH_PRIORITY = /ban|delete|suspend|reject|demote|deactivat|direct_payout|role_change|limited|refund/;

const humanise = (s) => String(s || '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^./, (c) => c.toUpperCase());
const actionLabel = (a) => ACTION_LABELS[a] || humanise(a);
const targetLabel = (t) => TARGET_LABELS[String(t || '').toLowerCase()] || humanise(t);

const actionTone = (a = '') => {
  if (HIGH_PRIORITY.test(a)) return 'text-rose-600 bg-rose-500/10 border-rose-500/20';
  if (/approve|resolve|activat|settled|credit|invited|promote|created|recorded|handover/.test(a)) return 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20';
  if (/change|update|edit|debit/.test(a)) return 'text-amber-600 bg-amber-500/10 border-amber-500/20';
  return 'text-indigo-600 bg-indigo-500/10 border-indigo-500/20';
};

const ago = (iso) => {
  if (!iso) return '—';
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} h ago`;
  return `${Math.round(mins / 1440)} d ago`;
};

// Short readable value for the before/after columns.
const show = (v) => {
  if (v === undefined || v === null || v === '') return '—';
  if (typeof v === 'object') return Object.entries(v).map(([k, x]) => `${humanise(k)}: ${typeof x === 'object' && x !== null ? JSON.stringify(x) : x}`).join(' · ');
  return String(v);
};

function Change({ log }) {
  const [open, setOpen] = useState(false);
  const before = log.changes?.old;
  const after = log.changes?.new;
  const details = log.metadata?.details && Object.keys(log.metadata.details).length ? log.metadata.details : null;
  if (before === undefined && after === undefined && !details) return null;
  return (
    <div className="mt-3 space-y-2">
      {(before !== undefined || after !== undefined) && (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/40 px-3 py-2">
            <p className="text-[10px] font-semibold text-[var(--text-secondary)]">Before</p>
            <p className="mt-0.5 break-words text-[12px] text-[var(--text-primary)]">{show(before)}</p>
          </div>
          <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/40 px-3 py-2">
            <p className="text-[10px] font-semibold text-[var(--text-secondary)]">After</p>
            <p className="mt-0.5 break-words text-[12px] text-[var(--text-primary)]">{show(after)}</p>
          </div>
        </div>
      )}
      {details && (
        <div>
          <button type="button" onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)]">
            <ChevronDown className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`} /> {open ? 'Hide details' : 'Show details'}
          </button>
          {open && <pre className="mt-1.5 max-h-48 overflow-auto rounded-xl bg-[var(--bg-secondary)]/60 p-3 text-[11px] leading-relaxed text-[var(--text-primary)]">{JSON.stringify(details, null, 2)}</pre>}
        </div>
      )}
    </div>
  );
}

export default function AdminAuditLogs() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(1);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/audit', { params: { page, limit: 20, ...(category !== 'all' && { category }) }, skipClientCache: true });
      if (res.data?.success) setData(res.data.data);
    } catch {
      toast.error('Could not load the audit log.');
    } finally {
      setLoading(false);
    }
  }, [page, category]);
  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const logs = data?.logs || [];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-32">
      <div className="mx-auto w-full max-w-[1200px] space-y-5 px-4 py-6 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent)]/10 text-[var(--accent)]">
              <Shield className="size-5" />
            </div>
            <div>
              <h1 className="text-[18px] font-bold tracking-tight text-[var(--text-primary)]">Audit log</h1>
              <p className="text-[11px] text-[var(--text-secondary)]">Who changed what, and when. Newest first.</p>
            </div>
          </div>
          <button type="button" onClick={fetchLogs} aria-label="Refresh" className="flex size-10 items-center justify-center rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--accent)]">
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatCard label="Events" value={data?.total ?? '—'} icon={Database} color="primary" sub={category === 'all' ? 'All categories' : CATEGORIES.find(([k]) => k === category)?.[1]} />
          <StatCard label="High priority" value={data?.high_priority ?? '—'} icon={AlertTriangle} color="rose" sub="Bans, deletions, payouts, role changes" />
          <StatCard label="Latest event" value={ago(data?.latest_at)} icon={Activity} color="emerald" sub={data?.latest_at ? new Date(data.latest_at).toLocaleString() : 'No events yet'} />
        </div>

        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1" role="tablist" aria-label="Category">
          {CATEGORIES.map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={category === key}
              onClick={() => { setCategory(key); setPage(1); }}
              className={`min-h-9 shrink-0 rounded-full px-4 text-[12px] font-semibold transition-colors ${category === key ? 'bg-[var(--accent)] text-white' : 'border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)]">
          {loading && !logs.length ? (
            <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-[var(--accent)]" /></div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
              <Shield className="size-8 text-[var(--text-secondary)] opacity-40" />
              <p className="text-[13px] font-semibold">Nothing recorded here yet</p>
            </div>
          ) : (
            <ul className={`divide-y divide-[var(--glass-border)] ${loading ? 'opacity-60' : ''}`}>
              {logs.map((log) => (
                <li key={log._id} className="flex gap-3 p-4 md:p-5">
                  <div className="size-10 shrink-0 overflow-hidden rounded-full bg-[var(--bg-secondary)]">
                    {log.user_id?.avatar ? <img src={log.user_id.avatar} className="size-full object-cover" alt="" /> : <User className="size-full p-2.5 text-[var(--text-secondary)] opacity-50" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className={`rounded-lg border px-2 py-0.5 text-[11px] font-semibold ${actionTone(log.action)}`}>{actionLabel(log.action)}</span>
                      <span className="text-[12px] text-[var(--text-secondary)]">
                        {targetLabel(log.target_type)} <span className="font-mono text-[11px] text-[var(--text-primary)]">#{String(log.target_id || '').slice(-8).toUpperCase()}</span>
                      </span>
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-[var(--text-secondary)]">
                      <span className="font-semibold text-[var(--text-primary)]">{log.user_id?.name || 'System'}</span>
                      {log.user_id?.role && <span className="capitalize">{log.user_id.role}</span>}
                      <span className="inline-flex items-center gap-1"><Clock className="size-3" />{new Date(log.createdAt).toLocaleString()}</span>
                    </p>
                    <Change log={log} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {(data?.pages || 1) > 1 && (
            <div className="flex justify-center border-t border-[var(--glass-border)] p-4">
              <Pagination currentPage={page} totalPages={data.pages} onPageChange={setPage} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
