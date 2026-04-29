import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, CheckCircle2, XCircle, Clock, AlertCircle,
  Loader2, RefreshCw, Search, Filter, User, ChevronRight,
  ShieldCheck, Info, ArrowUpRight, Zap, MoreHorizontal, Pause
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';
import api from '@/services/api';

function fmt(n) { return Number(n || 0).toLocaleString('fr-CM'); }

const STATUS_BADGE = {
  pending:   'bg-amber-500/15 text-amber-400 border-amber-500/20',
  completed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  rejected:  'bg-red-500/15 text-red-400 border-red-500/20',
};

const METHOD_LABEL = { mtn: 'MTN MoMo', orange: 'Orange Money', bank: 'Bank Transfer' };

function RequestDetails({ request, onClose, onAction, processing }) {
  if (!request) return null;
  const details = request.gateway_response?.details || {};
  const method  = request.gateway_response?.method || 'mtn';

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[400] flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-lg bg-[#0f0f12] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden"
      >
        <div className="absolute -top-10 -right-10 size-40 bg-[var(--accent)]/10 blur-3xl rounded-full" />
        
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight">Request Review</h2>
            <p className="text-[10px] text-white/40 font-black uppercase tracking-widest">{request.reference}</p>
          </div>
          <button onClick={onClose} className="size-10 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-colors">
            <XCircle className="size-5" />
          </button>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
            <div className="size-12 rounded-xl bg-white/5 flex items-center justify-center">
               {request.user_id?.avatar ? <img src={request.user_id.avatar} className="size-full rounded-xl object-cover" /> : <User className="size-6 text-white/20" />}
            </div>
            <div>
              <p className="text-sm font-black text-white">{request.user_id?.name || 'Unknown User'}</p>
              <p className="text-[10px] text-white/40 font-bold">{request.user_id?.email}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-lg font-black text-[var(--accent)]">{fmt(request.amount)}</p>
              <p className="text-[10px] text-white/30 font-bold uppercase">XAF</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-white/5 border border-white/5">
              <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-2">Payout Method</p>
              <p className="text-sm font-black text-white">{METHOD_LABEL[method]}</p>
              <p className="text-[10px] font-bold text-white/50 mt-1">{details.account_number}</p>
            </div>
            <div className="p-5 rounded-2xl bg-white/5 border border-white/5">
              <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-2">Account Name</p>
              <p className="text-sm font-black text-white truncate">{details.holder_name || '—'}</p>
              <p className="text-[10px] font-bold text-emerald-500 mt-1 flex items-center gap-1"><ShieldCheck className="size-3" /> VERIFIED</p>
            </div>
          </div>

          {request.status === 'pending' ? (
            <div className="flex gap-3">
              <button onClick={() => onAction(request._id, 'approve')} disabled={!!processing}
                className="flex-1 h-14 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:brightness-110 disabled:opacity-50 transition-all shadow-lg shadow-emerald-500/20">
                {processing?.includes('approve') ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Approve & Pay
              </button>
              <button onClick={() => onAction(request._id, 'reject')} disabled={!!processing}
                className="flex-1 h-14 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-500/20 disabled:opacity-50 transition-all">
                {processing?.includes('reject') ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />} Reject
              </button>
            </div>
          ) : (
            <div className={`p-4 rounded-2xl border text-center font-black uppercase text-xs tracking-widest ${STATUS_BADGE[request.status]}`}>
              Status: {request.status}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function AdminWithdrawalsPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('pending');
  const [search, setSearch]     = useState('');
  const [processing, setProc]   = useState(null);
  const [toast, setToast]       = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.replace('/wallet');
    }
  }, [user, router]);

  if (!user || user.role !== 'admin') return null;

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/wallet/admin/withdrawals', { params: { status: filter === 'all' ? undefined : filter } });
      if (res.data.success) setWithdrawals(res.data.data.withdrawals || []);
    } catch { showToast('Failed to load withdrawals', 'error'); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const act = async (id, action) => {
    setProc(id + action);
    try {
      await api.patch(`/wallet/admin/withdrawals/${id}`, { action });
      showToast(`Withdrawal ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'held'} successfully.`);
      setSelected(null);
      load();
    } catch (e) {
      showToast(e?.response?.data?.message || 'Action failed.', 'error');
    } finally { setProc(null); }
  };

  const displayed = withdrawals.filter(w => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (w.user_id?.name || '').toLowerCase().includes(q) ||
           (w.user_id?.email || '').toLowerCase().includes(q) ||
           (w.reference || '').toLowerCase().includes(q);
  });

  const totalPending    = withdrawals.filter(w => w.status === 'pending').length;
  const totalPendingXAF = withdrawals.filter(w => w.status === 'pending').reduce((s, w) => s + w.amount, 0);

  return (
    <>
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ y: -20, opacity: 0, x: '-50%' }} animate={{ y: 0, opacity: 1, x: '-50%' }} exit={{ y: -20, opacity: 0, x: '-50%' }}
            className={`fixed top-20 left-1/2 z-[500] flex items-center gap-3 px-6 py-3 rounded-2xl shadow-2xl border backdrop-blur-xl text-sm font-bold ${toast.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}
          >
            {toast.type === 'error' ? <AlertCircle className="size-4" /> : <CheckCircle2 className="size-4" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selected && (
          <RequestDetails 
            request={selected} 
            onClose={() => setSelected(null)} 
            onAction={act}
            processing={processing}
          />
        )}
      </AnimatePresence>

      <div className="px-4 md:px-8 py-8 space-y-8 max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between gap-6 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-black text-white tracking-tight uppercase">Payout Queue</h1>
              <div className="px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5">
                <Zap className="size-2.5 animate-pulse" /> Engine: Optimal
              </div>
            </div>
            <p className="text-sm text-white/40 font-bold">Manage and authorize vendor fund withdrawals.</p>
          </div>
          <button onClick={load} className="size-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-[var(--accent)] hover:border-[var(--accent)]/30 transition-all active:scale-95 group">
            <RefreshCw className={`size-5 group-hover:rotate-180 transition-transform duration-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Pending Requests', value: totalPending, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-400/10' },
            { label: 'Pending Payout', value: `${fmt(totalPendingXAF)}`, sub: 'XAF', icon: Wallet, color: 'text-[var(--accent)]', bg: 'bg-[var(--accent)]/10' },
            { label: 'Processed Today', value: withdrawals.filter(w => w.status === 'completed' && new Date(w.updatedAt).toDateString() === new Date().toDateString()).length, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
            { label: 'Rejected (Total)', value: withdrawals.filter(w => w.status === 'rejected').length, icon: XCircle, color: 'text-red-400', bg: 'bg-red-400/10' },
          ].map(({ label, value, sub, icon: Icon, color, bg }) => (
            <motion.div whileHover={{ y: -5 }} key={label} className="p-6 rounded-[2rem] bg-white/5 border border-white/10 group transition-all">
              <div className={`size-10 rounded-xl ${bg} flex items-center justify-center mb-4 shadow-inner`}>
                <Icon className={`size-5 ${color}`} />
              </div>
              <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">{label}</p>
              <h3 className={`text-2xl font-black mt-1 ${color}`}>
                {value} <span className="text-xs font-bold opacity-40">{sub}</span>
              </h3>
            </motion.div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="flex p-1 bg-white/5 rounded-2xl border border-white/10 w-full md:w-auto">
            {['pending', 'completed', 'rejected', 'all'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === f ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-white/40 hover:text-white'}`}>
                {f}
              </button>
            ))}
          </div>
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-white/20" />
            <input 
              value={search} onChange={e => setSearch(e.target.value)} 
              placeholder="Search Ref, Name, or Email..."
              className="w-full h-14 pl-12 pr-6 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold text-white placeholder:text-white/20 outline-none focus:border-[var(--accent)] transition-all"
            />
          </div>
        </div>

        {/* Requests List */}
        <div className="space-y-3">
          {loading ? (
            <div className="py-24 flex items-center justify-center">
              <Loader2 className="size-10 animate-spin text-[var(--accent)] opacity-20" />
            </div>
          ) : displayed.length === 0 ? (
            <div className="py-24 flex flex-col items-center gap-4 rounded-[3rem] border border-dashed border-white/10 bg-white/[0.02]">
              <div className="size-16 rounded-3xl bg-white/5 flex items-center justify-center text-white/20">
                <CheckCircle2 className="size-8" />
              </div>
              <p className="text-sm font-black text-white/20 uppercase tracking-[0.3em]">No {filter} requests</p>
            </div>
          ) : (
            displayed.map(w => {
              const details = w.gateway_response?.details || {};
              const isPending = w.status === 'pending';
              return (
                <motion.div 
                  layout key={w._id} 
                  onClick={() => setSelected(w)}
                  className="group p-5 rounded-[2rem] bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] hover:border-[var(--accent)]/30 transition-all cursor-pointer relative overflow-hidden"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-6 relative z-10">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="size-14 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:scale-105 transition-transform">
                        {w.user_id?.avatar ? <img src={w.user_id.avatar} className="size-full rounded-2xl object-cover" /> : <User className="size-6 text-white/10" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-white truncate text-base">{w.user_id?.name || 'Unknown Vendor'}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-black uppercase text-white/30 tracking-widest">{w.reference}</span>
                          <span className="size-1 rounded-full bg-white/10" />
                          <span className="text-[10px] font-bold text-white/40">{new Date(w.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-8 px-6 border-l border-white/10">
                      <div>
                        <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-1">Amount</p>
                        <p className="text-xl font-black text-white tracking-tighter">{fmt(w.amount)} <span className="text-xs text-white/40">XAF</span></p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-1">Status</p>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${STATUS_BADGE[w.status]}`}>
                          {w.status}
                        </span>
                      </div>
                    </div>

                    <div className="hidden lg:flex flex-col items-end gap-1 min-w-[120px]">
                      <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">{METHOD_LABEL[w.gateway_response?.method] || 'MTN MoMo'}</p>
                      <p className="text-xs font-bold text-white/60">{details.account_number}</p>
                    </div>

                    <div className="flex items-center justify-center size-10 rounded-full bg-white/5 text-white/20 group-hover:text-[var(--accent)] group-hover:bg-[var(--accent)]/10 transition-all">
                      <ChevronRight className="size-5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
