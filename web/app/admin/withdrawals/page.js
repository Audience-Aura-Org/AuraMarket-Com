"use client";
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, XCircle, Loader2,
  RefreshCw, Search, User, Users, ChevronRight, ShieldCheck,
  Zap, RotateCcw, Copy, Globe, Clock, AlertCircle, CheckCircle2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';
import api from '@/services/api';
import { fmt, STATUS_CONFIG, getStatusConfig, getMethodIcon } from '@/utils/adminFinance';

// Map STATUS_CONFIG shape to the local `cls` string format used in this page
const STATUS = Object.fromEntries(
  Object.entries(STATUS_CONFIG).map(([k, v]) => [
    k, { cls: `${v.bg} ${v.color} ${v.border}`, icon: v.icon }
  ])
);

function KPI({ title, value, icon: Icon, color, sub }) {
  const c = { fuchsia: 'bg-[var(--accent)]/10 text-[var(--accent)]', blue: 'bg-indigo-500/10 text-indigo-500', emerald: 'bg-emerald-500/10 text-emerald-500', amber: 'bg-amber-500/10 text-amber-500' };
  return (
    <div className="bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-3xl p-6 relative overflow-hidden glass-panel">
      <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full blur-2xl opacity-20 ${c[color]?.split(' ')[0]}`} />
      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-4 ${c[color]}`}><Icon className="w-5 h-5" /></div>
      <p className="text-[11px] lg:text-[12px]  font-semibold tracking-[0.15em] text-[var(--text-secondary)] opacity-50">{title}</p>
      <h3 className="text-2xl  font-bold text-[var(--text-primary)] mt-1 tabular-nums">{value}</h3>
      {sub && <p className="text-[10px] lg:text-[12px] text-[var(--text-secondary)] opacity-40 mt-1">{sub}</p>}
    </div>
  );
}

function DetailDrawer({ wr, onClose, onApprove, onReject, onRecheck, processing }) {
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  if (!wr) return null;

  const S = STATUS[wr.status] || STATUS.pending;
  const SIcon = S.icon;
  const MIcon = getMethodIcon(wr.withdrawalMethod) || Wallet;
  const rd = wr.recipientDetails || {};

  const copy = (text) => { navigator.clipboard.writeText(text); };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        className="relative w-full max-w-lg bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-[2.5rem] p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="absolute -top-10 -right-10 size-40 bg-[var(--accent)]/5 blur-3xl rounded-full" />

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg  font-bold tracking-tight">Withdrawal Review</h2>
            <p className="text-[10px] lg:text-[12px] text-[var(--text-secondary)] opacity-40 font-mono">{wr._id}</p>
          </div>
          <button onClick={onClose} className="size-9 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all">
            <XCircle className="size-5" />
          </button>
        </div>

        {/* Requester */}
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] mb-6">
          <div className="size-12 rounded-xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center overflow-hidden shrink-0">
            {wr.requestedBy?.avatar
              ? <img src={wr.requestedBy.avatar} className="size-full object-cover" alt="" />
              : <User className="size-6 opacity-20" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className=" font-bold text-[var(--text-primary)] truncate">{wr.requestedBy?.name || '—'}</p>
            <p className="text-[10px] lg:text-[12px] text-[var(--text-secondary)] opacity-50 truncate">{wr.requestedBy?.email}</p>
            <span className="text-[10px] lg:text-[12px]  font-semibold tracking-widest px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">{wr.role?.toUpperCase()}</span>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xl  font-bold tabular-nums">{fmt(wr.amount)}</p>
            <p className="text-[10px] lg:text-[12px]  font-semibold opacity-30">{wr.currency}</p>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)]">
            <p className="text-[10px] lg:text-[12px]  font-semibold opacity-40 mb-1">Method</p>
            <div className="flex items-center gap-2">
              <MIcon className="size-4 text-[var(--accent)]" />
              <p className="text-sm  font-bold capitalize">{wr.withdrawalMethod}</p>
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)]">
            <p className="text-[10px] lg:text-[12px]  font-semibold opacity-40 mb-1">Status</p>
            <div className={`flex items-center gap-1 text-xs  font-bold ${S.cls.split(' ').slice(1).join(' ')}`}>
              <SIcon className="size-3" />
              <span className="capitalize">{wr.status}</span>
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)]">
            <p className="text-[10px] lg:text-[12px]  font-semibold opacity-40 mb-1">Recipient</p>
            <p className="text-xs  font-bold">{rd.firstName} {rd.lastName}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <Globe className="size-3 opacity-30" />
              <p className="text-[10px] lg:text-[12px] opacity-50">{rd.country}</p>
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)]">
            <p className="text-[10px] lg:text-[12px]  font-semibold opacity-40 mb-1">Destination</p>
            <p className="text-xs  font-bold font-mono truncate">{rd.phoneNumber || rd.accountNumber || rd.eversendTag || '—'}</p>
            {rd.bankCode && <p className="text-[10px] lg:text-[12px] opacity-50 mt-0.5">{rd.bankCode}</p>}
          </div>
        </div>

        {/* Eversend TX ID */}
        {wr.eversendTransactionId && (
          <div className="p-4 rounded-2xl bg-[var(--accent)]/5 border border-[var(--accent)]/20 mb-6 flex items-center gap-3">
            <Zap className="size-4 text-[var(--accent)] shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] lg:text-[12px]  font-semibold opacity-50">Eversend Transaction ID</p>
              <p className="text-xs font-mono  font-bold truncate">{wr.eversendTransactionId}</p>
            </div>
            <button onClick={() => copy(wr.eversendTransactionId)} className="size-8 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center hover:bg-[var(--accent)]/20 transition-all">
              <Copy className="size-3 text-[var(--accent)]" />
            </button>
          </div>
        )}

        {/* Rejection/Failure reason */}
        {(wr.rejectionReason || wr.failureReason) && (
          <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/20 mb-6">
            <p className="text-[10px] lg:text-[12px]  font-semibold text-red-500 mb-1">{wr.rejectionReason ? 'Rejection Reason' : 'Failure Reason'}</p>
            <p className="text-xs text-[var(--text-secondary)]">{wr.rejectionReason || wr.failureReason}</p>
          </div>
        )}

        {wr.note && (
          <div className="p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] mb-6">
            <p className="text-[10px] lg:text-[12px]  font-semibold opacity-40 mb-1">Requester Note</p>
            <p className="text-xs">{wr.note}</p>
          </div>
        )}

        {/* Actions */}
        {wr.status === 'pending' && !showRejectForm && (
          <div className="flex gap-3">
            <button onClick={() => onApprove(wr._id)} disabled={!!processing}
              className="flex-1 h-13 bg-emerald-500 text-white rounded-2xl  font-bold text-xs tracking-tight flex items-center justify-center gap-2 hover:brightness-110 disabled:opacity-50 transition-all shadow-lg shadow-emerald-500/20 py-3">
              {processing === 'approve' ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Approve & Pay
            </button>
            <button onClick={() => setShowRejectForm(true)} disabled={!!processing}
              className="flex-1 h-13 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl  font-bold text-xs tracking-tight flex items-center justify-center gap-2 hover:bg-red-500/20 disabled:opacity-50 transition-all py-3">
              <XCircle className="size-4" /> Reject
            </button>
          </div>
        )}

        {wr.status === 'pending' && showRejectForm && (
          <div className="space-y-3">
            <textarea
              placeholder="Enter rejection reason (required)..."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={3}
              className="w-full p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-xs  font-bold outline-none focus:border-red-500 transition-all resize-none"
            />
            <div className="flex gap-3">
              <button onClick={() => onReject(wr._id, rejectReason)} disabled={!!processing || rejectReason.trim().length < 5}
                className="flex-1 h-12 bg-red-500 text-white rounded-2xl  font-bold text-xs disabled:opacity-50 flex items-center justify-center gap-2">
                {processing === 'reject' ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />} Confirm Rejection
              </button>
              <button onClick={() => setShowRejectForm(false)}
                className="h-12 px-5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-xs  font-bold">
                Cancel
              </button>
            </div>
          </div>
        )}

        {(wr.status === 'approved' || wr.status === 'processing_error') && (
          <button onClick={() => onRecheck(wr._id)} disabled={!!processing}
            className="w-full h-12 bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 rounded-2xl  font-bold text-xs flex items-center justify-center gap-2 hover:bg-indigo-500/20 disabled:opacity-50 transition-all">
            {processing === 'recheck' ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} Recheck Eversend Status
          </button>
        )}
      </motion.div>
    </motion.div>
  );
}

const TABS = ['pending', 'approved', 'completed', 'rejected', 'failed', 'all'];

export default function AdminWithdrawalsPage() {
  const { user } = useAuthStore();
  const router   = useRouter();
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [filter, setFilter]     = useState('pending');
  const [roleFilter, setRoleFilter] = useState('all');
  const [search, setSearch]     = useState('');
  const [processing, setProc]   = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!user) { router.replace('/login?from=admin-withdrawals'); return; }
    if (user.role !== 'admin') { router.replace('/wallet'); }
  }, [user, router]);

  if (!user || user.role !== 'admin') return null;


  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter !== 'all') params.status = filter;
      if (roleFilter !== 'all') params.role = roleFilter;
      const res = await api.get('/withdrawals/admin', { params });
      if (res.data.success) {
        setWithdrawals(res.data.data.withdrawals || []);
        setPendingCount(res.data.data.pendingCount || 0);
      }
    } catch { toast.error('Failed to load withdrawals'); }
    finally { setLoading(false); }
  }, [filter, roleFilter]);

  useEffect(() => { load(); }, [load, filter, roleFilter]);

  const handleApprove = async (id) => {
    setProc('approve');
    try {
      const res = await api.post(`/withdrawals/admin/${id}/approve`);
      toast.success(res.data.message || 'Approved. Payout sent to Eversend.');
      setSelected(null);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Approval failed.');
    } finally { setProc(null); }
  };

  const handleReject = async (id, reason) => {
    if (!reason || reason.trim().length < 5) { toast.error('Rejection reason too short.'); return; }
    setProc('reject');
    try {
      await api.post(`/withdrawals/admin/${id}/reject`, { rejectionReason: reason });
      toast.success('Request rejected. User notified.');
      setSelected(null);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Rejection failed.');
    } finally { setProc(null); }
  };

  const handleRecheck = async (id) => {
    setProc('recheck');
    try {
      const res = await api.post(`/withdrawals/admin/${id}/recheck`);
      toast.success(res.data.message || 'Status synced from Eversend.');
      load();
      // Refresh selected drawer
      setSelected(prev => prev ? { ...prev, ...res.data.data?.withdrawal } : null);
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Recheck failed.');
    } finally { setProc(null); }
  };

  const displayed = withdrawals.filter(w => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (w.requestedBy?.name || '').toLowerCase().includes(q) ||
           (w.requestedBy?.email || '').toLowerCase().includes(q) ||
           (w._id || '').toLowerCase().includes(q);
  });

  return (
    <>
      {/* Detail Drawer */}
      <AnimatePresence>
        {selected && (
          <DetailDrawer
            wr={selected}
            onClose={() => setSelected(null)}
            onApprove={handleApprove}
            onReject={handleReject}
            onRecheck={handleRecheck}
            processing={processing}
          />
        )}
      </AnimatePresence>

      <div className="px-4 md:px-8 py-8 w-full space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <ShieldCheck className="size-6 text-purple-500" />
            </div>
            <div>
              <h1 className="text-2xl  font-bold tracking-tight">Payout Queue</h1>
              <p className="text-xs text-[var(--text-secondary)] opacity-60  font-bold tracking-tight">
                Eversend Withdrawal Approvals
                {pendingCount > 0 && <span className="ml-2 px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-[10px] lg:text-[12px]">{pendingCount} PENDING</span>}
              </p>
            </div>
          </div>
          <button onClick={load} className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all">
            <RefreshCw className={`size-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPI title="Pending" value={pendingCount} icon={Clock} color="fuchsia" sub="Awaiting Action" />
          <KPI title="Total Shown" value={displayed.length} icon={Wallet} color="blue" sub="In Current Filter" />
          <KPI title="Approved" value={withdrawals.filter(w => w.status === 'approved').length} icon={Zap} color="emerald" sub="Sent to Eversend" />
          <KPI title="Failed" value={withdrawals.filter(w => ['failed','processing_error'].includes(w.status)).length} icon={AlertCircle} color="amber" sub="Need Attention" />
        </div>

        {/* Filter Tabs + Search */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="flex flex-wrap gap-1 p-1 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl">
              {TABS.map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-xl text-[10px] lg:text-[12px]  font-semibold tracking-tight transition-all capitalize ${filter === f ? 'bg-[var(--accent)] text-white shadow-sm' : 'text-[var(--text-secondary)] opacity-50 hover:opacity-100'}`}>
                  {f}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-3 py-2">
               <Users className="size-3.5 opacity-40" />
               <select 
                 value={roleFilter} 
                 onChange={e => setRoleFilter(e.target.value)}
                 className="bg-transparent text-[10px] lg:text-[12px]  font-semibold tracking-tight text-[var(--text-secondary)] outline-none"
               >
                  <option value="all">All Roles</option>
                  <option value="vendor">Vendors</option>
                  <option value="logistics">Logistics</option>
                  <option value="user">Customers</option>
               </select>
            </div>
            <div className="relative flex-1 w-full sm:w-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-3.5 opacity-30" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search name, email, or ID..."
                className="w-full h-11 pl-10 pr-5 bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-2xl text-xs  font-bold outline-none focus:border-[var(--accent)] transition-all" />
            </div>
          </div>

          {/* Results */}
          <div className="space-y-2 min-h-[300px]">
            {loading ? (
              <div className="py-20 flex justify-center opacity-20"><Loader2 className="animate-spin size-8" /></div>
            ) : displayed.length === 0 ? (
              <div className="py-20 text-center border border-dashed border-[var(--glass-border)] rounded-[2rem] opacity-30">
                <Wallet className="size-10 mx-auto mb-4" />
                <p className="text-sm  font-bold">No withdrawal requests in this filter</p>
              </div>
            ) : displayed.map(w => {
              const S = STATUS[w.status] || STATUS.pending;
              const SIcon = S.icon;
              const MIcon = getMethodIcon(w.withdrawalMethod) || Wallet;
              return (
                <div key={w._id} onClick={() => setSelected(w)}
                  className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] hover:border-[var(--accent)]/30 transition-all flex items-center gap-4 cursor-pointer group">
                  <div className={`size-11 rounded-xl flex items-center justify-center border ${S.cls}`}>
                    <SIcon className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className=" font-bold text-sm text-[var(--text-primary)] truncate">{w.requestedBy?.name || '—'}</p>
                      <span className="text-[10px] lg:text-[12px]  font-semibold tracking-widest px-1.5 py-0.5 rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)] opacity-60 shrink-0">
                        {w.role?.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <div className="flex items-center gap-1 text-[10px] lg:text-[12px] text-[var(--text-secondary)] opacity-50">
                        <MIcon className="size-3" />
                        <span className="capitalize">{w.withdrawalMethod}</span>
                      </div>
                      <span className="text-[10px] lg:text-[12px] opacity-30">•</span>
                      <p className="text-[10px] lg:text-[12px] text-[var(--text-secondary)] opacity-40">{new Date(w.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base  font-bold tabular-nums">{fmt(w.amount)}</p>
                    <p className="text-[10px] lg:text-[12px]  font-semibold opacity-30">{w.currency}</p>
                  </div>
                  <ChevronRight className="size-4 opacity-20 group-hover:opacity-60 group-hover:translate-x-1 transition-all" />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
